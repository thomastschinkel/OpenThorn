import { useState, useEffect, useCallback, useRef } from 'react'
import type { Device } from './PreviewPanel'
import { getWorkspace, subscribeToWorkspace } from '../../lib/workspace'
import {
  boot,
  ensureRunning,
  subscribeWcState,
  getWcState,
  type WcState,
  type WcPhase,
} from '../../lib/webcontainer'
import styles from './PreviewFrame.module.css'

const deviceWidths: Record<Device, string> = {
  phone: '375px',
  tablet: '768px',
  pc: '100%',
}

interface Props {
  device: Device
}

/* ── Instant srcdoc (shown while WebContainer boots) ─ */

const PROGRESS_STEPS = [
  { key: 'booting' as const, label: 'Booting container' },
  { key: 'installing' as const, label: 'Installing dependencies' },
  { key: 'starting' as const, label: 'Starting dev server' },
]

function buildPlaceholderSrcDoc(title: string, phase: WcPhase): string {
  const activeStep = (() => {
    switch (phase) {
      case 'idle':
      case 'booting':
        return 0
      case 'ready':
      case 'installing':
        return 1
      case 'starting':
        return 2
      default:
        return 0
    }
  })()

  const steps = PROGRESS_STEPS.map((s, i) => {
    const done = i < activeStep
    const active = i === activeStep
    const color = done ? '#22c55e' : active ? '#4f8fff' : '#3d3d4a'
    const weight = active ? '600' : '400'
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${color};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.35s ease">
        ${done ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"><polyline points="4 12 9 17 20 6"/></svg>' : active ? '<div style="width:6px;height:6px;border-radius:50%;background:#4f8fff"></div>' : ''}
      </div>
      <span style="font-size:13px;color:${done ? '#a1a1aa' : active ? '#e8e8ed' : '#52525b'};font-weight:${weight};transition:all 0.35s ease">${s.label}</span>
    </div>`
  }).join('')

  const barPercent = Math.round((activeStep / (PROGRESS_STEPS.length - 1)) * 100)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #09090b; }
  body { display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; }
  .card { width: 300px; padding: 28px 24px; }
  .title { font-size: 14px; font-weight: 600; color: #e8e8ed; margin-bottom: 18px; }
  .bar-track { width: 100%; height: 3px; background: #1e1e2e; border-radius: 2px; margin-bottom: 18px; overflow: hidden; }
  .bar-fill { height: 100%; width: ${barPercent}%; background: #4f8fff; border-radius: 2px; transition: width 0.6s ease; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">Spinning up preview</div>
    <div class="bar-track"><div class="bar-fill"></div></div>
    ${steps}
  </div>
</body>
</html>`
}

function buildErrorSrcDoc(message: string): string {
  const safe = message
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 800)

  const isCrash = message.includes('crashed') || message.includes('connect to port')
  const hint = isCrash
    ? '<p style="font-size:12px;color:#a1a1aa;margin-top:16px;max-width:380px">This usually happens when new npm packages were added but not yet installed. Try sending another message to trigger a re-install, or reload the page.</p>'
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Error</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0c0a09; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; color: #fca5a5; padding: 32px; text-align: center; }
  h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #f87171; }
  pre { font-size: 11px; line-height: 1.5; color: #fca5a5; max-width: 440px;
    white-space: pre-wrap; word-break: break-all; opacity: 0.8; }
</style>
</head>
<body>
  <h2>Preview failed</h2>
  <pre>${safe}</pre>
  ${hint}
</body>
</html>`
}

/* ── Component ────────────────────────────────────── */

export default function PreviewFrame({ device }: Props) {
  const [wcState, setWcState] = useState<WcState>(getWcState)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bootedRef = useRef(false)
  const prevUrlRef = useRef<string | null>(null)

  // Subscribe to WebContainer state
  useEffect(() => {
    return subscribeWcState(setWcState)
  }, [])

  // Boot WebContainer once on mount
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    boot().catch(() => {
      // error handled via wcState subscription
    })
  }, [])

  // Sync workspace → WebContainer: write files via ensureRunning.
  // Vite HMR handles updating the iframe content — no force-reload needed.
  const syncWorkspace = useCallback(async () => {
    const { files } = getWorkspace()
    const wcFiles = files.map((f) => ({ path: f.path, content: f.content }))
    try {
      await ensureRunning(wcFiles)
      // If URL changed (re-launch from pkg change), React handles the
      // iframe transition via the key change in the render below.
    } catch {
      // error handled via wcState subscription
    }
  }, [])

  // Watch workspace for changes
  useEffect(() => {
    return subscribeToWorkspace(() => {
      syncWorkspace()
    })
  }, [syncWorkspace])

  // Kick off first sync after boot
  useEffect(() => {
    if (wcState.phase === 'ready') {
      syncWorkspace()
    }
  }, [wcState.phase, syncWorkspace])

  /* ── Derive iframe props from state ─────────────── */

  const title =
    getWorkspace().files.find((f) => f.path === 'index.html')?.content.match(
      /<title>([^<]+)<\/title>/
    )?.[1] ?? 'Bloom'

  const isRunning = wcState.phase === 'running' && wcState.url
  const urlChanged = isRunning && wcState.url !== prevUrlRef.current
  if (urlChanged && wcState.url) {
    prevUrlRef.current = wcState.url
  }

  // When running: use src (no srcDoc). When not running: use srcDoc (no src).
  // Never set both simultaneously — browser prioritizes srcDoc over src.
  const iframeSrc = isRunning ? wcState.url! : undefined
  const iframeSrcDoc =
    wcState.phase === 'error'
      ? buildErrorSrcDoc(wcState.error ?? 'Unknown error')
      : !isRunning
        ? buildPlaceholderSrcDoc(title, wcState.phase)
        : undefined

  // Only change the iframe key when the URL changes (new dev server).
  // Normal file edits go through Vite HMR — the iframe stays alive.
  const iframeKey = isRunning ? wcState.url! : 'placeholder'

  /* ── Render ─────────────────────────────────────── */

  return (
    <div className={`${styles.wrapper} ${device !== 'pc' ? styles.framed : ''}`}>
      <div className={styles.container} style={{ width: deviceWidths[device] }}>
        {device !== 'pc' && (
          <div className={styles.frame}>
            {device === 'phone' && <div className={styles.notch} />}
            <div className={styles.urlBar}>
              <div className={styles.dots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
              <span className={styles.url}>
                {wcState.url ? new URL(wcState.url).hostname : 'localhost'}
              </span>
            </div>
          </div>
        )}
        <div className={styles.content}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={iframeSrc}
            srcDoc={iframeSrcDoc}
            className={styles.iframe}
            title="Website preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>
    </div>
  )
}
