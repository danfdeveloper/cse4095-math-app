import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { activeSessionState, endedSessionState } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
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
      expect(screen.queryByText(/ of /)).not.toBeInTheDocument()
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
      expect(screen.getByText(/together to get/)).toBeInTheDocument()
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
      expect(screen.queryByText(/together to get/)).not.toBeInTheDocument()
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
