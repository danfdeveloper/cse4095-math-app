import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../services/storageService'
import type { MistakePattern } from '../types/mistake'
import type { PracticeAttempt } from '../types/session'
import { isWithinDifficultyRules } from '../utils/validation'
import { leaveTo } from './leaveSession'
import { renderApp } from './renderApp'
import { stored } from './storage'

/*
 * Whole flows through the real app (specification section 21.3 and TODO Task
 * 81): every page, the shared state and the saving, with the student's clicks
 * and keys. Each test starts from an empty browser.
 */

type User = ReturnType<typeof userEvent.setup>

const savedAttempts = () =>
  (stored(STORAGE_KEYS.attempts) ?? []) as PracticeAttempt[]
const savedPatterns = () =>
  (stored(STORAGE_KEYS.mistakePatterns) ?? []) as MistakePattern[]

/** The value beside a label in a region of the page, such as the overall totals. */
const valueIn = (region: string, label: string) =>
  within(screen.getByRole('region', { name: region })).getByText(label, {
    selector: 'dt',
  }).nextElementSibling?.textContent

async function setUp(
  user: User,
  operations: string[],
  level: string,
  length: string,
) {
  for (const operation of operations) {
    await user.click(screen.getByRole('checkbox', { name: operation }))
  }
  await user.click(screen.getByRole('radio', { name: level }))
  await user.click(screen.getByRole('radio', { name: length }))
  await user.click(screen.getByRole('button', { name: 'Start Session' }))
}

/** Picks the first choice, flips the card, and reports. */
async function answer(user: User, report: 'right' | 'wrong') {
  await user.click(within(screen.getByRole('group')).getAllByRole('button')[0])
  await user.click(screen.getByRole('button', { name: 'Flip Card' }))
  await user.click(
    screen.getByRole('button', {
      name: report === 'right' ? 'I Got It Right' : 'I Got It Wrong',
    }),
  )
}

describe('a full addition session', () => {
  it('runs from setup to summary, with every question addition at the chosen level, and the statistics agree', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/practice/setup')
    await setUp(user, ['Addition'], 'Level 2: Easy', '5 questions')

    const reports = ['right', 'wrong', 'right', 'right', 'wrong'] as const
    for (const [index, report] of reports.entries()) {
      expect(screen.getByText(`Question ${index + 1} of 5`)).toBeInTheDocument()
      await answer(user, report)
    }

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(valueIn('Results', 'Questions attempted')).toBe('5')
    expect(valueIn('Results', 'Correct')).toBe('3')
    expect(valueIn('Results', 'Incorrect')).toBe('2')
    expect(valueIn('Results', 'Accuracy')).toBe('60%')

    const attempts = savedAttempts()
    expect(attempts).toHaveLength(5)
    for (const attempt of attempts) {
      expect(attempt.operation).toBe('addition')
      expect(
        isWithinDifficultyRules(
          'addition',
          attempt.firstOperand,
          attempt.secondOperand,
          2,
        ),
      ).toBe(true)
    }

    await user.click(screen.getByRole('link', { name: 'View Statistics' }))
    expect(valueIn('Overall', 'Questions attempted')).toBe('5')
    expect(valueIn('Overall', 'Accuracy')).toBe('60%')
  })
})

describe('a mixed-operation session', () => {
  it('asks only the chosen operations, more than one of them, and counts each apart', async () => {
    const user = userEvent.setup()
    renderApp('/practice/setup')
    await setUp(
      user,
      ['Addition', 'Subtraction', 'Multiplication', 'Division'],
      'Level 1: Beginner',
      '20 questions',
    )

    for (let count = 0; count < 20; count++) await answer(user, 'right')

    const operations = savedAttempts().map((attempt) => attempt.operation)
    expect(operations).toHaveLength(20)
    expect(new Set(operations).size).toBeGreaterThan(1)
    for (const attempt of savedAttempts()) {
      expect(
        isWithinDifficultyRules(
          attempt.operation,
          attempt.firstOperand,
          attempt.secondOperand,
          1,
        ),
      ).toBe(true)
    }

    await user.click(screen.getByRole('link', { name: 'View Statistics' }))
    const byOperation = screen.getByRole('region', { name: 'By operation' })
    let total = 0
    for (const card of within(byOperation).getAllByRole('article')) {
      const value = within(card).queryByText('Questions attempted', {
        selector: 'dt',
      })?.nextElementSibling?.textContent
      total += Number(value ?? 0)
    }
    expect(total).toBe(20)
  })
})

describe('continuous practice', () => {
  it('goes on with no end and no progress bar until the student ends it, then shows the summary', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/practice/setup')
    await setUp(
      user,
      ['Subtraction'],
      'Level 1: Beginner',
      'Continuous practice',
    )

    for (let count = 0; count < 25; count++) await answer(user, 'right')
    expect(router.state.location.pathname).toBe('/practice/session')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Question 26')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'End Session',
      }),
    )

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(valueIn('Results', 'Questions attempted')).toBe('25')
  })
})

describe('the flow in specification section 21.3', () => {
  it('a wrong answer updates the statistics, is kept as a mistake, and mistake practice asks a similar question', async () => {
    const user = userEvent.setup()
    const { router, probe } = renderApp('/practice/setup')

    // 1. Start a practice session.
    await setUp(user, ['Multiplication'], 'Level 2: Easy', '5 questions')
    const asked = probe().currentQuestion!
    // 2. Select an answer.
    await user.click(
      within(screen.getByRole('group')).getAllByRole('button')[0],
    )
    // 3. Flip the card.
    await user.click(screen.getByRole('button', { name: 'Flip Card' }))
    // 4. Mark the answer incorrect.
    await user.click(screen.getByRole('button', { name: 'I Got It Wrong' }))

    // 5. The statistics update.
    await leaveTo(router, '/statistics', user)
    expect(valueIn('Overall', 'Questions attempted')).toBe('1')
    expect(valueIn('Overall', 'Incorrect')).toBe('1')

    // 6. A mistake pattern is stored.
    const [pattern] = savedPatterns()
    expect(savedPatterns()).toHaveLength(1)
    expect(pattern).toMatchObject({
      operation: 'multiplication',
      difficulty: 2,
      incorrectCount: 1,
      mastered: false,
    })
    expect(`${pattern.firstOperand} × ${pattern.secondOperand}`).toBe(
      asked.displayText,
    )
    expect(valueIn('Mistake practice', 'Mistakes to practice')).toBe('1')

    // 7. Start mistake-review mode.
    await act(() => router.navigate('/practice/setup'))
    await user.click(screen.getByRole('checkbox', { name: 'Multiplication' }))
    await user.click(screen.getByRole('radio', { name: 'Level 2: Easy' }))
    await user.click(screen.getByRole('radio', { name: 'Practice mistakes' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    // 8. A similar question appears.
    const review = probe().currentQuestion!
    expect(review.source).toBe('mistake-review')
    expect(review.mistakePatternId).toBe(pattern.id)
    expect(review.difficulty).toBe(2)
    expect(screen.getByText('Mistake practice')).toBeVisible()
  })
})

describe('mastering a mistake', () => {
  it('needs the set number of correct similar answers, then the review ends and says so', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/settings')
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: 'Correct answers to master a mistake',
      }),
      '2',
    )
    await act(() => router.navigate('/practice/setup'))
    await setUp(user, ['Addition'], 'Level 1: Beginner', '5 questions')
    await answer(user, 'wrong')
    for (let count = 0; count < 4; count++) await answer(user, 'right')
    expect(savedPatterns()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Practice Mistakes' }))
    await answer(user, 'right')
    expect(savedPatterns()[0]).toMatchObject({
      similarCorrectCount: 1,
      mastered: false,
    })
    expect(router.state.location.pathname).toBe('/practice/session')

    await answer(user, 'right')

    expect(savedPatterns()[0]).toMatchObject({
      similarCorrectCount: 2,
      mastered: true,
    })
    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(
      screen.getByText(
        'Great work! You have mastered every mistake for these choices.',
      ),
    ).toBeVisible()
  })
})

describe('a browser refresh', () => {
  it('keeps the session in progress and, after it ends, everything it saved', async () => {
    const user = userEvent.setup()
    const first = renderApp('/practice/setup')
    await setUp(user, ['Addition'], 'Level 1: Beginner', '5 questions')
    await answer(user, 'right')
    await answer(user, 'wrong')
    const onScreen = first.probe().currentQuestionId
    first.unmount()

    // The page loads again from what was saved.
    const second = renderApp('/practice/session')
    expect(second.probe().currentQuestionId).toBe(onScreen)
    expect(screen.getByText('Question 3 of 5')).toBeInTheDocument()
    for (let count = 0; count < 3; count++) await answer(user, 'right')
    expect(second.router.state.location.pathname).toBe('/practice/summary')
    second.unmount()

    renderApp('/statistics')
    expect(valueIn('Overall', 'Questions attempted')).toBe('5')
    expect(valueIn('Overall', 'Correct')).toBe('4')
    expect(valueIn('Mistake practice', 'Mistakes to practice')).toBe('1')
  })
})

describe('resetting the statistics', () => {
  it('erases the history and mistakes after a confirmation, and keeps the settings', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/settings')
    await user.click(
      screen.getByRole('checkbox', { name: 'Show explanations' }),
    )
    await act(() => router.navigate('/practice/setup'))
    await setUp(user, ['Addition'], 'Level 1: Beginner', '5 questions')
    for (let count = 0; count < 5; count++) await answer(user, 'wrong')
    await user.click(screen.getByRole('link', { name: 'View Statistics' }))
    expect(valueIn('Overall', 'Questions attempted')).toBe('5')

    await user.click(screen.getByRole('button', { name: 'Reset Statistics' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Yes, Erase It',
      }),
    )

    expect(screen.getByText('No practice yet')).toBeVisible()
    expect(savedAttempts()).toEqual([])
    expect(savedPatterns()).toEqual([])
    expect(
      (stored(STORAGE_KEYS.settings) as { showExplanations: boolean })
        .showExplanations,
    ).toBe(false)
  })
})

describe('a whole session with only the keyboard', () => {
  /** Presses Tab until the element with focus passes the test. */
  async function tabTo(user: User, found: (element: Element) => boolean) {
    for (let presses = 0; presses < 60; presses++) {
      await user.tab()
      if (document.activeElement && found(document.activeElement)) return
    }
    throw new Error('Tab never reached it')
  }
  const named = (name: string) => (element: Element) =>
    element.getAttribute('aria-label') === name ||
    element.textContent?.trim() === name ||
    (element instanceof HTMLInputElement &&
      element.labels?.[0]?.textContent?.includes(name) === true) ||
    (element.id !== '' &&
      document.getElementById(element.getAttribute('aria-labelledby') ?? '')
        ?.textContent === name)

  it('is set up, answered and finished without the mouse', async () => {
    const user = userEvent.setup()
    const { router, probe } = renderApp('/practice/setup')

    await tabTo(user, named('Addition'))
    await user.keyboard(' ')
    await tabTo(user, named('Start Session'))
    await user.keyboard('{Enter}')
    expect(router.state.location.pathname).toBe('/practice/session')

    const total = probe().session!.sessionLength as number
    for (let index = 0; index < total; index++) {
      // A number key picks; focus moves to Flip Card, which Enter presses.
      await user.keyboard(String((index % 4) + 1))
      expect(document.activeElement).toHaveTextContent('Flip Card')
      await user.keyboard('{Enter}')
      // Focus is on the answer; the next Tab stop is I Got It Right.
      await user.tab()
      expect(document.activeElement).toHaveTextContent('I Got It Right')
      await user.keyboard(index % 2 === 0 ? '{Enter}' : ' ')
    }

    expect(router.state.location.pathname).toBe('/practice/summary')
    expect(valueIn('Results', 'Questions attempted')).toBe(String(total))
    expect(valueIn('Results', 'Accuracy')).toBe('100%')
    expect(document.activeElement).toHaveTextContent('Session Summary')
  })
})
