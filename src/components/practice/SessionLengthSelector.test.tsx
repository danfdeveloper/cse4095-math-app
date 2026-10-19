import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SESSION_LENGTH } from '../../constants/practice'
import type { SessionLength } from '../../types/session'
import { SessionLengthSelector } from './SessionLengthSelector'

function Harness({
  initial = DEFAULT_SESSION_LENGTH,
}: {
  initial?: SessionLength
}) {
  const [value, setValue] = useState<SessionLength>(initial)
  return (
    <>
      <SessionLengthSelector value={value} onChange={setValue} />
      <output aria-label="length">{String(value)}</output>
    </>
  )
}

const length = () => screen.getByLabelText('length').textContent

describe('SessionLengthSelector', () => {
  it('offers 5, 10, 20 questions and continuous practice', () => {
    render(<Harness />)

    for (const name of [
      '5 questions',
      '10 questions',
      '20 questions',
      'Continuous practice',
    ]) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('defaults to 10 questions', () => {
    expect(DEFAULT_SESSION_LENGTH).toBe(10)
    render(<Harness />)

    expect(screen.getByRole('radio', { name: '10 questions' })).toBeChecked()
  })

  it.each([
    ['5 questions', '5'],
    ['20 questions', '20'],
    ['Continuous practice', 'continuous'],
  ])('selects "%s"', async (name, expected) => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name }))

    expect(screen.getByRole('radio', { name })).toBeChecked()
    expect(
      screen.getByRole('radio', { name: '10 questions' }),
    ).not.toBeChecked()
    expect(length()).toBe(expected)
  })
})
