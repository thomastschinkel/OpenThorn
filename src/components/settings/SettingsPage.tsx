import { useState } from 'react'
import styles from './SettingsPage.module.css'

interface NavItem {
  label: string
  icon: string
  section?: string
}

const sidebarNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Account',
    items: [
      { label: 'Your Account', icon: 'user' },
      { label: 'Devices & Apps', icon: 'devices' },
    ],
  },
  {
    title: 'Project',
    items: [
      { label: 'General', icon: 'general' },
      { label: 'Git', icon: 'git' },
      { label: 'Domains', icon: 'domains' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'General', icon: 'general', section: 'workspace' },
      { label: 'Provider Config', icon: 'provider' },
    ],
  },
  {
    title: 'Members & Access',
    items: [
      { label: 'People', icon: 'people' },
    ],
  },
  {
    title: 'Customization',
    items: [
      { label: 'Knowledge', icon: 'knowledge' },
      { label: 'Skills', icon: 'skills' },
      { label: 'Templates', icon: 'templates' },
    ],
  },
  {
    title: 'Build & Deploy',
    items: [
      { label: 'Workspace domains', icon: 'deploy' },
    ],
  },
  {
    title: 'Security & Compliance',
    items: [
      { label: 'Privacy & Security', icon: 'security' },
      { label: 'Security Center', icon: 'shield' },
    ],
  },
]

function iconPath(name: string): string {
  const paths: Record<string, string> = {
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    devices: 'M18 20V10 M12 20V4 M6 20v-6 M2 20h20',
    general: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    git: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4 M9 18c-4.51 2-5-2-7-2',
    domains: 'M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
    provider: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    people: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    knowledge: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    skills: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    templates: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    deploy: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    security: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  }
  return paths[name] ?? paths.general
}

interface Props {
  onBack: () => void
}

export default function SettingsPage({ onBack }: Props) {
  const [activeItem, setActiveItem] = useState('Your Account')

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.backBtn} onClick={onBack} title="Back to Bloom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <span className={styles.sidebarTitle}>Settings</span>
        </div>

        <nav className={styles.nav}>
          {sidebarNav.map((section) => (
            <div key={section.title} className={styles.navSection}>
              <div className={styles.navSectionTitle}>{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  className={`${styles.navItem} ${activeItem === item.label ? styles.navItemActive : ''}`}
                  onClick={() => setActiveItem(item.label)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={iconPath(item.icon)} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.workspaceBadge}>
            <span className={styles.workspaceDot} />
            <span>Bloom Workspace</span>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className={styles.content}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>{activeItem}</h1>
          <p className={styles.contentDesc}>
            {activeItem === 'Your Account' && 'Manage your personal account details, email, and profile.'}
            {activeItem === 'Devices & Apps' && 'View and manage connected devices and third-party applications.'}
            {activeItem === 'General' && 'Configure general project settings and preferences.'}
            {activeItem === 'Git' && 'Connect and manage your Git repositories.'}
            {activeItem === 'Domains' && 'Manage custom domains for your projects.'}
            {activeItem === 'Provider Config' && 'Configure your AI provider API keys and endpoints.'}
            {activeItem === 'People' && 'Manage workspace members and their access levels.'}
            {activeItem === 'Knowledge' && 'Upload and manage knowledge sources for AI context.'}
            {activeItem === 'Skills' && 'Create and manage custom AI skills.'}
            {activeItem === 'Templates' && 'Manage your project templates and starters.'}
            {activeItem === 'Workspace domains' && 'Configure deployment domains for your workspace.'}
            {activeItem === 'Privacy & Security' && 'Manage privacy settings and security configurations.'}
            {activeItem === 'Security Center' && 'View security alerts, audit logs, and compliance reports.'}
          </p>
        </div>

        <div className={styles.contentBody}>
          <div className={styles.placeholderCard}>
            <div className={styles.placeholderIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath(sidebarNav.flatMap(s => s.items).find(i => i.label === activeItem)?.icon ?? 'general')} />
              </svg>
            </div>
            <h2 className={styles.placeholderTitle}>{activeItem} settings</h2>
            <p className={styles.placeholderText}>
              This section will contain the configuration options for {activeItem.toLowerCase()}.
              It is not yet implemented.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
