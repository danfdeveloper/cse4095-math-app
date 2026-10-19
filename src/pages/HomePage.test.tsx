import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

const ACTIONS = [
  {
    name: 'Start Practice',
    path: '/practice/setup',
    heading: 'Practice Setup',
  },
  { name: 'View Statistics', path: '/statistics', heading: 'Statistics' },
  { name: 'Settings', path: '/settings', heading: 'Settings' },
]

// The header navigation also has a "Settings" link, so scope to the page body.
function homeActions() {
  return within(screen.getByRole('main'))
}

describe('HomePage', () => {
  it('shows a welcome heading and message', () => {
    renderApp('/')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Welcome to Math Practice!',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/ready to become a math star/i)).toBeVisible()
  })

  it.each(ACTIONS)('links "$name" to $path', ({ name, path }) => {
    renderApp('/')

    expect(homeActions().getByRole('link', { name })).toHaveAttribute(
      'href',
      path,
    )
  })

  it.each(ACTIONS)(
    'navigates to $path when "$name" is clicked',
    async ({ name, path, heading }) => {
      const user = userEvent.setup()
      const { router } = renderApp('/')

      await user.click(homeActions().getByRole('link', { name }))

      expect(router.state.location.pathname).toBe(path)
      expect(
        screen.getByRole('heading', { level: 1, name: heading }),
      ).toBeInTheDocument()
    },
  )

  it('can reach every action with the Tab key', async () => {
    const user = userEvent.setup()
    renderApp('/')

    const reached = new Set<string>()
    for (let i = 0; i < 12; i++) {
      await user.tab()
      reached.add(document.activeElement?.textContent ?? '')
    }

    for (const { name } of ACTIONS) {
      expect(reached).toContain(name)
    }
  })

  it('activates an action with the Enter key', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    homeActions().getByRole('link', { name: 'Start Practice' }).focus()
    await user.keyboard('{Enter}')

    expect(router.state.location.pathname).toBe('/practice/setup')
  })
})
