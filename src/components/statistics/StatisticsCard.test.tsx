import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatisticsCard } from './StatisticsCard'

const counts = { attempted: 10, correct: 7, incorrect: 3, accuracy: 70 }
const valueIn = (card: HTMLElement, label: string) =>
  within(card).getByText(label, { selector: 'dt' }).nextElementSibling
    ?.textContent

describe('StatisticsCard', () => {
  it('is a labelled article named by its title', () => {
    render(<StatisticsCard title="Addition" counts={counts} />)

    expect(
      screen.getByRole('article', { name: 'Addition' }),
    ).toBeInTheDocument()
  })

  it('shows attempted, correct, incorrect and accuracy', () => {
    render(<StatisticsCard title="Addition" counts={counts} />)
    const card = screen.getByRole('article')

    expect(valueIn(card, 'Questions attempted')).toBe('10')
    expect(valueIn(card, 'Correct')).toBe('7')
    expect(valueIn(card, 'Incorrect')).toBe('3')
    expect(valueIn(card, 'Accuracy')).toBe('70%')
  })

  it('keeps a decorative symbol out of its name', () => {
    render(<StatisticsCard title="Addition" symbol="+" counts={counts} />)

    expect(
      screen.getByRole('article', { name: 'Addition' }),
    ).toBeInTheDocument()
  })

  it('says "Not practiced yet" instead of showing zeros and a misleading 0%', () => {
    render(
      <StatisticsCard
        title="Division"
        counts={{ attempted: 0, correct: 0, incorrect: 0, accuracy: 0 }}
      />,
    )
    const card = screen.getByRole('article')

    expect(within(card).getByText('Not practiced yet')).toBeInTheDocument()
    expect(within(card).queryByText(/0%/)).not.toBeInTheDocument()
    expect(card.querySelector('dl')).toBeNull()
  })

  it('shows a real 0% when something was attempted and none was right', () => {
    render(
      <StatisticsCard
        title="Division"
        counts={{ attempted: 4, correct: 0, incorrect: 4, accuracy: 0 }}
      />,
    )

    expect(valueIn(screen.getByRole('article'), 'Accuracy')).toBe('0%')
  })

  it('shows 100% for a perfect record', () => {
    render(
      <StatisticsCard
        title="Addition"
        counts={{ attempted: 5, correct: 5, incorrect: 0, accuracy: 100 }}
      />,
    )

    expect(valueIn(screen.getByRole('article'), 'Accuracy')).toBe('100%')
  })
})
