import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { activeSessionState } from '../test/fixtures'
import type { PracticeConfig, QuestionResult } from '../types/session'
import { AppProvider } from './AppProvider'

const config: PracticeConfig = {
  operations: ['subtraction'],
  difficulty: 1,
  sessionLength: 3,
}
const right: QuestionResult = { selectedAnswer: 1, selfReportedCorrect: true }
const wrong: QuestionResult = { selectedAnswer: 2, selfReportedCorrect: false }

function setup(
  initialState?: Parameters<typeof AppProvider>[0]['initialState'],
) {
  return renderHook(() => usePracticeSession(), {
    wrapper: ({ children }) => (
      <AppProvider initialState={initialState}>{children}</AppProvider>
    ),
  })
}

describe('usePracticeSession', () => {
  it('must be used inside AppProvider', () => {
    expect(() => renderHook(() => usePracticeSession())).toThrow(
      /inside <AppProvider>/,
    )
  })

  it('starts with no session', () => {
    const { result } = setup()

    expect(result.current.session).toBeNull()
    expect(result.current.currentQuestion).toBeNull()
    expect(result.current.isActive).toBe(false)
    expect(result.current.attempts).toEqual([])
  })
})

describe('startSession', () => {
  it('stores the setup, an id and the start time', () => {
    const { result } = setup()

    let started = false
    act(() => {
      started = result.current.startSession(config)
    })

    expect(started).toBe(true)
    expect(result.current.session).toMatchObject({
      operations: ['subtraction'],
      difficulty: 1,
      sessionLength: 3,
      attempted: 0,
      correct: 0,
      incorrect: 0,
    })
    expect(result.current.session?.id).toBeTruthy()
    expect(result.current.session?.startedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(result.current.session?.completedAt).toBeUndefined()
  })

  it('generates the first question for the chosen operations and level', () => {
    const { result } = setup()

    act(() => {
      result.current.startSession(config)
    })

    expect(result.current.currentQuestion).toMatchObject({
      operation: 'subtraction',
      difficulty: 1,
      source: 'regular',
    })
    expect(result.current.currentQuestion?.choices).toHaveLength(4)
    expect(result.current.currentQuestionIndex).toBe(0)
    expect(result.current.isActive).toBe(true)
  })

  it.each([
    ['no operations', { ...config, operations: [] }],
    ['an unknown operation', { ...config, operations: ['power'] }],
    ['a bad difficulty', { ...config, difficulty: 7 }],
    ['a bad session length', { ...config, sessionLength: 0 }],
  ])('refuses %s and changes nothing', (_, bad) => {
    const { result } = setup()

    let started = true
    act(() => {
      started = result.current.startSession(bad as unknown as PracticeConfig)
    })

    expect(started).toBe(false)
    expect(result.current.session).toBeNull()
    expect(result.current.isActive).toBe(false)
  })

  it('replaces a session already under way', () => {
    const { result } = setup(activeSessionState())
    const earlierId = result.current.session?.id

    act(() => {
      result.current.startSession(config)
    })

    expect(result.current.session?.id).not.toBe(earlierId)
    expect(result.current.session?.operations).toEqual(['subtraction'])
  })
})

describe('recordResult', () => {
  function started(overrides: Partial<PracticeConfig> = {}) {
    const hook = setup()
    act(() => {
      hook.result.current.startSession({ ...config, ...overrides })
    })
    return hook
  }

  it('counts a right answer', () => {
    const { result } = started()

    act(() => result.current.recordResult(right))

    expect(result.current.session).toMatchObject({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })
  })

  it('counts a wrong answer', () => {
    const { result } = started()

    act(() => result.current.recordResult(wrong))

    expect(result.current.session).toMatchObject({
      attempted: 1,
      correct: 0,
      incorrect: 1,
    })
  })

  it('stores the completed attempt with everything about it', () => {
    const { result } = started()
    const question = result.current.currentQuestion!
    const sessionId = result.current.session!.id

    act(() => result.current.recordResult(wrong))

    expect(result.current.attempts).toHaveLength(1)
    expect(result.current.attempts[0]).toEqual({
      id: expect.any(String),
      questionId: question.id,
      operation: 'subtraction',
      firstOperand: question.firstOperand,
      secondOperand: question.secondOperand,
      correctAnswer: question.correctAnswer,
      selectedAnswer: 2,
      selfReportedCorrect: false,
      difficulty: 1,
      source: 'regular',
      attemptedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      sessionId,
    })
  })

  it('moves on to a new question and position', () => {
    const { result } = started()
    const first = result.current.currentQuestion!

    act(() => result.current.recordResult(right))

    expect(result.current.currentQuestion?.id).not.toBe(first.id)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(result.current.isActive).toBe(true)
  })

  it('never repeats the question just answered', () => {
    const { result } = started({
      operations: ['division'],
      sessionLength: 'continuous',
    })

    for (let i = 0; i < 150; i++) {
      const before = result.current.currentQuestion!.displayText
      act(() => result.current.recordResult(right))

      expect(result.current.currentQuestion!.displayText).not.toBe(before)
    }
  })

  it('counts an attempt once even if it is reported twice in the same moment', () => {
    const { result } = started()

    act(() => {
      result.current.recordResult(right)
      result.current.recordResult(right)
    })

    expect(result.current.session?.attempted).toBe(1)
    expect(result.current.attempts).toHaveLength(1)
  })

  it('does nothing when there is no session', () => {
    const { result } = setup()

    act(() => result.current.recordResult(right))

    expect(result.current.session).toBeNull()
    expect(result.current.attempts).toEqual([])
  })

  describe('in a fixed-length session', () => {
    it('ends after the last question, with no further question', () => {
      const { result } = started({ sessionLength: 3 })

      act(() => result.current.recordResult(right))
      act(() => result.current.recordResult(wrong))
      expect(result.current.isActive).toBe(true)
      act(() => result.current.recordResult(right))

      expect(result.current.isActive).toBe(false)
      expect(result.current.currentQuestion).toBeNull()
      expect(result.current.session).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
      expect(result.current.session?.completedAt).toBeDefined()
      expect(result.current.attempts).toHaveLength(3)
    })

    it('ignores answers after it has ended', () => {
      const { result } = started({ sessionLength: 1 })
      act(() => result.current.recordResult(right))

      act(() => result.current.recordResult(wrong))

      expect(result.current.session?.attempted).toBe(1)
      expect(result.current.attempts).toHaveLength(1)
    })

    it('sets the end time to the time of the last answer', () => {
      const { result } = started({ sessionLength: 1 })

      act(() => result.current.recordResult(right))

      expect(result.current.session?.completedAt).toBe(
        result.current.attempts[0].attemptedAt,
      )
    })
  })

  describe('in a continuous session', () => {
    it('never ends by itself', () => {
      const { result } = started({ sessionLength: 'continuous' })

      for (let i = 0; i < 60; i++) {
        act(() => result.current.recordResult(i % 2 === 0 ? right : wrong))
      }

      expect(result.current.isActive).toBe(true)
      expect(result.current.session).toMatchObject({
        attempted: 60,
        correct: 30,
        incorrect: 30,
      })
      expect(result.current.currentQuestionIndex).toBe(60)
      expect(result.current.currentQuestion).not.toBeNull()
    })
  })
})

describe('endSession', () => {
  it('ends the session and keeps what was answered', () => {
    const { result } = setup()
    act(() => {
      result.current.startSession({ ...config, sessionLength: 'continuous' })
    })
    act(() => result.current.recordResult(right))
    act(() => result.current.recordResult(wrong))

    act(() => result.current.endSession())

    expect(result.current.isActive).toBe(false)
    expect(result.current.currentQuestion).toBeNull()
    expect(result.current.session).toMatchObject({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
    expect(result.current.session?.completedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(result.current.attempts).toHaveLength(2)
  })

  it('does nothing when there is no session', () => {
    const { result } = setup()

    act(() => result.current.endSession())

    expect(result.current.session).toBeNull()
  })
})

describe('discardSession', () => {
  it('drops the session and its attempts', () => {
    const { result } = setup()
    act(() => {
      result.current.startSession({ ...config, sessionLength: 'continuous' })
    })
    act(() => result.current.recordResult(right))

    act(() => result.current.discardSession())

    expect(result.current.session).toBeNull()
    expect(result.current.currentQuestion).toBeNull()
    expect(result.current.attempts).toEqual([])
    expect(result.current.isActive).toBe(false)
  })
})

describe('completing a fixed-length session (Task 32)', () => {
  it.each([1, 5, 10, 20])(
    'a %i-question session ends exactly on its last answer, not before',
    (length) => {
      const { result } = setup()
      act(() => {
        result.current.startSession({ ...config, sessionLength: length })
      })

      for (let answered = 1; answered < length; answered++) {
        act(() => result.current.recordResult(right))

        // Still going: compared against the chosen length after every answer.
        expect(result.current.isActive).toBe(true)
        expect(result.current.session?.attempted).toBe(answered)
        expect(result.current.session?.completedAt).toBeUndefined()
        expect(result.current.currentQuestion).not.toBeNull()
      }

      act(() => result.current.recordResult(right))

      expect(result.current.isActive).toBe(false)
      expect(result.current.session?.attempted).toBe(length)
      // No further question is made once the session is complete.
      expect(result.current.currentQuestion).toBeNull()
      // The completion timestamp is saved.
      expect(result.current.session?.completedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    },
  )

  it('never goes beyond the chosen length, however many answers arrive', () => {
    const { result } = setup()
    act(() => {
      result.current.startSession({ ...config, sessionLength: 3 })
    })

    for (let i = 0; i < 10; i++) act(() => result.current.recordResult(right))

    expect(result.current.session?.attempted).toBe(3)
    expect(result.current.attempts).toHaveLength(3)
  })
})
