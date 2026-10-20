import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are disabled, so React Testing Library cannot register its
// own automatic cleanup. Unmount rendered trees after every test instead.
afterEach(() => {
  cleanup()
  // Saved data must never leak from one test into the next.
  try {
    window.localStorage.clear()
  } catch {
    // A test that blocked storage has already restored it by now, or has no need.
  }
})

// jsdom does not implement <dialog>.showModal() or close(). This stand-in only
// covers the open state, which is all the unit tests need; the real behavior
// (focus trapping, Escape) is checked in a real browser.
if (
  typeof HTMLDialogElement !== 'undefined' &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}

// Node 25 defines its own global `localStorage`, which does nothing unless Node
// is started with a backing file, and it hides jsdom's working one. Browsers
// are unaffected. When that happens, use a plain in-memory stand-in instead.
class MemoryStorage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(String(key)) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(String(key))
  }
  setItem(key: string, value: string) {
    this.data.set(String(key), String(value))
  }
}

function localStorageWorks(): boolean {
  try {
    return typeof window.localStorage?.getItem === 'function'
  } catch {
    return false
  }
}

if (!localStorageWorks()) {
  const standIn = new MemoryStorage()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => standIn,
  })
}
