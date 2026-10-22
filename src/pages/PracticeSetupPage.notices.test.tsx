import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { endedSessionState } from '../test/fixtures'
import { renderApp } from '../test/renderApp'

/** The notice saying why the student is here (the page's other status line is about the choices). */
const notice = () =>
  screen
    .queryAllByRole('status')
    .find((element) => /^There (is|are) no/.test(element.textContent ?? '')) ??
  null

describe('Practice Setup, when sent there from a page with nothing to show', () => {
  it('says there is no session, after the practice page was opened without one', () => {
    const { router } = renderApp('/practice/session')

    expect(router.state.location.pathname).toBe('/practice/setup')
    expect(notice()).toHaveTextContent(
      'There is no practice session going on right now. Choose what to practice, then press Start Session.',
    )
  })

  it('says there are no results, after the summary was opened without a session', () => {
    const { router } = renderApp('/practice/summary')

    expect(router.state.location.pathname).toBe('/practice/setup')
    expect(notice()).toHaveTextContent(
      'There are no results to show yet. Finish a practice session, and its results will appear.',
    )
  })

  it('keeps it out of the history, so a reload or a return does not say it again', () => {
    const { router } = renderApp('/practice/session')

    expect(router.state.location.state).toBeNull()
    expect(notice()).toBeInTheDocument()
  })

  it('says nothing on an ordinary visit', () => {
    renderApp('/practice/setup')

    expect(notice()).not.toBeInTheDocument()
  })

  it('says nothing after a session with no answers is ended on purpose', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/practice/setup')
    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('radio', { name: 'Continuous practice' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    await user.click(screen.getByRole('button', { name: 'End Session' }))

    expect(router.state.location.pathname).toBe('/practice/setup')
    expect(notice()).not.toBeInTheDocument()
  })

  it('says nothing about a session that has just been finished: the summary shows it', () => {
    const { router } = renderApp('/practice/session', {
      initialState: endedSessionState(),
    })

    expect(router.state.location.pathname).not.toBe('/practice/setup')
    expect(notice()).not.toBeInTheDocument()
  })

  it('ignores a reason it does not know', () => {
    renderApp({ pathname: '/practice/setup', state: { missing: 'everything' } })

    expect(notice()).not.toBeInTheDocument()
  })

  it('still lets the student choose and start straight away', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/practice/session')

    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(router.state.location.pathname).toBe('/practice/session')
    expect(
      within(screen.getByRole('group')).getAllByRole('button'),
    ).toHaveLength(4)
    await act(async () => {})
  })
})
