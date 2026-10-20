import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../services/storageService'
import { historyState } from '../test/fixtures'
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

    it('has headed sections in order: overall, by operation, by difficulty, recent sessions', () => {
      renderStats(twoSessions)

      expect(
        screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
      ).toEqual(['Overall', 'By operation', 'By difficulty', 'Recent sessions'])
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

    it('says the settings will stay the same', () => {
      renderStats(history)

      expect(
        screen.getByText('Your settings will stay the same.'),
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

    await act(() => router.navigate('/statistics'))

    expect(overall('Questions attempted')).toBe('1')
    expect(overall('Incorrect')).toBe('1')
    expect(overall('Accuracy')).toBe('0%')
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })
})
