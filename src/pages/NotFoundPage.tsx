import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <img src="/assets/logo.png" alt="OpenThorn" className={styles.logo} />
        <span className={styles.code} aria-hidden="true">404</span>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.message}>
          We couldn't find that page. It might have moved, or the URL might be incorrect.
        </p>
        <Link to="/" className={styles.button}>
          Back to OpenThorn
        </Link>
      </div>
    </div>
  )
}
