import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

describe('application routes', () => {
  it.each([
    ['/', 'Welcome to Math Practice!'],
    ['/practice/setup', 'Practice Setup'],
    ['/statistics', 'Statistics'],
    ['/settings', 'Settings'],
  ])('renders the page for %s', (path, heading) => {
    renderApp(path)

    expect(
      screen.getByRole('heading', { level: 1, name: heading }),
    ).toBeInTheDocument()
  })

  it('shows the shared header and a main landmark on every page', () => {
    renderApp('/statistics')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Math Practice App' }),
    ).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  describe('unknown routes', () => {
    it('shows a friendly fallback page inside the shared layout', () => {
      renderApp('/no/such/page')

      expect(
        screen.getByRole('heading', { level: 1, name: 'Page Not Found' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('lets the user return home from the fallback page', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/nope')

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
})
