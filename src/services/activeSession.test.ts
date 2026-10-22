import { describe, expect, it } from 'vitest'
import { makeAttempt, makeQuestion, makeSession } from '../test/fixtures'
import { FRESH_CARD, restoreActiveSession } from './activeSession'

/** A session of Level 2 multiplication, the kind makeQuestion's 7 × 8 belongs to. */
const session = (overrides = {}) =>
  makeSession({
    id: 's1',
    operations: ['multiplication'],
    difficulty: 2,
    sessionLength: 5,
    attempted: 0,
    correct: 0,
    incorrect: 0,
    ...overrides,
  })
const saved = (overrides: Record<string, unknown> = {}) => ({
  session: session(),
  currentQuestion: makeQuestion(),
  card: { selectedAnswer: null, flipped: false },
  ...overrides,
})
const answered = (count: number, correct = count, sessionId = 's1') =>
  Array.from({ length: count }, (_, index) =>
    makeAttempt({
      id: `a${sessionId}${index}`,
      questionId: `earlier-${index}`,
      sessionId,
      selfReportedCorrect: index < correct,
    }),
  )

describe('restoreActiveSession', () => {
  it('brings back the session, its question and the card as they were saved', () => {
    const restored = restoreActiveSession(
      saved({ card: { selectedAnswer: 54, flipped: true } }),
      [],
    )

    expect(restored).toEqual({
      session: session(),
      currentQuestion: makeQuestion(),
      card: { selectedAnswer: 54, flipped: true },
    })
  })

  it('brings back a pick that has not been turned over', () => {
    const restored = restoreActiveSession(
      saved({ card: { selectedAnswer: 48, flipped: false } }),
      [],
    )

    expect(restored?.card).toEqual({ selectedAnswer: 48, flipped: false })
  })

  it('brings back a mistake-review session with its mistake question', () => {
    const restored = restoreActiveSession(
      saved({
        session: session({ mode: 'mistake-review' }),
        currentQuestion: makeQuestion({
          source: 'mistake-review',
          mistakePatternId: 'multiplication:7:8:2',
        }),
      }),
      [],
    )

    expect(restored?.session.mode).toBe('mistake-review')
    expect(restored?.currentQuestion.mistakePatternId).toBe(
      'multiplication:7:8:2',
    )
  })

  describe('the counts', () => {
    it('come from the saved attempts, which are the record of what was answered', () => {
      const restored = restoreActiveSession(
        saved({ session: session({ attempted: 9, correct: 9, incorrect: 0 }) }),
        answered(3, 2),
      )

      expect(restored?.session).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
    })

    it('leave out the attempts of other sessions', () => {
      const restored = restoreActiveSession(saved(), [
        ...answered(2, 1),
        ...answered(4, 4, 'other'),
      ])

      expect(restored?.session).toMatchObject({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
    })

    it('are not drawn from the saved copy, which is left as it was', () => {
      const original = saved()
      const restored = restoreActiveSession(original, answered(1))

      expect(restored?.session).not.toBe(original.session)
      expect(original.session.attempted).toBe(0)
    })
  })

  describe('nothing is brought back', () => {
    it.each([
      ['nothing', undefined],
      ['null', null],
      ['text', 'a session'],
      ['a number', 42],
      ['a list', []],
      ['an empty object', {}],
    ])('for %s', (_name, value) => {
      expect(restoreActiveSession(value, [])).toBeNull()
    })

    it.each([
      [
        'a session that has ended',
        { session: session({ completedAt: '2026-03-04T10:30:00.000Z' }) },
      ],
      ['a session that is not a session', { session: { id: 's1' } }],
      [
        'a session whose totals do not add up',
        { session: session({ attempted: 4, correct: 1, incorrect: 1 }) },
      ],
      ['no question', { currentQuestion: null }],
      ['a question that is not a question', { currentQuestion: { id: 'q1' } }],
      [
        'a question with the wrong answer',
        {
          currentQuestion: makeQuestion({
            correctAnswer: 55,
            choices: [48, 54, 55, 64],
          }),
        },
      ],
      [
        'a question with repeated choices',
        { currentQuestion: makeQuestion({ choices: [48, 54, 56, 54] }) },
      ],
      [
        'a question from another operation',
        {
          currentQuestion: makeQuestion({
            operation: 'addition',
            firstOperand: 7,
            secondOperand: 8,
            displayText: '7 + 8',
            correctAnswer: 15,
            choices: [13, 14, 15, 16],
            difficulty: 2,
          }),
        },
      ],
      [
        'a question of another level',
        { currentQuestion: makeQuestion({ difficulty: 3 }) },
      ],
      [
        'a mistake question in an ordinary session',
        { currentQuestion: makeQuestion({ source: 'mistake-review' }) },
      ],
      [
        'an ordinary question in a mistake session',
        { session: session({ mode: 'mistake-review' }) },
      ],
    ])('for %s', (_name, overrides) => {
      expect(restoreActiveSession(saved(overrides), [])).toBeNull()
    })

    it('for a question that was already answered, as nothing says what came next', () => {
      const attempts = [
        makeAttempt({ id: 'x', questionId: 'q1', sessionId: 's1' }),
      ]

      expect(restoreActiveSession(saved(), attempts)).toBeNull()
    })

    it('for a fixed session that has all its answers, so it is over', () => {
      expect(restoreActiveSession(saved(), answered(5))).toBeNull()
      expect(restoreActiveSession(saved(), answered(6))).toBeNull()
      expect(restoreActiveSession(saved(), answered(4))).not.toBeNull()
    })

    it('but a continuous session, which has no end, is brought back however many it has', () => {
      const continuous = saved({
        session: session({ sessionLength: 'continuous' }),
      })

      expect(restoreActiveSession(continuous, answered(40))).not.toBeNull()
    })
  })

  describe('a card that does not fit', () => {
    it.each([
      [
        'a pick that is not one of the choices',
        { selectedAnswer: 99, flipped: false },
      ],
      ['a turned card with no pick', { selectedAnswer: null, flipped: true }],
      ['a card that is not a card', 'turned'],
      ['a card with a text pick', { selectedAnswer: '54', flipped: false }],
      ['no card', undefined],
    ])('(%s) only loses its progress: the session is kept', (_name, card) => {
      const restored = restoreActiveSession(saved({ card }), [])

      expect(restored?.session.id).toBe('s1')
      expect(restored?.currentQuestion.id).toBe('q1')
      expect(restored?.card).toEqual(FRESH_CARD)
    })

    it('is a new card each time, never the shared one', () => {
      const restored = restoreActiveSession(saved({ card: undefined }), [])

      expect(restored?.card).not.toBe(FRESH_CARD)
    })
  })
})
