import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultSettings,
  MAX_STORED_ATTEMPTS,
} from '../constants/settings'
import {
  makeAttempt,
  makeMistakePattern,
  makeQuestion,
  makeSession,
} from '../test/fixtures'
import {
  blockStorage,
  breakStorageMethod,
  failReadsOf,
  fillStorage,
  stored,
} from '../test/storage'
import type { AppSettings } from '../types/settings'
import { recordMistake } from './mistakePatterns'
import {
  eraseSavedData,
  loadPersistedData,
  saveActiveSession,
  saveAttempts,
  saveMistakePatterns,
  saveSessions,
  saveSettings,
  saveStatistics,
} from './persistence'
import {
  createEmptyStatistics,
  recordAttemptInStatistics,
  statisticsFromAttempts,
} from './statisticsService'
import { STORAGE_KEYS } from './storageService'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

const save = (key: string, value: unknown) =>
  window.localStorage.setItem(key, JSON.stringify(value))

const customSettings: AppSettings = {
  soundEffectsEnabled: true,
  cardAnimationEnabled: false,
  showExplanations: false,
  feedbackEffectsEnabled: false,
  defaultSessionLength: 20,
  defaultDifficulty: 3,
  defaultOperations: ['multiplication'],
  masteryThreshold: 5,
}

describe('loadPersistedData on a first visit', () => {
  it('starts with the defaults and nothing saved', () => {
    const data = loadPersistedData()

    expect(data.settings).toEqual(createDefaultSettings())
    expect(data.sessions).toEqual([])
    expect(data.attempts).toEqual([])
  })

  it('reports no problem and allows saving', () => {
    const data = loadPersistedData()

    expect(data.problem).toBeNull()
    expect(data.writable).toBe(true)
  })

  it('saves the schema version', () => {
    loadPersistedData()

    expect(stored(STORAGE_KEYS.version)).toEqual({ version: 1 })
  })
})

describe('loadPersistedData with saved data', () => {
  it('brings back what was saved', () => {
    const sessions = [makeSession({ id: 's1' }), makeSession({ id: 's2' })]
    const attempts = [makeAttempt({ id: 'a1' }), makeAttempt({ id: 'a2' })]
    saveSettings(customSettings)
    saveSessions(sessions)
    saveAttempts(attempts)

    const data = loadPersistedData()

    expect(data.settings).toEqual(customSettings)
    expect(data.sessions).toEqual(sessions)
    expect(data.attempts).toEqual(attempts)
    expect(data.problem).toBeNull()
  })

  it('keeps attempts in the order they were saved', () => {
    const attempts = ['c', 'a', 'b'].map((id) => makeAttempt({ id }))
    saveAttempts(attempts)

    expect(loadPersistedData().attempts.map((a) => a.id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('brings back a session that never finished, with no end time', () => {
    saveSessions([makeSession()])

    expect(loadPersistedData().sessions[0].completedAt).toBeUndefined()
  })

  it('keeps only the 100 most recent sessions', () => {
    save(
      STORAGE_KEYS.sessions,
      Array.from({ length: 130 }, (_, i) => makeSession({ id: `s${i + 1}` })),
    )

    const { sessions } = loadPersistedData()

    expect(sessions).toHaveLength(100)
    expect(sessions[0].id).toBe('s31')
    expect(sessions[99].id).toBe('s130')
  })

  it('copes with several thousand attempts, keeping the newest in detail', () => {
    const attempts = Array.from({ length: 6000 }, (_, i) =>
      makeAttempt({ id: `a${i}`, questionId: `q${i}` }),
    )
    window.localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(attempts))

    const started = performance.now()
    const loaded = loadPersistedData().attempts
    const elapsed = performance.now() - started

    expect(loaded).toHaveLength(MAX_STORED_ATTEMPTS)
    expect(loaded[0].id).toBe('a1000')
    expect(loaded.at(-1)?.id).toBe('a5999')
    expect(elapsed).toBeLessThan(1000)
  })
})

describe('loadPersistedData with damaged data', () => {
  const goodSessions = [makeSession({ id: 's1' })]
  const goodAttempts = [makeAttempt({ id: 'a1' })]

  it('replaces damaged settings with defaults, and keeps the rest', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{oops')
    saveSessions(goodSessions)
    saveAttempts(goodAttempts)

    const data = loadPersistedData()

    expect(data.settings).toEqual(createDefaultSettings())
    expect(data.sessions).toEqual(goodSessions)
    expect(data.attempts).toEqual(goodAttempts)
    expect(data.problem).toBeNull()
  })

  it('empties damaged attempts, and keeps the rest', () => {
    saveSettings(customSettings)
    saveSessions(goodSessions)
    window.localStorage.setItem(STORAGE_KEYS.attempts, '[{"id": ')

    const data = loadPersistedData()

    expect(data.attempts).toEqual([])
    expect(data.settings).toEqual(customSettings)
    expect(data.sessions).toEqual(goodSessions)
  })

  it('empties damaged sessions, and keeps the rest', () => {
    saveSettings(customSettings)
    window.localStorage.setItem(STORAGE_KEYS.sessions, 'not json')
    saveAttempts(goodAttempts)

    const data = loadPersistedData()

    expect(data.sessions).toEqual([])
    expect(data.attempts).toEqual(goodAttempts)
  })

  it('keeps the good records when only some are damaged', () => {
    save(STORAGE_KEYS.attempts, [
      makeAttempt({ id: 'a1' }),
      { id: 'broken' },
      null,
      makeAttempt({ id: 'a2' }),
      makeAttempt({ id: 'a3', difficulty: 99 as never }),
    ])
    save(STORAGE_KEYS.sessions, [
      makeSession({ id: 's1' }),
      makeSession({ id: 'bad', attempted: 5, correct: 5, incorrect: 5 }),
    ])

    const data = loadPersistedData()

    expect(data.attempts.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(data.sessions.map((s) => s.id)).toEqual(['s1'])
  })

  it.each([
    ['an object', { a: 1 }],
    ['text', 'attempts'],
    ['a number', 5],
    ['null', null],
  ])('treats %s where a list belongs as an empty list', (_, value) => {
    save(STORAGE_KEYS.attempts, value)
    save(STORAGE_KEYS.sessions, value)

    const data = loadPersistedData()

    expect(data.attempts).toEqual([])
    expect(data.sessions).toEqual([])
  })

  it('repairs only the bad fields of the saved settings', () => {
    save(STORAGE_KEYS.settings, {
      ...customSettings,
      defaultDifficulty: 42,
      showExplanations: 'sometimes',
    })

    const { settings } = loadPersistedData()

    expect(settings.defaultDifficulty).toBe(1)
    expect(settings.showExplanations).toBe(true)
    expect(settings.cardAnimationEnabled).toBe(false)
    expect(settings.defaultSessionLength).toBe(20)
    expect(settings.masteryThreshold).toBe(5)
  })

  it('leaves what is saved untouched, even when it is damaged', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{oops')
    window.localStorage.setItem(STORAGE_KEYS.attempts, '[1, 2')

    loadPersistedData()

    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBe('{oops')
    expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBe('[1, 2')
  })

  it('never touches data that belongs to anything else', () => {
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    window.localStorage.setItem(STORAGE_KEYS.attempts, 'garbage')

    loadPersistedData()

    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
  })
})

describe('loadPersistedData when storage cannot be used', () => {
  it('starts fresh and reports the problem when storage is blocked', () => {
    restore = blockStorage()

    const data = loadPersistedData()

    expect(data.problem).toBe('unavailable')
    expect(data.writable).toBe(false)
    expect(data.settings).toEqual(createDefaultSettings())
    expect(data.sessions).toEqual([])
    expect(data.attempts).toEqual([])
  })

  it('starts fresh and reports the problem when reading fails', () => {
    saveAttempts([makeAttempt()])
    restore = breakStorageMethod('getItem')

    const data = loadPersistedData()

    expect(data.problem).toBe('unavailable')
    expect(data.writable).toBe(false)
  })

  it('starts fresh, and does not allow saving, when the data is from a newer version', () => {
    window.localStorage.setItem(STORAGE_KEYS.version, '{"version":7}')
    saveAttempts([makeAttempt()])
    saveSettings(customSettings)

    const data = loadPersistedData()

    expect(data.problem).toBe('newer-version')
    expect(data.writable).toBe(false)
    expect(data.settings).toEqual(createDefaultSettings())
    expect(data.attempts).toEqual([])
    // The newer data is still there, for the newer app.
    expect(stored(STORAGE_KEYS.settings)).toEqual(customSettings)
    expect(stored(STORAGE_KEYS.version)).toEqual({ version: 7 })
  })

  it('starts fresh when the version cannot be saved', () => {
    restore = fillStorage()

    const data = loadPersistedData()

    expect(data.problem).toBe('unavailable')
    expect(data.writable).toBe(false)
  })
})

describe('saving', () => {
  it('saveSettings stores the settings', () => {
    expect(saveSettings(customSettings)).toEqual({ ok: true })

    expect(stored(STORAGE_KEYS.settings)).toEqual(customSettings)
  })

  it('saveAttempts stores every field of every attempt', () => {
    const attempt = makeAttempt({
      id: 'abc',
      selectedAnswer: 54,
      selfReportedCorrect: false,
      operation: 'division',
      difficulty: 3,
      sessionId: 'sess-9',
      attemptedAt: '2026-05-06T07:08:09.000Z',
    })

    expect(saveAttempts([attempt])).toEqual({ ok: true })

    expect(stored(STORAGE_KEYS.attempts)).toEqual([attempt])
  })

  it('saveSessions stores the session details and completion', () => {
    const session = makeSession({
      id: 'abc',
      completedAt: '2026-03-04T10:09:00.000Z',
    })

    expect(saveSessions([session])).toEqual({ ok: true })

    expect(stored(STORAGE_KEYS.sessions)).toEqual([session])
  })

  it('saveSessions keeps only the 100 most recent', () => {
    saveSessions(
      Array.from({ length: 120 }, (_, i) => makeSession({ id: `s${i + 1}` })),
    )

    const saved = stored(STORAGE_KEYS.sessions) as { id: string }[]
    expect(saved).toHaveLength(100)
    expect(saved[0].id).toBe('s21')
  })

  it('report "full" when there is no space, without throwing', () => {
    restore = fillStorage()

    expect(saveAttempts([makeAttempt()])).toEqual({ ok: false, reason: 'full' })
    expect(saveSessions([makeSession()])).toEqual({ ok: false, reason: 'full' })
    expect(saveSettings(customSettings)).toEqual({ ok: false, reason: 'full' })
  })

  it('report "unavailable" when storage is blocked, without throwing', () => {
    restore = blockStorage()

    expect(saveAttempts([makeAttempt()])).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})

describe('statistics', () => {
  const attempts = [
    makeAttempt({
      id: 'a1',
      operation: 'addition',
      difficulty: 1,
      selfReportedCorrect: true,
    }),
    makeAttempt({
      id: 'a2',
      operation: 'division',
      difficulty: 3,
      selfReportedCorrect: false,
    }),
    makeAttempt({
      id: 'a3',
      operation: 'addition',
      difficulty: 1,
      selfReportedCorrect: true,
    }),
  ]

  it('start empty on a first visit', () => {
    expect(loadPersistedData().statistics).toEqual(createEmptyStatistics())
  })

  it('are saved, and come back as they were', () => {
    const stats = statisticsFromAttempts(attempts)
    saveAttempts(attempts)

    expect(saveStatistics(stats)).toEqual({ ok: true })

    expect(stored(STORAGE_KEYS.statistics)).toEqual(stats)
    expect(loadPersistedData().statistics).toEqual(stats)
  })

  it('are counted again from the attempts when none were saved yet', () => {
    // As for everyone who practiced before totals were saved separately.
    saveAttempts(attempts)

    expect(loadPersistedData().statistics).toEqual(
      statisticsFromAttempts(attempts),
    )
  })

  it('are counted again from the attempts when the saved totals are not valid JSON', () => {
    saveAttempts(attempts)
    window.localStorage.setItem(STORAGE_KEYS.statistics, '{oops')

    expect(loadPersistedData().statistics).toEqual(
      statisticsFromAttempts(attempts),
    )
  })

  it('are counted again from the attempts when the saved totals contradict themselves', () => {
    saveAttempts(attempts)
    const damaged = statisticsFromAttempts(attempts)
    damaged.byOperation.addition.attempted += 5
    saveStatistics(damaged)

    expect(loadPersistedData().statistics).toEqual(
      statisticsFromAttempts(attempts),
    )
  })

  it('are counted again from the attempts when the saved totals have fallen behind them', () => {
    // The attempts saved but the totals did not, for example because storage filled up.
    saveAttempts(attempts)
    saveStatistics(
      recordAttemptInStatistics(createEmptyStatistics(), attempts[0]),
    )

    expect(loadPersistedData().statistics.attempted).toBe(3)
    expect(loadPersistedData().statistics).toEqual(
      statisticsFromAttempts(attempts),
    )
  })

  it('are kept when they hold more than the attempts, as when old attempts were archived', () => {
    const archived = statisticsFromAttempts([
      ...attempts,
      ...attempts,
      ...attempts,
    ])
    saveAttempts(attempts)
    saveStatistics(archived)

    expect(loadPersistedData().statistics).toEqual(archived)
  })

  it('are kept when there are no attempts at all', () => {
    const kept = statisticsFromAttempts(attempts)
    saveStatistics(kept)

    expect(loadPersistedData().statistics).toEqual(kept)
  })

  it('are empty when storage cannot be used', () => {
    restore = blockStorage()

    expect(loadPersistedData().statistics).toEqual(createEmptyStatistics())
  })

  it('report "full" when they cannot be saved, without throwing', () => {
    restore = fillStorage()

    expect(saveStatistics(createEmptyStatistics())).toEqual({
      ok: false,
      reason: 'full',
    })
  })
})

describe('the way a session was practiced', () => {
  it('is saved, and comes back with the session', () => {
    const sessions = [
      makeSession({ id: 'a', mode: 'mistake-review' }),
      makeSession({ id: 'b' }),
    ]
    saveSessions(sessions)

    expect(loadPersistedData().sessions).toEqual(sessions)
    expect(stored(STORAGE_KEYS.sessions)).toEqual(sessions)
  })

  it('is not needed: a session saved before review mode loads as it was', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify([makeSession({ id: 'old' })]),
    )

    const [loaded] = loadPersistedData().sessions

    expect(loaded.id).toBe('old')
    expect(loaded.mode).toBeUndefined()
  })

  it('drops a session whose mode makes no sense, and keeps the others', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify([
        makeSession({ id: 'good' }),
        { ...makeSession({ id: 'bad' }), mode: 'something-else' },
      ]),
    )

    expect(loadPersistedData().sessions.map((s) => s.id)).toEqual(['good'])
  })
})

describe('mistake patterns', () => {
  const pattern = makeMistakePattern
  const other = () =>
    pattern({ firstOperand: 3, secondOperand: 4, correctAnswer: 12 })
  const savedRaw = (value: unknown) =>
    window.localStorage.setItem(
      STORAGE_KEYS.mistakePatterns,
      typeof value === 'string' ? value : JSON.stringify(value),
    )

  it('start empty on a first visit', () => {
    expect(loadPersistedData().mistakePatterns).toEqual([])
  })

  it('are saved, and come back as they were, in order', () => {
    const patterns = [
      pattern({ incorrectCount: 4, similarCorrectCount: 2 }),
      other(),
      pattern({
        operation: 'division',
        firstOperand: 56,
        secondOperand: 7,
        correctAnswer: 8,
        mastered: true,
        similarCorrectCount: 3,
      }),
    ]
    saveMistakePatterns(patterns)

    expect(stored(STORAGE_KEYS.mistakePatterns)).toEqual(patterns)
    expect(loadPersistedData().mistakePatterns).toEqual(patterns)
  })

  it('are loaded without touching what is saved', () => {
    savedRaw([pattern()])
    const before = window.localStorage.getItem(STORAGE_KEYS.mistakePatterns)

    loadPersistedData()

    expect(window.localStorage.getItem(STORAGE_KEYS.mistakePatterns)).toBe(
      before,
    )
  })

  describe('when some saved ones are not usable', () => {
    it('drop only the bad records and keep the good ones', () => {
      savedRaw([
        pattern(),
        { ...other(), correctAnswer: 13 }, // the answer is wrong
        'not even an object',
        { ...other(), incorrectCount: 0 },
        pattern({ firstOperand: 6, secondOperand: 6, correctAnswer: 36 }),
        null,
      ])

      const loaded = loadPersistedData().mistakePatterns

      expect(loaded.map((p) => p.firstOperand)).toEqual([7, 6])
    })

    it('drop a repeat of a pattern, keeping the first', () => {
      savedRaw([pattern({ incorrectCount: 5 }), other(), pattern()])

      const loaded = loadPersistedData().mistakePatterns

      expect(loaded).toHaveLength(2)
      expect(loaded[0].incorrectCount).toBe(5)
    })

    it('are an empty list when every record is bad, and are not worked out again from the attempts', () => {
      saveAttempts([makeAttempt({ selfReportedCorrect: false })])
      savedRaw([{ nonsense: true }])

      expect(loadPersistedData().mistakePatterns).toEqual([])
    })
  })

  describe('worked out again from the saved attempts', () => {
    const wrongSeven = (id: string, at: string) =>
      makeAttempt({ id, selfReportedCorrect: false, attemptedAt: at })

    beforeEach(() => {
      saveAttempts([
        wrongSeven('a1', '2026-03-01T10:00:00.000Z'),
        makeAttempt({ id: 'a2', selfReportedCorrect: true, firstOperand: 2 }),
        wrongSeven('a3', '2026-03-03T10:00:00.000Z'),
        makeAttempt({
          id: 'a4',
          selfReportedCorrect: false,
          firstOperand: 3,
          secondOperand: 4,
          correctAnswer: 12,
        }),
      ])
    })

    const expected = () => [
      expect.objectContaining({
        firstOperand: 7,
        incorrectCount: 2,
        lastIncorrectAt: '2026-03-03T10:00:00.000Z',
      }),
      expect.objectContaining({ firstOperand: 3, incorrectCount: 1 }),
    ]

    it('when none were ever saved, so earlier mistakes are not lost', () => {
      expect(loadPersistedData().mistakePatterns).toEqual(expected())
    })

    it('when the saved patterns are not valid JSON', () => {
      savedRaw('{not json')

      expect(loadPersistedData().mistakePatterns).toEqual(expected())
    })

    it.each([
      ['an object', { a: 1 }],
      ['text', 'patterns'],
      ['a number', 7],
    ])('when the saved patterns are %s, not a list', (_, value) => {
      savedRaw(value)

      expect(loadPersistedData().mistakePatterns).toEqual(expected())
    })

    it('but never when a list was saved, even an empty one', () => {
      savedRaw([])

      expect(loadPersistedData().mistakePatterns).toEqual([])
    })

    it('and the rebuilt patterns are the ones that would have been saved', () => {
      const rebuilt = loadPersistedData().mistakePatterns
      saveMistakePatterns(rebuilt)

      expect(loadPersistedData().mistakePatterns).toEqual(rebuilt)
    })
  })

  it('are updated, not repeated, when the same question is missed again after a restart', () => {
    const attempt = (id: string, at: string) =>
      makeAttempt({ id, selfReportedCorrect: false, attemptedAt: at })
    saveMistakePatterns(
      recordMistake([], attempt('a1', '2026-03-01T10:00:00.000Z')),
    )

    const reloaded = loadPersistedData().mistakePatterns
    const updated = recordMistake(
      reloaded,
      attempt('a2', '2026-03-02T10:00:00.000Z'),
    )

    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      incorrectCount: 2,
      lastIncorrectAt: '2026-03-02T10:00:00.000Z',
    })
  })

  it('are empty when storage cannot be used', () => {
    restore = blockStorage()

    expect(loadPersistedData().mistakePatterns).toEqual([])
  })

  it('count as unusable storage when only they cannot be read', () => {
    savedRaw([pattern()])
    restore = failReadsOf(STORAGE_KEYS.mistakePatterns)

    const data = loadPersistedData()

    expect(data.problem).toBe('unavailable')
    expect(data.writable).toBe(false)
    expect(data.mistakePatterns).toEqual([])
  })

  it('report "full" when they cannot be saved, without throwing', () => {
    restore = fillStorage()

    expect(saveMistakePatterns([pattern()])).toEqual({
      ok: false,
      reason: 'full',
    })
  })

  it('report "unavailable" when storage is blocked, without throwing', () => {
    restore = blockStorage()

    expect(saveMistakePatterns([pattern()])).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})

describe('eraseSavedData', () => {
  it('removes everything the app saved, and nothing else', () => {
    saveSettings(createDefaultSettings())
    saveAttempts([makeAttempt()])
    window.localStorage.setItem(STORAGE_KEYS.mistakePatterns, '[]')
    window.localStorage.setItem(STORAGE_KEYS.version, '{"version":1}')
    window.localStorage.setItem('someOtherApp.token', 'keep me')

    expect(eraseSavedData()).toBe(true)

    for (const key of Object.values(STORAGE_KEYS))
      expect(window.localStorage.getItem(key)).toBeNull()
    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
  })

  it('succeeds when there is nothing to erase', () => {
    expect(eraseSavedData()).toBe(true)
  })

  it('succeeds when storage is switched off, since nothing can be saved', () => {
    restore = blockStorage()

    expect(eraseSavedData()).toBe(true)
  })

  it('fails when saved data cannot be removed', () => {
    saveSettings(createDefaultSettings())
    restore = breakStorageMethod('removeItem')

    expect(eraseSavedData()).toBe(false)
  })
})

describe('the session in progress', () => {
  const active = {
    session: makeSession({
      id: 's1',
      operations: ['multiplication'],
      difficulty: 2,
      attempted: 0,
      correct: 0,
      incorrect: 0,
    }),
    currentQuestion: makeQuestion(),
    card: { selectedAnswer: 54, flipped: true },
  }

  it('is brought back when it was saved and can be carried on', () => {
    save(STORAGE_KEYS.activeSession, active)

    const loaded = loadPersistedData()

    expect(loaded.activeSession).toEqual(active)
    expect(loaded.problem).toBeNull()
  })

  it('is counted from the saved attempts', () => {
    save(STORAGE_KEYS.activeSession, active)
    save(STORAGE_KEYS.attempts, [
      makeAttempt({
        sessionId: 's1',
        questionId: 'earlier',
        selfReportedCorrect: false,
      }),
    ])

    expect(loadPersistedData().activeSession?.session).toMatchObject({
      attempted: 1,
      correct: 0,
      incorrect: 1,
    })
  })

  it('is not there on a first visit, and nothing is written for it', () => {
    expect(loadPersistedData().activeSession).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
  })

  it.each([
    ['damaged JSON', '{"session":'],
    ['something that is not a session', JSON.stringify({ hello: 'world' })],
    [
      'a session that has ended',
      JSON.stringify({
        ...active,
        session: { ...active.session, completedAt: '2026-03-04T11:00:00.000Z' },
      }),
    ],
  ])(
    'is dropped, and taken out of storage so it is not tried again, when it is %s',
    (_name, raw) => {
      window.localStorage.setItem(STORAGE_KEYS.activeSession, raw)
      save(STORAGE_KEYS.settings, customSettings)

      const loaded = loadPersistedData()

      expect(loaded.activeSession).toBeNull()
      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
      // Only the session in progress is lost, not the rest.
      expect(loaded.settings).toEqual(customSettings)
    },
  )

  it('is left alone when the saved data comes from a newer version', () => {
    save(STORAGE_KEYS.version, { version: 99 })
    save(STORAGE_KEYS.activeSession, active)

    const loaded = loadPersistedData()

    expect(loaded.problem).toBe('newer-version')
    expect(loaded.activeSession).toBeNull()
    expect(stored(STORAGE_KEYS.activeSession)).toEqual(active)
  })

  it('is not there when storage is switched off', () => {
    restore = blockStorage()

    expect(loadPersistedData()).toMatchObject({
      activeSession: null,
      problem: 'unavailable',
    })
  })

  it('is not there when reading it fails', () => {
    save(STORAGE_KEYS.activeSession, active)
    restore = failReadsOf(STORAGE_KEYS.activeSession)

    expect(loadPersistedData()).toMatchObject({
      activeSession: null,
      problem: 'unavailable',
    })
  })

  describe('saveActiveSession', () => {
    it('saves it', () => {
      expect(saveActiveSession(active)).toEqual({ ok: true })

      expect(stored(STORAGE_KEYS.activeSession)).toEqual(active)
    })

    it('removes what was saved when there is none now', () => {
      save(STORAGE_KEYS.activeSession, active)

      expect(saveActiveSession(null)).toEqual({ ok: true })

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
    })

    it('says so, and does not throw, when it cannot save', () => {
      restore = fillStorage()

      expect(saveActiveSession(active)).toEqual({ ok: false, reason: 'full' })
    })

    it('says so, and does not throw, when it cannot remove', () => {
      restore = breakStorageMethod('removeItem')

      expect(saveActiveSession(null)).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })

    it('reports storage that is switched off', () => {
      restore = blockStorage()

      expect(saveActiveSession(active)).toEqual({
        ok: false,
        reason: 'unavailable',
      })
      expect(saveActiveSession(null)).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })
  })

  it('is erased with everything else', () => {
    save(STORAGE_KEYS.activeSession, active)

    expect(eraseSavedData()).toBe(true)

    expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
  })
})
