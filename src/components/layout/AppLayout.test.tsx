import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../../app/AppProvider'
import { routes } from '../../app/AppRoutes'
import { APP_NAME } from '../../constants/pageTitles'
import { renderApp } from '../../test/renderApp'

/** The page-change announcer: the polite live region that follows the routes. */
const announcer = () =>
  document.querySelector<HTMLElement>('[aria-live="polite"]')!

afterEach(() => {
  document.title = ''
})

describe('the skip link', () => {
  it('is the first thing on the page, and leads to the main content', () => {
    renderApp('/')

    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveAttribute('href', '#main-content')
    expect(document.querySelector('a')).toBe(link)
  })

  it('is the first thing Tab reaches', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.tab()

    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveFocus()
  })

  it('moves focus to the main content', async () => {
    const user = userEvent.setup()
    renderApp('/statistics')

    await user.tab()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('then lets Tab carry on from there, past the navigation', async () => {
    const user = userEvent.setup()
    renderApp('/settings')

    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()

    const focused = document.activeElement as HTMLElement
    expect(screen.getByRole('main')).toContainElement(focused)
    expect(screen.getByRole('navigation')).not.toContainElement(focused)
  })

  it('leaves the address and the page as they are', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/statistics')

    await user.tab()
    await user.keyboard('{Enter}')

    expect(router.state.location.pathname).toBe('/statistics')
    expect(router.state.location.hash).toBe('')
  })

  it('stops the browser following the link itself, which would put a # in the address', () => {
    renderApp('/')

    const notCancelled = fireEvent.click(
      screen.getByRole('link', { name: 'Skip to main content' }),
    )

    // fireEvent returns false when the click's default action was cancelled.
    expect(notCancelled).toBe(false)
  })

  it('works with a click too', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Skip to main content' }))

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('is on every page', () => {
    for (const path of [
      '/',
      '/practice/setup',
      '/statistics',
      '/settings',
      '/nowhere',
    ]) {
      const { unmount } = renderApp(path)
      expect(
        screen.getByRole('link', { name: 'Skip to main content' }),
      ).toBeInTheDocument()
      unmount()
    }
  })
})

describe('the main landmark', () => {
  it('is what the skip link leads to, and can be given focus', () => {
    renderApp('/')

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabindex', '-1')
  })

  it('is the only one', () => {
    renderApp('/')

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('is not itself a stop for Tab', async () => {
    const user = userEvent.setup()
    renderApp('/')

    for (let i = 0; i < 12; i++) {
      await user.tab()
      expect(document.activeElement).not.toBe(screen.getByRole('main'))
    }
  })
})

describe('the title of the page', () => {
  it.each([
    ['/', APP_NAME],
    ['/practice/setup', `Practice Setup – ${APP_NAME}`],
    ['/statistics', `Statistics – ${APP_NAME}`],
    ['/settings', `Settings – ${APP_NAME}`],
    ['/nowhere', `Page Not Found – ${APP_NAME}`],
  ])('is right when the app opens at %s', (path, title) => {
    renderApp(path)

    expect(document.title).toBe(title)
  })

  it('changes as the student moves between pages', async () => {
    const { router } = renderApp('/')

    await act(() => router.navigate('/statistics'))
    expect(document.title).toBe(`Statistics – ${APP_NAME}`)

    await act(() => router.navigate('/settings'))
    expect(document.title).toBe(`Settings – ${APP_NAME}`)

    await act(() => router.navigate('/'))
    expect(document.title).toBe(APP_NAME)
  })

  it('changes when a navigation link is used', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Statistics' }))

    expect(document.title).toBe(`Statistics – ${APP_NAME}`)
  })
})

describe('the announcement of a new page', () => {
  it('says nothing when the app first opens, as loading the page says it', () => {
    renderApp('/statistics')

    expect(announcer()).toBeEmptyDOMElement()
  })

  it('says which page the student has arrived at', async () => {
    const { router } = renderApp('/')

    await act(() => router.navigate('/statistics'))

    expect(announcer()).toHaveTextContent('Statistics page')
  })

  it('says it for every move', async () => {
    const user = userEvent.setup()
    renderApp('/')

    const nav = () => within(screen.getByRole('navigation'))

    await user.click(nav().getByRole('link', { name: 'Settings' }))
    expect(announcer()).toHaveTextContent('Settings page')

    await user.click(nav().getByRole('link', { name: 'Home' }))
    expect(announcer()).toHaveTextContent('Home page')
  })

  it('says plainly when there is no such page', async () => {
    const { router } = renderApp('/')

    await act(() => router.navigate('/nowhere'))

    expect(announcer()).toHaveTextContent('Page not found')
  })

  it('is a polite announcement that is read whole', () => {
    renderApp('/')

    expect(announcer()).toHaveAttribute('aria-live', 'polite')
    expect(announcer()).toHaveAttribute('aria-atomic', 'true')
  })

  it('is kept out of sight', () => {
    renderApp('/')

    expect(announcer()).toHaveClass('visually-hidden')
  })
})

describe('the announcement of a new page, as the app runs in development', () => {
  // Strict Mode runs every effect twice when a page first appears.
  function renderStrict(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] })
    render(
      <StrictMode>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </StrictMode>,
    )
    return router
  }

  it('still says nothing when the app first opens', () => {
    renderStrict('/statistics')

    expect(announcer()).toBeEmptyDOMElement()
  })

  it('still says which page the student has arrived at, once', async () => {
    const router = renderStrict('/')

    await act(() => router.navigate('/settings'))

    expect(announcer()).toHaveTextContent(/^Settings page$/)
  })

  it('says nothing more when the same page is shown again', async () => {
    const router = renderStrict('/')
    await act(() => router.navigate('/settings'))

    await act(() => router.navigate('/settings'))

    expect(announcer()).toHaveTextContent(/^Settings page$/)
  })
})
