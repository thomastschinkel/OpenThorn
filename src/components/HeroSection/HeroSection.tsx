import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import FloatingParticles from '../FloatingParticles/FloatingParticles'
import styles from './HeroSection.module.css'

const valueProps = [
  { label: 'Bring your own API keys', detail: 'any provider' },
  { label: 'Pay only for what you use', detail: 'zero platform fees' },
  { label: 'Export your code', detail: 'own your infrastructure' },
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <FloatingParticles
        particleCount={42}
        particleSize={2.5}
        particleOpacity={0.38}
        particleColor="#A78BFA"
        glowIntensity={14}
        movementSpeed={0.35}
        mouseInfluence={140}
        mouseGravity="attract"
        gravityStrength={32}
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

        {/* Value props — clean editorial strip */}
        <motion.div
          className={styles.valueProps}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
        >
          {valueProps.map((prop) => (
            <span key={prop.label} className={styles.valueItem}>
              <span className={styles.valueLabel}>{prop.label}</span>
              <span className={styles.valueDetail}>{prop.detail}</span>
            </span>
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
