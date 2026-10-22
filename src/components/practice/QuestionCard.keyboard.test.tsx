import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import { QuestionCard } from './QuestionCard'

/** The card the way the practice page shows it, with the number keys on. */
function renderCard(props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onResult = vi.fn()
  const onAnnounce = vi.fn()
  const result = render(
    <QuestionCard
      question={makeQuestion()}
      questionNumber={3}
      totalQuestions={10}
      onResult={onResult}
      onAnnounce={onAnnounce}
      {...props}
    />,
  )
  return { onResult, onAnnounce, ...result }
}

const choice = (value: number) =>
  screen.getByRole('button', { name: String(value) })
const flipButton = () => screen.getByRole('button', { name: 'Flip Card' })
// The question's choices, in the order they are shown: 48, 54, 56, 64.

describe('QuestionCard and the number keys', () => {
  it.each([
    ['1', 48],
    ['2', 54],
    ['3', 56],
    ['4', 64],
  ])('picks the choice shown in place %s', async (key, answer) => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard(key)

    expect(choice(answer)).toHaveAttribute('aria-pressed', 'true')
    // And no other choice is picked.
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('picks by where a choice is shown, not by its value', async () => {
    const user = userEvent.setup()
    // Shown as 64, 48, 56, 54: key 1 is 64 whatever its size.
    renderCard({ question: makeQuestion({ choices: [64, 48, 56, 54] }) })

    await user.keyboard('1')

    expect(choice(64)).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets the pick be changed with another key', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard('1')
    await user.keyboard('4')

    expect(choice(48)).toHaveAttribute('aria-pressed', 'false')
    expect(choice(64)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('enables the Flip Card button', async () => {
    const user = userEvent.setup()
    renderCard()
    expect(flipButton()).toBeDisabled()

    await user.keyboard('2')

    expect(flipButton()).toBeEnabled()
  })

  it('moves keyboard focus to the Flip Card button, so Enter turns the card', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard('2')

    expect(flipButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('button', { name: 'I Got It Right' }),
    ).toBeInTheDocument()
  })

  it('keeps focus on Flip Card when the pick is changed', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard('1')
    await user.keyboard('3')

    expect(flipButton()).toHaveFocus()
  })

  it('moves focus to Flip Card even when the same key is pressed again', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.keyboard('2')
    choice(54).focus()

    await user.keyboard('2')

    expect(flipButton()).toHaveFocus()
  })

  it('does not move focus when a choice is picked with the mouse or Space', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(choice(54))

    expect(choice(54)).toHaveFocus()
  })

  it('ignores keys with no choice behind them, and ones with Ctrl held', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard('5')
    await user.keyboard('0')
    await user.keyboard('{Control>}1{/Control}')

    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(flipButton()).toBeDisabled()
  })

  it('stops picking once the card is flipped, so the answer cannot change', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.keyboard('2')
    await user.keyboard('{Enter}')

    await user.keyboard('4')

    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
  })

  it('can be used for a whole question with the keyboard alone', async () => {
    const user = userEvent.setup()
    const { onResult } = renderCard()

    await user.keyboard('3') // picks 56, and focus goes to Flip Card
    await user.keyboard('{Enter}') // turns the card over, and focus goes to the answer
    await user.tab() // on to I Got It Right
    await user.keyboard('{Enter}')

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ selectedAnswer: 56 }),
    )
  })

  it('does not take the keys while a dialog is open', async () => {
    const user = userEvent.setup()
    renderCard()
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.appendChild(dialog)

    await user.keyboard('1')

    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    dialog.remove()
  })

  it('is not set off by keys typed into a field on the page', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label="notes" />
        <QuestionCard
          question={makeQuestion()}
          questionNumber={1}
          totalQuestions={5}
          onResult={vi.fn()}
        />
      </>,
    )

    await user.click(screen.getByLabelText('notes'))
    await user.keyboard('12')

    expect(screen.getByLabelText('notes')).toHaveValue('12')
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('stops taking the keys once it is gone', async () => {
    const user = userEvent.setup()
    const { unmount } = renderCard()
    unmount()

    await expect(user.keyboard('1')).resolves.not.toThrow()
  })

  it('starts again for the next question', async () => {
    const user = userEvent.setup()
    const first = makeQuestion({ id: 'q1' })
    const second = makeQuestion({
      id: 'q2',
      choices: [10, 20, 30, 40],
      correctAnswer: 30,
    })
    const { rerender } = renderCard({ question: first })
    await user.keyboard('1')

    rerender(
      <QuestionCard
        question={second}
        questionNumber={4}
        totalQuestions={10}
        onResult={vi.fn()}
      />,
    )

    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    await user.keyboard('3')
    expect(choice(30)).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('QuestionCard and what it says to a screen reader', () => {
  it('says how far along the session is when the card appears', () => {
    const { onAnnounce } = renderCard()

    expect(onAnnounce).toHaveBeenCalledTimes(1)
    expect(onAnnounce).toHaveBeenCalledWith(
      'Question 3 of 10. 2 of 10 answered.',
    )
  })

  it('says it differently in continuous practice', () => {
    const { onAnnounce } = renderCard({
      totalQuestions: undefined,
      questionNumber: 4,
    })

    expect(onAnnounce).toHaveBeenCalledWith('Question 4. 3 answered so far.')
  })

  it('says when it is practice on a mistake', () => {
    const { onAnnounce } = renderCard({
      question: makeQuestion({ source: 'mistake-review' }),
      questionNumber: 1,
      totalQuestions: 5,
    })

    expect(onAnnounce).toHaveBeenCalledWith(
      'Mistake practice. Question 1 of 5. 0 of 5 answered.',
    )
  })

  it('says what was picked, and what to do next, when a number key picks it', async () => {
    const user = userEvent.setup()
    const { onAnnounce } = renderCard()
    onAnnounce.mockClear()

    await user.keyboard('2')

    expect(onAnnounce).toHaveBeenCalledTimes(1)
    expect(onAnnounce).toHaveBeenCalledWith(
      'You picked 54, answer 2. Press Enter to flip the card.',
    )
  })

  it('says nothing when a choice is picked with the mouse, which already says it', async () => {
    const user = userEvent.setup()
    const { onAnnounce } = renderCard()
    onAnnounce.mockClear()

    await user.click(choice(54))

    expect(onAnnounce).not.toHaveBeenCalled()
  })

  it('says the correct answer, and what was chosen, when the card is turned over', async () => {
    const user = userEvent.setup()
    const { onAnnounce } = renderCard()
    await user.keyboard('2')
    onAnnounce.mockClear()

    await user.keyboard('{Enter}')

    expect(onAnnounce).toHaveBeenCalledTimes(1)
    expect(onAnnounce).toHaveBeenCalledWith(
      'Card turned over. You chose 54. The correct answer is 56.',
    )
  })

  it('says it the same way after a click and the Flip Card button', async () => {
    const user = userEvent.setup()
    const { onAnnounce } = renderCard()
    onAnnounce.mockClear()

    await user.click(choice(64))
    await user.click(flipButton())

    expect(onAnnounce).toHaveBeenLastCalledWith(
      'Card turned over. You chose 64. The correct answer is 56.',
    )
  })

  it('says things in the order they happen', async () => {
    const user = userEvent.setup()
    const { onAnnounce } = renderCard()

    await user.keyboard('1')
    await user.keyboard('{Enter}')

    expect(onAnnounce.mock.calls.map(([message]) => message)).toEqual([
      'Question 3 of 10. 2 of 10 answered.',
      'You picked 48, answer 1. Press Enter to flip the card.',
      'Card turned over. You chose 48. The correct answer is 56.',
    ])
  })

  it('does not say the question again just because it is given a new announcer function', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        totalQuestions={5}
        onResult={vi.fn()}
        onAnnounce={first}
      />,
    )
    rerender(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        totalQuestions={5}
        onResult={vi.fn()}
        onAnnounce={second}
      />,
    )

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('says the question again for the next card', () => {
    const onAnnounce = vi.fn()
    const { rerender } = render(
      <QuestionCard
        question={makeQuestion({ id: 'a' })}
        questionNumber={1}
        totalQuestions={5}
        onResult={vi.fn()}
        onAnnounce={onAnnounce}
      />,
    )

    rerender(
      <QuestionCard
        question={makeQuestion({ id: 'b' })}
        questionNumber={2}
        totalQuestions={5}
        onResult={vi.fn()}
        onAnnounce={onAnnounce}
      />,
    )

    expect(onAnnounce.mock.calls.map(([m]) => m)).toEqual([
      'Question 1 of 5. 0 of 5 answered.',
      'Question 2 of 5. 1 of 5 answered.',
    ])
  })

  it('works with no announcer at all', async () => {
    const user = userEvent.setup()
    render(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        totalQuestions={5}
        onResult={vi.fn()}
      />,
    )

    await user.keyboard('2')
    await user.keyboard('{Enter}')

    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
  })

  it('does not change what the answer buttons are called', () => {
    renderCard()

    for (const name of ['48', '54', '56', '64']) {
      expect(choice(Number(name))).toHaveAccessibleName(name)
    }
  })

  it('lets the pressed state be read, and not only seen', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.keyboard('3')

    expect(choice(56)).toHaveAttribute('aria-pressed', 'true')
    expect(choice(56)).toHaveTextContent('✓')
  })
})
