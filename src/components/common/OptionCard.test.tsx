import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OptionCard } from './OptionCard'

const card = (container: HTMLElement) => container.querySelector('label')!

describe('OptionCard and its colour', () => {
  it('has the accent it was given', () => {
    const { container } = render(
      <OptionCard
        type="checkbox"
        label="Addition"
        accent="green"
        checked={false}
        onChange={vi.fn()}
      />,
    )

    expect(card(container)).toHaveAttribute('data-accent', 'green')
  })

  it('has none unless it is given one, and then takes the default colour', () => {
    const { container } = render(
      <OptionCard
        type="radio"
        label="10 questions"
        checked={false}
        onChange={vi.fn()}
      />,
    )

    expect(card(container)).not.toHaveAttribute('data-accent')
  })

  it('is named by its label alone, whatever its colour', () => {
    render(
      <OptionCard
        type="checkbox"
        label="Subtraction"
        symbol="−"
        accent="orange"
        checked={false}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('checkbox', { name: 'Subtraction' }),
    ).toBeInTheDocument()
  })

  it('shows a check mark when chosen, so the choice is not carried by colour', () => {
    const { container } = render(
      <OptionCard
        type="checkbox"
        label="Addition"
        accent="green"
        checked
        onChange={vi.fn()}
      />,
    )

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '✓',
    )
  })

  it('shows no check mark when not chosen', () => {
    const { container } = render(
      <OptionCard
        type="checkbox"
        label="Addition"
        accent="green"
        checked={false}
        onChange={vi.fn()}
      />,
    )

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '',
    )
  })

  it('still works as before when it has an accent', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <OptionCard
        type="checkbox"
        label="Addition"
        accent="green"
        checked={false}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
