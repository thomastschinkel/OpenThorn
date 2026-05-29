import { useState, useEffect, useCallback } from 'react'
import { fetchPresets, fetchProviders, createProvider, updateProvider, deleteProvider, testProviderConnection } from '../../lib/providers'
import type { ProviderPreset, ProviderConfig as ProviderConfigType } from '../../lib/providers'
import styles from './ProviderConfig.module.css'

const PRESET_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97706',
  google: '#4285f4',
  groq: '#f97316',
  together: '#6366f1',
  mistral: '#facc15',
}

export default function ProviderConfig() {
  const [presets, setPresets] = useState<ProviderPreset[]>([])
  const [providers, setProviders] = useState<ProviderConfigType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add/Edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLabel, setFormLabel] = useState('')
  const [formPreset, setFormPreset] = useState('custom')
  const [formApiKey, setFormApiKey] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formDefaultModel, setFormDefaultModel] = useState('')
  const [formEnabledModels, setFormEnabledModels] = useState<string[]>([])
  const [showKey, setShowKey] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchPresets(), fetchProviders()])
      setPresets(p)
      setProviders(c)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectedPreset = presets.find((p) => p.provider_key === formPreset)

  function openAdd() {
    setEditingId(null)
    setFormLabel('')
    setFormPreset('openai')
    setFormApiKey('')
    setFormBaseUrl('')
    setFormDefaultModel('')
    setFormEnabledModels([])
    setShowKey(false)
    setTestResult(null)
    setShowForm(true)
  }

  function openEdit(p: ProviderConfigType) {
    setEditingId(p.id)
    setFormLabel(p.label)
    setFormPreset(p.is_custom ? 'custom' : p.provider_key)
    setFormApiKey(p.api_key)
    setFormBaseUrl(p.base_url ?? '')
    setFormDefaultModel(p.default_model ?? '')
    setFormEnabledModels(p.enabled_models ?? [])
    setShowKey(false)
    setTestResult(null)
    setShowForm(true)
  }

  function handlePresetChange(key: string) {
    setFormPreset(key)
    const preset = presets.find((p) => p.provider_key === key)
    if (preset) {
      setFormBaseUrl(preset.base_url)
      if (!formDefaultModel && preset.models.length > 0) {
        setFormDefaultModel(preset.models[0])
      }
    } else {
      setFormBaseUrl('')
      setFormDefaultModel('')
      setFormEnabledModels([])
    }
  }

  function toggleModel(model: string) {
    setFormEnabledModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    )
  }

  async function handleSave() {
    if (!formLabel.trim() || !formApiKey.trim()) return
    setSaving(true)
    try {
      const data = {
        label: formLabel.trim(),
        provider_key: formPreset === 'custom' ? 'custom' : formPreset,
        api_key: formApiKey.trim(),
        base_url: formBaseUrl.trim() || null,
        default_model: formDefaultModel || null,
        enabled_models: formEnabledModels,
        is_custom: formPreset === 'custom',
      }
      if (editingId) {
        await updateProvider(editingId, data)
      } else {
        await createProvider(data)
      }
      setShowForm(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this provider configuration?')) return
    try {
      await deleteProvider(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleTest(id: string, baseUrl: string, apiKey: string, model: string) {
    setTestingId(id)
    setTestResult(null)
    const result = await testProviderConnection(baseUrl, apiKey, model)
    setTestResult(result)
    setTestingId(null)
  }

  const availableModels = formPreset === 'custom' ? [] : (selectedPreset?.models ?? [])

  if (loading) {
    return <div className={styles.container}><p className={styles.loading}>Loading providers…</p></div>
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>Provider Configurations</h2>
          <p className={styles.desc}>Configure AI providers by adding your API keys. Keys are stored securely and used only for your requests.</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Provider
        </button>
      </div>

      {/* Provider list */}
      {providers.length === 0 && !showForm && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
          <span className={styles.emptyTitle}>No providers configured</span>
          <span className={styles.emptyDesc}>Add an API key from OpenAI, Anthropic, or another provider to get started.</span>
        </div>
      )}

      <div className={styles.providerList}>
        {providers.map((p) => {
          const preset = presets.find((pr) => pr.provider_key === p.provider_key)
          const color = PRESET_COLORS[p.provider_key] ?? '#888'
          return (
            <div key={p.id} className={styles.providerCard}>
              <div className={styles.providerCardTop}>
                <div className={styles.providerInfo}>
                  <span className={styles.providerDot} style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
                  <div>
                    <span className={styles.providerLabel}>{p.label}</span>
                    <span className={styles.providerMeta}>
                      {preset?.display_name ?? 'Custom'} · {p.enabled_models.length} model{p.enabled_models.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className={styles.providerActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleTest(p.id, p.base_url ?? preset?.base_url ?? '', p.api_key, p.default_model ?? p.enabled_models[0] ?? '')}
                    disabled={testingId === p.id}
                  >
                    {testingId === p.id ? 'Testing…' : 'Test'}
                  </button>
                  <button className={styles.actionBtn} onClick={() => openEdit(p)}>Edit</button>
                  <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => handleDelete(p.id)}>Remove</button>
                </div>
              </div>
              {p.api_key && (
                <div className={styles.keyRow}>
                  <span className={styles.keyLabel}>API Key</span>
                  <code className={styles.keyValue}>
                    {showKey ? p.api_key : `${p.api_key.slice(0, 8)}${'·'.repeat(24)}`}
                  </code>
                  <button className={styles.toggleKey} onClick={() => setShowKey(!showKey)}>
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}
              {testResult && testingId === p.id && (
                <div className={`${styles.testBanner} ${testResult.ok ? styles.testOk : styles.testFail}`}>
                  {testResult.message}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className={styles.formOverlay}>
          <div className={styles.form}>
            <div className={styles.formHeader}>
              <h3>{editingId ? 'Edit Provider' : 'Add Provider'}</h3>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className={styles.formBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Label</label>
                <input
                  className={styles.fieldInput}
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. My OpenAI Key"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Provider</label>
                <select
                  className={styles.fieldSelect}
                  value={formPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                >
                  {presets.map((pr) => (
                    <option key={pr.provider_key} value={pr.provider_key}>{pr.display_name}</option>
                  ))}
                  <option value="custom">Custom Provider</option>
                </select>
              </div>

              {formPreset === 'custom' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Base URL</label>
                  <input
                    className={styles.fieldInput}
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.fieldLabel}>API Key</label>
                <div className={styles.apiKeyRow}>
                  <input
                    className={styles.fieldInput}
                    type={showKey ? 'text' : 'password'}
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button className={styles.toggleKey} onClick={() => setShowKey(!showKey)}>
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {availableModels.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Models</label>
                  <div className={styles.modelGrid}>
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        className={`${styles.modelChip} ${formEnabledModels.includes(m) ? styles.modelChipOn : ''}`}
                        onClick={() => toggleModel(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formPreset === 'custom' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Default Model Name</label>
                  <input
                    className={styles.fieldInput}
                    value={formDefaultModel}
                    onChange={(e) => setFormDefaultModel(e.target.value)}
                    placeholder="e.g. meta-llama/llama-4-maverick"
                  />
                </div>
              )}

              {formPreset !== 'custom' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Default Model</label>
                  <select
                    className={styles.fieldSelect}
                    value={formDefaultModel}
                    onChange={(e) => setFormDefaultModel(e.target.value)}
                  >
                    <option value="">— Select default —</option>
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.formFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !formLabel.trim() || !formApiKey.trim()}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
