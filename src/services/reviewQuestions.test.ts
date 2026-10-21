import { describe, expect, it } from 'vitest'
import { makeAttempt, makeMistakePattern } from '../test/fixtures'
import { seededRandom } from '../test/seededRandom'
import type { MistakePattern } from '../types/mistake'
import { getQuestionProblems } from '../utils/validation'
import {
  generateReviewQuestion,
  RECENT_QUESTIONS_TO_AVOID,
  recentQuestionsOf,
} from './reviewQuestions'
import { findSimilarQuestions } from './similarQuestions'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const context = { threshold: 3, now: NOW }
const scope = {
  operations: ['addition', 'subtraction'] as const,
  difficulty: 2 as const,
}

const addition = (
  a: number,
  b: number,
  overrides: Partial<MistakePattern> = {},
) =>
  makeMistakePattern({
    operation: 'addition',
    firstOperand: a,
    secondOperand: b,
    correctAnswer: a + b,
    difficulty: 2,
    lastIncorrectAt: NOW.toISOString(),
    ...overrides,
  })

describe('generateReviewQuestion', () => {
  const patterns = [addition(12, 15), addition(21, 9), addition(30, 25)]

  it('asks a question marked as review and tied to one of the mistakes', () => {
    const question = generateReviewQuestion(
      patterns,
      scope,
      context,
      seededRandom(1),
    )!

    expect(question.source).toBe('mistake-review')
    expect(patterns.map((p) => p.id)).toContain(question.mistakePatternId)
    expect(getQuestionProblems(question)).toEqual([])
  })

  it('asks at the level of the scope', () => {
    const question = generateReviewQuestion(
      patterns,
      scope,
      context,
      seededRandom(2),
    )!

    expect(question.difficulty).toBe(2)
  })

  it('asks a question that is similar to its mistake, never the mistake itself', () => {
    const random = seededRandom(3)
    for (let i = 0; i < 200; i++) {
      const question = generateReviewQuestion(patterns, scope, context, random)!
      const source = patterns.find((p) => p.id === question.mistakePatternId)!
      const similar = findSimilarQuestions(source)
      const allowed = [
        ...similar.nearby,
        ...similar.reversed,
        ...similar['fact-family'],
      ].map((s) => `${s.operation}:${s.firstOperand}:${s.secondOperand}`)

      expect(allowed).toContain(
        `${question.operation}:${question.firstOperand}:${question.secondOperand}`,
      )
    }
  })

  describe('when there is nothing to review', () => {
    it('gives nothing with no mistakes at all', () => {
      expect(generateReviewQuestion([], scope, context)).toBeNull()
    })

    it('gives nothing when every mistake is mastered', () => {
      const mastered = patterns.map((p) => ({ ...p, mastered: true }))

      expect(generateReviewQuestion(mastered, scope, context)).toBeNull()
    })

    it('gives nothing when no mistake is of the scope’s operations or level', () => {
      expect(
        generateReviewQuestion(patterns, { ...scope, difficulty: 3 }, context),
      ).toBeNull()
      expect(
        generateReviewQuestion(
          patterns,
          { operations: ['division'], difficulty: 2 },
          context,
        ),
      ).toBeNull()
    })
  })

  it('asks only about mistakes the scope covers, and not mastered ones', () => {
    const covered = addition(12, 15)
    const otherLevel = addition(3, 4, { difficulty: 3 })
    const otherOperation = makeMistakePattern() // multiplication
    const mastered = addition(21, 9, { mastered: true, similarCorrectCount: 3 })
    const random = seededRandom(4)

    for (let i = 0; i < 200; i++) {
      const question = generateReviewQuestion(
        [covered, otherLevel, otherOperation, mastered],
        scope,
        context,
        random,
      )!
      expect(question.mistakePatternId).toBe(covered.id)
    }
  })

  describe('mixing the mistakes', () => {
    it('does not come back to the mistake it has just asked about, while there is another', () => {
      const random = seededRandom(5)
      for (const previous of patterns) {
        for (let i = 0; i < 100; i++) {
          const question = generateReviewQuestion(
            patterns,
            scope,
            { ...context, previousPatternId: previous.id },
            random,
          )!
          expect(question.mistakePatternId).not.toBe(previous.id)
        }
      }
    })

    it('does come back to it when it is the only one left', () => {
      const only = patterns[0]

      const question = generateReviewQuestion(
        [only],
        scope,
        { ...context, previousPatternId: only.id },
        seededRandom(6),
      )!

      expect(question.mistakePatternId).toBe(only.id)
    })

    it('ignores a previous mistake that is not in the list', () => {
      const question = generateReviewQuestion(
        patterns,
        scope,
        { ...context, previousPatternId: 'gone:1:1:1' },
        seededRandom(7),
      )

      expect(question).not.toBeNull()
    })

    it('uses every mistake over a session, going from one to the next', () => {
      const random = seededRandom(8)
      const used = new Set<string>()
      let previous: string | undefined
      for (let i = 0; i < 60; i++) {
        const question = generateReviewQuestion(
          patterns,
          scope,
          { ...context, previousPatternId: previous },
          random,
        )!
        used.add(question.mistakePatternId!)
        previous = question.mistakePatternId
      }

      expect(used.size).toBe(3)
    })
  })

  it('asks about the more pressing mistake more often', () => {
    const pressing = addition(12, 15, {
      incorrectCount: 6,
      similarCorrectCount: 0,
    })
    const fading = addition(21, 9, {
      incorrectCount: 1,
      similarCorrectCount: 2,
      lastIncorrectAt: '2026-03-01T00:00:00.000Z',
    })
    const random = seededRandom(9)
    let forPressing = 0
    for (let i = 0; i < 3000; i++) {
      const question = generateReviewQuestion(
        [pressing, fading],
        scope,
        context,
        random,
      )!
      if (question.mistakePatternId === pressing.id) forPressing++
    }

    expect(forPressing).toBeGreaterThan(1800)
    expect(forPressing).toBeLessThan(2900)
  })

  describe('keeping away from questions already asked', () => {
    it('passes the recent questions on, so they are not asked again while others are possible', () => {
      const only = patterns[0]
      const found = findSimilarQuestions(only)
      const everything = [
        ...found.nearby,
        ...found.reversed,
        ...found['fact-family'],
      ]
      const [keep, ...recent] = everything
      const random = seededRandom(10)

      for (let i = 0; i < 40; i++) {
        const question = generateReviewQuestion(
          [only],
          scope,
          { ...context, recent },
          random,
        )!
        expect(question).toMatchObject({
          operation: keep.operation,
          firstOperand: keep.firstOperand,
          secondOperand: keep.secondOperand,
        })
      }
    })
  })

  it('does not change the mistakes', () => {
    const before = structuredClone(patterns)

    generateReviewQuestion(patterns, scope, context, seededRandom(11))

    expect(patterns).toEqual(before)
  })
})

describe('recentQuestionsOf', () => {
  const session = { id: 'session-1' }
  const attempt = (id: string, a: number, sessionId = 'session-1') =>
    makeAttempt({
      id,
      sessionId,
      operation: 'addition',
      firstOperand: a,
      secondOperand: 1,
      correctAnswer: a + 1,
    })
  const spec = (a: number) => ({
    operation: 'addition' as const,
    firstOperand: a,
    secondOperand: 1,
  })

  it('lists the session’s questions in order, ending with the one on screen', () => {
    expect(
      recentQuestionsOf(session, [attempt('a', 1), attempt('b', 2)], spec(3)),
    ).toEqual([spec(1), spec(2), spec(3)])
  })

  it('leaves out other sessions’ questions', () => {
    expect(
      recentQuestionsOf(
        session,
        [attempt('a', 1, 'other'), attempt('b', 2)],
        spec(3),
      ),
    ).toEqual([spec(2), spec(3)])
  })

  it('works with nothing on screen', () => {
    expect(recentQuestionsOf(session, [attempt('a', 1)], null)).toEqual([
      spec(1),
    ])
  })

  it('keeps only the latest few', () => {
    const attempts = Array.from({ length: 20 }, (_, i) => attempt(`a${i}`, i))

    const recent = recentQuestionsOf(session, attempts, spec(99))

    expect(recent).toHaveLength(RECENT_QUESTIONS_TO_AVOID)
    expect(recent[recent.length - 1]).toEqual(spec(99))
    expect(recent[0]).toEqual(spec(20 - (RECENT_QUESTIONS_TO_AVOID - 1)))
  })

  it('can be told how many to keep', () => {
    expect(
      recentQuestionsOf(
        session,
        [attempt('a', 1), attempt('b', 2)],
        spec(3),
        2,
      ),
    ).toEqual([spec(2), spec(3)])
  })

  it('keeps just what makes a question, not the rest of the attempt', () => {
    const [only] = recentQuestionsOf(session, [attempt('a', 1)], null)

    expect(Object.keys(only).sort()).toEqual([
      'firstOperand',
      'operation',
      'secondOperand',
    ])
  })
})
