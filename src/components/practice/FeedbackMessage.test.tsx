import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeedbackMessage } from './FeedbackMessage'

describe('FeedbackMessage', () => {
  it('shows the message in words', () => {
    render(<FeedbackMessage kind="praise" message="Great job!" />)

    expect(screen.getByText('Great job!')).toBeVisible()
  })

  it('keeps the star or heart out of what a screen reader hears', () => {
    const { container } = render(
      <FeedbackMessage kind="praise" message="Great job!" />,
    )

    const symbol = container.querySelector('[aria-hidden="true"]')
    expect(symbol).toHaveTextContent('★')
    expect(container).toHaveTextContent('★Great job!')
    expect(screen.getByText('Great job!').textContent).toBe('★Great job!')
  })

  it('uses a heart and its own colour for encouragement', () => {
    const { container } = render(
      <FeedbackMessage kind="support" message="Good try!" />,
    )

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '♥',
    )
    expect(screen.getByText('Good try!')).toHaveAttribute('data-accent', 'blue')
  })

  it('uses green for praise, and never red, orange or yellow for anything', () => {
    render(<FeedbackMessage kind="praise" message="Nice work!" />)

    expect(screen.getByText('Nice work!')).toHaveAttribute(
      'data-accent',
      'green',
    )
  })

  it('is not a live region, so that it is read once, with the next question', () => {
    const { container } = render(
      <FeedbackMessage kind="praise" message="Great job!" />,
    )

    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(container.querySelector('[role]')).toBeNull()
  })
})
