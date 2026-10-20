let fallbackCounter = 0

/**
 * Returns a unique ID string. Uses crypto.randomUUID when the browser offers
 * it; that API only exists in secure contexts (https or localhost), so over
 * plain http on a local network the fallback below is used instead.
 */
export function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  fallbackCounter += 1
  const time = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  return `${time}-${fallbackCounter.toString(36)}-${noise}`
}
