import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

const startButton = () => screen.getByRole('button', { name: 'Start Session' })

async function chooseOperation(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('checkbox', { name }))
}

async function chooseDifficulty(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('radio', { name }))
}

describe('PracticeSetupPage', () => {
  it('shows the operation, difficulty, and session-length selectors', () => {
    renderApp('/practice/setup')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Practice Setup' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'What do you want to practice?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'How hard should it be?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'How many questions?' }),
    ).toBeInTheDocument()
  })

  describe('Start Session button', () => {
    it('is disabled until an operation and a difficulty are chosen', () => {
      renderApp('/practice/setup')

      expect(startButton()).toBeDisabled()
    })

    it('stays disabled with an operation but no difficulty', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')

      expect(startButton()).toBeDisabled()
    })

    it('stays disabled with a difficulty but no operation', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseDifficulty(user, 'Level 1: Beginner')

      expect(startButton()).toBeDisabled()
    })

    it('is enabled once an operation and a difficulty are chosen', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 1: Beginner')

      expect(startButton()).toBeEnabled()
    })

    it('is disabled again if the last operation is deselected', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 1: Beginner')

      await chooseOperation(user, 'Addition')

      expect(startButton()).toBeDisabled()
    })
  })

  describe('validation message', () => {
    it('explains what is missing when nothing is chosen', () => {
      renderApp('/practice/setup')

      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose at least one operation and a difficulty level to start.',
      )
      expect(startButton()).toHaveAccessibleDescription(
        'Choose at least one operation and a difficulty level to start.',
      )
    })

    it('asks for an operation when only a difficulty is chosen', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseDifficulty(user, 'Level 2: Easy')

      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose at least one operation to start.',
      )
    })

    it('asks for a difficulty when only an operation is chosen', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Division')

      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose a difficulty level to start.',
      )
    })

    it('goes away when the configuration is valid', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Division')
      await chooseDifficulty(user, 'Level 2: Easy')

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('starting a session', () => {
    // The chosen setup is kept in the shared practice state, which the probe reads.
    it('starts a session with the chosen setup', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Multiplication')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().session).toMatchObject({
        operations: ['addition', 'multiplication'],
        difficulty: 3,
        sessionLength: 20,
        attempted: 0,
      })
      expect(probe().isActive).toBe(true)
    })

    it('shows the first question of the session it started', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Multiplication')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(startButton())

      expect(screen.getByText('Question 1 of 20')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        /^\d+ × \d+ = \?$/,
      )
    })

    it('uses the default session length when it is not changed', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Subtraction')
      await chooseDifficulty(user, 'Level 1: Beginner')
      await user.click(startButton())

      expect(probe().session).toMatchObject({
        operations: ['subtraction'],
        difficulty: 1,
        sessionLength: 10,
      })
    })

    it('starts with all four operations when "Mixed operations" is chosen', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Mixed operations')
      await chooseDifficulty(user, 'Level 4: Advanced')
      await user.click(
        screen.getByRole('radio', { name: 'Continuous practice' }),
      )
      await user.click(startButton())

      expect(probe().session).toMatchObject({
        operations: ['addition', 'subtraction', 'multiplication', 'division'],
        difficulty: 4,
        sessionLength: 'continuous',
      })
    })

    it('does not start when the configuration is incomplete', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(probe().session).toBeNull()
    })

    it('can be completed using only the keyboard', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      screen.getByRole('checkbox', { name: 'Addition' }).focus()
      await user.keyboard(' ')
      screen.getByRole('radio', { name: 'Level 2: Easy' }).focus()
      await user.keyboard(' ')
      startButton().focus()
      await user.keyboard('{Enter}')

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().session).toMatchObject({
        operations: ['addition'],
        difficulty: 2,
        sessionLength: 10,
      })
    })

    it('starts a fresh session each time', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 1: Beginner')
      await user.click(startButton())
      const firstId = probe().session?.id

      // Back to a new, empty setup page, then start again.
      await act(() => router.navigate('/practice/setup'))
      await chooseOperation(user, 'Division')
      await chooseDifficulty(user, 'Level 2: Easy')
      await user.click(startButton())

      expect(probe().session?.id).not.toBe(firstId)
      expect(probe().session?.operations).toEqual(['division'])
    })
  })

  describe('when opened from a session summary', () => {
    const previous = {
      operations: ['subtraction', 'division'],
      difficulty: 3,
      sessionLength: 20,
    }
    const openWith = (state: unknown) =>
      renderApp({ pathname: '/practice/setup', state })

    it('starts from that session\u2019s choices', () => {
      openWith({ config: previous })

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
      expect(screen.getByRole('radio', { name: '20 questions' })).toBeChecked()
    })

    it('can start straight away, with no validation message', () => {
      openWith({ config: previous })

      expect(startButton()).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('works with continuous practice', () => {
      openWith({ config: { ...previous, sessionLength: 'continuous' } })

      expect(
        screen.getByRole('radio', { name: 'Continuous practice' }),
      ).toBeChecked()
    })

    it.each([
      [
        'an unusable setup',
        { config: { operations: [], difficulty: 3, sessionLength: 20 } },
      ],
      ['state without a setup', { somethingElse: true }],
      ['state that is not an object', 'nonsense'],
      ['no state at all', null],
    ])('ignores %s and starts blank', (_, state) => {
      openWith(state)

      for (const box of screen.getAllByRole('checkbox'))
        expect(box).not.toBeChecked()
      expect(screen.getByRole('radio', { name: '10 questions' })).toBeChecked()
      expect(startButton()).toBeDisabled()
    })

    it('does not carry the choices over to a later visit', async () => {
      const { router } = openWith({ config: previous })

      await act(() => router.navigate('/practice/summary'))
      await act(() => router.navigate('/practice/setup'))

      for (const box of screen.getAllByRole('checkbox'))
        expect(box).not.toBeChecked()
    })
  })
})
