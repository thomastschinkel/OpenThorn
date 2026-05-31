import { useState } from 'react'
import styles from './MobileMenu.module.css'

interface SubItem {
  label: string
  href: string
}

const solutionsSub: SubItem[] = [
  { label: 'Founders', href: '#' },
  { label: 'Sales', href: '#' },
  { label: 'Product Managers', href: '#' },
  { label: 'Designers', href: '#' },
  { label: 'Marketers', href: '#' },
  { label: 'Ops', href: '#' },
  { label: 'People', href: '#' },
]

const useCasesSub: SubItem[] = [
  { label: 'Productivity', href: '#' },
  { label: 'E-Commerce', href: '#' },
  { label: 'Marketing & Sales', href: '#' },
  { label: 'Finance', href: '#' },
  { label: 'HR & Recruitment', href: '#' },
  { label: 'Education', href: '#' },
  { label: 'Health & Wellness', href: '#' },
]

const resourcesSub: SubItem[] = [
  { label: 'Blog', href: '#' },
  { label: 'Templates', href: '#' },
  { label: 'Guides', href: '#' },
  { label: 'Docs & FAQs', href: '#' },
]

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [openSection, setOpenSection] = useState<string | null>(null)

  const toggle = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  const subItems = (section: string): SubItem[] => {
    if (section === 'solutions') return solutionsSub
    if (section === 'useCases') return useCasesSub
    if (section === 'resources') return resourcesSub
    return []
  }

  const sections = [
    { key: 'solutions', label: 'Solutions' },
    { key: 'useCases', label: 'Use Cases' },
    { key: 'resources', label: 'Resources' },
  ]

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <nav className={styles.nav}>
          {sections.map((s) => (
            <div key={s.key}>
              <button
                className={styles.mobileNavItem}
                onClick={() => toggle(s.key)}
              >
                {s.label}
                <svg
                  className={`${styles.chevron} ${openSection === s.key ? styles.chevronOpen : ''}`}
                  viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M3 5l4 4 4-4" />
                </svg>
              </button>
              <div className={`${styles.subItems} ${openSection === s.key ? styles.subItemsOpen : ''}`}>
                {subItems(s.key).map((item) => (
                  <a key={item.label} href={item.href} className={styles.subItem} onClick={onClose}>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <a href="/pricing" className={styles.mobileNavItem} onClick={onClose}>
            Pricing
          </a>
          <a href="https://github.com" className={styles.mobileNavItem} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            GitHub
          </a>
        </nav>

        <div className={styles.actions}>
          <button className={styles.loginMobile} onClick={onClose}>Login</button>
          <button className={styles.ctaMobile} onClick={onClose}>Get Started</button>
        </div>
      </div>
    </>
  )
}
