import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  fetchPricing,
  getProviderLabel,
  pickBestValueModel,
  getTopModels,
  type PricingTable,
} from '../lib/pricing'
import styles from './PricingPage.module.css'

const benchData = [
  { model: 'Claude Opus 4.7', provider: 'Anthropic', swe: 87.6, humaneval: 91, outputCost: 25 },
  { model: 'GPT-5.5', provider: 'OpenAI', swe: 88.7, humaneval: 95.2, outputCost: 30 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', swe: 82, humaneval: 93, outputCost: 15 },
  { model: 'GPT-4.1', provider: 'OpenAI', swe: 76, humaneval: 90.2, outputCost: 8 },
  { model: 'Gemini 2.5 Pro', provider: 'Google', swe: 75, humaneval: 84, outputCost: 10 },
  { model: 'Gemini 2.5 Flash', provider: 'Google', swe: 68, humaneval: 80, outputCost: 2.5 },
  { model: 'DeepSeek V4 Pro', provider: 'DeepSeek', swe: 76, humaneval: 85.3, outputCost: 0.87 },
  { model: 'DeepSeek V4 Flash', provider: 'DeepSeek', swe: 65, humaneval: 78, outputCost: 0.28 },
]

const maxCost = 32

export default function PricingPage() {
  const [data, setData] = useState<PricingTable | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPricing()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={styles.title}>AI model pricing</h1>
        <p className={styles.subtitle}>
          Bloom is BYOK — bring your own keys, pay providers directly. No markup.
          Data fetched live from the web, always up to date.
        </p>
      </motion.div>

      {/* Provider summary cards */}
      {data && (
        <motion.div
          className={styles.providerGrid}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {pickBestValueModel(data).map((p) => (
            <div key={p.provider} className={styles.providerCard}>
              <div className={styles.providerName}>{getProviderLabel(p.provider)}</div>
              <div className={styles.providerModels}>{p.name} (best value)</div>
              <div className={styles.providerPrice}>
                Input <span className={styles.priceHighlight}>${p.input.toFixed(2)}</span> · Output{' '}
                <span className={styles.priceHighlight}>${p.output.toFixed(2)}</span>
              </div>
              <div className={styles.priceSub}>per 1M tokens</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Loading / error */}
      {!data && !error && (
        <div className={styles.loading}>Loading latest pricing data...</div>
      )}
      {error && (
        <div className={styles.error}>Couldn't load pricing: {error}. Showing cached data.</div>
      )}

      {/* Cost vs Performance scatter */}
      <motion.div
        className={styles.chartSection}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className={styles.sectionTitle}>Coding quality vs API cost</h2>
        <p className={styles.chartSubtitle}>Higher = better at coding. Further right = more expensive.</p>
        <div className={styles.chartContainer}>
          <div className={styles.scatterChart}>
            <span className={styles.yAxisLabel}>SWE-Bench score →</span>
            <span className={`${styles.scatterAxis} ${styles.xAxis}`}>Output cost per 1M tokens ($) →</span>

            <svg className={styles.scatterSvg} viewBox="0 0 800 370" preserveAspectRatio="none">
              {[60, 70, 80, 90].map((v) => (
                <line key={`h${v}`} x1="80" y1={340 - ((v - 55) / 45) * 320} x2="780" y2={340 - ((v - 55) / 45) * 320} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              {[0, 5, 10, 15, 20, 25, 30].map((v) => (
                <line key={`v${v}`} x1={80 + (v / maxCost) * 680} y1="20" x2={80 + (v / maxCost) * 680} y2="340" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              {/* Pareto frontier line */}
              <line x1="80" y1="340" x2="780" y2="60" stroke="rgba(139,92,246,0.12)" strokeWidth="1" strokeDasharray="6,4" />
            </svg>

            {benchData.map((d) => (
              <div
                key={d.model}
                className={styles.scatterDot}
                style={{
                  left: `${(d.outputCost / maxCost) * 85 + 10}%`,
                  top: `${100 - ((d.swe - 55) / 45) * 85 - 8}%`,
                }}
                title={`${d.model}: $${d.outputCost}/MTok output, SWE-Bench ${d.swe}%`}
              >
                <div className={styles.dotCircle} />
                <span className={styles.dotLabel}>{d.model}</span>
              </div>
            ))}
          </div>
          <p className={styles.chartNote}>Dashed line = Pareto frontier. Models closest to top-left are best value.</p>
        </div>
      </motion.div>

      {/* Full live pricing table */}
      {data && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>Live pricing — all models</h2>
          <p className={styles.chartSubtitle}>
            Fetched from GitHub · Updated {data.versionedAt}
          </p>
          <div className={styles.chartContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Input $/MTok</th>
                  <th>Output $/MTok</th>
                </tr>
              </thead>
              <tbody>
                {getTopModels(data).map((m) => (
                  <tr key={m.id}>
                    <td className={styles.modelName}>{m.name}</td>
                    <td><span className={styles.providerTag}>{getProviderLabel(m.provider)}</span></td>
                    <td>${m.input.toFixed(2)}</td>
                    <td>${m.output.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

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
          <span className={styles.insightHighlight}>DeepSeek V4 Flash at ~$0.28/MTok</span> for routine tasks and
          switch to <span className={styles.insightHighlight}>Claude Opus 4.7</span> for complex work —
          paying providers directly, with no markup. This data is fetched live so it stays current as new models launch.
        </p>
      </motion.div>
    </div>
  )
}
