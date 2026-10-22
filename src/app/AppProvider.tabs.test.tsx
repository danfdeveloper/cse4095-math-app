import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../hooks/useSettings'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { STORAGE_KEYS } from '../services/storageService'
import { stored } from '../test/storage'
import type {
  PracticeAttempt,
  PracticeConfig,
  PracticeSession,
  QuestionResult,
} from '../types/session'
import { AppProvider } from './AppProvider'

/*
 * Two tabs of the app open at once. They share one storage; when one saves,
 * the browser tells the other with a "storage" event. Here both tabs live in
 * one window, so the event is sent by hand, as the browser would send it.
 */
const config: PracticeConfig = {
  operations: ['addition'],
  difficulty: 1,
  sessionLength: 'continuous',
}
const right: QuestionResult = { selectedAnswer: 1, selfReportedCorrect: true }
const wrong: QuestionResult = { selectedAnswer: 2, selfReportedCorrect: false }

const openTab = () =>
  renderHook(
    () => ({ practice: usePracticeSession(), settings: useSettings() }),
    { wrapper: AppProvider },
  )
type Tab = ReturnType<typeof openTab>

/** The browser telling the tabs that one of them saved under `key`. */
const saved = (key: string | null) =>
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
const start = (tab: Tab) =>
  act(() => void tab.result.current.practice.startSession(config))
const answer = (tab: Tab, result: QuestionResult) => {
  act(() => tab.result.current.practice.recordResult(result))
  saved(STORAGE_KEYS.attempts)
}

const savedAttempts = () =>
  (stored(STORAGE_KEYS.attempts) ?? []) as PracticeAttempt[]
const savedSessions = () =>
  (stored(STORAGE_KEYS.sessions) ?? []) as PracticeSession[]

afterEach(() => vi.restoreAllMocks())

describe('two tabs open at once', () => {
  it('keep every answer from both, when they take turns', () => {
    const a = openTab()
    const b = openTab()
    start(a)
    start(b)

    answer(a, wrong)
    answer(b, right)
    answer(a, right)
    answer(b, wrong)

    expect(savedAttempts()).toHaveLength(4)
    expect(stored(STORAGE_KEYS.statistics)).toMatchObject({
      attempted: 4,
      correct: 2,
      incorrect: 2,
    })
    expect(savedSessions()).toHaveLength(2)
    expect(savedSessions().map((s) => s.attempted)).toEqual([2, 2])
  })

  it('keep the mistakes made in both', () => {
    const a = openTab()
    const b = openTab()
    start(a)
    start(b)

    answer(a, wrong)
    answer(b, wrong)

    const misses = (
      stored(STORAGE_KEYS.mistakePatterns) as { incorrectCount: number }[]
    ).reduce((sum, pattern) => sum + pattern.incorrectCount, 0)
    expect(misses).toBe(2)
  })

  it('agree with each other on the totals after each answer', () => {
    const a = openTab()
    const b = openTab()
    start(a)

    answer(a, right)
    answer(a, wrong)

    expect(b.result.current.practice.statistics).toEqual(
      a.result.current.practice.statistics,
    )
    expect(b.result.current.practice.attempts).toHaveLength(2)
  })

  it('leave each tab its own session in progress, on the same question and card', () => {
    const a = openTab()
    const b = openTab()
    start(a)
    const question = a.result.current.practice.currentQuestion!
    act(() =>
      a.result.current.practice.rememberCard(question.id, {
        selectedAnswer: question.choices[0],
        flipped: true,
      }),
    )
    start(b)

    answer(b, right)

    const { practice } = a.result.current
    expect(practice.isActive).toBe(true)
    expect(practice.currentQuestion).toEqual(question)
    expect(practice.card).toEqual({
      selectedAnswer: question.choices[0],
      flipped: true,
    })
  })

  it('do not write back what they just read from the other', () => {
    const a = openTab()
    const b = openTab()
    start(b)
    act(() => b.result.current.practice.recordResult(right))
    const writes = vi.spyOn(
      Object.getPrototypeOf(window.localStorage),
      'setItem',
    )

    saved(STORAGE_KEYS.attempts)

    const toHistory = writes.mock.calls.filter(([key]) =>
      [
        STORAGE_KEYS.attempts,
        STORAGE_KEYS.statistics,
        STORAGE_KEYS.mistakePatterns,
        STORAGE_KEYS.settings,
      ].includes(key as never),
    )
    expect(toHistory).toEqual([])
    expect(a.result.current.practice.attempts).toHaveLength(1)
  })

  it('share a settings change', () => {
    const a = openTab()
    const b = openTab()

    act(() =>
      b.result.current.settings.updateSettings({ showExplanations: false }),
    )
    saved(STORAGE_KEYS.settings)

    expect(a.result.current.settings.settings.showExplanations).toBe(false)
  })

  it('end the practice in this tab when everything was erased in the other', () => {
    const a = openTab()
    const b = openTab()
    start(a)
    answer(a, wrong)

    act(() => void b.result.current.settings.clearAllData())
    saved(null)

    expect(a.result.current.practice.session).toBeNull()
    expect(a.result.current.practice.isActive).toBe(false)
    expect(a.result.current.practice.statistics.attempted).toBe(0)
    expect(a.result.current.practice.mistakePatterns).toEqual([])
  })

  it('do not end a new session that has no history yet, when the other tab only changes a setting', () => {
    const a = openTab()
    const b = openTab()
    start(a)

    act(() =>
      b.result.current.settings.updateSettings({ cardAnimationEnabled: false }),
    )
    saved(STORAGE_KEYS.settings)

    expect(a.result.current.practice.isActive).toBe(true)
  })

  it('ignore saving by other sites, and the other tab’s own session in progress', () => {
    const a = openTab()
    const b = openTab()
    start(b)
    act(() => b.result.current.practice.recordResult(right))

    saved('someOtherSite.data')
    saved(STORAGE_KEYS.activeSession)
    expect(a.result.current.practice.attempts).toHaveLength(0)

    saved(STORAGE_KEYS.attempts)
    expect(a.result.current.practice.attempts).toHaveLength(1)
  })

  it('stop listening once a tab is closed', () => {
    const a = openTab()
    const remove = vi.spyOn(window, 'removeEventListener')

    a.unmount()

    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})
