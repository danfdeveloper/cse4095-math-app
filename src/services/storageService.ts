/**
 * A safe wrapper around localStorage (specification sections 11 and 20.4).
 * Nothing here throws: a browser may have storage switched off, may be out of
 * space, or may hold data that is not valid JSON, and the app must keep going.
 */

export const STORAGE_PREFIX = 'mathPractice.'

export const STORAGE_KEYS = {
  settings: 'mathPractice.settings',
  sessions: 'mathPractice.sessions',
  attempts: 'mathPractice.attempts',
  mistakePatterns: 'mathPractice.mistakePatterns',
  statistics: 'mathPractice.statistics',
  activeSession: 'mathPractice.activeSession',
  version: 'mathPractice.version',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export type ReadResult<T> =
  | { status: 'ok'; value: T }
  /** Nothing is saved under this key. */
  | { status: 'missing' }
  /** Something is saved, but it is not valid JSON or not the expected shape. */
  | { status: 'invalid'; reason: string }
  /** The browser's storage cannot be used at all. */
  | { status: 'unavailable' }

export type WriteFailure = 'unavailable' | 'full'
export type WriteResult = { ok: true } | { ok: false; reason: WriteFailure }

/** The browser's storage, or null when it is switched off or blocked. */
export function getStorage(): Storage | null {
  try {
    // Merely reading this property throws in some browsers when storage is blocked.
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

/** Reads and parses one key, checking the result with `validate`. */
export function readJson<T>(
  key: StorageKey,
  validate: (value: unknown) => value is T,
): ReadResult<T> {
  const storage = getStorage()
  if (storage === null) return { status: 'unavailable' }

  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return { status: 'unavailable' }
  }
  if (raw === null) return { status: 'missing' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'invalid', reason: 'not valid JSON' }
  }
  return validate(parsed)
    ? { status: 'ok', value: parsed }
    : { status: 'invalid', reason: 'unexpected shape' }
}

/** Reads one key as plain JSON, with no shape check. For callers that clean the data themselves. */
export function readRawJson(key: StorageKey): ReadResult<unknown> {
  // Parsed JSON is never undefined, so every successfully parsed value passes.
  return readJson(key, (value): value is unknown => value !== undefined)
}

/** Saves a value as JSON. Reports, rather than throws, when it cannot. */
export function writeJson(key: StorageKey, value: unknown): WriteResult {
  const storage = getStorage()
  if (storage === null) return { ok: false, reason: 'unavailable' }

  try {
    storage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'full' : 'unavailable' }
  }
}

/** Removes the given keys. Returns false if storage could not be used. */
export function removeKeys(keys: readonly StorageKey[]): boolean {
  const storage = getStorage()
  if (storage === null) return false

  try {
    for (const key of keys) storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Every key this app has saved, leaving anything else on the same site alone. */
export function listAppKeys(): string[] {
  const storage = getStorage()
  if (storage === null) return []

  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

/** Erases everything this app saved, including the version, and nothing else. */
export function clearAppData(): boolean {
  const storage = getStorage()
  if (storage === null) return false

  try {
    for (const key of listAppKeys()) storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
