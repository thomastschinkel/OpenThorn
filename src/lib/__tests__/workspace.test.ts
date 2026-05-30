import { describe, it, expect, beforeEach } from 'vitest'
import {
  writeFile,
  readFile,
  deleteFile,
  editFile,
  listFiles,
  getWorkspace,
  resetWorkspace,
  executeBuild,
  getErrors,
  subscribeToWorkspace,
} from '../workspace'

describe('validatePath', () => {
  it('rejects empty paths', () => {
    expect(() => writeFile('', 'x')).toThrow()
    expect(() => writeFile('  ', 'x')).toThrow()
  })

  it('rejects absolute paths', () => {
    expect(() => writeFile('/etc/passwd', 'x')).toThrow()
    expect(() => writeFile('\\windows\\system32', 'x')).toThrow()
  })

  it('rejects path traversal attempts', () => {
    expect(() => writeFile('../outside', 'x')).toThrow()
    expect(() => writeFile('foo/../../../bar', 'x')).toThrow()
  })

  it('rejects Windows drive letters', () => {
    expect(() => writeFile('C:\\foo.txt', 'x')).toThrow()
    expect(() => writeFile('D:/foo.txt', 'x')).toThrow()
  })

  it('accepts valid relative paths', () => {
    expect(() => writeFile('src/components/Header.tsx', 'test')).not.toThrow()
    expect(() => writeFile('foo/bar/baz.txt', 'test')).not.toThrow()
    expect(() => writeFile('simple.js', 'test')).not.toThrow()
  })

  it('normalizes paths with . and .. segments', () => {
    writeFile('src/./components/../utils/./helper.ts', 'test')
    const files = listFiles()
    expect(files.some((f) => f.path === 'src/utils/helper.ts')).toBe(true)
  })
})

describe('file CRUD', () => {
  beforeEach(() => {
    resetWorkspace()
  })

  it('starts with default scaffold files', () => {
    const files = listFiles()
    expect(files.length).toBeGreaterThanOrEqual(8)
    expect(files.some((f) => f.path === 'package.json')).toBe(true)
    expect(files.some((f) => f.path === 'src/App.tsx')).toBe(true)
    expect(files.some((f) => f.path === 'index.html')).toBe(true)
  })

  it('writes a new file', () => {
    writeFile('src/test.txt', 'hello')
    expect(readFile('src/test.txt')).toBe('hello')
  })

  it('overwrites an existing file', () => {
    writeFile('src/App.tsx', 'new content')
    expect(readFile('src/App.tsx')).toBe('new content')
  })

  it('reads a file', () => {
    const content = readFile('package.json')
    expect(content).toBeTruthy()
    expect(JSON.parse(content!)).toHaveProperty('name', 'bloom-project')
  })

  it('returns null for missing files', () => {
    expect(readFile('nonexistent.txt')).toBeNull()
  })

  it('deletes a file', () => {
    writeFile('src/temp.txt', 'temp')
    expect(deleteFile('src/temp.txt')).toBe(true)
    expect(readFile('src/temp.txt')).toBeNull()
  })

  it('returns false when deleting missing file', () => {
    expect(deleteFile('nonexistent.txt')).toBe(false)
  })

  it('editFile applies string replacement', () => {
    writeFile('src/test.txt', 'line1\nline2\nline3')
    const result = editFile('src/test.txt', 'line2', 'modified')
    expect(result.success).toBe(true)
    expect(readFile('src/test.txt')).toBe('line1\nmodified\nline3')
  })

  it('editFile fails on non-matching string', () => {
    writeFile('src/test.txt', 'hello world')
    const result = editFile('src/test.txt', 'nonexistent', 'replacement')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('editFile fails on missing file', () => {
    const result = editFile('nonexistent.txt', 'a', 'b')
    expect(result.success).toBe(false)
  })

  it('sorts files by path after write', () => {
    writeFile('z-last.txt', 'z')
    writeFile('a-first.txt', 'a')
    const files = listFiles()
    const paths = files.map((f) => f.path)
    expect(paths).toEqual([...paths].sort())
  })
})

describe('build pipeline', () => {
  beforeEach(() => {
    resetWorkspace()
  })

  it('scaffold project builds successfully', async () => {
    const result = await executeBuild()
    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects unbalanced braces in JSX', async () => {
    writeFile('src/broken.tsx', 'function Foo() { return <div>hi</div> }}}')
    const result = await executeBuild()
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('Unbalanced braces'))).toBe(true)
  })

  it('detects unbalanced CSS braces', async () => {
    writeFile('src/broken.css', '.foo { color: red; } }')
    const result = await executeBuild()
    expect(result.success).toBe(false)
  })

  it('get_errors returns null before first build', () => {
    expect(getErrors()).toBeNull()
  })

  it('get_errors returns result after build', async () => {
    await executeBuild()
    const errors = getErrors()
    expect(errors).not.toBeNull()
    expect(errors!.errors).toHaveLength(0)
  })

  it('flags missing local imports as warnings', async () => {
    writeFile('src/importer.tsx', `import { Foo } from './nonexistent'`)
    const result = await executeBuild()
    expect(result.warnings.some((w) => w.includes('may be missing'))).toBe(true)
  })
})

describe('workspace subscription', () => {
  beforeEach(() => {
    resetWorkspace()
  })

  it('notifies subscribers on file changes', () => {
    let called = false
    const unsub = subscribeToWorkspace(() => {
      called = true
    })
    writeFile('src/test.txt', 'content')
    expect(called).toBe(true)
    unsub()
  })

  it('unsubscribes correctly', () => {
    let count = 0
    const unsub = subscribeToWorkspace(() => count++)
    writeFile('src/first.txt', '1')
    unsub()
    writeFile('src/second.txt', '2')
    expect(count).toBe(1)
  })

  it('notifies on delete', () => {
    writeFile('src/temp.txt', 'temp')
    let called = false
    const unsub = subscribeToWorkspace(() => {
      called = true
    })
    deleteFile('src/temp.txt')
    expect(called).toBe(true)
    unsub()
  })

  it('notifies on reset', () => {
    let called = false
    const unsub = subscribeToWorkspace(() => {
      called = true
    })
    resetWorkspace()
    expect(called).toBe(true)
    unsub()
  })
})

describe('default scaffold', () => {
  beforeEach(() => {
    resetWorkspace()
  })

  it('includes all required config files', () => {
    const paths = listFiles().map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('tsconfig.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('tailwind.config.ts')
    expect(paths).toContain('postcss.config.js')
  })

  it('package.json has TypeScript deps', () => {
    const pkg = JSON.parse(readFile('package.json')!)
    expect(pkg.devDependencies).toHaveProperty('typescript')
    expect(pkg.devDependencies).toHaveProperty('@types/react')
    expect(pkg.devDependencies).toHaveProperty('@vitejs/plugin-react')
  })

  it('tsconfig has strict mode', () => {
    const tsconfig = JSON.parse(readFile('tsconfig.json')!)
    expect(tsconfig.compilerOptions.strict).toBe(true)
    expect(tsconfig.compilerOptions.jsx).toBe('react-jsx')
  })

  it('index.html references main.tsx', () => {
    const html = readFile('index.html')!
    expect(html).toContain('src/main.tsx')
  })

  it('App.tsx is a valid React component', () => {
    const app = readFile('src/App.tsx')!
    expect(app).toContain('export default function App')
    expect(app).toContain('Hello Bloom')
  })
})
