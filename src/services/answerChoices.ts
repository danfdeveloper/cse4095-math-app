import { MIN_ANSWER_VALUE } from '../constants/difficultyRules'
import { CHOICES_PER_QUESTION } from '../constants/practice'
import type { Question } from '../types/question'
import { randomInt, type RandomSource } from '../utils/math'
import { shuffle } from '../utils/shuffle'

/** What is needed to make answer choices; a full Question is not required. */
export type AnswerContext = Pick<
  Question,
  'operation' | 'firstOperand' | 'secondOperand' | 'correctAnswer'
>

const DISTRACTOR_COUNT = CHOICES_PER_QUESTION - 1

/** Random "nearby number" draws allowed before switching to the ordered search. */
export const MAX_NEARBY_ATTEMPTS = 40

/** How far the ordered search may look. Only 3 values are ever needed. */
const FALLBACK_SEARCH_LIMIT = 1000

/**
 * How far a wrong answer may be from the right one and still look believable:
 * within 20, or within half the answer for big answers. The floor of 20 is
 * deliberate: forgetting to borrow can land up to 18 away from a small
 * answer (50 - 19 is 31, but the mistake gives 49).
 */
export function plausibleDistance(correctAnswer: number): number {
  return Math.max(20, Math.ceil(Math.abs(correctAnswer) * 0.5))
}

/**
 * The "forgot to carry" mistake: adds each column on its own and drops the
 * carry into the next one. The leftmost column is written out in full, so
 * 58 + 67 gives 115 rather than 125.
 */
export function addWithoutCarrying(a: number, b: number): number {
  let result = 0
  let place = 1
  while (a >= 10 || b >= 10) {
    result += (((a % 10) + (b % 10)) % 10) * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return result + (a + b) * place
}

/**
 * The "forgot to borrow" mistake: in each column, takes the smaller digit from
 * the larger, so 52 - 38 gives 26 rather than 14.
 */
export function subtractWithoutBorrowing(a: number, b: number): number {
  let result = 0
  let place = 1
  while (a > 0 || b > 0) {
    result += Math.abs((a % 10) - (b % 10)) * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return result
}

/*
 * Mistake candidates. Each list holds wrong answers a child could plausibly
 * land on; it may contain duplicates, fractions or negatives, which are
 * filtered out when the three distractors are chosen.
 */

export function additionMistakes(a: number, b: number): number[] {
  const sum = a + b
  return [
    sum + 1,
    sum - 1,
    sum + 2,
    sum - 2,
    sum + 10, // carried one too many times
    sum - 10, // forgot a carry
    addWithoutCarrying(a, b),
    Math.abs(a - b), // subtracted instead
  ]
}

export function subtractionMistakes(a: number, b: number): number[] {
  const difference = a - b
  return [
    difference + 1,
    difference - 1,
    difference + 2,
    difference - 2,
    difference + 10, // forgot to borrow
    difference - 10, // borrowed one too many times
    subtractWithoutBorrowing(a, b),
    a + b, // added instead
  ]
}

export function multiplicationMistakes(a: number, b: number): number[] {
  const product = a * b
  return [
    // The neighbouring facts in the times table.
    (a - 1) * b,
    (a + 1) * b,
    a * (b - 1),
    a * (b + 1),
    a + b, // added instead
    product + 1,
    product - 1,
    product + 10,
    product - 10,
  ]
}

export function divisionMistakes(dividend: number, divisor: number): number[] {
  const quotient = dividend / divisor
  return [
    quotient + 1,
    quotient - 1,
    quotient + 2,
    quotient - 2,
    divisor, // the other number in the fact family
    dividend / (divisor - 1), // the neighbouring division fact, when it comes out even
    dividend / (divisor + 1),
  ]
}

function mistakesFor({
  operation,
  firstOperand,
  secondOperand,
}: AnswerContext): number[] {
  switch (operation) {
    case 'addition':
      return additionMistakes(firstOperand, secondOperand)
    case 'subtraction':
      return subtractionMistakes(firstOperand, secondOperand)
    case 'multiplication':
      return multiplicationMistakes(firstOperand, secondOperand)
    case 'division':
      return divisionMistakes(firstOperand, secondOperand)
    default:
      throw new Error(`Unsupported operation: ${String(operation)}`)
  }
}

/**
 * Picks three wrong answers that are unique, differ from the right answer,
 * are whole numbers, are never negative, and sit close enough to it to be
 * believable.
 *
 * Sources, in order: the operation's common mistakes (chosen at random), then
 * random numbers near the answer (a limited number of tries), then an ordered
 * search outward from the answer. The last step always finds enough values,
 * so this cannot loop forever whatever the random source returns.
 */
export function generateDistractors(
  context: AnswerContext,
  random: RandomSource = Math.random,
): number[] {
  const { correctAnswer } = context
  const maxDistance = plausibleDistance(correctAnswer)
  const chosen: number[] = []

  const add = (candidate: number) => {
    if (
      chosen.length < DISTRACTOR_COUNT &&
      Number.isInteger(candidate) &&
      candidate >= MIN_ANSWER_VALUE &&
      candidate !== correctAnswer &&
      Math.abs(candidate - correctAnswer) <= maxDistance &&
      !chosen.includes(candidate)
    ) {
      chosen.push(candidate)
    }
  }

  for (const mistake of shuffle([...new Set(mistakesFor(context))], random)) {
    add(mistake)
  }

  const maxOffset = Math.min(
    20,
    Math.max(3, Math.ceil(Math.abs(correctAnswer) * 0.2)),
  )
  for (
    let attempt = 0;
    attempt < MAX_NEARBY_ATTEMPTS && chosen.length < DISTRACTOR_COUNT;
    attempt++
  ) {
    const offset = randomInt(1, maxOffset, random)
    add(random() < 0.5 ? correctAnswer + offset : correctAnswer - offset)
  }

  for (
    let distance = 1;
    chosen.length < DISTRACTOR_COUNT && distance <= FALLBACK_SEARCH_LIMIT;
    distance++
  ) {
    add(correctAnswer + distance)
    add(correctAnswer - distance)
  }

  if (chosen.length < DISTRACTOR_COUNT) {
    throw new Error(
      `Could not find ${DISTRACTOR_COUNT} wrong answers near ${correctAnswer}`,
    )
  }
  return chosen
}

/** The four answer choices in random order: the right answer plus three distractors. */
export function buildChoices(
  context: AnswerContext,
  random: RandomSource = Math.random,
): number[] {
  const distractors = generateDistractors(context, random)
  return shuffle([context.correctAnswer, ...distractors], random)
}
