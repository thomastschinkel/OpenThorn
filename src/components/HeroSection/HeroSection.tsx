import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import FloatingParticles from '../FloatingParticles/FloatingParticles'
import styles from './HeroSection.module.css'

const valueProps = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
      </svg>
    ),
    title: 'Bring your own keys',
    description: 'Use any AI provider — OpenAI, Anthropic, Google, or your own fine-tuned models.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    title: 'Pay only for usage',
    description: 'Zero platform fees. You only pay your AI provider for what you actually generate.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
    title: 'Export & own it',
    description: 'Download your full codebase. No lock-in, no walled garden — it\'s your infrastructure.',
  },
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <FloatingParticles
        particleCount={70}
        particleSize={3}
        particleOpacity={0.5}
        particleColor="#A78BFA"
        glowIntensity={15}
        movementSpeed={0.4}
        mouseInfluence={140}
        mouseGravity="attract"
        gravityStrength={35}
        glowAnimation="ease"
      />

      <div className={styles.content}>
        {/* Ornament */}
        <motion.div
          className={styles.ornament}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.05 }}
        >
          <span className={styles.ornamentLine} />
          <span className={styles.ornamentDot} />
          <span className={styles.ornamentLine} />
        </motion.div>

        {/* Headline — single line, white, Roboto */}
        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
        >
          Build with Bloom
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.4 }}
        >
          Just describe what you want and Bloom generates the code —
          ready to customize and deploy anywhere.
        </motion.p>

        {/* Big input */}
        <motion.div
          className={styles.inputWrapper}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay: 0.55 }}
        >
          <PromptInput />
        </motion.div>

        {/* Value props */}
        <motion.div
          className={styles.valueProps}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85 }}
        >
          {valueProps.map((prop) => (
            <div key={prop.title} className={styles.valueCard}>
              <div className={styles.valueIcon}>{prop.icon}</div>
              <div className={styles.valueText}>
                <span className={styles.valueTitle}>{prop.title}</span>
                <span className={styles.valueDesc}>{prop.description}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className={styles.scrollHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        aria-hidden="true"
      >
        <div className={styles.scrollHintLine} />
      </motion.div>
    </section>
  )
}
