import { act, screen } from '@testing-library/react'
import type { userEvent } from '@testing-library/user-event'
import type { renderApp } from './renderApp'

/**
 * Goes somewhere else the way a student does in the middle of a session: the
 * practice page asks first, and this agrees to leave (which ends the session).
 */
export async function leaveTo(
  router: ReturnType<typeof renderApp>['router'],
  path: string,
  user: ReturnType<typeof userEvent.setup>,
) {
  await act(() => router.navigate(path))
  await user.click(
    screen.getByRole('button', { name: /^(Leave|End Session and Leave)$/ }),
  )
}
