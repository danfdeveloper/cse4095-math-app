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

describe('AnswerChoice and its colour', () => {
  it('has the accent it was given, and none otherwise', () => {
    const { rerender } = render(
      <AnswerChoice
        value={56}
        accent="purple"
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute(
      'data-accent',
      'purple',
    )

    rerender(<AnswerChoice value={56} selected={false} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: '56' })).not.toHaveAttribute(
      'data-accent',
    )
  })

  it('shows a check mark when picked, whatever its colour', () => {
    render(
      <AnswerChoice value={56} accent="pink" selected onSelect={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '56' })).toHaveTextContent('✓')
  })

  it('is named by its number alone, so its colour is no part of what is read out', () => {
    render(
      <AnswerChoice
        value={56}
        accent="teal"
        selected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '56' })).toBeInTheDocument()
  })
})

describe('AnswerChoice and its place among the choices', () => {
  const renderChoice = (
    props: Partial<Parameters<typeof AnswerChoice>[0]> = {},
  ) =>
    render(
      <AnswerChoice
        value={56}
        position={3}
        count={4}
        selected={false}
        onSelect={vi.fn()}
        {...props}
      />,
    )

  it('names the key that picks it', () => {
    renderChoice()

    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute(
      'aria-keyshortcuts',
      '3',
    )
  })

  it('says which answer it is, after its name', () => {
    renderChoice()

    expect(
      screen.getByRole('button', { name: '56' }),
    ).toHaveAccessibleDescription('Answer 3 of 4')
  })

  it('is still named by its number alone: the place is no part of its name', () => {
    renderChoice()

    expect(screen.getByRole('button')).toHaveAccessibleName('56')
  })

  it('shows the key beside it for the eye, hidden from screen readers', () => {
    const { container } = renderChoice()

    const hint = container.querySelector(
      'button [aria-hidden="true"]:last-child',
    )
    expect(hint).toHaveTextContent('3')
  })

  it('says just the number if it is not told how many there are', () => {
    renderChoice({ count: undefined })

    expect(screen.getByRole('button')).toHaveAccessibleDescription('Answer 3')
  })

  it('has none of this when it is not told its place', () => {
    renderChoice({ position: undefined, count: undefined })

    const button = screen.getByRole('button', { name: '56' })
    expect(button).not.toHaveAttribute('aria-keyshortcuts')
    expect(button).not.toHaveAttribute('aria-describedby')
    expect(button).toHaveAccessibleDescription('')
  })

  it('still works when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderChoice({ onSelect })

    await user.click(screen.getByRole('button', { name: '56' }))

    expect(onSelect).toHaveBeenCalledWith(56)
  })
})
