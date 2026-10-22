import { describe, expect, it } from 'vitest'
import { announcePick, announceQuestion, announceReveal } from './announcements'

describe('announceQuestion', () => {
  it('says which question it is and how many are answered, in a fixed-length session', () => {
    expect(announceQuestion({ questionNumber: 3, totalQuestions: 10 })).toBe(
      'Question 3 of 10. 2 of 10 answered.',
    )
  })

  it('says it for the first question too', () => {
    expect(announceQuestion({ questionNumber: 1, totalQuestions: 5 })).toBe(
      'Question 1 of 5. 0 of 5 answered.',
    )
  })

  it('says it for the last question', () => {
    expect(announceQuestion({ questionNumber: 20, totalQuestions: 20 })).toBe(
      'Question 20 of 20. 19 of 20 answered.',
    )
  })

  it('has no total in continuous practice', () => {
    expect(announceQuestion({ questionNumber: 4 })).toBe(
      'Question 4. 3 answered so far.',
    )
  })

  it('says when it is practice on mistakes', () => {
    expect(
      announceQuestion({
        questionNumber: 2,
        totalQuestions: 5,
        mistakePractice: true,
      }),
    ).toBe('Mistake practice. Question 2 of 5. 1 of 5 answered.')
  })

  it('does not say so for regular practice', () => {
    expect(
      announceQuestion({
        questionNumber: 2,
        totalQuestions: 5,
        mistakePractice: false,
      }),
    ).not.toContain('Mistake practice')
  })

  it('is different for every question, so each one is read out', () => {
    const said = [1, 2, 3, 4, 5].map((n) =>
      announceQuestion({ questionNumber: n, totalQuestions: 5 }),
    )

    expect(new Set(said).size).toBe(5)
  })
})

describe('announcePick', () => {
  it('says what was picked, which choice it was, and what to do next', () => {
    expect(announcePick(54, 2)).toBe(
      'You picked 54, answer 2. Press Enter to flip the card.',
    )
  })
})

describe('announceReveal', () => {
  it('says the card turned over, what was chosen, and the right answer', () => {
    expect(announceReveal({ correctAnswer: 56 }, 54)).toBe(
      'Card turned over. You chose 54. The correct answer is 56.',
    )
  })

  it('says the same whether or not the choice was right, as the student decides that', () => {
    expect(announceReveal({ correctAnswer: 56 }, 56)).toBe(
      'Card turned over. You chose 56. The correct answer is 56.',
    )
    expect(announceReveal({ correctAnswer: 56 }, 56)).not.toMatch(
      /right|wrong|correct!|incorrect|well done/i,
    )
  })
})
