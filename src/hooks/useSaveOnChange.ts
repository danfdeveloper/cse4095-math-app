import { useEffect, useRef } from 'react'

/**
 * Calls `save` whenever `value` changes, but not for the value the component
 * started with: loading saved data should not write it straight back.
 */
export function useSaveOnChange<T>(value: T, save: (value: T) => void) {
  const saved = useRef(value)

  useEffect(() => {
    if (saved.current === value) return
    saved.current = value
    save(value)
  }, [value, save])
}
