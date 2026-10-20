import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import type { Question } from '../../types/question'
import type { QuestionResult } from '../../types/session'
import { QuestionCard } from './QuestionCard'

type User = ReturnType<typeof userEvent.setup>

interface Options {
  question?: Question
  questionNumber?: number
  totalQuestions?: number
  animationEnabled?: boolean
  showExplanation?: boolean
  onResult?: (result: QuestionResult) => void
}

function cardElement(options: Options = {}) {
  return (
    <QuestionCard
      question={options.question ?? makeQuestion()}
      questionNumber={options.questionNumber ?? 3}
      totalQuestions={'totalQuestions' in options ? options.totalQuestions : 10}
      animationEnabled={options.animationEnabled}
      showExplanation={options.showExplanation}
      onResult={options.onResult ?? (() => {})}
    />
  )
}

const renderCard = (options: Options = {}) => render(cardElement(options))

const choice = (value: number) =>
  screen.getByRole('button', { name: String(value) })
const flipButton = () => screen.getByRole('button', { name: 'Flip Card' })
const rightButton = () => screen.getByRole('button', { name: 'I Got It Right' })
const wrongButton = () => screen.getByRole('button', { name: 'I Got It Wrong' })
const card = () => document.querySelector('[data-flipped]') as HTMLElement

async function selectAndFlip(user: User, answer = 54) {
  await user.click(choice(answer))
  await user.click(flipButton())
}

describe('QuestionCard front', () => {
  it('starts showing the front of the card', () => {
    renderCard()

    expect(
      screen.getByRole('heading', { name: 'What is 7 times 8?' }),
    ).toBeVisible()
    expect(screen.getByText('Question 3 of 10')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-flipped', 'false')
  })

  it('does not offer the back of the card yet', () => {
    renderCard()

    expect(
      screen.queryByRole('button', { name: 'I Got It Right' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'I Got It Wrong' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Your answer/)).not.toBeInTheDocument()
  })

  it('cannot be flipped before an answer is chosen', async () => {
    const user = userEvent.setup()
    renderCard()

    expect(flipButton()).toBeDisabled()
    await user.click(flipButton())

    expect(card()).toHaveAttribute('data-flipped', 'false')
  })

  it('can be flipped once an answer is chosen', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(choice(54))

    expect(flipButton()).toBeEnabled()
  })

  it('lets the answer change before flipping', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(choice(54))
    await user.click(choice(64))
    await user.click(flipButton())

    expect(screen.getByText('Your answer: 64')).toBeInTheDocument()
  })

  it('does not count a result until the student reports one', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })

    await selectAndFlip(user)

    expect(onResult).not.toHaveBeenCalled()
  })
})

describe('QuestionCard before it is flipped', () => {
  // Once an answer is chosen the back already holds its content, so these
  // check that it stays hidden and unreachable until the card is flipped.
  const backButton = () =>
    screen.getByRole('button', { name: 'I Got It Right', hidden: true })

  it('keeps the back hidden from assistive technology after an answer is chosen', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(choice(54))

    expect(
      screen.queryByRole('button', { name: 'I Got It Right' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'I Got It Wrong' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the back inert, so keyboard focus cannot reach it, until flipped', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(choice(54))
    expect(backButton().closest('[inert]')).not.toBeNull()

    await user.click(flipButton())
    expect(backButton().closest('[inert]')).toBeNull()
  })

  it('ignores a result reported before the card has been flipped', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })
    await user.click(choice(54))

    // Not reachable by a person (the back is inert), but the rule that a
    // result needs a flipped card must hold anyway.
    act(() => backButton().click())

    expect(onResult).not.toHaveBeenCalled()
  })
})

describe('QuestionCard back', () => {
  it('shows the back after flipping, with the question, answer, and choice', async () => {
    const user = userEvent.setup()
    renderCard()

    await selectAndFlip(user, 54)

    expect(card()).toHaveAttribute('data-flipped', 'true')
    expect(
      screen.getByRole('heading', { name: '7 times 8 equals 56' }),
    ).toHaveTextContent('7 × 8 = 56')
    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
    expect(rightButton()).toBeEnabled()
    expect(wrongButton()).toBeEnabled()
  })

  it('hides the front from assistive technology once flipped', async () => {
    const user = userEvent.setup()
    renderCard()

    await selectAndFlip(user)

    expect(
      screen.queryByRole('button', { name: 'Flip Card' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'What is 7 times 8?' }),
    ).not.toBeInTheDocument()
    // The turned-away face is also inert, so keyboard focus cannot reach it.
    expect(document.querySelector('[inert]')).toContainElement(
      screen.getByText('Question 3 of 10', { ignore: 'none' }),
    )
  })

  it('locks the answers once flipped', async () => {
    const user = userEvent.setup()
    renderCard()

    await selectAndFlip(user, 54)

    for (const value of [48, 54, 56, 64]) {
      const button = screen.getByRole('button', {
        name: String(value),
        hidden: true,
      })
      expect(button).toBeDisabled()
    }
    expect(
      screen.getByRole('button', { name: '54', hidden: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the explanation by default and can hide it', async () => {
    const user = userEvent.setup()
    const { unmount } = renderCard()
    await selectAndFlip(user)
    expect(screen.getByText(/7 groups of 8/)).toBeInTheDocument()
    unmount()

    renderCard({ showExplanation: false })
    await selectAndFlip(user)
    expect(screen.queryByText(/7 groups of 8/)).not.toBeInTheDocument()
  })
})

describe('QuestionCard results', () => {
  it('reports "I Got It Right" with the chosen answer', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })

    await selectAndFlip(user, 54)
    await user.click(rightButton())

    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      selectedAnswer: 54,
      selfReportedCorrect: true,
    })
  })

  it('reports "I Got It Wrong" with the chosen answer', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })

    await selectAndFlip(user, 54)
    await user.click(wrongButton())

    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      selectedAnswer: 54,
      selfReportedCorrect: false,
    })
  })

  it('leaves the judgement to the student, whatever they chose', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })

    // They picked the correct answer 56 but say they got it wrong.
    await selectAndFlip(user, 56)
    await user.click(wrongButton())

    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      selectedAnswer: 56,
      selfReportedCorrect: false,
    })
  })

  it('counts each attempt only once, even on a double click', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })
    await selectAndFlip(user)

    await user.dblClick(rightButton())

    expect(onResult).toHaveBeenCalledTimes(1)
  })

  it('counts an attempt once even if two clicks land before React re-renders', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })
    await selectAndFlip(user)
    const right = rightButton()

    // Both clicks are delivered inside one batch, so the button has not
    // become disabled yet. Only the guard inside the handler can stop the second.
    act(() => {
      right.click()
      right.click()
    })

    expect(onResult).toHaveBeenCalledTimes(1)
  })

  it('does not let both buttons be used for one attempt', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })
    await selectAndFlip(user)

    await user.click(rightButton())
    await user.click(wrongButton())

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(rightButton()).toBeDisabled()
    expect(wrongButton()).toBeDisabled()
  })
})

describe('QuestionCard with a new question', () => {
  const next = makeQuestion({
    id: 'q2',
    firstOperand: 6,
    secondOperand: 4,
    displayText: '6 × 4',
    correctAnswer: 24,
    choices: [20, 24, 28, 30],
  })

  it('starts over: front showing, nothing chosen, flip disabled', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCard()
    await selectAndFlip(user, 54)

    rerender(cardElement({ question: next, questionNumber: 4 }))

    expect(
      screen.getByRole('heading', { name: 'What is 6 times 4?' }),
    ).toBeVisible()
    expect(screen.getByText('Question 4 of 10')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-flipped', 'false')
    expect(flipButton()).toBeDisabled()
    for (const value of [20, 24, 28, 30]) {
      expect(choice(value)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('can record a result for the new question', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    const { rerender } = renderCard({ onResult })
    await selectAndFlip(user, 54)
    await user.click(rightButton())

    rerender(cardElement({ question: next, onResult }))
    await user.click(choice(24))
    await user.click(flipButton())
    await user.click(wrongButton())

    expect(onResult).toHaveBeenCalledTimes(2)
    expect(onResult).toHaveBeenLastCalledWith({
      selectedAnswer: 24,
      selfReportedCorrect: false,
    })
  })

  it('keeps its state when the same question is simply redrawn', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCard()
    await selectAndFlip(user, 54)

    rerender(cardElement({ questionNumber: 3 }))

    expect(card()).toHaveAttribute('data-flipped', 'true')
    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
  })
})

describe('QuestionCard animation setting', () => {
  it('animates by default', () => {
    renderCard()

    expect(card()).toHaveAttribute('data-animated', 'true')
  })

  it('can have its animation turned off', () => {
    renderCard({ animationEnabled: false })

    expect(card()).toHaveAttribute('data-animated', 'false')
  })

  it('works completely with animation off', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ animationEnabled: false, onResult })

    await selectAndFlip(user, 54)
    expect(card()).toHaveAttribute('data-flipped', 'true')
    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
    await user.click(rightButton())

    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      selectedAnswer: 54,
      selfReportedCorrect: true,
    })
  })
})

describe('QuestionCard keyboard use', () => {
  it('moves keyboard focus to the question when a card appears', () => {
    renderCard()

    expect(
      screen.getByRole('heading', { name: 'What is 7 times 8?' }),
    ).toHaveFocus()
  })

  it('moves focus to the revealed answer when flipped, so it is not lost', async () => {
    const user = userEvent.setup()
    renderCard()

    await selectAndFlip(user)

    expect(
      screen.getByRole('heading', { name: '7 times 8 equals 56' }),
    ).toHaveFocus()
  })

  it('moves focus to the next question', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCard()
    await selectAndFlip(user)

    rerender(
      cardElement({
        question: makeQuestion({
          id: 'q2',
          firstOperand: 6,
          secondOperand: 4,
          displayText: '6 × 4',
          correctAnswer: 24,
          choices: [20, 24, 28, 30],
        }),
      }),
    )

    expect(
      screen.getByRole('heading', { name: 'What is 6 times 4?' }),
    ).toHaveFocus()
  })

  it('can be completed using only the keyboard', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderCard({ onResult })

    await user.tab() // from the question to the first answer, 48
    expect(choice(48)).toHaveFocus()
    await user.tab() // 54
    await user.keyboard(' ')
    expect(choice(54)).toHaveAttribute('aria-pressed', 'true')
    await user.tab() // 56
    await user.tab() // 64
    await user.tab() // Flip Card
    expect(flipButton()).toHaveFocus()
    await user.keyboard('{Enter}')

    await user.tab() // I Got It Right
    expect(rightButton()).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      selectedAnswer: 54,
      selfReportedCorrect: true,
    })
  })
})
