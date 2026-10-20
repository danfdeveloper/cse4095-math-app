import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import { CardFront } from './CardFront'

interface HarnessProps {
  questionNumber?: number
  /** null means no fixed total, as in continuous practice. */
  totalQuestions?: number | null
  initialAnswer?: number | null
  locked?: boolean
  onFlip?: () => void
}

/** Holds the selection like QuestionCard does. */
function Harness({
  questionNumber = 3,
  totalQuestions = 10,
  initialAnswer = null,
  locked = false,
  onFlip = () => {},
}: HarnessProps) {
  const [selected, setSelected] = useState<number | null>(initialAnswer)
  return (
    <CardFront
      question={makeQuestion()}
      questionNumber={questionNumber}
      totalQuestions={totalQuestions ?? undefined}
      selectedAnswer={selected}
      locked={locked}
      onSelectAnswer={setSelected}
      onFlip={onFlip}
      headingRef={createRef()}
    />
  )
}

const flipButton = () => screen.getByRole('button', { name: 'Flip Card' })
const choice = (value: number) =>
  screen.getByRole('button', { name: String(value) })

describe('CardFront', () => {
  it('shows the arithmetic question', () => {
    render(<Harness />)

    const heading = screen.getByRole('heading', { name: 'What is 7 times 8?' })
    expect(heading).toHaveTextContent('7 × 8 = ?')
  })

  it('shows the four answer choices', () => {
    render(<Harness />)

    const group = screen.getByRole('group', { name: 'What is 7 times 8?' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.textContent?.replace('✓', ''))).toEqual([
      '48',
      '54',
      '56',
      '64',
    ])
  })

  it('shows the current question number and the total', () => {
    render(<Harness questionNumber={3} totalQuestions={10} />)

    expect(screen.getByText('Question 3 of 10')).toBeInTheDocument()
  })

  it('shows just the number when there is no fixed total', () => {
    render(<Harness questionNumber={4} totalQuestions={null} />)

    expect(screen.getByText('Question 4')).toBeInTheDocument()
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument()
  })

  describe('Flip Card button', () => {
    it('is disabled until an answer is selected', () => {
      render(<Harness />)

      expect(flipButton()).toBeDisabled()
    })

    it('explains why with visible text', () => {
      render(<Harness />)

      expect(screen.getByText('Pick an answer to flip the card.')).toBeVisible()
      expect(flipButton()).toHaveAccessibleDescription(
        'Pick an answer to flip the card.',
      )
    })

    it('is enabled, and the hint gone, once an answer is selected', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      await user.click(choice(54))

      expect(flipButton()).toBeEnabled()
      expect(
        screen.queryByText('Pick an answer to flip the card.'),
      ).not.toBeInTheDocument()
    })

    it('calls onFlip when pressed', async () => {
      const user = userEvent.setup()
      const onFlip = vi.fn()
      render(<Harness initialAnswer={54} onFlip={onFlip} />)

      await user.click(flipButton())

      expect(onFlip).toHaveBeenCalledTimes(1)
    })

    it('does nothing while disabled', async () => {
      const user = userEvent.setup()
      const onFlip = vi.fn()
      render(<Harness onFlip={onFlip} />)

      await user.click(flipButton())

      expect(onFlip).not.toHaveBeenCalled()
    })
  })

  describe('selecting an answer', () => {
    it('starts with nothing selected', () => {
      render(<Harness />)

      for (const value of [48, 54, 56, 64]) {
        expect(choice(value)).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('highlights the selected answer', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      await user.click(choice(54))

      expect(choice(54)).toHaveAttribute('aria-pressed', 'true')
      expect(choice(48)).toHaveAttribute('aria-pressed', 'false')
    })

    it('lets the answer change before flipping', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      await user.click(choice(54))
      await user.click(choice(64))

      expect(choice(64)).toHaveAttribute('aria-pressed', 'true')
      expect(choice(54)).toHaveAttribute('aria-pressed', 'false')
    })

    it('does not reveal whether the choice is right', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      await user.click(choice(54))

      expect(screen.queryByText(/correct|right|wrong/i)).not.toBeInTheDocument()
    })
  })

  it('locks every answer once the card is flipped', () => {
    render(<Harness locked initialAnswer={54} />)

    for (const value of [48, 54, 56, 64]) {
      expect(choice(value)).toBeDisabled()
    }
    expect(choice(54)).toHaveAttribute('aria-pressed', 'true')
  })
})
