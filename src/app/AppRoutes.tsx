import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { ErrorPage } from '../pages/ErrorPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PracticePage } from '../pages/PracticePage'
import { PracticeSetupPage } from '../pages/PracticeSetupPage'
import { SessionSummaryPage } from '../pages/SessionSummaryPage'
import { settingsRoute, statisticsRoute } from './lazyPages'
import { RouteLoading } from './RouteLoading'

/**
 * Route definitions for the whole app. They are kept separate from the router
 * itself so tests can mount them in a memory router.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    // If the layout itself breaks, the message replaces everything.
    errorElement: <ErrorPage />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      {
        // If a page breaks, the message takes its place, under the usual header.
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'practice/setup', element: <PracticeSetupPage /> },
          { path: 'practice/session', element: <PracticePage /> },
          { path: 'practice/summary', element: <SessionSummaryPage /> },
          { path: 'statistics', ...statisticsRoute },
          { path: 'settings', ...settingsRoute },
          // Fallback for any URL that matches nothing above.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
