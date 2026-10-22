import { statisticsFromAttempts } from '../../services/statisticsService'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  buildMistakeStatistics,
  splitMistakes,
} from '../../services/mistakeStatistics'
import { OPERATION_ACCENT } from '../../constants/accents'
import { makeAttempt, makeMistakePattern } from '../../test/fixtures'
import type { MistakePattern } from '../../types/mistake'
import { formatDay } from '../../utils/format'
import { MistakePractice } from './MistakePractice'

const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}T10:00:00.000Z`

function mistake(
  operation: MistakePattern['operation'],
  a: number,
  b: number,
  incorrectCount: number,
  lastDay: number,
  overrides: Partial<MistakePattern> = {},
) {
  const answer = {
    addition: a + b,
    subtraction: a - b,
    multiplication: a * b,
    division: a / b,
  }[operation]
  return makeMistakePattern({
    operation,
    firstOperand: a,
    secondOperand: b,
    correctAnswer: answer,
    incorrectCount,
    lastIncorrectAt: day(lastDay),
    ...overrides,
  })
}

function renderPractice(
  patterns: MistakePattern[],
  attempts: ReturnType<typeof makeAttempt>[] = [],
  masteryThreshold = 3,
) {
  const { active, mastered } = splitMistakes(patterns)
  return render(
    <MistakePractice
      summary={buildMistakeStatistics(
        patterns,
        statisticsFromAttempts(attempts),
      )}
      active={active}
      mastered={mastered}
      masteryThreshold={masteryThreshold}
      hasMistakes={patterns.length > 0}
    />,
  )
}

const tile = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

describe('MistakePractice', () => {
  describe('the totals (Task 63)', () => {
    it('shows the mistakes to practice and the mastered ones', () => {
      renderPractice([
        mistake('addition', 1, 2, 1, 1),
        mistake('addition', 3, 4, 1, 1),
        mistake('addition', 5, 6, 1, 1, {
          mastered: true,
          similarCorrectCount: 3,
        }),
      ])

      expect(tile('Mistakes to practice')).toBe('2')
      expect(tile('Mistakes mastered')).toBe('1')
    })

    it('shows how many similar questions were practiced and how many were right', () => {
      renderPractice(
        [mistake('addition', 1, 2, 1, 1)],
        [
          makeAttempt({
            id: 'a',
            source: 'mistake-review',
            selfReportedCorrect: true,
          }),
          makeAttempt({
            id: 'b',
            source: 'mistake-review',
            selfReportedCorrect: false,
          }),
          makeAttempt({
            id: 'c',
            source: 'mistake-review',
            selfReportedCorrect: true,
          }),
          makeAttempt({
            id: 'd',
            source: 'regular',
            selfReportedCorrect: true,
          }),
        ],
      )

      expect(tile('Similar questions practiced')).toBe('3')
      expect(tile('Review questions answered correctly')).toBe('2')
    })

    it('shows zeros, not blanks, before any practice of mistakes', () => {
      renderPractice([mistake('addition', 1, 2, 1, 1)])

      expect(tile('Similar questions practiced')).toBe('0')
      expect(tile('Review questions answered correctly')).toBe('0')
    })
  })

  describe('with no mistakes (Task 64)', () => {
    it('says so, in a friendly way, and shows no lists', () => {
      renderPractice([])

      expect(
        screen.getByText(
          'No mistakes yet. Questions you get wrong will show up here.',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'Most missed' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Your mistakes' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('still shows the totals, as zeros', () => {
      renderPractice([])

      expect(tile('Mistakes to practice')).toBe('0')
      expect(tile('Mistakes mastered')).toBe('0')
    })
  })

  describe('most missed (Task 64)', () => {
    it('names the operation missed most, and how many times', () => {
      renderPractice([
        mistake('division', 56, 7, 4, 1),
        mistake('division', 36, 6, 3, 1),
        mistake('addition', 1, 2, 2, 1),
      ])

      const section = screen.getByRole('region', { name: 'Most missed' })
      expect(section).toHaveTextContent(
        'Operation missed most: Division (7 times)',
      )
    })

    it('says "once" for a single miss', () => {
      renderPractice([mistake('addition', 1, 2, 1, 1)])

      expect(
        screen.getByRole('region', { name: 'Most missed' }),
      ).toHaveTextContent('Operation missed most: Addition (once)')
    })

    it('names every operation tied for most', () => {
      renderPractice([
        mistake('addition', 1, 2, 3, 1),
        mistake('multiplication', 7, 8, 3, 1),
        mistake('division', 56, 7, 1, 1),
      ])

      expect(
        screen.getByRole('region', { name: 'Most missed' }),
      ).toHaveTextContent(
        'Operation missed most: Addition and Multiplication, tied (3 times each)',
      )
    })

    it('lists the number facts missed most, most missed first, with how often', () => {
      renderPractice([
        mistake('multiplication', 7, 8, 2, 4),
        mistake('division', 56, 7, 5, 1),
        mistake('addition', 6, 7, 1, 2),
      ])

      const facts = within(
        screen.getByRole('list', { name: 'Number facts missed most' }),
      ).getAllByRole('listitem')
      expect(facts.map((f) => f.textContent)).toEqual([
        '56 ÷ 7 = 8Missed 5 times',
        '7 × 8 = 56Missed 2 times',
        '6 + 7 = 13Missed once',
      ])
    })

    it('lists at most five facts', () => {
      renderPractice(
        Array.from({ length: 8 }, (_, i) =>
          mistake('addition', i, 1, 10 - i, 1),
        ),
      )

      expect(
        within(
          screen.getByRole('list', { name: 'Number facts missed most' }),
        ).getAllByRole('listitem'),
      ).toHaveLength(5)
    })

    it('counts a fact missed at two levels once, with both added up', () => {
      renderPractice([
        mistake('multiplication', 7, 8, 2, 1, { difficulty: 2 }),
        mistake('multiplication', 7, 8, 3, 1, { difficulty: 3 }),
      ])

      const facts = within(
        screen.getByRole('list', { name: 'Number facts missed most' }),
      ).getAllByRole('listitem')
      expect(facts).toHaveLength(1)
      expect(facts[0]).toHaveTextContent('Missed 5 times')
    })
  })

  describe('the mistakes in detail (Task 65)', () => {
    it('lists the mistakes to practice, most missed first', () => {
      renderPractice([
        mistake('multiplication', 7, 8, 2, 4),
        mistake('division', 56, 7, 5, 1),
        mistake('addition', 6, 7, 3, 2),
      ])

      const section = screen.getByRole('region', { name: 'Your mistakes' })
      const items = within(section).getAllByRole('listitem')
      expect(
        items.map((item) => within(item).getByText(/=/).textContent),
      ).toEqual(['56 ÷ 7 = 8', '6 + 7 = 13', '7 × 8 = 56'])
    })

    it('shows, for each, its level, how often it was missed, its progress and when it was last missed', () => {
      renderPractice([
        mistake('multiplication', 7, 8, 4, 9, {
          difficulty: 3,
          similarCorrectCount: 1,
        }),
      ])

      const item = within(
        screen.getByRole('region', { name: 'Your mistakes' }),
      ).getAllByRole('listitem')[0]
      const value = (label: string) =>
        within(item).getByText(label, { selector: 'dt' }).nextElementSibling

      expect(value('Level')).toHaveTextContent('Level 3: Intermediate')
      expect(value('Times missed')).toHaveTextContent('4')
      expect(value('Review progress')).toHaveTextContent('1 of 3')
      expect(value('Last missed')).toHaveTextContent(formatDay(day(9)))
      expect(value('Last missed')?.querySelector('time')).toHaveAttribute(
        'datetime',
        day(9),
      )
    })

    it('shows the progress against the setting for how many answers master a mistake', () => {
      renderPractice(
        [mistake('addition', 1, 2, 2, 1, { similarCorrectCount: 2 })],
        [],
        5,
      )

      expect(screen.getByText(/2 of 5/)).toBeVisible()
    })

    it('does not show more progress than the setting asks for, if it was lowered since', () => {
      renderPractice(
        [mistake('addition', 1, 2, 2, 1, { similarCorrectCount: 4 })],
        [],
        2,
      )

      expect(screen.getByText(/2 of 2/)).toBeVisible()
      expect(screen.queryByText(/4 of 2/)).not.toBeInTheDocument()
    })

    it('shows no progress as 0 of the setting', () => {
      renderPractice([mistake('addition', 1, 2, 2, 1)])

      expect(screen.getByText(/0 of 3/)).toBeVisible()
    })

    it('draws the progress as well as saying it, and the drawing is only decoration', () => {
      const { container } = renderPractice([
        mistake('addition', 1, 2, 2, 1, { similarCorrectCount: 1 }),
      ])

      const bar = container.querySelector('[aria-hidden="true"]')!
      expect(bar).toBeInTheDocument()
      expect((bar.firstElementChild as HTMLElement).style.width).toMatch(
        /^33\.3+%$/,
      )
    })

    it('says there is nothing to practice when every mistake is mastered, and still lists them', () => {
      renderPractice([
        mistake('addition', 1, 2, 2, 1, {
          mastered: true,
          similarCorrectCount: 3,
        }),
      ])

      expect(
        screen.getByText(
          'You have no mistakes to practice right now. Great work!',
        ),
      ).toBeVisible()
      expect(screen.getByText('Mastered mistakes (1)')).toBeVisible()
    })

    describe('the mastered ones, viewed separately', () => {
      const patterns = [
        mistake('multiplication', 7, 8, 3, 2),
        mistake('addition', 5, 5, 6, 3, {
          mastered: true,
          similarCorrectCount: 3,
        }),
        mistake('addition', 4, 4, 2, 1, {
          mastered: true,
          similarCorrectCount: 3,
        }),
      ]

      it('are in a section of their own, with a count, closed to begin with', () => {
        renderPractice(patterns)

        const summary = screen.getByText('Mastered mistakes (2)')
        expect(summary.closest('details')).not.toHaveAttribute('open')
      })

      it('are not among the mistakes to practice', () => {
        renderPractice(patterns)

        // The first list in the section; the mastered ones are in the disclosure after it.
        const section = screen.getByRole('region', { name: 'Your mistakes' })
        const [active] = within(section).getAllByRole('list')
        expect(active).toHaveTextContent('7 × 8 = 56')
        expect(active).not.toHaveTextContent('5 + 5 = 10')
        expect(active).not.toHaveTextContent('4 + 4 = 8')
      })

      it('open to show them, most missed first, marked as mastered', async () => {
        const user = userEvent.setup()
        renderPractice(patterns)

        await user.click(screen.getByText('Mastered mistakes (2)'))

        const details = screen
          .getByText('Mastered mistakes (2)')
          .closest('details')!
        expect(details).toHaveAttribute('open')
        const items = within(details).getAllByRole('listitem')
        expect(
          items.map((li) => within(li).getByText(/=/).textContent),
        ).toEqual(['5 + 5 = 10', '4 + 4 = 8'])
        for (const item of items) {
          expect(within(item).getByText('Mastered')).toBeVisible()
        }
      })

      it('close again', async () => {
        const user = userEvent.setup()
        renderPractice(patterns)
        const summary = screen.getByText('Mastered mistakes (2)')

        await user.click(summary)
        await user.click(summary)

        expect(summary.closest('details')).not.toHaveAttribute('open')
      })

      it('can be reached with Tab', async () => {
        const user = userEvent.setup()
        renderPractice(patterns)

        await user.tab()

        // Opening it with Enter or Space is the browser's own behavior, checked in a real browser.
        expect(screen.getByText('Mastered mistakes (2)')).toHaveFocus()
      })

      it('are not offered when there are none, and the page says so', () => {
        renderPractice([mistake('multiplication', 7, 8, 3, 2)])

        expect(
          screen.queryByText(/Mastered mistakes \(/),
        ).not.toBeInTheDocument()
        expect(
          screen.getByText(
            'Mistakes you master will be kept here, out of the way.',
          ),
        ).toBeVisible()
      })
    })
  })

  it('has a heading for each part', () => {
    renderPractice([mistake('addition', 1, 2, 1, 1)])

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Most missed', 'Your mistakes'])
  })
})

describe('MistakePractice and its colours', () => {
  it('colours each mistake and fact by its operation, which its text also names', () => {
    renderPractice([
      mistake('addition', 1, 2, 4, 1),
      mistake('division', 56, 7, 3, 1),
    ])

    const facts = within(
      screen.getByRole('list', { name: 'Number facts missed most' }),
    ).getAllByRole('listitem')
    expect(facts[0]).toHaveAttribute('data-accent', OPERATION_ACCENT.addition)
    expect(facts[1]).toHaveAttribute('data-accent', OPERATION_ACCENT.division)
    const items = within(
      screen.getByRole('region', { name: 'Your mistakes' }),
    ).getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('data-accent', OPERATION_ACCENT.addition)
    expect(items[1]).toHaveAttribute('data-accent', OPERATION_ACCENT.division)
  })

  it('colours its four numbers, never in red', () => {
    renderPractice([mistake('addition', 1, 2, 1, 1)])

    const colours = [
      'Mistakes to practice',
      'Mistakes mastered',
      'Similar questions practiced',
      'Review questions answered correctly',
    ].map(
      (label) =>
        tile(label) &&
        screen
          .getByText(label, { selector: 'dt' })
          .parentElement?.getAttribute('data-accent'),
    )
    expect(new Set(colours).size).toBe(4)
    expect(colours).not.toContain('red')
  })
})
