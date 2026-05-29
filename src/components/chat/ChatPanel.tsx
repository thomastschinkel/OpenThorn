import { useState, useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import styles from './ChatPanel.module.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const demoMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    text: "Hey! I'm Bloom, your AI coding companion. I can help you build full-stack web applications — describe what you'd like to create and I'll generate it for you.\n\nSwitch between **Plan** mode to sketch out architecture, or **Build** mode to generate working code.\n\nWhat do you want to build today?",
  },
  {
    id: '2',
    role: 'user',
    text: 'Build me a modern landing page for a SaaS startup called "Flowly" — an AI-powered project management tool.',
  },
  {
    id: '3',
    role: 'assistant',
    text: "Great idea! Here's what I built:\n\n✅ **Hero section** with a gradient headline and CTA\n✅ **Features grid** showcasing 6 key capabilities\n✅ **Pricing table** with 3 tiers\n✅ **Testimonials carousel** with 4 customer quotes\n✅ **Footer** with links and newsletter signup\n\nI used a clean dark theme with indigo accents. The layout is fully responsive — check it out in the preview on the right! 👉",
  },
]

export default function ChatPanel() {
  const [messages] = useState<Message[]>(demoMessages)
  const [mode, setMode] = useState<'plan' | 'build'>('build')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.panel}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Bloom" className={styles.logoImg} />
          <span className={styles.logo}>Bloom</span>
          <span className={styles.badge}>BYOK</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.modeLabel}>
            {mode === 'build' ? 'Building…' : 'Planning…'}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput mode={mode} onToggleMode={setMode} />
    </div>
  )
}
