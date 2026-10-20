import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('shows a heading and a message', () => {
    render(<EmptyState title="Nothing here" message="Come back later." />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing here' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Come back later.')).toBeInTheDocument()
  })

  it('shows what to do next, when given', () => {
    render(
      <EmptyState
        title="t"
        message="m"
        action={<button type="button">Do it</button>}
      />,
    )

    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument()
  })

  it('needs no action', () => {
    render(<EmptyState title="t" message="m" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
