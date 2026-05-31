import { motion } from 'framer-motion'
import styles from './PricingPage.module.css'

const providers = [
  { name: 'Anthropic', models: 'Opus 4.7 · Sonnet 4.6 · Haiku 4.5', price: '$1–$25/MTok', highlight: '$3/15MTok (Sonnet)' },
  { name: 'OpenAI', models: 'GPT-5.5 · GPT-4.1 · GPT-4.1-mini', price: '$0.10–$30/MTok', highlight: '$0.40/1.60MTok (mini)' },
  { name: 'Google', models: 'Gemini 3.1 Pro · 2.5 Pro · 2.5 Flash', price: '$0.10–$12/MTok', highlight: '$0.30/2.50MTok (Flash)' },
  { name: 'DeepSeek', models: 'V4 Pro · V4 Flash', price: '$0.14–$0.87/MTok', highlight: '$0.14/0.28MTok (Flash)' },
]

const benchData = [
  { model: 'Claude Opus 4.7', provider: 'Anthropic', swe: 87.6, humaneval: 91, cost: 25 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', swe: 82, humaneval: 93, cost: 15 },
  { model: 'GPT-5.5', provider: 'OpenAI', swe: 88.7, humaneval: 95.2, cost: 30 },
  { model: 'GPT-4.1', provider: 'OpenAI', swe: 76, humaneval: 90.2, cost: 8 },
  { model: 'Gemini 2.5 Pro', provider: 'Google', swe: 75, humaneval: 84, cost: 10 },
  { model: 'Gemini 2.5 Flash', provider: 'Google', swe: 68, humaneval: 80, cost: 2.5 },
  { model: 'DeepSeek V4 Pro', provider: 'DeepSeek', swe: 76, humaneval: 85.3, cost: 0.87 },
  { model: 'DeepSeek V4 Flash', provider: 'DeepSeek', swe: 65, humaneval: 78, cost: 0.28 },
]

// Normalize values for the scatter chart
const maxSwe = 100
const maxCost = 32

const costPerfData = [
  { model: 'GPT-5.5', cost: 30, swe: 88.7 },
  { model: 'Claude Opus 4.7', cost: 25, swe: 87.6 },
  { model: 'Claude Sonnet 4.6', cost: 15, swe: 82 },
  { model: 'GPT-4.1', cost: 8, swe: 76 },
  { model: 'DeepSeek V4 Pro', cost: 0.87, swe: 76 },
  { model: 'Gemini 2.5 Pro', cost: 10, swe: 75 },
  { model: 'Gemini 2.5 Flash', cost: 2.5, swe: 68 },
  { model: 'DeepSeek V4 Flash', cost: 0.28, swe: 65 },
]

export default function PricingPage() {
  return (
    <div className={styles.page}>
      {/* Header */}
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={styles.title}>AI model pricing</h1>
        <p className={styles.subtitle}>
          Bloom is BYOK — you bring your own API keys and pay providers directly. No markup, no hidden fees.
          Here's what each provider charges.
        </p>
      </motion.div>

      {/* Provider overview cards */}
      <motion.div
        className={styles.providerGrid}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {providers.map((p) => (
          <div key={p.name} className={styles.providerCard}>
            <div className={styles.providerName}>{p.name}</div>
            <div className={styles.providerModels}>{p.models}</div>
            <div className={styles.providerPrice}>{p.price}</div>
            <div className={styles.priceHighlight}>{p.highlight}</div>
          </div>
        ))}
      </motion.div>

      {/* Cost vs Coding Performance scatter chart */}
      <motion.div
        className={styles.chartSection}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className={styles.sectionTitle}>Coding quality vs API cost</h2>
        <div className={styles.chartContainer}>
          <div className={styles.scatterChart}>
            <span className={styles.yAxisLabel}>SWE-Bench score →</span>
            <span className={`${styles.scatterAxis} ${styles.xAxis}`}>Output cost per 1M tokens →</span>

            {/* Grid lines */}
            <svg className={styles.scatterSvg} viewBox="0 0 800 370" preserveAspectRatio="none">
              {[0, 20, 40, 60, 80].map((v) => (
                <line key={`h${v}`} x1="80" y1={340 - (v / 100) * 320} x2="780" y2={340 - (v / 100) * 320} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              {[0, 5, 10, 15, 20, 25, 30].map((v) => (
                <line key={`v${v}`} x1={80 + (v / maxCost) * 680} y1="20" x2={80 + (v / maxCost) * 680} y2="340" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
            </svg>

            {costPerfData.map((d) => (
              <div
                key={d.model}
                className={styles.scatterDot}
                style={{
                  left: `${(d.cost / maxCost) * 85 + 10}%`,
                  top: `${100 - (d.swe / maxSwe) * 85 - 8}%`,
                }}
                title={`${d.model}: $${d.cost}/MTok, SWE-Bench ${d.swe}%`}
              >
                <div className={styles.dotCircle} />
                <span className={styles.dotLabel}>{d.model}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Detailed comparison table */}
      <motion.div
        className={styles.chartSection}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className={styles.sectionTitle}>Full model comparison</h2>
        <div className={styles.chartContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>SWE-Bench</th>
                <th>HumanEval</th>
                <th>Output $/MTok</th>
              </tr>
            </thead>
            <tbody>
              {benchData.map((m) => (
                <tr key={m.model}>
                  <td className={styles.modelName}>{m.model}</td>
                  <td><span className={styles.providerTag}>{m.provider}</span></td>
                  <td>{m.swe}%</td>
                  <td>{m.humaneval}%</td>
                  <td>${m.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Insight */}
      <motion.div
        className={styles.insight}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className={styles.insightTitle}>What this means for you</div>
        <p className={styles.insightText}>
          With Bloom's BYOK model, you can use{' '}
          <span className={styles.insightHighlight}>DeepSeek V4 Flash at $0.28/MTok</span> for routine tasks and
          switch to <span className={styles.insightHighlight}>Claude Opus 4.7</span> for complex refactoring —
          paying providers directly, with no platform markup. Lovable and Base44 charge flat subscriptions
          that hide these costs. With Bloom, <span className={styles.insightHighlight}>you control your spend.</span>
        </p>
      </motion.div>
    </div>
  )
}
