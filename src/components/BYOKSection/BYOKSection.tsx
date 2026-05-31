import { motion } from 'framer-motion'
import styles from './BYOKSection.module.css'

const features = [
  {
    title: 'Bring your own API keys',
    description: 'Connect OpenAI, Anthropic, Google, or any provider. Use the models you already pay for.',
    icon: KeyCardIcon,
  },
  {
    title: 'Zero platform markup',
    description: 'Unlike other tools, Bloom never charges a premium on your API usage. You pay exactly what the provider charges.',
    icon: ZeroIcon,
  },
  {
    title: 'Full data privacy',
    description: 'Your API keys, your data, your control. Nothing runs through our servers — everything happens in your browser.',
    icon: PrivacyIcon,
  },
]

export default function BYOKSection() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className={styles.sectionTitle}>Your keys, your control</h2>
          <p className={styles.sectionBody}>
            Unlike{' '}
            <span className={styles.highlight}>Lovable</span> or{' '}
            <span className={styles.highlight}>Base44</span>, Bloom doesn't lock
            you into a subscription. Configure your own API keys from any provider
            and pay only for what you use.{' '}
            <span className={styles.highlight}>No markup, no ads, no hidden costs.</span>
          </p>
        </motion.div>

        <div className={styles.cards}>
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className={styles.card}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.5,
                delay: i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className={styles.cardIcon}>
                <feature.icon />
              </div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDesc}>{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <p className={styles.marketPosition}>
          Bloom is the only AI website builder that puts you in control of your stack.
        </p>
      </div>
    </section>
  )
}

function KeyCardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function ZeroIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}

function PrivacyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
