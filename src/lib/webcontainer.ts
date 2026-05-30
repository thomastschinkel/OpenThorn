/**
 * WebContainer lifecycle manager.
 * Boots a WASM-based Node.js environment in the browser, mounts the
 * workspace files, runs `npm install && npm run dev`, and exposes the
 * Vite dev server URL so the preview <iframe> can load it.
 *
 * Optimizations:
 *   - Eager boot: WebContainer.boot() starts at module import time,
 *     overlapping WASM download with React rendering.
 *   - npm cache warming: package.json hash is stored so subsequent
 *     page loads can skip the full install wait (browser Cache API
 *     serves cached packages).
 *   - Concurrent launch guard: ensurePromise serializes so only one
 *     install+start pipeline runs at a time.
 */

import { WebContainer } from '@webcontainer/api'

/* ── Types ─────────────────────────────────────────── */

export interface WcFile {
  path: string
  content: string
}

export type WcPhase =
  | 'idle'
  | 'booting'
  | 'ready'        // booted, no dev server yet
  | 'installing'   // npm install in progress
  | 'starting'     // npm run dev starting
  | 'running'      // dev server is serving
  | 'error'

export interface WcState {
  phase: WcPhase
  url: string | null
  error: string | null
  installOutput: string
  serverOutput: string
}

/* ── Singleton ─────────────────────────────────────── */

let wc: WebContainer | null = null
let bootPromise: Promise<WebContainer> | null = null
let ensurePromise: Promise<string> | null = null
let bootAttempted = false
// Track package.json content that was last installed — when it changes,
// we must re-run npm install + restart the dev server.
let lastInstalledPkgHash = ''
let currentState: WcState = { phase: 'idle', url: null, error: null, installOutput: '', serverOutput: '' }

const listeners = new Set<(state: WcState) => void>()

function emit(state: WcState) {
  currentState = state
  listeners.forEach((fn) => fn(state))
}

/* ── npm cache key ─────────────────────────────────── */

const CACHE_KEY = 'bloom_wc_pkg_hash'

function pkgHash(files: WcFile[]): string {
  const pkg = files.find((f) => f.path === 'package.json')
  // Simple fast hash of package.json content
  return pkg ? String(pkg.content.length) + '_' + pkg.content.slice(-80) : ''
}

function cacheHit(files: WcFile[]): boolean {
  try {
    return localStorage.getItem(CACHE_KEY) === pkgHash(files)
  } catch {
    return false
  }
}

function cacheStore(files: WcFile[]) {
  try {
    localStorage.setItem(CACHE_KEY, pkgHash(files))
  } catch {
    // ignore
  }
}

/* ── Eager boot (module-level side effect) ─────────── */

// Start downloading WebContainer WASM binary immediately —
// overlaps with React rendering for 2-5 s of saved wait time.
emit({ ...currentState, phase: 'booting' })
bootAttempted = true

bootPromise = WebContainer.boot()
  .then((instance) => {
    wc = instance
    emit({ ...currentState, phase: 'ready' })
    return instance
  })
  .catch((err) => {
    const message = err?.message ?? String(err)
    const hint = message.includes('SharedArrayBuffer')
      ? 'Missing COOP/COEP headers. Ensure the Vite dev server sends Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers.'
      : ''
    emit({
      ...currentState,
      phase: 'error',
      error: hint ? `${message}\n\n${hint}` : message,
    })
    // Never null bootPromise — prevents duplicate WebContainer.boot() calls
    throw err // Re-throw so the promise stays rejected
  })

/* ── Public API ────────────────────────────────────── */

export function getWcState(): WcState {
  return currentState
}

export function subscribeWcState(fn: (state: WcState) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Await the eager boot. Safe to call multiple times — returns the
 * existing instance or boot promise. Will never attempt a second
 * WebContainer.boot() call.
 */
export async function boot(): Promise<WebContainer> {
  if (wc) return wc
  if (bootPromise) return bootPromise

  // If boot was already attempted (even if it failed), don't retry.
  // WebContainer.boot() can only be called once per page lifetime.
  if (bootAttempted) {
    // Wait a tick in case the eager boot is about to resolve
    await new Promise((r) => setTimeout(r, 100))
    if (wc) return wc
    if (bootPromise) return bootPromise
    throw new Error(currentState.error ?? 'WebContainer failed to boot')
  }

  // Fallback — only reached if module-level eager boot didn't trigger
  bootAttempted = true
  emit({ ...currentState, phase: 'booting' })
  bootPromise = WebContainer.boot()
    .then((instance) => {
      wc = instance
      emit({ ...currentState, phase: 'ready' })
      return instance
    })
    .catch((err) => {
      const message = err?.message ?? String(err)
      emit({ ...currentState, phase: 'error', error: message })
      throw err
    })
  return bootPromise
}

/**
 * Write all project files into the WebContainer virtual FS.
 */
/**
 * Reject paths with '..' segments or absolute paths.
 * The workspace layer already validates paths before they reach here,
 * but defense-in-depth means we check again at the FS boundary.
 */
function sanitizePath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/')
  if (segments.includes('..')) {
    throw new Error(`Path traversal blocked: "${path}" contains '..' segments`)
  }
  if (path.startsWith('/')) {
    throw new Error(`Absolute paths are not allowed: "${path}"`)
  }
  return path
}

export async function mountProject(files: WcFile[]): Promise<void> {
  const instance = wc ?? (await boot())

  const tree: Record<string, { file?: { contents: string }; directory?: Record<string, unknown> }> = {}

  for (const f of files) {
    const safePath = sanitizePath(f.path)
    const parts = safePath.split('/')
    let current = tree
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1
      const seg = parts[i]
      if (isFile) {
        current[seg] = { file: { contents: f.content } }
      } else {
        if (!current[seg]) current[seg] = { directory: {} }
        current = (current[seg].directory ?? {}) as Record<string, { file?: { contents: string }; directory?: Record<string, unknown> }>
      }
    }
  }

  await instance.mount(tree)
}

/**
 * Install npm dependencies and start the Vite dev server.
 * Emits 'server-ready' URL through state updates.
 */
export async function startDevServer(): Promise<string> {
  const instance = wc
  if (!instance) throw new Error('WebContainer not booted — call boot() first')

  // ── npm install ──
  emit({ ...currentState, phase: 'installing', installOutput: '' })

  const installProc = await instance.spawn('npm', ['install'], {
    env: { NODE_ENV: 'development' },
  })

  installProc.output.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        currentState = { ...currentState, installOutput: currentState.installOutput + chunk }
      },
    })
  )

  const installExit = await installProc.exit
  if (installExit !== 0) {
    emit({
      ...currentState,
      phase: 'error',
      error: `npm install exited with code ${installExit}.\n\n${currentState.installOutput.slice(-800)}`,
    })
    throw new Error(`npm install failed (exit ${installExit})`)
  }

  // Verify node_modules is actually on disk — exit event can fire before
  // the virtual FS finishes flushing. Poll for tsc (or any key binary).
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await instance.fs.readFile('node_modules/.bin/tsc', 'utf8')
      break // tsc exists — install is truly done
    } catch {
      if (attempt === 19) {
        throw new Error('npm install completed but node_modules/.bin/tsc was not found after 10s')
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // ── npm run dev ──
  emit({ ...currentState, phase: 'starting', serverOutput: '' })

  const devProc = await instance.spawn('npm', ['run', 'dev'], {
    env: { NODE_ENV: 'development' },
  })

  devProc.output.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        currentState = { ...currentState, serverOutput: currentState.serverOutput + chunk }
      },
    })
  )

  // ── Wait for server-ready ──
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      emit({
        ...currentState,
        phase: 'error',
        error: `Dev server timed out after 30s.\n\n${currentState.serverOutput.slice(-800)}`,
      })
      reject(new Error('Dev server timed out'))
    }, 30_000)

    instance.on('server-ready', (_port: number, url: string) => {
      clearTimeout(timeout)
      const crashCount = { value: 0 }
      emit({ ...currentState, phase: 'running', url, error: null })

      // Monitor the dev server process — if it exits unexpectedly, auto-recover.
      // Only show an error after 2 consecutive crashes.
      const monitorCrash = (proc: typeof devProc) => {
        proc.exit.then((exitCode) => {
          if (exitCode === 0 || currentState.phase !== 'running') return
          crashCount.value++
          if (crashCount.value < 2) {
            // Auto-restart silently — don't show error, just restart the server
            instance.spawn('npm', ['run', 'dev'], {
              env: { NODE_ENV: 'development' },
            }).then((newProc) => {
              newProc.output.pipeTo(new WritableStream<string>({
                write(chunk) {
                  currentState = { ...currentState, serverOutput: currentState.serverOutput + chunk }
                },
              }))
              monitorCrash(newProc)
            }).catch(() => {
              emit({
                ...currentState,
                phase: 'error',
                error: `Dev server crashed and restart failed.\n\nLast output:\n${currentState.serverOutput.slice(-600)}`,
                url: null,
              })
            })
          } else {
            emit({
              ...currentState,
              phase: 'error',
              error: `Dev server crashed ${crashCount.value} times.\n\nLast output:\n${currentState.serverOutput.slice(-600)}`,
              url: null,
            })
          }
        })
      }
      monitorCrash(devProc)

      resolve(url)
    })

    instance.on('error', (err: { message: string }) => {
      clearTimeout(timeout)
      emit({
        ...currentState,
        phase: 'error',
        error: `WebContainer error: ${err.message}`,
      })
      reject(new Error(err.message))
    })
  })
}

/**
 * Write a single file to the virtual FS. Triggers Vite HMR automatically
 * if the dev server is already running.
 */
export async function updateFile(path: string, content: string): Promise<void> {
  const instance = wc
  if (!instance) throw new Error('WebContainer not booted — call boot() first')

  const safe = sanitizePath(path)
  const parts = safe.split('/')
  let dirPath = ''
  for (let i = 0; i < parts.length - 1; i++) {
    dirPath += (dirPath ? '/' : '') + parts[i]
    try {
      await instance.fs.mkdir(dirPath, { recursive: true })
    } catch {
      // ignore — directory already exists
    }
  }

  await instance.fs.writeFile(safe, content)
}

/**
 * Full lifecycle: mount + install + start. Returns the dev server URL.
 * Safe to call on every workspace change — reuses a running server or
 * serializes concurrent calls so only one launch pipeline runs at a time.
 *
 * Detects package.json changes and triggers a full re-install+restart
 * when dependencies are added, removed, or updated.
 */
export async function ensureRunning(files: WcFile[]): Promise<string> {
  await boot()

  const currentPkgHash = pkgHash(files)

  if (currentState.phase === 'running' && currentState.url) {
    // If package.json changed since the last install, re-launch everything
    if (lastInstalledPkgHash && currentPkgHash !== lastInstalledPkgHash) {
      ensurePromise = null // reset so we create a fresh launch below
    } else {
      // Already running with correct deps — write files, Vite handles the rest
      for (const f of files) {
        await updateFile(f.path, f.content)
      }
      return currentState.url
    }
  }

  // If a launch is already in progress, wait for it to finish
  if (ensurePromise) {
    await ensurePromise
    if (currentState.phase === 'running') {
      if (lastInstalledPkgHash && currentPkgHash !== lastInstalledPkgHash) {
        ensurePromise = null // reset for re-launch below
      } else {
        for (const f of files) {
          await updateFile(f.path, f.content)
        }
        return currentState.url!
      }
    }
  }

  // ── Recovery: if phase is 'error', try quick restart first ──
  // The dev server crashed but files + node_modules are still intact.
  // Just re-spawn the dev server — no need to re-mount or re-install.
  if (currentState.phase === 'error' && lastInstalledPkgHash === currentPkgHash) {
    ensurePromise = (async () => {
      try {
        // Write any changed files, then just restart the server
        for (const f of files) {
          await updateFile(f.path, f.content)
        }
        const url = await startDevServer()
        return url
      } finally {
        ensurePromise = null
      }
    })()
    return ensurePromise
  }

  // Full launch: mount + install + start (first boot or pkg change)
  ensurePromise = (async () => {
    try {
      await mountProject(files)
      lastInstalledPkgHash = pkgHash(files)
      cacheStore(files)
      const url = await startDevServer()
      return url
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}

/**
 * Returns true if the npm cache is likely warm for these files
 * (same package.json as a previous successful install).
 */
export function isCacheWarm(files: WcFile[]): boolean {
  return cacheHit(files)
}

/**
 * Run a shell command inside the WebContainer and return stdout + stderr.
 * Used by the AI agent's run_command tool. Has a 30s timeout.
 *
 * Uses pipeTo (not getReader) for reliable stream consumption —
 * pipeTo is the tested pattern used by startDevServer above.
 */
export async function spawnCommand(
  cmd: string,
  args: string[] = []
): Promise<{ exitCode: number; output: string }> {
  const instance = wc
  if (!instance) throw new Error('WebContainer not booted — call boot() first')

  // Run through sh -c so the shell handles argument parsing, pipes, redirects.
  // Always redirect stderr to stdout (2>&1) so error output is captured.
  const shellCmd = args.length > 0
    ? [cmd, ...args].join(' ')
    : cmd
  // Wrap in sh -c with stderr→stdout redirection
  const finalCmd = `(${shellCmd}) 2>&1`

  const proc = await instance.spawn('sh', ['-c', finalCmd], {
    env: { NODE_ENV: 'development', CI: 'true', PATH: '/usr/local/bin:/usr/bin:/bin' },
  })

  // Collect output via pipeTo — the reliable WebContainer pattern
  const chunks: string[] = []
  const abort = new AbortController()

  const pipePromise = proc.output.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        chunks.push(chunk)
      },
    }),
    { signal: abort.signal }
  )

  // Wait for exit with a 30s timeout
  const exitOrTimeout = await Promise.race([
    proc.exit.then((code) => ({ timedOut: false as const, code })),
    new Promise<{ timedOut: true; code: number }>((r) =>
      setTimeout(() => r({ timedOut: true, code: -1 }), 30_000)
    ),
  ])

  if (exitOrTimeout.timedOut) {
    proc.kill()
    abort.abort()
    try { await pipePromise } catch { /* aborted */ }
    return {
      exitCode: -1,
      output: chunks.join('') + '\n[TIMEOUT: command killed after 30s]',
    }
  }

  // Process exited — give the stream a moment to flush, then abort
  await Promise.race([
    pipePromise,
    new Promise((r) => setTimeout(() => { abort.abort(); r(null) }, 500)),
  ])
  try { await pipePromise } catch { /* aborted */ }

  // Return output — head first (errors are at the start), 20KB limit
  const full = chunks.join('')
  return {
    exitCode: exitOrTimeout.code,
    output: full.length > 20_000 ? full.slice(0, 20_000) + '\n\n[...output truncated at 20KB]' : full,
  }
}

/**
 * Tear down the WebContainer instance.
 */
export function destroy() {
  wc = null
  bootPromise = null
  ensurePromise = null
  bootAttempted = false
  lastInstalledPkgHash = ''
  emit({ phase: 'idle', url: null, error: null, installOutput: '', serverOutput: '' })
}
