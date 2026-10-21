import { describe, expect, it } from 'vitest'
import { createAttempt, createSession } from '../app/practiceSessionState'
import { makeQuestion } from '../test/fixtures'
import type { PracticeConfig, PracticeSession } from '../types/session'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { makeAttempt, makeSession } from '../test/fixtures'
import { seededRandom } from '../test/seededRandom'
import type { AppStatistics } from '../types/statistics'
import {
  buildStatisticsView,
  calculateAccuracy,
  createEmptyStatistics,
  recentSessionRows,
  recordAttemptInStatistics,
  removeAttemptFromStatistics,
  statisticsFromAttempts,
  summarizeSession,
} from './statisticsService'

describe('calculateAccuracy', () => {
  it.each([
    [0, 5, 0],
    [1, 4, 25],
    [3, 4, 75],
    [7, 10, 70],
    [5, 5, 100],
    [1, 1, 100],
  ])('%i correct of %i is %i%%', (correct, attempted, expected) => {
    expect(calculateAccuracy(correct, attempted)).toBe(expected)
  })

  it('rounds to the nearest whole percent', () => {
    expect(calculateAccuracy(2, 3)).toBe(67) // 66.67
    expect(calculateAccuracy(1, 3)).toBe(33) // 33.33
    expect(calculateAccuracy(1, 8)).toBe(13) // 12.5
  })

  it('is 0 when nothing was attempted, instead of dividing by zero', () => {
    expect(calculateAccuracy(0, 0)).toBe(0)
    expect(calculateAccuracy(3, 0)).toBe(0)
    expect(Number.isNaN(calculateAccuracy(0, 0))).toBe(false)
  })

  it('never shows 100% unless every answer was right', () => {
    expect(calculateAccuracy(199, 200)).toBe(99) // 99.5 rounds up, but is not perfect
    expect(calculateAccuracy(999, 1000)).toBe(99)
    expect(calculateAccuracy(9999, 10000)).toBe(99)
    expect(calculateAccuracy(200, 200)).toBe(100)
  })

  it('stays between 0 and 100 for impossible input', () => {
    expect(calculateAccuracy(12, 10)).toBe(100)
    expect(calculateAccuracy(-3, 10)).toBe(0)
    expect(calculateAccuracy(3, -10)).toBe(0)
  })
})

describe('summarizeSession', () => {
  const config: PracticeConfig = {
    operations: ['addition'],
    difficulty: 1,
    sessionLength: 10,
  }

  function sessionWith(counts: Partial<PracticeSession>): PracticeSession {
    return { ...createSession(config), ...counts }
  }

  function attemptIn(
    session: PracticeSession,
    source: 'regular' | 'mistake-review',
  ) {
    return createAttempt(session, makeQuestion({ source }), {
      selectedAnswer: 56,
      selfReportedCorrect: true,
    })
  }

  it('reports the totals and accuracy of the session', () => {
    const session = sessionWith({ attempted: 10, correct: 7, incorrect: 3 })

    expect(summarizeSession(session, [])).toEqual({
      attempted: 10,
      correct: 7,
      incorrect: 3,
      accuracy: 70,
      mistakeReviewCount: 0,
    })
  })

  it('handles a session with nothing answered', () => {
    expect(summarizeSession(sessionWith({}), [])).toEqual({
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
      mistakeReviewCount: 0,
    })
  })

  it('counts the mistake-review questions in this session', () => {
    const session = sessionWith({ attempted: 4, correct: 4 })
    const attempts = [
      attemptIn(session, 'mistake-review'),
      attemptIn(session, 'regular'),
      attemptIn(session, 'mistake-review'),
      attemptIn(session, 'regular'),
    ]

    expect(summarizeSession(session, attempts).mistakeReviewCount).toBe(2)
  })

  it('ignores mistake-review questions from other sessions', () => {
    const session = sessionWith({ attempted: 1, correct: 1 })
    const other = sessionWith({})
    const attempts = [
      attemptIn(other, 'mistake-review'),
      attemptIn(other, 'mistake-review'),
      attemptIn(session, 'regular'),
    ]

    expect(summarizeSession(session, attempts).mistakeReviewCount).toBe(0)
  })
})

/** Checks that every total in a set of statistics agrees with every other. */
function expectConsistent(stats: AppStatistics) {
  expect(stats.correct + stats.incorrect).toBe(stats.attempted)
  const operations = MATH_OPERATIONS.map((op) => stats.byOperation[op])
  const levels = DIFFICULTY_LEVELS.map((level) => stats.byDifficulty[level])
  for (const group of [...operations, ...levels]) {
    expect(group.correct + group.incorrect).toBe(group.attempted)
  }
  expect(operations.reduce((sum, g) => sum + g.attempted, 0)).toBe(
    stats.attempted,
  )
  expect(levels.reduce((sum, g) => sum + g.attempted, 0)).toBe(stats.attempted)
  expect(operations.reduce((sum, g) => sum + g.correct, 0)).toBe(stats.correct)
  expect(levels.reduce((sum, g) => sum + g.correct, 0)).toBe(stats.correct)
}

describe('createEmptyStatistics', () => {
  it('has every count at zero', () => {
    const stats = createEmptyStatistics()

    expect(stats).toMatchObject({ attempted: 0, correct: 0, incorrect: 0 })
    for (const op of MATH_OPERATIONS) {
      expect(stats.byOperation[op]).toEqual({
        attempted: 0,
        correct: 0,
        incorrect: 0,
      })
    }
    for (const level of DIFFICULTY_LEVELS) {
      expect(stats.byDifficulty[level]).toEqual({
        attempted: 0,
        correct: 0,
        incorrect: 0,
      })
    }
  })

  it('has an entry for every operation and every level', () => {
    const stats = createEmptyStatistics()

    expect(Object.keys(stats.byOperation).sort()).toEqual(
      [...MATH_OPERATIONS].sort(),
    )
    expect(Object.keys(stats.byDifficulty)).toEqual(['1', '2', '3', '4'])
  })

  it('gives a separate copy each time', () => {
    const a = createEmptyStatistics()
    const b = createEmptyStatistics()

    expect(a).not.toBe(b)
    expect(a.byOperation.addition).not.toBe(b.byOperation.addition)
  })
})

describe('recordAttemptInStatistics', () => {
  it('counts a right answer in the total, its operation and its level', () => {
    const stats = recordAttemptInStatistics(
      createEmptyStatistics(),
      makeAttempt({
        operation: 'division',
        difficulty: 3,
        selfReportedCorrect: true,
      }),
    )

    expect(stats).toMatchObject({ attempted: 1, correct: 1, incorrect: 0 })
    expect(stats.byOperation.division).toEqual({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })
    expect(stats.byDifficulty[3]).toEqual({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })
  })

  it('counts a wrong answer in the total, its operation and its level', () => {
    const stats = recordAttemptInStatistics(
      createEmptyStatistics(),
      makeAttempt({
        operation: 'subtraction',
        difficulty: 2,
        selfReportedCorrect: false,
      }),
    )

    expect(stats).toMatchObject({ attempted: 1, correct: 0, incorrect: 1 })
    expect(stats.byOperation.subtraction).toEqual({
      attempted: 1,
      correct: 0,
      incorrect: 1,
    })
    expect(stats.byDifficulty[2]).toEqual({
      attempted: 1,
      correct: 0,
      incorrect: 1,
    })
  })

  it('leaves every other operation and level alone', () => {
    const stats = recordAttemptInStatistics(
      createEmptyStatistics(),
      makeAttempt({ operation: 'addition', difficulty: 1 }),
    )

    for (const op of ['subtraction', 'multiplication', 'division'] as const) {
      expect(stats.byOperation[op].attempted).toBe(0)
    }
    for (const level of [2, 3, 4] as const) {
      expect(stats.byDifficulty[level].attempted).toBe(0)
    }
  })

  it('does not change the statistics it was given', () => {
    const before = createEmptyStatistics()
    const snapshot = JSON.stringify(before)

    recordAttemptInStatistics(before, makeAttempt())

    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('adds up across many attempts', () => {
    let stats = createEmptyStatistics()
    for (let i = 0; i < 10; i++) {
      stats = recordAttemptInStatistics(
        stats,
        makeAttempt({
          operation: 'multiplication',
          difficulty: 2,
          selfReportedCorrect: i < 7,
        }),
      )
    }

    expect(stats.byOperation.multiplication).toEqual({
      attempted: 10,
      correct: 7,
      incorrect: 3,
    })
    expect(stats).toMatchObject({ attempted: 10, correct: 7, incorrect: 3 })
  })

  it('keeps every total in agreement for any mix of attempts', () => {
    const random = seededRandom(4242)
    let stats = createEmptyStatistics()
    for (let i = 0; i < 500; i++) {
      stats = recordAttemptInStatistics(
        stats,
        makeAttempt({
          operation: MATH_OPERATIONS[Math.floor(random() * 4)],
          difficulty: DIFFICULTY_LEVELS[Math.floor(random() * 4)],
          selfReportedCorrect: random() < 0.6,
        }),
      )
    }

    expect(stats.attempted).toBe(500)
    expectConsistent(stats)
  })
})

describe('removeAttemptFromStatistics', () => {
  it('undoes recording the same attempt', () => {
    const base = recordAttemptInStatistics(
      createEmptyStatistics(),
      makeAttempt({
        operation: 'addition',
        difficulty: 1,
        selfReportedCorrect: true,
      }),
    )
    const attempt = makeAttempt({
      operation: 'division',
      difficulty: 4,
      selfReportedCorrect: false,
    })

    const roundTrip = removeAttemptFromStatistics(
      recordAttemptInStatistics(base, attempt),
      attempt,
    )

    expect(roundTrip).toEqual(base)
  })

  it('never goes below zero', () => {
    const stats = removeAttemptFromStatistics(
      createEmptyStatistics(),
      makeAttempt(),
    )

    expect(stats).toEqual(createEmptyStatistics())
  })

  it('does not change the statistics it was given', () => {
    const before = recordAttemptInStatistics(
      createEmptyStatistics(),
      makeAttempt(),
    )
    const snapshot = JSON.stringify(before)

    removeAttemptFromStatistics(before, makeAttempt())

    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('statisticsFromAttempts', () => {
  it('is empty statistics for no attempts', () => {
    expect(statisticsFromAttempts([])).toEqual(createEmptyStatistics())
  })

  it('counts a mix of attempts', () => {
    const stats = statisticsFromAttempts([
      makeAttempt({
        id: '1',
        operation: 'addition',
        difficulty: 1,
        selfReportedCorrect: true,
      }),
      makeAttempt({
        id: '2',
        operation: 'addition',
        difficulty: 1,
        selfReportedCorrect: false,
      }),
      makeAttempt({
        id: '3',
        operation: 'division',
        difficulty: 3,
        selfReportedCorrect: true,
      }),
    ])

    expect(stats).toMatchObject({ attempted: 3, correct: 2, incorrect: 1 })
    expect(stats.byOperation.addition).toEqual({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
    expect(stats.byOperation.division).toEqual({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })
    expect(stats.byDifficulty[1]).toEqual({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
    expect(stats.byDifficulty[3]).toEqual({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })
  })

  it('does not depend on the order of the attempts', () => {
    const attempts = [
      makeAttempt({
        id: '1',
        operation: 'addition',
        selfReportedCorrect: true,
      }),
      makeAttempt({
        id: '2',
        operation: 'division',
        difficulty: 4,
        selfReportedCorrect: false,
      }),
      makeAttempt({
        id: '3',
        operation: 'subtraction',
        difficulty: 3,
        selfReportedCorrect: true,
      }),
    ]

    expect(statisticsFromAttempts([...attempts].reverse())).toEqual(
      statisticsFromAttempts(attempts),
    )
  })

  it('gives the same answer as recording them one at a time', () => {
    const attempts = Array.from({ length: 50 }, (_, i) =>
      makeAttempt({
        id: String(i),
        operation: MATH_OPERATIONS[i % 4],
        difficulty: DIFFICULTY_LEVELS[(i * 3) % 4],
        selfReportedCorrect: i % 3 === 0,
      }),
    )
    let stepwise = createEmptyStatistics()
    for (const attempt of attempts)
      stepwise = recordAttemptInStatistics(stepwise, attempt)

    expect(statisticsFromAttempts(attempts)).toEqual(stepwise)
  })

  it('copes with several thousand attempts', () => {
    const attempts = Array.from({ length: 8000 }, (_, i) =>
      makeAttempt({
        id: String(i),
        operation: MATH_OPERATIONS[i % 4],
        difficulty: DIFFICULTY_LEVELS[i % 4],
        selfReportedCorrect: i % 2 === 0,
      }),
    )

    const started = performance.now()
    const stats = statisticsFromAttempts(attempts)
    const elapsed = performance.now() - started

    expect(stats.attempted).toBe(8000)
    expectConsistent(stats)
    expect(elapsed).toBeLessThan(1000)
  })
})

describe('recentSessionRows', () => {
  const at = (day: number) =>
    `2026-03-${String(day).padStart(2, '0')}T12:00:00.000Z`

  it('lists the newest session first', () => {
    const rows = recentSessionRows([
      makeSession({ id: 'old', startedAt: at(1) }),
      makeSession({ id: 'new', startedAt: at(9) }),
      makeSession({ id: 'mid', startedAt: at(5) }),
    ])

    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('sorts by start time, whatever order the sessions were saved in', () => {
    const forward = recentSessionRows([
      makeSession({ id: 'a', startedAt: at(1) }),
      makeSession({ id: 'b', startedAt: at(2) }),
    ])
    const backward = recentSessionRows([
      makeSession({ id: 'b', startedAt: at(2) }),
      makeSession({ id: 'a', startedAt: at(1) }),
    ])

    expect(forward.map((r) => r.id)).toEqual(['b', 'a'])
    expect(backward.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('shows only the 10 most recent by default', () => {
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({ id: `s${i + 1}`, startedAt: at(i + 1) }),
    )

    const rows = recentSessionRows(sessions)

    expect(rows).toHaveLength(10)
    expect(rows[0].id).toBe('s15')
    expect(rows[9].id).toBe('s6')
  })

  it('carries each session\u2019s details and accuracy', () => {
    const [row] = recentSessionRows([
      makeSession({
        id: 's',
        startedAt: at(3),
        operations: ['addition', 'division'],
        difficulty: 3,
        attempted: 10,
        correct: 7,
        incorrect: 3,
        completedAt: at(3),
      }),
    ])

    expect(row).toEqual({
      id: 's',
      startedAt: at(3),
      operations: ['addition', 'division'],
      difficulty: 3,
      attempted: 10,
      correct: 7,
      incorrect: 3,
      accuracy: 70,
      finished: true,
      inProgress: false,
      mistakePractice: false,
    })
  })

  it('marks a mistake-review session, and no other', () => {
    const rows = recentSessionRows([
      makeSession({ id: 'a', startedAt: at(1), mode: 'mistake-review' }),
      makeSession({ id: 'b', startedAt: at(2), mode: 'regular' }),
      makeSession({ id: 'c', startedAt: at(3) }),
    ])

    expect(
      Object.fromEntries(rows.map((r) => [r.id, r.mistakePractice])),
    ).toEqual({
      a: true,
      b: false,
      c: false,
    })
  })

  it('marks a session with no end time as not finished', () => {
    const [row] = recentSessionRows([makeSession({ startedAt: at(3) })])

    expect(row).toMatchObject({ finished: false, inProgress: false })
  })

  it('marks only the session being practiced right now as in progress', () => {
    const rows = recentSessionRows(
      [
        makeSession({ id: 'a', startedAt: at(1) }),
        makeSession({ id: 'b', startedAt: at(2) }),
      ],
      'b',
    )

    expect(rows.find((r) => r.id === 'b')?.inProgress).toBe(true)
    expect(rows.find((r) => r.id === 'a')?.inProgress).toBe(false)
  })

  it('never calls a finished session in progress', () => {
    const [row] = recentSessionRows(
      [makeSession({ id: 'a', completedAt: at(3) })],
      'a',
    )

    expect(row.inProgress).toBe(false)
  })

  it('does not change the list it was given', () => {
    const sessions = [
      makeSession({ id: 'a', startedAt: at(1) }),
      makeSession({ id: 'b', startedAt: at(2) }),
    ]

    recentSessionRows(sessions)

    expect(sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('handles no sessions', () => {
    expect(recentSessionRows([])).toEqual([])
  })
})

describe('buildStatisticsView', () => {
  const sampleStats = statisticsFromAttempts([
    makeAttempt({
      id: '1',
      operation: 'addition',
      difficulty: 1,
      selfReportedCorrect: true,
    }),
    makeAttempt({
      id: '2',
      operation: 'addition',
      difficulty: 1,
      selfReportedCorrect: true,
    }),
    makeAttempt({
      id: '3',
      operation: 'addition',
      difficulty: 2,
      selfReportedCorrect: false,
    }),
    makeAttempt({
      id: '4',
      operation: 'division',
      difficulty: 4,
      selfReportedCorrect: true,
    }),
  ])

  it('says there is no data before anything is answered', () => {
    const view = buildStatisticsView(createEmptyStatistics(), [])

    expect(view.hasData).toBe(false)
    expect(view.overall).toEqual({
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
    })
  })

  it('says there is data once something is answered', () => {
    expect(buildStatisticsView(sampleStats, []).hasData).toBe(true)
  })

  it('gives the overall totals and accuracy', () => {
    expect(buildStatisticsView(sampleStats, []).overall).toEqual({
      attempted: 4,
      correct: 3,
      incorrect: 1,
      accuracy: 75,
    })
  })

  it('has a row for every operation, in a fixed order, even those never practiced', () => {
    const rows = buildStatisticsView(sampleStats, []).byOperation

    expect(rows.map((r) => r.operation)).toEqual([
      'addition',
      'subtraction',
      'multiplication',
      'division',
    ])
    expect(rows[0]).toMatchObject({
      attempted: 3,
      correct: 2,
      incorrect: 1,
      accuracy: 67,
    })
    expect(rows[1]).toMatchObject({
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
    })
    expect(rows[3]).toMatchObject({ attempted: 1, correct: 1, accuracy: 100 })
  })

  it('has a row for every level, 1 to 4, even those never practiced', () => {
    const rows = buildStatisticsView(sampleStats, []).byDifficulty

    expect(rows.map((r) => r.difficulty)).toEqual([1, 2, 3, 4])
    expect(rows[0]).toMatchObject({ attempted: 2, correct: 2, accuracy: 100 })
    expect(rows[1]).toMatchObject({
      attempted: 1,
      correct: 0,
      incorrect: 1,
      accuracy: 0,
    })
    expect(rows[2]).toMatchObject({ attempted: 0 })
    expect(rows[3]).toMatchObject({ attempted: 1, correct: 1 })
  })

  it('never divides by zero for a row with nothing attempted', () => {
    const view = buildStatisticsView(createEmptyStatistics(), [])

    for (const row of [...view.byOperation, ...view.byDifficulty]) {
      expect(Number.isNaN(row.accuracy)).toBe(false)
      expect(row.accuracy).toBe(0)
    }
  })

  it('includes the recent sessions, newest first', () => {
    const view = buildStatisticsView(sampleStats, [
      makeSession({ id: 'a', startedAt: '2026-03-01T12:00:00.000Z' }),
      makeSession({ id: 'b', startedAt: '2026-03-02T12:00:00.000Z' }),
    ])

    expect(view.recentSessions.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('passes the active session on, so it can be labelled', () => {
    const view = buildStatisticsView(
      sampleStats,
      [makeSession({ id: 'a' })],
      'a',
    )

    expect(view.recentSessions[0].inProgress).toBe(true)
  })
})
