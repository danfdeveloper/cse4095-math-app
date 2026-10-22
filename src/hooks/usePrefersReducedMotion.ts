import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false
}

/**
 * Whether the device has asked for reduced motion. It follows the setting if
 * it is changed while the app is open. When the browser cannot say, it is
 * false, and the styles' own reduced-motion rules still apply.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
