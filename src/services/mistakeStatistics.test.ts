import { describe, expect, it } from 'vitest'
import { makeAttempt, makeMistakePattern } from '../test/fixtures'
import type { MistakePattern } from '../types/mistake'
import {
  buildMistakeStatistics,
  MISSED_FACTS_SHOWN,
  missedFacts,
  mostMissedOperation,
  sortMistakePatterns,
  splitMistakes,
} from './mistakeStatistics'

const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}T10:00:00.000Z`

/** A mistake: its operation and numbers, how often it was missed, and when last. */
function mistake(
  operation: MistakePattern['operation'],
  a: number,
  b: number,
  incorrectCount: number,
  lastDay: number,
  overrides: Partial<MistakePattern> = {},
): MistakePattern {
  const answer = {
    addition: a + b,
    subtraction: a - b,
    multiplication: a * b,
    division: a / b,
  }[operation]
  return makeMistakePattern({
    operation,
    firstOperand: a,
    secondOperand: b,
    correctAnswer: answer,
    incorrectCount,
    lastIncorrectAt: day(lastDay),
    ...overrides,
  })
}

const ids = (patterns: MistakePattern[]) => patterns.map((p) => p.id)

describe('sortMistakePatterns (Task 64)', () => {
  it('puts the most often missed first', () => {
    const a = mistake('multiplication', 7, 8, 2, 5)
    const b = mistake('multiplication', 6, 4, 7, 1)
    const c = mistake('multiplication', 3, 3, 4, 9)

    expect(ids(sortMistakePatterns([a, b, c]))).toEqual([b.id, c.id, a.id])
  })

  it('breaks a tie by the more recent miss', () => {
    const older = mistake('multiplication', 7, 8, 3, 2)
    const newer = mistake('multiplication', 6, 4, 3, 9)

    expect(ids(sortMistakePatterns([older, newer]))).toEqual([
      newer.id,
      older.id,
    ])
    expect(ids(sortMistakePatterns([newer, older]))).toEqual([
      newer.id,
      older.id,
    ])
  })

  it('then keeps a fixed order, whatever order they come in', () => {
    // Same count, same time: by operation, then numbers, then level.
    const add = mistake('addition', 9, 9, 3, 5)
    const mulSmall = mistake('multiplication', 2, 9, 3, 5)
    const mulBig = mistake('multiplication', 3, 1, 3, 5)
    const mulLevel2 = mistake('multiplication', 3, 1, 3, 5, { difficulty: 2 })
    const mulLevel3 = mistake('multiplication', 3, 1, 3, 5, { difficulty: 3 })
    const expected = [add, mulSmall, mulBig, mulLevel2, mulLevel3].map(
      (p) => p.id,
    )
    const ordered = [add, mulSmall, mulLevel2, mulBig, mulLevel3]

    for (const arrangement of [
      ordered,
      [...ordered].reverse(),
      [ordered[2], ordered[4], ordered[0], ordered[3], ordered[1]],
    ]) {
      expect(ids(sortMistakePatterns(arrangement))).toEqual(expected)
    }
  })

  it('puts a mistake with an unreadable date after one with a date, when tied', () => {
    const dated = mistake('multiplication', 7, 8, 3, 5)
    const undated = mistake('multiplication', 6, 4, 3, 5, {
      lastIncorrectAt: 'sometime',
    })

    expect(ids(sortMistakePatterns([undated, dated]))).toEqual([
      dated.id,
      undated.id,
    ])
  })

  it('copes with two unreadable dates', () => {
    const a = mistake('multiplication', 7, 8, 3, 5, { lastIncorrectAt: 'x' })
    const b = mistake('multiplication', 6, 4, 3, 5, { lastIncorrectAt: 'y' })

    expect(ids(sortMistakePatterns([a, b]))).toEqual([b.id, a.id]) // by the numbers: 6 × 4 first
  })

  it('does not change the list it was given', () => {
    const patterns = [
      mistake('addition', 1, 2, 1, 1),
      mistake('addition', 3, 4, 9, 2),
    ]
    const before = structuredClone(patterns)

    sortMistakePatterns(patterns)

    expect(patterns).toEqual(before)
  })

  it('is empty for no mistakes', () => {
    expect(sortMistakePatterns([])).toEqual([])
  })
})

describe('splitMistakes (Task 65)', () => {
  const a = mistake('multiplication', 7, 8, 5, 3)
  const b = mistake('multiplication', 6, 4, 2, 3)
  const m1 = mistake('addition', 5, 5, 9, 3, {
    mastered: true,
    similarCorrectCount: 3,
  })
  const m2 = mistake('addition', 4, 4, 1, 3, {
    mastered: true,
    similarCorrectCount: 3,
  })

  it('separates the mistakes to practice from the mastered ones, each most missed first', () => {
    const { active, mastered } = splitMistakes([b, m2, a, m1])

    expect(ids(active)).toEqual([a.id, b.id])
    expect(ids(mastered)).toEqual([m1.id, m2.id])
  })

  it('has empty lists when there is nothing of one kind', () => {
    expect(splitMistakes([a])).toEqual({ active: [a], mastered: [] })
    expect(splitMistakes([m1])).toEqual({ active: [], mastered: [m1] })
    expect(splitMistakes([])).toEqual({ active: [], mastered: [] })
  })
})

describe('missedFacts (Task 64)', () => {
  it('lists the questions missed most, with how often', () => {
    const facts = missedFacts([
      mistake('multiplication', 7, 8, 2, 4),
      mistake('division', 56, 7, 5, 1),
      mistake('addition', 6, 7, 3, 2),
    ])

    expect(
      facts.map((f) => [
        f.operation,
        f.firstOperand,
        f.secondOperand,
        f.misses,
      ]),
    ).toEqual([
      ['division', 56, 7, 5],
      ['addition', 6, 7, 3],
      ['multiplication', 7, 8, 2],
    ])
  })

  it('carries the answer and when it was last missed', () => {
    const [fact] = missedFacts([mistake('multiplication', 7, 8, 2, 4)])

    expect(fact).toMatchObject({ correctAnswer: 56, lastIncorrectAt: day(4) })
  })

  it('counts the same question missed at different levels as one fact', () => {
    const facts = missedFacts([
      mistake('multiplication', 7, 8, 2, 3, { difficulty: 2 }),
      mistake('multiplication', 7, 8, 4, 9, { difficulty: 3 }),
    ])

    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ misses: 6, lastIncorrectAt: day(9) })
  })

  it('keeps the later date whichever level it was found in first', () => {
    const [a] = missedFacts([
      mistake('multiplication', 7, 8, 1, 9, { difficulty: 3 }),
      mistake('multiplication', 7, 8, 1, 3, { difficulty: 2 }),
    ])

    expect(a.lastIncorrectAt).toBe(day(9))
  })

  it('does not join 7 × 8 and 8 × 7, or a sum and a product of the same numbers', () => {
    const facts = missedFacts([
      mistake('multiplication', 7, 8, 1, 1),
      mistake('multiplication', 8, 7, 1, 2),
      mistake('addition', 7, 8, 1, 3),
    ])

    expect(facts).toHaveLength(3)
  })

  it('does not join questions that share a first number but not a second', () => {
    const facts = missedFacts([
      mistake('multiplication', 7, 8, 2, 1),
      mistake('multiplication', 7, 9, 3, 2),
    ])

    expect(facts.map((f) => [f.secondOperand, f.misses])).toEqual([
      [9, 3],
      [8, 2],
    ])
  })

  it('breaks ties by the more recent miss, then in a fixed order', () => {
    const facts = missedFacts([
      mistake('multiplication', 7, 8, 3, 2),
      mistake('addition', 1, 1, 3, 2),
      mistake('multiplication', 6, 4, 3, 9),
      mistake('multiplication', 5, 5, 3, 2),
    ])

    expect(facts.map((f) => `${f.operation}:${f.firstOperand}`)).toEqual([
      'multiplication:6', // missed most recently
      'addition:1', // then by operation
      'multiplication:5', // then by numbers
      'multiplication:7',
    ])
  })

  it('lists at most five by default, and can be told another number', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      mistake('addition', i, 1, 10 - i, 1),
    )

    expect(missedFacts(many)).toHaveLength(MISSED_FACTS_SHOWN)
    expect(MISSED_FACTS_SHOWN).toBe(5)
    expect(missedFacts(many, 2)).toHaveLength(2)
    expect(missedFacts(many, 20)).toHaveLength(9)
  })

  it('keeps the five that were missed most', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      mistake('addition', i, 1, i + 1, 1),
    )

    expect(missedFacts(many).map((f) => f.misses)).toEqual([9, 8, 7, 6, 5])
  })

  it('is empty for no mistakes', () => {
    expect(missedFacts([])).toEqual([])
  })

  it('does not change what it was given', () => {
    const patterns = [
      mistake('addition', 1, 1, 2, 1),
      mistake('addition', 1, 1, 3, 2, { difficulty: 3 }),
    ]
    const before = structuredClone(patterns)

    missedFacts(patterns)

    expect(patterns).toEqual(before)
  })
})

describe('mostMissedOperation (Task 64)', () => {
  it('is the operation with the most misses added up over its mistakes', () => {
    expect(
      mostMissedOperation([
        mistake('addition', 1, 2, 3, 1),
        mistake('addition', 4, 5, 3, 1),
        mistake('division', 56, 7, 5, 1),
      ]),
    ).toEqual({ operations: ['addition'], misses: 6 })
  })

  it('counts misses, not mistakes', () => {
    // Three different additions missed once each, against one division missed four times.
    expect(
      mostMissedOperation([
        mistake('addition', 1, 2, 1, 1),
        mistake('addition', 4, 5, 1, 1),
        mistake('addition', 6, 7, 1, 1),
        mistake('division', 56, 7, 4, 1),
      ]),
    ).toEqual({ operations: ['division'], misses: 4 })
  })

  it('gives every operation tied for most, in the usual order', () => {
    expect(
      mostMissedOperation([
        mistake('division', 56, 7, 4, 1),
        mistake('addition', 1, 2, 4, 1),
        mistake('multiplication', 7, 8, 4, 1),
        mistake('subtraction', 9, 1, 2, 1),
      ]),
    ).toEqual({
      operations: ['addition', 'multiplication', 'division'],
      misses: 4,
    })
  })

  it('counts mastered mistakes too, since they were missed', () => {
    expect(
      mostMissedOperation([
        mistake('addition', 1, 2, 5, 1, {
          mastered: true,
          similarCorrectCount: 3,
        }),
        mistake('division', 56, 7, 4, 1),
      ]),
    ).toEqual({ operations: ['addition'], misses: 5 })
  })

  it('counts the same fact at several levels', () => {
    expect(
      mostMissedOperation([
        mistake('multiplication', 7, 8, 2, 1, { difficulty: 2 }),
        mistake('multiplication', 7, 8, 2, 1, { difficulty: 3 }),
        mistake('addition', 1, 2, 3, 1),
      ]),
    ).toEqual({ operations: ['multiplication'], misses: 4 })
  })

  it('is nothing when nothing has been missed', () => {
    expect(mostMissedOperation([])).toBeNull()
  })

  it('is nothing for mistakes that somehow count no misses', () => {
    expect(mostMissedOperation([mistake('addition', 1, 2, 0, 1)])).toBeNull()
  })
})

describe('buildMistakeStatistics (Task 63)', () => {
  const review = (id: string, correct: boolean) =>
    makeAttempt({ id, source: 'mistake-review', selfReportedCorrect: correct })
  const regular = (id: string, correct: boolean) =>
    makeAttempt({ id, source: 'regular', selfReportedCorrect: correct })

  it('counts the mistakes to practice and the mastered ones', () => {
    const stats = buildMistakeStatistics(
      [
        mistake('addition', 1, 2, 1, 1),
        mistake('addition', 3, 4, 1, 1),
        mistake('addition', 5, 6, 1, 1, {
          mastered: true,
          similarCorrectCount: 3,
        }),
      ],
      [],
    )

    expect(stats.active).toBe(2)
    expect(stats.mastered).toBe(1)
  })

  it('counts the review questions answered, and those answered correctly', () => {
    const stats = buildMistakeStatistics(
      [],
      [
        review('a', true),
        review('b', false),
        review('c', true),
        regular('d', true),
        regular('e', false),
      ],
    )

    expect(stats.similarPracticed).toBe(3)
    expect(stats.similarCorrect).toBe(2)
  })

  it('counts nothing from regular practice', () => {
    const stats = buildMistakeStatistics(
      [],
      [regular('a', true), regular('b', false)],
    )

    expect(stats.similarPracticed).toBe(0)
    expect(stats.similarCorrect).toBe(0)
  })

  it('includes the most missed operation and the missed facts', () => {
    const stats = buildMistakeStatistics(
      [mistake('division', 56, 7, 3, 1), mistake('addition', 1, 2, 1, 1)],
      [],
    )

    expect(stats.mostMissedOperation).toEqual({
      operations: ['division'],
      misses: 3,
    })
    expect(stats.missedFacts.map((f) => f.operation)).toEqual([
      'division',
      'addition',
    ])
  })

  it('is all zeros and nothing for no mistakes and no attempts', () => {
    expect(buildMistakeStatistics([], [])).toEqual({
      active: 0,
      mastered: 0,
      similarPracticed: 0,
      similarCorrect: 0,
      mostMissedOperation: null,
      missedFacts: [],
    })
  })
})
