import type { DifficultyLevel, MathOperation } from '../types/question'

/**
 * The colours of the rainbow theme. An accent only decorates: every card, tile
 * and choice that has one also says what it is in words and symbols, so the
 * colour is never the only thing that carries a meaning.
 *
 * Each accent has a deep, a bright and a soft shade (see index.css). The deep
 * shade is for anything that must be seen clearly, such as text and the check
 * marks in filled controls. The bright shade is for stripes and borders. The
 * soft shade is for backgrounds that dark text sits on.
 */
export type Accent =
  'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink'

/**
 * Red is left out on purpose. It is in the rainbow stripe, which only
 * decorates, but no card, tile or choice is red, so red never looks like a
 * verdict on an answer.
 */
export const ACCENTS: readonly Accent[] = [
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
]

export const OPERATION_ACCENT: Record<MathOperation, Accent> = {
  addition: 'green',
  subtraction: 'orange',
  multiplication: 'purple',
  division: 'blue',
}

export const DIFFICULTY_ACCENT: Record<DifficultyLevel, Accent> = {
  1: 'teal',
  2: 'yellow',
  3: 'pink',
  4: 'indigo',
}

/**
 * One for each answer choice, by position. They are bright and friendly but
 * carry no meaning: none is green or red, so no choice looks right or wrong
 * before the card is turned over.
 */
export const ANSWER_ACCENTS: readonly Accent[] = [
  'blue',
  'purple',
  'pink',
  'teal',
]

/** The accent for a position, going round if there are more positions than accents. */
export function answerAccent(position: number): Accent {
  return ANSWER_ACCENTS[position % ANSWER_ACCENTS.length]
}
