import html2canvas from 'html2canvas'

const CAPTURE_WIDTH = 1280
const CAPTURE_HEIGHT = 800

export interface CapturedView {
  /** Logical label, e.g. "desktop" / "mobile". */
  label: string
  /** Viewport width used. */
  width: number
  /** Base64 PNG WITHOUT the data: prefix — ready for vision message blocks. */
  base64: string
  /** The media type, always image/png here. */
  mediaType: 'image/png'
}

/**
 * Render `html` in a hidden same-origin iframe at a given viewport and return a
 * base64 PNG (no data: prefix). Returns null on any failure or outside a DOM.
 * This is what feeds the visual-review (vision) loop — the agent's "eyes".
 */
export async function capturePreviewImage(
  html: string,
  opts: { width?: number; height?: number; scale?: number; settleMs?: number } = {},
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null

  const width = opts.width ?? CAPTURE_WIDTH
  const height = opts.height ?? CAPTURE_HEIGHT
  const scale = opts.scale ?? 0.5
  const settleMs = opts.settleMs ?? 2500

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${width}px;height:${height}px;border:none;opacity:0;pointer-events:none;`
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    document.body.appendChild(iframe)

    const cleanup = () => {
      try { document.body.removeChild(iframe) } catch { /* already gone */ }
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 22000)

    iframe.onload = async () => {
      await new Promise((r) => setTimeout(r, settleMs))
      try {
        const doc = iframe.contentDocument
        if (!doc) throw new Error('no contentDocument')
        const canvas = await html2canvas(doc.documentElement, {
          width,
          height,
          scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: width,
          windowHeight: height,
        })
        clearTimeout(timeout)
        const dataUrl = canvas.toDataURL('image/png')
        cleanup()
        resolve(dataUrl.split(',')[1] ?? null)
      } catch (err) {
        console.warn('capturePreviewImage failed:', err)
        clearTimeout(timeout)
        cleanup()
        resolve(null)
      }
    }

    iframe.srcdoc = html
  })
}

/**
 * Capture the app at desktop + mobile viewports for responsive visual review.
 * Skips silently (empty array) outside a DOM or on capture failure.
 */
export async function captureResponsiveViews(html: string): Promise<CapturedView[]> {
  const targets: { label: string; width: number; height: number }[] = [
    { label: 'desktop', width: 1280, height: 800 },
    { label: 'mobile', width: 390, height: 780 },
  ]
  const views: CapturedView[] = []
  for (const t of targets) {
    const base64 = await capturePreviewImage(html, { width: t.width, height: t.height })
    if (base64) {
      views.push({ label: t.label, width: t.width, base64, mediaType: 'image/png' })
    }
  }
  return views
}

export async function capturePreviewThumbnail(html: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;border:none;opacity:0;pointer-events:none;`
    // allow-same-origin lets us read iframe.contentDocument for html2canvas
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    document.body.appendChild(iframe)

    const cleanup = () => {
      try { document.body.removeChild(iframe) } catch { /* already removed */ }
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 20000)

    iframe.onload = async () => {
      // Give React time to mount and render components
      await new Promise((r) => setTimeout(r, 2500))

      try {
        const canvas = await html2canvas(iframe.contentDocument!.documentElement, {
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
          scale: 0.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: CAPTURE_WIDTH,
          windowHeight: CAPTURE_HEIGHT,
        })
        clearTimeout(timeout)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob)
          },
          'image/png',
        )
      } catch (err) {
        console.warn('Preview screenshot failed:', err)
        clearTimeout(timeout)
        cleanup()
        resolve(null)
      }
    }

    iframe.srcdoc = html
  })
}
