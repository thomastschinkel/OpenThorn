import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './BottomCTA.module.css'

export default function BottomCTA() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGlow} />
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className={styles.title}>Ready to build something great?</h2>
        <p className={styles.subtitle}>Start building now — no credit card required.</p>
        <div className={styles.inputWrapper}>
          <PromptInput size="small" />
        </div>
      </motion.div>
    </section>
  )
}
