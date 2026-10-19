import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { PracticeConfig } from '../types/session'
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
    it('passes the chosen configuration to the practice session', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')

      await chooseOperation(user, 'Multiplication')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/session')
      const expected: PracticeConfig = {
        operations: ['addition', 'multiplication'],
        difficulty: 3,
        sessionLength: 20,
      }
      expect(router.state.location.state).toEqual({ config: expected })
    })

    it('uses the default session length when it is not changed', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')

      await chooseOperation(user, 'Subtraction')
      await chooseDifficulty(user, 'Level 1: Beginner')
      await user.click(startButton())

      expect(router.state.location.state).toEqual({
        config: {
          operations: ['subtraction'],
          difficulty: 1,
          sessionLength: 10,
        },
      })
    })

    it('passes all four operations when "Mixed operations" is chosen', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')

      await chooseOperation(user, 'Mixed operations')
      await chooseDifficulty(user, 'Level 4: Advanced')
      await user.click(
        screen.getByRole('radio', { name: 'Continuous practice' }),
      )
      await user.click(startButton())

      expect(router.state.location.state).toEqual({
        config: {
          operations: ['addition', 'subtraction', 'multiplication', 'division'],
          difficulty: 4,
          sessionLength: 'continuous',
        },
      })
    })

    it('does not start when the configuration is incomplete', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/setup')
    })

    it('can be completed using only the keyboard', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/setup')

      screen.getByRole('checkbox', { name: 'Addition' }).focus()
      await user.keyboard(' ')
      screen.getByRole('radio', { name: 'Level 2: Easy' }).focus()
      await user.keyboard(' ')
      startButton().focus()
      await user.keyboard('{Enter}')

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(router.state.location.state).toEqual({
        config: { operations: ['addition'], difficulty: 2, sessionLength: 10 },
      })
    })
  })
})
