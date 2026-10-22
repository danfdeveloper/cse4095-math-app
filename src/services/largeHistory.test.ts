import { describe, expect, it } from 'vitest'
import {
  createAttempt,
  createSession,
  initialPracticeSessionState,
  practiceSessionReducer,
  type PracticeSessionState,
} from '../app/practiceSessionState'
import { MAX_STORED_ATTEMPTS } from '../constants/settings'
import { makeQuestion } from '../test/fixtures'
import { stored } from '../test/storage'
import type { MathOperation } from '../types/question'
import { buildMistakeStatistics } from './mistakeStatistics'
import {
  loadPersistedData,
  saveAttempts,
  saveMistakePatterns,
  saveSessions,
  saveStatistics,
} from './persistence'
import { buildStatisticsView } from './statisticsService'
import { STORAGE_KEYS } from './storageService'

/*
 * Several thousand answers, as a student who practices every day for a year
 * would have (specification section 23, TODO Task 84). They are answered
 * through the real reducer, so the totals, mistakes and archiving are the
 * app's own.
 */
const OPERATIONS: MathOperation[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
]

function practiced(answers: number): PracticeSessionState {
  let state = initialPracticeSessionState
  for (let index = 0; index < answers; index++) {
    if (index % 20 === 0) {
      state = practiceSessionReducer(state, {
        type: 'sessionStarted',
        session: createSession({
          operations: OPERATIONS,
          difficulty: 2,
          sessionLength: 20,
          ...(index % 100 === 80 ? { mode: 'mistake-review' as const } : {}),
        }),
        firstQuestion: makeQuestion({ id: `q${index}` }),
      })
    }
    const question = {
      ...makeQuestion({ id: `q${index}`, firstOperand: 7, secondOperand: 8 }),
      source:
        state.session?.mode === 'mistake-review'
          ? ('mistake-review' as const)
          : ('regular' as const),
    }
    state = practiceSessionReducer(
      { ...state, currentQuestion: question },
      {
        type: 'resultRecorded',
        attempt: createAttempt(state.session!, question, {
          selectedAnswer: 56,
          selfReportedCorrect: index % 3 !== 0,
        }),
        nextQuestion:
          index % 20 === 19 ? null : makeQuestion({ id: `q${index + 1}` }),
      },
    )
  }
  return state
}

const save = (state: PracticeSessionState) => {
  saveAttempts(state.attempts)
  saveSessions(state.sessions)
  saveStatistics(state.statistics)
  saveMistakePatterns(state.mistakePatterns)
}

/** What the app's saved data takes up, in bytes (browsers keep text as UTF-16). */
const usage = () =>
  Object.values(STORAGE_KEYS).reduce(
    (total, key) => total + (window.localStorage.getItem(key)?.length ?? 0) * 2,
    0,
  )

describe('a large practice history', () => {
  const answers = 7000
  const state = practiced(answers)

  it('keeps the newest answers in detail, and archives the oldest', () => {
    expect(state.attempts).toHaveLength(MAX_STORED_ATTEMPTS)
    expect(state.attempts.at(-1)?.questionId).toBe(`q${answers - 1}`)
    expect(state.attempts[0].questionId).toBe(
      `q${answers - MAX_STORED_ATTEMPTS}`,
    )
  })

  it('still counts every answer in the totals, the archived ones too', () => {
    expect(state.statistics.attempted).toBe(answers)
    expect(state.statistics.correct + state.statistics.incorrect).toBe(answers)
    const byOperation = Object.values(state.statistics.byOperation).reduce(
      (sum, counts) => sum + counts.attempted,
      0,
    )
    expect(byOperation).toBe(answers)
  })

  it('still counts every mistake-practice answer, the archived ones too', () => {
    // One session in five is mistake practice.
    expect(state.statistics.mistakeReview.attempted).toBe(answers / 5)
    expect(
      buildMistakeStatistics(state.mistakePatterns, state.statistics)
        .similarPracticed,
    ).toBe(answers / 5)
  })

  it('still counts every miss in the mistakes, the archived ones too', () => {
    const misses = state.mistakePatterns.reduce(
      (sum, pattern) => sum + pattern.incorrectCount,
      0,
    )
    expect(misses).toBe(state.statistics.incorrect)
  })

  it('keeps no more than the most recent sessions', () => {
    expect(state.sessions.length).toBeLessThanOrEqual(100)
  })

  it('fits in the space the strictest browsers give a site (5 MB), at under 3.5 MB', () => {
    save(state)

    const bytes = usage()
    expect(bytes).toBeLessThan(3.5 * 1024 * 1024)
    // The detailed attempts are nearly all of it.
    expect(
      (window.localStorage.getItem(STORAGE_KEYS.attempts)?.length ?? 0) * 2,
    ).toBeGreaterThan(bytes * 0.8)
  })

  it('stays the same size however much more is practiced, once full', () => {
    save(state)
    const full = usage()
    save(practiced(answers + 2000))

    expect(usage()).toBeLessThan(full * 1.05)
  })

  it('loads back quickly, with the same totals', () => {
    save(state)

    const started = performance.now()
    const loaded = loadPersistedData()
    const elapsed = performance.now() - started

    expect(loaded.statistics).toEqual(state.statistics)
    expect(loaded.attempts).toHaveLength(MAX_STORED_ATTEMPTS)
    expect(elapsed).toBeLessThan(500)
  })

  it('works out what the statistics page shows quickly', () => {
    const started = performance.now()
    buildStatisticsView(state.statistics, state.sessions, null)
    buildMistakeStatistics(state.mistakePatterns, state.statistics)
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(50)
  })

  it('counts an answer quickly, even when the history is full', () => {
    const started = performance.now()
    practiceSessionReducer(
      {
        ...state,
        session: createSession({
          operations: ['addition'],
          difficulty: 1,
          sessionLength: 5,
        }),
        currentQuestion: makeQuestion({ id: 'next' }),
      },
      {
        type: 'resultRecorded',
        attempt: createAttempt(
          createSession({
            operations: ['addition'],
            difficulty: 1,
            sessionLength: 5,
          }),
          makeQuestion({ id: 'next' }),
          { selectedAnswer: 56, selfReportedCorrect: true },
        ),
        nextQuestion: makeQuestion({ id: 'after' }),
      },
    )
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(50)
    expect(stored(STORAGE_KEYS.version)).toBeUndefined()
  })
})
