import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSettings } from '../hooks/useSettings'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { STORAGE_KEYS } from '../services/storageService'
import { makeMistakePattern } from '../test/fixtures'
import { stored } from '../test/storage'
import type { MistakePattern } from '../types/mistake'
import type { PracticeConfig, QuestionResult } from '../types/session'
import { AppProvider } from './AppProvider'

const right: QuestionResult = { selectedAnswer: 1, selfReportedCorrect: true }
const wrong: QuestionResult = { selectedAnswer: 2, selfReportedCorrect: false }

const review: PracticeConfig = {
  operations: ['addition', 'subtraction'],
  difficulty: 2,
  sessionLength: 5,
  mode: 'mistake-review',
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
    ...overrides,
  })

/** Saved before the app opens, as it is after an earlier visit. */
function save(patterns: MistakePattern[], threshold?: number) {
  window.localStorage.setItem(
    STORAGE_KEYS.mistakePatterns,
    JSON.stringify(patterns),
  )
  if (threshold !== undefined) {
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ masteryThreshold: threshold }),
    )
  }
}

function mount() {
  return renderHook(
    () => ({ practice: usePracticeSession(), settings: useSettings() }),
    { wrapper: AppProvider },
  )
}

type Hook = ReturnType<typeof mount>
const start = (hook: Hook, config: PracticeConfig = review) => {
  let started: boolean | undefined
  act(() => {
    started = hook.result.current.practice.startSession(config)
  })
  return started
}
const answer = (hook: Hook, result: QuestionResult) =>
  act(() => hook.result.current.practice.recordResult(result))
const saved = () => stored(STORAGE_KEYS.mistakePatterns) as MistakePattern[]
const progress = (hook: Hook, id: string) =>
  hook.result.current.practice.mistakePatterns.find((p) => p.id === id)

describe('starting a mistake-review session', () => {
  it('starts when mistakes of the choices need practice, and asks about one of them', () => {
    const patterns = [addition(12, 15), addition(21, 9)]
    save(patterns)
    const hook = mount()

    expect(start(hook)).toBe(true)

    const { session, currentQuestion, isActive } = hook.result.current.practice
    expect(isActive).toBe(true)
    expect(session).toMatchObject({
      mode: 'mistake-review',
      operations: ['addition', 'subtraction'],
      difficulty: 2,
      sessionLength: 5,
      attempted: 0,
    })
    expect(currentQuestion?.source).toBe('mistake-review')
    expect(patterns.map((p) => p.id)).toContain(
      currentQuestion?.mistakePatternId,
    )
    expect(currentQuestion?.difficulty).toBe(2)
  })

  it.each([
    ['no mistakes at all', []],
    [
      'only mastered mistakes',
      [addition(12, 15, { mastered: true, similarCorrectCount: 3 })],
    ],
    ['only mistakes at another level', [addition(12, 15, { difficulty: 3 })]],
    [
      'only mistakes of other operations',
      [makeMistakePattern()], // multiplication
    ],
  ])('does not start with %s', (_, patterns) => {
    save(patterns)
    const hook = mount()

    expect(start(hook)).toBe(false)

    expect(hook.result.current.practice.session).toBeNull()
    expect(hook.result.current.practice.isActive).toBe(false)
  })

  it('leaves a session already going alone when it cannot start', () => {
    save([addition(12, 15)])
    const hook = mount()
    start(hook, { ...review, mode: undefined })
    const before = hook.result.current.practice.session

    expect(start(hook, { ...review, operations: ['division'] })).toBe(false)

    expect(hook.result.current.practice.session).toBe(before)
  })

  it('still starts regular practice whatever the mistakes are', () => {
    save([])
    const hook = mount()

    expect(start(hook, { ...review, mode: undefined })).toBe(true)

    expect(hook.result.current.practice.session?.mode).toBeUndefined()
    expect(hook.result.current.practice.currentQuestion?.source).toBe('regular')
  })

  it('treats mode "regular" as regular practice', () => {
    save([addition(12, 15)])
    const hook = mount()

    expect(start(hook, { ...review, mode: 'regular' })).toBe(true)

    expect(hook.result.current.practice.currentQuestion?.source).toBe('regular')
  })
})

describe('answering in a mistake-review session', () => {
  it('moves the mistake it came from forward after a correct answer, and saves that', () => {
    const only = addition(12, 15)
    save([only])
    const hook = mount()
    start(hook)

    answer(hook, right)

    expect(progress(hook, only.id)?.similarCorrectCount).toBe(1)
    expect(saved().find((p) => p.id === only.id)?.similarCorrectCount).toBe(1)
  })

  it('moves it back after an incorrect answer, makes a mistake of the missed question, and saves both', () => {
    const only = addition(12, 15, { similarCorrectCount: 2 })
    save([only])
    const hook = mount()
    start(hook)
    const asked = hook.result.current.practice.currentQuestion!

    answer(hook, wrong)

    expect(progress(hook, only.id)?.similarCorrectCount).toBe(1)
    expect(saved()).toHaveLength(2)
    expect(
      saved().some(
        (p) =>
          p.firstOperand === asked.firstOperand &&
          p.secondOperand === asked.secondOperand &&
          p.operation === asked.operation,
      ),
    ).toBe(true)
  })

  it('goes on to another question that is also from the mistakes', () => {
    const patterns = [addition(12, 15), addition(21, 9)]
    save(patterns)
    const hook = mount()
    start(hook)

    answer(hook, right)

    const next = hook.result.current.practice.currentQuestion
    expect(next?.source).toBe('mistake-review')
    expect(patterns.map((p) => p.id)).toContain(next?.mistakePatternId)
    expect(hook.result.current.practice.isActive).toBe(true)
  })

  it('does not ask about the same mistake twice running, while there are others', () => {
    save([addition(12, 15), addition(21, 9), addition(30, 25)], 10)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })
    const asked: (string | undefined)[] = [
      hook.result.current.practice.currentQuestion?.mistakePatternId,
    ]

    for (let i = 0; i < 25; i++) {
      answer(hook, right)
      asked.push(hook.result.current.practice.currentQuestion?.mistakePatternId)
    }

    for (let i = 1; i < asked.length; i++) {
      expect(asked[i], `question ${i + 1}`).not.toBe(asked[i - 1])
    }
    expect(new Set(asked).size).toBe(3)
  })

  it('does not repeat the question it has just asked, or its recent ones', () => {
    save([addition(12, 15), addition(21, 9)], 10)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })
    const asked: string[] = [
      hook.result.current.practice.currentQuestion!.displayText,
    ]

    for (let i = 0; i < 12; i++) {
      answer(hook, right)
      asked.push(hook.result.current.practice.currentQuestion!.displayText)
    }

    for (let i = 1; i < asked.length; i++) {
      expect(asked[i]).not.toBe(asked[i - 1])
    }
  })

  it('ends a fixed-length review after the last question, like any session', () => {
    save([addition(12, 15), addition(21, 9)], 10)
    const hook = mount()
    start(hook, { ...review, sessionLength: 3 })

    answer(hook, right)
    answer(hook, right)
    answer(hook, right)

    const { session, currentQuestion, isActive } = hook.result.current.practice
    expect(session?.completedAt).toBeDefined()
    expect(session?.attempted).toBe(3)
    expect(currentQuestion).toBeNull()
    expect(isActive).toBe(false)
  })

  it('records, on each attempt, the mistake its question was made from', () => {
    const patterns = [addition(12, 15), addition(21, 9)]
    save(patterns, 10)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })
    const askedFrom: (string | undefined)[] = []

    for (let i = 0; i < 6; i++) {
      askedFrom.push(
        hook.result.current.practice.currentQuestion?.mistakePatternId,
      )
      answer(hook, right)
    }

    const attempts = stored(STORAGE_KEYS.attempts) as {
      mistakePatternId?: string
      source: string
    }[]
    expect(attempts.map((a) => a.mistakePatternId)).toEqual(askedFrom)
    expect(attempts.every((a) => a.source === 'mistake-review')).toBe(true)
    expect(
      attempts.every((a) =>
        patterns.map((p) => p.id).includes(a.mistakePatternId!),
      ),
    ).toBe(true)
  })

  it('records no mistake on the attempts of a regular session', () => {
    save([addition(12, 15)])
    const hook = mount()
    start(hook, { ...review, mode: undefined })

    answer(hook, right)

    const [attempt] = stored(STORAGE_KEYS.attempts) as object[]
    expect('mistakePatternId' in attempt).toBe(false)
  })

  it('saves the session with its way of practicing', () => {
    save([addition(12, 15), addition(21, 9)], 10)
    const hook = mount()
    start(hook)

    answer(hook, right)

    const sessions = stored(STORAGE_KEYS.sessions) as { mode?: string }[]
    expect(sessions).toHaveLength(1)
    expect(sessions[0].mode).toBe('mistake-review')
  })

  it('counts the answers as mistake-review questions in the history', () => {
    save([addition(12, 15), addition(21, 9)], 10)
    const hook = mount()
    start(hook)

    answer(hook, right)
    answer(hook, wrong)

    expect(hook.result.current.practice.attempts.map((a) => a.source)).toEqual([
      'mistake-review',
      'mistake-review',
    ])
  })
})

describe('mastering mistakes', () => {
  it('masters a mistake after the settings’ number of correct answers', () => {
    const only = addition(12, 15)
    save([only], 2)
    const hook = mount()
    start(hook)

    answer(hook, right)
    expect(progress(hook, only.id)?.mastered).toBe(false)
    answer(hook, right)

    expect(progress(hook, only.id)).toMatchObject({
      similarCorrectCount: 2,
      mastered: true,
    })
    expect(saved().find((p) => p.id === only.id)?.mastered).toBe(true)
  })

  it('uses 3 by default', () => {
    const only = addition(12, 15)
    save([only, addition(21, 9)])
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })
    // Answer only about the first mistake's questions by counting its progress.
    let guard = 0
    while (!progress(hook, only.id)?.mastered && guard++ < 40) {
      answer(hook, right)
    }

    expect(progress(hook, only.id)?.similarCorrectCount).toBe(3)
  })

  it('goes by a threshold changed in the settings, from then on', () => {
    const only = addition(12, 15)
    save([only], 5)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })
    answer(hook, right)
    expect(progress(hook, only.id)?.mastered).toBe(false)

    act(() =>
      hook.result.current.settings.updateSettings({ masteryThreshold: 2 }),
    )
    answer(hook, right)

    expect(progress(hook, only.id)?.mastered).toBe(true)
  })

  it('does not take a mastery back when the threshold is raised later', () => {
    const only = addition(12, 15, { similarCorrectCount: 3, mastered: true })
    save([only, addition(21, 9)], 3)
    const hook = mount()

    act(() =>
      hook.result.current.settings.updateSettings({ masteryThreshold: 9 }),
    )

    expect(progress(hook, only.id)?.mastered).toBe(true)
  })

  it('leaves a mastered mistake out of later review', () => {
    const mastered = addition(12, 15, {
      similarCorrectCount: 3,
      mastered: true,
    })
    const active = addition(21, 9)
    save([mastered, active], 10)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })

    // Fewer answers than the threshold, so the one active mistake is never mastered.
    for (let i = 0; i < 8; i++) {
      expect(
        hook.result.current.practice.currentQuestion?.mistakePatternId,
      ).toBe(active.id)
      answer(hook, right)
    }
  })

  it('ends the session when the last mistake is mastered, with no further question', () => {
    const only = addition(12, 15)
    save([only], 2)
    const hook = mount()
    start(hook, { ...review, sessionLength: 10 })

    answer(hook, right)
    answer(hook, right)

    const { session, currentQuestion, isActive } = hook.result.current.practice
    expect(progress(hook, only.id)?.mastered).toBe(true)
    expect(session?.completedAt).toBeDefined()
    expect(session?.attempted).toBe(2)
    expect(session?.attempted).toBeLessThan(10)
    expect(currentQuestion).toBeNull()
    expect(isActive).toBe(false)
  })

  it('goes on while other mistakes still need practice', () => {
    const first = addition(12, 15)
    const second = addition(21, 9)
    save([first, second], 1)
    const hook = mount()
    start(hook, { ...review, sessionLength: 20 })

    answer(hook, right) // masters whichever was asked

    expect(hook.result.current.practice.isActive).toBe(true)
    answer(hook, right) // masters the other

    expect(hook.result.current.practice.isActive).toBe(false)
    expect(hook.result.current.practice.session?.attempted).toBe(2)
    expect(
      hook.result.current.practice.mistakePatterns.every((p) => p.mastered),
    ).toBe(true)
  })

  it('ends a continuous review when nothing is left, instead of going on for ever', () => {
    save([addition(12, 15)], 1)
    const hook = mount()
    start(hook, { ...review, sessionLength: 'continuous' })

    answer(hook, right)

    expect(hook.result.current.practice.session?.completedAt).toBeDefined()
    expect(hook.result.current.practice.isActive).toBe(false)
  })
})
