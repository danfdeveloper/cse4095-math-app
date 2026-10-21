import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatisticsOverview } from './StatisticsOverview'

const valueOf = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

describe('StatisticsOverview', () => {
  it('shows the four overall numbers', () => {
    render(
      <StatisticsOverview
        overall={{ attempted: 20, correct: 15, incorrect: 5, accuracy: 75 }}
      />,
    )

    expect(valueOf('Questions attempted')).toBe('20')
    expect(valueOf('Correct')).toBe('15')
    expect(valueOf('Incorrect')).toBe('5')
    expect(valueOf('Accuracy')).toBe('75%')
  })

  it('shows a perfect record', () => {
    render(
      <StatisticsOverview
        overall={{ attempted: 8, correct: 8, incorrect: 0, accuracy: 100 }}
      />,
    )

    expect(valueOf('Accuracy')).toBe('100%')
    expect(valueOf('Incorrect')).toBe('0')
  })
})

describe('StatisticsOverview and its colours', () => {
  const accentOf = (label: string) =>
    screen
      .getByText(label, { selector: 'dt' })
      .parentElement?.getAttribute('data-accent')

  it('gives each number a colour, none of them red', () => {
    render(
      <StatisticsOverview
        overall={{ attempted: 20, correct: 15, incorrect: 5, accuracy: 75 }}
      />,
    )

    const colours = [
      'Questions attempted',
      'Correct',
      'Incorrect',
      'Accuracy',
    ].map(accentOf)
    expect(colours.every(Boolean)).toBe(true)
    expect(new Set(colours).size).toBe(4)
    expect(colours).not.toContain('red')
  })

  it('shows the number of wrong answers in a neutral warm colour, not as a verdict', () => {
    render(
      <StatisticsOverview
        overall={{ attempted: 20, correct: 15, incorrect: 5, accuracy: 75 }}
      />,
    )

    expect(accentOf('Incorrect')).toBe('orange')
    expect(accentOf('Correct')).toBe('green')
  })
})
