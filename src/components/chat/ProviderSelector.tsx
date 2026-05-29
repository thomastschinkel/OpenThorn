import { useState, useEffect, useRef } from 'react'
import { fetchProviders, type ProviderConfig } from '../../lib/providers'
import styles from './ProviderSelector.module.css'

interface Props {
  selectedProviderId: string | null
  selectedModel: string | null
  onSelect: (providerId: string, model: string) => void
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f', anthropic: '#d97706', google: '#4285f4',
  groq: '#f97316', together: '#6366f1', mistral: '#facc15',
}

export default function ProviderSelector({ selectedProviderId, selectedModel, onSelect }: Props) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [open])

  const active = providers.find((p) => p.id === selectedProviderId)

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title="Select provider & model">
        {active ? (
          <>
            <span
              className={styles.dot}
              style={{ background: PROVIDER_COLORS[active.provider_key] ?? '#888' }}
            />
            <span className={styles.providerName}>{active.label}</span>
            <span className={styles.modelName}>{selectedModel ?? '—'}</span>
          </>
        ) : (
          <span className={styles.placeholder}>No provider</span>
        )}
        <svg className={styles.chevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className={styles.menu}>
          {providers.length === 0 && (
            <div className={styles.empty}>No providers configured. Go to Settings → Provider Config to add one.</div>
          )}
          {providers.map((p) => (
            <div key={p.id} className={styles.providerBlock}>
              <div className={styles.providerHeader}>
                <span className={styles.dot} style={{ background: PROVIDER_COLORS[p.provider_key] ?? '#888' }} />
                <span className={styles.providerLabel}>{p.label}</span>
              </div>
              <div className={styles.modelList}>
                {p.enabled_models.map((m) => (
                  <button
                    key={m}
                    className={`${styles.modelItem} ${selectedProviderId === p.id && selectedModel === m ? styles.modelActive : ''}`}
                    onClick={() => { onSelect(p.id, m); setOpen(false) }}
                  >
                    {m}
                    {selectedProviderId === p.id && selectedModel === m && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
