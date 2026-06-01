import { type FormEvent, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import styles from './PromptInput.module.css'

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */

interface PromptInputProps {
  size?: 'default' | 'small'
  defaultValue?: string
  onSubmit?: (prompt: string) => void
}

interface Model {
  name: string
  id: string
}

interface ProviderKey {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string
  models: string
  enabled: boolean
  is_custom: boolean
}

interface SelectedModel {
  name: string
  id: string
  providerId: string
  providerName: string
}

/* ───────────────────────────────────────────
   Constants
   ─────────────────────────────────────────── */

const PROVIDER_INFO: Record<string, { name: string; logo: string }> = {
  openai:    { name: 'OpenAI',        logo: '/assets/openai.png' },
  anthropic: { name: 'Anthropic',     logo: '/assets/anthropic.png' },
  google:    { name: 'Google Gemini', logo: '/assets/google.png' },
  deepseek:  { name: 'DeepSeek',      logo: '/assets/deepseek.webp' },
  mistral:   { name: 'Mistral AI',    logo: '/assets/mistralai.png' },
  groq:      { name: 'Groq',          logo: '/assets/groq.png' },
  together:  { name: 'Together AI',   logo: '/assets/togetherai.png' },
}

const STATIC_DEFAULT_MODELS: Record<string, Model[]> = {
  anthropic: [
    { name: 'Claude Sonnet 4',   id: 'claude-sonnet-4-20250514' },
    { name: 'Claude Haiku 4',    id: 'claude-haiku-4-20250514' },
  ],
  openai: [
    { name: 'GPT-4o',            id: 'gpt-4o' },
    { name: 'GPT-4o-mini',       id: 'gpt-4o-mini' },
  ],
  google: [
    { name: 'Gemini 2.5 Pro',   id: 'gemini-2.5-pro-preview-03-25' },
    { name: 'Gemini 2.0 Flash', id: 'gemini-2.0-flash' },
  ],
}

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

const parseModels = (raw: string): Model[] => {
  return raw
    .split(',')
    .map((m) => {
      const [name, id] = m.split('|').map((s) => s.trim())
      return { name: name || id || '', id: id || name || '' }
    })
    .filter((m) => m.id)
}

/* ───────────────────────────────────────────
   Typing animation (unchanged)
   ─────────────────────────────────────────── */

const typingPrompts = [
  'Design a portfolio with a dark, cinematic feel…',
  'Build a waitlist landing page for my SaaS idea…',
  'Create a custom dashboard for tracking team metrics…',
  'Make a marketplace with search, filters, and checkout…',
  'Build a blog that feels like a magazine…',
  'Create a booking page for a local service business…',
]

function useTypingAnimation(active: boolean) {
  const [displayText, setDisplayText] = useState('')
  const stateRef = useRef({
    promptIndex: 0,
    charIndex: 0,
    isDeleting: false,
    active: false,
  })

  stateRef.current.active = active

  useEffect(() => {
    if (!active) {
      setDisplayText('')
      return
    }

    let timeout: ReturnType<typeof setTimeout>

    const tick = () => {
      if (!stateRef.current.active) return

      const s = stateRef.current
      const currentPrompt = typingPrompts[s.promptIndex]

      if (!s.isDeleting) {
        if (s.charIndex < currentPrompt.length) {
          s.charIndex++
          setDisplayText(currentPrompt.slice(0, s.charIndex))
          timeout = setTimeout(tick, 40 + Math.random() * 30)
        } else {
          timeout = setTimeout(() => {
            if (!stateRef.current.active) return
            stateRef.current.isDeleting = true
            tick()
          }, 2200)
        }
      } else {
        if (s.charIndex > 0) {
          s.charIndex--
          setDisplayText(currentPrompt.slice(0, s.charIndex))
          timeout = setTimeout(tick, 20 + Math.random() * 15)
        } else {
          stateRef.current.isDeleting = false
          stateRef.current.promptIndex =
            (s.promptIndex + 1) % typingPrompts.length
          stateRef.current.charIndex = 0
          timeout = setTimeout(tick, 300)
        }
      }
    }

    timeout = setTimeout(tick, 300)
    return () => clearTimeout(timeout)
  }, [active])

  return displayText
}

/* ───────────────────────────────────────────
   Main component
   ─────────────────────────────────────────── */

export default function PromptInput({
  size = 'default',
  defaultValue,
  onSubmit,
}: PromptInputProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---- Input state ---- */
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [isFocused, setIsFocused] = useState(false)

  /* ---- Model selector state ---- */
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(
    null,
  )
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [savedProviders, setSavedProviders] = useState<ProviderKey[]>([])
  const [defaultModels, setDefaultModels] = useState<
    Record<string, Model[]>
  >({})
  const [modelsLoading, setModelsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  /* ── Sync defaultValue ── */
  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue])

  /* ── Auto-resize textarea ── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [internalValue, autoResize])

  /* ── Fetch default_models ── */
  useEffect(() => {
    supabase
      .from('default_models')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, Model[]> = {}
          data.forEach(
            (d: { provider_id: string; models: string }) => {
              map[d.provider_id] = parseModels(d.models)
            },
          )
          setDefaultModels(map)
        }
        setModelsLoading(false)
      })
  }, [])

  /* ── Fetch provider_keys when logged in ── */
  useEffect(() => {
    if (!user) {
      setSavedProviders([])
      return
    }
    supabase
      .from('provider_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data, error }) => {
        if (!error && data) setSavedProviders(data)
      })
  }, [user])

  /* ── Close overlay on outside click ── */
  useEffect(() => {
    if (!overlayOpen) return
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setOverlayOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [overlayOpen])

  /* ── Keyboard: Escape closes overlay ── */
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlayOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  /* ── Typing animation ── */
  const showTyping = !isFocused && internalValue.length === 0
  const activeTyping = useTypingAnimation(showTyping)

  /* ── Handle textarea ── */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalValue(e.target.value)
  }

  /* ── Handle form submit ── */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const prompt = internalValue.trim() || activeTyping || undefined

    if (onSubmit && prompt) {
      onSubmit(prompt)
      return
    }

    if (!user) {
      window.dispatchEvent(new CustomEvent('bloom:require-auth'))
    } else {
      navigate('/dashboard')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  /* ── Upload ── */
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // TODO: implement file upload
      console.log('File selected:', file.name)
    }
    // Reset so the same file can be picked again
    e.target.value = ''
  }

  /* ── Model selection ── */
  const handleModelSelect = (model: Model, providerId: string) => {
    const info = PROVIDER_INFO[providerId]
    setSelectedModel({
      name: model.name,
      id: model.id,
      providerId,
      providerName: info?.name ?? providerId,
    })
    setOverlayOpen(false)
  }

  const handleRemoveModel = () => {
    setSelectedModel(null)
  }

  /* ── Derived values ── */

  // Enabled providers (authenticated) or static providers (unauthenticated)
  const enabledProviders = user
    ? savedProviders.filter((p) => p.enabled)
    : []

  // Build the provider list for the overlay
  const overlayProviders = useMemo(() => {
    if (user && enabledProviders.length > 0) {
      return enabledProviders.map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo: PROVIDER_INFO[p.provider_id]?.logo ?? null,
        models: [
          ...(defaultModels[p.provider_id] || []),
          ...(p.models ? parseModels(p.models) : []),
        ],
      }))
    }
    // Unauthenticated fallback: show the big three
    return Object.entries(STATIC_DEFAULT_MODELS).map(
      ([id, models]) => ({
        id,
        name: PROVIDER_INFO[id]?.name ?? id,
        logo: PROVIDER_INFO[id]?.logo ?? null,
        models,
      }),
    )
  }, [user, enabledProviders, defaultModels])

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div
        className={`${styles.card} ${isFocused ? styles.cardFocused : ''}`}
      >
        {/* ── Row 1: input controls ── */}
        <div className={styles.inputArea}>
          {/* Upload button */}
          <div className={styles.uploadWrap}>
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={handleUploadClick}
              aria-label="Upload file"
              tabIndex={-1}
              title="Upload File"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              onChange={handleFileChange}
              tabIndex={-1}
            />
          </div>

          {/* Model selector */}
          <div className={styles.modelSelectorWrap}>
            <button
              type="button"
              className={`${styles.modelBtn} ${overlayOpen ? styles.modelBtnOpen : ''}`}
              onClick={() => setOverlayOpen(!overlayOpen)}
            >
              {selectedModel ? (
                <span className={styles.modelBtnSelected}>
                  <span className={styles.modelTag}>
                    {selectedModel.name}
                    <button
                      type="button"
                      className={styles.modelTagRemove}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveModel()
                      }}
                      aria-label="Remove model"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                </span>
              ) : (
                <span className={styles.modelBtnDefault}>
                  {modelsLoading && user ? (
                    'Loading…'
                  ) : (
                    <>
                      {user && enabledProviders.length > 0 ? (
                        <span className={styles.modelBtnProviders}>
                          {enabledProviders.slice(0, 4).map((p) => (
                            <span key={p.provider_id} className={styles.modelBtnProviderIcon}>
                              {PROVIDER_INFO[p.provider_id]?.logo ? (
                                <img
                                  src={PROVIDER_INFO[p.provider_id].logo}
                                  alt={p.provider_name}
                                  className={styles.modelBtnProviderLogo}
                                />
                              ) : (
                                <span className={styles.modelBtnProviderPlaceholder}>
                                  {p.provider_name.charAt(0)}
                                </span>
                              )}
                            </span>
                          ))}
                          <span className={styles.modelBtnProviderNames}>
                            {enabledProviders
                              .slice(0, 3)
                              .map((p) => p.provider_name)
                              .join(', ')}
                            {enabledProviders.length > 3
                              ? ` +${enabledProviders.length - 3}`
                              : ''}
                          </span>
                        </span>
                      ) : (
                        'Claude · GPT-4o · Gemini'
                      )}
                    </>
                  )}
                </span>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={`${styles.modelBtnArrow} ${overlayOpen ? styles.modelBtnArrowUp : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Textarea */}
          <div className={styles.textareaWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={internalValue}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={1}
              aria-label="Describe your website idea"
            />
            {!internalValue && !isFocused && (
              <span className={styles.typingPlaceholder} aria-hidden="true">
                {activeTyping}
                <span className={styles.cursor} />
              </span>
            )}
          </div>

          {/* Send button */}
          <motion.button
            type="submit"
            className={styles.submitBtn}
            whileTap={{ scale: 0.95 }}
            aria-label="Send"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* ── Model overlay ── */}
      <AnimatePresence>
        {overlayOpen && (
          <>
            <div
              className={styles.overlayBackdrop}
              onClick={() => setOverlayOpen(false)}
            />
            <motion.div
              ref={overlayRef}
              className={styles.overlay}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
            >
              <div className={styles.overlayHeader}>
                <span>Select a model</span>
                <button
                  type="button"
                  className={styles.overlayClose}
                  onClick={() => setOverlayOpen(false)}
                  aria-label="Close"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className={styles.overlayBody}>
                {overlayProviders.length === 0 && !modelsLoading && (
                  <div className={styles.overlayEmpty}>
                    {user
                      ? 'No providers configured. Go to Providers to add one.'
                      : 'No models available.'}
                  </div>
                )}

                {overlayProviders.map((provider) => {
                  if (provider.models.length === 0) return null
                  const isActive = activeTab === provider.id

                  return (
                    <div key={provider.id} className={styles.overlayProvider}>
                      <button
                        type="button"
                        className={`${styles.overlayProviderHeader} ${isActive ? styles.overlayProviderHeaderActive : ''}`}
                        onClick={() =>
                          setActiveTab(
                            isActive ? null : provider.id,
                          )
                        }
                      >
                        <span className={styles.overlayProviderInfo}>
                          {provider.logo ? (
                            <img
                              src={provider.logo}
                              alt={provider.name}
                              className={styles.overlayProviderLogo}
                            />
                          ) : (
                            <span className={styles.overlayProviderLogoPlaceholder}>
                              {provider.name.charAt(0)}
                            </span>
                          )}
                          <span>{provider.name}</span>
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className={`${styles.overlayChevron} ${isActive ? styles.overlayChevronUp : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            className={styles.overlayModels}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            {provider.models.map((m) => {
                              const isSelected =
                                selectedModel?.id === m.id &&
                                selectedModel?.providerId ===
                                  provider.id
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={`${styles.overlayModelItem} ${isSelected ? styles.overlayModelItemActive : ''}`}
                                  onClick={() =>
                                    handleModelSelect(
                                      m,
                                      provider.id,
                                    )
                                  }
                                >
                                  <span className={styles.overlayModelName}>
                                    {m.name}
                                  </span>
                                  <span className={styles.overlayModelId}>
                                    {m.id}
                                  </span>
                                  {isSelected && (
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="var(--color-accent)"
                                      strokeWidth="2.5"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </form>
  )
}
