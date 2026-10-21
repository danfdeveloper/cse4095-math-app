import { screen, waitFor, within } from '@testing-library/react'
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

  describe('after all data was erased', () => {
    const notice = /All of your saved data was erased/

    it('shows no notice on an ordinary visit', () => {
      renderApp('/')

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('says so when sent here by the settings page', () => {
      renderApp({ pathname: '/', state: { dataCleared: true } })

      expect(screen.getByRole('status')).toHaveTextContent(notice)
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('keeps the notice for this visit but forgets it from the history entry, so a reload does not repeat it', async () => {
      const { router } = renderApp({
        pathname: '/',
        state: { dataCleared: true },
      })

      await waitFor(() => expect(router.state.location.state).toBeNull())

      expect(router.state.historyAction).toBe('REPLACE')
      expect(router.state.location.pathname).toBe('/')
      expect(screen.getByRole('status')).toHaveTextContent(notice)
    })

    it.each([
      ['a different flag', { somethingElse: true }],
      ['a flag that is not true', { dataCleared: 'yes' }],
      ['state that is not an object', 'nonsense'],
    ])('ignores %s', (_, state) => {
      renderApp({ pathname: '/', state })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})

describe('HomePage and its rainbow', () => {
  it('is decoration only, hidden from screen readers and from the page’s reading order', () => {
    const { container } = renderApp('/')

    const rainbow = container.querySelector(
      'main section > div[aria-hidden="true"]',
    )
    expect(rainbow).toBeInTheDocument()
    expect(rainbow).toBeEmptyDOMElement()
  })

  it('adds nothing to what is read: no image, no text, no extra heading', () => {
    renderApp('/')

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })
})
