import { useState, useEffect } from 'react'
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

  // Check if index.html has been modified from the scaffold
  const scaffoldHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bloom Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`

  const indexHtml = files.find((f) => f.path === 'index.html')
  const hasUserFiles =
    files.filter(
      (f) =>
        ![
          'index.html',
          'package.json',
          'tsconfig.json',
          'vite.config.ts',
          'src/main.tsx',
          'src/App.tsx',
          'src/App.module.css',
          'src/styles/globals.css',
        ].includes(f.path)
    ).length > 0

  // Before any user work — blank screen
  if (!hasUserFiles && indexHtml && indexHtml.content === scaffoldHtml) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;margin:0}</style></head><body></body></html>`
  }

  // User has built something — render index.html
  if (indexHtml) {
    let doc = indexHtml.content

    // Inject CSS files into <head> if not already linked
    for (const f of files) {
      if (f.path.endsWith('.css')) {
        if (!doc.includes(f.path)) {
          doc = doc.replace('</head>', `  <style>/* ${f.path} */\n${f.content}\n</style>\n</head>`)
        }
      }
      // Replace TS module scripts with inline JS (strip types)
      if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) {
        const srcAttr = `src="/${f.path}"`
        if (doc.includes(srcAttr)) {
          const js = stripTypes(f.content)
          doc = doc.replace(
            new RegExp(`<script[^>]*src="/${f.path.replace(/\./g, '\\.')}"[^>]*></script>`, 'g'),
            `<script type="module">\n${js}\n</script>`
          )
        }
      }
    }

    return doc
  }

  // Fallback
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:system-ui,sans-serif;margin:0}</style></head><body><div style="text-align:center"><p style="font-size:18px;color:#ccc;margin-bottom:8px">Preview loading...</p><p style="font-size:13px">Click <strong>Code</strong> to view source files</p></div></body></html>`
}

/** Strip TypeScript type annotations for browser execution */
function stripTypes(code: string): string {
  let out = code
  // Remove type annotations after variable declarations
  out = out.replace(/:\s*[\w<>[\],\s|&{}]+(\s*=\s*)/g, '$1')
  // Remove interface/type declarations
  out = out.replace(/^(export\s+)?(interface|type)\s+\w+[\s\S]*?\{[\s\S]*?\}/gm, '')
  out = out.replace(/^(export\s+)?(interface|type)\s+\w+[\s\S]*?=\s*[\w|&'"[\]]+;/gm, '')
  // Remove return type annotations on functions
  out = out.replace(/(\))\s*:\s*[\w<>[\],\s|&{}]+(\s*\{)/g, '$1$2')
  // Remove generic type parameters
  out = out.replace(/<[\w\s,]+>(?=\s*\()/g, '')
  // Remove import type
  out = out.replace(/import\s+type\s+.*?from\s+['"][^'"]+['"]\s*;?/g, '')
  // Remove satisfies operator
  out = out.replace(/\s+satisfies\s+[\w<>[\],\s|&{}]+/g, '')
  // Remove as const
  out = out.replace(/\s+as\s+const/g, '')
  return out
}

export default function PreviewFrame({ device }: Props) {
  const [srcDoc, setSrcDoc] = useState(buildPreviewSrcDoc)

  useEffect(() => {
    return subscribeToWorkspace(() => {
      setSrcDoc(buildPreviewSrcDoc())
    })
  }, [])

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
            srcDoc={srcDoc}
            className={styles.iframe}
            title="Website preview"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
