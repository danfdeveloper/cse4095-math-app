import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../services/storageService'
import {
  finishedSessionState,
  historyState,
  inProgressSessionState,
  makeMistakePattern,
  makeSession,
  reviewSessionState,
} from '../test/fixtures'
import { leaveTo } from '../test/leaveSession'
import { renderApp } from '../test/renderApp'
import { stored } from '../test/storage'
import { formatSessionDate } from '../utils/format'

const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}T12:00:00.000Z`

const renderStats = (specs: Parameters<typeof historyState>[0] = []) =>
  renderApp('/statistics', { initialState: historyState(specs) })

/** The value shown next to a label, in the overall totals. */
const overall = (label: string) =>
  within(screen.getByRole('region', { name: 'Overall' })).getByText(label, {
    selector: 'dt',
  }).nextElementSibling?.textContent

describe('StatisticsPage', () => {
  it('has a Statistics heading', () => {
    renderStats()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Statistics' }),
    ).toBeInTheDocument()
  })

  describe('before any practice', () => {
    it('shows a friendly empty state instead of zeros', () => {
      renderStats()

      expect(
        screen.getByRole('heading', { level: 2, name: 'No practice yet' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/progress will show up here/i),
      ).toBeInTheDocument()
    })

    it('invites the student to start practicing', async () => {
      const user = userEvent.setup()
      const { router } = renderStats()

      await user.click(screen.getByRole('link', { name: 'Start Practice' }))

      expect(router.state.location.pathname).toBe('/practice/setup')
    })

    it('shows none of the statistics sections', () => {
      renderStats()

      for (const name of [
        'Overall',
        'By operation',
        'By difficulty',
        'Mistake practice',
        'Recent sessions',
      ]) {
        expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument()
      }
      expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    })

    it('still offers the reset button', () => {
      renderStats()

      expect(
        screen.getByRole('button', { name: 'Reset Statistics' }),
      ).toBeEnabled()
    })
  })

  describe('with practice', () => {
    const twoSessions = [
      {
        config: { operations: ['addition' as const], difficulty: 1 as const },
        correct: 3,
        incorrect: 1,
        startedAt: day(1),
      },
      {
        config: { operations: ['division' as const], difficulty: 3 as const },
        correct: 1,
        incorrect: 3,
        startedAt: day(2),
      },
    ]

    it('shows the overall totals and accuracy', () => {
      renderStats(twoSessions)

      expect(overall('Questions attempted')).toBe('8')
      expect(overall('Correct')).toBe('4')
      expect(overall('Incorrect')).toBe('4')
      expect(overall('Accuracy')).toBe('50%')
    })

    it('has headed sections in order: overall, by operation, by difficulty, mistake practice, recent sessions', () => {
      renderStats(twoSessions)

      expect(
        screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
      ).toEqual([
        'Overall',
        'By operation',
        'By difficulty',
        'Mistake practice',
        'Recent sessions',
      ])
    })

    it('shows the empty state no more', () => {
      renderStats(twoSessions)

      expect(screen.queryByText('No practice yet')).not.toBeInTheDocument()
    })

    describe('by operation', () => {
      it('has a card for every operation', () => {
        renderStats(twoSessions)

        for (const name of [
          'Addition',
          'Subtraction',
          'Multiplication',
          'Division',
        ]) {
          expect(screen.getByRole('article', { name })).toBeInTheDocument()
        }
      })

      it('shows each practiced operation’s counts and accuracy', () => {
        renderStats(twoSessions)
        const addition = screen.getByRole('article', { name: 'Addition' })
        const division = screen.getByRole('article', { name: 'Division' })

        const value = (card: HTMLElement, label: string) =>
          within(card).getByText(label, { selector: 'dt' }).nextElementSibling
            ?.textContent
        expect([
          value(addition, 'Questions attempted'),
          value(addition, 'Correct'),
          value(addition, 'Incorrect'),
          value(addition, 'Accuracy'),
        ]).toEqual(['4', '3', '1', '75%'])
        expect([
          value(division, 'Questions attempted'),
          value(division, 'Correct'),
          value(division, 'Incorrect'),
          value(division, 'Accuracy'),
        ]).toEqual(['4', '1', '3', '25%'])
      })

      it('says "Not practiced yet" for the rest', () => {
        renderStats(twoSessions)

        for (const name of ['Subtraction', 'Multiplication']) {
          expect(
            within(screen.getByRole('article', { name })).getByText(
              'Not practiced yet',
            ),
          ).toBeInTheDocument()
        }
      })
    })

    describe('by difficulty', () => {
      it('has a clearly labelled card for every level', () => {
        renderStats(twoSessions)

        for (const name of [
          'Level 1: Beginner',
          'Level 2: Easy',
          'Level 3: Intermediate',
          'Level 4: Advanced',
        ]) {
          expect(screen.getByRole('article', { name })).toBeInTheDocument()
        }
      })

      it('shows each practiced level’s counts and accuracy', () => {
        renderStats(twoSessions)
        const level1 = screen.getByRole('article', {
          name: 'Level 1: Beginner',
        })
        const level3 = screen.getByRole('article', {
          name: 'Level 3: Intermediate',
        })

        expect(
          within(level1).getByText('Accuracy', { selector: 'dt' })
            .nextElementSibling,
        ).toHaveTextContent('75%')
        expect(
          within(level3).getByText('Accuracy', { selector: 'dt' })
            .nextElementSibling,
        ).toHaveTextContent('25%')
        expect(
          within(
            screen.getByRole('article', { name: 'Level 2: Easy' }),
          ).getByText('Not practiced yet'),
        ).toBeInTheDocument()
      })
    })

    describe('recent sessions', () => {
      const items = () =>
        within(
          screen.getByRole('region', { name: 'Recent sessions' }),
        ).getAllByRole('listitem')

      it('lists the newest session first', () => {
        renderStats(twoSessions)

        expect(
          items().map((item) => item.querySelector('time')?.textContent),
        ).toEqual([formatSessionDate(day(2)), formatSessionDate(day(1))])
      })

      it('shows each session’s operations, difficulty, counts and accuracy', () => {
        renderStats(twoSessions)
        const newest = items()[0]
        const value = (label: string) =>
          within(newest).getByText(label, { selector: 'dt' }).nextElementSibling
            ?.textContent

        expect(value('Operations')).toBe('Division')
        expect(value('Difficulty')).toBe('Level 3: Intermediate')
        expect(value('Questions attempted')).toBe('4')
        expect(value('Correct')).toBe('1')
        expect(value('Incorrect')).toBe('3')
        expect(value('Accuracy')).toBe('25%')
      })

      it('shows only the 10 most recent', () => {
        renderStats(
          Array.from({ length: 12 }, (_, i) => ({
            correct: 1,
            incorrect: 0,
            startedAt: day(i + 1),
          })),
        )

        expect(items()).toHaveLength(10)
        expect(items()[0].querySelector('time')).toHaveTextContent(
          formatSessionDate(day(12)),
        )
        expect(items()[9].querySelector('time')).toHaveTextContent(
          formatSessionDate(day(3)),
        )
      })

      it('labels a session that was never finished', () => {
        renderStats([
          { correct: 2, incorrect: 0, startedAt: day(1), finished: false },
          { correct: 1, incorrect: 1, startedAt: day(2) },
        ])

        expect(within(items()[1]).getByText('Not finished')).toBeInTheDocument()
        expect(
          within(items()[0]).queryByText('Not finished'),
        ).not.toBeInTheDocument()
      })

      it('labels the session being practiced right now', () => {
        renderStats([
          { correct: 2, incorrect: 0, startedAt: day(1), finished: false },
        ])

        expect(within(items()[0]).getByText('In progress')).toBeInTheDocument()
      })
    })
  })

  describe('resetting', () => {
    const history = [{ correct: 3, incorrect: 1, startedAt: day(1) }]
    const resetButton = () =>
      screen.getByRole('button', { name: 'Reset Statistics' })

    it('says the settings will stay the same, and that saved mistakes will not', () => {
      renderStats(history)

      expect(
        screen.getByText(
          'Your settings will stay the same. Mistakes saved for practice are erased too.',
        ),
      ).toBeVisible()
    })

    it('asks first, in the words the specification gives', async () => {
      const user = userEvent.setup()
      renderStats(history)

      await user.click(resetButton())

      const dialog = screen.getByRole('dialog', { name: 'Reset statistics?' })
      expect(dialog).toHaveAccessibleDescription(
        'Are you sure you want to erase all practice history and statistics?',
      )
    })

    it('does not ask until the button is pressed, and does nothing by itself', () => {
      const { probe } = renderStats(history)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(probe().attempts).toHaveLength(4)
    })

    it('keeps everything when the student says no', async () => {
      const user = userEvent.setup()
      const { probe } = renderStats(history)
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'No, Keep It' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(probe().attempts).toHaveLength(4)
      expect(overall('Questions attempted')).toBe('4')
      expect(screen.queryByText(/were erased/)).not.toBeInTheDocument()
    })

    it('keeps everything when Escape is pressed', async () => {
      const user = userEvent.setup()
      const { probe } = renderStats(history)
      await user.click(resetButton())

      fireEvent(
        screen.getByRole('dialog'),
        new Event('cancel', { cancelable: true }),
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(probe().attempts).toHaveLength(4)
    })

    it('needs the student to say yes explicitly', async () => {
      const user = userEvent.setup()
      const { probe } = renderStats(history)

      await user.click(resetButton())
      // Opening the dialog alone changes nothing.
      expect(probe().attempts).toHaveLength(4)
      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(probe().attempts).toHaveLength(0)
    })

    it('erases the practice history and statistics when confirmed', async () => {
      const user = userEvent.setup()
      const { probe } = renderStats(history)
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(probe().attempts).toEqual([])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('refreshes the page: the numbers give way to the empty state', async () => {
      const user = userEvent.setup()
      renderStats(history)
      expect(
        screen.getByRole('region', { name: 'Overall' }),
      ).toBeInTheDocument()
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(
        screen.queryByRole('region', { name: 'Overall' }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', { level: 2, name: 'No practice yet' }),
      ).toBeInTheDocument()
    })

    it('says that it worked, in a status message screen readers announce', async () => {
      const user = userEvent.setup()
      renderStats(history)
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(screen.getByRole('status')).toHaveTextContent(
        'Your practice history and statistics were erased.',
      )
    })

    it('erases what is saved too', async () => {
      const user = userEvent.setup()
      // As after an earlier visit: the history is already saved.
      const state = historyState(history)
      window.localStorage.setItem(
        STORAGE_KEYS.attempts,
        JSON.stringify(state.attempts),
      )
      window.localStorage.setItem(
        STORAGE_KEYS.sessions,
        JSON.stringify(state.sessions),
      )
      window.localStorage.setItem(
        STORAGE_KEYS.statistics,
        JSON.stringify(state.statistics),
      )
      renderApp('/statistics', { initialState: state })
      expect(stored(STORAGE_KEYS.attempts)).toHaveLength(4)
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(stored(STORAGE_KEYS.attempts)).toEqual([])
      expect(stored(STORAGE_KEYS.sessions)).toEqual([])
      expect(stored(STORAGE_KEYS.statistics)).toMatchObject({ attempted: 0 })
    })

    it('leaves the settings unchanged', async () => {
      const user = userEvent.setup()
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ cardAnimationEnabled: false, masteryThreshold: 7 }),
      )
      renderStats(history)
      await user.click(resetButton())

      await user.click(screen.getByRole('button', { name: 'Yes, Erase It' }))

      expect(stored(STORAGE_KEYS.settings)).toMatchObject({
        cardAnimationEnabled: false,
        masteryThreshold: 7,
      })
    })

    it('can be done again, and from the keyboard', async () => {
      const user = userEvent.setup()
      renderStats(history)

      resetButton().focus()
      await user.keyboard('{Enter}')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      await user.keyboard('{Tab}')
      screen.getByRole('button', { name: 'Yes, Erase It' }).focus()
      await user.keyboard('{Enter}')

      expect(
        screen.getByRole('heading', { level: 2, name: 'No practice yet' }),
      ).toBeInTheDocument()
    })
  })

  it('shows practice as it happens: answering a question updates the page', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/practice/setup')
    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('radio', { name: 'Level 1: Beginner' }))
    await user.click(screen.getByRole('radio', { name: 'Continuous practice' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))
    const choices = within(screen.getByRole('group')).getAllByRole('button')
    await user.click(choices[0])
    await user.click(screen.getByRole('button', { name: 'Flip Card' }))
    await user.click(screen.getByRole('button', { name: 'I Got It Wrong' }))

    await leaveTo(router, '/statistics', user)

    expect(overall('Questions attempted')).toBe('1')
    expect(overall('Incorrect')).toBe('1')
    expect(overall('Accuracy')).toBe('0%')
    // Leaving ended the session, so it is no longer in progress.
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
    expect(screen.queryByText('Not finished')).not.toBeInTheDocument()
  })

  it('shows a session brought back after a refresh as in progress', () => {
    renderApp('/statistics', {
      initialState: inProgressSessionState({}, { correct: 1 }),
    })

    expect(screen.getByText('In progress')).toBeInTheDocument()
  })
})

describe('StatisticsPage and mistakes', () => {
  const addition = (
    a: number,
    b: number,
    misses: number,
    lastDay: number,
    overrides = {},
  ) =>
    makeMistakePattern({
      operation: 'addition',
      firstOperand: a,
      secondOperand: b,
      correctAnswer: a + b,
      incorrectCount: misses,
      lastIncorrectAt: day(lastDay),
      ...overrides,
    })

  /** A page with some practice behind it, and these mistakes. */
  function renderWith(
    patterns: ReturnType<typeof addition>[],
    counts = { correct: 3, incorrect: 2, mistakeReview: 0 },
  ) {
    return renderApp('/statistics', {
      initialState: {
        ...finishedSessionState(
          { operations: ['addition'], difficulty: 2 },
          counts,
        ),
        mistakePatterns: patterns,
      },
    })
  }
  const section = () => screen.getByRole('region', { name: 'Mistake practice' })
  const tile = (label: string) =>
    within(section()).getByText(label, { selector: 'dt' }).nextElementSibling
      ?.textContent

  it('has a Mistake practice section, after the levels and before recent sessions', () => {
    renderWith([addition(1, 2, 1, 1)])

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings.indexOf('Mistake practice')).toBe(
      headings.indexOf('By difficulty') + 1,
    )
    expect(headings.indexOf('Recent sessions')).toBe(
      headings.indexOf('Mistake practice') + 1,
    )
  })

  it('shows the numbers of mistakes, and of similar questions practiced and answered correctly', () => {
    renderWith(
      [
        addition(1, 2, 2, 1),
        addition(3, 4, 1, 2),
        addition(5, 6, 1, 3, { mastered: true, similarCorrectCount: 3 }),
      ],
      { correct: 3, incorrect: 2, mistakeReview: 4 },
    )

    expect(tile('Mistakes to practice')).toBe('2')
    expect(tile('Mistakes mastered')).toBe('1')
    // Four of the five questions were review questions; the first three were right.
    expect(tile('Similar questions practiced')).toBe('4')
    expect(tile('Review questions answered correctly')).toBe('3')
  })

  it('says so when practice has gone well and there are no mistakes yet', () => {
    renderWith([], { correct: 5, incorrect: 0, mistakeReview: 0 })

    expect(
      within(section()).getByText(
        'No mistakes yet. Questions you get wrong will show up here.',
      ),
    ).toBeVisible()
    expect(tile('Mistakes to practice')).toBe('0')
  })

  it('lists the most missed operation and number facts, and the mistakes in detail', () => {
    renderWith([
      addition(1, 2, 6, 1),
      addition(3, 4, 2, 2),
      makeMistakePattern(), // 7 × 8, once
    ])

    expect(
      within(section()).getByRole('region', { name: 'Most missed' }),
    ).toHaveTextContent('Operation missed most: Addition (8 times)')
    const mistakes = within(
      within(section()).getByRole('region', { name: 'Your mistakes' }),
    ).getAllByRole('listitem')
    expect(mistakes).toHaveLength(3)
    expect(mistakes[0]).toHaveTextContent('1 + 2 = 3')
  })

  it('shows mastered mistakes in a separate, closed section', () => {
    renderWith([
      addition(1, 2, 3, 1),
      addition(5, 6, 2, 2, { mastered: true, similarCorrectCount: 3 }),
    ])

    const summary = within(section()).getByText('Mastered mistakes (1)')
    expect(summary.closest('details')).not.toHaveAttribute('open')
  })

  it('shows progress against the number of answers set on the settings page', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ masteryThreshold: 5 }),
    )
    renderWith([addition(1, 2, 3, 1, { similarCorrectCount: 2 })])

    expect(within(section()).getByText(/2 of 5/)).toBeVisible()
  })

  it('shows a mistake-review session in the recent sessions as mistake practice', () => {
    const state = finishedSessionState({}, { correct: 2, incorrect: 1 })
    renderApp('/statistics', {
      initialState: {
        ...state,
        sessions: [
          ...state.sessions,
          makeSession({
            id: 'review',
            startedAt: day(20),
            mode: 'mistake-review',
            completedAt: day(20),
          }),
        ],
      },
    })

    const recent = screen.getByRole('region', { name: 'Recent sessions' })
    expect(within(recent).getAllByText('Mistake practice')).toHaveLength(1)
  })

  describe('as the student practices', () => {
    async function answer(
      user: ReturnType<typeof userEvent.setup>,
      report: 'right' | 'wrong',
    ) {
      const choices = within(screen.getByRole('group')).getAllByRole('button')
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))
      await user.click(
        screen.getByRole('button', {
          name: report === 'right' ? 'I Got It Right' : 'I Got It Wrong',
        }),
      )
    }

    it('counts a correct review answer, and moves the mistake’s progress', async () => {
      const user = userEvent.setup()
      const source = addition(12, 15, 2, 1)
      const { router, probe } = renderApp('/practice/session', {
        initialState: reviewSessionState([source, addition(21, 9, 1, 1)]),
      })
      const from = probe().currentQuestion!.mistakePatternId

      await answer(user, 'right')
      await leaveTo(router, '/statistics', user)

      expect(tile('Similar questions practiced')).toBe('1')
      expect(tile('Review questions answered correctly')).toBe('1')
      const item = within(
        within(section()).getByRole('region', { name: 'Your mistakes' }),
      )
        .getAllByRole('listitem')
        .find((li) =>
          li.textContent?.includes(from!.split(':').slice(1, 3).join(' + ')),
        )
      expect(item).toHaveTextContent('1 of 3')
    })

    it('counts a wrong review answer as practiced but not as correct, and the missed question joins the mistakes', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/practice/session', {
        initialState: reviewSessionState([
          addition(12, 15, 2, 1),
          addition(21, 9, 1, 1),
        ]),
      })

      await answer(user, 'wrong')
      await leaveTo(router, '/statistics', user)

      expect(tile('Similar questions practiced')).toBe('1')
      expect(tile('Review questions answered correctly')).toBe('0')
      expect(tile('Mistakes to practice')).toBe('3')
    })

    it('moves a mistake to the mastered section once it is mastered', async () => {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ masteryThreshold: 1 }),
      )
      const user = userEvent.setup()
      const { router } = renderApp('/practice/session', {
        initialState: reviewSessionState([
          addition(12, 15, 2, 1),
          addition(21, 9, 1, 1),
        ]),
      })

      await answer(user, 'right')
      await leaveTo(router, '/statistics', user)

      expect(tile('Mistakes to practice')).toBe('1')
      expect(tile('Mistakes mastered')).toBe('1')
      expect(within(section()).getByText('Mastered mistakes (1)')).toBeVisible()
    })

    it('erases the mistakes along with the rest when statistics are reset', async () => {
      const user = userEvent.setup()
      const { probe } = renderWith([addition(1, 2, 3, 1)])
      expect(probe().mistakePatterns).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Reset Statistics' }))
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Yes, Erase It',
        }),
      )

      expect(probe().mistakePatterns).toEqual([])
      expect(
        screen.queryByRole('region', { name: 'Mistake practice' }),
      ).not.toBeInTheDocument()
      expect(screen.getByText('No practice yet')).toBeVisible()
    })
  })
})
