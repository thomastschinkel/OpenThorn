import { useState, useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import styles from './ChatPanel.module.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const demoMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    text: "Hey! I'm Bloom, your AI coding companion. I can help you build full-stack web applications — describe what you'd like to create and I'll generate it for you.\n\nSwitch between **Plan** mode to sketch out architecture, or **Build** mode to generate working code.\n\nWhat do you want to build today?",
  },
  {
    id: '2',
    role: 'user',
    text: 'Build me a modern landing page for a SaaS startup called "Flowly" — an AI-powered project management tool.',
  },
  {
    id: '3',
    role: 'assistant',
    text: "Great idea! Here's what I built:\n\n✅ **Hero section** with a gradient headline and CTA\n✅ **Features grid** showcasing 6 key capabilities\n✅ **Pricing table** with 3 tiers\n✅ **Testimonials carousel** with 4 customer quotes\n✅ **Footer** with links and newsletter signup\n\nI used a clean dark theme with indigo accents. The layout is fully responsive — check it out in the preview on the right! 👉",
  },
]

export default function ChatPanel() {
  const [messages] = useState<Message[]>(demoMessages)
  const [mode, setMode] = useState<'plan' | 'build'>('build')
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('dark')
  const bottomRef = useRef<HTMLDivElement>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!projectMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProjectMenuOpen(false) }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [projectMenuOpen])

  return (
    <div className={styles.panel}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <div className={styles.projectMenuWrap} ref={projectMenuRef}>
            <button
              className={`${styles.projectBtn} ${projectMenuOpen ? styles.projectBtnOpen : ''}`}
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            >
              <span className={styles.projectName}>Flowly</span>
              <svg className={styles.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {projectMenuOpen && (
              <div className={styles.projectMenu}>
                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  Go to dashboard
                </button>

                <div className={styles.menuDivider} />

                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Settings
                </button>

                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16 M4 12h16 M4 20h16 M8 4v16 M16 4v16"/>
                  </svg>
                  Connectors
                </button>

                <div className={styles.menuDivider} />

                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Rename this project
                </button>

                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Star Project
                </button>

                <button className={styles.projectMenuItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  Details
                </button>

                <div className={styles.menuDivider} />

                <div className={styles.appearanceGroup}>
                  <span className={styles.appearanceLabel}>Appearance</span>
                  <div className={styles.appearanceOptions}>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'light' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('light')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                      Light
                    </button>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'dark' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('dark')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                      Dark
                    </button>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'system' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('system')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      System
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput mode={mode} onToggleMode={setMode} />
    </div>
  )
}
