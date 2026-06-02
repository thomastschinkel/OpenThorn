import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import PromptInput from '../components/PromptInput/PromptInput'
import styles from './ProjectBuilderPage.module.css'

interface ProjectRouteState {
  prompt?: string
  title?: string
}

const codeFiles = [
  {
    path: 'src/App.tsx',
    language: 'tsx',
    code: `import PreviewShell from './components/PreviewShell'\nimport Hero from './components/Hero'\nimport './styles/theme.css'\n\nexport default function App() {\n  return (\n    <PreviewShell>\n      <Hero />\n    </PreviewShell>\n  )\n}`,
  },
  {
    path: 'src/components/Hero.tsx',
    language: 'tsx',
    code: `export default function Hero() {\n  return (\n    <section className="hero">\n      <p className="eyebrow">Generated with Bloom</p>\n      <h1>Your first page is ready for refinement.</h1>\n      <p className="lede">\n        The preview canvas will render the generated app once the build pipeline is connected.\n      </p>\n    </section>\n  )\n}`,
  },
  {
    path: 'src/components/PreviewShell.tsx',
    language: 'tsx',
    code: `import type { ReactNode } from 'react'\n\nexport default function PreviewShell({ children }: { children: ReactNode }) {\n  return <main className="preview-shell">{children}</main>\n}`,
  },
  {
    path: 'src/styles/theme.css',
    language: 'css',
    code: `.preview-shell {\n  min-height: 100vh;\n  background: #fbfaf8;\n  color: #241f2a;\n}\n\n.hero {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 96px 32px;\n}\n\n.eyebrow {\n  color: #4f978e;\n  font-weight: 700;\n}`,
  },
]

const suggestions = [
  'Add authentication',
  'Make it responsive',
]

type ViewMode = 'preview' | 'code'
type DeviceMode = 'desktop' | 'tablet' | 'phone'

const deviceOrder: DeviceMode[] = ['desktop', 'tablet', 'phone']

export default function ProjectBuilderPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const location = useLocation()
  const state = (location.state ?? {}) as ProjectRouteState
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [activeFile, setActiveFile] = useState(codeFiles[0].path)
  const [fullscreen, setFullscreen] = useState(false)

  const prompt = state.prompt || 'Build a polished web app with a strong hero, product sections, and a deploy-ready layout.'
  const title = state.title || 'Untitled project'
  const activeCodeFile = codeFiles.find((file) => file.path === activeFile) ?? codeFiles[0]
  const userInitial = user?.user_metadata?.full_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? 'U'
  const userAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture

  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true })
    }
  }, [loading, user, navigate])

  // Sync project to Supabase on mount
  useEffect(() => {
    if (!user || !projectId) return

    const saveProject = async () => {
      // Verify ownership before upserting to prevent IDOR
      const { data: existing } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()

      if (existing && existing.user_id !== user.id) {
        // Project belongs to another user — redirect away
        navigate('/dashboard', { replace: true })
        return
      }

      const { error } = await supabase
        .from('projects')
        .upsert({
          id: projectId,
          user_id: user.id,
          title,
          preview_url: null,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (error) {
        console.error('Failed to sync project:', error.message)
      }
    }

    saveProject()
  }, [user, projectId, title, navigate])

  if (loading) return null

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button className={styles.backBtn} type="button" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={styles.brandCluster}>
            <img src="/assets/logo.png" alt="Bloom" className={styles.logo} />
            <div>
              <div className={styles.projectName}>{title}</div>
              <div className={styles.projectMeta}>Draft project - {projectId?.slice(0, 8)}</div>
            </div>
          </div>
        </div>

        <div className={styles.modeSwitch} aria-label="View mode">
          <button
            className={viewMode === 'preview' ? styles.modeActive : ''}
            type="button"
            onClick={() => setViewMode('preview')}
          >
            <GlobeIcon />
            Preview
          </button>
          <button
            className={viewMode === 'code' ? styles.modeActive : ''}
            type="button"
            onClick={() => setViewMode('code')}
          >
            <CodeIcon />
            Code
          </button>
        </div>

        <div className={styles.topActions}>
          <button className={styles.iconBtn} type="button" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <a className={styles.iconBtn} href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
            <GithubIcon />
          </a>
          <button className={styles.iconBtn} type="button" aria-label="Project settings">
            <DotsIcon />
          </button>
          <button className={styles.shareBtn} type="button">
            Share
          </button>
          <button className={styles.deployBtn} type="button">
            Deploy
          </button>
        </div>
      </header>

      <main className={styles.shell}>
        <aside className={styles.chatPanel}>
          <div className={styles.panelHeader}>
            <h1>{title}</h1>
          </div>

          <div className={styles.thread}>
            <article className={styles.userMessage}>
              <div className={styles.avatar}>
                {userAvatar ? <img src={userAvatar} alt="" /> : userInitial}
              </div>
              <div className={styles.userBubble}>
                <p>{prompt}</p>
              </div>
            </article>

            <article className={styles.assistantMessage}>
              <div className={styles.assistantTop}>
                <img src="/assets/logo.png" alt="" />
                <span>Frontend scaffold prepared.</span>
              </div>
              <MarkdownBlock
                markdown={`The editor shell is ready.\n\n- Preview is connected to the responsive device frame.\n- Code view includes the current frontend files.\n- Backend generation can plug into this route later.`}
              />
              <div className={styles.fileList}>
                {codeFiles.map((file) => (
                  <span key={file.path}>
                    <FileIcon />
                    {file.path}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <div className={styles.suggestionBlock}>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button">{suggestion}</button>
            ))}
          </div>

          <div className={styles.composer}>
            <PromptInput
              size="small"
              page="dashboard"
              disableTyping
              placeholder="Ask Bloom for a change..."
              onSubmit={() => undefined}
            />
          </div>
        </aside>

        <section className={`${styles.previewPane} ${fullscreen ? styles.previewPaneFullscreen : ''}`}>
          <div className={styles.previewToolbar}>
            <div className={styles.previewTools}>
              <button
                className={styles.iconBtnActive}
                type="button"
                aria-label={`Switch device preview. Current: ${deviceMode}`}
                onClick={() => setDeviceMode((current) => deviceOrder[(deviceOrder.indexOf(current) + 1) % deviceOrder.length])}
              >
                <DeviceIcon mode={deviceMode} />
              </button>
            </div>

            <div className={styles.addressBar}>
              <RefreshIcon />
              <span>/</span>
              <ChevronDownIcon />
            </div>

            <div className={styles.previewTools}>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label={fullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}
                onClick={() => setFullscreen((value) => !value)}
              >
                {fullscreen ? <MinimizeIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <div className={styles.previewStage}>
              <div className={`${styles.deviceFrame} ${styles[deviceMode]}`}>
                <div className={styles.previewCard}>
                  <div className={styles.previewChrome}>
                    <div className={styles.previewChromeDots}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className={styles.previewPath}>/{title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preview'}</span>
                    <span className={styles.previewState}>Waiting for build</span>
                  </div>

                  <div className={styles.previewEmpty}>
                    <div className={styles.previewMark}>
                      <img src="/assets/logo.png" alt="" />
                    </div>
                    <h2>Preview will appear here</h2>
                    <p>{prompt}</p>
                    <div className={styles.previewChecklist}>
                      <span><CheckIcon /> Layout shell</span>
                      <span><CheckIcon /> Prompt captured</span>
                      <span><ClockIcon /> Generation pipeline</span>
                    </div>
                  </div>

                  <div className={styles.previewSkeleton} aria-hidden="true">
                    <div className={styles.skeletonWide} />
                    <div />
                    <div />
                    <div />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.codeWorkspace}>
              <aside className={styles.codeSidebar}>
                <div className={styles.codeSidebarTitle}>Explorer</div>
                {codeFiles.map((file) => (
                  <button
                    key={file.path}
                    className={file.path === activeFile ? styles.codeFileActive : styles.codeFile}
                    type="button"
                    onClick={() => setActiveFile(file.path)}
                  >
                    <span className={styles.fileIcon}>
                      <FileIcon />
                    </span>
                    <span className={styles.fileName}>{file.path.split('/').pop()}</span>
                    <span className={styles.filePath}>{file.path.split('/').slice(0, -1).join('/')}</span>
                  </button>
                ))}
              </aside>

              <div className={styles.editorPane}>
                <div className={styles.editorTabs}>
                  <div className={styles.editorTab}>
                    <span className={styles.tabIcon}>
                      <FileIcon />
                    </span>
                    {activeCodeFile.path.split('/').pop()}
                    <button className={styles.tabClose} type="button" aria-label="Close tab">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className={styles.editorBody}>
                  <div className={styles.editorGutter}>
                    {activeCodeFile.code.split('\n').map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <pre className={styles.codeBlock}><code>{activeCodeFile.code}</code></pre>
                </div>
                <div className={styles.editorStatusBar}>
                  <span>{activeCodeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>Ln {activeCodeFile.code.split('\n').length}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  const blocks = markdown.trim().split(/\n{2,}/)

  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter(Boolean)

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={index}>
              {lines.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`}>{line.slice(2)}</li>
              ))}
            </ul>
          )
        }

        return <p key={index}>{lines.join(' ')}</p>
      })}
    </div>
  )
}

function GlobeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>
}

function CodeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
}

function DotsIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
}

function FileIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
}

function DesktopIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
}

function ChevronDownIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
}

function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
}

function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
}

function GithubIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A12 12 0 004.4 21.8c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.4 1.3a11.7 11.7 0 016.2 0C17.7 4 18.7 4.3 18.7 4.3c.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.3 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0012 .5z"/></svg>
}

function DeviceIcon({ mode }: { mode: DeviceMode }) {
  if (mode === 'tablet') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>
  }

  if (mode === 'phone') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
  }

  return <DesktopIcon />
}

function FullscreenIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>
}

function MinimizeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5"/></svg>
}
