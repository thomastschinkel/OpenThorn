import { useState } from 'react'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import styles from './ProvidersPage.module.css'

interface ProviderConfig {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  enabled: boolean
  isCustom: boolean
}

interface ProviderDef {
  id: string
  name: string
  defaultBaseUrl: string
  logo: React.ReactNode
  color: string
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    color: '#74AA9C',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21.5 11.5c0 3.8-2.2 7.1-5.5 8.7V18c0-1.7-.8-3.2-2-4.1 1.6-.4 2.8-1.8 2.8-3.6s-1.2-3.2-2.8-3.6c1.3-.9 2-2.4 2-4.1V.3c3.3 1.6 5.5 4.9 5.5 8.7v2.5z" fill="currentColor" opacity="0.9"/>
        <path d="M8 2.5c0 1.7.8 3.2 2 4.1C8.4 7 7.2 8.4 7.2 10.2s1.2 3.2 2.8 3.6c-1.2.9-2 2.4-2 4.1v2.2C4.7 18.6 2.5 15.3 2.5 11.5V9c0-3.8 2.2-7.1 5.5-8.7V2.5z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    color: '#D4A574',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M17.5 10c0 2.5-2 4.5-4.5 4.5H7l3-3H8.5c-2.5 0-4.5-2-4.5-4.5S6 2.5 8.5 2.5h7c2.5 0 4.5 2 4.5 4.5 0 1.3-.5 2.4-1.4 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 14c0-2.5 2-4.5 4.5-4.5H17l-3 3h4.5c2.5 0 4.5 2 4.5 4.5S18 21.5 15.5 21.5h-7c-2.5 0-4.5-2-4.5-4.5 0-1.3.5-2.4 1.4-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'google',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    color: '#4285F4',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M12 2v20M3 7l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    color: '#4D6BFE',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    color: '#F59E0B',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h5v5H4V4zM4 15h5v5H4v-5zM15 4h5v5h-5V4z" fill="currentColor" opacity="0.9"/>
        <path d="M15 15h5v5h-5v-5z" fill="currentColor" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id: 'groq',
    name: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    color: '#F97316',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'together',
    name: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    color: '#6366F1',
    logo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.7"/>
        <circle cx="16" cy="8" r="3" fill="currentColor" opacity="0.9"/>
        <circle cx="12" cy="17" r="3" fill="currentColor" opacity="0.5"/>
        <path d="M9.5 9.5l2 5.5M14.5 9.5l-2 5.5M11 7l2 8" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
      </svg>
    ),
  },
]

function createDefaultConfigs(): ProviderConfig[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    apiKey: '',
    baseUrl: p.defaultBaseUrl,
    enabled: false,
    isCustom: false,
  }))
}

export default function ProvidersPage() {
  const [configs, setConfigs] = useState<ProviderConfig[]>(() => {
    const saved = localStorage.getItem('bloom-providers')
    return saved ? JSON.parse(saved) : createDefaultConfigs()
  })
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  const persist = (newConfigs: ProviderConfig[]) => {
    setConfigs(newConfigs)
    localStorage.setItem('bloom-providers', JSON.stringify(newConfigs))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateProvider = (id: string, updates: Partial<ProviderConfig>) => {
    const newConfigs = configs.map((c) => (c.id === id ? { ...c, ...updates } : c))
    persist(newConfigs)
  }

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const addCustomProvider = () => {
    const id = `custom-${Date.now()}`
    const newConfig: ProviderConfig = {
      id,
      name: '',
      apiKey: '',
      baseUrl: '',
      enabled: false,
      isCustom: true,
    }
    persist([...configs, newConfig])
  }

  const removeCustomProvider = (id: string) => {
    persist(configs.filter((c) => c.id !== id))
  }

  const getProviderDef = (id: string) => PROVIDERS.find((p) => p.id === id)

  return (
    <div className={styles.root}>
      <DashboardSidebar />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>Configure providers</h1>
            <p className={styles.subtitle}>
              Add your API keys to connect Bloom to your preferred LLM providers.
              Keys are stored in your browser's local storage and never leave your device.
            </p>
            <div className={styles.securityNote}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>API keys are stored in localStorage. Make sure your browser and extensions are trusted before adding keys. For production use, consider proxying through a backend.</span>
            </div>
          </div>

          <div className={styles.grid}>
            {configs.map((config) => {
              const def = getProviderDef(config.id)
              const isShown = showKeys[config.id]

              return (
                <div
                  key={config.id}
                  className={`${styles.card} ${config.enabled ? styles.cardActive : ''}`}
                >
                  {/* Provider header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      {config.isCustom ? (
                        <div className={styles.providerLogo} style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                          </svg>
                        </div>
                      ) : def ? (
                        <div className={styles.providerLogo} style={{ background: `${def.color}18`, color: def.color }}>
                          {def.logo}
                        </div>
                      ) : (
                        <div className={styles.providerLogo} style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="2" y="2" width="20" height="20" rx="4"/>
                          </svg>
                        </div>
                      )}

                      {config.isCustom ? (
                        <input
                          className={styles.nameInput}
                          type="text"
                          placeholder="Provider name"
                          value={config.name}
                          onChange={(e) => updateProvider(config.id, { name: e.target.value })}
                        />
                      ) : (
                        <span className={styles.providerName}>{config.name}</span>
                      )}
                    </div>

                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateProvider(config.id, { enabled: e.target.checked })}
                      />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>

                  {/* API key input */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>API key</label>
                      <div className={styles.keyInputWrapper}>
                        <input
                          className={styles.keyInput}
                          type={isShown ? 'text' : 'password'}
                          placeholder="sk-•••••••••••••••••••••••••"
                          value={config.apiKey}
                          onChange={(e) => updateProvider(config.id, { apiKey: e.target.value })}
                        />
                        <button
                          className={styles.keyToggle}
                          onClick={() => toggleKeyVisibility(config.id)}
                          type="button"
                          aria-label={isShown ? 'Hide key' : 'Show key'}
                        >
                          {isShown ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Base URL</label>
                      <input
                        className={styles.urlInput}
                        type="text"
                        placeholder="https://api.example.com/v1"
                        value={config.baseUrl}
                        onChange={(e) => updateProvider(config.id, { baseUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Custom provider remove */}
                  {config.isCustom && (
                    <button className={styles.removeBtn} onClick={() => removeCustomProvider(config.id)} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add custom provider */}
          <button className={styles.addBtn} onClick={addCustomProvider} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add custom provider
          </button>

          {/* Save indicator */}
          {saved && <span className={styles.savedBadge}>✓ Saved</span>}
        </div>
      </main>
    </div>
  )
}
