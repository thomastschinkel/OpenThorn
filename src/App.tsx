import { useState, createContext, useContext } from 'react'
import ResizablePanel from './components/layout/ResizablePanel'
import ChatPanel from './components/chat/ChatPanel'
import PreviewPanel from './components/preview/PreviewPanel'
import SettingsPage from './components/settings/SettingsPage'
import styles from './App.module.css'

type View = 'builder' | 'settings'

interface AppContextType {
  navigateTo: (view: View) => void
}

export const AppContext = createContext<AppContextType>({ navigateTo: () => {} })
export const useApp = () => useContext(AppContext)

export default function App() {
  const [view, setView] = useState<View>('builder')

  const context: AppContextType = {
    navigateTo: (v) => setView(v),
  }

  if (view === 'settings') {
    return (
      <AppContext.Provider value={context}>
        <SettingsPage onBack={() => setView('builder')} />
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={context}>
      <div className={styles.app}>
        <ResizablePanel
          left={<ChatPanel />}
          right={<PreviewPanel />}
        />
      </div>
    </AppContext.Provider>
  )
}
