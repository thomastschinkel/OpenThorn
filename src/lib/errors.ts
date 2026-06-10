const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export function getErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error)
}

export function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch (error) {
    logError('Storage', error)
    return fallback
  }
}
