import type { MistakePattern } from '../types/mistake'
import type { Question } from '../types/question'
import { randomInt, type RandomSource } from '../utils/math'
import { isDifficultyLevel, isWithinDifficultyRules } from '../utils/validation'
import { buildQuestion, generateQuestion } from './questionGenerator'

/**
 * Similar questions for a mistake pattern (specification section 6.4). There
 * are three kinds, called strategies:
 *
 * - nearby: the same operation with one of the numbers changed a little;
 * - reversed: the same two numbers the other way round, for addition and
 *   multiplication only (7 - 3 and 3 - 7, or 56 / 7 and 7 / 56, are different
 *   questions, not the same one reversed);
 * - fact family: the other facts that use the same three numbers, so that
 *   8 x 7 = 56 gives 56 / 7 and 56 / 8.
 *
 * Every question here is checked against the same rules table that the
 * question generator and validator use, so a similar question always belongs
 * to the pattern's difficulty level.
 */

export type SimilarityStrategy = 'nearby' | 'reversed' | 'fact-family'

export const SIMILARITY_STRATEGIES: readonly SimilarityStrategy[] = [
  'nearby',
  'reversed',
  'fact-family',
]

/** A question before it has its answer choices. */
export type QuestionSpec = Pick<
  Question,
  'operation' | 'firstOperand' | 'secondOperand'
>

type PatternQuestion = Pick<
  MistakePattern,
  'operation' | 'firstOperand' | 'secondOperand' | 'difficulty'
>

function specKey({ operation, firstOperand, secondOperand }: QuestionSpec) {
  return `${operation}:${firstOperand}:${secondOperand}`
}

function spec(
  operation: QuestionSpec['operation'],
  firstOperand: number,
  secondOperand: number,
): QuestionSpec {
  return { operation, firstOperand, secondOperand }
}

/** The questions that belong to the pattern's level, without repeats and without the pattern's own question. */
function usable(
  specs: readonly QuestionSpec[],
  pattern: PatternQuestion,
): QuestionSpec[] {
  const seen = new Set([specKey(pattern)])
  return specs.filter((candidate) => {
    const key = specKey(candidate)
    if (seen.has(key)) return false
    seen.add(key)
    return isWithinDifficultyRules(
      candidate.operation,
      candidate.firstOperand,
      candidate.secondOperand,
      pattern.difficulty,
    )
  })
}

/** Whether the pattern is a proper division with a whole-number answer. A divisor of zero is not (the remainder is not a number). */
function isWholeDivision({ firstOperand, secondOperand }: QuestionSpec) {
  return firstOperand % secondOperand === 0
}

/* ----------------------------------- Nearby ----------------------------------- */

/** How far a number may move and still be nearby: small numbers by up to 2, bigger ones by up to 10. */
export function nearbyReach(value: number): number {
  return value <= 20 ? 2 : 10
}

/**
 * The numbers close to this one, nearest first. Some may be below zero; the
 * level's rules leave those out, as every level's numbers start at zero or more.
 */
function nearbyValues(value: number): number[] {
  const values: number[] = []
  for (let step = 1; step <= nearbyReach(value); step++) {
    values.push(value - step, value + step)
  }
  return values
}

/**
 * The same operation with one number changed a little (Task 54). A division
 * changes its divisor or its answer and works the dividend out again, so it
 * stays a whole-number division. Anything outside the level's rules is left out,
 * which keeps subtraction from going below zero and division exact.
 */
export function nearbyCandidates(pattern: PatternQuestion): QuestionSpec[] {
  const { operation, firstOperand: a, secondOperand: b } = pattern

  if (operation === 'division') {
    if (!isWholeDivision(pattern)) return []
    const quotient = a / b
    return usable(
      [
        ...nearbyValues(b).map((divisor) =>
          spec('division', divisor * quotient, divisor),
        ),
        ...nearbyValues(quotient).map((answer) =>
          spec('division', b * answer, b),
        ),
      ],
      pattern,
    )
  }

  return usable(
    [
      ...nearbyValues(a).map((first) => spec(operation, first, b)),
      ...nearbyValues(b).map((second) => spec(operation, a, second)),
    ],
    pattern,
  )
}

/* ---------------------------------- Reversed ---------------------------------- */

/**
 * The two numbers the other way round (Task 55). Only addition and
 * multiplication give the same answer both ways, so subtraction and division
 * have none, and neither has a question whose numbers are already equal.
 */
export function reversedCandidates(pattern: PatternQuestion): QuestionSpec[] {
  const { operation, firstOperand: a, secondOperand: b } = pattern
  if (operation !== 'addition' && operation !== 'multiplication') return []
  return usable([spec(operation, b, a)], pattern)
}

/* -------------------------------- Fact families -------------------------------- */

/**
 * The other facts that use the same three numbers (Task 56). Multiplication
 * gives the two divisions, division gives the two multiplications and its
 * sibling division, addition gives the two subtractions, and subtraction gives
 * the two additions and its sibling subtraction. Facts that do not fit the
 * pattern's level are left out.
 */
export function factFamilyCandidates(pattern: PatternQuestion): QuestionSpec[] {
  const { operation, firstOperand: a, secondOperand: b } = pattern

  switch (operation) {
    case 'addition': {
      const sum = a + b
      return usable(
        [spec('subtraction', sum, a), spec('subtraction', sum, b)],
        pattern,
      )
    }
    case 'subtraction': {
      const difference = a - b
      return usable(
        [
          spec('addition', b, difference),
          spec('addition', difference, b),
          spec('subtraction', a, difference),
        ],
        pattern,
      )
    }
    case 'multiplication': {
      const product = a * b
      return usable(
        [spec('division', product, a), spec('division', product, b)],
        pattern,
      )
    }
    case 'division': {
      if (!isWholeDivision(pattern)) return []
      const quotient = a / b
      return usable(
        [
          spec('multiplication', b, quotient),
          spec('multiplication', quotient, b),
          spec('division', a, quotient),
        ],
        pattern,
      )
    }
    default:
      return []
  }
}

/* ------------------------------------ Choosing ------------------------------------ */

/** Every similar question there is for the pattern, by kind. */
export function findSimilarQuestions(
  pattern: PatternQuestion,
): Record<SimilarityStrategy, QuestionSpec[]> {
  return {
    nearby: nearbyCandidates(pattern),
    reversed: reversedCandidates(pattern),
    'fact-family': factFamilyCandidates(pattern),
  }
}

export interface SimilarQuestionOptions {
  /**
   * Questions to keep away from if there is anything else to ask, such as the
   * ones already asked in this session, so the same question does not come
   * round too often.
   */
  avoid?: readonly QuestionSpec[]
}

function withoutAvoided(
  all: Record<SimilarityStrategy, QuestionSpec[]>,
  avoid: readonly QuestionSpec[],
): Record<SimilarityStrategy, QuestionSpec[]> {
  const avoided = new Set(avoid.map(specKey))
  return {
    nearby: all.nearby.filter((s) => !avoided.has(specKey(s))),
    reversed: all.reversed.filter((s) => !avoided.has(specKey(s))),
    'fact-family': all['fact-family'].filter((s) => !avoided.has(specKey(s))),
  }
}

/** The question marked as practice for this pattern. */
function forPattern(question: Question, pattern: MistakePattern): Question {
  return {
    ...question,
    source: 'mistake-review',
    mistakePatternId: pattern.id,
  }
}

/**
 * A question related to the pattern (Task 57), at the pattern's level, marked
 * as `mistake-review` and carrying the pattern's ID. It picks one of the kinds
 * that has a question to offer, each equally likely, and then one of that
 * kind's questions. It never asks the pattern's own question while there is
 * anything else, and keeps away from the questions in `options.avoid` where it
 * can.
 *
 * It always gives a valid question. If nothing similar fits the level (only
 * possible for a pattern that does not belong to its level), it asks a regular
 * question for the pattern's operation and level. Only a pattern with an
 * operation or level that does not exist throws a QuestionGenerationError
 * (from generateQuestion, which refuses them).
 */
export function generateSimilarQuestion(
  pattern: MistakePattern,
  random: RandomSource = Math.random,
  options: SimilarQuestionOptions = {},
): Question {
  if (!isDifficultyLevel(pattern.difficulty)) {
    // The rules have no such level to work from. generateQuestion refuses it, saying so.
    return forPattern(
      generateQuestion(pattern.operation, pattern.difficulty, random),
      pattern,
    )
  }

  const all = findSimilarQuestions(pattern)
  const unseen = withoutAvoided(all, options.avoid ?? [])
  const hasAny = (found: Record<SimilarityStrategy, QuestionSpec[]>) =>
    SIMILARITY_STRATEGIES.some((strategy) => found[strategy].length > 0)
  const pool = hasAny(unseen) ? unseen : all

  const strategies = SIMILARITY_STRATEGIES.filter(
    (strategy) => pool[strategy].length > 0,
  )
  if (strategies.length > 0) {
    const strategy = strategies[randomInt(0, strategies.length - 1, random)]
    const choices = pool[strategy]
    const chosen = choices[randomInt(0, choices.length - 1, random)]
    return forPattern(
      buildQuestion(chosen.operation, pattern.difficulty, chosen, random),
      pattern,
    )
  }

  // Nothing similar fits the level. That cannot happen to a pattern that
  // belongs to its level, since there is always a nearby number that does, but
  // saved data may hold one that does not, so ask a regular question instead.
  return forPattern(
    generateQuestion(pattern.operation, pattern.difficulty, random),
    pattern,
  )
}
