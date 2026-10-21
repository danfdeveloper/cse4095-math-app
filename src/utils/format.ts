import { DIFFICULTY_INFO, OPERATION_INFO } from '../constants/practice'
import type { DifficultyLevel, MathOperation } from '../types/question'

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

const dayFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

/** A whole number fact with its answer: "7 × 8 = 56". */
export function formatFact(
  operation: MathOperation,
  firstOperand: number,
  secondOperand: number,
  correctAnswer: number,
): string {
  return `${firstOperand} ${OPERATION_INFO[operation].symbol} ${secondOperand} = ${correctAnswer}`
}

/** A date, without the time, for a saved timestamp, such as "Mar 4, 2026". */
export function formatDay(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dayFormat.format(date)
}

/** A date and time for a saved timestamp, such as "Mar 4, 2026, 10:30 AM". */
export function formatSessionDate(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dateFormat.format(date)
}
