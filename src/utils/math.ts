import type { MathOperation } from '../types/question'

/** A source of random numbers in [0, 1), like Math.random. Injectable for tests. */
export type RandomSource = () => number

/** An inclusive range of whole numbers. */
export interface NumberRange {
  min: number
  max: number
}

/** Returns a random whole number from min to max, including both ends. */
export function randomInt(
  min: number,
  max: number,
  random: RandomSource = Math.random,
): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError(`randomInt needs whole numbers, got ${min} and ${max}`)
  }
  if (min > max) {
    throw new RangeError(`randomInt needs min <= max, got ${min} > ${max}`)
  }
  return Math.floor(random() * (max - min + 1)) + min
}

export function isInRange(value: number, range: NumberRange): boolean {
  return value >= range.min && value <= range.max
}

/**
 * The exact result of `first <operation> second`. Division can return a
 * fraction (or Infinity for a zero divisor), so callers that need a whole
 * number must check for one.
 */
export function calculateAnswer(
  operation: MathOperation,
  first: number,
  second: number,
): number {
  switch (operation) {
    case 'addition':
      return first + second
    case 'subtraction':
      return first - second
    case 'multiplication':
      return first * second
    case 'division':
      return first / second
    default:
      throw new Error(`Unsupported operation: ${String(operation)}`)
  }
}
