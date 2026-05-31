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
    fetchPricing().then(setData).catch((e) => setError(e.message))
    fetchBenchmarks().then(setBenchmarks).catch(() => {})
  }, [])

  const scatterData = benchmarks.filter((b) => b.outputCost > 0)
  const maxCost = Math.max(...scatterData.map((d) => d.outputCost), 5)

  // Chart dimensions
  const xRange = [0, maxCost * 1.1]
  const yRange = [50, 95]

  function xPos(val: number) { return ((val - xRange[0]) / (xRange[1] - xRange[0])) * 100 }
  function yPos(val: number) { return 100 - ((val - yRange[0]) / (yRange[1] - yRange[0])) * 100 }

  const xTicks = [0, 5, 10, 15, 20, 25, 30].filter((t) => t <= xRange[1])
  const yTicks = [55, 65, 75, 85, 95]

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={styles.title}>Model pricing</h1>
        <p className={styles.subtitle}>
          BYOK means you pay providers directly — no markup, no subscription, no hidden fees.
        </p>
      </motion.div>

      {!data && !error && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>Couldn't load pricing. Try again shortly.</div>}

      {/* Scatter chart */}
      {scatterData.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className={styles.sectionTitle}>Coding quality vs cost</h2>
          <p className={styles.chartSubtitle}>
            Higher is better at coding. Further right is more expensive per token.
          </p>

          <div className={styles.chartBox}>
            <div className={styles.chartArea}>
              <span className={styles.yLabel}>SWE-Bench score</span>

              {/* Y-axis tick labels */}
              {yTicks.map((t) => (
                <span key={`y${t}`} className={styles.tickY} style={{ top: `${yPos(t)}%` }}>
                  {t}%
                </span>
              ))}

              {/* Grid lines */}
              {yTicks.map((t) => (
                <div key={`gy${t}`} className={styles.gridLine} style={{ top: `${yPos(t)}%` }} />
              ))}
              {xTicks.map((t) => (
                <div key={`gx${t}`} className={styles.gridLineV} style={{ left: `${xPos(t)}%` }} />
              ))}

              {/* Axes */}
              <div className={`${styles.axisLine} ${styles.axisX}`} />
              <div className={`${styles.axisLine} ${styles.axisY}`} />

              {/* Data dots with permanent labels, anti-overlap */}
              <div className={styles.scatterInner}>
                {(() => {
                  // Sort by x then y to compute offsets
                  const sorted = [...scatterData].sort((a, b) => {
                    if (Math.abs(a.outputCost - b.outputCost) < 3) {
                      return b.sweScore - a.sweScore
                    }
                    return a.outputCost - b.outputCost
                  })

                  // Simple offset: alternate label position for close dots
                  const positions = sorted.map((d, i, arr) => {
                    let offset = 0
                    for (let j = 0; j < i; j++) {
                      const dx = Math.abs(xPos(d.outputCost) - xPos(arr[j].outputCost))
                      const dy = Math.abs(yPos(d.sweScore) - yPos(arr[j].sweScore))
                      if (dx < 12 && dy < 12) {
                        offset = offset === 0 ? -16 : offset > 0 ? 16 : 0
                        break
                      }
                    }
                    return { d, offset }
                  })

                  return positions.map(({ d, offset }) => (
                    <div
                      key={d.model}
                      className={styles.dot}
                      style={{
                        left: `${xPos(d.outputCost)}%`,
                        top: `${yPos(d.sweScore)}%`,
                      }}
                    >
                      <div className={styles.dotCircle} />
                      <span className={styles.dotName} style={offset ? { marginTop: `${8 + Math.abs(offset)}px` } : undefined}>
                        {d.model}
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* X-axis tick labels */}
            <div style={{ position: 'relative', height: 28, marginLeft: 60 }}>
              {xTicks.map((t) => (
                <span key={`x${t}`} className={styles.tickX} style={{ left: `${xPos(t)}%` }}>
                  ${t}
                </span>
              ))}
            </div>

            <p className={styles.xLabel}>Output cost per 1M tokens</p>
          </div>
        </motion.div>
      )}

      {/* Pricing table */}
      {data && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className={styles.sectionTitle}>All flagship models</h2>
          <p className={styles.chartSubtitle}>
            The models worth using. Compare input and output costs per million tokens.
          </p>

          <div className={styles.chartBox} style={{ padding: 0, overflow: 'hidden' }}>
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
                    <td className={styles.price}>${m.input.toFixed(2)}</td>
                    <td className={styles.price}>${m.output.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
