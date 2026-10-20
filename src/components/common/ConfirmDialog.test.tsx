import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

interface Options {
  open?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

function element({
  open = true,
  onConfirm = () => {},
  onCancel = () => {},
}: Options = {}) {
  return (
    <ConfirmDialog
      open={open}
      title="End this session?"
      message="You have answered 4 questions so far."
      confirmLabel="End Session"
      cancelLabel="Keep Practicing"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

describe('ConfirmDialog', () => {
  it('is hidden while closed', () => {
    render(element({ open: false }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a titled dialog with its message when open', () => {
    render(element())

    const dialog = screen.getByRole('dialog', { name: 'End this session?' })
    expect(dialog).toHaveAccessibleDescription(
      'You have answered 4 questions so far.',
    )
  })

  it('offers both choices', () => {
    render(element())

    expect(
      screen.getByRole('button', { name: 'Keep Practicing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'End Session' }),
    ).toBeInTheDocument()
  })

  it('starts with focus on the safe choice, Cancel', () => {
    render(element())

    expect(
      screen.getByRole('button', { name: 'Keep Practicing' }),
    ).toHaveFocus()
  })

  it('calls onConfirm when confirmed, and only that', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(element({ onConfirm, onCancel }))

    await user.click(screen.getByRole('button', { name: 'End Session' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancelled, and only that', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(element({ onConfirm, onCancel }))

    await user.click(screen.getByRole('button', { name: 'Keep Practicing' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('treats Escape as cancel, and keeps the browser from closing it on its own', () => {
    const onCancel = vi.fn()
    render(element({ onCancel }))
    const dialog = screen.getByRole('dialog')

    const escape = new Event('cancel', { cancelable: true })
    fireEvent(dialog, escape)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(escape.defaultPrevented).toBe(true)
  })

  it('opens and closes as its open prop changes', () => {
    const { rerender } = render(element({ open: false }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(element({ open: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(element({ open: false }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
