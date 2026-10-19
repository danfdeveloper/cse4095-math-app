import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink } from './Button'

describe('Button', () => {
  it('renders a native button that does not submit forms by default', () => {
    render(<Button>Flip Card</Button>)

    expect(screen.getByRole('button', { name: 'Flip Card' })).toHaveAttribute(
      'type',
      'button',
    )
  })

  it('calls onClick when pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Flip Card</Button>)

    await user.click(screen.getByRole('button', { name: 'Flip Card' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Flip Card
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: 'Flip Card' }))

    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ButtonLink', () => {
  it('renders a link to the given route', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/statistics">View Statistics</ButtonLink>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'View Statistics' }),
    ).toHaveAttribute('href', '/statistics')
  })
})
