import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import { CardBack } from './CardBack'

interface Options {
  selectedAnswer?: number
  showExplanation?: boolean
  resultRecorded?: boolean
  onReportResult?: (correct: boolean) => void
}

function renderBack({
  selectedAnswer = 54,
  showExplanation = true,
  resultRecorded = false,
  onReportResult = () => {},
}: Options = {}) {
  return render(
    <CardBack
      question={makeQuestion()}
      selectedAnswer={selectedAnswer}
      showExplanation={showExplanation}
      resultRecorded={resultRecorded}
      onReportResult={onReportResult}
      headingRef={createRef()}
    />,
  )
}

describe('CardBack', () => {
  it('shows the original question with its correct answer', () => {
    renderBack()

    const heading = screen.getByRole('heading', {
      name: '7 times 8 equals 56',
    })
    expect(heading).toHaveTextContent('7 × 8 = 56')
  })

  it('shows the answer the student chose', () => {
    renderBack({ selectedAnswer: 54 })

    expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
  })

  it('shows the chosen answer even when it was the right one', () => {
    renderBack({ selectedAnswer: 56 })

    expect(screen.getByText('Your answer: 56')).toBeInTheDocument()
  })

  describe('the explanation', () => {
    const explanationHeading = (name: string | RegExp) =>
      screen.queryByRole('heading', { level: 3, name })

    it('names the method that solves this kind of problem', () => {
      renderBack()

      expect(
        explanationHeading('How to solve it: Splitting with fives'),
      ).toBeInTheDocument()
    })

    it('walks through it in numbered steps, in order', () => {
      renderBack()

      const steps = within(screen.getByRole('list')).getAllByRole('listitem')
      expect(steps.map((step) => step.textContent)).toEqual([
        'Split 7 into 5 and 2.',
        '5 × 8 = 40, and 2 × 8 = 16.',
        '40 + 16 = 56.',
        'So 7 × 8 = 56.',
      ])
    })

    it('uses an ordered list, so the order is clear to a screen reader', () => {
      renderBack()

      expect(screen.getByRole('list').tagName).toBe('OL')
    })

    it('ends with the whole answer, restating the problem', () => {
      renderBack()

      const steps = within(screen.getByRole('list')).getAllByRole('listitem')
      expect(steps.at(-1)).toHaveTextContent('So 7 × 8 = 56.')
    })

    it('is a labelled region named after its method', () => {
      renderBack()

      expect(
        screen.getByRole('region', {
          name: 'How to solve it: Splitting with fives',
        }),
      ).toBeInTheDocument()
    })

    it('shows a different method for a different kind of problem', () => {
      const { unmount } = render(
        <CardBack
          question={makeQuestion({
            id: 'q2',
            operation: 'addition',
            firstOperand: 8,
            secondOperand: 7,
            displayText: '8 + 7',
            correctAnswer: 15,
            choices: [13, 14, 15, 16],
          })}
          selectedAnswer={15}
          showExplanation
          resultRecorded={false}
          onReportResult={() => {}}
          headingRef={createRef()}
        />,
      )

      expect(
        explanationHeading('How to solve it: Making a ten'),
      ).toBeInTheDocument()
      expect(
        within(screen.getByRole('list'))
          .getAllByRole('listitem')
          .map((step) => step.textContent),
      ).toEqual([
        '8 needs 2 more to make 10.',
        'Take 2 from 7, which leaves 7 − 2 = 5.',
        '10 + 5 = 15.',
        'So 8 + 7 = 15.',
      ])
      unmount()
    })

    it('does not teach a wrong method for a question that does not add up', () => {
      render(
        <CardBack
          question={makeQuestion({
            correctAnswer: 55,
            choices: [48, 54, 55, 64],
          })}
          selectedAnswer={54}
          showExplanation
          resultRecorded={false}
          onReportResult={() => {}}
          headingRef={createRef()}
        />,
      )

      expect(
        explanationHeading('How to solve it: Working it out'),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('can be hidden completely', () => {
      renderBack({ showExplanation: false })

      expect(explanationHeading(/How to solve it/)).not.toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('still shows the answer and both buttons when hidden', () => {
      renderBack({ showExplanation: false })

      expect(screen.getByText('Your answer: 54')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'I Got It Right' }),
      ).toBeInTheDocument()
    })

    it('uses no shaming or scary words', () => {
      renderBack({ selectedAnswer: 54 })

      expect(screen.getByRole('region').textContent).not.toMatch(
        /wrong|bad|fail|mistake|error|incorrect/i,
      )
    })
  })

  it('has an "I Got It Right" and an "I Got It Wrong" button', () => {
    renderBack()

    expect(screen.getByRole('button', { name: 'I Got It Right' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'I Got It Wrong' })).toBeEnabled()
  })

  it('reports a right answer', async () => {
    const user = userEvent.setup()
    const onReportResult = vi.fn()
    renderBack({ onReportResult })

    await user.click(screen.getByRole('button', { name: 'I Got It Right' }))

    expect(onReportResult).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('reports a wrong answer', async () => {
    const user = userEvent.setup()
    const onReportResult = vi.fn()
    renderBack({ onReportResult })

    await user.click(screen.getByRole('button', { name: 'I Got It Wrong' }))

    expect(onReportResult).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('disables both buttons once a result is recorded', async () => {
    const user = userEvent.setup()
    const onReportResult = vi.fn()
    renderBack({ resultRecorded: true, onReportResult })

    expect(
      screen.getByRole('button', { name: 'I Got It Right' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'I Got It Wrong' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'I Got It Right' }))
    expect(onReportResult).not.toHaveBeenCalled()
  })

  it('does not use shaming language', () => {
    renderBack({ selectedAnswer: 54 })

    expect(
      screen.queryByText(/bad|stupid|fail|dumb|incorrect/i),
    ).not.toBeInTheDocument()
  })
})
