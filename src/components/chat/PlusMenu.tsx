import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../App'
import styles from './PlusMenu.module.css'

interface MenuItem {
  label: string
  icon: string
  shortcut?: string
}

const groups: MenuItem[][] = [
  [
    { label: 'Settings', icon: 'settings' },
  ],
  [
    { label: 'Configure Providers', icon: 'providers' },
  ],
  [
    { label: 'History', icon: 'history' },
    { label: 'GitHub', icon: 'github' },
    { label: 'GitLab', icon: 'gitlab' },
    { label: 'Connectors', icon: 'connectors' },
  ],
  [
    { label: 'Take Screenshot', icon: 'screenshot', shortcut: '⌘S' },
    { label: 'Add Reference', icon: 'reference' },
    { label: 'Add Skill', icon: 'skill' },
    { label: 'Attach File', icon: 'attach' },
  ],
]

function iconPath(name: string): string {
  const paths: Record<string, string> = {
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1.08 1.57V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.68 15a1.7 1.7 0 0 0-1.57-1.08H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.68 9a1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.68a1.7 1.7 0 0 0 1.08-1.57V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.08 1.57 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.57 1.08H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.57 1.08z',
    providers: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    history: 'M1 12a11 11 0 1 0 22 0 11 11 0 0 0-22 0z M12 6v6l4 2',
    github: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4 M9 18c-4.51 2-5-2-7-2',
    gitlab: 'M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z',
    connectors: 'M4 4h16 M4 12h16 M4 20h16 M8 4v16 M16 4v16',
    screenshot: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z M8 8l8 8 M8 16l8-8',
    reference: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    skill: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    attach: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  }
  return paths[name] ?? ''
}

export default function PlusMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { navigateTo } = useApp()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        className={`${styles.trigger} ${open ? styles.active : ''}`}
        onClick={() => setOpen(!open)}
        title="More options"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {open && (
        <div className={styles.menu}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className={styles.divider} />}
              {group.map((item) => (
                <button
                  key={item.label}
                  className={styles.item}
                  onClick={() => {
                    if (item.label === 'Settings' || item.label === 'Configure Providers') {
                      setOpen(false)
                      navigateTo('settings')
                    }
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={iconPath(item.icon)} />
                  </svg>
                  <span className={styles.label}>{item.label}</span>
                  {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
