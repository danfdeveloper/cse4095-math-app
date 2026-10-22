import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  endedSessionState,
  inProgressSessionState,
  reviewSessionState,
  makeMistakePattern,
} from '../../test/fixtures'
import { renderApp } from '../../test/renderApp'
import { saveSessionInProgress } from '../../test/savedSession'

const card = () =>
  screen.queryByRole('region', { name: 'Pick up where you left off' })
const endDialog = () =>
  screen.queryByRole('dialog', { name: 'End this session?' })

describe('ResumeSession on the home page', () => {
  it('is not there when there is no session', () => {
    renderApp('/')

    expect(card()).not.toBeInTheDocument()
    expect(screen.queryByText('Continue Session')).not.toBeInTheDocument()
  })

  it('is not there for a session that has ended', () => {
    renderApp('/', { initialState: endedSessionState() })

    expect(card()).not.toBeInTheDocument()
  })

  describe('for a session in progress', () => {
    it('says what it is, and how far along', () => {
      renderApp('/', {
        initialState: inProgressSessionState(
          {
            operations: ['addition', 'division'],
            difficulty: 3,
            sessionLength: 10,
          },
          { correct: 2, incorrect: 1 },
        ),
      })

      expect(card()).toBeVisible()
      expect(card()).toHaveTextContent(
        'Addition and Division, Level 3: Intermediate. 3 of 10 questions answered.',
      )
    })

    it('counts a continuous session as far as it has gone, in the singular too', () => {
      renderApp('/', {
        initialState: inProgressSessionState(
          { sessionLength: 'continuous' },
          { correct: 1 },
        ),
      })

      expect(card()).toHaveTextContent('1 question answered so far')
    })

    it('says that a session is mistake practice', () => {
      const mistake = (first: number, second: number) =>
        makeMistakePattern({
          operation: 'addition',
          firstOperand: first,
          secondOperand: second,
          correctAnswer: first + second,
          difficulty: 2,
          incorrectCount: 2,
          lastIncorrectAt: '2026-03-01T12:00:00.000Z',
        })
      renderApp('/', {
        initialState: reviewSessionState([mistake(12, 15), mistake(21, 9)]),
      })

      expect(card()).toHaveTextContent(
        /^Pick up where you left offMistake practice: /,
      )
    })

    it('is found after the page is opened again, through what was saved', () => {
      saveSessionInProgress(inProgressSessionState({}, { correct: 1 }))

      renderApp('/')

      expect(card()).toHaveTextContent('1 of 5 questions answered')
    })

    it('has a heading of its own, below the page’s', () => {
      renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 1 }),
      })

      expect(
        within(card()!).getByRole('heading', { level: 2 }),
      ).toHaveTextContent('Pick up where you left off')
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })

    it('goes back to the question with Continue Session', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 1 }),
      })
      const question = probe().currentQuestionId

      await user.click(screen.getByRole('link', { name: 'Continue Session' }))

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().currentQuestionId).toBe(question)
      expect(screen.getByText('Question 2 of 5')).toBeInTheDocument()
    })
  })

  describe('End Session', () => {
    it('asks first, when there are answers to keep', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 2 }),
      })

      await user.click(
        within(card()!).getByRole('button', { name: 'End Session' }),
      )

      expect(endDialog()).toHaveTextContent(
        'You have answered 2 questions so far.',
      )
      expect(probe().isActive).toBe(true)
    })

    it('ends the session and shows how it went, when confirmed', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 2, incorrect: 1 }),
      })
      await user.click(
        within(card()!).getByRole('button', { name: 'End Session' }),
      )

      await user.click(
        within(endDialog()!).getByRole('button', { name: 'End Session' }),
      )

      expect(router.state.location.pathname).toBe('/practice/summary')
      expect(probe().isActive).toBe(false)
      expect(probe().session).toMatchObject({ attempted: 3, correct: 2 })
      expect(probe().session?.completedAt).toBeDefined()
    })

    it('keeps the session, when the student says to keep practicing', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 1 }),
      })
      await user.click(
        within(card()!).getByRole('button', { name: 'End Session' }),
      )

      await user.click(
        within(endDialog()!).getByRole('button', { name: 'Keep Practicing' }),
      )

      expect(router.state.location.pathname).toBe('/')
      expect(probe().isActive).toBe(true)
      expect(card()).toBeVisible()
    })

    it('keeps the session when Escape closes the question', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/', {
        initialState: inProgressSessionState({}, { correct: 1 }),
      })
      await user.click(
        within(card()!).getByRole('button', { name: 'End Session' }),
      )

      act(() => {
        fireEvent(
          screen.getByRole('dialog', { name: 'End this session?' }),
          new Event('cancel', { cancelable: true }),
        )
      })

      expect(probe().isActive).toBe(true)
      expect(endDialog()).not.toBeInTheDocument()
    })

    it('throws away a session with no answers, without asking', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/', {
        initialState: inProgressSessionState({}, {}),
      })

      await user.click(
        within(card()!).getByRole('button', { name: 'End Session' }),
      )

      expect(endDialog()).not.toBeInTheDocument()
      expect(probe().session).toBeNull()
      expect(card()).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
    })
  })
})
