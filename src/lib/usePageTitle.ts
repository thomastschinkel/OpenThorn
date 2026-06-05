import { useEffect } from 'react'

const DEFAULT_TITLE = 'OpenThorn — The BYOK AI Website Builder'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — OpenThorn` : DEFAULT_TITLE
    return () => { document.title = DEFAULT_TITLE }
  }, [title])
}
