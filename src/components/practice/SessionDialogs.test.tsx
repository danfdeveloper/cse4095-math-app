import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EndSessionDialog } from './EndSessionDialog'
import { LeaveSessionDialog } from './LeaveSessionDialog'

const dialog = (name: string) => screen.getByRole('dialog', { name })

describe('EndSessionDialog', () => {
  const show = (answered: number, open = true) => {
    const onKeepPracticing = vi.fn()
    const onEnd = vi.fn()
    render(
      <EndSessionDialog
        open={open}
        answered={answered}
        onKeepPracticing={onKeepPracticing}
        onEnd={onEnd}
      />,
    )
    return { onKeepPracticing, onEnd }
  }

  it('asks whether to stop and see how it went, with the number answered', () => {
    show(4)

    expect(dialog('End this session?')).toHaveTextContent(
      'You have answered 4 questions so far. Do you want to stop and see how you did?',
    )
  })

  it('says "1 question" in the singular', () => {
    show(1)

    expect(dialog('End this session?')).toHaveTextContent(
      'You have answered 1 question so far.',
    )
  })

  it('has End Session to confirm and Keep Practicing to stay', async () => {
    const user = userEvent.setup()
    const { onEnd, onKeepPracticing } = show(2)

    await user.click(screen.getByRole('button', { name: 'Keep Practicing' }))
    expect(onKeepPracticing).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('is not shown while it is closed', () => {
    show(2, false)

    expect(
      screen.queryByRole('dialog', { name: 'End this session?' }),
    ).not.toBeInTheDocument()
  })
})

describe('LeaveSessionDialog', () => {
  const show = (answered: number, open = true) => {
    const onKeepPracticing = vi.fn()
    const onLeave = vi.fn()
    render(
      <LeaveSessionDialog
        open={open}
        answered={answered}
        onKeepPracticing={onKeepPracticing}
        onLeave={onLeave}
      />,
    )
    return { onKeepPracticing, onLeave }
  }

  it('says that leaving ends the session and that the answers stay in the statistics', () => {
    show(3)

    expect(dialog('Leave this session?')).toHaveTextContent(
      'You have answered 3 questions so far. If you leave, the session ends, and your answers stay in your statistics.',
    )
  })

  it('says "1 question" in the singular', () => {
    show(1)

    expect(dialog('Leave this session?')).toHaveTextContent(
      'You have answered 1 question so far.',
    )
  })

  it('offers to end the session and leave, or to keep practicing', () => {
    show(3)

    expect(
      screen.getByRole('button', { name: 'End Session and Leave' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Keep Practicing' }),
    ).toBeVisible()
  })

  it('says there is nothing to lose, and offers plain Leave, when nothing was answered', () => {
    show(0)

    expect(dialog('Leave this session?')).toHaveTextContent(
      'You have not answered any questions yet, so nothing will be kept if you leave.',
    )
    expect(screen.getByRole('button', { name: 'Leave' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'End Session and Leave' }),
    ).not.toBeInTheDocument()
  })

  it('calls the right one for each button', async () => {
    const user = userEvent.setup()
    const { onLeave, onKeepPracticing } = show(2)

    await user.click(screen.getByRole('button', { name: 'Keep Practicing' }))
    expect(onKeepPracticing).toHaveBeenCalledTimes(1)
    expect(onLeave).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'End Session and Leave' }),
    )
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('is not shown while it is closed', () => {
    show(2, false)

    expect(
      screen.queryByRole('dialog', { name: 'Leave this session?' }),
    ).not.toBeInTheDocument()
  })
})
