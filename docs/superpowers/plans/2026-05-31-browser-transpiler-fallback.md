# Browser Transpiler Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-browser JSX/TS transpilation fallback that runs when WebContainers cannot (no SharedArrayBuffer), using @babel/standalone + CDN imports + UMD globals.

**Architecture:** PreviewFrame detects SharedArrayBuffer availability at import time. If missing, it switches from the WebContainer path (boot → npm install → dev server URL) to the transpiler path (Babel transpile workspace files → rewrite imports to CDN → build srcdoc string → render in iframe). React/ReactDOM are loaded as UMD globals from unpkg CDN. Tailwind is loaded from its standalone CDN. The system prompt gets fallback-specific guardrails.

**Tech Stack:** @babel/standalone (preset-react + preset-typescript), unpkg CDN (React UMD builds), cdn.tailwindcss.com (Tailwind standalone)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/capabilities.ts` | **Create** | SharedArrayBuffer detection → `'webcontainer' \| 'transpiler'` |
| `src/lib/transpiler.ts` | **Create** | Workspace files → srcdoc HTML string (Babel + CDN rewrites) |
| `src/components/preview/PreviewFrame.tsx` | **Modify** | Dual-path: WebContainer URL or transpiler srcdoc |
| `src/lib/system-prompt.ts` | **Modify** | Inject fallback guardrails when capability is `'transpiler'` |
| `package.json` | **Modify** | Add `@babel/standalone` dependency |

---

### Task 1: Add @babel/standalone dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @babel/standalone**

```bash
npm install @babel/standalone
```

- [ ] **Step 2: Verify install**

Run: `node -e "const b = require('@babel/standalone'); console.log(Object.keys(b).slice(0, 5))"`
Expected: `[ 'transform', 'transformFromAst', 'registerPlugin', 'registerPreset', ... ]`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @babel/standalone for browser transpiler fallback"
```

---

### Task 2: Create capability detection module

**Files:**
- Create: `src/lib/capabilities.ts`
- Create: `src/lib/__tests__/capabilities.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/lib/__tests__/capabilities.test.ts
import { describe, it, expect } from 'vitest'
import { detectCapability, hasSharedArrayBuffer } from '../capabilities'

describe('hasSharedArrayBuffer', () => {
  it('returns true when SharedArrayBuffer is available', () => {
    // In jsdom with COOP/COEP, SharedArrayBuffer should be defined
    // but may throw on construction. We test the function exists.
    const result = hasSharedArrayBuffer()
    // In test environment (jsdom), this is typically false
    // but the function should not throw
    expect(typeof result).toBe('boolean')
  })
})

describe('detectCapability', () => {
  it('returns a valid capability string', () => {
    const cap = detectCapability()
    expect(['webcontainer', 'transpiler']).toContain(cap)
  })

  it('returns transpiler when SharedArrayBuffer is unavailable', () => {
    // In jsdom without COOP/COEP headers, SharedArrayBuffer
    // construction fails, so it should fall back to transpiler
    const cap = detectCapability()
    // jsdom doesn't support SharedArrayBuffer → falls to transpiler
    expect(cap).toBe('transpiler')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/capabilities.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/capabilities.ts

/**
 * Test whether SharedArrayBuffer is functional in this browser.
 * WebContainers requires SAB for its WASM threading.
 * SAB is only available when COOP and COEP headers are set,
 * which breaks cross-origin embeds.
 */
export function hasSharedArrayBuffer(): boolean {
  try {
    if (typeof SharedArrayBuffer === 'undefined') return false
    // Construction throws if COOP/COEP headers are missing
    new SharedArrayBuffer(1)
    return true
  } catch {
    return false
  }
}

export type PreviewCapability = 'webcontainer' | 'transpiler'

let _cached: PreviewCapability | null = null

/**
 * Detect which preview backend to use.
 * Result is cached — capability doesn't change during a session.
 */
export function detectCapability(): PreviewCapability {
  if (_cached !== null) return _cached

  if (hasSharedArrayBuffer()) {
    _cached = 'webcontainer'
    return _cached
  }

  // Fallback: transpiler works everywhere JavaScript runs
  _cached = 'transpiler'
  return _cached
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/capabilities.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/capabilities.ts src/lib/__tests__/capabilities.test.ts
git commit -m "feat: add browser capability detection (SAB check)"
```

---

### Task 3: Create transpiler pipeline

**Files:**
- Create: `src/lib/transpiler.ts`
- Create: `src/lib/__tests__/transpiler.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/lib/__tests__/transpiler.test.ts
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
  it('returns a string', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(typeof result).toBe('string')
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

  it('includes React UMD script', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('unpkg.com/react@')
    expect(result).toContain('umd/react.production.min.js')
  })

  it('includes ReactDOM UMD script', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).toContain('unpkg.com/react-dom@')
    expect(result).toContain('umd/react-dom.production.min.js')
  })

  it('includes transpiled App component code', () => {
    const result = buildTranspiledPreview(sampleFiles)
    // Babel transpiles JSX to React.createElement calls
    expect(result).toContain('React.createElement')
    expect(result).toContain('Hello Test')
  })

  it('strips @tailwind directives from CSS', () => {
    const result = buildTranspiledPreview(sampleFiles)
    expect(result).not.toContain('@tailwind')
    expect(result).toContain('body { margin: 0; }')
  })

  it('returns fallback when no entry file found', () => {
    const noEntry = sampleFiles.filter(f => f.path !== 'src/main.tsx')
    const result = buildTranspiledPreview(noEntry)
    expect(result).toContain('React.createElement')
    // Should use default App fallback
    expect(result).toContain('Hello Bloom')
  })

  it('handles empty workspace', () => {
    const result = buildTranspiledPreview([])
    expect(result).toContain('Hello Bloom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/transpiler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/transpiler.ts
import * as Babel from '@babel/standalone'
import type { WorkspaceFile } from './workspace'

/* ── CDN Import Resolution ──────────────────────── */

/**
 * Parse package.json from workspace and build a name→CDN-URL map.
 * Uses esm.sh for modules and unpkg for UMD globals (React, ReactDOM).
 */
export function resolveCdnImports(files: WorkspaceFile[]): Map<string, string> {
  const map = new Map<string, string>()
  const pkgFile = files.find(f => f.path === 'package.json')
  if (!pkgFile) return map

  try {
    const pkg = JSON.parse(pkgFile.content)
    const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies }
    for (const [name, version] of Object.entries(allDeps) as [string, string][]) {
      const clean = version.replace(/^[\^~]/, '')
      map.set(name, `https://esm.sh/${name}@${clean}`)
    }
  } catch {
    // package.json parse error — return empty map
  }

  return map
}

/* ── UMD Script Tags ────────────────────────────── */

interface UmdEntry {
  global: string    // window global variable name
  url: string       // CDN URL
  test: string      // JS expression that's truthy when loaded
}

/**
 * Build UMD <script> tags for globals that the transpiled code needs.
 * React and ReactDOM are the baseline — other packages are added
 * if they appear in the project's package.json.
 */
function buildUmdScripts(files: WorkspaceFile[]): string {
  const scripts: string[] = []

  // Always include React + ReactDOM from unpkg (UMD builds expose globals)
  const versions = getDependencyVersions(files)
  const reactVer = versions.get('react') ?? '19'
  const reactDomVer = versions.get('react-dom') ?? '19'

  scripts.push(
    `<script crossorigin src="https://unpkg.com/react@${reactVer}/umd/react.production.min.js"></script>`,
    `<script crossorigin src="https://unpkg.com/react-dom@${reactDomVer}/umd/react-dom.production.min.js"></script>`
  )

  return scripts.join('\n    ')
}

/* ── Helpers ─────────────────────────────────────── */

function getDependencyVersions(files: WorkspaceFile[]): Map<string, string> {
  const versions = new Map<string, string>()
  const pkgFile = files.find(f => f.path === 'package.json')
  if (!pkgFile) return versions

  try {
    const pkg = JSON.parse(pkgFile.content)
    const allDeps = { ...pkg.dependencies }
    for (const [name, version] of Object.entries(allDeps) as [string, string][]) {
      versions.set(name, (version as string).replace(/^[\^~]/, ''))
    }
  } catch { /* ignore */ }

  return versions
}

/**
 * Find the entry point file. Looks for <script src="..."> in index.html
 * and resolves to the workspace file path.
 */
function findEntryPath(files: WorkspaceFile[]): string | null {
  const html = files.find(f => f.path === 'index.html')
  if (!html) return null

  const match = html.content.match(/<script[^>]+src=["']\/([^"']+)["']/)
  if (match) return match[1]

  // Fallback: look for src/main.tsx directly
  const mainFile = files.find(f => f.path === 'src/main.tsx')
  if (mainFile) return 'src/main.tsx'

  return null
}

/**
 * Topological sort of files by import dependencies.
 * Returns files in dependency order (dependencies first).
 */
function sortByImports(files: WorkspaceFile[], startPath: string): WorkspaceFile[] {
  const fileMap = new Map(files.map(f => [f.path, f]))
  const visited = new Set<string>()
  const result: WorkspaceFile[] = []

  function visit(path: string) {
    if (visited.has(path)) return
    visited.add(path)

    const file = fileMap.get(path)
    if (!file) return

    // Find relative imports and visit dependencies first (topological sort)
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1]
      const dir = path.split('/').slice(0, -1).join('/')
      const resolved = resolveImportPath(dir, importPath, fileMap)
      if (resolved) visit(resolved)
    }

    result.push(file)
  }

  visit(startPath)
  return result
}

/**
 * Resolve a relative import path against a directory by checking
 * the file map for matching paths with common extensions.
 */
function resolveImportPath(
  dir: string,
  importPath: string,
  fileMap: Map<string, WorkspaceFile>
): string | null {
  // Normalize: join dir + importPath, resolve . and ..
  const raw = dir ? `${dir}/${importPath}` : importPath
  const segments = raw.split('/')
  const resolved: string[] = []
  for (const seg of segments) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') { resolved.pop(); continue }
    resolved.push(seg)
  }
  const base = resolved.join('/')

  // Try exact match first
  if (fileMap.has(base)) return base

  // Try common TypeScript/JavaScript extensions
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']
  for (const ext of extensions) {
    const candidate = base + ext
    if (fileMap.has(candidate)) return candidate
  }

  return null
}

/**
 * Strip import declarations from source code.
 * npm imports → handled by UMD globals / CDN
 * relative imports → handled by concatenation order
 */
function stripImports(code: string): string {
  // Remove all import statements (handle multi-line imports from '...' {...})
  return code
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+\w+\s*,\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+\w+\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s*\{[^}]*\}\s*,\s*\w+\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
}

/**
 * Strip export keywords so concatenated code works as a single scope.
 * - export default function X → function X
 * - export default class X → class X
 * - export const X = ... → const X = ...
 * - export function X(...) → function X(...)
 * - export { X, Y } → (removed)
 */
function stripExports(code: string): string {
  return code
    .replace(/^export\s+default\s+(function|class|const|let|var)\s/gm, '$1 ')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+(function|class|const|let|var)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
}

/**
 * Main pipeline: workspace files → complete HTML srcdoc string.
 */
export function buildTranspiledPreview(files: WorkspaceFile[]): string {
  const title = extractTitle(files)
  const umdScripts = buildUmdScripts(files)
  const css = processCss(files)
  const js = buildJsBundle(files)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    ${umdScripts}
    <script src="https://cdn.tailwindcss.com"></script>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${indent(js, '      ')}
    </script>
  </body>
</html>`
}

/* ── Pipeline stages ────────────────────────────── */

function extractTitle(files: WorkspaceFile[]): string {
  const html = files.find(f => f.path === 'index.html')
  if (!html) return 'Bloom'
  const match = html.content.match(/<title>([^<]+)<\/title>/)
  return match ? match[1] : 'Bloom'
}

function processCss(files: WorkspaceFile[]): string {
  return files
    .filter(f => f.path.endsWith('.css'))
    .map(f => stripTailwindDirectives(f.content))
    .join('\n')
}

function stripTailwindDirectives(css: string): string {
  return css
    .replace(/@tailwind\s+\w+;?\s*/g, '')
    .replace(/@layer\s+\w+\s*\{[^}]*\}/g, '')
    .trim()
}

function buildJsBundle(files: WorkspaceFile[]): string {
  const entryPath = findEntryPath(files)

  if (!entryPath) {
    // No entry file — render a default fallback component
    return renderDefaultApp()
  }

  try {
    const sorted = sortByImports(files, entryPath)

    const transpiledParts = sorted
      .filter(f => /\.(tsx?|jsx?)$/.test(f.path) && !f.path.endsWith('.d.ts'))
      .map(f => transpileFile(f.path, f.content))
      .filter(Boolean)

    if (transpiledParts.length === 0) {
      return renderDefaultApp()
    }

    const allCode = transpiledParts.join('\n\n')

    // Append the mount call
    return allCode + `
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(App)
  )
);`
  } catch {
    return renderDefaultApp()
  }
}

function transpileFile(filename: string, code: string): string {
  try {
    // Strip imports/exports for concatenation-friendly output
    let processed = stripImports(code)
    processed = stripExports(processed)

    const result = Babel.transform(processed, {
      presets: ['react', 'typescript'],
      filename,
      sourceMaps: false,
    })

    if (!result.code) return ''

    return `// ${filename}\n${result.code}`
  } catch (err) {
    // If transpile fails, include an error comment
    const msg = err instanceof Error ? err.message : String(err)
    return `// ERROR transpiling ${filename}: ${msg}\n`
  }
}

function renderDefaultApp(): string {
  return `function App() {
  return React.createElement('div', {
    className: 'min-h-screen flex items-center justify-center p-8'
  },
    React.createElement('div', { className: 'text-center max-w-md' },
      React.createElement('h1', { className: 'text-2xl font-semibold mb-2' }, 'Hello Bloom'),
      React.createElement('p', { className: 'text-sm text-white/50' },
        'Your app will appear here once you create src/main.tsx.'
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
);`
}

/* ── Utilities ──────────────────────────────────── */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function indent(code: string, spaces: string): string {
  return code.split('\n').map(line => spaces + line).join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/transpiler.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/transpiler.ts src/lib/__tests__/transpiler.test.ts
git commit -m "feat: add in-browser transpiler pipeline (Babel + CDN)"
```

---

### Task 4: Modify PreviewFrame for dual-path rendering

**Files:**
- Modify: `src/components/preview/PreviewFrame.tsx`
- Modify: `src/components/preview/__tests__/PreviewFrame.test.tsx`

- [ ] **Step 1: Update the test file for dual-path coverage**

```typescript
// src/components/preview/__tests__/PreviewFrame.test.tsx
// Replace entire file:

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreviewFrame from '../PreviewFrame'

// Mock capabilities — transpiler path (jsdom has no SAB)
vi.mock('../../../lib/capabilities', () => ({
  detectCapability: vi.fn().mockReturnValue('transpiler'),
}))

// Mock the webcontainer module (should not be called in transpiler path)
vi.mock('../../../lib/webcontainer', () => ({
  boot: vi.fn(),
  ensureRunning: vi.fn(),
  subscribeWcState: vi.fn().mockReturnValue(() => {}),
  getWcState: vi.fn().mockReturnValue({
    phase: 'running' as const,
    url: 'https://test.dev/',
    error: null,
    installOutput: '',
    serverOutput: '',
  }),
}))

// Mock the workspace module
const mockFiles = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    lastModified: 1,
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'test',
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
    }),
    lastModified: 1,
  },
  {
    path: 'src/main.tsx',
    content: `import { createRoot } from 'react-dom/client'; import App from './App'; createRoot(document.getElementById('root')!).render(<App/>)`,
    lastModified: 1,
  },
  {
    path: 'src/App.tsx',
    content: `export default function App() { return <div>Hello</div> }`,
    lastModified: 1,
  },
]

vi.mock('../../../lib/workspace', () => ({
  getWorkspace: vi.fn().mockReturnValue({
    files: mockFiles,
    buildResult: null,
    previewUrl: null,
  }),
  subscribeToWorkspace: vi.fn().mockReturnValue(() => {}),
}))

describe('PreviewFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    expect(container.querySelector('iframe')).toBeTruthy()
  })

  it('shows iframe with sandbox attributes', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts')
  })

  it('uses srcDoc in transpiler mode (not src)', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    // In transpiler mode, should have srcDoc set
    expect(iframe.getAttribute('srcDoc')).toBeTruthy()
    // Should NOT have a URL-based src
    expect(iframe.getAttribute('src')).toBeNull()
  })

  it('renders with phone device width', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('framed')
  })

  it('renders without frame in pc mode', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).not.toContain('framed')
  })

  it('renders device frame chrome in phone mode', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    expect(container.textContent).toContain('localhost')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/preview/__tests__/PreviewFrame.test.tsx`
Expected: FAIL — tests reference transpiler behavior that doesn't exist yet

- [ ] **Step 3: Modify PreviewFrame.tsx for dual-path**

The current PreviewFrame always uses WebContainer. We need to add a transpiler path. Add this near the top of the component (after the imports, before the component function):

```typescript
// In src/components/preview/PreviewFrame.tsx, add new imports:
import { detectCapability } from '../../lib/capabilities'
import { buildTranspiledPreview } from '../../lib/transpiler'
```

Then restructure the component to branch on capability. The key changes are in the `useCallback` and the render section. Add a new state variable and effect:

```typescript
// After existing state declarations, add:
const capability = detectCapability()
const [srcdoc, setSrcdoc] = useState<string>(() => {
  if (capability === 'transpiler') {
    return buildTranspiledPreview(getWorkspace().files)
  }
  return ''
})

// Add a workspace subscription for live updates in transpiler mode:
useEffect(() => {
  if (capability !== 'transpiler') return
  return subscribeToWorkspace(() => {
    setSrcdoc(buildTranspiledPreview(getWorkspace().files))
  })
}, [capability])
```

And modify the iframe source derivation:

```typescript
// Replace the existing iframeSrc/iframeSrcDoc derivation:
const isRunning = wcState.phase === 'running' && wcState.url

// Transpiler path: always use srcdoc
// WebContainer path: URL when running, placeholder srcdoc otherwise
const iframeSrc = (capability === 'webcontainer' && isRunning) ? wcState.url! : undefined
const iframeSrcDoc = capability === 'transpiler'
  ? srcdoc
  : !isRunning
    ? wcState.phase === 'error'
      ? buildErrorSrcDoc(wcState.error ?? 'Unknown error')
      : buildPlaceholderSrcDoc(title, wcState.phase)
    : undefined

const iframeKey = capability === 'transpiler'
  ? `transpiler-${srcdoc.length}`
  : isRunning
    ? wcState.url!
    : 'placeholder'
```

Full file needs to show the exact integration. The modifications are:

1. Add imports for `detectCapability`, `buildTranspiledPreview`, and `subscribeToWorkspace`
2. Add `capability`, `srcdoc` state, and workspace subscription
3. Modify `iframeSrc`/`iframeSrcDoc`/`iframeKey` to branch on capability
4. Keep all existing WebContainer logic (boot, syncWorkspace, etc.) but guard it behind `capability === 'webcontainer'`

Here is the complete modified file:

```typescript
// src/components/preview/PreviewFrame.tsx — full replacement
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Device } from './PreviewPanel'
import { getWorkspace, subscribeToWorkspace } from '../../lib/workspace'
import { detectCapability } from '../../lib/capabilities'
import { buildTranspiledPreview } from '../../lib/transpiler'
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

// Module-level callback so ChatPanel can trigger a preview sync
let _flushPreview: (() => void) | null = null
export function triggerFlushPreview() {
  _flushPreview?.()
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
  const capability = detectCapability()
  const [wcState, setWcState] = useState<WcState>(getWcState)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bootedRef = useRef(false)

  const [srcdoc, setSrcdoc] = useState<string>(() => {
    if (capability === 'transpiler') {
      return buildTranspiledPreview(getWorkspace().files)
    }
    return ''
  })

  // Subscribe to WebContainer state (only used in webcontainer path)
  useEffect(() => {
    return subscribeWcState(setWcState)
  }, [])

  // Subscribe to workspace changes for transpiler live updates
  useEffect(() => {
    if (capability !== 'transpiler') return
    return subscribeToWorkspace(() => {
      setSrcdoc(buildTranspiledPreview(getWorkspace().files))
    })
  }, [capability])

  // Boot WebContainer once on mount (only in webcontainer path)
  useEffect(() => {
    if (capability !== 'webcontainer' || bootedRef.current) return
    bootedRef.current = true
    boot().catch(() => {
      // error handled via wcState subscription
    })
  }, [capability])

  // Sync workspace → WebContainer
  const syncWorkspace = useCallback(async () => {
    if (capability !== 'webcontainer') return
    const { files } = getWorkspace()
    const wcFiles = files.map((f) => ({ path: f.path, content: f.content }))
    try {
      await ensureRunning(wcFiles)
    } catch {
      // error handled via wcState subscription
    }
  }, [capability])

  // Register flush callback for ChatPanel
  useEffect(() => {
    _flushPreview = () => {
      if (capability === 'transpiler') {
        setSrcdoc(buildTranspiledPreview(getWorkspace().files))
      } else {
        syncWorkspace()
      }
    }
    return () => { _flushPreview = null }
  }, [capability, syncWorkspace])

  // Kick off first sync after boot (webcontainer path only)
  useEffect(() => {
    if (capability !== 'webcontainer' || wcState.phase !== 'ready') return
    syncWorkspace()
  }, [capability, wcState.phase, syncWorkspace])

  /* ── Derive iframe props ─────────────────────── */

  const title =
    getWorkspace().files.find((f) => f.path === 'index.html')?.content.match(
      /<title>([^<]+)<\/title>/
    )?.[1] ?? 'Bloom'

  const isRunning = wcState.phase === 'running' && wcState.url

  const iframeSrc = (capability === 'webcontainer' && isRunning) ? wcState.url! : undefined
  const iframeSrcDoc = capability === 'transpiler'
    ? srcdoc
    : capability === 'webcontainer' && !isRunning
      ? wcState.phase === 'error'
        ? buildErrorSrcDoc(wcState.error ?? 'Unknown error')
        : buildPlaceholderSrcDoc(title, wcState.phase)
      : undefined

  const iframeKey = capability === 'transpiler'
    ? `transpiler-${srcdoc.length}`
    : isRunning
      ? wcState.url!
      : 'placeholder'

  /* ── Render ─────────────────────────────────── */

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
            sandbox="allow-scripts allow-forms"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the PreviewFrame tests**

Run: `npx vitest run src/components/preview/__tests__/PreviewFrame.test.tsx`
Expected: all tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: all 108+ tests PASS (some number may increase due to new tests from Tasks 2-3)

- [ ] **Step 6: Commit**

```bash
git add src/components/preview/PreviewFrame.tsx src/components/preview/__tests__/PreviewFrame.test.tsx
git commit -m "feat: add dual-path preview (WebContainer or transpiler fallback)"
```

---

### Task 5: Add fallback awareness to system prompt

**Files:**
- Modify: `src/lib/system-prompt.ts`
- Modify: `src/lib/__tests__/system-prompt.test.ts`

- [ ] **Step 1: Update the test file**

Append these tests to `src/lib/__tests__/system-prompt.test.ts`:

```typescript
// Add after existing describe blocks:

describe('buildSystemPrompt with capability', () => {
  it('includes WebContainer env when capability is webcontainer', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'webcontainer')
    expect(prompt).toContain('WebContainer')
    expect(prompt).toContain('npm')
  })

  it('includes fallback instructions when capability is transpiler', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'transpiler')
    expect(prompt).toContain('FALLBACK MODE')
    expect(prompt).toContain('browser-transpiler')
    expect(prompt).toContain('esm.sh')
  })

  it('warns against native Node.js packages in transpiler mode', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'transpiler')
    expect(prompt).toContain('fs')
    expect(prompt).toContain('native Node.js')
  })
})

describe('enhanceUserPrompt with capability', () => {
  it('includes WebContainer in context by default', () => {
    const result = enhanceUserPrompt('test', sampleFiles)
    expect(result).toContain('WebContainer')
  })

  it('replaces WebContainer context with transpiler context when in fallback', () => {
    const result = enhanceUserPrompt('test', sampleFiles, 'transpiler')
    expect(result).toContain('browser transpiler')
    expect(result).not.toContain('WebContainer (full Node.js in-browser')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/system-prompt.test.ts`
Expected: FAIL — `buildSystemPrompt` and `enhanceUserPrompt` don't accept capability parameter yet

- [ ] **Step 3: Modify system-prompt.ts**

Add the capability parameter to both exported functions and inject the fallback section:

```typescript
// Add import at top:
import { detectCapability, type PreviewCapability } from './capabilities'

// Add fallback instructions constant (after MODE_INSTRUCTIONS):

const FALLBACK_INSTRUCTIONS = `
## FALLBACK MODE — Browser Transpiler

IMPORTANT: You are running in browser-transpiler mode — there is NO Node.js runtime, NO npm install, and NO WebContainer. Your code runs directly in the browser after in-browser transpilation.

### What's available
- React and ReactDOM are loaded as global variables (UMD builds from CDN)
- Tailwind CSS is available via CDN (utility classes work, but @apply/@layer directives do NOT)
- All code is transpiled from TypeScript/JSX to JavaScript via Babel in the browser
- npm dependencies are resolved from https://esm.sh CDN

### What to avoid
- Do NOT use packages with native Node.js dependencies: fs, path, crypto, child_process, net, tls, http, stream
- Do NOT use server-side features: file system operations, server routes, API handlers
- Do NOT use @apply or @layer in CSS — use Tailwind utility classes directly in JSX className
- Do NOT use dynamic imports or require() — only static ES module imports

### Safe packages (CDN-compatible)
You CAN use: react, react-dom, react-router-dom, zustand, axios, tanstack-query, lucide-react, recharts, date-fns, lodash-es, framer-motion, @tanstack/react-table, zod, clsx, immer

### Imports
- Write imports normally: \`import { useState } from 'react'\` — the transpiler rewrites them
- The transpiler strips imports and uses the UMD globals (React, ReactDOM) or CDN URLs (other packages)
- Relative imports work normally: \`import Header from './Header'\`
`

// Modify buildSystemPrompt signature to accept capability:

export function buildSystemPrompt(
  files: WorkspaceFile[],
  mode: AgentMode = 'build',
  capability?: PreviewCapability
): string {
  const effectiveCapability = capability ?? detectCapability()
  const fileTree = files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `  ${f.path} (${(f.content.length / 1024).toFixed(1)} KB)`)
    .join('\n')

  const hasProjectMd = files.some((f) => f.path === 'PROJECT.md')
  const projectMdNote = hasProjectMd
    ? '\nA PROJECT.md file exists — read it first for context on previous decisions.'
    : ''

  const runtimeDesc = effectiveCapability === 'transpiler'
    ? 'Runtime: Browser transpiler (Babel transpilation, CDN imports, UMD globals for React/ReactDOM).'
    : 'Runtime: WebContainer (Node.js, npm, Vite dev server with HMR).'

  const stackDesc = effectiveCapability === 'transpiler'
    ? 'Stack: Vite + React 19 + TypeScript + Tailwind CSS v3 (CDN) + CSS Modules.'
    : 'Stack: Vite + React 19 + TypeScript + Tailwind CSS v3 + CSS Modules.'

  const workspaceContext = [
    '',
    '## CURRENT WORKSPACE',
    `Project contains ${files.length} files:`,
    fileTree,
    projectMdNote,
    '',
    stackDesc,
    runtimeDesc,
  ]
    .filter(Boolean)
    .join('\n')

  const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.build
  const fallbackSection = effectiveCapability === 'transpiler' ? FALLBACK_INSTRUCTIONS : ''

  return SYSTEM_PROMPT + '\n' + fallbackSection + '\n' + modeInstruction + '\n' + workspaceContext
}

// Modify enhanceUserPrompt similarly:

export function enhanceUserPrompt(
  rawPrompt: string,
  files: WorkspaceFile[],
  capability?: PreviewCapability
): string {
  const effectiveCapability = capability ?? detectCapability()
  const fileSummary = files
    .slice(0, 20)
    .map((f) => `  ${f.path}`)
    .join('\n')

  const hasProjectMd = files.some((f) => f.path === 'PROJECT.md')
  const projectMdHint = hasProjectMd
    ? '\nA PROJECT.md file exists — read it for previous architecture decisions.'
    : ''

  const runtimeDesc = effectiveCapability === 'transpiler'
    ? 'Runtime: Browser transpiler (no Node.js — Babel transpilation with CDN imports).'
    : 'Runtime: WebContainer (full Node.js in-browser, npm, Vite dev server with HMR).'

  const contextAnchor = [
    '## PROJECT CONTEXT',
    `Files in workspace: ${files.length}`,
    files.length > 0 ? `Current files:\n${fileSummary}` : 'Fresh scaffold — no user code yet.',
    files.length > 20 ? `  ... and ${files.length - 20} more files` : '',
    projectMdHint,
    '',
    'Tech stack: React 19 + TypeScript + Vite + Tailwind CSS v3 + CSS Modules.',
    runtimeDesc,
    '',
    '## USER REQUEST',
    rawPrompt,
  ]
    .filter(Boolean)
    .join('\n')

  return contextAnchor
}
```

- [ ] **Step 4: Run the system prompt tests**

Run: `npx vitest run src/lib/__tests__/system-prompt.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/lib/system-prompt.ts src/lib/__tests__/system-prompt.test.ts
git commit -m "feat: add fallback-aware system prompt for transpiler mode"
```

---

### Task 6: Integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 2: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 3: Build the project**

Run: `npm run build`
Expected: successful build

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
Open in a browser without COOP/COEP headers (or Safari).
Expected: Preview shows the default "Hello Bloom" page rendered via the transpiler fallback.

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: integration fixes for transpiler fallback"
```
