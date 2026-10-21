import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ACCENT } from '../../constants/accents'
import type { DifficultyLevel } from '../../types/question'
import { DifficultySelector } from './DifficultySelector'

function Harness({ initial = null }: { initial?: DifficultyLevel | null }) {
  const [value, setValue] = useState<DifficultyLevel | null>(initial)
  return (
    <>
      <DifficultySelector value={value} onChange={setValue} />
      <output aria-label="level">{value ?? 'none'}</output>
    </>
  )
}

const level = () => screen.getByLabelText('level').textContent

describe('DifficultySelector', () => {
  it.each([
    [1, 'Level 1: Beginner'],
    [2, 'Level 2: Easy'],
    [3, 'Level 3: Intermediate'],
    [4, 'Level 4: Advanced'],
  ])('offers level %i as "%s"', (_, name) => {
    render(<Harness />)

    expect(screen.getByRole('radio', { name })).toBeInTheDocument()
  })

  it('offers exactly four levels in one group', () => {
    render(<Harness />)

    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(
      screen.getByRole('group', { name: 'How hard should it be?' }),
    ).toBeInTheDocument()
  })

  it('gives every level a short description', () => {
    render(<Harness />)

    expect(
      screen.getByRole('radio', { name: 'Level 1: Beginner' }),
    ).toHaveAccessibleDescription(
      'Small numbers up to 10. Times tables up to 5.',
    )
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAccessibleDescription(/\S/)
    }
  })

  it('starts with no level selected', () => {
    render(<Harness />)

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(level()).toBe('none')
  })

  it('allows exactly one level to be selected at a time', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name: 'Level 2: Easy' }))
    await user.click(screen.getByRole('radio', { name: 'Level 4: Advanced' }))

    expect(
      screen.getByRole('radio', { name: 'Level 4: Advanced' }),
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Level 2: Easy' }),
    ).not.toBeChecked()
    expect(level()).toBe('4')
  })

  it('shows a check mark on the selected level, not color alone', () => {
    render(<Harness initial={3} />)

    expect(
      screen
        .getByRole('radio', { name: 'Level 3: Intermediate' })
        .closest('label'),
    ).toHaveTextContent('✓')
    expect(
      screen.getByRole('radio', { name: 'Level 1: Beginner' }).closest('label'),
    ).not.toHaveTextContent('✓')
  })

  it('supports arrow keys to move between levels', async () => {
    const user = userEvent.setup()
    render(<Harness initial={1} />)

    screen.getByRole('radio', { name: 'Level 1: Beginner' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(level()).toBe('2')
  })
})

describe('DifficultySelector and its colours', () => {
  const accentOf = (name: RegExp | string) =>
    screen
      .getByRole('radio', { name })
      .closest('label')!
      .getAttribute('data-accent')

  it('gives each level the colour set for it, all different', () => {
    render(<Harness />)

    const colours = ([1, 2, 3, 4] as const).map((level) =>
      accentOf(new RegExp(`^Level ${level}:`)),
    )
    expect(colours).toEqual(
      [1, 2, 3, 4].map((l) => DIFFICULTY_ACCENT[l as 1 | 2 | 3 | 4]),
    )
    expect(new Set(colours).size).toBe(4)
  })
})
