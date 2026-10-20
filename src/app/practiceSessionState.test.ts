import { describe, expect, it } from 'vitest'
import { createEmptyStatistics } from '../services/statisticsService'
import { makeQuestion } from '../test/fixtures'
import type { PracticeConfig } from '../types/session'
import {
  createAttempt,
  createSession,
  initialPracticeSessionState,
  isFinalQuestion,
  isSessionActive,
  practiceSessionReducer,
  type PracticeSessionState,
} from './practiceSessionState'

const config: PracticeConfig = {
  operations: ['addition', 'division'],
  difficulty: 2,
  sessionLength: 3,
}

const q1 = makeQuestion({ id: 'q1' })
const q2 = makeQuestion({ id: 'q2', displayText: '6 × 4' })
const q3 = makeQuestion({ id: 'q3', displayText: '9 × 3' })

function started(
  overrides: Partial<PracticeConfig> = {},
): PracticeSessionState {
  return practiceSessionReducer(initialPracticeSessionState, {
    type: 'sessionStarted',
    session: createSession({ ...config, ...overrides }),
    firstQuestion: q1,
  })
}

function record(
  state: PracticeSessionState,
  questionId: string,
  selfReportedCorrect: boolean,
  nextQuestion: ReturnType<typeof makeQuestion> | null,
) {
  const question = makeQuestion({ id: questionId })
  return practiceSessionReducer(state, {
    type: 'resultRecorded',
    attempt: createAttempt(state.session!, question, {
      selectedAnswer: 54,
      selfReportedCorrect,
    }),
    nextQuestion,
  })
}

describe('createSession', () => {
  it('stores the setup, an id, and the start time, with nothing answered', () => {
    const now = new Date('2026-03-04T10:30:00.000Z')
    const session = createSession(config, now)

    expect(session).toEqual({
      id: expect.any(String),
      startedAt: '2026-03-04T10:30:00.000Z',
      operations: ['addition', 'division'],
      difficulty: 2,
      sessionLength: 3,
      attempted: 0,
      correct: 0,
      incorrect: 0,
    })
    expect(session.id.length).toBeGreaterThan(0)
    expect(session.completedAt).toBeUndefined()
  })

  it('gives every session its own id', () => {
    expect(createSession(config).id).not.toBe(createSession(config).id)
  })

  it('keeps its own copy of the operations', () => {
    const operations: PracticeConfig['operations'] = ['addition']
    const session = createSession({ ...config, operations })
    operations.push('division')

    expect(session.operations).toEqual(['addition'])
  })

  it('stores continuous practice as such', () => {
    expect(
      createSession({ ...config, sessionLength: 'continuous' }).sessionLength,
    ).toBe('continuous')
  })
})

describe('createAttempt', () => {
  it('records the question, the answer given, the self-report, and the context', () => {
    const session = createSession(config)
    const now = new Date('2026-03-04T10:31:00.000Z')

    const attempt = createAttempt(
      session,
      q1,
      { selectedAnswer: 54, selfReportedCorrect: false },
      now,
    )

    expect(attempt).toEqual({
      id: expect.any(String),
      questionId: 'q1',
      operation: 'multiplication',
      firstOperand: 7,
      secondOperand: 8,
      correctAnswer: 56,
      selectedAnswer: 54,
      selfReportedCorrect: false,
      difficulty: 2,
      source: 'regular',
      attemptedAt: '2026-03-04T10:31:00.000Z',
      sessionId: session.id,
    })
  })

  it('gives every attempt its own id', () => {
    const session = createSession(config)
    const result = { selectedAnswer: 54, selfReportedCorrect: true }

    expect(createAttempt(session, q1, result).id).not.toBe(
      createAttempt(session, q1, result).id,
    )
  })
})

describe('isFinalQuestion', () => {
  it('is false for continuous practice, however far along', () => {
    const session = createSession({ ...config, sessionLength: 'continuous' })

    expect(isFinalQuestion(session)).toBe(false)
    expect(isFinalQuestion({ ...session, attempted: 500 })).toBe(false)
  })

  it('is true on the last question of a fixed session only', () => {
    const session = createSession({ ...config, sessionLength: 3 })

    expect(isFinalQuestion({ ...session, attempted: 0 })).toBe(false)
    expect(isFinalQuestion({ ...session, attempted: 1 })).toBe(false)
    expect(isFinalQuestion({ ...session, attempted: 2 })).toBe(true)
  })

  it('treats a one-question session as final from the start', () => {
    expect(
      isFinalQuestion(createSession({ ...config, sessionLength: 1 })),
    ).toBe(true)
  })
})

describe('isSessionActive', () => {
  it('is false before any session', () => {
    expect(isSessionActive(initialPracticeSessionState)).toBe(false)
  })

  it('is true for a session under way', () => {
    expect(isSessionActive(started())).toBe(true)
  })

  it('is false once the session has ended', () => {
    const ended = practiceSessionReducer(started(), {
      type: 'sessionEnded',
      completedAt: '2026-03-04T11:00:00.000Z',
    })

    expect(isSessionActive(ended)).toBe(false)
  })

  it('is false once the session has an end time, even if a question is left over', () => {
    const inconsistent: PracticeSessionState = {
      ...started(),
      session: {
        ...started().session!,
        completedAt: '2026-03-04T11:00:00.000Z',
      },
    }

    expect(inconsistent.currentQuestion).not.toBeNull()
    expect(isSessionActive(inconsistent)).toBe(false)
  })

  it('is false if there is no question to show', () => {
    expect(isSessionActive({ ...started(), currentQuestion: null })).toBe(false)
  })
})

describe('practiceSessionReducer', () => {
  describe('sessionStarted', () => {
    it('begins at the first question with nothing recorded', () => {
      const state = started()

      expect(state.session?.attempted).toBe(0)
      expect(state.currentQuestion).toBe(q1)
      expect(state.currentQuestionIndex).toBe(0)
      expect(state.attempts).toEqual([])
    })

    it('replaces an earlier session but keeps past attempts', () => {
      const first = record(started(), 'q1', true, q2)
      const second = practiceSessionReducer(first, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      expect(second.session?.id).not.toBe(first.session?.id)
      expect(second.session?.attempted).toBe(0)
      expect(second.currentQuestion).toBe(q3)
      expect(second.currentQuestionIndex).toBe(0)
      expect(second.attempts).toHaveLength(1)
    })
  })

  describe('resultRecorded', () => {
    it('counts a right answer', () => {
      const state = record(started(), 'q1', true, q2)

      expect(state.session).toMatchObject({
        attempted: 1,
        correct: 1,
        incorrect: 0,
      })
    })

    it('counts a wrong answer', () => {
      const state = record(started(), 'q1', false, q2)

      expect(state.session).toMatchObject({
        attempted: 1,
        correct: 0,
        incorrect: 1,
      })
    })

    it('stores the attempt', () => {
      const state = record(started(), 'q1', false, q2)

      expect(state.attempts).toHaveLength(1)
      expect(state.attempts[0]).toMatchObject({
        questionId: 'q1',
        selectedAnswer: 54,
        selfReportedCorrect: false,
        sessionId: state.session?.id,
      })
    })

    it('moves on to the next question and its position', () => {
      const state = record(started(), 'q1', true, q2)

      expect(state.currentQuestion).toBe(q2)
      expect(state.currentQuestionIndex).toBe(1)
      expect(isSessionActive(state)).toBe(true)
    })

    it('keeps running totals across several questions', () => {
      let state = started({ sessionLength: 10 })
      state = record(state, 'q1', true, q2)
      state = record(state, 'q2', false, q3)
      state = record(state, 'q3', true, makeQuestion({ id: 'q4' }))

      expect(state.session).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
      expect(state.attempts.map((a) => a.questionId)).toEqual([
        'q1',
        'q2',
        'q3',
      ])
      expect(state.currentQuestionIndex).toBe(3)
    })

    it('ends the session when there is no next question', () => {
      const state = record(started({ sessionLength: 1 }), 'q1', true, null)

      expect(isSessionActive(state)).toBe(false)
      expect(state.currentQuestion).toBeNull()
      expect(state.session?.completedAt).toBe(state.attempts[0].attemptedAt)
      expect(state.session).toMatchObject({ attempted: 1, correct: 1 })
    })

    it('counts each question only once', () => {
      const once = record(started(), 'q1', true, q2)
      // The same report arriving again: the question has moved on.
      const attempt = createAttempt(once.session!, q1, {
        selectedAnswer: 54,
        selfReportedCorrect: true,
      })
      const twice = practiceSessionReducer(once, {
        type: 'resultRecorded',
        attempt,
        nextQuestion: q3,
      })

      expect(twice).toBe(once)
      expect(twice.session?.attempted).toBe(1)
      expect(twice.attempts).toHaveLength(1)
    })

    it('ignores a result for a question that is not on screen', () => {
      const state = started()

      expect(record(state, 'some-other-question', true, q2)).toBe(state)
    })

    it('ignores a result that belongs to a different session', () => {
      const state = started()
      const attempt = createAttempt(createSession(config), q1, {
        selectedAnswer: 54,
        selfReportedCorrect: true,
      })

      const next = practiceSessionReducer(state, {
        type: 'resultRecorded',
        attempt,
        nextQuestion: q2,
      })

      expect(next).toBe(state)
    })

    it('ignores a result when there is no session', () => {
      const attempt = createAttempt(createSession(config), q1, {
        selectedAnswer: 54,
        selfReportedCorrect: true,
      })

      const next = practiceSessionReducer(initialPracticeSessionState, {
        type: 'resultRecorded',
        attempt,
        nextQuestion: q2,
      })

      expect(next).toBe(initialPracticeSessionState)
    })

    it('ignores a result after the session has ended', () => {
      const ended = record(started({ sessionLength: 1 }), 'q1', true, null)
      const attempt = createAttempt(ended.session!, q1, {
        selectedAnswer: 54,
        selfReportedCorrect: false,
      })

      const next = practiceSessionReducer(ended, {
        type: 'resultRecorded',
        attempt,
        nextQuestion: q2,
      })

      expect(next).toBe(ended)
    })

    it('does not change the state it was given', () => {
      const before = started()
      const snapshot = JSON.stringify(before)

      record(before, 'q1', true, q2)

      expect(JSON.stringify(before)).toBe(snapshot)
    })
  })

  describe('sessionEnded', () => {
    it('ends a session under way, keeping what was answered', () => {
      const state = practiceSessionReducer(record(started(), 'q1', true, q2), {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })

      expect(state.session).toMatchObject({
        attempted: 1,
        correct: 1,
        completedAt: '2026-03-04T11:00:00.000Z',
      })
      expect(state.currentQuestion).toBeNull()
      expect(state.attempts).toHaveLength(1)
    })

    it('does nothing when there is no session', () => {
      const state = practiceSessionReducer(initialPracticeSessionState, {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })

      expect(state).toBe(initialPracticeSessionState)
    })

    it('does not change the end time of a session that already ended', () => {
      const ended = practiceSessionReducer(started(), {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })
      const again = practiceSessionReducer(ended, {
        type: 'sessionEnded',
        completedAt: '2026-03-04T12:00:00.000Z',
      })

      expect(again).toBe(ended)
      expect(again.session?.completedAt).toBe('2026-03-04T11:00:00.000Z')
    })
  })

  describe('sessionDiscarded', () => {
    it('removes the session and its attempts', () => {
      const state = practiceSessionReducer(record(started(), 'q1', true, q2), {
        type: 'sessionDiscarded',
      })

      expect(state).toEqual(initialPracticeSessionState)
    })

    it('keeps attempts from earlier sessions', () => {
      const earlier = record(started({ sessionLength: 1 }), 'q1', true, null)
      const later = practiceSessionReducer(earlier, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      const state = practiceSessionReducer(later, { type: 'sessionDiscarded' })

      expect(state.session).toBeNull()
      expect(state.attempts).toHaveLength(1)
    })

    it('does nothing when there is no session', () => {
      expect(
        practiceSessionReducer(initialPracticeSessionState, {
          type: 'sessionDiscarded',
        }),
      ).toBe(initialPracticeSessionState)
    })
  })

  describe('saved session history', () => {
    it('does not include a session until its first answer', () => {
      const state = started()

      expect(state.sessions).toEqual([])
    })

    it('adds the session when its first answer is recorded', () => {
      const state = record(started(), 'q1', true, q2)

      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0]).toMatchObject({
        id: state.session?.id,
        attempted: 1,
        correct: 1,
      })
    })

    it('updates that same entry with every later answer, not adding more', () => {
      let state = started({ sessionLength: 10 })
      state = record(state, 'q1', true, q2)
      state = record(state, 'q2', false, q3)
      state = record(state, 'q3', true, makeQuestion({ id: 'q4' }))

      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0]).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
    })

    it('records the end time when the last question ends the session', () => {
      const state = record(started({ sessionLength: 1 }), 'q1', true, null)

      expect(state.sessions[0].completedAt).toBe(state.attempts[0].attemptedAt)
    })

    it('records the end time when the session is ended early', () => {
      const answered = record(started(), 'q1', true, q2)
      const state = practiceSessionReducer(answered, {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })

      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].completedAt).toBe('2026-03-04T11:00:00.000Z')
      expect(state.sessions[0].attempted).toBe(1)
    })

    it('never includes a session that ended with nothing answered', () => {
      const state = practiceSessionReducer(started(), {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })

      expect(state.sessions).toEqual([])
    })

    it('keeps sessions oldest first', () => {
      const first = record(started(), 'q1', true, q2)
      const second = practiceSessionReducer(first, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })
      const both = record(second, 'q3', false, q2)

      expect(both.sessions).toHaveLength(2)
      expect(both.sessions[0].id).toBe(first.session?.id)
      expect(both.sessions[1].id).toBe(both.session?.id)
    })

    it('keeps an earlier session\u2019s record when a new session starts', () => {
      const first = record(started({ sessionLength: 1 }), 'q1', true, null)
      const next = practiceSessionReducer(first, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      expect(next.sessions).toEqual(first.sessions)
    })

    it('keeps only the 100 most recent sessions', () => {
      let state: PracticeSessionState = { ...initialPracticeSessionState }
      const ids: string[] = []
      for (let i = 0; i < 105; i++) {
        state = practiceSessionReducer(state, {
          type: 'sessionStarted',
          session: createSession(config),
          firstQuestion: q1,
        })
        ids.push(state.session!.id)
        state = record(state, 'q1', true, null)
      }

      expect(state.sessions).toHaveLength(100)
      expect(state.sessions[0].id).toBe(ids[5])
      expect(state.sessions[99].id).toBe(ids[104])
    })

    it('removes a discarded session from the history', () => {
      const answered = record(started(), 'q1', true, q2)

      const state = practiceSessionReducer(answered, {
        type: 'sessionDiscarded',
      })

      expect(state.sessions).toEqual([])
    })

    it('keeps other sessions when one is discarded', () => {
      const earlier = record(started({ sessionLength: 1 }), 'q1', true, null)
      const later = practiceSessionReducer(earlier, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      const state = practiceSessionReducer(later, { type: 'sessionDiscarded' })

      expect(state.sessions).toEqual(earlier.sessions)
    })

    it('reuses the same lists when a change removes nothing, so nothing is saved again', () => {
      const state = started()

      const discarded = practiceSessionReducer(state, {
        type: 'sessionDiscarded',
      })

      expect(discarded.attempts).toBe(state.attempts)
      expect(discarded.sessions).toBe(state.sessions)
    })

    it('reuses the same lists when a session starts or a duplicate arrives', () => {
      const answered = record(started(), 'q1', true, q2)
      const duplicate = record(answered, 'q1', true, q3)

      expect(duplicate.sessions).toBe(answered.sessions)
      expect(duplicate.attempts).toBe(answered.attempts)
    })
  })

  describe('statistics', () => {
    it('start with nothing counted', () => {
      expect(started().statistics).toEqual(createEmptyStatistics())
    })

    it('count each recorded answer overall, by operation and by level', () => {
      let state = started({ sessionLength: 10 })
      state = record(state, 'q1', true, q2) // 7 x 8 at level 2
      state = record(state, 'q2', false, q3)

      expect(state.statistics).toMatchObject({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
      expect(state.statistics.byOperation.multiplication).toEqual({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
      expect(state.statistics.byDifficulty[2]).toEqual({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
    })

    it('do not count a duplicate or stale report', () => {
      const answered = record(started(), 'q1', true, q2)

      const duplicate = record(answered, 'q1', true, q3)

      expect(duplicate.statistics).toBe(answered.statistics)
      expect(duplicate.statistics.attempted).toBe(1)
    })

    it('are the same object when a session starts or ends with nothing answered', () => {
      const state = started()

      const ended = practiceSessionReducer(state, {
        type: 'sessionEnded',
        completedAt: '2026-03-04T11:00:00.000Z',
      })

      expect(ended.statistics).toBe(state.statistics)
    })

    it('keep the totals of earlier sessions when a new one starts', () => {
      const first = record(started({ sessionLength: 1 }), 'q1', true, null)

      const next = practiceSessionReducer(first, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      expect(next.statistics).toBe(first.statistics)
    })

    it('have a discarded session\u2019s answers taken back out', () => {
      const earlier = record(started({ sessionLength: 1 }), 'q1', true, null)
      let later = practiceSessionReducer(earlier, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })
      later = record(later, 'q3', false, q2)
      expect(later.statistics.attempted).toBe(2)

      const state = practiceSessionReducer(later, { type: 'sessionDiscarded' })

      expect(state.statistics).toEqual(earlier.statistics)
      expect(state.statistics).toMatchObject({
        attempted: 1,
        correct: 1,
        incorrect: 0,
      })
    })

    it('are untouched when a session with no answers is discarded', () => {
      const earlier = record(started({ sessionLength: 1 }), 'q1', true, null)
      const later = practiceSessionReducer(earlier, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q3,
      })

      const state = practiceSessionReducer(later, { type: 'sessionDiscarded' })

      expect(state.statistics).toBe(earlier.statistics)
    })
  })

  describe('historyReset', () => {
    function busyState() {
      let state = started({ sessionLength: 'continuous' })
      state = record(state, 'q1', true, q2)
      state = record(state, 'q2', false, q3)
      return state
    }

    it('erases attempts, sessions and statistics', () => {
      const state = practiceSessionReducer(busyState(), {
        type: 'historyReset',
      })

      expect(state.attempts).toEqual([])
      expect(state.sessions).toEqual([])
      expect(state.statistics).toEqual(createEmptyStatistics())
    })

    it('also ends the session in progress', () => {
      const state = practiceSessionReducer(busyState(), {
        type: 'historyReset',
      })

      expect(state.session).toBeNull()
      expect(state.currentQuestion).toBeNull()
      expect(state.currentQuestionIndex).toBe(0)
      expect(isSessionActive(state)).toBe(false)
    })

    it('leaves a state that behaves like a new one', () => {
      const state = practiceSessionReducer(busyState(), {
        type: 'historyReset',
      })

      const restarted = practiceSessionReducer(state, {
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion: q1,
      })
      const answered = record(restarted, 'q1', true, q2)

      expect(answered.statistics).toMatchObject({ attempted: 1, correct: 1 })
      expect(answered.attempts).toHaveLength(1)
    })

    it('does not change the state it was given', () => {
      const before = busyState()
      const snapshot = JSON.stringify(before)

      practiceSessionReducer(before, { type: 'historyReset' })

      expect(JSON.stringify(before)).toBe(snapshot)
    })

    it('does nothing harmful on an already empty state', () => {
      const state = practiceSessionReducer(initialPracticeSessionState, {
        type: 'historyReset',
      })

      expect(state).toEqual(initialPracticeSessionState)
    })

    it('does not share totals between resets, so later changes cannot leak', () => {
      const a = practiceSessionReducer(busyState(), { type: 'historyReset' })
      const b = practiceSessionReducer(busyState(), { type: 'historyReset' })

      expect(a.statistics).not.toBe(b.statistics)
      expect(a.statistics).not.toBe(initialPracticeSessionState.statistics)
    })
  })
})
