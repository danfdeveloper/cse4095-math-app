import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  buildStatisticsView,
  createEmptyStatistics,
  recordAttemptInStatistics,
} from '../../services/statisticsService'
import { makeAttempt } from '../../test/fixtures'
import { DifficultyStatistics } from './DifficultyStatistics'

function renderRows() {
  let stats = createEmptyStatistics()
  for (const [difficulty, correct] of [
    [2, true],
    [2, true],
    [2, false],
    [4, false],
  ] as const) {
    stats = recordAttemptInStatistics(
      stats,
      makeAttempt({ difficulty, selfReportedCorrect: correct }),
    )
  }
  render(
    <DifficultyStatistics rows={buildStatisticsView(stats, []).byDifficulty} />,
  )
}

describe('DifficultyStatistics', () => {
  it('has one clearly labelled card for each of the four levels, in order', () => {
    renderRows()

    expect(
      screen
        .getAllByRole('article')
        .map((a) => a.querySelector('h3')?.textContent),
    ).toEqual([
      'Level 1: Beginner',
      'Level 2: Easy',
      'Level 3: Intermediate',
      'Level 4: Advanced',
    ])
  })

  it('shows the counts and accuracy for a practiced level', () => {
    renderRows()
    const card = screen.getByRole('article', { name: 'Level 2: Easy' })

    expect(
      within(card).getByText('Questions attempted', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('3')
    expect(
      within(card).getByText('Correct', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('2')
    expect(
      within(card).getByText('Incorrect', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('1')
    expect(
      within(card).getByText('Accuracy', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('67%')
  })

  it('shows a real 0% for a level attempted with no right answers', () => {
    renderRows()
    const card = screen.getByRole('article', { name: 'Level 4: Advanced' })

    expect(
      within(card).getByText('Accuracy', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('0%')
  })

  it('says "Not practiced yet" for levels never tried', () => {
    renderRows()

    for (const name of ['Level 1: Beginner', 'Level 3: Intermediate']) {
      expect(
        within(screen.getByRole('article', { name })).getByText(
          'Not practiced yet',
        ),
      ).toBeInTheDocument()
    }
  })
})
