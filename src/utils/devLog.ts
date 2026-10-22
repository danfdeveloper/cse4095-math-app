/**
 * Reports a problem in the developer console while the app is being developed
 * or tested. A production build stays silent: students never see these, and
 * nothing is ever sent anywhere.
 */
export function logDevError(message: string, detail?: unknown): void {
  if (!import.meta.env.DEV) return
  if (detail === undefined) console.error(`[Math Practice] ${message}`)
  else console.error(`[Math Practice] ${message}`, detail)
}
