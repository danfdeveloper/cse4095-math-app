import { DIFFICULTY_INFO } from '../constants/practice'
import type { DifficultyLevel } from '../types/question'

const listFormat = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** "Addition, Subtraction, and Division": a list read the way a person would say it. */
export function formatList(items: readonly string[]): string {
  return listFormat.format(items)
}

/** "Level 2: Easy". */
export function formatDifficulty(level: DifficultyLevel): string {
  return `Level ${level}: ${DIFFICULTY_INFO[level].label}`
}

/** A date and time for a saved timestamp, such as "Mar 4, 2026, 10:30 AM". */
export function formatSessionDate(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dateFormat.format(date)
}
