import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PracticeMode } from '../../types/session'
import { ReviewModeSelector } from './ReviewModeSelector'

function renderSelector(
  value: PracticeMode = 'regular',
  activeMistakes = 3,
  onChange = vi.fn(),
) {
  render(
    <ReviewModeSelector
      value={value}
      onChange={onChange}
      activeMistakes={activeMistakes}
    />,
  )
  return onChange
}

const regular = () => screen.getByRole('radio', { name: 'Regular practice' })
const mistakes = () => screen.getByRole('radio', { name: 'Practice mistakes' })

describe('ReviewModeSelector', () => {
  it('is a named group of two choices', () => {
    renderSelector()

    const group = screen.getByRole('group', { name: 'What kind of practice?' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it.each([
    ['regular' as const, true, false],
    ['mistake-review' as const, false, true],
  ])('shows %s as chosen', (value, regularChecked, mistakesChecked) => {
    renderSelector(value)

    if (regularChecked) expect(regular()).toBeChecked()
    else expect(regular()).not.toBeChecked()
    if (mistakesChecked) expect(mistakes()).toBeChecked()
    else expect(mistakes()).not.toBeChecked()
  })

  it('describes regular practice', () => {
    renderSelector()

    expect(regular()).toHaveAccessibleDescription(
      'Questions picked for you at random.',
    )
  })

  describe('with mistakes to practice', () => {
    it('can be chosen, and says how many there are', () => {
      renderSelector('regular', 3)

      expect(mistakes()).toBeEnabled()
      expect(mistakes()).toHaveAccessibleDescription(
        '3 mistakes to practice. Questions like the ones you got wrong.',
      )
    })

    it('says "mistake" for just one', () => {
      renderSelector('regular', 1)

      expect(mistakes()).toHaveAccessibleDescription(
        '1 mistake to practice. Questions like the ones you got wrong.',
      )
    })

    it('reports the choice', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('regular', 3)

      await user.click(mistakes())
      expect(onChange).toHaveBeenLastCalledWith('mistake-review')
    })

    it('reports a change back to regular practice', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('mistake-review', 3)

      await user.click(regular())
      expect(onChange).toHaveBeenLastCalledWith('regular')
    })

    it('can be chosen from the keyboard', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('regular', 3)

      regular().focus()
      await user.keyboard('{ArrowDown}')

      expect(onChange).toHaveBeenLastCalledWith('mistake-review')
    })
  })

  describe('with no mistakes to practice', () => {
    it('cannot be chosen, and says why in words', () => {
      renderSelector('regular', 0)

      expect(mistakes()).toBeDisabled()
      expect(mistakes()).toHaveAccessibleDescription(
        'No mistakes to practice yet. Questions you get wrong will show up here.',
      )
      expect(
        screen.getByText(
          'No mistakes to practice yet. Questions you get wrong will show up here.',
        ),
      ).toBeVisible()
    })

    it('does nothing when it is clicked', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('regular', 0)

      await user.click(mistakes())

      expect(onChange).not.toHaveBeenCalled()
    })

    it('is skipped by the keyboard', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('regular', 0)

      regular().focus()
      await user.keyboard('{ArrowDown}')

      expect(onChange).not.toHaveBeenCalled()
    })

    it('leaves regular practice available', async () => {
      const user = userEvent.setup()
      const onChange = renderSelector('regular', 0)

      expect(regular()).toBeEnabled()
      await user.click(regular())
      // Already chosen, so a click changes nothing.
      expect(onChange).not.toHaveBeenCalledWith('mistake-review')
    })
  })
})
