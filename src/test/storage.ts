import { vi } from 'vitest'

/** Whichever storage the tests are really using (jsdom's, or the in-memory stand-in). */
function storagePrototype(): Storage {
  return Object.getPrototypeOf(window.localStorage) as Storage
}

/** Each helper returns a function that undoes it. */

/** Storage is switched off: merely touching window.localStorage throws, as with blocked cookies. */
export function blockStorage(): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is blocked', 'SecurityError')
    },
  })
  return () => {
    if (original) Object.defineProperty(window, 'localStorage', original)
    else delete (window as unknown as Record<string, unknown>).localStorage
  }
}

/** Storage is out of space: every write throws, as a full browser does. */
export function fillStorage(
  error: DOMException = new DOMException(
    'Quota exceeded',
    'QuotaExceededError',
  ),
): () => void {
  const spy = vi.spyOn(storagePrototype(), 'setItem').mockImplementation(() => {
    throw error
  })
  return () => spy.mockRestore()
}

/** Makes one storage method throw a generic error. */
export function breakStorageMethod(
  method: 'getItem' | 'setItem' | 'removeItem' | 'key',
): () => void {
  const spy = vi.spyOn(storagePrototype(), method).mockImplementation(() => {
    throw new DOMException('Storage failed', 'SecurityError')
  })
  return () => spy.mockRestore()
}

/** What is saved under a key right now, parsed, or undefined if nothing is. */
export function stored(key: string): unknown {
  const raw = window.localStorage.getItem(key)
  return raw === null ? undefined : JSON.parse(raw)
}

/**
 * Only writes to one key fail, as a nearly full disk does: the big list will
 * not fit but small writes still do. Everything else is saved normally.
 */
export function failWritesTo(
  key: string,
  error: DOMException = new DOMException(
    'Quota exceeded',
    'QuotaExceededError',
  ),
): () => void {
  const proto = storagePrototype()
  const original = proto.setItem
  const spy = vi.spyOn(proto, 'setItem').mockImplementation(function (
    this: Storage,
    name: string,
    value: string,
  ) {
    if (name === key) throw error
    return original.call(this, name, value)
  })
  return () => spy.mockRestore()
}

/** Reading one key fails, as a damaged store can. Every other key reads normally. */
export function failReadsOf(key: string): () => void {
  const proto = storagePrototype()
  const original = proto.getItem
  const spy = vi.spyOn(proto, 'getItem').mockImplementation(function (
    this: Storage,
    name: string,
  ) {
    if (name === key) {
      throw new DOMException('Storage failed', 'SecurityError')
    }
    return original.call(this, name)
  })
  return () => spy.mockRestore()
}
