import { describe, expect, it, vi } from 'vitest'

// Force the validator to report a problem, to prove the generator refuses to
// hand out a question that fails validation.
vi.mock('../utils/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/validation')>()
  return { ...actual, getQuestionProblems: vi.fn(() => ['Division by zero']) }
})

import { generateQuestion, QuestionGenerationError } from './questionGenerator'

describe('generateQuestion when validation fails', () => {
  it('throws instead of returning an invalid question', () => {
    expect(() => generateQuestion('addition', 1, () => 0)).toThrow(
      QuestionGenerationError,
    )
  })

  it('says which question failed and why', () => {
    expect(() => generateQuestion('addition', 1, () => 0)).toThrow(
      'Generated an invalid question (0 + 0): Division by zero',
    )
  })
})
