import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/settings'
import { useSettings } from '../hooks/useSettings'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useStorageStatus } from '../hooks/useStorageStatus'
import { STORAGE_KEYS } from '../services/storageService'
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

  it('does not bring back an unfinished session as one in progress', () => {
    playAndClose([right])

    const { result } = mount()

    expect(result.current.practice.isActive).toBe(false)
    expect(result.current.practice.session).toBeNull()
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
