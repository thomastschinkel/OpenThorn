import { useRef } from 'react'
import { motion } from 'framer-motion'
import styles from './MeetBloomSection.module.css'

const steps = [
  {
    number: '01',
    title: 'Start with an idea',
    description:
      'Describe the app or website you want to create or drop in screenshots and docs — Bloom understands your vision.',
    icon: BulbIcon,
  },
  {
    number: '02',
    title: 'Watch it come to life',
    description:
      'See your vision transform into a working prototype in real-time as AI builds it for you, component by component.',
    icon: EyeIcon,
  },
  {
    number: '03',
    title: 'Refine and ship',
    description:
      'Iterate on your creation with simple feedback and deploy to the world with one click. No DevOps required.',
    icon: RocketIcon,
  },
]

export default function MeetBloomSection() {
  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section className={styles.section} ref={sectionRef}>
      <p className={styles.sectionLabel}>Meet Bloom</p>
      <h2 className={styles.sectionTitle}>From idea to live in minutes</h2>

      <div style={{ position: 'relative', maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className={styles.stepCard}
              initial={{ opacity: 0, y: 40, rotate: i === 0 ? -2 : i === 2 ? 2 : 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: 0.6,
                delay: i * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className={styles.iconWrapper}>
                <div className={styles.iconGlow} />
                <div className={styles.icon}>
                  <step.icon />
                </div>
              </div>
              <span className={styles.stepNumber}>Step {step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.description}</p>
            </motion.div>
          ))}
        </div>

        <svg
          className={styles.connectors}
          style={{
            position: 'absolute',
            top: '35%',
            left: '18%',
            right: '18%',
            width: '64%',
            height: '40px',
            pointerEvents: 'none',
          }}
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="connectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
              <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--color-petal-blue)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <motion.path
            d="M10 20 Q 80 20 80 20 Q 120 20 180 20"
            stroke="url(#connectorGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="200"
            initial={{ strokeDashoffset: 200 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          />
          <motion.path
            d="M220 20 Q 280 20 280 20 Q 320 20 390 20"
            stroke="url(#connectorGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="200"
            initial={{ strokeDashoffset: 200 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
          />
        </svg>
      </div>
    </section>
  )
}

function BulbIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012.81-4.81l.17-.19a22 22 0 013.84 3.84L12 15z" />
      <path d="M13.5 4.5A22 22 0 0019 2s-1.5 4-3 6.5M9 17.5V21l3-3M15 10.5V5l-3 3" />
    </svg>
  )
}
