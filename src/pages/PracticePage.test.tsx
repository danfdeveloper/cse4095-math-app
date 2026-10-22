import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PRAISE_MESSAGES,
  SUPPORT_MESSAGES,
} from '../constants/feedbackMessages'
import { STORAGE_KEYS } from '../services/storageService'
import {
  activeSessionState,
  endedSessionState,
  inProgressSessionState,
  makeMistakePattern,
  reviewSessionState,
} from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { saveSessionInProgress } from '../test/savedSession'
import { blockStorage, fillStorage } from '../test/storage'
import type { PracticeConfig } from '../types/session'

type User = ReturnType<typeof userEvent.setup>

function renderSession(overrides: Partial<PracticeConfig> = {}) {
  return renderApp('/practice/session', {
    initialState: activeSessionState(overrides),
  })
}

const questionHeading = () => screen.getByRole('heading', { level: 2 })
const progressBar = () => screen.queryByRole('progressbar')

/** Answers the question on screen: pick the first choice, flip, report. */
async function answer(user: User, report: 'right' | 'wrong' = 'right') {
  const choices = within(screen.getByRole('group')).getAllByRole('button')
  await user.click(choices[0])
  await user.click(screen.getByRole('button', { name: 'Flip Card' }))
  await user.click(
    screen.getByRole('button', {
      name: report === 'right' ? 'I Got It Right' : 'I Got It Wrong',
    }),
  )
}

describe('PracticePage', () => {
  describe('without an active session', () => {
    it('goes to the setup page when opened directly', () => {
      const { router } = renderApp('/practice/session')

      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(
        screen.getByRole('heading', { level: 1, name: 'Practice Setup' }),
      ).toBeInTheDocument()
    })

    it('goes to the summary when the session has already ended', () => {
      const { router } = renderApp('/practice/session', {
        initialState: endedSessionState(),
      })

      expect(router.state.location.pathname).toBe('/practice/summary')
    })

    it('goes to the setup page if the session has no question to show', () => {
      const state = { ...activeSessionState(), currentQuestion: null }
      const { router } = renderApp('/practice/session', { initialState: state })

      expect(router.state.location.pathname).toBe('/practice/setup')
    })

    it('does not leave the session page in the history when it redirects', async () => {
      const { router } = renderApp('/practice/session', {
        initialState: endedSessionState(),
      })

      await act(() => router.navigate(-1))

      // Going back does not bounce forward to the summary again.
      expect(router.state.location.pathname).not.toBe('/practice/session')
    })
  })

  describe('with an active session', () => {
    it('shows the first question on a card with four answer choices', () => {
      renderSession()

      expect(
        screen.getByRole('heading', { level: 1, name: 'Practice' }),
      ).toBeInTheDocument()
      expect(questionHeading()).toHaveTextContent(/^\d+ \+ \d+ = \?$/)
      expect(
        within(screen.getByRole('group')).getAllByRole('button'),
      ).toHaveLength(4)
    })

    it.each([
      ['addition', /^\d+ \+ \d+ = \?$/],
      ['subtraction', /^\d+ − \d+ = \?$/],
      ['multiplication', /^\d+ × \d+ = \?$/],
      ['division', /^\d+ ÷ \d+ = \?$/],
    ] as const)(
      'asks %s questions when that is chosen',
      (operation, pattern) => {
        renderSession({ operations: [operation] })

        expect(questionHeading()).toHaveTextContent(pattern)
      },
    )

    it('keeps to the chosen difficulty level', () => {
      renderSession({ operations: ['addition'], difficulty: 1 })

      const [a, b] = questionHeading().textContent!.match(/\d+/g)!.map(Number)
      expect(a).toBeLessThanOrEqual(10)
      expect(b).toBeLessThanOrEqual(10)
    })
  })

  describe('progress in a fixed-length session', () => {
    it('shows "Question 1 of 5"', () => {
      renderSession({ sessionLength: 5 })

      expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    })

    it('shows an empty progress bar at the start', () => {
      renderSession({ sessionLength: 5 })

      expect(progressBar()).toHaveAttribute('aria-valuenow', '0')
      expect(progressBar()).toHaveAttribute('aria-valuemax', '5')
      expect(progressBar()).toHaveAttribute(
        'aria-valuetext',
        '0 of 5 questions answered',
      )
    })

    it('updates the progress after every attempt', async () => {
      const user = userEvent.setup()
      renderSession({ sessionLength: 5 })

      for (const answered of [1, 2, 3, 4]) {
        await answer(user)

        expect(
          screen.getByText(`Question ${answered + 1} of 5`),
        ).toBeInTheDocument()
        expect(progressBar()).toHaveAttribute('aria-valuenow', String(answered))
        expect(progressBar()).toHaveAttribute(
          'aria-valuetext',
          `${answered} of 5 questions answered`,
        )
      }
    })

    it('has a name for screen readers', () => {
      renderSession()

      expect(
        screen.getByRole('progressbar', { name: 'Session progress' }),
      ).toBeInTheDocument()
    })

    it('has no End Session button', () => {
      renderSession({ sessionLength: 5 })

      expect(
        screen.queryByRole('button', { name: 'End Session' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('recording results', () => {
    it('counts "I Got It Right" and moves to the next question', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()

      await answer(user, 'right')

      expect(probe().session).toMatchObject({
        attempted: 1,
        correct: 1,
        incorrect: 0,
      })
      expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    })

    it('counts "I Got It Wrong" and moves to the next question', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()

      await answer(user, 'wrong')

      expect(probe().session).toMatchObject({
        attempted: 1,
        correct: 0,
        incorrect: 1,
      })
      expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    })

    it('makes a mistake pattern from "I Got It Wrong", for the question just answered', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()
      const before = probe().currentQuestionId

      await answer(user, 'wrong')

      const { attempts, mistakePatterns } = probe()
      expect(before).toBe(attempts[0].questionId)
      expect(mistakePatterns).toEqual([
        expect.objectContaining({
          operation: attempts[0].operation,
          firstOperand: attempts[0].firstOperand,
          secondOperand: attempts[0].secondOperand,
          correctAnswer: attempts[0].correctAnswer,
          difficulty: attempts[0].difficulty,
          incorrectCount: 1,
          similarCorrectCount: 0,
          mastered: false,
        }),
      ])
    })

    it('makes no mistake pattern from "I Got It Right"', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()

      await answer(user, 'right')

      expect(probe().mistakePatterns).toEqual([])
    })

    it('makes one pattern for each different question that was got wrong', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()

      await answer(user, 'wrong')
      await answer(user, 'right')
      await answer(user, 'wrong')

      const { attempts, mistakePatterns } = probe()
      const wrongIds = new Set(
        attempts
          .filter((a) => !a.selfReportedCorrect)
          .map((a) => `${a.firstOperand}:${a.secondOperand}`),
      )
      expect(mistakePatterns).toHaveLength(wrongIds.size)
    })

    it('stores each completed attempt', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession()

      await answer(user, 'right')
      await answer(user, 'wrong')

      const { attempts, session } = probe()
      expect(attempts).toHaveLength(2)
      expect(attempts.map((a) => a.selfReportedCorrect)).toEqual([true, false])
      expect(attempts.every((a) => a.sessionId === session?.id)).toBe(true)
      expect(new Set(attempts.map((a) => a.questionId)).size).toBe(2)
    })

    it('shows a fresh, unflipped card for the next question', async () => {
      const user = userEvent.setup()
      renderSession()

      await answer(user)

      expect(screen.getByRole('button', { name: 'Flip Card' })).toBeDisabled()
      for (const button of within(screen.getByRole('group')).getAllByRole(
        'button',
      )) {
        expect(button).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('does not repeat the question just answered', async () => {
      // Each round is several clicks in jsdom, so keep it short. The repeat
      // avoidance itself is tested at length in the generator and hook tests.
      const user = userEvent.setup()
      renderSession({
        operations: ['multiplication'],
        difficulty: 1,
        sessionLength: 'continuous',
      })

      for (let i = 0; i < 6; i++) {
        const before = questionHeading().textContent
        await answer(user)

        expect(questionHeading().textContent).not.toBe(before)
      }
    })
  })

  describe('finishing a fixed-length session', () => {
    it('goes to the summary after the last question', async () => {
      const user = userEvent.setup()
      const { router } = renderSession({ sessionLength: 2 })

      await answer(user, 'right')
      expect(router.state.location.pathname).toBe('/practice/session')
      await answer(user, 'wrong')

      expect(router.state.location.pathname).toBe('/practice/summary')
    })

    it('records the session as finished with the right totals', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession({ sessionLength: 3 })

      await answer(user, 'right')
      await answer(user, 'wrong')
      await answer(user, 'right')

      expect(probe().isActive).toBe(false)
      expect(probe().session).toMatchObject({
        attempted: 3,
        correct: 2,
        incorrect: 1,
      })
      expect(probe().session?.completedAt).toBeDefined()
      expect(probe().attempts).toHaveLength(3)
    })

    it('stops making questions once the session is over', async () => {
      const user = userEvent.setup()
      const { probe } = renderSession({ sessionLength: 1 })

      await answer(user)

      expect(probe().currentQuestionId).toBeNull()
    })

    it('does not start again when going back from the summary', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession({ sessionLength: 1 })
      await answer(user)
      const endedId = probe().session?.id

      await act(() => router.navigate(-1))

      expect(router.state.location.pathname).not.toBe('/practice/session')
      expect(probe().session?.id).toBe(endedId)
      expect(probe().isActive).toBe(false)
    })
  })

  describe('continuous practice', () => {
    const endButton = () => screen.getByRole('button', { name: 'End Session' })

    it('shows just the question number, with no total and no progress bar', () => {
      renderSession({ sessionLength: 'continuous' })

      expect(screen.getByText('Question 1')).toBeInTheDocument()
      expect(screen.queryByText(/^Question \d+ of /)).not.toBeInTheDocument()
      expect(progressBar()).not.toBeInTheDocument()
    })

    it('keeps going without an end', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession({ sessionLength: 'continuous' })

      // Longer runs (60 answers) are covered without the UI in the hook tests.
      for (let i = 0; i < 6; i++) await answer(user)

      expect(screen.getByText('Question 7')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().isActive).toBe(true)
    })

    it('has an End Session button', () => {
      renderSession({ sessionLength: 'continuous' })

      expect(endButton()).toBeInTheDocument()
    })

    it('ends straight away, without asking, if nothing has been answered', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession({ sessionLength: 'continuous' })

      await user.click(endButton())

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(probe().session).toBeNull()
    })

    describe('after some questions', () => {
      async function renderAfterTwoAnswers() {
        const user = userEvent.setup()
        const app = renderSession({ sessionLength: 'continuous' })
        await answer(user, 'right')
        await answer(user, 'wrong')
        return { user, ...app }
      }

      it('asks before ending, saying how many were answered', async () => {
        const { user } = await renderAfterTwoAnswers()

        await user.click(endButton())

        const dialog = screen.getByRole('dialog', { name: 'End this session?' })
        expect(dialog).toHaveAccessibleDescription(
          /You have answered 2 questions so far/,
        )
      })

      it('says "1 question" in the singular', async () => {
        const user = userEvent.setup()
        renderSession({ sessionLength: 'continuous' })
        await answer(user)

        await user.click(endButton())

        expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
          /answered 1 question so far/,
        )
      })

      it('keeps the session going when the student chooses to keep practicing', async () => {
        const { user, router, probe } = await renderAfterTwoAnswers()
        await user.click(endButton())

        await user.click(
          screen.getByRole('button', { name: 'Keep Practicing' }),
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(router.state.location.pathname).toBe('/practice/session')
        expect(probe().isActive).toBe(true)
        expect(screen.getByText('Question 3')).toBeInTheDocument()
      })

      it('keeps the session going when Escape is pressed', async () => {
        const { user, probe } = await renderAfterTwoAnswers()
        await user.click(endButton())

        fireEvent(
          screen.getByRole('dialog'),
          new Event('cancel', { cancelable: true }),
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(probe().isActive).toBe(true)
      })

      it('ends the session and goes to the summary when confirmed', async () => {
        const { user, router, probe } = await renderAfterTwoAnswers()
        await user.click(endButton())

        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: 'End Session',
          }),
        )

        expect(router.state.location.pathname).toBe('/practice/summary')
        expect(probe().isActive).toBe(false)
        expect(probe().session).toMatchObject({
          attempted: 2,
          correct: 1,
          incorrect: 1,
        })
        expect(probe().session?.completedAt).toBeDefined()
        expect(probe().attempts).toHaveLength(2)
      })
    })
  })

  describe('saved settings', () => {
    const card = () => document.querySelector('[data-flipped]') as HTMLElement

    function saveSettings(settings: Record<string, unknown>) {
      window.localStorage.setItem(
        'mathPractice.settings',
        JSON.stringify(settings),
      )
    }

    it('animate the card and explain answers by default', async () => {
      const user = userEvent.setup()
      renderSession()

      expect(card()).toHaveAttribute('data-animated', 'true')
      const choices = within(screen.getByRole('group')).getAllByRole('button')
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))
      expect(
        screen.getByRole('heading', { name: /How to solve it:/ }),
      ).toBeInTheDocument()
    })

    it('turn the flip animation off when saved that way', () => {
      saveSettings({ cardAnimationEnabled: false })

      renderSession()

      expect(card()).toHaveAttribute('data-animated', 'false')
    })

    it('leave out the explanation when saved that way', async () => {
      const user = userEvent.setup()
      saveSettings({ showExplanations: false })
      renderSession()

      const choices = within(screen.getByRole('group')).getAllByRole('button')
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))

      expect(
        screen.getByRole('button', { name: 'I Got It Right' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: /How to solve it/ }),
      ).not.toBeInTheDocument()
    })

    it('still work completely with the animation off', async () => {
      const user = userEvent.setup()
      saveSettings({ cardAnimationEnabled: false })
      const { probe } = renderSession()

      await answer(user, 'right')

      expect(probe().session?.attempted).toBe(1)
    })

    it('ignore a damaged saved setting and use the default for it', () => {
      saveSettings({ cardAnimationEnabled: 'no' })

      renderSession()

      expect(card()).toHaveAttribute('data-animated', 'true')
    })
  })
})

describe('PracticePage in a mistake-review session', () => {
  const addition = (a: number, b: number, overrides = {}) =>
    makeMistakePattern({
      operation: 'addition',
      firstOperand: a,
      secondOperand: b,
      correctAnswer: a + b,
      difficulty: 2,
      ...overrides,
    })

  function renderReview(
    patterns = [addition(12, 15), addition(21, 9)],
    config: Partial<PracticeConfig> = {},
  ) {
    return renderApp('/practice/session', {
      initialState: reviewSessionState(patterns, config),
    })
  }

  it('shows the question as practice for an earlier mistake', () => {
    renderReview()

    expect(screen.getByText('Mistake practice')).toBeVisible()
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    expect(questionHeading()).toHaveTextContent(/= \?$/)
  })

  it('works like any other card: pick, flip, report', async () => {
    const user = userEvent.setup()
    const { probe } = renderReview()

    await answer(user, 'right')

    expect(probe().session).toMatchObject({ attempted: 1, correct: 1 })
    expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    expect(screen.getByText('Mistake practice')).toBeVisible()
  })

  it('counts a right answer toward mastering the mistake the question came from', async () => {
    const user = userEvent.setup()
    const { probe } = renderReview()
    const sourceId = probe().currentQuestion!.mistakePatternId

    await answer(user, 'right')

    expect(
      probe().mistakePatterns.find((p) => p.id === sourceId)
        ?.similarCorrectCount,
    ).toBe(1)
  })

  it('counts a wrong answer as a step back, and the missed question becomes a mistake', async () => {
    const user = userEvent.setup()
    const { probe } = renderReview([
      addition(12, 15, { similarCorrectCount: 2 }),
      addition(21, 9, { similarCorrectCount: 2 }),
    ])
    const asked = probe().currentQuestion!
    const sourceId = asked.mistakePatternId

    await answer(user, 'wrong')

    const { mistakePatterns } = probe()
    expect(mistakePatterns).toHaveLength(3)
    expect(
      mistakePatterns.find((p) => p.id === sourceId)?.similarCorrectCount,
    ).toBe(1)
    expect(screen.getByText('Mistake practice')).toBeVisible()
  })

  it('shows the explanation on the back of a review card, as on any card', async () => {
    const user = userEvent.setup()
    renderReview()

    const choices = within(screen.getByRole('group')).getAllByRole('button')
    await user.click(choices[0])
    await user.click(screen.getByRole('button', { name: 'Flip Card' }))

    expect(screen.getByText(/How to solve it/)).toBeInTheDocument()
  })

  describe('when the last mistake is mastered', () => {
    it('ends the session, shows the summary, and says so', async () => {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ masteryThreshold: 1 }),
      )
      const user = userEvent.setup()
      const { router, probe } = renderReview([
        addition(12, 15),
        addition(21, 9),
      ])

      await answer(user, 'right')
      expect(router.state.location.pathname).toBe('/practice/session')
      await answer(user, 'right')

      expect(router.state.location.pathname).toBe('/practice/summary')
      expect(probe().session).toMatchObject({
        attempted: 2,
        mode: 'mistake-review',
      })
      expect(
        screen.getByText(
          'Great work! You have mastered every mistake for these choices.',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Practice Again' }),
      ).toBeDisabled()
    })

    it('counts those questions in the summary as mistake-review questions', async () => {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ masteryThreshold: 1 }),
      )
      const user = userEvent.setup()
      renderReview([addition(12, 15), addition(21, 9)])

      await answer(user, 'right')
      await answer(user, 'right')

      expect(
        screen.getByText('Mistake-review questions', { selector: 'dt' })
          .nextElementSibling,
      ).toHaveTextContent('2')
      expect(
        screen.getByText('Questions attempted', { selector: 'dt' })
          .nextElementSibling,
      ).toHaveTextContent('2')
    })

    it('does not end the session while another mistake still needs practice', async () => {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ masteryThreshold: 1 }),
      )
      const user = userEvent.setup()
      const { router, probe } = renderReview([
        addition(12, 15),
        addition(21, 9),
      ])

      await answer(user, 'right')

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().isActive).toBe(true)
      expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    })
  })

  it('can be ended early in continuous practice, like any session', async () => {
    const user = userEvent.setup()
    const { router, probe } = renderReview(undefined, {
      sessionLength: 'continuous',
    })
    await answer(user, 'right')

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'End Session',
      }),
    )

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(probe().session).toMatchObject({
      attempted: 1,
      mode: 'mistake-review',
    })
  })
})

describe('PracticePage and what it says to a screen reader', () => {
  const announcement = () =>
    document.querySelector<HTMLElement>('[aria-live="polite"]')!

  it('has a polite live region that is kept out of sight', () => {
    renderSession()

    expect(announcement()).toHaveAttribute('aria-live', 'polite')
    expect(announcement()).toHaveAttribute('aria-atomic', 'true')
    expect(announcement()).toHaveClass('visually-hidden')
  })

  it('says how far along the session is when a question appears', () => {
    renderSession({ sessionLength: 5 })

    expect(announcement()).toHaveTextContent(
      'Question 1 of 5. 0 of 5 answered.',
    )
  })

  it('says it again for each new question', async () => {
    const user = userEvent.setup()
    renderSession({ sessionLength: 5 })

    await answer(user, 'right')
    expect(announcement()).toHaveTextContent(
      'Question 2 of 5. 1 of 5 answered.',
    )

    await answer(user, 'wrong')
    expect(announcement()).toHaveTextContent(
      'Question 3 of 5. 2 of 5 answered.',
    )
  })

  it('says it for continuous practice, with no total', async () => {
    const user = userEvent.setup()
    renderSession({ sessionLength: 'continuous' })
    expect(announcement()).toHaveTextContent('Question 1. 0 answered so far.')

    await answer(user, 'right')

    expect(announcement()).toHaveTextContent('Question 2. 1 answered so far.')
  })

  it('says what was picked when a number key picks it', async () => {
    const user = userEvent.setup()
    renderSession()

    await user.keyboard('2')

    expect(announcement()).toHaveTextContent(
      /^You picked \d+, answer 2\. Press Enter to flip the card\.$/,
    )
  })

  it('says the correct answer when the card is turned over', async () => {
    const user = userEvent.setup()
    renderSession()

    await user.keyboard('1')
    await user.keyboard('{Enter}')

    expect(announcement()).toHaveTextContent(
      /^Card turned over\. You chose \d+\. The correct answer is \d+\.$/,
    )
  })

  it('can be used from the first key to the next question, with the keyboard alone', async () => {
    const user = userEvent.setup()
    const { probe } = renderSession({ sessionLength: 5 })

    await user.keyboard('3') // pick the third choice
    await user.keyboard('{Enter}') // flip
    await user.tab() // on to I Got It Right
    await user.keyboard('{Enter}')

    expect(probe().session).toMatchObject({ attempted: 1, correct: 1 })
    expect(announcement()).toHaveTextContent(
      'Question 2 of 5. 1 of 5 answered.',
    )
    expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
  })

  it('says it is practice on mistakes, for a review session', () => {
    renderApp('/practice/session', {
      initialState: reviewSessionState([
        makeMistakePattern({
          operation: 'addition',
          firstOperand: 12,
          secondOperand: 15,
          correctAnswer: 27,
        }),
      ]),
    })

    expect(announcement()).toHaveTextContent(
      'Mistake practice. Question 1 of 5. 0 of 5 answered.',
    )
  })

  it('does not take the number keys while the end-session question is open', async () => {
    const user = userEvent.setup()
    renderSession({ sessionLength: 'continuous' })
    await answer(user, 'right')

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    await user.keyboard('1')

    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })
})

describe('PracticePage and reduced motion', () => {
  const stubMotion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  const animated = () =>
    document.querySelector('[data-animated]')?.getAttribute('data-animated')

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('animates the card when neither the setting nor the device says otherwise', () => {
    stubMotion(false)
    renderSession()

    expect(animated()).toBe('true')
  })

  it('does not animate it when the device asks for reduced motion, whatever the setting', () => {
    stubMotion(true)
    renderSession()

    expect(animated()).toBe('false')
  })

  it('does not animate it when the app’s own setting is off', () => {
    stubMotion(false)
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ cardAnimationEnabled: false }),
    )
    renderSession()

    expect(animated()).toBe('false')
  })

  it('still shows the answer side clearly when it does not animate', async () => {
    const user = userEvent.setup()
    stubMotion(true)
    renderSession()

    await user.keyboard('2')
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: 'I Got It Right' })).toBeVisible()
    expect(screen.getByText(/^Your answer: \d+$/)).toBeInTheDocument()
  })
})

describe('cheerful feedback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const praise = PRAISE_MESSAGES
  const support = SUPPORT_MESSAGES
  const liveRegion = () =>
    document.querySelector<HTMLElement>('[aria-live="polite"]')!
  /** The message on screen, if any: the one paragraph that is a feedback message. */
  const shown = () =>
    document.querySelector<HTMLElement>('p[data-kind]')?.textContent?.slice(1)

  it('says nothing until the first question has been answered', () => {
    renderSession()

    expect(shown()).toBeUndefined()
  })

  it('praises what the student says they got right', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'right')

    expect(praise).toContain(shown())
  })

  it('encourages after what the student says they got wrong, without calling it wrong', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'wrong')

    expect(support).toContain(shown())
    expect(shown()).not.toMatch(/wrong|incorrect|fail|bad/i)
  })

  it('has a new message for each answer, never the same one twice in a row', async () => {
    const user = userEvent.setup()
    // A random source that always says "the first", so only the rule can keep a message from repeating.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderSession({ sessionLength: 'continuous' })

    let previous: string | undefined
    for (let count = 0; count < 12; count++) {
      await answer(user, count % 3 === 2 ? 'wrong' : 'right')
      expect(shown()).toBeTruthy()
      expect(shown()).not.toBe(previous)
      previous = shown()
    }
  })

  it('is drawn again for each answer, so that it pops in again', async () => {
    const user = userEvent.setup()
    renderSession({ sessionLength: 'continuous' })

    await answer(user, 'right')
    const first = document.querySelector('p[data-kind]')
    await answer(user, 'right')

    expect(document.querySelector('p[data-kind]')).not.toBe(first)
    expect(first).not.toBeInTheDocument()
  })

  it('is not a live region itself, and has no sound', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'right')

    expect(document.querySelector('p[data-kind]')!.closest('[aria-live]')).toBe(
      null,
    )
    expect(document.querySelector('audio')).toBeNull()
  })

  it('is said once with the next question, for a screen reader, in order', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'right')

    const heard = liveRegion().textContent!
    expect(heard).toBe(`${shown()} Question 2 of 5. 1 of 5 answered.`)

    // The next thing announced is not preceded by it again.
    await user.keyboard('2')
    expect(liveRegion().textContent).toMatch(/^You picked \d+, answer 2\./)
  })

  it('is left out, and not said, when feedback effects are off', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ feedbackEffectsEnabled: false }),
    )
    renderSession()

    await answer(user, 'right')
    await answer(user, 'wrong')

    expect(shown()).toBeUndefined()
    expect(liveRegion().textContent).toBe('Question 3 of 5. 2 of 5 answered.')
  })

  it('is on for a student whose settings were saved before there was a switch for it', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ soundEffectsEnabled: false }),
    )
    renderSession()

    await answer(user, 'right')

    expect(shown()).toBeTruthy()
  })

  it('does not get in the way of the question: focus stays on it', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'right')

    expect(document.activeElement).toBe(questionHeading())
  })
})

describe('leaving a session in progress', () => {
  const leaveDialog = () =>
    screen.queryByRole('dialog', { name: 'Leave this session?' })
  const confirmLeave = (user: User) =>
    user.click(
      within(leaveDialog()!).getByRole('button', {
        name: /^(Leave|End Session and Leave)$/,
      }),
    )
  const location = (router: { state: { location: { pathname: string } } }) =>
    router.state.location.pathname

  describe('asks first', () => {
    it('when the student tries to go to another page', async () => {
      const { router } = renderSession()

      await act(() => router.navigate('/statistics'))

      expect(leaveDialog()).toBeInTheDocument()
      expect(location(router)).toBe('/practice/session')
    })

    it('when a link in the navigation is used', async () => {
      const user = userEvent.setup()
      renderSession()

      await user.click(screen.getByRole('link', { name: 'Statistics' }))

      expect(leaveDialog()).toBeInTheDocument()
    })

    it('when the back button is used', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')
      await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
      await user.click(screen.getByRole('button', { name: 'Start Session' }))
      expect(location(router)).toBe('/practice/session')

      await act(() => router.navigate(-1))

      expect(leaveDialog()).toBeInTheDocument()
      expect(location(router)).toBe('/practice/session')
    })

    it('says what leaving does, with how many questions were answered', async () => {
      const user = userEvent.setup()
      const { router } = renderSession()
      await answer(user)

      await act(() => router.navigate('/'))

      expect(leaveDialog()).toHaveTextContent(
        'You have answered 1 question so far. If you leave, the session ends, and your answers stay in your statistics.',
      )
      expect(
        within(leaveDialog()!).getByRole('button', {
          name: 'End Session and Leave',
        }),
      ).toBeVisible()
    })

    it('and says there is nothing to lose when nothing was answered', async () => {
      const { router } = renderSession()

      await act(() => router.navigate('/'))

      expect(leaveDialog()).toHaveTextContent(
        'You have not answered any questions yet, so nothing will be kept if you leave.',
      )
      expect(
        within(leaveDialog()!).getByRole('button', { name: 'Leave' }),
      ).toBeVisible()
    })

    it('only for a move to a different page, not for staying on this one', async () => {
      const { router } = renderSession()

      await act(() => router.navigate('/practice/session', { replace: true }))

      expect(leaveDialog()).not.toBeInTheDocument()
      expect(location(router)).toBe('/practice/session')
    })

    it('every time, not just the first', async () => {
      const user = userEvent.setup()
      const { router } = renderSession()

      await act(() => router.navigate('/'))
      await user.click(
        within(leaveDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )
      await act(() => router.navigate('/settings'))

      expect(leaveDialog()).toBeInTheDocument()
    })

    it('with focus on the safe choice, to stay', async () => {
      const { router } = renderSession()

      await act(() => router.navigate('/'))

      expect(document.activeElement).toBe(
        within(leaveDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )
    })
  })

  describe('lets the student stay', () => {
    it('with Keep Practicing: the same question, still in progress', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession()
      const before = probe().currentQuestionId
      await act(() => router.navigate('/'))

      await user.click(
        within(leaveDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )

      expect(leaveDialog()).not.toBeInTheDocument()
      expect(location(router)).toBe('/practice/session')
      expect(probe().isActive).toBe(true)
      expect(probe().currentQuestionId).toBe(before)
      expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    })

    it('with Escape', async () => {
      const { router, probe } = renderSession()
      await act(() => router.navigate('/'))

      fireEvent(
        screen.getByRole('dialog', { name: 'Leave this session?' }),
        new Event('cancel', { cancelable: true }),
      )

      expect(location(router)).toBe('/practice/session')
      expect(probe().isActive).toBe(true)
    })

    it('and can carry on answering afterwards', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession()
      await act(() => router.navigate('/'))
      await user.click(
        within(leaveDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )

      await answer(user)

      expect(probe().session?.attempted).toBe(1)
      expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    })

    it('without losing the answer that was picked on the card', async () => {
      const user = userEvent.setup()
      const { router } = renderSession()
      const choices = within(screen.getByRole('group')).getAllByRole('button')
      await user.click(choices[2])
      await act(() => router.navigate('/'))

      await user.click(
        within(leaveDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )

      expect(
        within(screen.getByRole('group')).getAllByRole('button')[2],
      ).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('lets the student leave', () => {
    it('ending the session, with what was answered kept, and going where they chose', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession()
      await answer(user, 'right')
      await act(() => router.navigate('/statistics'))

      await confirmLeave(user)

      expect(location(router)).toBe('/statistics')
      expect(probe().isActive).toBe(false)
      expect(probe().session?.completedAt).toBeDefined()
      expect(probe().session).toMatchObject({ attempted: 1, correct: 1 })
      expect(probe().attempts).toHaveLength(1)
    })

    it('without a stop at the summary on the way', async () => {
      const user = userEvent.setup()
      const { router } = renderSession()
      await answer(user)
      const visited: string[] = []
      const stop = router.subscribe((state) => {
        visited.push(state.location.pathname)
      })
      await act(() => router.navigate('/settings'))

      await confirmLeave(user)
      stop()

      expect(visited).not.toContain('/practice/summary')
      expect(location(router)).toBe('/settings')
    })

    it('throwing the session away when nothing was answered', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSession()
      await act(() => router.navigate('/statistics'))

      await confirmLeave(user)

      expect(location(router)).toBe('/statistics')
      expect(probe().session).toBeNull()
      expect(probe().isActive).toBe(false)
    })

    it('with the back button too', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')
      await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
      await user.click(screen.getByRole('button', { name: 'Start Session' }))
      await act(() => router.navigate(-1))

      await confirmLeave(user)

      expect(location(router)).toBe('/practice/setup')
      expect(probe().isActive).toBe(false)
    })

    it('and shows nothing of the page meanwhile', async () => {
      const user = userEvent.setup()
      const { router } = renderSession()
      await act(() => router.navigate('/settings'))

      await confirmLeave(user)

      expect(screen.queryByText(/Question \d/)).not.toBeInTheDocument()
      expect(leaveDialog()).not.toBeInTheDocument()
    })
  })

  describe('does not ask', () => {
    it('after the last question, when the summary opens', async () => {
      const user = userEvent.setup()
      const { router } = renderSession({ sessionLength: 1 })

      await answer(user)

      expect(location(router)).toBe('/practice/summary')
      expect(leaveDialog()).not.toBeInTheDocument()
    })

    it('after End Session in continuous practice, when the summary opens', async () => {
      const user = userEvent.setup()
      const { router } = renderSession({ sessionLength: 'continuous' })
      await answer(user)

      await user.click(screen.getByRole('button', { name: 'End Session' }))
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'End this session?' }),
        ).getByRole('button', { name: 'End Session' }),
      )

      expect(location(router)).toBe('/practice/summary')
      expect(leaveDialog()).not.toBeInTheDocument()
    })

    it('after End Session with nothing answered, when the setup page opens', async () => {
      const user = userEvent.setup()
      const { router } = renderSession({ sessionLength: 'continuous' })

      await user.click(screen.getByRole('button', { name: 'End Session' }))

      expect(location(router)).toBe('/practice/setup')
      expect(leaveDialog()).not.toBeInTheDocument()
    })

    it('once a session has ended, wherever the student goes next', async () => {
      const user = userEvent.setup()
      const { router } = renderSession({ sessionLength: 1 })
      await answer(user)

      await act(() => router.navigate('/statistics'))

      expect(location(router)).toBe('/statistics')
      expect(leaveDialog()).not.toBeInTheDocument()
    })

    it('when there is no session to leave', async () => {
      const { router } = renderApp('/practice/session', {
        initialState: endedSessionState(),
      })

      await act(() => router.navigate('/'))

      expect(location(router)).toBe('/')
    })
  })

  describe('and the browser, when the page is closed or refreshed', () => {
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    let restore: (() => void) | undefined
    afterEach(() => {
      restore?.()
      restore = undefined
    })

    it('is not asked to warn while the session is being saved, as nothing would be lost', () => {
      renderSession()

      expect(closing()).toBe(false)
    })

    it('is asked to warn when the session cannot be saved, as it would be lost', () => {
      restore = blockStorage()
      renderSession()

      expect(closing()).toBe(true)
    })

    it('is asked to warn once saving fails part way through', async () => {
      const user = userEvent.setup()
      renderSession()
      expect(closing()).toBe(false)

      restore = fillStorage()
      await answer(user)

      expect(closing()).toBe(true)
    })

    it('stops asking when the session ends', async () => {
      restore = blockStorage()
      const user = userEvent.setup()
      renderSession({ sessionLength: 1 })
      expect(closing()).toBe(true)

      await answer(user)

      expect(closing()).toBe(false)
    })

    it('stops asking when the student leaves the page', async () => {
      restore = blockStorage()
      const user = userEvent.setup()
      const { router } = renderSession()
      await act(() => router.navigate('/'))

      await confirmLeave(user)

      expect(closing()).toBe(false)
    })

    it('is not asked on the other pages, where no session is being answered', () => {
      restore = blockStorage()
      renderApp('/practice/summary', { initialState: endedSessionState() })

      expect(closing()).toBe(false)
    })
  })
})

describe('a session brought back after a refresh', () => {
  const welcome = () =>
    screen.queryByText('Welcome back! Your session is right where you left it.')
  const live = () =>
    document.querySelector<HTMLElement>('[aria-live="polite"]')!

  it('opens at the question it was on, saying that it is back', () => {
    const state = inProgressSessionState({}, { correct: 1, incorrect: 1 })
    saveSessionInProgress(state)

    renderApp('/practice/session')

    expect(welcome()).toBeVisible()
    expect(screen.getByText('Question 3 of 5')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Session progress' }),
    ).toHaveAttribute('aria-valuetext', '2 of 5 questions answered')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      `${state.currentQuestion!.displayText} = ?`,
    )
  })

  it('says so to a screen reader too, along with the question, as one announcement', () => {
    saveSessionInProgress(inProgressSessionState({}, { correct: 1 }))

    renderApp('/practice/session')

    expect(live()).toHaveTextContent(
      'Welcome back! Your session is right where you left it. Question 2 of 5. 1 of 5 answered.',
    )
  })

  it('stops saying so after the next answer', async () => {
    const user = userEvent.setup()
    saveSessionInProgress(inProgressSessionState({}, { correct: 1 }))
    renderApp('/practice/session')

    await answer(user)

    expect(welcome()).not.toBeInTheDocument()
    expect(live()).not.toHaveTextContent('Welcome back')
  })

  it('does not say so for a session that was started in this visit', () => {
    renderSession()

    expect(welcome()).not.toBeInTheDocument()
  })

  it('does not say so on the setup page, or for a different session started afterwards', async () => {
    const user = userEvent.setup()
    saveSessionInProgress(inProgressSessionState({}, { correct: 1 }))
    const { router } = renderApp('/practice/setup')
    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(router.state.location.pathname).toBe('/practice/session')
    expect(welcome()).not.toBeInTheDocument()
  })

  it('has the answer that was picked still picked', () => {
    const state = inProgressSessionState({}, { correct: 1 })
    const answerPicked = state.currentQuestion!.choices[1]
    saveSessionInProgress(state, {
      selectedAnswer: answerPicked,
      flipped: false,
    })

    renderApp('/practice/session')

    expect(
      within(screen.getByRole('group')).getAllByRole('button')[1],
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('has the card still turned over, if it was, ready to say how it went', async () => {
    const user = userEvent.setup()
    const state = inProgressSessionState({}, { correct: 1 })
    const answerPicked = state.currentQuestion!.choices[2]
    saveSessionInProgress(state, {
      selectedAnswer: answerPicked,
      flipped: true,
    })
    const { probe } = renderApp('/practice/session')

    expect(screen.getByText(`Your answer: ${answerPicked}`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'I Got It Right' }))

    expect(probe().session).toMatchObject({ attempted: 2, correct: 2 })
    expect(probe().attempts.at(-1)?.selectedAnswer).toBe(answerPicked)
  })

  it('goes on to the end, which opens the summary', async () => {
    const user = userEvent.setup()
    saveSessionInProgress(
      inProgressSessionState({}, { correct: 3, incorrect: 1 }),
    )
    const { router, probe } = renderApp('/practice/session')

    await answer(user)

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(probe().session).toMatchObject({
      attempted: 5,
      correct: 4,
      incorrect: 1,
    })
    expect(window.localStorage.getItem(STORAGE_KEYS.activeSession)).toBeNull()
  })

  it('asks before leaving, like any session in progress', async () => {
    saveSessionInProgress(inProgressSessionState({}, { correct: 1 }))
    const { router } = renderApp('/practice/session')

    await act(() => router.navigate('/'))

    expect(
      screen.getByRole('dialog', { name: 'Leave this session?' }),
    ).toBeInTheDocument()
  })
})

describe('sound effects on the practice page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function countAudio() {
    const made = { contexts: 0 }
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running'
        currentTime = 0
        destination = {}
        constructor() {
          made.contexts++
        }
        createOscillator() {
          return {
            frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
            connect() {},
            start() {},
            stop() {},
          }
        }
        createGain() {
          return {
            gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
            connect() {},
          }
        }
      },
    )
    return made
  }

  it('are silent when off, which they are to begin with', async () => {
    const made = countAudio()
    const user = userEvent.setup()
    renderSession()

    await answer(user)

    expect(made.contexts).toBe(0)
  })

  it('play when turned on in Settings', async () => {
    const { resetSoundsForTests } = await import('../services/sounds')
    resetSoundsForTests()
    const made = countAudio()
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ soundEffectsEnabled: true }),
    )
    const user = userEvent.setup()
    renderSession()

    await answer(user)

    expect(made.contexts).toBe(1)
    resetSoundsForTests()
  })
})
