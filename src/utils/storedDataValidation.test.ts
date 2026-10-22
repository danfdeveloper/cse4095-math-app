import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/settings'
import {
  makeAttempt,
  makeMistakePattern,
  makeQuestion,
  makeSession,
} from '../test/fixtures'
import {
  createEmptyStatistics,
  statisticsFromAttempts,
} from '../services/statisticsService'
import {
  isAppStatistics,
  isCardProgress,
  isMistakePattern,
  isPracticeAttempt,
  isPracticeSession,
  isStoredQuestion,
  keepValidRecords,
  sanitizeSettings,
} from './storedDataValidation'

describe('isPracticeAttempt', () => {
  it('accepts a complete attempt', () => {
    expect(isPracticeAttempt(makeAttempt())).toBe(true)
  })

  it('accepts a mistake-review attempt', () => {
    expect(isPracticeAttempt(makeAttempt({ source: 'mistake-review' }))).toBe(
      true,
    )
  })

  it('accepts zero answers and operands', () => {
    expect(
      isPracticeAttempt(
        makeAttempt({
          firstOperand: 0,
          secondOperand: 0,
          correctAnswer: 0,
          selectedAnswer: 0,
        }),
      ),
    ).toBe(true)
  })

  it.each([null, undefined, 'attempt', 7, [], true])('rejects %j', (value) => {
    expect(isPracticeAttempt(value)).toBe(false)
  })

  it.each<[string, Record<string, unknown>]>([
    ['an empty id', { id: '' }],
    ['a non-text id', { id: 5 }],
    ['an empty question id', { questionId: '' }],
    ['an unknown operation', { operation: 'power' }],
    ['a fractional operand', { firstOperand: 7.5 }],
    ['a text operand', { secondOperand: '8' }],
    ['a NaN answer', { correctAnswer: Number.NaN }],
    ['an infinite chosen answer', { selectedAnswer: Infinity }],
    ['a text self-report', { selfReportedCorrect: 'yes' }],
    ['a missing self-report', { selfReportedCorrect: undefined }],
    ['difficulty 0', { difficulty: 0 }],
    ['difficulty 5', { difficulty: 5 }],
    ['an unknown source', { source: 'review' }],
    ['a time that is not a date', { attemptedAt: 'yesterday' }],
    ['a numeric time', { attemptedAt: 1234567890 }],
    ['an empty session id', { sessionId: '' }],
  ])('rejects an attempt with %s', (_, change) => {
    expect(isPracticeAttempt({ ...makeAttempt(), ...change })).toBe(false)
  })

  it.each([
    'id',
    'questionId',
    'operation',
    'firstOperand',
    'secondOperand',
    'correctAnswer',
    'selectedAnswer',
    'selfReportedCorrect',
    'difficulty',
    'source',
    'attemptedAt',
    'sessionId',
  ])('rejects an attempt with no %s', (field) => {
    const attempt: Record<string, unknown> = { ...makeAttempt() }
    delete attempt[field]

    expect(isPracticeAttempt(attempt)).toBe(false)
  })

  it('ignores extra fields', () => {
    expect(isPracticeAttempt({ ...makeAttempt(), added: 'later' })).toBe(true)
  })
})

describe('isPracticeAttempt and the mistake a question came from', () => {
  it('accepts an attempt with none, as saved before review mode', () => {
    expect(isPracticeAttempt(makeAttempt())).toBe(true)
  })

  it('accepts an attempt that names the mistake', () => {
    expect(
      isPracticeAttempt(
        makeAttempt({
          source: 'mistake-review',
          mistakePatternId: 'multiplication:7:8:2',
        }),
      ),
    ).toBe(true)
  })

  it.each(['', 7, null, true, {}])(
    'rejects an attempt whose mistake ID is %j',
    (id) => {
      expect(
        isPracticeAttempt({ ...makeAttempt(), mistakePatternId: id }),
      ).toBe(false)
    },
  )
})

describe('isPracticeSession and the way of practicing', () => {
  it.each([undefined, 'regular', 'mistake-review'] as const)(
    'accepts a session with mode %j, as saved before review mode and after',
    (mode) => {
      expect(isPracticeSession(makeSession({ mode }))).toBe(true)
    },
  )

  it.each(['review', '', 7, null, true])(
    'rejects a session with mode %j',
    (mode) => {
      expect(isPracticeSession({ ...makeSession(), mode })).toBe(false)
    },
  )
})

describe('isPracticeSession', () => {
  it('accepts a complete, unfinished session', () => {
    expect(isPracticeSession(makeSession())).toBe(true)
  })

  it('accepts a finished session', () => {
    expect(
      isPracticeSession(
        makeSession({ completedAt: '2026-03-04T10:09:00.000Z' }),
      ),
    ).toBe(true)
  })

  it('accepts continuous practice and several operations', () => {
    expect(
      isPracticeSession(
        makeSession({
          sessionLength: 'continuous',
          operations: ['addition', 'division'],
        }),
      ),
    ).toBe(true)
  })

  it('accepts a session with nothing answered', () => {
    expect(
      isPracticeSession(
        makeSession({ attempted: 0, correct: 0, incorrect: 0 }),
      ),
    ).toBe(true)
  })

  it.each([null, undefined, 'session', 7, [], false])('rejects %j', (value) => {
    expect(isPracticeSession(value)).toBe(false)
  })

  it.each<[string, Record<string, unknown>]>([
    ['an empty id', { id: '' }],
    ['a bad start time', { startedAt: 'soon' }],
    ['a bad end time', { completedAt: 'later' }],
    ['no operations', { operations: [] }],
    ['an unknown operation', { operations: ['addition', 'power'] }],
    ['a repeated operation', { operations: ['addition', 'addition'] }],
    ['operations that are not a list', { operations: 'addition' }],
    ['difficulty 9', { difficulty: 9 }],
    ['a session length of 0', { sessionLength: 0 }],
    ['a negative session length', { sessionLength: -5 }],
    ['a fractional session length', { sessionLength: 2.5 }],
    ['an unknown length word', { sessionLength: 'forever' }],
    ['a negative count', { attempted: -1, correct: -1, incorrect: 0 }],
    ['a fractional count', { attempted: 2.5, correct: 1.5, incorrect: 1 }],
    ['totals that do not add up', { attempted: 5, correct: 3, incorrect: 3 }],
    [
      'more right answers than attempts',
      { attempted: 2, correct: 5, incorrect: 0 },
    ],
  ])('rejects a session with %s', (_, change) => {
    expect(isPracticeSession({ ...makeSession(), ...change })).toBe(false)
  })

  it.each([
    'id',
    'startedAt',
    'operations',
    'difficulty',
    'sessionLength',
    'attempted',
    'correct',
    'incorrect',
  ])('rejects a session with no %s', (field) => {
    const session: Record<string, unknown> = { ...makeSession() }
    delete session[field]

    expect(isPracticeSession(session)).toBe(false)
  })
})

describe('keepValidRecords', () => {
  it('keeps the valid records and drops the rest, in order', () => {
    const good1 = makeAttempt({ id: 'a' })
    const good2 = makeAttempt({ id: 'b' })

    expect(
      keepValidRecords(
        [good1, { broken: true }, null, good2, 'x'],
        isPracticeAttempt,
      ),
    ).toEqual([good1, good2])
  })

  it('returns an empty list for an empty list', () => {
    expect(keepValidRecords([], isPracticeAttempt)).toEqual([])
  })

  it('returns null for anything that is not a list', () => {
    expect(keepValidRecords({ not: 'a list' }, isPracticeAttempt)).toBeNull()
    expect(keepValidRecords('text', isPracticeAttempt)).toBeNull()
    expect(keepValidRecords(null, isPracticeAttempt)).toBeNull()
  })
})

describe('sanitizeSettings', () => {
  const saved = {
    soundEffectsEnabled: true,
    cardAnimationEnabled: false,
    showExplanations: false,
    feedbackEffectsEnabled: false,
    defaultSessionLength: 20,
    defaultDifficulty: 3,
    defaultOperations: ['multiplication', 'division'],
    masteryThreshold: 5,
  }

  it('keeps good saved settings as they are', () => {
    expect(sanitizeSettings(saved)).toEqual(saved)
  })

  it('accepts continuous as the default session length', () => {
    expect(
      sanitizeSettings({ ...saved, defaultSessionLength: 'continuous' })
        .defaultSessionLength,
    ).toBe('continuous')
  })

  it('accepts no default operations', () => {
    expect(
      sanitizeSettings({ ...saved, defaultOperations: [] }).defaultOperations,
    ).toEqual([])
  })

  it.each([null, undefined, 'settings', 42, [], true])(
    'gives the defaults for %j',
    (value) => {
      expect(sanitizeSettings(value)).toEqual(DEFAULT_SETTINGS)
    },
  )

  it('gives the defaults for an empty object', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  describe('one bad field falls back alone and keeps the good ones', () => {
    it.each<[string, Record<string, unknown>, keyof typeof saved]>([
      ['a text flag', { soundEffectsEnabled: 'yes' }, 'soundEffectsEnabled'],
      ['a numeric flag', { cardAnimationEnabled: 1 }, 'cardAnimationEnabled'],
      ['a null flag', { showExplanations: null }, 'showExplanations'],
      [
        'a word for a flag',
        { feedbackEffectsEnabled: 'off' },
        'feedbackEffectsEnabled',
      ],
      [
        'a zero session length',
        { defaultSessionLength: 0 },
        'defaultSessionLength',
      ],
      [
        'an unknown length word',
        { defaultSessionLength: 'forever' },
        'defaultSessionLength',
      ],
      ['difficulty 7', { defaultDifficulty: 7 }, 'defaultDifficulty'],
      ['difficulty as text', { defaultDifficulty: '3' }, 'defaultDifficulty'],
      [
        'an unknown operation',
        { defaultOperations: ['addition', 'power'] },
        'defaultOperations',
      ],
      [
        'repeated operations',
        { defaultOperations: ['addition', 'addition'] },
        'defaultOperations',
      ],
      [
        'operations that are not a list',
        { defaultOperations: 'addition' },
        'defaultOperations',
      ],
      ['a mastery threshold of 0', { masteryThreshold: 0 }, 'masteryThreshold'],
      [
        'a mastery threshold of 11',
        { masteryThreshold: 11 },
        'masteryThreshold',
      ],
      [
        'a fractional mastery threshold',
        { masteryThreshold: 2.5 },
        'masteryThreshold',
      ],
      [
        'a text mastery threshold',
        { masteryThreshold: '3' },
        'masteryThreshold',
      ],
    ])('%s', (_, change, field) => {
      const result = sanitizeSettings({ ...saved, ...change })

      expect(result[field]).toEqual(DEFAULT_SETTINGS[field])
      for (const other of Object.keys(saved) as (keyof typeof saved)[]) {
        if (other !== field) expect(result[other]).toEqual(saved[other])
      }
    })
  })

  it('fills in fields that are missing, for example after an update adds one', () => {
    const { masteryThreshold, ...older } = saved
    void masteryThreshold

    expect(sanitizeSettings(older)).toEqual({
      ...saved,
      masteryThreshold: DEFAULT_SETTINGS.masteryThreshold,
    })
  })

  it('leaves out fields it does not know', () => {
    expect(sanitizeSettings({ ...saved, somethingNew: 1 })).not.toHaveProperty(
      'somethingNew',
    )
  })

  it('accepts the mastery threshold at both ends of its range', () => {
    expect(
      sanitizeSettings({ ...saved, masteryThreshold: 1 }).masteryThreshold,
    ).toBe(1)
    expect(
      sanitizeSettings({ ...saved, masteryThreshold: 10 }).masteryThreshold,
    ).toBe(10)
  })

  it('returns its own copy, so changing the result never changes the defaults', () => {
    const result = sanitizeSettings(null)
    result.defaultOperations.push('addition')
    result.soundEffectsEnabled = true

    expect(DEFAULT_SETTINGS.defaultOperations).toEqual([])
    expect(DEFAULT_SETTINGS.soundEffectsEnabled).toBe(false)
  })
})

describe('isAppStatistics', () => {
  const populated = () =>
    statisticsFromAttempts([
      makeAttempt({
        id: '1',
        operation: 'addition',
        difficulty: 1,
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
        operation: 'addition',
        difficulty: 2,
        selfReportedCorrect: true,
      }),
    ])
  /** Statistics as they come back from storage: through JSON. */
  const viaJson = (value: unknown) => JSON.parse(JSON.stringify(value))

  it('accepts empty statistics', () => {
    expect(isAppStatistics(viaJson(createEmptyStatistics()))).toBe(true)
  })

  it('accepts statistics with answers in them, after a round trip through JSON', () => {
    expect(isAppStatistics(viaJson(populated()))).toBe(true)
  })

  it('ignores extra fields', () => {
    expect(isAppStatistics({ ...viaJson(populated()), addedLater: 1 })).toBe(
      true,
    )
  })

  it.each([null, undefined, 'stats', 7, [], true])('rejects %j', (value) => {
    expect(isAppStatistics(value)).toBe(false)
  })

  it('rejects an empty object', () => {
    expect(isAppStatistics({})).toBe(false)
  })

  /** Statistics as JSON, loosely typed so a test can damage them in any way. */
  interface Loose {
    attempted: number | string
    correct: number
    incorrect: number
    byOperation: Record<string, Counts>
    byDifficulty: Record<string, Counts>
  }
  type Counts = { attempted: number; correct: number; incorrect: number }

  it.each<[string, (s: Loose) => unknown]>([
    ['a missing operation', (s) => delete s.byOperation.division],
    ['a missing level', (s) => delete s.byDifficulty['3']],
    ['no byOperation', (s) => delete (s as Partial<Loose>).byOperation],
    ['no byDifficulty', (s) => delete (s as Partial<Loose>).byDifficulty],
    ['an overall total that does not add up', (s) => (s.correct += 1)],
    [
      'an operation total that does not add up',
      (s) => (s.byOperation.addition.incorrect += 1),
    ],
    [
      'a level total that does not add up',
      (s) => (s.byDifficulty['1'].correct += 1),
    ],
    ['a negative count', (s) => (s.attempted = -3)],
    ['a fractional count', (s) => (s.byOperation.addition.attempted = 1.5)],
    ['a text count', (s) => (s.attempted = '3')],
    // Each group is consistent on its own, so only the sums across groups are wrong.
    [
      'operations whose attempts do not add up to the total (one sum off, alone)',
      (s) => {
        s.byOperation.addition.attempted += 1
        s.byOperation.addition.incorrect += 1
      },
    ],
    [
      'operations whose right answers do not add up to the total (one sum off, alone)',
      (s) => {
        s.byOperation.addition.correct += 1
        s.byOperation.addition.incorrect -= 1
      },
    ],
    [
      'levels whose attempts do not add up to the total (one sum off, alone)',
      (s) => {
        s.byDifficulty['2'].attempted += 1
        s.byDifficulty['2'].incorrect += 1
      },
    ],
    [
      'levels whose right answers do not add up to the total (one sum off, alone)',
      (s) => {
        s.byDifficulty['1'].correct += 1
        s.byDifficulty['1'].incorrect -= 1
      },
    ],
    [
      'operations that do not add up to the total',
      (s) => {
        s.byOperation.addition.attempted -= 1
        s.byOperation.addition.correct -= 1
      },
    ],
    [
      'levels that do not add up to the total',
      (s) => {
        s.byDifficulty['4'].attempted += 1
        s.byDifficulty['4'].incorrect += 1
      },
    ],
  ])('rejects %s', (_, damage) => {
    const stats: Loose = viaJson(populated())
    damage(stats)

    expect(isAppStatistics(stats)).toBe(false)
  })
})

describe('isMistakePattern', () => {
  const pattern = makeMistakePattern
  const withField = (field: string, value: unknown) => ({
    ...pattern(),
    [field]: value,
  })

  it('accepts a complete pattern', () => {
    expect(isMistakePattern(pattern())).toBe(true)
  })

  it.each([
    ['addition', 'addition', 8, 7, 15],
    ['subtraction', 'subtraction', 15, 7, 8],
    ['multiplication', 'multiplication', 8, 7, 56],
    ['division', 'division', 56, 7, 8],
  ] as const)('accepts a %s pattern', (_, operation, a, b, answer) => {
    expect(
      isMistakePattern(
        pattern({
          operation,
          firstOperand: a,
          secondOperand: b,
          correctAnswer: answer,
        }),
      ),
    ).toBe(true)
  })

  it('accepts a mastered pattern, and one with progress', () => {
    expect(
      isMistakePattern(pattern({ similarCorrectCount: 3, mastered: true })),
    ).toBe(true)
    expect(isMistakePattern(pattern({ similarCorrectCount: 2 }))).toBe(true)
  })

  it('accepts zero as a number in the question', () => {
    expect(
      isMistakePattern(
        pattern({
          operation: 'multiplication',
          firstOperand: 0,
          secondOperand: 9,
          correctAnswer: 0,
        }),
      ),
    ).toBe(true)
  })

  it.each([null, undefined, 'pattern', 7, [], true])('rejects %j', (value) => {
    expect(isMistakePattern(value)).toBe(false)
  })

  it.each([
    'id',
    'operation',
    'firstOperand',
    'secondOperand',
    'correctAnswer',
    'difficulty',
    'incorrectCount',
    'similarCorrectCount',
    'lastIncorrectAt',
    'mastered',
  ])('rejects a pattern with no %s', (field) => {
    const incomplete: Record<string, unknown> = { ...pattern() }
    delete incomplete[field]

    expect(isMistakePattern(incomplete)).toBe(false)
  })

  it.each([
    ['an empty id', 'id', ''],
    ['an id that is not text', 'id', 5],
    ['an id that does not match the contents', 'id', 'multiplication:8:7:2'],
    ['an unknown operation', 'operation', 'power'],
    ['a fractional first number', 'firstOperand', 7.5],
    ['a negative first number', 'firstOperand', -7],
    ['a text second number', 'secondOperand', '8'],
    ['a negative answer', 'correctAnswer', -56],
    ['a difficulty that does not exist', 'difficulty', 5],
    ['a difficulty that is text', 'difficulty', '2'],
    ['no mistakes counted', 'incorrectCount', 0],
    ['a negative mistake count', 'incorrectCount', -1],
    ['a fractional mistake count', 'incorrectCount', 1.5],
    ['a negative similar-correct count', 'similarCorrectCount', -1],
    ['a fractional similar-correct count', 'similarCorrectCount', 0.5],
    ['a date that cannot be read', 'lastIncorrectAt', 'last Tuesday'],
    ['a date that is a number', 'lastIncorrectAt', 1700000000000],
    ['a mastered flag that is text', 'mastered', 'yes'],
    ['a mastered flag that is a number', 'mastered', 1],
  ])('rejects %s', (_, field, value) => {
    expect(isMistakePattern(withField(field, value))).toBe(false)
  })

  it.each([
    ['multiplication', 'multiplication', 7, 8, 54],
    ['addition', 'addition', 7, 8, 16],
    ['subtraction', 'subtraction', 15, 7, 7],
    ['division', 'division', 56, 7, 9],
  ] as const)(
    'rejects a %s pattern whose answer is wrong',
    (_, operation, a, b, answer) => {
      const wrong = {
        operation,
        firstOperand: a,
        secondOperand: b,
        correctAnswer: answer,
      }
      // Give it the ID its contents would have, so only the answer is wrong.
      expect(
        isMistakePattern(
          pattern({
            ...wrong,
            id: `${operation}:${a}:${b}:2`,
          }),
        ),
      ).toBe(false)
    },
  )

  it('rejects a subtraction that would go below zero', () => {
    expect(
      isMistakePattern(
        pattern({
          operation: 'subtraction',
          firstOperand: 3,
          secondOperand: 5,
          correctAnswer: -2,
        }),
      ),
    ).toBe(false)
  })

  it('rejects a division by zero, and one that does not come out whole', () => {
    expect(
      isMistakePattern(
        pattern({
          operation: 'division',
          firstOperand: 8,
          secondOperand: 0,
          correctAnswer: 0,
        }),
      ),
    ).toBe(false)
    expect(
      isMistakePattern(
        pattern({
          operation: 'division',
          firstOperand: 7,
          secondOperand: 2,
          correctAnswer: 3,
        }),
      ),
    ).toBe(false)
  })
})

describe('isStoredQuestion', () => {
  it('accepts a complete question that follows the rules', () => {
    expect(isStoredQuestion(makeQuestion())).toBe(true)
  })

  it('accepts a mistake-review question with its mistake', () => {
    expect(
      isStoredQuestion(
        makeQuestion({
          source: 'mistake-review',
          mistakePatternId: 'multiplication:7:8:2',
        }),
      ),
    ).toBe(true)
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', '7 × 8'],
    ['a list', [7, 8]],
  ])('rejects %s', (_name, value) => {
    expect(isStoredQuestion(value)).toBe(false)
  })

  it.each<[string, Record<string, unknown>]>([
    ['no id', { id: '' }],
    ['an id that is not text', { id: 7 }],
    ['an unknown operation', { operation: 'power' }],
    ['an operand with a fraction', { firstOperand: 7.5 }],
    ['an operand that is text', { secondOperand: '8' }],
    ['display text that is not text', { displayText: 78 }],
    ['an answer that is text', { correctAnswer: '56' }],
    ['choices that are not a list', { choices: '48,54,56,64' }],
    ['a choice that is text', { choices: [48, '54', 56, 64] }],
    ['an unknown level', { difficulty: 5 }],
    ['an unknown source', { source: 'guess' }],
    ['an empty mistake id', { mistakePatternId: '' }],
  ])('rejects a question with %s', (_name, change) => {
    expect(isStoredQuestion({ ...makeQuestion(), ...change })).toBe(false)
  })

  it.each<[string, Record<string, unknown>]>([
    ['the wrong answer', { correctAnswer: 57, choices: [48, 54, 57, 64] }],
    ['repeated choices', { choices: [48, 56, 56, 64] }],
    ['three choices', { choices: [48, 56, 64] }],
    ['no choice that is the answer', { choices: [48, 54, 55, 64] }],
    [
      'operands outside the level',
      {
        firstOperand: 70,
        secondOperand: 80,
        displayText: '70 × 80',
        correctAnswer: 5600,
        choices: [5400, 5500, 5600, 5700],
      },
    ],
    ['no display text', { displayText: '' }],
  ])(
    'rejects a question that breaks the question rules with %s',
    (_name, change) => {
      expect(isStoredQuestion({ ...makeQuestion(), ...change })).toBe(false)
    },
  )
})

describe('isCardProgress', () => {
  it.each([
    [{ selectedAnswer: null, flipped: false }],
    [{ selectedAnswer: 54, flipped: false }],
    [{ selectedAnswer: 54, flipped: true }],
  ])('accepts %j', (value) => {
    expect(isCardProgress(value)).toBe(true)
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', 'flipped'],
    ['a pick that is text', { selectedAnswer: '54', flipped: false }],
    ['a pick with a fraction', { selectedAnswer: 5.5, flipped: false }],
    ['a pick left out', { flipped: false }],
    ['a turn that is text', { selectedAnswer: 54, flipped: 'yes' }],
    ['a turn left out', { selectedAnswer: 54 }],
  ])('rejects %s', (_name, value) => {
    expect(isCardProgress(value)).toBe(false)
  })
})
