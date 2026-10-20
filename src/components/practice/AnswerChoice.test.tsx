import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerChoice } from './AnswerChoice'

describe('AnswerChoice', () => {
  it('is a button named by its number', () => {
    render(<AnswerChoice value={56} selected={false} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '56' })).toBeInTheDocument()
  })

  it('reports that it is not selected', () => {
    render(<AnswerChoice value={56} selected={false} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports that it is selected', () => {
    render(<AnswerChoice value={56} selected onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows a check mark when selected, not color alone', () => {
    const { rerender } = render(
      <AnswerChoice value={56} selected={false} onSelect={vi.fn()} />,
    )
    expect(screen.getByRole('button')).not.toHaveTextContent('✓')

    rerender(<AnswerChoice value={56} selected onSelect={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('✓')
  })

  it('keeps the check mark out of its accessible name', () => {
    render(<AnswerChoice value={56} selected onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '56' })).toBeInTheDocument()
  })

  it('passes its value to onSelect when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<AnswerChoice value={56} selected={false} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '56' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(56)
  })

  it.each([['{Enter}'], [' ']])(
    'can be chosen with the keyboard (%j)',
    async (key) => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<AnswerChoice value={56} selected={false} onSelect={onSelect} />)

      await user.tab()
      await user.keyboard(key)

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(56)
    },
  )

  it('cannot be chosen when disabled', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AnswerChoice value={56} selected={false} disabled onSelect={onSelect} />,
    )

    await user.click(screen.getByRole('button', { name: '56' }))

    expect(screen.getByRole('button', { name: '56' })).toBeDisabled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('still shows its selected state when disabled', () => {
    render(<AnswerChoice value={56} selected disabled onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('handles zero', () => {
    render(<AnswerChoice value={0} selected={false} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument()
  })
})
