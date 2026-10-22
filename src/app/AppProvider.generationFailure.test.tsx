import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// A switch for making question generation fail, as if the rules were broken.
const failing = vi.hoisted(() => ({ first: false, next: false }))
vi.mock('../services/questionGenerator', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/questionGenerator')>()
  return {
    ...actual,
    generateQuestionForOperations: vi.fn(
      (...args: Parameters<typeof actual.generateQuestionForOperations>) => {
        if (failing.first)
          throw new actual.QuestionGenerationError('broken rules')
        return actual.generateQuestionForOperations(...args)
      },
    ),
    generateNextQuestion: vi.fn(
      (...args: Parameters<typeof actual.generateNextQuestion>) => {
        if (failing.next)
          throw new actual.QuestionGenerationError('broken rules')
        return actual.generateNextQuestion(...args)
      },
    ),
  }
})

import { renderApp } from '../test/renderApp'

let errors: ReturnType<typeof vi.spyOn> | undefined
afterEach(() => {
  failing.first = false
  failing.next = false
  errors?.mockRestore()
})

async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
  await user.click(screen.getByRole('radio', { name: 'Continuous practice' }))
  await user.click(screen.getByRole('button', { name: 'Start Session' }))
}

describe('when no question can be made at all', () => {
  it('does not start the session, and says so kindly, with no technical words', async () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    failing.first = true
    const user = userEvent.setup()
    const { router, probe } = renderApp('/practice/setup')

    await start(user)

    expect(router.state.location.pathname).toBe('/practice/setup')
    expect(probe().session).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Sorry, something went wrong while getting your first question ready. Please press Start Session to try again.',
    )
    expect(alert).not.toHaveTextContent(/broken rules|Error/)
    expect(errors).toHaveBeenCalledWith(
      '[Math Practice] No question could be made.',
      expect.any(Error),
    )
  })

  it('starts on the next try once questions can be made again', async () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    failing.first = true
    const user = userEvent.setup()
    const { router } = renderApp('/practice/setup')
    await start(user)

    failing.first = false
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(router.state.location.pathname).toBe('/practice/session')
  })

  it('ends a session in the middle, keeping the answer just given, and shows how it went', async () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { router, probe } = renderApp('/practice/setup')
    await start(user)
    failing.next = true

    await user.click(
      within(screen.getByRole('group')).getAllByRole('button')[0],
    )
    await user.click(screen.getByRole('button', { name: 'Flip Card' }))
    await user.click(screen.getByRole('button', { name: 'I Got It Right' }))

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(probe().session).toMatchObject({ attempted: 1, correct: 1 })
    expect(probe().session?.completedAt).toBeDefined()
    expect(probe().attempts).toHaveLength(1)
  })
})
