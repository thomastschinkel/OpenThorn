import type { ReactNode } from 'react'
import { useAuth } from '../../lib/AuthContext'
import styles from './DashboardSidebar.module.css'

interface NavItem {
  label: string
  icon: ReactNode
  active?: boolean
  onClick?: () => void
}

export default function DashboardSidebar() {
  const { user, signOut } = useAuth()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  const navItems: NavItem[] = [
    {
      label: 'Home',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      active: true,
    },
    {
      label: 'Templates',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      label: 'Community Apps',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <a href="/dashboard" className={styles.logo}>
          <img src="/assets/logo.png" alt="Bloom" className={styles.logoImg} />
        </a>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`${styles.navItem} ${item.active ? styles.navItemActive : ''}`}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className={styles.userName}>{firstName}</span>
        </div>
        <button className={styles.signOutBtn} onClick={signOut} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
