import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppProvider'
import { activeSessionState, finishedSessionState } from '../test/fixtures'
import { usePracticeSession } from './usePracticeSession'
import { useStatistics } from './useStatistics'

function mount(
  initialState?: Parameters<typeof AppProvider>[0]['initialState'],
) {
  return renderHook(
    () => ({ stats: useStatistics(), practice: usePracticeSession() }),
    {
      wrapper: ({ children }) => (
        <AppProvider initialState={initialState}>{children}</AppProvider>
      ),
    },
  )
}

describe('useStatistics', () => {
  it('has no data before anything is answered', () => {
    const { result } = mount()

    expect(result.current.stats.hasData).toBe(false)
    expect(result.current.stats.recentSessions).toEqual([])
  })

  it('reflects a finished session', () => {
    const { result } = mount(
      finishedSessionState(
        { operations: ['addition'], difficulty: 2 },
        { correct: 3, incorrect: 1 },
      ),
    )

    expect(result.current.stats.hasData).toBe(true)
    expect(result.current.stats.overall).toEqual({
      attempted: 4,
      correct: 3,
      incorrect: 1,
      accuracy: 75,
    })
    expect(result.current.stats.byOperation[0]).toMatchObject({
      operation: 'addition',
      attempted: 4,
    })
    expect(result.current.stats.byDifficulty[1]).toMatchObject({
      difficulty: 2,
      attempted: 4,
    })
    expect(result.current.stats.recentSessions).toHaveLength(1)
  })

  it('updates as questions are answered', () => {
    const { result } = mount(
      activeSessionState({ sessionLength: 'continuous' }),
    )
    expect(result.current.stats.hasData).toBe(false)

    act(() =>
      result.current.practice.recordResult({
        selectedAnswer: 1,
        selfReportedCorrect: true,
      }),
    )
    expect(result.current.stats.overall.attempted).toBe(1)

    act(() =>
      result.current.practice.recordResult({
        selectedAnswer: 1,
        selfReportedCorrect: false,
      }),
    )
    expect(result.current.stats.overall).toEqual({
      attempted: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
    })
  })

  it('labels the session being practiced as in progress, and others not', () => {
    const { result } = mount(
      activeSessionState({ sessionLength: 'continuous' }),
    )

    act(() =>
      result.current.practice.recordResult({
        selectedAnswer: 1,
        selfReportedCorrect: true,
      }),
    )

    expect(result.current.stats.recentSessions[0]).toMatchObject({
      inProgress: true,
      finished: false,
    })
  })

  it('stops calling a session in progress once it ends', () => {
    const { result } = mount(
      activeSessionState({ sessionLength: 'continuous' }),
    )
    act(() =>
      result.current.practice.recordResult({
        selectedAnswer: 1,
        selfReportedCorrect: true,
      }),
    )

    act(() => result.current.practice.endSession())

    expect(result.current.stats.recentSessions[0]).toMatchObject({
      inProgress: false,
      finished: true,
    })
  })

  it('goes back to no data after a reset', () => {
    const { result } = mount(
      finishedSessionState({}, { correct: 2, incorrect: 2 }),
    )

    act(() => result.current.practice.resetStatistics())

    expect(result.current.stats.hasData).toBe(false)
    expect(result.current.stats.recentSessions).toEqual([])
  })

  it('gives the same object until something changes', () => {
    const { result, rerender } = mount(
      finishedSessionState({}, { correct: 1, incorrect: 1 }),
    )
    const first = result.current.stats

    rerender()

    expect(result.current.stats).toBe(first)
  })
})
