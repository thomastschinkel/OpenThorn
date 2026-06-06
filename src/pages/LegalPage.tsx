import styles from './LegalPage.module.css'

interface Props {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalPage({ title, lastUpdated, children }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>Last updated: {lastUpdated}</p>
        </header>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}
