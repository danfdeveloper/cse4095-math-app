import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppProvider } from '../app/AppProvider'
import { routes } from '../app/AppRoutes'

function Broken(): never {
  throw new Error('Cannot read properties of undefined (reading "secret")')
}

/** The real routes, with one page that always breaks while it is drawn. */
function renderBrokenPage() {
  const withBroken = routes.map((root) => ({
    ...root,
    children: root.children!.map((group) => ({
      ...group,
      children: [{ path: 'broken', element: <Broken /> }, ...group.children!],
    })),
  })) as RouteObject[]
  const router = createMemoryRouter(withBroken, { initialEntries: ['/broken'] })
  render(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  )
  return router
}

let errors: ReturnType<typeof vi.spyOn>
afterEach(() => errors?.mockRestore())

describe('ErrorPage', () => {
  it('shows a kind message, in place of a page that broke', () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderBrokenPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something Went Wrong' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Sorry! This page ran into a problem and could not be shown.',
      ),
    ).toBeVisible()
    expect(screen.getByText(/Your saved progress is safe/)).toBeVisible()
  })

  it('keeps the header and navigation, so the rest of the app can still be reached', () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderBrokenPage()

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible()
  })

  it('never shows the technical details: no error text, no stack trace', () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderBrokenPage()

    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(
      /secret|Cannot read|undefined|Error|at Broken|\.tsx/,
    )
  })

  it('gives a safe way home', () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderBrokenPage()

    const home = screen.getByRole('link', { name: 'Return Home' })
    expect(home).toHaveAttribute('href', '/')
  })

  it('tells developers what went wrong, in the console', () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderBrokenPage()

    expect(
      (errors.mock.calls as unknown[][]).some(
        ([message, detail]) =>
          message === '[Math Practice] A page could not be shown.' &&
          detail instanceof Error,
      ),
    ).toBe(true)
  })

  it('lets the student go to another page, which works as usual', async () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const router = renderBrokenPage()

    await user.click(screen.getByRole('link', { name: 'Statistics' }))

    expect(router.state.location.pathname).toBe('/statistics')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Statistics' }),
    ).toBeVisible()
  })
})
