import { describe, expect, it, vi } from 'vitest'

// The first check of a question fails, as if a similar question had come out
// wrong; every later check is the real one.
vi.mock('../utils/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/validation')>()
  return {
    ...actual,
    getQuestionProblems: vi
      .fn(actual.getQuestionProblems)
      .mockReturnValueOnce(['Correct answer 1 should be 2']),
  }
})

import { makeMistakePattern } from '../test/fixtures'
import { getQuestionProblems } from '../utils/validation'
import { generateSimilarQuestion } from './similarQuestions'

describe('generateSimilarQuestion when what it made fails its check', () => {
  it('asks a valid regular question of the same kind instead, still as practice for the mistake', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pattern = makeMistakePattern()

    const question = generateSimilarQuestion(pattern)

    expect(getQuestionProblems(question)).toEqual([])
    expect(question).toMatchObject({
      operation: pattern.operation,
      difficulty: pattern.difficulty,
      source: 'mistake-review',
      mistakePatternId: pattern.id,
    })
    expect(errors.mock.calls[0][0]).toMatch(/Made an invalid similar question/)
    errors.mockRestore()
  })
})
