import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type Listener = () => void

/** A stand-in for window.matchMedia that can be told the device's wish changed. */
function mockMotionPreference(initial: boolean) {
  const listeners = new Set<Listener>()
  let reduce = initial
  const queries: string[] = []
  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query)
    return {
      get matches() {
        return reduce
      },
      media: query,
      addEventListener: (_: string, listener: Listener) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) =>
        listeners.delete(listener),
    }
  })
  return {
    queries,
    listeners,
    set(value: boolean) {
      reduce = value
      for (const listener of [...listeners]) listener()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePrefersReducedMotion', () => {
  it('asks the browser about reduced motion', () => {
    const device = mockMotionPreference(false)

    renderHook(() => usePrefersReducedMotion())

    expect(device.queries).toContain('(prefers-reduced-motion: reduce)')
  })

  it('is true when the device asks for reduced motion', () => {
    mockMotionPreference(true)

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(
      true,
    )
  })

  it('is false when it does not', () => {
    mockMotionPreference(false)

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(
      false,
    )
  })

  it('follows the setting if it changes while the app is open', () => {
    const device = mockMotionPreference(false)
    const { result } = renderHook(() => usePrefersReducedMotion())

    act(() => device.set(true))
    expect(result.current).toBe(true)

    act(() => device.set(false))
    expect(result.current).toBe(false)
  })

  it('stops listening when it is no longer used', () => {
    const device = mockMotionPreference(false)
    const { unmount } = renderHook(() => usePrefersReducedMotion())
    expect(device.listeners.size).toBe(1)

    unmount()

    expect(device.listeners.size).toBe(0)
  })

  it('is false, and does not fail, when the browser cannot say', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(
      false,
    )
  })
})
