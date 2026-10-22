import {
  createAttempt,
  createSession,
  initialPracticeSessionState,
  practiceSessionReducer,
  type PracticeSessionState,
} from '../app/practiceSessionState'
import { mistakePatternId } from '../services/mistakePatterns'
import { generateReviewQuestion } from '../services/reviewQuestions'
import {
  generateNextQuestion,
  generateQuestionForOperations,
} from '../services/questionGenerator'
import type { MistakePattern } from '../types/mistake'
import type { Question } from '../types/question'
import type {
  PracticeAttempt,
  PracticeConfig,
  PracticeSession,
} from '../types/session'

/** A valid question, 7 × 8, with the answer choices from specification section 8.2. */
export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    operation: 'multiplication',
    firstOperand: 7,
    secondOperand: 8,
    displayText: '7 × 8',
    correctAnswer: 56,
    choices: [48, 54, 56, 64],
    difficulty: 2,
    source: 'regular',
    ...overrides,
  }
}

/** A session under way: Level 1 addition, 5 questions, unless overridden. */
export function activeSessionState(
  overrides: Partial<PracticeConfig> = {},
): PracticeSessionState {
  const config: PracticeConfig = {
    operations: ['addition'],
    difficulty: 1,
    sessionLength: 5,
    ...overrides,
  }
  return practiceSessionReducer(initialPracticeSessionState, {
    type: 'sessionStarted',
    session: createSession(config),
    firstQuestion: generateQuestionForOperations(
      config.operations,
      config.difficulty,
    ),
  })
}

/**
 * A mistake-review session under way, asking about the given mistakes: Level 2
 * addition and subtraction with 5 questions, unless overridden.
 */
export function reviewSessionState(
  patterns: MistakePattern[],
  overrides: Partial<PracticeConfig> = {},
): PracticeSessionState {
  const config: PracticeConfig = {
    operations: ['addition', 'subtraction'],
    difficulty: 2,
    sessionLength: 5,
    ...overrides,
    mode: 'mistake-review',
  }
  const firstQuestion = generateReviewQuestion(patterns, config, {
    threshold: 3,
    now: new Date(),
  })
  if (firstQuestion === null) {
    throw new Error('The mistakes given leave nothing to review.')
  }
  return practiceSessionReducer(
    { ...initialPracticeSessionState, mistakePatterns: patterns },
    {
      type: 'sessionStarted',
      session: createSession(config),
      firstQuestion,
    },
  )
}

/** A session that has ended. */
export function endedSessionState(
  overrides: Partial<PracticeConfig> = {},
): PracticeSessionState {
  return practiceSessionReducer(activeSessionState(overrides), {
    type: 'sessionEnded',
    completedAt: new Date().toISOString(),
  })
}

/**
 * A finished session with the given numbers of right and wrong answers, built
 * by answering questions through the real reducer so the state is consistent.
 * `mistakeReview` of the questions are marked as coming from mistake review.
 */
export function finishedSessionState(
  overrides: Partial<PracticeConfig> = {},
  counts: { correct?: number; incorrect?: number; mistakeReview?: number } = {},
): PracticeSessionState {
  const { correct = 0, incorrect = 0 } = counts
  if (correct + incorrect === 0) return endedSessionState(overrides)
  return answeredState(overrides, counts, false)
}

/**
 * A session still in progress after the given numbers of right and wrong
 * answers, with its next question on screen: how a session looks when it is
 * brought back after a refresh.
 */
export function inProgressSessionState(
  overrides: Partial<PracticeConfig> = {},
  counts: { correct?: number; incorrect?: number } = {},
): PracticeSessionState {
  return answeredState(overrides, counts, true)
}

function answeredState(
  overrides: Partial<PracticeConfig>,
  counts: { correct?: number; incorrect?: number; mistakeReview?: number },
  keepGoing: boolean,
): PracticeSessionState {
  const { correct = 0, incorrect = 0, mistakeReview = 0 } = counts
  const total = correct + incorrect
  let state = activeSessionState(overrides)

  for (let i = 0; i < total; i++) {
    const session = state.session!
    const question = {
      ...state.currentQuestion!,
      source:
        i < mistakeReview ? ('mistake-review' as const) : ('regular' as const),
    }
    state = practiceSessionReducer(
      { ...state, currentQuestion: question },
      {
        type: 'resultRecorded',
        attempt: createAttempt(session, question, {
          selectedAnswer: question.correctAnswer,
          selfReportedCorrect: i < correct,
        }),
        nextQuestion:
          i === total - 1 && !keepGoing
            ? null
            : generateNextQuestion(
                session.operations,
                session.difficulty,
                question,
              ),
      },
    )
  }
  return state
}

/** A saved session record, as read back from storage. */
export function makeSession(
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    id: 'session-1',
    startedAt: '2026-03-04T10:00:00.000Z',
    operations: ['addition'],
    difficulty: 1,
    sessionLength: 5,
    attempted: 5,
    correct: 3,
    incorrect: 2,
    ...overrides,
  }
}

/** A saved attempt record, as read back from storage. */
export function makeAttempt(
  overrides: Partial<PracticeAttempt> = {},
): PracticeAttempt {
  return {
    id: 'attempt-1',
    questionId: 'q1',
    operation: 'multiplication',
    firstOperand: 7,
    secondOperand: 8,
    correctAnswer: 56,
    selectedAnswer: 54,
    selfReportedCorrect: false,
    difficulty: 2,
    source: 'regular',
    attemptedAt: '2026-03-04T10:01:00.000Z',
    sessionId: 'session-1',
    ...overrides,
  }
}

/**
 * A saved mistake pattern, as read back from storage: 7 × 8 missed once at
 * Level 2. Its ID always matches its contents, as saved ones do.
 */
export function makeMistakePattern(
  overrides: Partial<MistakePattern> = {},
): MistakePattern {
  const pattern: MistakePattern = {
    id: '',
    operation: 'multiplication',
    firstOperand: 7,
    secondOperand: 8,
    correctAnswer: 56,
    difficulty: 2,
    incorrectCount: 1,
    similarCorrectCount: 0,
    lastIncorrectAt: '2026-03-04T10:01:00.000Z',
    mastered: false,
    ...overrides,
  }
  return { ...pattern, id: overrides.id ?? mistakePatternId(pattern) }
}

interface SessionSpec {
  config?: Partial<PracticeConfig>
  correct: number
  incorrect: number
  startedAt: string
  /** Leave the session unfinished: another can then start after it. Default true. */
  finished?: boolean
}

/**
 * A history of several sessions, in the order given, with chosen start times,
 * built by playing each one through the real reducer. A session left
 * unfinished stays in the history once the next one starts.
 */
export function historyState(specs: SessionSpec[]): PracticeSessionState {
  let state: PracticeSessionState = initialPracticeSessionState
  for (const spec of specs) {
    const config: PracticeConfig = {
      operations: ['addition'],
      difficulty: 1,
      sessionLength: 'continuous',
      ...spec.config,
    }
    const started = new Date(spec.startedAt)
    const session = createSession(config, started)
    state = practiceSessionReducer(state, {
      type: 'sessionStarted',
      session,
      firstQuestion: generateQuestionForOperations(
        config.operations,
        config.difficulty,
      ),
    })

    const total = spec.correct + spec.incorrect
    for (let i = 0; i < total; i++) {
      const question = state.currentQuestion!
      state = practiceSessionReducer(state, {
        type: 'resultRecorded',
        attempt: createAttempt(
          state.session!,
          question,
          {
            selectedAnswer: question.correctAnswer,
            selfReportedCorrect: i < spec.correct,
          },
          new Date(started.getTime() + (i + 1) * 1000),
        ),
        nextQuestion: generateNextQuestion(
          config.operations,
          config.difficulty,
          question,
        ),
      })
    }
    if (spec.finished !== false) {
      state = practiceSessionReducer(state, {
        type: 'sessionEnded',
        completedAt: new Date(
          started.getTime() + (total + 1) * 1000,
        ).toISOString(),
      })
    }
  }
  return state
}
