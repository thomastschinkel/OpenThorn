import { describe, it, expect } from 'vitest'
import { buildTranspiledPreview, resolveCdnImports } from '../transpiler'
import type { WorkspaceFile } from '../workspace'

const sampleFiles: WorkspaceFile[] = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Test App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    lastModified: 1,
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'test',
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
      devDependencies: {},
    }),
    lastModified: 1,
  },
  {
    path: 'src/main.tsx',
    content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
    lastModified: 1,
  },
  {
    path: 'src/App.tsx',
    content: `export default function App() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Hello Test</h1>
    </div>
  )
}`,
    lastModified: 1,
  },
  {
    path: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body { margin: 0; }`,
    lastModified: 1,
  },
]

describe('resolveCdnImports', () => {
  it('builds import map from package.json dependencies', () => {
    const map = resolveCdnImports(sampleFiles)
    expect(map.get('react')).toContain('esm.sh/react@19')
    expect(map.get('react-dom')).toContain('esm.sh/react-dom@19')
  })

  it('returns empty map when no package.json', () => {
    const map = resolveCdnImports([])
    expect(map.size).toBe(0)
  })
})

describe('buildTranspiledPreview', () => {
  it('returns a non-empty string', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  it('contains the page title', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('Test App')
  })

  it('contains the root div', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('id="root"')
  })

  it('includes Tailwind CDN script', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('cdn.tailwindcss.com')
  })

  it('includes React UMD script from unpkg', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('unpkg.com/react@')
    expect(result).toContain('umd/react.production.min.js')
  })

  it('includes ReactDOM UMD script from unpkg', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('unpkg.com/react-dom@')
    expect(result).toContain('umd/react-dom.production.min.js')
  })

  it('includes transpiled JSX as React.createElement calls', () => {
    const result = buildTranspiledPreview(sampleFiles)
    // Babel transpiles JSX to React.createElement calls
    expect(result).toContain('React.createElement')
    expect(result).toContain('Hello Test')
  })

  it('strips @tailwind directives from CSS', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).not.toContain('@tailwind')
  })

  it('preserves non-tailwind CSS rules', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('body { margin: 0; }')
  })

  it('returns a default App when no entry file found', () => {
    const noEntry = sampleFiles.filter(f => f.path !== 'src/main.tsx')
    const result = buildTranspiledPreview(noEntry)
    expect(result).toContain('React.createElement')
  })

  it('handles empty workspace gracefully', () => {
    const result = buildTranspiledPreview([])
    expect(result).toContain('Hello Bloom')
  })

  it('includes the mount call ReactDOM.createRoot', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('ReactDOM.createRoot')
  })
})
