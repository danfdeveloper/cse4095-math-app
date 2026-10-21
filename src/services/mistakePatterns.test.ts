import { describe, expect, it } from 'vitest'
import { makeAttempt, makeMistakePattern } from '../test/fixtures'
import { seededRandom } from '../test/seededRandom'
import type { MistakePattern } from '../types/mistake'
import type { DifficultyLevel, MathOperation } from '../types/question'
import type { PracticeAttempt } from '../types/session'
import {
  activePatterns,
  createMistakePattern,
  forgetMistake,
  mistakePatternId,
  patternsAfterAnswer,
  rebuildMistakePatterns,
  recordMistake,
  recordReviewProgress,
  withoutDuplicatePatterns,
} from './mistakePatterns'

const wrong = (overrides: Partial<PracticeAttempt> = {}) =>
  makeAttempt({ selfReportedCorrect: false, ...overrides })
const right = (overrides: Partial<PracticeAttempt> = {}) =>
  makeAttempt({ selfReportedCorrect: true, ...overrides })

describe('mistakePatternId', () => {
  it('is worked out from the operation, both numbers and the level', () => {
    expect(
      mistakePatternId({
        operation: 'multiplication',
        firstOperand: 7,
        secondOperand: 8,
        difficulty: 2,
      }),
    ).toBe('multiplication:7:8:2')
  })

  it('is the same for the same question, however it is asked', () => {
    const a = wrong({ id: 'attempt-a', questionId: 'q-a' })
    const b = wrong({ id: 'attempt-b', questionId: 'q-b' })

    expect(mistakePatternId(a)).toBe(mistakePatternId(b))
  })

  it.each([
    ['another operation', { operation: 'addition' as const }],
    ['another first number', { firstOperand: 8 }],
    ['another second number', { secondOperand: 9 }],
    ['another level', { difficulty: 3 as const }],
    ['the numbers the other way round', { firstOperand: 8, secondOperand: 7 }],
  ])('is different for %s', (_, change) => {
    expect(mistakePatternId(wrong(change))).not.toBe(mistakePatternId(wrong()))
  })
})

describe('creating a pattern after an incorrect answer (Task 51)', () => {
  const attempt = wrong({
    operation: 'division',
    firstOperand: 56,
    secondOperand: 7,
    correctAnswer: 8,
    difficulty: 3,
    attemptedAt: '2026-05-06T07:08:09.000Z',
  })

  it('stores the operation, both numbers, the answer and the level', () => {
    expect(createMistakePattern(attempt)).toMatchObject({
      operation: 'division',
      firstOperand: 56,
      secondOperand: 7,
      correctAnswer: 8,
      difficulty: 3,
    })
  })

  it('stores when it was last answered incorrectly', () => {
    expect(createMistakePattern(attempt).lastIncorrectAt).toBe(
      '2026-05-06T07:08:09.000Z',
    )
  })

  it('starts with one mistake, no similar questions answered, and not mastered', () => {
    expect(createMistakePattern(attempt)).toMatchObject({
      incorrectCount: 1,
      similarCorrectCount: 0,
      mastered: false,
    })
  })

  it('is made by recording the first incorrect answer', () => {
    const patterns = recordMistake([], attempt)

    expect(patterns).toEqual([createMistakePattern(attempt)])
    expect(patterns[0].id).toBe(mistakePatternId(attempt))
  })

  it('is not made by a correct answer', () => {
    expect(recordMistake([], right())).toEqual([])
  })

  it('gives back the very same list for a correct answer, so nothing is saved again', () => {
    const patterns = [makeMistakePattern()]

    expect(recordMistake(patterns, right())).toBe(patterns)
  })

  it('goes by what the student reported, not by which choice was picked', () => {
    // Picked the right choice but said it went wrong, and the other way round.
    expect(
      recordMistake([], wrong({ selectedAnswer: 56, correctAnswer: 56 })),
    ).toHaveLength(1)
    expect(
      recordMistake([], right({ selectedAnswer: 54, correctAnswer: 56 })),
    ).toHaveLength(0)
  })

  it('adds new patterns after the ones already there', () => {
    const first = recordMistake([], wrong())
    const second = recordMistake(first, wrong({ firstOperand: 6 }))

    expect(second.map((pattern) => pattern.firstOperand)).toEqual([7, 6])
  })

  it('does not change the list it was given', () => {
    const patterns = [makeMistakePattern()]
    const before = structuredClone(patterns)

    recordMistake(patterns, wrong())
    recordMistake(patterns, wrong({ firstOperand: 6 }))

    expect(patterns).toEqual(before)
  })
})

describe('updating an existing pattern (Task 52)', () => {
  const first = wrong({ attemptedAt: '2026-03-04T10:00:00.000Z' })
  const again = wrong({
    id: 'attempt-2',
    attemptedAt: '2026-03-05T11:00:00.000Z',
  })

  it('finds the same pattern and counts one more mistake', () => {
    const once = recordMistake([], first)
    const twice = recordMistake(once, again)

    expect(twice).toHaveLength(1)
    expect(twice[0].incorrectCount).toBe(2)
  })

  it('updates the last-incorrect time', () => {
    const twice = recordMistake(recordMistake([], first), again)

    expect(twice[0].lastIncorrectAt).toBe('2026-03-05T11:00:00.000Z')
  })

  it('never moves the last-incorrect time back to an earlier one', () => {
    const later = recordMistake([], again)
    const earlier = recordMistake(later, first)

    expect(earlier[0].incorrectCount).toBe(2)
    expect(earlier[0].lastIncorrectAt).toBe('2026-03-05T11:00:00.000Z')
  })

  it('copes with a time that cannot be read', () => {
    const readable = recordMistake([], first)

    expect(
      recordMistake(readable, wrong({ attemptedAt: 'not a date' }))[0]
        .lastIncorrectAt,
    ).toBe('2026-03-04T10:00:00.000Z')
    expect(
      recordMistake(
        [makeMistakePattern({ lastIncorrectAt: 'not a date' })],
        first,
      )[0].lastIncorrectAt,
    ).toBe('2026-03-04T10:00:00.000Z')
  })

  it('starts progress toward mastery again', () => {
    const progressing = [
      makeMistakePattern({ incorrectCount: 1, similarCorrectCount: 2 }),
    ]

    const [updated] = recordMistake(progressing, wrong())

    expect(updated.similarCorrectCount).toBe(0)
    expect(updated.incorrectCount).toBe(2)
  })

  it('brings a mastered pattern back', () => {
    const mastered = [
      makeMistakePattern({ similarCorrectCount: 3, mastered: true }),
    ]

    const [updated] = recordMistake(mastered, wrong())

    expect(updated.mastered).toBe(false)
    expect(updated.similarCorrectCount).toBe(0)
  })

  it('keeps the pattern where it was in the list', () => {
    const patterns = [
      makeMistakePattern({
        firstOperand: 3,
        secondOperand: 4,
        correctAnswer: 12,
      }),
      makeMistakePattern(),
      makeMistakePattern({
        firstOperand: 5,
        secondOperand: 6,
        correctAnswer: 30,
      }),
    ]

    const updated = recordMistake(patterns, wrong())

    expect(updated.map((pattern) => pattern.firstOperand)).toEqual([3, 7, 5])
    expect(updated[1].incorrectCount).toBe(2)
    expect(updated[0]).toBe(patterns[0])
    expect(updated[2]).toBe(patterns[2])
  })

  it('never makes a second record, however often the same question is missed', () => {
    let patterns: MistakePattern[] = []
    for (let i = 0; i < 25; i++) patterns = recordMistake(patterns, wrong())

    expect(patterns).toHaveLength(1)
    expect(patterns[0].incorrectCount).toBe(25)
  })

  it('does not change the pattern it was given', () => {
    const original = makeMistakePattern()
    const before = structuredClone(original)

    recordMistake([original], wrong())

    expect(original).toEqual(before)
  })

  it.each([
    ['the numbers the other way round', { firstOperand: 8, secondOperand: 7 }],
    ['another level', { difficulty: 3 as const }],
    [
      'another operation',
      { operation: 'addition' as const, correctAnswer: 15 },
    ],
    ['other numbers', { firstOperand: 6, correctAnswer: 48 }],
  ])('keeps a separate pattern for %s', (_, change) => {
    const patterns = recordMistake(recordMistake([], wrong()), wrong(change))

    expect(patterns).toHaveLength(2)
    expect(patterns.map((pattern) => pattern.incorrectCount)).toEqual([1, 1])
  })

  it('leaves the other patterns alone when a different question is missed', () => {
    const existing = recordMistake([], wrong({ firstOperand: 3 }))
    const added = recordMistake(existing, wrong())

    expect(added[0]).toBe(existing[0])
  })
})

describe('forgetMistake', () => {
  it('takes one mistake back', () => {
    const patterns = [makeMistakePattern({ incorrectCount: 3 })]

    expect(forgetMistake(patterns, wrong())[0].incorrectCount).toBe(2)
  })

  it('removes a pattern whose only mistake is taken back', () => {
    const patterns = [
      makeMistakePattern({
        firstOperand: 3,
        secondOperand: 4,
        correctAnswer: 12,
      }),
      makeMistakePattern(),
    ]

    expect(forgetMistake(patterns, wrong())).toEqual([patterns[0]])
  })

  it('does nothing for a correct answer, or for a question with no pattern', () => {
    const patterns = [makeMistakePattern()]

    expect(forgetMistake(patterns, right())).toBe(patterns)
    expect(forgetMistake(patterns, wrong({ firstOperand: 1 }))).toBe(patterns)
  })

  it('undoes what recording did', () => {
    const attempts = [wrong(), wrong({ firstOperand: 4 }), wrong()]
    const recorded = rebuildMistakePatterns(attempts)

    const undone = attempts.reduceRight(forgetMistake, recorded)

    expect(undone).toEqual([])
  })

  it('does not change the list it was given', () => {
    const patterns = [makeMistakePattern({ incorrectCount: 2 })]
    const before = structuredClone(patterns)

    forgetMistake(patterns, wrong())

    expect(patterns).toEqual(before)
  })
})

describe('rebuildMistakePatterns', () => {
  it('is empty when there are no attempts, or none were incorrect', () => {
    expect(rebuildMistakePatterns([])).toEqual([])
    expect(
      rebuildMistakePatterns([right(), right({ firstOperand: 2 })]),
    ).toEqual([])
  })

  it('makes one pattern for each question missed, with its count and latest time', () => {
    const patterns = rebuildMistakePatterns([
      wrong({ attemptedAt: '2026-03-01T10:00:00.000Z' }),
      right({ firstOperand: 4, secondOperand: 5, correctAnswer: 20 }),
      wrong({ firstOperand: 3, secondOperand: 4, correctAnswer: 12 }),
      wrong({ attemptedAt: '2026-03-09T10:00:00.000Z' }),
    ])

    expect(patterns).toHaveLength(2)
    expect(patterns[0]).toMatchObject({
      firstOperand: 7,
      incorrectCount: 2,
      lastIncorrectAt: '2026-03-09T10:00:00.000Z',
    })
    expect(patterns[1]).toMatchObject({ firstOperand: 3, incorrectCount: 1 })
  })

  it('starts every pattern with no progress toward mastery', () => {
    const patterns = rebuildMistakePatterns([wrong(), wrong(), wrong()])

    expect(patterns[0]).toMatchObject({
      similarCorrectCount: 0,
      mastered: false,
    })
  })
})

describe('withoutDuplicatePatterns', () => {
  it('keeps the first of any repeated pattern, in order', () => {
    const a = makeMistakePattern({ incorrectCount: 5 })
    const b = makeMistakePattern({
      firstOperand: 3,
      secondOperand: 4,
      correctAnswer: 12,
    })
    const aAgain = makeMistakePattern({ incorrectCount: 1 })

    expect(withoutDuplicatePatterns([a, b, aAgain])).toEqual([a, b])
  })

  it('leaves a list without repeats as it is', () => {
    const patterns = [makeMistakePattern()]

    expect(withoutDuplicatePatterns(patterns)).toEqual(patterns)
  })
})

describe('over a long run of random answers', () => {
  const OPERATIONS: MathOperation[] = [
    'addition',
    'subtraction',
    'multiplication',
    'division',
  ]
  const LEVELS: DifficultyLevel[] = [1, 2, 3, 4]

  function randomAttempts(count: number, seed: number): PracticeAttempt[] {
    const random = seededRandom(seed)
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)]
    const start = Date.parse('2026-01-01T00:00:00.000Z')
    return Array.from({ length: count }, (_, i) =>
      makeAttempt({
        id: `attempt-${i}`,
        operation: pick(OPERATIONS),
        // Few distinct numbers, so the same question comes round again and again.
        firstOperand: pick([1, 2, 3, 4]),
        secondOperand: pick([1, 2, 3]),
        difficulty: pick(LEVELS),
        selfReportedCorrect: random() < 0.5,
        attemptedAt: new Date(start + i * 60_000).toISOString(),
      }),
    )
  }

  it.each([11, 12, 13])(
    'the patterns agree with a plain recount (seed %i)',
    (seed) => {
      const attempts = randomAttempts(1500, seed)

      const patterns = rebuildMistakePatterns(attempts)

      const wrongAnswers = attempts.filter((a) => !a.selfReportedCorrect)
      // One pattern per distinct question missed, and no repeats.
      const ids = new Set(wrongAnswers.map((a) => mistakePatternId(a)))
      expect(patterns).toHaveLength(ids.size)
      expect(new Set(patterns.map((p) => p.id)).size).toBe(patterns.length)
      // Every mistake is counted exactly once.
      expect(patterns.reduce((sum, p) => sum + p.incorrectCount, 0)).toBe(
        wrongAnswers.length,
      )
      for (const pattern of patterns) {
        const mine = wrongAnswers.filter(
          (a) => mistakePatternId(a) === pattern.id,
        )
        expect(pattern.incorrectCount).toBe(mine.length)
        expect(pattern.lastIncorrectAt).toBe(mine[mine.length - 1].attemptedAt)
        expect(pattern.incorrectCount).toBeGreaterThanOrEqual(1)
      }
    },
  )

  it('taking every mistake back, newest first, leaves nothing', () => {
    const attempts = randomAttempts(800, 21)

    const patterns = attempts.reduceRight(
      forgetMistake,
      rebuildMistakePatterns(attempts),
    )

    expect(patterns).toEqual([])
  })
})

describe('activePatterns', () => {
  const division = makeMistakePattern({
    operation: 'division',
    firstOperand: 56,
    secondOperand: 7,
    correctAnswer: 8,
    difficulty: 3,
  })
  const multiplication = makeMistakePattern() // 7 × 8, Level 2
  const mastered = makeMistakePattern({
    firstOperand: 6,
    secondOperand: 4,
    correctAnswer: 24,
    similarCorrectCount: 3,
    mastered: true,
  })
  const all = [multiplication, division, mastered]

  it('is every mistake that is not yet mastered', () => {
    expect(activePatterns(all)).toEqual([multiplication, division])
  })

  it('is empty when every mistake is mastered, or there are none', () => {
    expect(activePatterns([mastered])).toEqual([])
    expect(activePatterns([])).toEqual([])
  })

  it('can be limited to some operations at one level', () => {
    expect(
      activePatterns(all, { operations: ['multiplication'], difficulty: 2 }),
    ).toEqual([multiplication])
    expect(
      activePatterns(all, { operations: ['division'], difficulty: 3 }),
    ).toEqual([division])
  })

  it('goes by the mistake’s own operation, so a list of operations covers each', () => {
    expect(
      activePatterns(all, {
        operations: ['division', 'multiplication'],
        difficulty: 3,
      }),
    ).toEqual([division])
    expect(
      activePatterns(all, {
        operations: ['addition', 'multiplication', 'division'],
        difficulty: 2,
      }),
    ).toEqual([multiplication])
  })

  it('leaves out other levels and other operations', () => {
    expect(
      activePatterns(all, { operations: ['multiplication'], difficulty: 3 }),
    ).toEqual([])
    expect(
      activePatterns(all, { operations: ['addition'], difficulty: 2 }),
    ).toEqual([])
    expect(activePatterns(all, { operations: [], difficulty: 2 })).toEqual([])
  })

  it('never includes a mastered mistake, whatever the scope', () => {
    expect(
      activePatterns(all, { operations: ['multiplication'], difficulty: 2 }),
    ).not.toContain(mastered)
  })

  it('does not change the list it was given', () => {
    const before = structuredClone(all)

    activePatterns(all, { operations: ['division'], difficulty: 3 })

    expect(all).toEqual(before)
  })
})

describe('recordReviewProgress', () => {
  const pattern = (overrides: Partial<MistakePattern> = {}) =>
    makeMistakePattern(overrides)

  it('moves a correct answer one step toward mastery', () => {
    const [updated] = recordReviewProgress([pattern()], pattern().id, true, 3)

    expect(updated.similarCorrectCount).toBe(1)
    expect(updated.mastered).toBe(false)
  })

  it('masters the mistake on the answer that reaches the threshold, and not before', () => {
    let patterns = [pattern()]
    const states: [number, boolean][] = []
    for (let i = 0; i < 3; i++) {
      patterns = recordReviewProgress(patterns, patterns[0].id, true, 3)
      states.push([patterns[0].similarCorrectCount, patterns[0].mastered])
    }

    expect(states).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ])
  })

  it.each([
    [1, 1],
    [2, 2],
    [5, 5],
    [10, 10],
  ])(
    'masters at a threshold of %i after %i correct answers',
    (threshold, needed) => {
      let patterns = [pattern()]
      for (let i = 1; i < needed; i++) {
        patterns = recordReviewProgress(
          patterns,
          patterns[0].id,
          true,
          threshold,
        )
        expect(patterns[0].mastered, `after ${i}`).toBe(false)
      }

      patterns = recordReviewProgress(patterns, patterns[0].id, true, threshold)

      expect(patterns[0].mastered).toBe(true)
    },
  )

  it('moves an incorrect answer one step back', () => {
    const [updated] = recordReviewProgress(
      [pattern({ similarCorrectCount: 2 })],
      pattern().id,
      false,
      3,
    )

    expect(updated.similarCorrectCount).toBe(1)
    expect(updated.mastered).toBe(false)
  })

  it('never goes below no progress at all', () => {
    const [updated] = recordReviewProgress([pattern()], pattern().id, false, 3)

    expect(updated.similarCorrectCount).toBe(0)
  })

  it('takes a mastered mistake out of mastered when an answer goes wrong', () => {
    const [updated] = recordReviewProgress(
      [pattern({ similarCorrectCount: 3, mastered: true })],
      pattern().id,
      false,
      3,
    )

    expect(updated).toMatchObject({ similarCorrectCount: 2, mastered: false })
  })

  it('keeps a mastered mistake mastered on a correct answer, even if the threshold was raised', () => {
    const [updated] = recordReviewProgress(
      [pattern({ similarCorrectCount: 3, mastered: true })],
      pattern().id,
      true,
      5,
    )

    expect(updated).toMatchObject({ similarCorrectCount: 4, mastered: true })
  })

  it('does not call a mistake mastered because the threshold was lowered under it, until an answer is right', () => {
    // 2 of 3 so far; the threshold is lowered to 2, but nothing was answered.
    const patterns = [pattern({ similarCorrectCount: 2 })]

    expect(patterns[0].mastered).toBe(false)
    expect(
      recordReviewProgress(patterns, pattern().id, false, 2)[0].mastered,
    ).toBe(false)
    expect(
      recordReviewProgress(patterns, pattern().id, true, 2)[0].mastered,
    ).toBe(true)
  })

  it('does not change how often the question itself was missed, or when', () => {
    const before = pattern({
      incorrectCount: 4,
      lastIncorrectAt: '2026-02-02T02:02:02.000Z',
    })

    for (const correct of [true, false]) {
      const [updated] = recordReviewProgress([before], before.id, correct, 3)
      expect(updated.incorrectCount).toBe(4)
      expect(updated.lastIncorrectAt).toBe('2026-02-02T02:02:02.000Z')
    }
  })

  it('leaves the other mistakes alone', () => {
    const a = pattern({ firstOperand: 1, secondOperand: 1, correctAnswer: 1 })
    const b = pattern()
    const c = pattern({ firstOperand: 2, secondOperand: 2, correctAnswer: 4 })

    const updated = recordReviewProgress([a, b, c], b.id, true, 3)

    expect(updated[0]).toBe(a)
    expect(updated[2]).toBe(c)
    expect(updated[1].similarCorrectCount).toBe(1)
  })

  it('gives back the same list when the mistake is not there any more', () => {
    const patterns = [pattern()]

    expect(recordReviewProgress(patterns, 'gone:1:1:1', true, 3)).toBe(patterns)
  })

  it('does not change the pattern it was given', () => {
    const original = pattern()
    const before = structuredClone(original)

    recordReviewProgress([original], original.id, true, 3)

    expect(original).toEqual(before)
  })
})

describe('patternsAfterAnswer', () => {
  const regular = { source: 'regular' as const }
  const reviewOf = (id: string) => ({
    source: 'mistake-review' as const,
    mistakePatternId: id,
  })
  const source = makeMistakePattern({ similarCorrectCount: 1 }) // 7 × 8
  // A question that is similar to 7 × 8: 8 × 8.
  const similar = (correct: boolean) =>
    makeAttempt({
      selfReportedCorrect: correct,
      firstOperand: 8,
      secondOperand: 8,
      correctAnswer: 64,
      source: 'mistake-review',
    })

  it('does nothing for a correct answer to a regular question', () => {
    const patterns = [source]

    expect(patternsAfterAnswer(patterns, regular, right(), 3)).toBe(patterns)
  })

  it('moves no mistake for a regular question, even one that carries a mistake ID', () => {
    // Only a question marked as review comes from a mistake. This one cannot
    // exist, but the rule is that the mark, not the ID alone, decides.
    const patterns = [source]

    expect(
      patternsAfterAnswer(
        patterns,
        { source: 'regular', mistakePatternId: source.id },
        similar(true),
        3,
      ),
    ).toBe(patterns)
  })

  it('records an incorrect answer to a regular question as a mistake', () => {
    const result = patternsAfterAnswer([], regular, wrong(), 3)

    expect(result).toEqual([createMistakePattern(wrong())])
  })

  it('moves the mistake forward for a correct review answer, and makes no new one', () => {
    const result = patternsAfterAnswer(
      [source],
      reviewOf(source.id),
      similar(true),
      3,
    )

    expect(result).toHaveLength(1)
    expect(result[0].similarCorrectCount).toBe(2)
  })

  it('masters the mistake when the review answer reaches the threshold', () => {
    const result = patternsAfterAnswer(
      [{ ...source, similarCorrectCount: 2 }],
      reviewOf(source.id),
      similar(true),
      3,
    )

    expect(result[0]).toMatchObject({ similarCorrectCount: 3, mastered: true })
  })

  it('moves the mistake back for an incorrect review answer, and the missed question becomes a mistake of its own', () => {
    const result = patternsAfterAnswer(
      [source],
      reviewOf(source.id),
      similar(false),
      3,
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: source.id, similarCorrectCount: 0 })
    expect(result[1]).toMatchObject({
      firstOperand: 8,
      secondOperand: 8,
      incorrectCount: 1,
    })
  })

  it('updates an existing mistake that the missed review question matches', () => {
    const eightTimesEight = makeMistakePattern({
      firstOperand: 8,
      secondOperand: 8,
      correctAnswer: 64,
      incorrectCount: 2,
      similarCorrectCount: 2,
    })

    const result = patternsAfterAnswer(
      [source, eightTimesEight],
      reviewOf(source.id),
      similar(false),
      3,
    )

    expect(result).toHaveLength(2)
    expect(result[0].similarCorrectCount).toBe(0) // the source, a step back from 1
    expect(result[1]).toMatchObject({
      incorrectCount: 3,
      similarCorrectCount: 0, // missed again, so its progress starts again
    })
  })

  it('brings a mastered mistake back when the review question that was missed is its question', () => {
    const masteredEightTimesEight = makeMistakePattern({
      firstOperand: 8,
      secondOperand: 8,
      correctAnswer: 64,
      incorrectCount: 1,
      similarCorrectCount: 3,
      mastered: true,
    })

    const result = patternsAfterAnswer(
      [source, masteredEightTimesEight],
      reviewOf(source.id),
      similar(false),
      3,
    )

    expect(result[1]).toMatchObject({
      incorrectCount: 2,
      similarCorrectCount: 0,
      mastered: false,
    })
    expect(activePatterns(result).map((p) => p.id)).toContain(
      masteredEightTimesEight.id,
    )
  })

  it('treats a review question with no mistake attached like a regular one', () => {
    expect(
      patternsAfterAnswer(
        [source],
        { source: 'mistake-review' },
        similar(true),
        3,
      ),
    ).toEqual([source])
  })

  it('copes with a mistake that is not there any more', () => {
    const result = patternsAfterAnswer(
      [source],
      reviewOf('gone:1:1:1'),
      similar(true),
      3,
    )

    expect(result).toEqual([source])
  })

  it('does not change the list it was given', () => {
    const patterns = [source]
    const before = structuredClone(patterns)

    patternsAfterAnswer(patterns, reviewOf(source.id), similar(false), 3)

    expect(patterns).toEqual(before)
  })
})
