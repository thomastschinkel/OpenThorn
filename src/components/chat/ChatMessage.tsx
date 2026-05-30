import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { ContentBlock } from './ChatPanel'
import FileChangeCard from './FileChangeCard'
import styles from './ChatMessage.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks?: ContentBlock[]
}

interface Props {
  message: Message
}

export type { Message, ContentBlock }

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.row} ${isUser ? styles.user : styles.ai}`}>
      <div className={styles.bubble}>
        {/* Render blocks chronologically — text, file cards, status interleaved */}
        {message.blocks && message.blocks.length > 0 ? (
          <div className={styles.blocks}>
            {message.blocks.map((block, i) => {
              switch (block.type) {
                case 'text':
                  return block.content ? (
                    <div key={i} className={`${styles.content} ${styles.markdown}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {block.content}
                      </ReactMarkdown>
                    </div>
                  ) : null

                case 'file_change':
                  return block.action && block.path ? (
                    <FileChangeCard
                      key={i}
                      icon={block.icon ?? '📄'}
                      action={block.action}
                      path={block.path}
                    />
                  ) : null

                case 'status':
                  return block.content ? (
                    <div key={i} className={styles.status}>
                      {block.content}
                    </div>
                  ) : null

                default:
                  return null
              }
            })}
          </div>
        ) : (
          /* Fallback for messages without blocks (user messages, welcome) */
          message.text && (
            <div
              className={`${styles.content} ${!isUser ? styles.markdown : ''}`}
            >
              {isUser ? (
                message.text
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {message.text}
                </ReactMarkdown>
              )}
            </div>
          )
        )}

        {/* Action buttons (AI messages only) */}
        {!isUser && (
          <div className={styles.actions}>
            <button className={styles.actionBtn} title="Copy">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button className={styles.actionBtn} title="Like">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              </svg>
            </button>
            <button className={styles.actionBtn} title="Dislike">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
