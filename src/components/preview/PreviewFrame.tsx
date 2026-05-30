import { useState, useEffect, useRef, useCallback } from 'react'
import type { Device } from './PreviewPanel'
import { getWorkspace, subscribeToWorkspace } from '../../lib/workspace'
import styles from './PreviewFrame.module.css'

const deviceWidths: Record<Device, string> = {
  phone: '375px',
  tablet: '768px',
  pc: '100%',
}

interface Props {
  device: Device
}

/**
 * Build a preview HTML page from workspace files.
 * Renders index.html directly — the AI is instructed to create a working,
 * self-contained HTML file with CDN imports for dependencies.
 */
function buildPreviewSrcDoc(): string {
  const { files } = getWorkspace()

  const scaffoldPaths = [
    'index.html',
    'package.json',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'src/index.css',
    'src/main.jsx',
    'src/App.jsx',
  ]

  // Check if any scaffold file was modified or new files were created
  const hasChanges =
    files.length !== scaffoldPaths.length ||
    files.some((f) => !scaffoldPaths.includes(f.path))

  // Before any user work — blank screen
  if (!hasChanges) {
    return blankDoc()
  }

  // User has built something — render index.html
  const indexHtml = files.find((f) => f.path === 'index.html')
  if (!indexHtml) {
    return blankDoc()
  }

  // Render index.html as-is. The AI is instructed to put everything
  // (CDN scripts, Babel-transpiled JSX) in a single self-contained file.
  // Inject any CSS files not already referenced in the HTML.
  let doc = indexHtml.content
  for (const f of files) {
    if (f.path.endsWith('.css') && !doc.includes(f.path)) {
      doc = doc.replace('</head>', `  <style>/* ${f.path} */\n${f.content}\n</style>\n</head>`)
    }
  }
  return doc
}

function blankDoc(): string {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;margin:0}</style></head><body></body></html>'
}

export default function PreviewFrame({ device }: Props) {
  const [blobUrl, setBlobUrl] = useState('')
  const blobUrlRef = useRef('')

  // Build preview HTML as a blob URL for origin isolation
  const updatePreview = useCallback(() => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const html = buildPreviewSrcDoc()
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url
    setBlobUrl(url)
  }, [])

  // Initial render
  useEffect(() => {
    updatePreview()
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [updatePreview])

  // Subscribe to workspace changes
  useEffect(() => {
    return subscribeToWorkspace(() => updatePreview())
  }, [updatePreview])

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
              <span className={styles.url}>http://localhost:5173</span>
            </div>
          </div>
        )}
        <div className={styles.content}>
          <iframe
            src={blobUrl || 'about:blank'}
            className={styles.iframe}
            title="Website preview"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
