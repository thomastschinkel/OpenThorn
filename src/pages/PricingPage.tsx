import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchPricing, getProviderLabel, getTopModels, type PricingTable } from '../lib/pricing'
import { fetchBenchmarks, type BenchmarkEntry } from '../lib/benchmarks'
import styles from './PricingPage.module.css'

export default function PricingPage() {
  const [data, setData] = useState<PricingTable | null>(null)
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPricing()
      .then(setData)
      .catch((e) => setError(e.message))
    fetchBenchmarks()
      .then(setBenchmarks)
      .catch(() => {})
  }, [])

  const scatterData = benchmarks.filter((b) => b.outputCost > 0)
  const maxCost = Math.max(...scatterData.map((d) => d.outputCost), 5)

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
          Data curated from official sources, always up to date.
        </p>
      </motion.div>

      {!data && !error && <div className={styles.loading}>Loading latest data...</div>}
      {error && <div className={styles.error}>Couldn't load pricing. Try again shortly.</div>}

      {/* Coding quality vs cost scatter chart */}
      {scatterData.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className={styles.sectionTitle}>Coding quality vs API cost</h2>
          <p className={styles.chartSubtitle}>
            Higher = better at coding (SWE-Bench). Further right = more expensive per token.
          </p>
          <div className={styles.chartContainer}>
            <div className={styles.scatterChart}>
              <span className={styles.yAxisLabel}>SWE-Bench (%) →</span>
              <span className={`${styles.scatterAxis} ${styles.xAxis}`}>Output $ per 1M tokens →</span>

              <svg className={styles.scatterSvg} viewBox="0 0 800 370" preserveAspectRatio="none">
                {[60, 70, 80, 90].map((v) => (
                  <line key={`h${v}`} x1="80" y1={340 - ((v - 55) / 40) * 300} x2="780" y2={340 - ((v - 55) / 40) * 300} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}
                {[0, 5, 10, 15, 20, 25, 30].map((v) => (
                  <line key={`v${v}`} x1={80 + (v / maxCost) * 680} y1="20" x2={80 + (v / maxCost) * 680} y2="340" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}
              </svg>

              {scatterData.map((d) => (
                <div
                  key={d.model}
                  className={styles.scatterDot}
                  style={{
                    left: `${(d.outputCost / maxCost) * 85 + 10}%`,
                    top: `${100 - ((d.sweScore - 55) / 40) * 85 - 8}%`,
                  }}
                  title={`${d.model} (${d.provider}): $${d.outputCost}/MTok, SWE-Bench ${d.sweScore}%`}
                >
                  <div className={styles.dotCircle} />
                  <span className={styles.dotLabel}>{d.model}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Flagship pricing table */}
      {data && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className={styles.sectionTitle}>Flagship model pricing</h2>
          <p className={styles.chartSubtitle}>
            The models you actually want. Fetched live · Updated {data.versionedAt}.
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

      <motion.div
        className={styles.insight}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className={styles.insightTitle}>What this means for you</div>
        <p className={styles.insightText}>
          Use <span className={styles.insightHighlight}>Claude Opus 4.7 or GPT-5.5</span> for complex work,
          switch to <span className={styles.insightHighlight}>Gemini 2.5 Flash or DeepSeek V4</span> for routine tasks.
          With Bloom, you bring your own keys — paying providers directly, zero markup.
        </p>
      </motion.div>
    </div>
  )
}
