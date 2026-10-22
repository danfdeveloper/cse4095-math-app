import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import type { CardProgress } from '../../types/session'
import { QuestionCard } from './QuestionCard'

/** The card as the practice page shows it, able to start from saved progress. */
function renderCard(props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onResult = vi.fn()
  const onAnnounce = vi.fn()
  const onCardChange = vi.fn<(card: CardProgress) => void>()
  const result = render(
    <QuestionCard
      question={makeQuestion()}
      questionNumber={3}
      totalQuestions={10}
      onResult={onResult}
      onAnnounce={onAnnounce}
      onCardChange={onCardChange}
      {...props}
    />,
  )
  return { onResult, onAnnounce, onCardChange, ...result }
}

const choice = (value: number) =>
  screen.getByRole('button', { name: String(value) })
const flipButton = () => screen.getByRole('button', { name: 'Flip Card' })
const card = () => document.querySelector('[data-flipped]') as HTMLElement
// The question's choices, in the order they are shown: 48, 54, 56, 64.

describe('QuestionCard brought back after a refresh', () => {
  describe('with an answer picked and the card not turned over', () => {
    const initialCard = { selectedAnswer: 54, flipped: false }

    it('shows that answer as picked, on the front, ready to flip', () => {
      renderCard({ initialCard })

      expect(choice(54)).toHaveAttribute('aria-pressed', 'true')
      expect(choice(48)).toHaveAttribute('aria-pressed', 'false')
      expect(card()).toHaveAttribute('data-flipped', 'false')
      expect(flipButton()).toBeEnabled()
    })

    it('announces only the question, with focus on it, as for any new card', () => {
      const { onAnnounce } = renderCard({ initialCard })

      expect(onAnnounce).toHaveBeenCalledTimes(1)
      expect(onAnnounce).toHaveBeenCalledWith(
        'Question 3 of 10. 2 of 10 answered.',
      )
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2 }),
      )
    })

    it('can be flipped as usual, and then announces the answer', async () => {
      const user = userEvent.setup()
      const { onAnnounce } = renderCard({ initialCard })

      await user.click(flipButton())

      expect(card()).toHaveAttribute('data-flipped', 'true')
      expect(onAnnounce).toHaveBeenLastCalledWith(
        'Card turned over. You chose 54. The correct answer is 56.',
      )
    })
  })

  describe('with the card already turned over', () => {
    const initialCard = { selectedAnswer: 54, flipped: true }

    it('shows the answer side, with the pick, and the buttons for saying how it went', () => {
      renderCard({ initialCard })

      expect(card()).toHaveAttribute('data-flipped', 'true')
      expect(screen.getByText('Your answer: 54')).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'I Got It Right' }),
      ).toBeEnabled()
      expect(
        screen.getByRole('button', { name: 'I Got It Wrong' }),
      ).toBeEnabled()
    })

    it('says the question and what was found out as one announcement, said once', () => {
      const { onAnnounce } = renderCard({ initialCard })

      expect(onAnnounce).toHaveBeenCalledTimes(1)
      expect(onAnnounce).toHaveBeenCalledWith(
        'Question 3 of 10. 2 of 10 answered. Card turned over. You chose 54. The correct answer is 56.',
      )
    })

    it('puts keyboard focus on the answer, where it would be had the card just been turned', () => {
      renderCard({ initialCard })

      expect(document.activeElement?.tagName).toBe('H2')
      expect(document.activeElement).toHaveTextContent('7 × 8 = 56')
    })

    it('still reports the result once, with the pick that was saved', async () => {
      const user = userEvent.setup()
      const { onResult } = renderCard({ initialCard })

      await user.click(screen.getByRole('button', { name: 'I Got It Wrong' }))
      await user.click(screen.getByRole('button', { name: 'I Got It Wrong' }))

      expect(onResult).toHaveBeenCalledTimes(1)
      expect(onResult).toHaveBeenCalledWith({
        selectedAnswer: 54,
        selfReportedCorrect: false,
      })
    })
  })

  it('starts from nothing picked when it is given no saved progress', () => {
    renderCard()

    for (const value of [48, 54, 56, 64]) {
      expect(choice(value)).toHaveAttribute('aria-pressed', 'false')
    }
    expect(card()).toHaveAttribute('data-flipped', 'false')
  })
})

describe('QuestionCard and keeping its progress', () => {
  it('says how the card is when it appears, so the keeper always has it', () => {
    const { onCardChange } = renderCard()

    expect(onCardChange).toHaveBeenCalledTimes(1)
    expect(onCardChange).toHaveBeenLastCalledWith({
      selectedAnswer: null,
      flipped: false,
    })
  })

  it('says when an answer is picked, and when the pick is changed', async () => {
    const user = userEvent.setup()
    const { onCardChange } = renderCard()

    await user.click(choice(48))
    expect(onCardChange).toHaveBeenLastCalledWith({
      selectedAnswer: 48,
      flipped: false,
    })

    await user.click(choice(64))
    expect(onCardChange).toHaveBeenLastCalledWith({
      selectedAnswer: 64,
      flipped: false,
    })
  })

  it('says when the card is turned over', async () => {
    const user = userEvent.setup()
    const { onCardChange } = renderCard()
    await user.click(choice(54))

    await user.click(flipButton())

    expect(onCardChange).toHaveBeenLastCalledWith({
      selectedAnswer: 54,
      flipped: true,
    })
  })

  it('says when an answer is picked with a number key', async () => {
    const user = userEvent.setup()
    const { onCardChange } = renderCard()

    await user.keyboard('3')

    expect(onCardChange).toHaveBeenLastCalledWith({
      selectedAnswer: 56,
      flipped: false,
    })
  })

  it('says nothing more when nothing changes', async () => {
    const user = userEvent.setup()
    const { onCardChange } = renderCard()
    await user.click(choice(48))
    const calls = onCardChange.mock.calls.length

    await user.click(choice(48))

    expect(onCardChange).toHaveBeenCalledTimes(calls)
  })

  it('does not say a pick after the card is turned over, as the pick can no longer change', async () => {
    const user = userEvent.setup()
    const { onCardChange } = renderCard()
    await user.click(choice(48))
    await user.click(flipButton())
    const calls = onCardChange.mock.calls.length

    await user.keyboard('4')

    expect(onCardChange).toHaveBeenCalledTimes(calls)
  })

  it('uses the latest keeper, without saying anything again', async () => {
    const user = userEvent.setup()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        onResult={() => {}}
        onCardChange={first}
      />,
    )
    rerender(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        onResult={() => {}}
        onCardChange={second}
      />,
    )
    expect(second).not.toHaveBeenCalled()

    await user.click(choice(48))

    expect(second).toHaveBeenLastCalledWith({
      selectedAnswer: 48,
      flipped: false,
    })
    expect(first).toHaveBeenCalledTimes(1)
  })
})
