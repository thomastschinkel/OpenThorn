/**
 * In-browser transpiler pipeline.
 *
 * Takes workspace files and produces a complete HTML document string
 * suitable for iframe srcdoc. Uses @babel/standalone for JSX/TS→JS
 * transpilation, unpkg CDN UMD builds for React/ReactDOM globals,
 * and cdn.tailwindcss.com for Tailwind utility classes.
 *
 * This is the fallback path when WebContainers cannot run (no
 * SharedArrayBuffer — missing COOP/COEP headers, iOS Safari, etc.).
 */

import * as Babel from '@babel/standalone'
import type { WorkspaceFile } from './workspace'

/* ── CDN Import Resolution ──────────────────────── */

/**
 * Parse package.json from workspace and build a name→CDN-URL map.
 * Uses esm.sh for module resolution.
 */
export function resolveCdnImports(files: WorkspaceFile[]): Map<string, string> {
  const map = new Map<string, string>()
  const pkgFile = files.find(f => f.path === 'package.json')
  if (!pkgFile) return map

  try {
    const pkg = JSON.parse(pkgFile.content)
    const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies }
    for (const [name, version] of Object.entries(allDeps) as [string, string][]) {
      const clean = (version as string).replace(/^[\^~]/, '')
      map.set(name, `https://esm.sh/${name}@${clean}`)
    }
  } catch {
    // package.json parse error — return empty map
  }

  return map
}

/* ── UMD Script Tags ────────────────────────────── */

/**
 * Build HTML <script> tags for UMD globals that the transpiled code needs.
 * React and ReactDOM are the baseline — loaded from unpkg CDN.
 */
function buildUmdScripts(files: WorkspaceFile[]): string {
  const versions = getDependencyVersions(files)
  const reactVer = versions.get('react') ?? '19'
  const reactDomVer = versions.get('react-dom') ?? '19'

  return [
    `<script crossorigin src="https://unpkg.com/react@${reactVer}/umd/react.production.min.js"></script>`,
    `<script crossorigin src="https://unpkg.com/react-dom@${reactDomVer}/umd/react-dom.production.min.js"></script>`,
  ].join('\n    ')
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
 * Find the entry point file path from index.html's <script> tag.
 */
function findEntryPath(files: WorkspaceFile[]): string | null {
  const html = files.find(f => f.path === 'index.html')
  if (!html) return null

  const match = html.content.match(/<script[^>]+src=["']\/([^"']+)["']/)
  if (match) {
    const entryPath = match[1]
    if (files.some(f => f.path === entryPath)) return entryPath
  }

  // Fallback: look for src/main.tsx directly
  const mainFile = files.find(f => f.path === 'src/main.tsx')
  if (mainFile) return 'src/main.tsx'

  return null
}

/* ── Import Graph Walking ──────────────────────── */

/**
 * Topological sort of files by import dependencies.
 * Returns files in dependency order (dependencies first, entry last).
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

    // Find relative imports and visit dependencies first
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
  // Join dir + importPath, normalize . and .. segments
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
  const extensions = [
    '.tsx', '.ts', '.jsx', '.js',
    '/index.tsx', '/index.ts', '/index.jsx', '/index.js',
  ]
  for (const ext of extensions) {
    const candidate = base + ext
    if (fileMap.has(candidate)) return candidate
  }

  return null
}

/* ── Code Transformations ────────────────────────── */

/**
 * Strip import declarations from source code.
 * npm imports → handled by UMD globals
 * relative imports → handled by concatenation order
 * CSS imports → handled separately
 */
function stripImports(code: string): string {
  return code
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    // Clean up blank lines left by removed imports
    .replace(/^\s*\n/gm, '')
}

/**
 * Strip export keywords so concatenated code works as a single scope.
 * - export default function X → function X
 * - export default class X → class X
 * - export const X = → const X =
 * - export function X( → function X(
 * - export { X, Y } → (removed)
 */
function stripExports(code: string): string {
  return code
    .replace(/^export\s+default\s+(function|class|const|let|var)\s/gm, '$1 ')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+(function|class|const|let|var)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
}

/* ── Main Pipeline ───────────────────────────────── */

/**
 * Main entry point: workspace files → complete HTML srcdoc string.
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
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${indent(js, '      ')}
    </script>
  </body>
</html>`
}

/* ── Pipeline Stages ─────────────────────────────── */

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
  return code.split('\n').map(line => line ? spaces + line : '').join('\n')
}
