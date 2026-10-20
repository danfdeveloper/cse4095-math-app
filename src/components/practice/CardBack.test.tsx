import { render, screen } from '@testing-library/react'
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

  it('shows a brief explanation', () => {
    renderBack()

    expect(
      screen.getByText('7 × 8 means 7 groups of 8, which makes 56.'),
    ).toBeInTheDocument()
  })

  it('can hide the explanation', () => {
    renderBack({ showExplanation: false })

    expect(screen.queryByText(/groups of/)).not.toBeInTheDocument()
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
