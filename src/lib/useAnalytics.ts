import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackEvent } from './analytics'

export function useAnalytics() {
  const location = useLocation()

  useEffect(() => {
    trackEvent('$pageview', { path: location.pathname })
  }, [location.pathname])
}
