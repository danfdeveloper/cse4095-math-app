import { describe, expect, it } from 'vitest'
import {
  formatDay,
  formatDifficulty,
  formatFact,
  formatList,
  formatSessionDate,
} from './format'

describe('formatList', () => {
  it.each([
    [[], ''],
    [['Addition'], 'Addition'],
    [['Addition', 'Division'], 'Addition and Division'],
    [
      ['Addition', 'Subtraction', 'Division'],
      'Addition, Subtraction, and Division',
    ],
    [
      ['Addition', 'Subtraction', 'Multiplication', 'Division'],
      'Addition, Subtraction, Multiplication, and Division',
    ],
  ])('formats %j as "%s"', (items, expected) => {
    expect(formatList(items)).toBe(expected)
  })
})

describe('formatDifficulty', () => {
  it.each([
    [1, 'Level 1: Beginner'],
    [2, 'Level 2: Easy'],
    [3, 'Level 3: Intermediate'],
    [4, 'Level 4: Advanced'],
  ] as const)('formats level %i as "%s"', (level, expected) => {
    expect(formatDifficulty(level)).toBe(expected)
  })
})

describe('formatSessionDate', () => {
  it('gives a readable date and time', () => {
    // Midday UTC is the 15th, or early on the 16th, depending on the time zone.
    const text = formatSessionDate('2026-03-15T12:00:00.000Z')

    expect(text).toMatch(/Mar 1[56], 2026/)
    expect(text).toMatch(/\d{1,2}:\d{2}/)
  })

  it('includes the year and month so different sessions are told apart', () => {
    expect(formatSessionDate('2025-12-20T12:00:00.000Z')).toMatch(
      /Dec 2[01], 2025/,
    )
  })

  it('says so, instead of throwing, for a date it cannot read', () => {
    expect(formatSessionDate('not a date')).toBe('Unknown date')
    expect(formatSessionDate('')).toBe('Unknown date')
  })
})

describe('formatFact', () => {
  it.each([
    ['addition', 6, 7, 13, '6 + 7 = 13'],
    ['subtraction', 15, 7, 8, '15 − 7 = 8'],
    ['multiplication', 7, 8, 56, '7 × 8 = 56'],
    ['division', 56, 7, 8, '56 ÷ 7 = 8'],
  ] as const)(
    'writes %s with its symbol and answer',
    (op, a, b, answer, text) => {
      expect(formatFact(op, a, b, answer)).toBe(text)
    },
  )
})

describe('formatDay', () => {
  it('gives a readable date without the time', () => {
    const text = formatDay('2026-03-15T12:00:00.000Z')

    expect(text).toMatch(/^Mar 1[56], 2026$/)
  })

  it('says so, instead of throwing, for a date it cannot read', () => {
    expect(formatDay('not a date')).toBe('Unknown date')
    expect(formatDay('')).toBe('Unknown date')
  })
})
