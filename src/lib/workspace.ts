/**
 * Workspace — project file store + build pipeline.
 * Manages the pre-initialized Vite + React + TypeScript project,
 * file CRUD, build execution, and error capture.
 */

export interface WorkspaceFile {
  path: string // e.g. "src/components/Header.tsx"
  content: string
  lastModified: number
}

export interface BuildResult {
  success: boolean
  errors: string[]
  warnings: string[]
  logs: string[]
}

export interface WorkspaceState {
  files: WorkspaceFile[]
  buildResult: BuildResult | null
  previewUrl: string | null
}

/* ── Default Project Scaffold ─────────────────────── */

const DEFAULT_FILES: WorkspaceFile[] = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bloom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    lastModified: Date.now(),
  },
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'bloom-project',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19.2.0',
          'react-dom': '^19.2.0',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^6.0.0',
          autoprefixer: '^10.4.0',
          postcss: '^8.4.0',
          tailwindcss: '^3.4.0',
          vite: '^8.0.0',
        },
      },
      null,
      2
    ),
    lastModified: Date.now(),
  },
  {
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    lastModified: Date.now(),
  },
  {
    path: 'tailwind.config.js',
    content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
    lastModified: Date.now(),
  },
  {
    path: 'postcss.config.js',
    content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    lastModified: Date.now(),
  },
  {
    path: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
    lastModified: Date.now(),
  },
  {
    path: 'src/main.jsx',
    content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
    lastModified: Date.now(),
  },
  {
    path: 'src/App.jsx',
    content: `export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Hello Bloom</h1>
        <p className="text-zinc-400">Describe what you want to build to get started.</p>
      </div>
    </div>
  )
}`,
    lastModified: Date.now(),
  },
]

/* ── Workspace State ──────────────────────────────── */

let workspace: WorkspaceState = {
  files: DEFAULT_FILES.map((f) => ({ ...f, lastModified: Date.now() })),
  buildResult: null,
  previewUrl: null,
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}

export function getWorkspace(): WorkspaceState {
  return workspace
}

export function subscribeToWorkspace(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function resetWorkspace() {
  workspace = {
    files: DEFAULT_FILES.map((f) => ({ ...f, lastModified: Date.now() })),
    buildResult: null,
    previewUrl: null,
  }
  notify()
}

/* ── Path Validation ──────────────────────────────── */

/**
 * Validate and normalize a file path to prevent path traversal attacks.
 * All file CRUD operations must go through this check.
 */
function validatePath(userPath: string): string {
  // Block empty paths
  if (!userPath || userPath.trim().length === 0) {
    throw new Error('Path must not be empty')
  }

  // Block absolute paths
  if (userPath.startsWith('/') || userPath.startsWith('\\')) {
    throw new Error(`Absolute paths are not allowed: ${userPath}`)
  }

  // Block Windows drive letters
  if (/^[a-zA-Z]:/.test(userPath)) {
    throw new Error(`Windows drive paths are not allowed: ${userPath}`)
  }

  // Normalize: resolve .. and .
  const segments = userPath.replace(/\\/g, '/').split('/')
  const resolved: string[] = []
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (resolved.length === 0) {
        throw new Error(`Path traversal blocked: ${userPath} (attempted to escape workspace)`)
      }
      resolved.pop()
      continue
    }
    // Block suspicious segments
    if (seg.includes('\0') || seg.includes('\n') || seg.includes('\r')) {
      throw new Error(`Invalid characters in path: ${userPath}`)
    }
    resolved.push(seg)
  }

  if (resolved.length === 0) {
    throw new Error(`Path resolves to workspace root: ${userPath}`)
  }

  return resolved.join('/')
}

/* ── File CRUD ────────────────────────────────────── */

export function writeFile(path: string, content: string): WorkspaceFile {
  const safePath = validatePath(path)
  const existing = workspace.files.find((f) => f.path === safePath)
  if (existing) {
    existing.content = content
    existing.lastModified = Date.now()
    notify()
    return existing
  }
  const file: WorkspaceFile = { path: safePath, content, lastModified: Date.now() }
  workspace.files.push(file)
  // Keep files sorted by path
  workspace.files.sort((a, b) => a.path.localeCompare(b.path))
  notify()
  return file
}

export function readFile(path: string): string | null {
  const safePath = validatePath(path)
  return workspace.files.find((f) => f.path === safePath)?.content ?? null
}

export function deleteFile(path: string): boolean {
  const safePath = validatePath(path)
  const idx = workspace.files.findIndex((f) => f.path === safePath)
  if (idx === -1) return false
  workspace.files.splice(idx, 1)
  notify()
  return true
}

export function editFile(
  path: string,
  oldString: string,
  newString: string
): { success: boolean; error?: string } {
  const safePath = validatePath(path)
  const file = workspace.files.find((f) => f.path === safePath)
  if (!file) return { success: false, error: `File not found: ${safePath}` }
  if (!file.content.includes(oldString)) {
    return { success: false, error: 'old_string not found in file — it may have changed since you last read it' }
  }
  file.content = file.content.replace(oldString, newString)
  file.lastModified = Date.now()
  notify()
  return { success: true }
}

export function listFiles(): WorkspaceFile[] {
  return [...workspace.files]
}

/* ── Build Pipeline ───────────────────────────────── */

/**
 * Basic syntax check for TypeScript/TSX files.
 * Checks for unbalanced braces, brackets, and parentheses.
 * Full type-checking requires WebContainer — this catches the most common issues.
 */
function syntaxCheck(code: string): string[] {
  const issues: string[] = []

  // Count braces/brackets/parens (ignoring strings and comments)
  const stripped = code
    .replace(/`[^`]*`/g, '') // template literals
    .replace(/'[^']*'/g, '') // single quotes
    .replace(/"[^"]*"/g, '') // double quotes
    .replace(/\/\/.*$/gm, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments

  const pairs: [string, string, string][] = [
    ['{', '}', 'braces'],
    ['[', ']', 'brackets'],
    ['(', ')', 'parentheses'],
  ]

  for (const [open, close, name] of pairs) {
    const openCount = (stripped.match(new RegExp(`\\${open}`, 'g')) ?? []).length
    const closeCount = (stripped.match(new RegExp(`\\${close}`, 'g')) ?? []).length
    if (openCount !== closeCount) {
      issues.push(`Unbalanced ${name}: ${openCount} opening, ${closeCount} closing`)
    }
  }

  // Check for common issues
  if (stripped.includes('export default class')) {
    issues.push('TypeScript interfaces use "interface" keyword, not classes')
  }

  return issues
}

export async function executeBuild(): Promise<BuildResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const logs: string[] = []

  for (const file of workspace.files) {
    if (
      file.path.endsWith('.ts') ||
      file.path.endsWith('.tsx') ||
      file.path.endsWith('.js') ||
      file.path.endsWith('.jsx')
    ) {
      const issues = syntaxCheck(file.content)
      for (const issue of issues) {
        errors.push(`${file.path}: ${issue}`)
      }
    }

    if (file.path.endsWith('.css')) {
      // Basic CSS check — unbalanced braces
      const openBraces = (file.content.match(/\{/g) ?? []).length
      const closeBraces = (file.content.match(/\}/g) ?? []).length
      if (openBraces !== closeBraces) {
        errors.push(`${file.path}: Unbalanced CSS braces (${openBraces} open, ${closeBraces} close)`)
      }
    }
  }

  // Check for import consistency — referenced files should exist
  for (const file of workspace.files) {
    if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      const importMatches = file.content.matchAll(
        /from\s+['"](\.\/|\.\.\/)([^'"]+)['"]/g
      )
      for (const match of importMatches) {
        const importPath = match[2]
        // Resolve relative import
        const dir = file.path.split('/').slice(0, -1).join('/')
        const resolved = dir ? `${dir}/${importPath}` : importPath
        const withExt = [
          resolved,
          `${resolved}.ts`,
          `${resolved}.tsx`,
          `${resolved}.js`,
          `${resolved}.jsx`,
          `${resolved}/index.ts`,
          `${resolved}/index.tsx`,
        ]
        const exists = withExt.some((p) =>
          workspace.files.some((f) => f.path === p)
        )
        if (!exists) {
          // Only flag local imports (not npm packages)
          warnings.push(
            `${file.path}: Import "${match[2]}" may be missing — no matching file found`
          )
        }
      }
    }
  }

  const result: BuildResult = {
    success: errors.length === 0,
    errors,
    warnings,
    logs,
  }
  workspace.buildResult = result
  notify()
  return result
}

export function getErrors(): BuildResult | null {
  return workspace.buildResult
}
