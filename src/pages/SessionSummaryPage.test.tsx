import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { activeSessionState, finishedSessionState } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import type { PracticeConfig } from '../types/session'

type User = ReturnType<typeof userEvent.setup>

function renderSummary(
  counts: Parameters<typeof finishedSessionState>[1] = {
    correct: 7,
    incorrect: 3,
  },
  config: Partial<PracticeConfig> = {},
) {
  return renderApp('/practice/summary', {
    initialState: finishedSessionState(config, counts),
  })
}

/** The value shown next to a label. */
function valueOf(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling
    ?.textContent
}

/** Answers the question on screen: pick the first choice, flip, report. */
async function answer(user: User, report: 'right' | 'wrong') {
  const choices = within(screen.getByRole('group')).getAllByRole('button')
  await user.click(choices[0])
  await user.click(screen.getByRole('button', { name: 'Flip Card' }))
  await user.click(
    screen.getByRole('button', {
      name: report === 'right' ? 'I Got It Right' : 'I Got It Wrong',
    }),
  )
}

describe('SessionSummaryPage', () => {
  describe('without a finished session', () => {
    it('goes to the setup page when opened directly', () => {
      const { router } = renderApp('/practice/summary')

      expect(router.state.location.pathname).toBe('/practice/setup')
    })

    it('goes back to the questions if the session is still going', () => {
      const { router } = renderApp('/practice/summary', {
        initialState: activeSessionState(),
      })

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    })
  })

  describe('with a finished session', () => {
    it('has a Session Summary heading, and keyboard focus starts on it', () => {
      renderSummary()

      const heading = screen.getByRole('heading', {
        level: 1,
        name: 'Session Summary',
      })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveFocus()
    })

    it('shows the totals and accuracy', () => {
      renderSummary({ correct: 7, incorrect: 3 })

      expect(valueOf('Questions attempted')).toBe('10')
      expect(valueOf('Correct')).toBe('7')
      expect(valueOf('Incorrect')).toBe('3')
      expect(valueOf('Accuracy')).toBe('70%')
    })

    it('shows the operations and difficulty of the session', () => {
      renderSummary(
        { correct: 2, incorrect: 1 },
        { operations: ['multiplication', 'division'], difficulty: 3 },
      )

      expect(valueOf('Operations practiced')).toBe(
        'Multiplication and Division',
      )
      expect(valueOf('Difficulty')).toBe('Level 3: Intermediate')
    })

    it('shows the mistake-review count for this session', () => {
      renderSummary({ correct: 3, incorrect: 1, mistakeReview: 2 })

      expect(valueOf('Mistake-review questions')).toBe('2')
    })

    it('shows zero mistake-review questions in an ordinary session', () => {
      renderSummary({ correct: 3, incorrect: 1 })

      expect(valueOf('Mistake-review questions')).toBe('0')
    })

    it('shows a perfect session as 100%', () => {
      renderSummary({ correct: 5, incorrect: 0 })

      expect(valueOf('Accuracy')).toBe('100%')
      expect(valueOf('Incorrect')).toBe('0')
    })

    it('shows a session with no right answers as 0%, kindly', () => {
      const state = finishedSessionState({}, { correct: 0, incorrect: 5 })
      // An id that happens to contain "bad": ids must never show on the page.
      renderApp('/practice/summary', {
        initialState: {
          ...state,
          session: {
            ...state.session!,
            id: 'abad0000-0000-4000-8000-000000000000',
          },
        },
      })

      expect(valueOf('Accuracy')).toBe('0%')
      expect(
        screen.queryByText(/fail|bad|poor|stupid/i),
      ).not.toBeInTheDocument()
    })
  })

  describe('after playing a whole session', () => {
    it('shows exactly what the student reported', async () => {
      const user = userEvent.setup()
      renderApp('/practice/session', {
        initialState: activeSessionState({
          operations: ['addition', 'subtraction'],
          difficulty: 2,
          sessionLength: 5,
        }),
      })

      for (const report of [
        'right',
        'right',
        'wrong',
        'right',
        'wrong',
      ] as const) {
        await answer(user, report)
      }

      expect(
        screen.getByRole('heading', { level: 1, name: 'Session Summary' }),
      ).toBeInTheDocument()
      expect(valueOf('Questions attempted')).toBe('5')
      expect(valueOf('Correct')).toBe('3')
      expect(valueOf('Incorrect')).toBe('2')
      expect(valueOf('Accuracy')).toBe('60%')
      expect(valueOf('Operations practiced')).toBe('Addition and Subtraction')
      expect(valueOf('Difficulty')).toBe('Level 2: Easy')
    })
  })

  describe('actions', () => {
    it('offers all five', () => {
      renderSummary()

      for (const name of ['Practice Again', 'Practice Mistakes']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument()
      }
      for (const name of [
        'Change Settings',
        'View Statistics',
        'Return Home',
      ]) {
        expect(screen.getByRole('link', { name })).toBeInTheDocument()
      }
    })

    describe('Practice Again', () => {
      it('starts a new session with the same setup', async () => {
        const user = userEvent.setup()
        const { router, probe } = renderSummary(
          { correct: 2, incorrect: 1 },
          { operations: ['division'], difficulty: 3, sessionLength: 5 },
        )
        const finishedId = probe().session?.id

        await user.click(screen.getByRole('button', { name: 'Practice Again' }))

        expect(router.state.location.pathname).toBe('/practice/session')
        expect(probe().session).toMatchObject({
          operations: ['division'],
          difficulty: 3,
          sessionLength: 5,
          attempted: 0,
          correct: 0,
          incorrect: 0,
        })
        expect(probe().session?.id).not.toBe(finishedId)
        expect(probe().session?.completedAt).toBeUndefined()
        expect(probe().isActive).toBe(true)
        expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
          /^\d+ ÷ \d+ = \?$/,
        )
      })

      it('repeats continuous practice as continuous practice', async () => {
        const user = userEvent.setup()
        renderSummary(
          { correct: 1, incorrect: 1 },
          { sessionLength: 'continuous' },
        )

        await user.click(screen.getByRole('button', { name: 'Practice Again' }))

        expect(screen.getByText('Question 1')).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'End Session' }),
        ).toBeInTheDocument()
      })

      it('keeps the earlier session’s attempts', async () => {
        const user = userEvent.setup()
        const { probe } = renderSummary({ correct: 2, incorrect: 1 })

        await user.click(screen.getByRole('button', { name: 'Practice Again' }))

        expect(probe().attempts).toHaveLength(3)
      })

      it('works from the keyboard', async () => {
        const user = userEvent.setup()
        const { router } = renderSummary()

        screen.getByRole('button', { name: 'Practice Again' }).focus()
        await user.keyboard('{Enter}')

        expect(router.state.location.pathname).toBe('/practice/session')
      })
    })

    describe('Practice Mistakes', () => {
      it('is not available yet, and says so in words', () => {
        renderSummary()

        const button = screen.getByRole('button', { name: 'Practice Mistakes' })
        expect(button).toBeDisabled()
        expect(button).toHaveAccessibleDescription(
          'Practice Mistakes is coming soon!',
        )
        expect(
          screen.getByText('Practice Mistakes is coming soon!'),
        ).toBeVisible()
      })

      it('does nothing when pressed', async () => {
        const user = userEvent.setup()
        const { router, probe } = renderSummary()

        await user.click(
          screen.getByRole('button', { name: 'Practice Mistakes' }),
        )

        expect(router.state.location.pathname).toBe('/practice/summary')
        expect(probe().isActive).toBe(false)
      })
    })

    describe('Change Settings', () => {
      it('opens the setup page with the session’s choices already selected', async () => {
        const user = userEvent.setup()
        const { router } = renderSummary(
          { correct: 2, incorrect: 1 },
          {
            operations: ['subtraction', 'division'],
            difficulty: 3,
            sessionLength: 20,
          },
        )

        await user.click(screen.getByRole('link', { name: 'Change Settings' }))

        expect(router.state.location.pathname).toBe('/practice/setup')
        expect(
          screen.getByRole('checkbox', { name: 'Subtraction' }),
        ).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
        expect(
          screen.getByRole('checkbox', { name: 'Addition' }),
        ).not.toBeChecked()
        expect(
          screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
        ).toBeChecked()
        expect(
          screen.getByRole('radio', { name: '20 questions' }),
        ).toBeChecked()
        expect(
          screen.getByRole('button', { name: 'Start Session' }),
        ).toBeEnabled()
      })

      it('lets the student change a choice and start again', async () => {
        const user = userEvent.setup()
        const { probe } = renderSummary(
          { correct: 2, incorrect: 1 },
          { operations: ['addition'], difficulty: 1, sessionLength: 5 },
        )
        await user.click(screen.getByRole('link', { name: 'Change Settings' }))

        await user.click(screen.getByRole('radio', { name: 'Level 2: Easy' }))
        await user.click(screen.getByRole('button', { name: 'Start Session' }))

        expect(probe().session).toMatchObject({
          operations: ['addition'],
          difficulty: 2,
          sessionLength: 5,
          attempted: 0,
        })
      })
    })

    it('View Statistics goes to the statistics page', async () => {
      const user = userEvent.setup()
      const { router } = renderSummary()

      await user.click(screen.getByRole('link', { name: 'View Statistics' }))

      expect(router.state.location.pathname).toBe('/statistics')
    })

    it('Return Home goes to the home page', async () => {
      const user = userEvent.setup()
      const { router } = renderSummary()

      await user.click(screen.getByRole('link', { name: 'Return Home' }))

      expect(router.state.location.pathname).toBe('/')
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Welcome to Math Practice!',
        }),
      ).toBeInTheDocument()
    })
  })

  it('keeps the finished session after leaving and coming back', async () => {
    const { router } = renderSummary({ correct: 4, incorrect: 1 })

    await act(() => router.navigate('/statistics'))
    await act(() => router.navigate('/practice/summary'))

    expect(valueOf('Questions attempted')).toBe('5')
  })
})
