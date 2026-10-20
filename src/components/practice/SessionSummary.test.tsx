import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSession } from '../../app/practiceSessionState'
import { summarizeSession } from '../../services/statisticsService'
import type { PracticeConfig, PracticeSession } from '../../types/session'
import { SessionSummary } from './SessionSummary'

const baseConfig: PracticeConfig = {
  operations: ['addition', 'subtraction'],
  difficulty: 2,
  sessionLength: 10,
}

function renderSummary(
  counts: Partial<PracticeSession> = {},
  config: Partial<PracticeConfig> = {},
  mistakeReview = 0,
) {
  const session: PracticeSession = {
    ...createSession({ ...baseConfig, ...config }),
    attempted: 10,
    correct: 7,
    incorrect: 3,
    ...counts,
  }
  const summary = {
    ...summarizeSession(session, []),
    mistakeReviewCount: mistakeReview,
  }
  return render(<SessionSummary session={session} summary={summary} />)
}

/** The value shown next to a label, however the page lays them out. */
function valueOf(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling
    ?.textContent
}

describe('SessionSummary', () => {
  it('is a labelled region', () => {
    renderSummary()

    expect(screen.getByRole('region', { name: 'Results' })).toBeInTheDocument()
  })

  it('shows how many questions were attempted', () => {
    renderSummary({ attempted: 10 })

    expect(valueOf('Questions attempted')).toBe('10')
  })

  it('shows the correct and incorrect answers', () => {
    renderSummary({ correct: 7, incorrect: 3 })

    expect(valueOf('Correct')).toBe('7')
    expect(valueOf('Incorrect')).toBe('3')
  })

  it.each([
    [{ attempted: 10, correct: 7, incorrect: 3 }, '70%'],
    [{ attempted: 4, correct: 1, incorrect: 3 }, '25%'],
    [{ attempted: 3, correct: 2, incorrect: 1 }, '67%'],
    [{ attempted: 5, correct: 5, incorrect: 0 }, '100%'],
    [{ attempted: 5, correct: 0, incorrect: 5 }, '0%'],
  ])('shows the accuracy for %j as %s', (counts, expected) => {
    renderSummary(counts)

    expect(valueOf('Accuracy')).toBe(expected)
  })

  it('shows 0% rather than breaking when nothing was answered', () => {
    renderSummary({ attempted: 0, correct: 0, incorrect: 0 })

    expect(valueOf('Questions attempted')).toBe('0')
    expect(valueOf('Accuracy')).toBe('0%')
  })

  describe('operations practiced', () => {
    it.each([
      [['addition'], 'Addition'],
      [['addition', 'division'], 'Addition and Division'],
      [
        ['addition', 'subtraction', 'multiplication'],
        'Addition, Subtraction, and Multiplication',
      ],
      [
        ['addition', 'subtraction', 'multiplication', 'division'],
        'Addition, Subtraction, Multiplication, and Division',
      ],
    ] as const)('lists %j as "%s"', (operations, expected) => {
      renderSummary({}, { operations: [...operations] })

      expect(valueOf('Operations practiced')).toBe(expected)
    })
  })

  describe('difficulty', () => {
    it.each([
      [1, 'Level 1: Beginner'],
      [2, 'Level 2: Easy'],
      [3, 'Level 3: Intermediate'],
      [4, 'Level 4: Advanced'],
    ] as const)('shows level %i as "%s"', (difficulty, expected) => {
      renderSummary({}, { difficulty })

      expect(valueOf('Difficulty')).toBe(expected)
    })
  })

  it('shows the number of mistake-review questions, even when it is zero', () => {
    renderSummary({}, {}, 0)
    expect(valueOf('Mistake-review questions')).toBe('0')
  })

  it('shows how many mistake-review questions were completed', () => {
    renderSummary({}, {}, 4)

    expect(valueOf('Mistake-review questions')).toBe('4')
  })

  it('does not use shaming words, even for a poor result', () => {
    renderSummary({ attempted: 5, correct: 0, incorrect: 5 })

    expect(
      screen.queryByText(/fail|bad|wrong|poor|stupid/i),
    ).not.toBeInTheDocument()
  })
})
