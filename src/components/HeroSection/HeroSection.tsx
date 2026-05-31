import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './HeroSection.module.css'

const stagger = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const trustPills = [
  { icon: 'key', text: 'Configure your own API keys' },
  { icon: 'check', text: 'No hidden costs, no ads' },
  { icon: 'shield', text: 'Full control, full privacy' },
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGlow} />
      <div className={styles.bgBlob1} />

      <motion.div
        className={styles.content}
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <motion.h1 className={styles.headline} variants={fadeUp}>
          Build with{' '}
          <span className={styles.headlineGradient}>Bloom</span>
        </motion.h1>

        <motion.p className={styles.subtitle} variants={fadeUp}>
          Create beautiful websites just by talking to AI. Describe what you want
          and watch it come to life — no coding required.
        </motion.p>

        <motion.div className={styles.inputWrapper} variants={fadeUp}>
          <PromptInput />
        </motion.div>

        <motion.div className={styles.trustBar} variants={fadeUp}>
          {trustPills.map((pill) => (
            <div key={pill.text} className={styles.trustPill}>
              <span className={styles.trustIcon} aria-hidden="true">
                {pill.icon === 'key' && <KeyIcon />}
                {pill.icon === 'check' && <CheckIcon />}
                {pill.icon === 'shield' && <ShieldIcon />}
              </span>
              {pill.text}
            </div>
          ))}
        </motion.div>

        <motion.div
          className={styles.scrollIndicator}
          variants={fadeUp}
          aria-hidden="true"
        >
          <div className={styles.scrollDot} />
        </motion.div>
      </motion.div>
    </section>
  )
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
