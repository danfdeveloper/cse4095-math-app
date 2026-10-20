import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/settings'
import { makeAttempt, makeSession } from '../test/fixtures'
import {
  createEmptyStatistics,
  statisticsFromAttempts,
} from '../services/statisticsService'
import {
  isAppStatistics,
  isPracticeAttempt,
  isPracticeSession,
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
