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
