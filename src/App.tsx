import ResizablePanel from './components/layout/ResizablePanel'
import ChatPanel from './components/chat/ChatPanel'
import PreviewPanel from './components/preview/PreviewPanel'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <ResizablePanel
        left={<ChatPanel />}
        right={<PreviewPanel />}
      />
    </div>
  )
}
