import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/settings'
import { useSettings } from '../hooks/useSettings'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useStorageStatus } from '../hooks/useStorageStatus'
import { STORAGE_KEYS } from '../services/storageService'
import { mistakePatternId } from '../services/mistakePatterns'
import { makeAttempt, makeSession } from '../test/fixtures'
import {
  blockStorage,
  breakStorageMethod,
  failWritesTo,
  fillStorage,
  stored,
} from '../test/storage'
import type { PracticeConfig, QuestionResult } from '../types/session'
import { AppProvider } from './AppProvider'

const config: PracticeConfig = {
  operations: ['addition'],
  difficulty: 1,
  sessionLength: 3,
}
const right: QuestionResult = { selectedAnswer: 1, selfReportedCorrect: true }
const wrong: QuestionResult = { selectedAnswer: 2, selfReportedCorrect: false }

/** Everything the app exposes, so a test can read and act on it. */
function mount() {
  return renderHook(
    () => ({
      practice: usePracticeSession(),
      settings: useSettings(),
      status: useStorageStatus(),
    }),
    { wrapper: AppProvider },
  )
}

const savedAttempts = () =>
  (stored(STORAGE_KEYS.attempts) ?? []) as ReturnType<typeof makeAttempt>[]
const savedSessions = () =>
  (stored(STORAGE_KEYS.sessions) ?? []) as ReturnType<typeof makeSession>[]

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

describe('saving attempts and sessions', () => {
  it('saves nothing just for opening the app or starting a session', () => {
    const { result } = mount()
    act(() => void result.current.practice.startSession(config))

    expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.sessions)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
  })

  it('saves every completed attempt as soon as it is recorded', () => {
    const { result } = mount()
    act(() => void result.current.practice.startSession(config))
    const question = result.current.practice.currentQuestion!

    act(() => result.current.practice.recordResult(wrong))

    expect(savedAttempts()).toHaveLength(1)
    expect(savedAttempts()[0]).toEqual({
      id: expect.any(String),
      questionId: question.id,
      operation: 'addition',
      firstOperand: question.firstOperand,
      secondOperand: question.secondOperand,
      correctAnswer: question.correctAnswer,
      selectedAnswer: 2,
      selfReportedCorrect: false,
      difficulty: 1,
      source: 'regular',
      attemptedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      sessionId: result.current.practice.session?.id,
    })
  })

  it('keeps adding attempts, one per answer', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    for (let i = 1; i <= 4; i++) {
      act(() => result.current.practice.recordResult(i % 2 ? right : wrong))

      expect(savedAttempts()).toHaveLength(i)
    }
    expect(savedAttempts().map((a) => a.selfReportedCorrect)).toEqual([
      true,
      false,
      true,
      false,
    ])
  })

  it('saves the session with its first answer, then keeps it up to date', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 10,
        }),
    )
    const id = result.current.practice.session!.id

    act(() => result.current.practice.recordResult(right))
    expect(savedSessions()).toHaveLength(1)
    expect(savedSessions()[0]).toMatchObject({ id, attempted: 1, correct: 1 })

    act(() => result.current.practice.recordResult(wrong))
    expect(savedSessions()).toHaveLength(1)
    expect(savedSessions()[0]).toMatchObject({
      id,
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
    expect(savedSessions()[0].completedAt).toBeUndefined()
  })

  it('saves the completion details when a fixed session ends', () => {
    const { result } = mount()
    act(() => void result.current.practice.startSession(config))

    for (let i = 0; i < 3; i++)
      act(() => result.current.practice.recordResult(right))

    expect(savedSessions()[0]).toMatchObject({
      attempted: 3,
      correct: 3,
      completedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    })
  })

  it('saves the completion details when a session is ended early', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    act(() => result.current.practice.recordResult(right))

    act(() => result.current.practice.endSession())

    expect(savedSessions()[0].completedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
  })

  it('never saves a session that ended with nothing answered', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    act(() => result.current.practice.endSession())

    expect(window.localStorage.getItem(STORAGE_KEYS.sessions)).toBeNull()
  })

  it('removes a discarded session and its attempts from what is saved', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    act(() => result.current.practice.recordResult(right))
    expect(savedAttempts()).toHaveLength(1)

    act(() => result.current.practice.discardSession())

    expect(savedAttempts()).toEqual([])
    expect(savedSessions()).toEqual([])
  })

  it('does not save a duplicate attempt reported twice at once', () => {
    const { result } = mount()
    act(() => void result.current.practice.startSession(config))

    act(() => {
      result.current.practice.recordResult(right)
      result.current.practice.recordResult(right)
    })

    expect(savedAttempts()).toHaveLength(1)
    expect(savedSessions()[0].attempted).toBe(1)
  })

  it('keeps only the 100 most recent sessions in what is saved', () => {
    const { result } = mount()
    for (let i = 0; i < 105; i++) {
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 1,
          }),
      )
      act(() => result.current.practice.recordResult(right))
    }

    expect(savedSessions()).toHaveLength(100)
    expect(savedAttempts()).toHaveLength(105)
  })
})

describe('after a browser restart', () => {
  /** Plays and closes the app, leaving only what was saved. */
  function playAndClose(
    answers: QuestionResult[],
    length: PracticeConfig['sessionLength'] = 'continuous',
  ) {
    const first = mount()
    act(
      () =>
        void first.result.current.practice.startSession({
          ...config,
          sessionLength: length,
        }),
    )
    for (const answer of answers)
      act(() => first.result.current.practice.recordResult(answer))
    first.unmount()
  }

  it('brings the attempts back', () => {
    playAndClose([right, wrong, right])

    const { result } = mount()

    expect(result.current.practice.attempts).toHaveLength(3)
    expect(
      result.current.practice.attempts.map((a) => a.selfReportedCorrect),
    ).toEqual([true, false, true])
  })

  it('brings the session history back', () => {
    playAndClose([right, wrong])

    const { result } = mount()

    expect(result.current.practice.sessions).toHaveLength(1)
    expect(result.current.practice.sessions[0]).toMatchObject({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
  })

  it('brings back an unfinished session as one in progress, at the question it was on', () => {
    playAndClose([right, wrong])

    const { result } = mount()
    const { practice } = result.current

    expect(practice.isActive).toBe(true)
    expect(practice.session).toMatchObject({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
    expect(practice.currentQuestionIndex).toBe(2)
    expect(practice.currentQuestion).not.toBeNull()
    expect(practice.restoredSessionId).toBe(practice.session?.id)
  })

  it('adds new attempts to the old ones, losing nothing', () => {
    playAndClose([right, wrong])
    const second = mount()
    act(
      () =>
        void second.result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    act(() => second.result.current.practice.recordResult(wrong))

    expect(second.result.current.practice.attempts).toHaveLength(3)
    expect(savedAttempts()).toHaveLength(3)
    expect(savedSessions()).toHaveLength(2)
  })

  it('does not rewrite what it just loaded', () => {
    playAndClose([right])
    const before = window.localStorage.getItem(STORAGE_KEYS.attempts)
    window.localStorage.setItem(STORAGE_KEYS.attempts, before! + ' ')

    mount()

    // Untouched: a rewrite would have removed the trailing space.
    expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBe(
      before + ' ',
    )
  })

  it('brings back finished sessions with their completion details', () => {
    playAndClose([right, right, right], 3)

    const { result } = mount()

    expect(result.current.practice.sessions[0].completedAt).toBeDefined()
  })
})

describe('settings', () => {
  it('start as the defaults, and nothing is saved for that', () => {
    const { result } = mount()

    expect(result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
  })

  it('are saved when changed', () => {
    const { result } = mount()

    act(() =>
      result.current.settings.updateSettings({
        cardAnimationEnabled: false,
        masteryThreshold: 5,
      }),
    )

    expect(result.current.settings.settings).toMatchObject({
      cardAnimationEnabled: false,
      masteryThreshold: 5,
      showExplanations: true,
    })
    expect(stored(STORAGE_KEYS.settings)).toMatchObject({
      cardAnimationEnabled: false,
      masteryThreshold: 5,
    })
  })

  it('are loaded when the app starts', () => {
    const first = mount()
    act(() =>
      first.result.current.settings.updateSettings({
        defaultDifficulty: 3,
        soundEffectsEnabled: true,
      }),
    )
    first.unmount()

    const { result } = mount()

    expect(result.current.settings.settings).toMatchObject({
      defaultDifficulty: 3,
      soundEffectsEnabled: true,
    })
  })

  it('replace an invalid change with the default, keeping the other fields', () => {
    const { result } = mount()

    act(() =>
      result.current.settings.updateSettings({
        masteryThreshold: 99,
        showExplanations: false,
      }),
    )

    expect(result.current.settings.settings.masteryThreshold).toBe(
      DEFAULT_SETTINGS.masteryThreshold,
    )
    expect(result.current.settings.settings.showExplanations).toBe(false)
  })

  it('recover from damaged saved settings, using the defaults', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{{{')

    const { result } = mount()

    expect(result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
    expect(result.current.status.problem).toBeNull()
  })

  it('recover field by field from partly wrong saved settings', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        showExplanations: false,
        defaultDifficulty: 'hard',
      }),
    )

    const { result } = mount()

    expect(result.current.settings.settings.showExplanations).toBe(false)
    expect(result.current.settings.settings.defaultDifficulty).toBe(
      DEFAULT_SETTINGS.defaultDifficulty,
    )
  })
})

describe('when saving does not work', () => {
  it('shows no problem when everything works', () => {
    const { result } = mount()

    expect(result.current.status.problem).toBeNull()
  })

  describe('because storage is unavailable', () => {
    it('reports it from the start', () => {
      restore = blockStorage()

      const { result } = mount()

      expect(result.current.status).toMatchObject({
        problem: 'unavailable',
        dismissed: false,
      })
    })

    it('lets practice carry on, in memory', () => {
      restore = blockStorage()
      const { result } = mount()

      act(() => void result.current.practice.startSession(config))
      act(() => result.current.practice.recordResult(right))
      act(() => result.current.practice.recordResult(wrong))

      expect(result.current.practice.session).toMatchObject({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
      expect(result.current.practice.attempts).toHaveLength(2)
      expect(result.current.practice.currentQuestionIndex).toBe(2)
    })

    it('still lets settings be changed, in memory', () => {
      restore = blockStorage()
      const { result } = mount()

      act(() =>
        result.current.settings.updateSettings({ cardAnimationEnabled: false }),
      )

      expect(result.current.settings.settings.cardAnimationEnabled).toBe(false)
    })

    it('does not crash if reading fails partway', () => {
      restore = breakStorageMethod('getItem')

      const { result } = mount()

      expect(result.current.status.problem).toBe('unavailable')
      expect(result.current.practice.attempts).toEqual([])
    })
  })

  describe('because storage is full', () => {
    it('warns, and keeps practicing, when an answer cannot be saved', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = fillStorage()

      act(() => result.current.practice.recordResult(right))

      expect(result.current.status.problem).toBe('full')
      expect(result.current.practice.session?.attempted).toBe(1)
      act(() => result.current.practice.recordResult(wrong))
      expect(result.current.practice.session?.attempted).toBe(2)
      expect(result.current.practice.isActive).toBe(true)
    })

    it('clears the warning by itself once saving works again', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = fillStorage()
      act(() => result.current.practice.recordResult(right))
      expect(result.current.status.problem).toBe('full')

      restore()
      restore = undefined
      act(() => result.current.practice.recordResult(wrong))

      expect(result.current.status.problem).toBeNull()
      expect(savedAttempts()).toHaveLength(2)
    })

    it('keeps the warning when only the big list fails and a small save still works', () => {
      // The attempts list is the big one: it can stop fitting while the small
      // sessions list is still saved fine, straight after. That later success
      // must not hide the failure.
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = failWritesTo(STORAGE_KEYS.attempts)

      act(() => result.current.practice.recordResult(right))

      expect(savedSessions()).toHaveLength(1)
      expect(result.current.status.problem).toBe('full')
    })

    it('keeps the warning through further answers while the big list still fails', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = failWritesTo(STORAGE_KEYS.attempts)

      act(() => result.current.practice.recordResult(right))
      act(() => result.current.practice.recordResult(wrong))
      act(() => result.current.practice.recordResult(right))

      expect(result.current.status.problem).toBe('full')
    })

    it('clears the warning only once the item that failed is saved again', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = failWritesTo(STORAGE_KEYS.attempts)
      act(() => result.current.practice.recordResult(right))
      expect(result.current.status.problem).toBe('full')

      restore()
      restore = undefined
      act(() => result.current.practice.recordResult(wrong))

      expect(result.current.status.problem).toBeNull()
      expect(savedAttempts()).toHaveLength(2)
    })

    it('keeps the warning when one item recovers but another is still failing', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      // Everything fails, so both the attempts and the sessions are failing.
      restore = fillStorage()
      act(() => result.current.practice.recordResult(right))
      expect(result.current.status.problem).toBe('full')

      // Now only the big attempts list fails: the sessions save again.
      restore()
      restore = failWritesTo(STORAGE_KEYS.attempts)
      act(() => result.current.practice.recordResult(wrong))

      expect(savedSessions()).toHaveLength(1)
      expect(result.current.status.problem).toBe('full')
    })

    it('does not nag again after OK while the same problem continues', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = failWritesTo(STORAGE_KEYS.attempts)
      act(() => result.current.practice.recordResult(right))
      act(() => result.current.status.dismiss())

      act(() => result.current.practice.recordResult(wrong))

      expect(result.current.status).toMatchObject({
        problem: 'full',
        dismissed: true,
      })
    })

    it('shows the warning again if the problem goes away and later comes back', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = failWritesTo(STORAGE_KEYS.attempts)
      act(() => result.current.practice.recordResult(right))
      act(() => result.current.status.dismiss())
      restore()
      act(() => result.current.practice.recordResult(wrong))
      expect(result.current.status.problem).toBeNull()

      restore = failWritesTo(STORAGE_KEYS.attempts)
      act(() => result.current.practice.recordResult(right))

      expect(result.current.status).toMatchObject({
        problem: 'full',
        dismissed: false,
      })
    })

    it('warns when a setting cannot be saved', () => {
      const { result } = mount()
      restore = fillStorage()

      act(() =>
        result.current.settings.updateSettings({ showExplanations: false }),
      )

      expect(result.current.status.problem).toBe('full')
      expect(result.current.settings.settings.showExplanations).toBe(false)
    })
  })

  describe('because the saved data is from a newer version', () => {
    function seedNewerData() {
      window.localStorage.setItem(STORAGE_KEYS.version, '{"version":9}')
      window.localStorage.setItem(
        STORAGE_KEYS.attempts,
        '[{"from":"the future"}]',
      )
    }

    it('reports it', () => {
      seedNewerData()

      const { result } = mount()

      expect(result.current.status.problem).toBe('newer-version')
    })

    it('lets practice carry on without touching the newer data', () => {
      seedNewerData()
      const { result } = mount()

      act(() => void result.current.practice.startSession(config))
      act(() => result.current.practice.recordResult(right))
      act(() =>
        result.current.settings.updateSettings({ showExplanations: false }),
      )

      expect(result.current.practice.session?.attempted).toBe(1)
      expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBe(
        '[{"from":"the future"}]',
      )
      expect(window.localStorage.getItem(STORAGE_KEYS.version)).toBe(
        '{"version":9}',
      )
      expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
    })
  })

  describe('dismissing the warning', () => {
    it('hides it', () => {
      restore = blockStorage()
      const { result } = mount()

      act(() => result.current.status.dismiss())

      expect(result.current.status).toMatchObject({
        problem: 'unavailable',
        dismissed: true,
      })
    })

    it('shows it again if a different problem comes up', () => {
      const { result } = mount()
      act(
        () =>
          void result.current.practice.startSession({
            ...config,
            sessionLength: 'continuous',
          }),
      )
      restore = fillStorage()
      act(() => result.current.practice.recordResult(right))
      act(() => result.current.status.dismiss())
      expect(result.current.status.dismissed).toBe(true)

      restore()
      restore = blockStorage()
      act(() => result.current.practice.recordResult(wrong))

      expect(result.current.status).toMatchObject({
        problem: 'unavailable',
        dismissed: false,
      })
    })
  })
})

describe('loading damaged saved data', () => {
  it('keeps the good attempts and drops the damaged ones', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.attempts,
      JSON.stringify([
        makeAttempt({ id: 'a1' }),
        { broken: true },
        makeAttempt({ id: 'a2' }),
      ]),
    )

    const { result } = mount()

    expect(result.current.practice.attempts.map((a) => a.id)).toEqual([
      'a1',
      'a2',
    ])
    expect(result.current.status.problem).toBeNull()
  })

  it('starts the app normally when everything saved is rubbish', () => {
    for (const key of [
      STORAGE_KEYS.attempts,
      STORAGE_KEYS.sessions,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.version,
    ]) {
      window.localStorage.setItem(key, '\u0000not json{')
    }

    const { result } = mount()

    expect(result.current.practice.attempts).toEqual([])
    expect(result.current.practice.sessions).toEqual([])
    expect(result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
    act(() => void result.current.practice.startSession(config))
    expect(result.current.practice.isActive).toBe(true)
  })
})

describe('statistics', () => {
  const savedStatistics = () =>
    stored(STORAGE_KEYS.statistics) as {
      attempted: number
      correct: number
      incorrect: number
      byOperation: Record<string, { attempted: number }>
      byDifficulty: Record<string, { attempted: number }>
    }

  function playSome() {
    const hook = mount()
    act(
      () =>
        void hook.result.current.practice.startSession({
          ...config,
          operations: ['addition', 'subtraction'],
          sessionLength: 'continuous',
        }),
    )
    for (const answer of [right, wrong, right, right]) {
      act(() => hook.result.current.practice.recordResult(answer))
    }
    return hook
  }

  it('save nothing just for opening the app or starting a session', () => {
    const { result } = mount()
    act(() => void result.current.practice.startSession(config))

    expect(window.localStorage.getItem(STORAGE_KEYS.statistics)).toBeNull()
  })

  it('are saved with every answer', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    act(() => result.current.practice.recordResult(right))
    expect(savedStatistics()).toMatchObject({
      attempted: 1,
      correct: 1,
      incorrect: 0,
    })

    act(() => result.current.practice.recordResult(wrong))
    expect(savedStatistics()).toMatchObject({
      attempted: 2,
      correct: 1,
      incorrect: 1,
    })
  })

  it('are saved by operation and by level, adding up to the overall total', () => {
    playSome()

    const saved = savedStatistics()
    const byOperation = Object.values(saved.byOperation).reduce(
      (sum, g) => sum + g.attempted,
      0,
    )
    const byLevel = Object.values(saved.byDifficulty).reduce(
      (sum, g) => sum + g.attempted,
      0,
    )
    expect(saved.attempted).toBe(4)
    expect(byOperation).toBe(4)
    expect(byLevel).toBe(4)
    expect(saved.byDifficulty['1'].attempted).toBe(4)
  })

  it('come back after a restart', () => {
    playSome().unmount()

    const { result } = mount()

    expect(result.current.practice.statistics).toMatchObject({
      attempted: 4,
      correct: 3,
      incorrect: 1,
    })
  })

  it('keep growing after a restart instead of starting again', () => {
    playSome().unmount()
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    act(() => result.current.practice.recordResult(wrong))

    expect(result.current.practice.statistics).toMatchObject({
      attempted: 5,
      correct: 3,
      incorrect: 2,
    })
    expect(savedStatistics().attempted).toBe(5)
  })

  it('are counted again from the saved attempts when the saved totals are missing', () => {
    playSome().unmount()
    window.localStorage.removeItem(STORAGE_KEYS.statistics)

    const { result } = mount()

    expect(result.current.practice.statistics).toMatchObject({
      attempted: 4,
      correct: 3,
      incorrect: 1,
    })
  })

  it('are counted again from the saved attempts when the saved totals are damaged', () => {
    playSome().unmount()
    window.localStorage.setItem(
      STORAGE_KEYS.statistics,
      '{"attempted": "lots"}',
    )

    const { result } = mount()

    expect(result.current.practice.statistics).toMatchObject({
      attempted: 4,
      correct: 3,
      incorrect: 1,
    })
    expect(result.current.status.problem).toBeNull()
  })

  it('are repaired when a failed save left them behind the saved attempts', () => {
    const { result, unmount } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    act(() => result.current.practice.recordResult(right))
    // Now only the totals fail to save, so the next answers reach the attempts but not the totals.
    restore = failWritesTo(STORAGE_KEYS.statistics)
    act(() => result.current.practice.recordResult(wrong))
    act(() => result.current.practice.recordResult(right))
    expect(savedAttempts()).toHaveLength(3)
    expect(savedStatistics().attempted).toBe(1)
    unmount()
    restore()
    restore = undefined

    const reopened = mount()

    expect(reopened.result.current.practice.statistics).toMatchObject({
      attempted: 3,
      correct: 2,
      incorrect: 1,
    })
  })

  it('warn when they cannot be saved, and practice goes on', () => {
    const { result } = mount()
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    restore = failWritesTo(STORAGE_KEYS.statistics)

    act(() => result.current.practice.recordResult(right))

    expect(result.current.status.problem).toBe('full')
    expect(result.current.practice.statistics.attempted).toBe(1)
  })
})

describe('resetting statistics', () => {
  function playAndChangeSettings() {
    const hook = mount()
    act(() =>
      hook.result.current.settings.updateSettings({
        cardAnimationEnabled: false,
        masteryThreshold: 6,
      }),
    )
    act(
      () =>
        void hook.result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    for (const answer of [right, wrong, right]) {
      act(() => hook.result.current.practice.recordResult(answer))
    }
    return hook
  }

  it('erases the attempts, sessions and totals in the app', () => {
    const { result } = playAndChangeSettings()

    act(() => result.current.practice.resetStatistics())

    expect(result.current.practice.attempts).toEqual([])
    expect(result.current.practice.sessions).toEqual([])
    expect(result.current.practice.statistics.attempted).toBe(0)
  })

  it('erases what is saved: attempts, sessions and totals', () => {
    const { result } = playAndChangeSettings()
    expect(savedAttempts()).toHaveLength(3)

    act(() => result.current.practice.resetStatistics())

    expect(savedAttempts()).toEqual([])
    expect(savedSessions()).toEqual([])
    expect(stored(STORAGE_KEYS.statistics)).toMatchObject({
      attempted: 0,
      correct: 0,
      incorrect: 0,
    })
  })

  it('leaves the settings exactly as they were, in the app and in storage', () => {
    const { result } = playAndChangeSettings()
    const before = result.current.settings.settings

    act(() => result.current.practice.resetStatistics())

    expect(result.current.settings.settings).toEqual(before)
    expect(stored(STORAGE_KEYS.settings)).toMatchObject({
      cardAnimationEnabled: false,
      masteryThreshold: 6,
    })
  })

  it('also ends the session in progress', () => {
    const { result } = playAndChangeSettings()
    expect(result.current.practice.isActive).toBe(true)

    act(() => result.current.practice.resetStatistics())

    expect(result.current.practice.isActive).toBe(false)
    expect(result.current.practice.session).toBeNull()
  })

  it('stays erased after a restart', () => {
    const first = playAndChangeSettings()
    act(() => first.result.current.practice.resetStatistics())
    first.unmount()

    const { result } = mount()

    expect(result.current.practice.attempts).toEqual([])
    expect(result.current.practice.sessions).toEqual([])
    expect(result.current.practice.statistics.attempted).toBe(0)
    expect(result.current.settings.settings.masteryThreshold).toBe(6)
  })

  it('starts counting from zero again afterwards', () => {
    const { result } = playAndChangeSettings()
    act(() => result.current.practice.resetStatistics())
    act(
      () =>
        void result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )

    act(() => result.current.practice.recordResult(wrong))

    expect(result.current.practice.statistics).toMatchObject({
      attempted: 1,
      correct: 0,
      incorrect: 1,
    })
    expect(savedAttempts()).toHaveLength(1)
  })

  it('leaves data that belongs to other sites alone', () => {
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    const { result } = playAndChangeSettings()

    act(() => result.current.practice.resetStatistics())

    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
  })

  it('still erases in the app, and warns, if the saved copy cannot be updated', () => {
    const { result } = playAndChangeSettings()
    restore = fillStorage()

    act(() => result.current.practice.resetStatistics())

    expect(result.current.practice.statistics.attempted).toBe(0)
    expect(result.current.practice.attempts).toEqual([])
    expect(result.current.status.problem).toBe('full')
  })

  it('does nothing harmful when there is nothing to erase', () => {
    const { result } = mount()

    act(() => result.current.practice.resetStatistics())

    expect(result.current.practice.statistics.attempted).toBe(0)
    expect(result.current.status.problem).toBeNull()
  })
})

describe('clearing all application data', () => {
  const savedSettings = () =>
    stored(STORAGE_KEYS.settings) as Record<string, unknown>

  function playAndChangeSettings() {
    const hook = mount()
    act(() =>
      hook.result.current.settings.updateSettings({
        cardAnimationEnabled: false,
        masteryThreshold: 6,
        defaultOperations: ['division'],
      }),
    )
    act(
      () =>
        void hook.result.current.practice.startSession({
          ...config,
          sessionLength: 'continuous',
        }),
    )
    for (const answer of [right, wrong, right]) {
      act(() => hook.result.current.practice.recordResult(answer))
    }
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    return hook
  }

  const clearAll = (hook: ReturnType<typeof mount>) => {
    let cleared: boolean | undefined
    act(() => {
      cleared = hook.result.current.settings.clearAllData()
    })
    return cleared
  }

  it('reports that it worked', () => {
    const hook = playAndChangeSettings()

    expect(clearAll(hook)).toBe(true)
  })

  it('erases the settings, sessions, attempts, totals and mistake patterns', () => {
    const hook = playAndChangeSettings()
    expect(savedAttempts()).toHaveLength(3)
    expect(stored(STORAGE_KEYS.mistakePatterns)).toHaveLength(1)

    clearAll(hook)

    expect(savedAttempts()).toEqual([])
    expect(savedSessions()).toEqual([])
    expect(stored(STORAGE_KEYS.statistics)).toMatchObject({ attempted: 0 })
    expect(stored(STORAGE_KEYS.mistakePatterns)).toEqual([])
    expect(stored(STORAGE_KEYS.settings)).toEqual(DEFAULT_SETTINGS)
  })

  it('restores the defaults, and empties history and any session in progress', () => {
    const hook = playAndChangeSettings()
    expect(hook.result.current.practice.isActive).toBe(true)

    clearAll(hook)

    expect(hook.result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
    expect(hook.result.current.practice.session).toBeNull()
    expect(hook.result.current.practice.isActive).toBe(false)
    expect(hook.result.current.practice.currentQuestion).toBeNull()
    expect(hook.result.current.practice.attempts).toEqual([])
    expect(hook.result.current.practice.sessions).toEqual([])
    expect(hook.result.current.practice.statistics.attempted).toBe(0)
  })

  it('leaves data that belongs to other sites alone', () => {
    const hook = playAndChangeSettings()

    clearAll(hook)

    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
  })

  it('stays erased after a browser restart', () => {
    const first = playAndChangeSettings()
    clearAll(first)
    first.unmount()

    const { result } = mount()

    expect(result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
    expect(result.current.practice.attempts).toEqual([])
    expect(result.current.practice.sessions).toEqual([])
    expect(result.current.status.problem).toBeNull()
  })

  it('does not leave settings changes made before the erase to be saved again', () => {
    const hook = playAndChangeSettings()

    clearAll(hook)

    expect(savedSettings().defaultOperations).toEqual([])
    expect(savedSettings().cardAnimationEnabled).toBe(true)
    expect(savedSettings().masteryThreshold).toBe(3)
  })

  it('stamps the version again', () => {
    const hook = playAndChangeSettings()

    clearAll(hook)

    expect(stored(STORAGE_KEYS.version)).toEqual({ version: 1 })
  })

  it('goes on saving what the student does afterwards', () => {
    const hook = playAndChangeSettings()
    clearAll(hook)

    act(() =>
      hook.result.current.settings.updateSettings({ showExplanations: false }),
    )
    act(() => void hook.result.current.practice.startSession(config))
    act(() => hook.result.current.practice.recordResult(wrong))

    expect(savedSettings().showExplanations).toBe(false)
    expect(savedAttempts()).toHaveLength(1)
  })

  it('clears a saving problem that was being shown', () => {
    const hook = mount()
    restore = fillStorage()
    act(
      () =>
        void hook.result.current.settings.updateSettings({
          showExplanations: false,
        }),
    )
    expect(hook.result.current.status.problem).toBe('full')
    restore()
    restore = undefined

    clearAll(hook)

    expect(hook.result.current.status.problem).toBeNull()
  })

  it('works when there was nothing saved', () => {
    const hook = mount()

    expect(clearAll(hook)).toBe(true)
    expect(hook.result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
  })

  describe('when the saved data cannot be removed', () => {
    it('reports it, and changes nothing', () => {
      const hook = playAndChangeSettings()
      restore = breakStorageMethod('removeItem')

      expect(clearAll(hook)).toBe(false)

      expect(hook.result.current.settings.settings.cardAnimationEnabled).toBe(
        false,
      )
      expect(hook.result.current.practice.isActive).toBe(true)
      expect(hook.result.current.practice.attempts).toHaveLength(3)
      expect(savedAttempts()).toHaveLength(3)
    })
  })

  describe('when storage is switched off', () => {
    it('still resets the app, since nothing could have been saved', () => {
      restore = blockStorage()
      const hook = mount()
      act(() =>
        hook.result.current.settings.updateSettings({
          showExplanations: false,
        }),
      )
      act(() => void hook.result.current.practice.startSession(config))

      expect(clearAll(hook)).toBe(true)

      expect(hook.result.current.settings.settings).toEqual(DEFAULT_SETTINGS)
      expect(hook.result.current.practice.session).toBeNull()
      expect(hook.result.current.status.problem).toBe('unavailable')
    })
  })

  describe('when the saved data came from a newer version', () => {
    it('erases it, and lets the app save again', () => {
      window.localStorage.setItem(STORAGE_KEYS.version, '{"version":9}')
      window.localStorage.setItem(STORAGE_KEYS.attempts, '["from the future"]')
      const hook = mount()
      expect(hook.result.current.status.problem).toBe('newer-version')

      expect(clearAll(hook)).toBe(true)
      expect(hook.result.current.status.problem).toBeNull()
      act(() =>
        hook.result.current.settings.updateSettings({
          showExplanations: false,
        }),
      )

      expect(stored(STORAGE_KEYS.version)).toEqual({ version: 1 })
      expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).not.toContain(
        'from the future',
      )
      expect(savedSettings().showExplanations).toBe(false)
    })
  })
})

describe('mistake patterns', () => {
  const savedPatterns = () =>
    (stored(STORAGE_KEYS.mistakePatterns) ?? []) as {
      id: string
      operation: string
      firstOperand: number
      secondOperand: number
      correctAnswer: number
      difficulty: number
      incorrectCount: number
      similarCorrectCount: number
      lastIncorrectAt: string
      mastered: boolean
    }[]

  function startSession(hook: ReturnType<typeof mount>) {
    act(() => void hook.result.current.practice.startSession(config))
  }

  it('saves nothing for opening the app or starting a session', () => {
    const hook = mount()
    startSession(hook)

    expect(window.localStorage.getItem(STORAGE_KEYS.mistakePatterns)).toBeNull()
  })

  it('saves a pattern as soon as an incorrect answer is reported', () => {
    const hook = mount()
    startSession(hook)
    const question = hook.result.current.practice.currentQuestion!

    act(() => hook.result.current.practice.recordResult(wrong))

    expect(savedPatterns()).toEqual([
      {
        id: mistakePatternId(question),
        operation: 'addition',
        firstOperand: question.firstOperand,
        secondOperand: question.secondOperand,
        correctAnswer: question.correctAnswer,
        difficulty: 1,
        incorrectCount: 1,
        similarCorrectCount: 0,
        lastIncorrectAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        mastered: false,
      },
    ])
    expect(hook.result.current.practice.mistakePatterns).toEqual(
      savedPatterns(),
    )
  })

  it('saves nothing for a correct answer', () => {
    const hook = mount()
    startSession(hook)

    act(() => hook.result.current.practice.recordResult(right))

    expect(window.localStorage.getItem(STORAGE_KEYS.mistakePatterns)).toBeNull()
    expect(hook.result.current.practice.mistakePatterns).toEqual([])
  })

  it('has one pattern for each different question missed, and counts each', () => {
    const hook = mount()
    startSession(hook)
    const missed: string[] = []
    for (let i = 0; i < 3; i++) {
      missed.push(
        mistakePatternId(hook.result.current.practice.currentQuestion!),
      )
      act(() => hook.result.current.practice.recordResult(wrong))
    }

    const unique = new Set(missed)
    expect(savedPatterns()).toHaveLength(unique.size)
    expect(
      savedPatterns().reduce((sum, pattern) => sum + pattern.incorrectCount, 0),
    ).toBe(3)
    expect(
      savedPatterns()
        .map((pattern) => pattern.id)
        .sort(),
    ).toEqual([...unique].sort())
  })

  it('does not add one for a correct answer that follows an incorrect one', () => {
    const hook = mount()
    startSession(hook)
    act(() => hook.result.current.practice.recordResult(wrong))
    act(() => hook.result.current.practice.recordResult(right))

    expect(savedPatterns()).toHaveLength(1)
  })

  it('are still there after a browser restart', () => {
    const first = mount()
    startSession(first)
    act(() => first.result.current.practice.recordResult(wrong))
    const before = savedPatterns()
    first.unmount()

    const second = mount()

    expect(second.result.current.practice.mistakePatterns).toEqual(before)
    expect(second.result.current.status.problem).toBeNull()
  })

  it('are worked out from earlier attempts when none were ever saved', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.attempts,
      JSON.stringify([
        makeAttempt({ id: 'a1', selfReportedCorrect: false }),
        makeAttempt({ id: 'a2', selfReportedCorrect: true, firstOperand: 2 }),
        makeAttempt({ id: 'a3', selfReportedCorrect: false }),
      ]),
    )

    const { result } = mount()

    expect(result.current.practice.mistakePatterns).toEqual([
      expect.objectContaining({ firstOperand: 7, incorrectCount: 2 }),
    ])
  })

  it('are worked out again when the saved patterns are damaged', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.attempts,
      JSON.stringify([makeAttempt({ id: 'a1', selfReportedCorrect: false })]),
    )
    window.localStorage.setItem(STORAGE_KEYS.mistakePatterns, '{{{')

    const { result } = mount()

    expect(result.current.practice.mistakePatterns).toHaveLength(1)
  })

  it('keep the mistakes worked out from earlier attempts once the student makes another', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.attempts,
      JSON.stringify([
        makeAttempt({
          id: 'a1',
          selfReportedCorrect: false,
          operation: 'multiplication',
          firstOperand: 7,
          secondOperand: 8,
          correctAnswer: 56,
        }),
      ]),
    )
    const hook = mount()
    startSession(hook)

    act(() => hook.result.current.practice.recordResult(wrong))

    expect(savedPatterns().map((pattern) => pattern.operation)).toEqual([
      'multiplication',
      'addition',
    ])
  })

  describe('when the student resets their statistics', () => {
    it('are erased, in the app and in what is saved', () => {
      const hook = mount()
      startSession(hook)
      act(() => hook.result.current.practice.recordResult(wrong))
      expect(savedPatterns()).toHaveLength(1)

      act(() => hook.result.current.practice.resetStatistics())

      expect(hook.result.current.practice.mistakePatterns).toEqual([])
      expect(savedPatterns()).toEqual([])
    })

    it('stay erased after a restart, and are not worked out again from old attempts', () => {
      const first = mount()
      startSession(first)
      act(() => first.result.current.practice.recordResult(wrong))
      act(() => first.result.current.practice.resetStatistics())
      first.unmount()

      const second = mount()

      expect(second.result.current.practice.mistakePatterns).toEqual([])
      expect(second.result.current.practice.attempts).toEqual([])
    })
  })

  describe('when a session is discarded', () => {
    it('takes back its mistakes from what is saved', () => {
      const hook = mount()
      startSession(hook)
      act(() => hook.result.current.practice.recordResult(wrong))
      expect(savedPatterns()).toHaveLength(1)

      act(() => hook.result.current.practice.discardSession())

      expect(hook.result.current.practice.mistakePatterns).toEqual([])
      expect(savedPatterns()).toEqual([])
    })
  })

  describe('when they cannot be saved', () => {
    it('warns, and practice carries on with them in memory', () => {
      restore = failWritesTo(STORAGE_KEYS.mistakePatterns)
      const hook = mount()
      startSession(hook)

      act(() => hook.result.current.practice.recordResult(wrong))

      expect(hook.result.current.status.problem).toBe('full')
      expect(hook.result.current.practice.mistakePatterns).toHaveLength(1)
      expect(hook.result.current.practice.attempts).toHaveLength(1)
      expect(savedAttempts()).toHaveLength(1)
    })

    it('stop warning once they save again', () => {
      restore = failWritesTo(STORAGE_KEYS.mistakePatterns)
      const hook = mount()
      startSession(hook)
      act(() => hook.result.current.practice.recordResult(wrong))
      expect(hook.result.current.status.problem).toBe('full')
      restore()
      restore = undefined

      act(() => hook.result.current.practice.recordResult(wrong))

      expect(hook.result.current.status.problem).toBeNull()
      expect(savedPatterns().length).toBeGreaterThan(0)
    })

    it('do not stop the attempts from being saved when only they fail', () => {
      restore = failWritesTo(STORAGE_KEYS.mistakePatterns)
      const hook = mount()
      startSession(hook)

      act(() => hook.result.current.practice.recordResult(wrong))
      act(() => hook.result.current.practice.recordResult(right))

      expect(savedAttempts()).toHaveLength(2)
    })
  })

  it('are not saved when storage is switched off, and practice still works', () => {
    restore = blockStorage()
    const hook = mount()
    startSession(hook)

    act(() => hook.result.current.practice.recordResult(wrong))

    expect(hook.result.current.practice.mistakePatterns).toHaveLength(1)
    expect(hook.result.current.status.problem).toBe('unavailable')
  })
})

describe('the session in progress', () => {
  const savedActive = () =>
    stored(STORAGE_KEYS.activeSession) as
      | {
          session: ReturnType<typeof makeSession>
          currentQuestion: { id: string; choices: number[] }
          card: { selectedAnswer: number | null; flipped: boolean }
        }
      | undefined
  const fresh = { selectedAnswer: null, flipped: false }

  function startedApp(length: PracticeConfig['sessionLength'] = 3) {
    const app = mount()
    act(
      () =>
        void app.result.current.practice.startSession({
          ...config,
          sessionLength: length,
        }),
    )
    return app
  }

  describe('is saved', () => {
    it('as soon as it starts, with its question and a card nothing has been done to', () => {
      const { result } = startedApp()
      const { session, currentQuestion } = result.current.practice

      expect(savedActive()).toEqual({
        session,
        currentQuestion,
        card: fresh,
      })
    })

    it('with each pick and each turn of the card', () => {
      const { result } = startedApp()
      const question = result.current.practice.currentQuestion!
      const answer = question.choices[2]

      act(() =>
        result.current.practice.rememberCard(question.id, {
          selectedAnswer: answer,
          flipped: false,
        }),
      )
      expect(savedActive()?.card).toEqual({
        selectedAnswer: answer,
        flipped: false,
      })

      act(() =>
        result.current.practice.rememberCard(question.id, {
          selectedAnswer: answer,
          flipped: true,
        }),
      )
      expect(savedActive()?.card).toEqual({
        selectedAnswer: answer,
        flipped: true,
      })
    })

    it('with the next question, and a fresh card, after an answer', () => {
      const { result } = startedApp()
      const first = result.current.practice.currentQuestion!
      act(() =>
        result.current.practice.rememberCard(first.id, {
          selectedAnswer: first.choices[0],
          flipped: true,
        }),
      )

      act(() => result.current.practice.recordResult(wrong))

      const saved = savedActive()!
      expect(saved.currentQuestion.id).not.toBe(first.id)
      expect(saved.currentQuestion.id).toBe(
        result.current.practice.currentQuestion!.id,
      )
      expect(saved.session).toMatchObject({
        attempted: 1,
        incorrect: 1,
        correct: 0,
      })
      expect(saved.card).toEqual(fresh)
    })

    it('in place of an earlier session when another is started', () => {
      const { result } = startedApp()
      const earlier = result.current.practice.session!.id

      act(() => void result.current.practice.startSession(config))

      expect(savedActive()?.session.id).toBe(
        result.current.practice.session!.id,
      )
      expect(savedActive()?.session.id).not.toBe(earlier)
    })

    it('not for a pick that belongs to some other question', () => {
      const { result } = startedApp()

      act(() =>
        result.current.practice.rememberCard('another-question', {
          selectedAnswer: 1,
          flipped: false,
        }),
      )

      expect(savedActive()?.card).toEqual(fresh)
    })
  })

  describe('is cleared', () => {
    it('when it is ended', () => {
      const { result } = startedApp()
      act(() => result.current.practice.recordResult(right))

      act(() => result.current.practice.endSession())

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
      // What was answered is kept, as before.
      expect(savedAttempts()).toHaveLength(1)
      expect(savedSessions()[0]).toMatchObject({ attempted: 1 })
    })

    it('when it is thrown away', () => {
      const { result } = startedApp()
      expect(savedActive()).toBeDefined()

      act(() => result.current.practice.discardSession())

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
    })

    it('when its last question is answered', () => {
      const { result } = startedApp(2)
      act(() => result.current.practice.recordResult(right))
      expect(savedActive()).toBeDefined()

      act(() => result.current.practice.recordResult(right))

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
      expect(result.current.practice.isActive).toBe(false)
    })

    it('when the statistics are reset', () => {
      const { result } = startedApp()

      act(() => result.current.practice.resetStatistics())

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
    })

    it('when all data is cleared', () => {
      const { result } = startedApp()

      act(() => void result.current.settings.clearAllData())

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
      expect(result.current.practice.session).toBeNull()
    })

    it('and does not come back after the app is opened again', () => {
      const first = startedApp(1)
      act(() => first.result.current.practice.recordResult(right))
      first.unmount()

      const { result } = mount()

      expect(result.current.practice.isActive).toBe(false)
      expect(result.current.practice.session).toBeNull()
    })
  })

  describe('is brought back after a refresh', () => {
    it('exactly as it was: the session, the question and the card', () => {
      const first = startedApp(5)
      act(() => first.result.current.practice.recordResult(right))
      const question = first.result.current.practice.currentQuestion!
      act(() =>
        first.result.current.practice.rememberCard(question.id, {
          selectedAnswer: question.choices[1],
          flipped: true,
        }),
      )
      const before = first.result.current.practice
      first.unmount()

      const { result } = mount()
      const { practice } = result.current

      expect(practice.isActive).toBe(true)
      expect(practice.session).toEqual(before.session)
      expect(practice.currentQuestion).toEqual(before.currentQuestion)
      expect(practice.currentQuestionIndex).toBe(1)
      expect(practice.card).toEqual({
        selectedAnswer: question.choices[1],
        flipped: true,
      })
      expect(practice.restoredSessionId).toBe(before.session!.id)
    })

    it('and carries on: the next answer adds to what was there, and the end clears it', () => {
      const first = startedApp(3)
      act(() => first.result.current.practice.recordResult(right))
      first.unmount()

      const { result } = mount()
      act(() => result.current.practice.recordResult(wrong))
      act(() => result.current.practice.recordResult(right))

      expect(result.current.practice.session).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
      expect(result.current.practice.isActive).toBe(false)
      expect(savedAttempts()).toHaveLength(3)
      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
    })

    it('counts as one of the saved sessions once it has an answer', () => {
      const first = startedApp(3)
      act(() => first.result.current.practice.recordResult(right))
      first.unmount()

      const { result } = mount()

      expect(
        result.current.practice.sessions.map((session) => session.id),
      ).toEqual([result.current.practice.session!.id])
    })

    it('with its saved copy in the history brought up to date from the attempts', () => {
      const first = startedApp(5)
      act(() => first.result.current.practice.recordResult(right))
      act(() => first.result.current.practice.recordResult(wrong))
      first.unmount()
      // The history was saved before the last answer, as after a failed save.
      const stale = savedSessions().map((session) => ({
        ...session,
        attempted: 1,
        correct: 1,
        incorrect: 0,
      }))
      window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(stale))

      const { result } = mount()

      expect(result.current.practice.sessions[0]).toMatchObject({
        attempted: 2,
        correct: 1,
        incorrect: 1,
      })
    })

    it('but not as a saved session while nothing has been answered', () => {
      const first = startedApp(3)
      first.unmount()

      const { result } = mount()

      expect(result.current.practice.isActive).toBe(true)
      expect(result.current.practice.sessions).toEqual([])
    })

    it('without rewriting what it just loaded', () => {
      const first = startedApp(3)
      first.unmount()
      const before = window.localStorage.getItem(STORAGE_KEYS.activeSession)
      window.localStorage.setItem(STORAGE_KEYS.activeSession, before! + ' ')

      mount()

      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBe(
        before + ' ',
      )
    })

    it('with no saved session, says there was none to bring back', () => {
      const { result } = mount()

      expect(result.current.practice.restoredSessionId).toBeNull()
    })

    it('and says so only for that session, not for the next one started', () => {
      const first = startedApp(3)
      first.unmount()
      const { result } = mount()
      const restored = result.current.practice.session!.id

      act(() => void result.current.practice.startSession(config))

      expect(result.current.practice.session!.id).not.toBe(restored)
      expect(result.current.practice.restoredSessionId).toBe(restored)
    })

    it('not when what was saved cannot be used: the app starts as if there was none', () => {
      window.localStorage.setItem(STORAGE_KEYS.activeSession, '{"session": 1}')

      const { result } = mount()

      expect(result.current.practice.isActive).toBe(false)
      expect(result.current.practice.session).toBeNull()
      expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
    })
  })

  describe('when saving does not work', () => {
    it('keeps going in memory and says so, as for everything else', () => {
      restore = failWritesTo(STORAGE_KEYS.activeSession)

      const { result } = startedApp()

      expect(result.current.practice.isActive).toBe(true)
      expect(result.current.status.problem).toBe('full')
    })

    it('says so too when storage is switched off, and the session still works', () => {
      restore = blockStorage()

      const { result } = startedApp()
      act(() => result.current.practice.recordResult(right))

      expect(result.current.status.problem).toBe('unavailable')
      expect(result.current.practice.session?.attempted).toBe(1)
    })
  })
})
