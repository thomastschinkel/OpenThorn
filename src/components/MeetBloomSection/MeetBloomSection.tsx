import { motion } from 'framer-motion'
import ReelCarousel from '../ReelCarousel/ReelCarousel'
import styles from './MeetBloomSection.module.css'

export default function MeetBloomSection() {
  return (
    <section className={styles.section}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className={styles.kicker}>Meet Bloom</div>
        <h2 className={styles.title}>
          From <span className={styles.titleItalic}>idea</span> to{' '}
          <span className={styles.titleItalic}>live</span> in minutes
        </h2>
      </motion.div>

      <motion.div
        className={styles.carouselWrapper}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.19, 1, 0.22, 1] }}
      >
        <ReelCarousel showDots />
      </motion.div>
    </section>
  )
}
