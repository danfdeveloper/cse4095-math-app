import { describe, expect, it, vi } from 'vitest'

// Force the validator to report a problem, to prove the generator refuses to
// hand out a question that fails validation.
vi.mock('../utils/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/validation')>()
  return { ...actual, getQuestionProblems: vi.fn(() => ['Division by zero']) }
})

import { generateQuestion, QuestionGenerationError } from './questionGenerator'

describe('generateQuestion when every question fails validation', () => {
  it('tries, falls back, and throws only because the fallback fails too', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => generateQuestion('addition', 1, () => 0)).toThrow(
      QuestionGenerationError,
    )
    expect(() => generateQuestion('addition', 1, () => 0)).toThrow(
      'Even the fallback question is invalid (0 + 0): Division by zero',
    )
    errors.mockRestore()
  })
})
