import { useState, useEffect } from 'react'
import { getAnnouncement, type Announcement } from '../../lib/app-config'
import styles from './AnnouncementBanner.module.css'

const DISMISS_KEY = 'openthorn:announcement-dismissed'

/** Stable id so a changed announcement re-appears after a dismissal. */
function announcementId(a: Announcement): string {
  return `${a.text}|${a.link ?? ''}`
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  useEffect(() => {
    let cancelled = false
    getAnnouncement().then((a) => {
      if (cancelled || !a) return
      try {
        if (localStorage.getItem(DISMISS_KEY) === announcementId(a)) return
      } catch { /* storage unavailable — show the banner */ }
      setAnnouncement(a)
    })
    return () => { cancelled = true }
  }, [])

  if (!announcement) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, announcementId(announcement)) } catch { /* ignore */ }
    setAnnouncement(null)
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        {announcement.text}
        {announcement.link && (
          <a className={styles.link} href={announcement.link} target="_blank" rel="noreferrer">
            Learn more
          </a>
        )}
      </span>
      <button className={styles.dismiss} type="button" aria-label="Dismiss announcement" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}
