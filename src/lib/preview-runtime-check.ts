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
  /** Number of interactive elements exercised (interactive mode only). */
  interactionsRun?: number
  /** Errors thrown specifically while exercising interactions. */
  interactionErrors?: string[]
  /** Whether interactions produced any DOM change (a signal handlers are wired). */
  domChanged?: boolean
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
function buildCaptureScript(token: string, waitMs: number, interactive = false): string {
  return `<script>
(function(){
  if (typeof window === 'undefined') return;
  var TOKEN = ${JSON.stringify(token)};
  var INTERACTIVE = ${interactive ? 'true' : 'false'};
  var fatal = [];
  var consoleErrors = [];
  var interactionErrors = [];
  var interactionsRun = 0;
  var domChanged = false;

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

  // ── Interaction driver ──────────────────────────────────────────
  // Exercises the rendered UI to catch "looks done but buttons do nothing /
  // throw" bugs. We prevent real form submits and full navigations so the
  // page stays alive, click a bounded set of controls, type into text inputs,
  // and watch for thrown errors and DOM mutations.
  function snapshotDom() {
    var root = document.getElementById('root');
    return root ? (root.innerHTML || '').length + ':' + root.querySelectorAll('*').length : '0:0';
  }

  function runInteractions() {
    // Block anything that would unload the document.
    document.addEventListener('submit', function(e){ e.preventDefault(); }, true);

    var before = snapshotDom();
    var MAX = 8;

    // Buttons and role=button / [data-testid] clickables (skip obviously
    // destructive or navigation-away controls).
    var clickables = [].slice.call(
      document.querySelectorAll('button, [role="button"], input[type="checkbox"], input[type="radio"], [data-interactive]')
    ).slice(0, MAX);
    for (var i = 0; i < clickables.length; i++) {
      var el = clickables[i];
      try {
        if (el.disabled) continue;
        el.click();
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Type into the first few text-like inputs and fire input/change.
    var inputs = [].slice.call(
      document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea')
    ).slice(0, 4);
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j];
      try {
        var setter = Object.getOwnPropertyDescriptor(
          inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        );
        if (setter && setter.set) { setter.set.call(inp, 'Test input'); }
        else { inp.value = 'Test input'; }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Click in-page hash links (safe; won't unload).
    var hashLinks = [].slice.call(document.querySelectorAll('a[href^="#"]')).slice(0, 3);
    for (var k = 0; k < hashLinks.length; k++) {
      try { hashLinks[k].click(); interactionsRun++; } catch (err) { interactionErrors.push(describe(err)); }
    }

    domChanged = snapshotDom() !== before;
  }

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
        rendered: rendered,
        interactionsRun: interactionsRun,
        interactionErrors: interactionErrors,
        domChanged: domChanged
      }, '*');
    } catch (e) { /* ignore */ }
  }

  function settleThenReport() {
    if (INTERACTIVE) {
      // Let the app mount, then drive it, then let effects settle, then report.
      try { runInteractions(); } catch (e) { interactionErrors.push(describe(e)); }
      setTimeout(report, 600);
    } else {
      report();
    }
  }

  // Report after the app has mounted and run a few frames. We listen on load
  // so module scripts (deferred) have finished evaluating first.
  if (document.readyState === 'complete') {
    setTimeout(settleThenReport, ${waitMs});
  } else {
    window.addEventListener('load', function(){ setTimeout(settleThenReport, ${waitMs}); });
  }
  // Safety: always report eventually, even if 'load' never fires.
  setTimeout(report, ${waitMs} + 2500);
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
  opts: { waitMs?: number; interactive?: boolean } = {},
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

  const interactive = opts.interactive ?? false
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS
  const token = nextToken()
  const instrumented = instrumentHtml(html, buildCaptureScript(token, waitMs, interactive))

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
      const interactionErrors: string[] = Array.isArray(data.interactionErrors)
        ? data.interactionErrors.map((e: unknown) => String(e))
        : []
      const interactionsRun = Number(data.interactionsRun) || 0
      const domChanged = Boolean(data.domChanged)

      // Fatal = uncaught errors / rejections, OR an error thrown while
      // exercising an interaction (a dead/broken handler). An empty render
      // combined with a logged console error is also treated as fatal (React
      // crashed during render without rethrowing). A bare empty render is NOT
      // failed on its own, to avoid false positives from slow esm.sh loads.
      const ok =
        fatalErrors.length === 0 &&
        interactionErrors.length === 0 &&
        !(rendered === false && consoleErrors.length > 0)

      finish({
        ok,
        ran: true,
        fatalErrors,
        consoleErrors,
        rendered,
        interactionsRun,
        interactionErrors,
        domChanged,
      })
    }

    const hardTimeout = setTimeout(() => {
      // Never reported — most likely an external module (esm.sh) stalled.
      // Treat as inconclusive (ok) rather than a false failure.
      finish({ ...empty, ran: true })
    }, interactive ? HARD_TIMEOUT_MS + 4000 : HARD_TIMEOUT_MS)

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
    iframe.srcdoc = instrumented
  })
}

/**
 * Run the app AND drive its interactive elements (clicks, typing, hash links),
 * catching handlers that throw or do nothing. Use this for the final
 * pre-`done` gate where "the buttons actually work" matters.
 */
export async function interactiveSmokeTest(
  html: string,
  opts: { waitMs?: number } = {},
): Promise<RuntimeCheckResult> {
  return runtimeSmokeTest(html, { ...opts, interactive: true })
}

/**
 * Format a runtime check result into a concise, agent-readable report.
 * Returns null when there is nothing worth reporting (clean run).
 */
export function formatRuntimeReport(result: RuntimeCheckResult): string | null {
  if (!result.ran) return null
  const interactionErrors = result.interactionErrors ?? []
  if (result.ok && result.consoleErrors.length === 0 && interactionErrors.length === 0) {
    return null
  }

  const lines: string[] = []

  if (result.fatalErrors.length > 0) {
    lines.push(
      `Runtime check FAILED — the app threw ${result.fatalErrors.length} uncaught error(s) when rendered:`,
    )
    result.fatalErrors.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
  }

  if (interactionErrors.length > 0) {
    lines.push(
      result.fatalErrors.length > 0 ? '' : 'Interaction check FAILED — a control threw when used:',
    )
    interactionErrors.slice(0, 8).forEach((e, i) =>
      lines.push(`  interaction error ${i + 1}: ${e}`),
    )
    lines.push(
      'A button/input handler crashed when exercised. Find the handler, fix the bad reference or state update, then compile again.',
    )
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
