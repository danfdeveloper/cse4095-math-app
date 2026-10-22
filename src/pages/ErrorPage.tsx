import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { logDevError } from '../utils/devLog'

/**
 * Shown in place of a page that broke while it was being drawn. The student
 * gets a kind message and a way home; the details go to the developer console
 * only, never onto the page.
 */
export function ErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    logDevError('A page could not be shown.', error)
  }, [error])

  return (
    <ErrorMessage title="Something Went Wrong" reload>
      <p>Sorry! This page ran into a problem and could not be shown.</p>
      <p>Your saved progress is safe. Going back home starts things afresh.</p>
    </ErrorMessage>
  )
}
