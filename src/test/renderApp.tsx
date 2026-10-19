import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { routes } from '../app/AppRoutes'

/** Renders the real route tree in a memory router, starting at `initialPath`. */
export function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const result = render(<RouterProvider router={router} />)

  return { router, ...result }
}
