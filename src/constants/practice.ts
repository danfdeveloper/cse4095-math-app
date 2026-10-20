import type { DifficultyLevel, MathOperation } from '../types/question'
import type { SessionLength } from '../types/session'

export const MATH_OPERATIONS: readonly MathOperation[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
]

export const OPERATION_INFO: Record<
  MathOperation,
  { label: string; symbol: string }
> = {
  addition: { label: 'Addition', symbol: '+' },
  subtraction: { label: 'Subtraction', symbol: '−' },
  multiplication: { label: 'Multiplication', symbol: '×' },
  division: { label: 'Division', symbol: '÷' },
}

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4]

// Descriptions summarize the level rules in specification section 7.
export const DIFFICULTY_INFO: Record<
  DifficultyLevel,
  { label: string; description: string }
> = {
  1: {
    label: 'Beginner',
    description: 'Small numbers up to 10. Times tables up to 5.',
  },
  2: {
    label: 'Easy',
    description: 'Numbers up to 50. Times tables up to 10.',
  },
  3: {
    label: 'Intermediate',
    description: 'Numbers up to 100, with carrying and borrowing.',
  },
  4: {
    label: 'Advanced',
    description: 'Numbers up to 1,000 and bigger multiplication and division.',
  },
}

export const SESSION_LENGTH_OPTIONS: readonly SessionLength[] = [
  5,
  10,
  20,
  'continuous',
]

export const DEFAULT_SESSION_LENGTH: SessionLength = 10

/** Each question has one correct answer and three incorrect ones (spec section 8.2). */
export const CHOICES_PER_QUESTION = 4

export function describeSessionLength(length: SessionLength): string {
  return length === 'continuous' ? 'Continuous practice' : `${length} questions`
}
