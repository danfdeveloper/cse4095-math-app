import { render, screen } from '@testing-library/react'
import { createMemoryRouter, type InitialEntry } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppProvider } from '../app/AppProvider'
import { routes } from '../app/AppRoutes'
import type { PracticeSessionState } from '../app/practiceSessionState'
import type { MistakePattern } from '../types/mistake'
import type { PracticeAttempt, PracticeSession } from '../types/session'
import { SessionProbe } from './SessionProbe'

interface RenderAppOptions {
  /** Start with this session already under way (or finished). */
  initialState?: PracticeSessionState
}

/**
 * Renders the real app (state provider and routes) in a memory router,
 * starting at `initialEntry`. The returned `probe()` reads the shared practice
 * state as it is right now.
 */
export function renderApp(
  initialEntry: InitialEntry = '/',
  { initialState }: RenderAppOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  const result = render(
    <AppProvider initialState={initialState}>
      <RouterProvider router={router} />
      <SessionProbe />
    </AppProvider>,
  )

  const probe = () =>
    JSON.parse(
      screen.getByTestId('session-probe').getAttribute('data-state') ?? 'null',
    ) as {
      session: PracticeSession | null
      currentQuestionId: string | null
      currentQuestion: {
        source: 'regular' | 'mistake-review'
        mistakePatternId: string | null
        displayText: string
        difficulty: number
      } | null
      currentQuestionIndex: number
      attempts: PracticeAttempt[]
      mistakePatterns: MistakePattern[]
      isActive: boolean
    }

  return { router, probe, ...result }
}
