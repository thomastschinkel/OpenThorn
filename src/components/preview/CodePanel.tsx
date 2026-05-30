import { useState, useEffect, useCallback } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import html from 'react-syntax-highlighter/dist/esm/languages/hljs/htmlbars'
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { getWorkspace, subscribeToWorkspace, type WorkspaceFile } from '../../lib/workspace'
import styles from './CodePanel.module.css'

SyntaxHighlighter.registerLanguage('html', html)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('json', json)

export type CodeView = 'files' | 'code'

function guessLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html': case 'htm': return 'html'
    case 'css': return 'css'
    case 'js': case 'mjs': case 'cjs': return 'javascript'
    case 'ts': case 'tsx': return 'typescript'
    case 'json': return 'json'
    default: return 'text'
  }
}

function fileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

interface Props {
  initialView?: CodeView
  onClose: () => void
}

// ── Tree node types ──────────────────────────────

interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children: TreeNode[]
  file?: WorkspaceFile
}

function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const f of files) {
    const parts = f.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1
      const segPath = parts.slice(0, i + 1).join('/')
      let node = current.find((n) => n.name === parts[i])
      if (!node) {
        node = {
          name: parts[i],
          path: segPath,
          type: isFile ? 'file' : 'folder',
          children: [],
          file: isFile ? f : undefined,
        }
        current.push(node)
      }
      if (isFile) {
        node.file = f
        node.type = 'file'
      }
      current = node.children
    }
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  }).map(n => ({ ...n, children: sortTree(n.children) }))
}

// ── File icon SVG ────────────────────────────────

function FileIcon({ ext }: { ext: string }) {
  const color = getExtColor(ext)
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 1h5l4 4v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill={color} opacity="0.15" />
      <path d="M8 1l4 4H8V1z" fill={color} opacity="0.3" />
      <path d="M3 1h5l4 4v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" stroke={color} strokeOpacity="0.5" strokeWidth="0.8" />
      <text x="7" y="11" textAnchor="middle" fontSize="5.5" fontWeight="600" fill={color} fontFamily="system-ui">{ext.toUpperCase().slice(0, 3)}</text>
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {open ? (
        <path d="M1 2h4l2 1.5H13v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2z" fill="#dcb65b" opacity="0.6" />
      ) : (
        <path d="M1 2h4l2 1.5H13v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2z" fill="#dcb65b" opacity="0.3" stroke="#dcb65b" strokeOpacity="0.5" strokeWidth="0.6" />
      )}
    </svg>
  )
}

function getExtColor(ext: string): string {
  switch (ext) {
    case 'tsx': return '#5fc9f8'
    case 'ts': return '#3178c6'
    case 'js': case 'jsx': return '#f7df1e'
    case 'css': return '#42a5f5'
    case 'html': return '#e44d26'
    case 'json': return '#f5a623'
    case 'md': return '#8b8b8b'
    default: return '#8b8b8b'
  }
}

// ── Recursive tree row ───────────────────────────

function TreeRow({
  node,
  depth,
  activePath,
  onSelect,
  defaultExpanded,
}: {
  node: TreeNode
  depth: number
  activePath: string | null
  onSelect: (file: WorkspaceFile) => void
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (node.type === 'folder') {
    return (
      <>
        <button
          className={styles.treeRow}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="8 4 16 12 8 20" />
          </svg>
          <FolderIcon open={expanded} />
          <span className={styles.treeName}>{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
              defaultExpanded={depth < 1}
            />
          ))}
      </>
    )
  }

  const ext = fileExt(node.name)
  return (
    <button
      className={`${styles.treeRow} ${activePath === node.path ? styles.treeRowActive : ''}`}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      onClick={() => node.file && onSelect(node.file)}
    >
      <span className={styles.chevronSpacer} />
      <FileIcon ext={ext} />
      <span className={styles.treeName}>{node.name}</span>
    </button>
  )
}

// ── Main component ───────────────────────────────

export default function CodePanel({ initialView = 'code', onClose }: Props) {
  const [files, setFiles] = useState<WorkspaceFile[]>(getWorkspace().files)
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(
    files[0] ?? null
  )
  const [view, setView] = useState<CodeView>(initialView)

  useEffect(() => {
    return subscribeToWorkspace(() => {
      const updated = getWorkspace().files
      setFiles(updated)
      setActiveFile((prev) => {
        if (!prev) return updated[0] ?? null
        const stillExists = updated.find((f) => f.path === prev.path)
        return stillExists ?? updated[0] ?? null
      })
    })
  }, [])

  const handleSelect = useCallback(
    (file: WorkspaceFile) => {
      setActiveFile(file)
      setView('code')
    },
    []
  )

  const tree = buildTree(files)

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${view === 'files' ? styles.tabActive : ''}`}
            onClick={() => setView('files')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            Files
          </button>
          <button
            className={`${styles.tab} ${view === 'code' ? styles.tabActive : ''}`}
            onClick={() => setView('code')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* File Tree */}
        <div className={styles.fileTree}>
          <div className={styles.fileTreeHeader}>
            PROJECT
            <span className={styles.fileCount}>{files.length}</span>
          </div>
          <div className={styles.treeList}>
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                activePath={activeFile?.path ?? null}
                onSelect={handleSelect}
                defaultExpanded={true}
              />
            ))}
          </div>
        </div>

        {/* Code Viewer */}
        {view === 'code' && (
          <div className={styles.codeViewer}>
            <div className={styles.codeHeader}>
              <span className={styles.codeFileName}>{activeFile?.path}</span>
              <span className={styles.codeLang}>
                {activeFile ? guessLanguage(activeFile.path) : ''}
              </span>
            </div>
            <div className={styles.codeContent}>
              <SyntaxHighlighter
                language={activeFile ? guessLanguage(activeFile.path) : 'text'}
                style={atomOneDark}
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  padding: '20px',
                  background: '#1e1e1e',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  borderRadius: 0,
                }}
                lineNumberStyle={{
                  color: '#3d3d4a',
                  minWidth: '2em',
                  paddingRight: '1.5em',
                  userSelect: 'none',
                }}
              >
                {activeFile?.content ?? ''}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
