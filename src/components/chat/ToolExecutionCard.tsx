import { useState } from 'react'
import { readFile } from '../../lib/workspace'
import styles from './ToolExecutionCard.module.css'

interface Props {
  tool: string
  args?: Record<string, string>
  result: string
  success: boolean
}

/* ── Color per tool type ──────────────────────────── */

type ToolColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'

function toolColor(tool: string, success: boolean): ToolColor {
  if (!success) return 'red'
  switch (tool) {
    case 'list_files':
    case 'search_files':
    case 'read_file':
      return 'blue'
    case 'write_file':
    case 'edit_file':
      return 'green'
    case 'delete_file':
      return 'red'
    case 'execute_build':
      return success ? 'green' : 'red'
    case 'get_errors':
      return 'amber'
    case 'run_command':
      return 'purple'
    case 'web_search':
    case 'web_fetch':
      return 'blue'
    default:
      return 'slate'
  }
}

/* ── Component ────────────────────────────────────── */

export default function ToolExecutionCard({ tool, args = {}, result, success }: Props) {
  const [expanded, setExpanded] = useState(false)
  const config = getToolConfig(tool, result, success, args)
  const color = toolColor(tool, success)
  const colorClass = styles[color] ?? styles.slate

  return (
    <div className={`${styles.card} ${colorClass}`}>
      <button
        className={styles.header}
        onClick={() => config.expandable && setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={styles.icon}>{config.icon}</span>
        <span className={styles.info}>
          <span className={styles.label}>{config.label}</span>
          {config.detail && <span className={styles.detail}>{config.detail}</span>}
        </span>
        <span className={styles.badge}>{config.badge}</span>
        {config.expandable && (
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {expanded && config.expandable && config.body && (
        <div className={styles.body}>{config.body}</div>
      )}
    </div>
  )
}

/* ── Tool configuration ─────────────────────────── */

interface ToolConfig {
  icon: React.ReactNode
  label: string
  detail: string
  badge: string
  expandable: boolean
  body?: React.ReactNode
}

function getToolConfig(
  tool: string,
  result: string,
  success: boolean,
  args: Record<string, string>
): ToolConfig {
  switch (tool) {
    /* ── File discovery ─────────────────────── */
    case 'list_files':
      const count = (result.match(/\n/g) ?? []).length
      return {
        icon: <ListIcon />,
        label: 'Listed files',
        detail: `${count} files in workspace`,
        badge: 'Done',
        expandable: false,
      }

    case 'search_files': {
      const pattern = args.pattern ?? ''
      const matchCount = result.includes('No matches') ? 0 : (result.match(/\n/g) ?? []).length
      return {
        icon: <SearchIcon />,
        label: 'Searched',
        detail: `"${pattern.slice(0, 40)}"`,
        badge: `${matchCount} results`,
        expandable: matchCount > 0,
        body: <SearchResults text={result} />,
      }
    }

    /* ── File reading ───────────────────────── */
    case 'read_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      const lines = content ? content.split('\n').length : 0
      return {
        icon: <ReadIcon />,
        label: 'Read',
        detail: path,
        badge: lines > 0 ? `${lines}L` : '—',
        expandable: !!content && lines > 5,
        body: content ? <FilePreview path={path} content={content} lines={lines} /> : undefined,
      }
    }

    /* ── File writing ───────────────────────── */
    case 'write_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      const lines = content ? content.split('\n').length : 0
      const isNew = result.includes('Created')
      return {
        icon: isNew ? <NewIcon /> : <EditIcon />,
        label: isNew ? 'Created' : 'Modified',
        detail: path,
        badge: `${lines}L`,
        expandable: !!content && lines > 0,
        body: content ? <FilePreview path={path} content={content} lines={lines} /> : undefined,
      }
    }

    /* ── File editing ───────────────────────── */
    case 'edit_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      return {
        icon: <EditIcon />,
        label: 'Edited',
        detail: path,
        badge: success ? 'OK' : 'Fail',
        expandable: !!content,
        body: content ? <FilePreview path={path} content={content} lines={content.split('\n').length} /> : undefined,
      }
    }

    /* ── File deletion ──────────────────────── */
    case 'delete_file':
      return {
        icon: <TrashIcon />,
        label: 'Deleted',
        detail: args.path ?? '',
        badge: success ? 'OK' : 'Fail',
        expandable: false,
      }

    /* ── Build ──────────────────────────────── */
    case 'execute_build':
      return {
        icon: success ? <PassIcon /> : <FailIcon />,
        label: success ? 'Build passed' : 'Build failed',
        detail: '',
        badge: success ? 'OK' : `${result.match(/\d+ error/) ?? '?'}`,
        expandable: !success,
        body: !success ? <ErrorOutput text={result} /> : undefined,
      }

    case 'get_errors':
      return {
        icon: <DiagnosticsIcon />,
        label: 'Diagnostics',
        detail: success ? 'No issues' : `${(result.match(/\d+ error/) ?? ['0'])[0]} found`,
        badge: success ? 'Clean' : 'Errors',
        expandable: !!result && !success,
        body: !success ? <ErrorOutput text={result} /> : undefined,
      }

    /* ── Terminal ───────────────────────────── */
    case 'run_command': {
      const cmd = args.command ?? ''
      const exitInfo = result.match(/\[exit code: (\d+)\]/)?.[1]
      return {
        icon: <TerminalIcon />,
        label: cmd.length > 45 ? cmd.slice(0, 45) + '…' : cmd,
        detail: '',
        badge: exitInfo ? `exit ${exitInfo}` : success ? '0' : 'err',
        expandable: !!result,
        body: <TerminalOutput command={cmd} output={result} />,
      }
    }

    /* ── Web tools ──────────────────────────── */
    case 'web_search': {
      const query = args.query ?? ''
      return {
        icon: <SearchIcon />,
        label: 'Web search',
        detail: query.length > 45 ? query.slice(0, 45) + '…' : query,
        badge: 'Web',
        expandable: !!result && result.length > 80,
        body: <SearchResults text={result} />,
      }
    }

    case 'web_fetch': {
      const url = args.url ?? ''
      let host = ''
      try { host = new URL(url).hostname } catch { host = url.slice(0, 40) }
      return {
        icon: <GlobeIcon />,
        label: 'Fetched',
        detail: host,
        badge: `${result.length}+ chars` ?? '…',
        expandable: result.length > 200,
        body: <FetchedContent content={result} />,
      }
    }

    /* ── Fallback ───────────────────────────── */
    default:
      return {
        icon: <DotIcon />,
        label: tool,
        detail: '',
        badge: success ? 'Done' : 'Fail',
        expandable: false,
      }
  }
}

/* ── Sub-components ───────────────────────────────── */

function FilePreview({ path, content, lines }: { path: string; content: string; lines: number }) {
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n\n/* … truncated */' : content
  return (
    <div className={styles.filePreview}>
      <div className={styles.fileMeta}>
        <span className={styles.filePath}>{path}</span>
        <span className={styles.fileStats}>{lines} lines · {(content.length / 1024).toFixed(1)} KB</span>
      </div>
      <pre className={styles.codeBlock}><code>{truncated}</code></pre>
    </div>
  )
}

function TerminalOutput({ command, output }: { command: string; output: string }) {
  const clean = output.replace(/^\$ .*\n?/, '') // Remove duplicate prompt if present
  return (
    <div className={styles.terminal}>
      <div className={styles.terminalPrompt}>
        <span className={styles.promptSign}>$</span> {command}
      </div>
      <pre className={styles.terminalOut}>{clean.slice(0, 5000)}</pre>
    </div>
  )
}

function SearchResults({ text }: { text: string }) {
  return (
    <div className={styles.searchResults}>
      <pre className={styles.searchText}>{text.slice(0, 4000)}</pre>
    </div>
  )
}

function FetchedContent({ content }: { content: string }) {
  return (
    <div className={styles.fetchedContent}>
      <pre className={styles.fetchedText}>{content.slice(0, 3000)}</pre>
    </div>
  )
}

function ErrorOutput({ text }: { text: string }) {
  const clean = text.replace(/^(?:✅|🔨|🔍)\s*(?:Build (?:passed|failed)[\s—–-]*)?/i, '').trim()
  return (
    <div className={styles.errorBox}>
      <pre>{clean || 'No details available'}</pre>
    </div>
  )
}

/* ── SVG Icons (16px, cleaner) ───────────────────── */

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function ReadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function NewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PassIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="11" /><polyline points="8 12 11 15 17 9" />
    </svg>
  )
}

function FailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="11" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  )
}

function DiagnosticsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function DotIcon() {
  return <span className={styles.dotIcon}>·</span>
}
