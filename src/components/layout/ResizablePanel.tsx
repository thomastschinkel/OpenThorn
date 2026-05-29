import { useState, useRef, useEffect, type ReactNode } from 'react'
import styles from './ResizablePanel.module.css'

interface Props {
  left: ReactNode
  right: ReactNode
}

export default function ResizablePanel({ left, right }: Props) {
  const [split, setSplit] = useState(42)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setSplit(Math.min(70, Math.max(30, pct)))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.left} style={{ width: `${split}%` }}>
        {left}
      </div>
      <div
        className={`${styles.divider} ${dragging ? styles.dragging : ''}`}
        onMouseDown={() => setDragging(true)}
      >
        <div className={styles.handle} />
      </div>
      <div className={styles.right} style={{ width: `${100 - split}%` }}>
        {right}
      </div>
    </div>
  )
}
