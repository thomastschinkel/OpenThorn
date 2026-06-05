import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import { initSentry } from './lib/sentry'
import { initAnalytics } from './lib/analytics'
import App from './App'
import './index.css'

initSentry()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
