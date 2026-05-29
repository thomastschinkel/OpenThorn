import { useState } from 'react'
import PlusMenu from './PlusMenu'
import styles from './ChatInput.module.css'

interface Props {
  mode: 'plan' | 'build'
  onToggleMode: (m: 'plan' | 'build') => void
}

export default function ChatInput({ mode, onToggleMode }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)

  return (
    <div className={styles.wrapper}>
      {/* Mode Toggle */}
      <div className={styles.toggleRow}>
        <div className={styles.pill}>
          <button
            className={`${styles.pillBtn} ${mode === 'plan' ? styles.pillActive : ''}`}
            onClick={() => onToggleMode('plan')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Plan
          </button>
          <button
            className={`${styles.pillBtn} ${mode === 'build' ? styles.pillActive : ''}`}
            onClick={() => onToggleMode('build')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Build
          </button>
        </div>
      </div>

      {/* Input Row */}
      <div className={styles.inputRow}>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder={mode === 'plan' ? 'Describe your plan...' : 'Describe what you want to build...'}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // send logic here later
                setText('')
              }
            }}
          />

          <div className={styles.actions}>
            <PlusMenu />

            <div className={styles.divider} />

            <button
              className={`${styles.voiceBtn} ${listening ? styles.listening : ''}`}
              onClick={() => setListening(!listening)}
              title="Voice input"
            >
              {listening ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4 M8 22h8"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4 M8 22h8"/>
                </svg>
              )}
            </button>

            <button
              className={`${styles.sendBtn} ${text.trim() ? styles.hasText : ''}`}
              disabled={!text.trim()}
              title="Send"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="m21.426 11.095-17-8A.999.999 0 0 0 3.03 4.242L4.969 12 3.03 19.758a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Listening indicator */}
      {listening && (
        <div className={styles.listeningBar}>
          <div className={styles.waveform}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={styles.bar} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <span className={styles.listeningText}>Listening…</span>
        </div>
      )}
    </div>
  )
}
