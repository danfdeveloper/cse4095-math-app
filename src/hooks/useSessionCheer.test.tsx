import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppProvider'
import {
  PRAISE_MESSAGES,
  SUPPORT_MESSAGES,
} from '../constants/feedbackMessages'
import { STORAGE_KEYS } from '../services/storageService'
import { useSessionCheer } from './useSessionCheer'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
)

afterEach(() => vi.restoreAllMocks())

describe('useSessionCheer', () => {
  it('praises a good session and encourages after a harder one', () => {
    const good = renderHook(() => useSessionCheer(10, 90), { wrapper })
    const hard = renderHook(() => useSessionCheer(10, 40), { wrapper })

    expect(PRAISE_MESSAGES).toContain(good.result.current)
    expect(SUPPORT_MESSAGES).toContain(hard.result.current)
  })

  it('has nothing to say when nothing was answered', () => {
    const { result } = renderHook(() => useSessionCheer(0, 0), { wrapper })

    expect(result.current).toBeNull()
  })

  it('has nothing to say when feedback effects are off', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ feedbackEffectsEnabled: false }),
    )
    const { result } = renderHook(() => useSessionCheer(10, 100), { wrapper })

    expect(result.current).toBeNull()
  })

  it('keeps the message it picked when it is drawn again', () => {
    // A different number each time it is asked, so a second pick would differ.
    let next = 0
    vi.spyOn(Math, 'random').mockImplementation(() => (next++ % 7) / 7)
    const { result, rerender } = renderHook(() => useSessionCheer(10, 100), {
      wrapper,
    })
    const first = result.current

    for (let round = 0; round < 8; round++) {
      rerender()
      expect(result.current).toBe(first)
    }
  })
})
