import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { recentSessionRows } from '../../services/statisticsService'
import { makeSession } from '../../test/fixtures'
import { formatSessionDate } from '../../utils/format'
import { RecentSessions } from './RecentSessions'

const rows = (...sessions: Parameters<typeof makeSession>[0][]) =>
  recentSessionRows(sessions.map((s) => makeSession(s)))
const valueIn = (item: HTMLElement, label: string) =>
  within(item).getByText(label, { selector: 'dt' }).nextElementSibling
    ?.textContent

describe('RecentSessions', () => {
  it('says so when there are no sessions', () => {
    render(<RecentSessions sessions={[]} />)

    expect(
      screen.getByText('No recent sessions to show yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists each session as an item of an ordered list', () => {
    render(
      <RecentSessions
        sessions={rows(
          { id: 'a', startedAt: '2026-03-01T12:00:00.000Z' },
          { id: 'b', startedAt: '2026-03-02T12:00:00.000Z' },
        )}
      />,
    )

    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows the sessions in the order given, which is newest first', () => {
    render(
      <RecentSessions
        sessions={rows(
          { id: 'old', startedAt: '2026-03-01T12:00:00.000Z' },
          { id: 'new', startedAt: '2026-03-09T12:00:00.000Z' },
        )}
      />,
    )

    const dates = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('time')?.textContent)
    expect(dates).toEqual([
      formatSessionDate('2026-03-09T12:00:00.000Z'),
      formatSessionDate('2026-03-01T12:00:00.000Z'),
    ])
  })

  it('shows the date, with the exact time in the markup for machines', () => {
    render(
      <RecentSessions
        sessions={rows({ startedAt: '2026-03-04T10:30:00.000Z' })}
      />,
    )

    const time = screen.getByRole('listitem').querySelector('time')!
    expect(time).toHaveTextContent(
      formatSessionDate('2026-03-04T10:30:00.000Z'),
    )
    expect(time).toHaveAttribute('dateTime', '2026-03-04T10:30:00.000Z')
  })

  it('shows operations, difficulty, and every count', () => {
    render(
      <RecentSessions
        sessions={rows({
          operations: ['addition', 'division'],
          difficulty: 3,
          attempted: 10,
          correct: 7,
          incorrect: 3,
          completedAt: '2026-03-04T10:09:00.000Z',
        })}
      />,
    )
    const item = screen.getByRole('listitem')

    expect(valueIn(item, 'Operations')).toBe('Addition and Division')
    expect(valueIn(item, 'Difficulty')).toBe('Level 3: Intermediate')
    expect(valueIn(item, 'Questions attempted')).toBe('10')
    expect(valueIn(item, 'Correct')).toBe('7')
    expect(valueIn(item, 'Incorrect')).toBe('3')
    expect(valueIn(item, 'Accuracy')).toBe('70%')
  })

  it('has no label for a session that finished', () => {
    render(
      <RecentSessions
        sessions={rows({ completedAt: '2026-03-04T10:09:00.000Z' })}
      />,
    )

    expect(screen.queryByText('Not finished')).not.toBeInTheDocument()
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
  })

  it('labels a session that never finished, in words', () => {
    render(<RecentSessions sessions={rows({})} />)

    expect(screen.getByText('Not finished')).toBeInTheDocument()
  })

  it('labels the session being practiced right now', () => {
    render(
      <RecentSessions
        sessions={recentSessionRows([makeSession({ id: 'live' })], 'live')}
      />,
    )

    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.queryByText('Not finished')).not.toBeInTheDocument()
  })

  describe('the tag for practice on mistakes', () => {
    it('is shown for a mistake-review session, in words', () => {
      render(
        <RecentSessions sessions={rows({ id: 'a', mode: 'mistake-review' })} />,
      )

      expect(screen.getByText('Mistake practice')).toBeVisible()
    })

    it('is not shown for regular practice, or for sessions saved before review mode', () => {
      render(
        <RecentSessions
          sessions={rows(
            { id: 'a', startedAt: '2026-03-01T12:00:00.000Z', mode: 'regular' },
            { id: 'b', startedAt: '2026-03-02T12:00:00.000Z' },
          )}
        />,
      )

      expect(screen.queryByText('Mistake practice')).not.toBeInTheDocument()
    })

    it('can sit beside the tag for a session that was not finished', () => {
      render(
        <RecentSessions sessions={rows({ id: 'a', mode: 'mistake-review' })} />,
      )

      expect(screen.getByText('Mistake practice')).toBeVisible()
      expect(screen.getByText('Not finished')).toBeVisible()
    })
  })
})
