import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  buildStatisticsView,
  createEmptyStatistics,
  recordAttemptInStatistics,
} from '../../services/statisticsService'
import { makeAttempt } from '../../test/fixtures'
import { OperationStatistics } from './OperationStatistics'

function renderRows() {
  let stats = createEmptyStatistics()
  for (const [operation, correct] of [
    ['addition', true],
    ['addition', false],
    ['division', true],
  ] as const) {
    stats = recordAttemptInStatistics(
      stats,
      makeAttempt({ operation, selfReportedCorrect: correct }),
    )
  }
  render(
    <OperationStatistics rows={buildStatisticsView(stats, []).byOperation} />,
  )
}

describe('OperationStatistics', () => {
  it('has one card for each of the four operations, in a fixed order', () => {
    renderRows()

    expect(
      screen
        .getAllByRole('article')
        .map((a) => a.querySelector('h3')?.textContent),
    ).toEqual([
      expect.stringContaining('Addition'),
      expect.stringContaining('Subtraction'),
      expect.stringContaining('Multiplication'),
      expect.stringContaining('Division'),
    ])
  })

  it('shows the counts and accuracy for a practiced operation', () => {
    renderRows()
    const card = screen.getByRole('article', { name: 'Addition' })

    expect(
      within(card).getByText('Questions attempted', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('2')
    expect(
      within(card).getByText('Correct', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('1')
    expect(
      within(card).getByText('Incorrect', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('1')
    expect(
      within(card).getByText('Accuracy', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('50%')
  })

  it('says "Not practiced yet" for operations never tried', () => {
    renderRows()

    for (const name of ['Subtraction', 'Multiplication']) {
      expect(
        within(screen.getByRole('article', { name })).getByText(
          'Not practiced yet',
        ),
      ).toBeInTheDocument()
    }
  })
})
