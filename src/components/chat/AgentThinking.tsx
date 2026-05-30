import styles from './AgentThinking.module.css'

interface Props {
  text: string
}

export default function AgentThinking({ text }: Props) {
  if (!text) return null

  return (
    <div className={styles.thinking}>
      <span className={styles.label}>💭 Thinking</span>
      <span className={styles.text}>{text}</span>
    </div>
  )
}
