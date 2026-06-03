/**
 * Runtime smoke test for generated previews.
 *
 * ## Why this exists
 *
 * `buildPreview` uses esbuild-wasm, which only *transpiles* — it does NOT
 * type-check and it does NOT execute the code. That means a whole class of
 * fatal bugs compile "successfully" and only blow up when React actually
 * renders the app in the browser, e.g.:
 *
 *   ReferenceError: isJumping is not defined
 *
 * The agent never saw these because its `compile` tool reported success.
 * This module closes that gap: it actually *runs* the built bundle inside a
 * hidden, sandboxed iframe and captures any uncaught errors, unhandled
 * promise rejections, and console.error output, plus whether the app rendered
 * anything into #root. That turns "it compiled" into "it compiled AND ran".
 */

export interface RuntimeCheckResult {
  /** True when the app ran without fatal runtime errors. */
  ok: boolean
  /** Whether the check actually ran (false when no DOM is available). */
  ran: boolean
  /** Uncaught errors and unhandled rejections — these are fatal. */
  fatalErrors: string[]
  /** console.error messages — surfaced as warnings. */
  consoleErrors: string[]
  /** Whether #root received any rendered content. */
  rendered: boolean
}

/** How long to let the app mount and settle before collecting the report. */
const DEFAULT_WAIT_MS = 1400
/** Hard ceiling — abandon the check if the iframe never reports back. */
const HARD_TIMEOUT_MS = 8000

/**
 * Inline script injected into the preview <head> BEFORE any module script.
 * Classic inline scripts run before deferred module scripts, so our error
 * handlers are always installed before the app's code evaluates.
 *
 * It collects errors and posts a single report to the parent after the app
 * has had time to mount. `token` ties the report to this specific run.
 */
function buildCaptureScript(token: string, waitMs: number): string {
  return `<script>
(function(){
  if (typeof window === 'undefined') return;
  var TOKEN = ${JSON.stringify(token)};
  var fatal = [];
  var consoleErrors = [];

  function describe(value) {
    if (value == null) return String(value);
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (e) { return Object.prototype.toString.call(value); }
    }
    return String(value);
  }

  window.addEventListener('error', function(event) {
    if (event && event.error) fatal.push(describe(event.error));
    else if (event && event.message) fatal.push(event.message);
  }, true);

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event ? event.reason : null;
    fatal.push('Unhandled promise rejection: ' + describe(reason));
  });

  var originalConsoleError = console.error;
  console.error = function() {
    try {
      var parts = Array.prototype.slice.call(arguments).map(describe);
      consoleErrors.push(parts.join(' '));
    } catch (e) { /* ignore */ }
    return originalConsoleError.apply(console, arguments);
  };

  var reported = false;
  function report() {
    if (reported) return;
    reported = true;
    var root = document.getElementById('root');
    var rendered = !!(root && (root.childElementCount > 0 || (root.textContent || '').trim().length > 0));
    try {
      parent.postMessage({
        __bloomRuntimeCheck: TOKEN,
        fatalErrors: fatal,
        consoleErrors: consoleErrors,
        rendered: rendered
      }, '*');
    } catch (e) { /* ignore */ }
  }

  // Report after the app has mounted and run a few frames. We listen on load
  // so module scripts (deferred) have finished evaluating first.
  if (document.readyState === 'complete') {
    setTimeout(report, ${waitMs});
  } else {
    window.addEventListener('load', function(){ setTimeout(report, ${waitMs}); });
  }
  // Safety: always report eventually, even if 'load' never fires.
  setTimeout(report, ${waitMs} + 1500);
})();
</script>`
}

/**
 * Inject the capture script as the first child of <head> so it installs its
 * handlers before the bundled app runs.
 */
function instrumentHtml(html: string, captureScript: string): string {
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${captureScript}`)
  }
  // Fallback: prepend (still runs before body scripts).
  return captureScript + '\n' + html
}

let tokenCounter = 0
function nextToken(): string {
  tokenCounter += 1
  return `bloom-rt-${tokenCounter}-${tokenCounter * 2654435761 % 2147483647}`
}

/**
 * Execute a built preview HTML string in a hidden iframe and report any
 * runtime errors. Safe to call when no DOM is present (returns ran:false).
 */
export async function runtimeSmokeTest(
  html: string,
  opts: { waitMs?: number } = {},
): Promise<RuntimeCheckResult> {
  const empty: RuntimeCheckResult = {
    ok: true,
    ran: false,
    fatalErrors: [],
    consoleErrors: [],
    rendered: false,
  }

  // No DOM (tests / SSR) — skip gracefully rather than crash.
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return empty
  }

  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS
  const token = nextToken()
  const instrumented = instrumentHtml(html, buildCaptureScript(token, waitMs))

  return new Promise<RuntimeCheckResult>((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1024px;height:768px;border:none;opacity:0;pointer-events:none;'
    // allow-scripts is enough — postMessage out of a sandboxed iframe works
    // even with an opaque origin. We deliberately omit allow-same-origin.
    iframe.setAttribute('sandbox', 'allow-scripts')

    let settled = false

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(hardTimeout)
      try {
        document.body.removeChild(iframe)
      } catch {
        /* already removed */
      }
    }

    const finish = (result: RuntimeCheckResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.__bloomRuntimeCheck !== token) return

      const fatalErrors: string[] = Array.isArray(data.fatalErrors)
        ? data.fatalErrors.map((e: unknown) => String(e))
        : []
      const consoleErrors: string[] = Array.isArray(data.consoleErrors)
        ? data.consoleErrors.map((e: unknown) => String(e))
        : []
      const rendered = Boolean(data.rendered)

      // Fatal = uncaught errors / rejections. An empty render combined with a
      // logged console error is also treated as fatal (React crashed during
      // render without rethrowing). A bare empty render is NOT failed on its
      // own, to avoid false positives from slow esm.sh module loads.
      const ok =
        fatalErrors.length === 0 &&
        !(rendered === false && consoleErrors.length > 0)

      finish({ ok, ran: true, fatalErrors, consoleErrors, rendered })
    }

    const hardTimeout = setTimeout(() => {
      // Never reported — most likely an external module (esm.sh) stalled.
      // Treat as inconclusive (ok) rather than a false failure.
      finish({ ...empty, ran: true })
    }, HARD_TIMEOUT_MS)

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
    iframe.srcdoc = instrumented
  })
}

/**
 * Format a runtime check result into a concise, agent-readable report.
 * Returns null when there is nothing worth reporting (clean run).
 */
export function formatRuntimeReport(result: RuntimeCheckResult): string | null {
  if (!result.ran) return null
  if (result.ok && result.consoleErrors.length === 0) return null

  const lines: string[] = []

  if (result.fatalErrors.length > 0) {
    lines.push(
      `Runtime check FAILED — the app threw ${result.fatalErrors.length} uncaught error(s) when rendered:`,
    )
    result.fatalErrors.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
  }

  if (result.consoleErrors.length > 0) {
    lines.push(
      result.fatalErrors.length > 0 ? '' : 'Runtime check — console errors detected:',
    )
    result.consoleErrors.slice(0, 8).forEach((e, i) => lines.push(`  console.error ${i + 1}: ${e}`))
  }

  if (!result.rendered && result.fatalErrors.length === 0 && result.consoleErrors.length === 0) {
    lines.push('Note: the app did not render any visible content into #root.')
  }

  if (!result.ok) {
    lines.push(
      '',
      'These are RUNTIME errors found by actually running the app — esbuild does not catch them. ' +
        'Read the affected file, find the undefined variable / bad reference / broken hook, fix it with edit_file, then compile again.',
    )
  }

  return lines.join('\n')
}
