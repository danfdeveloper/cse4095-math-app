import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { OPERATION_ACCENT } from '../../constants/accents'
import type { MathOperation } from '../../types/question'
import { OperationSelector } from './OperationSelector'

/** Holds the selection like the setup page does, and exposes it for assertions. */
function Harness({ initial = [] }: { initial?: MathOperation[] }) {
  const [selected, setSelected] = useState<MathOperation[]>(initial)
  return (
    <>
      <OperationSelector selected={selected} onChange={setSelected} />
      <output aria-label="selection">{selected.join(',')}</output>
    </>
  )
}

const selection = () => screen.getByLabelText('selection').textContent

describe('OperationSelector', () => {
  it('offers addition, subtraction, multiplication, division and mixed', () => {
    render(<Harness />)

    for (const name of [
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
      'Mixed operations',
    ]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('group', { name: 'What do you want to practice?' }),
    ).toBeInTheDocument()
  })

  it('starts with nothing selected', () => {
    render(<Harness />)

    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).not.toBeChecked()
    }
  })

  it('allows more than one operation to be selected', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('checkbox', { name: 'Division' }))

    expect(screen.getByRole('checkbox', { name: 'Addition' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Subtraction' }),
    ).not.toBeChecked()
    expect(selection()).toBe('addition,division')
  })

  it('deselects an operation when it is clicked again', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['addition', 'division']} />)

    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))

    expect(selection()).toBe('division')
  })

  it('keeps operations in a stable order regardless of click order', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('checkbox', { name: 'Division' }))
    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))

    expect(selection()).toBe('addition,division')
  })

  describe('mixed operations shortcut', () => {
    it('selects all four operations', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      await user.click(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      )

      expect(selection()).toBe('addition,subtraction,multiplication,division')
      expect(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      ).toBeChecked()
    })

    it('completes a partial selection rather than clearing it', async () => {
      const user = userEvent.setup()
      render(<Harness initial={['addition']} />)

      await user.click(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      )

      expect(selection()).toBe('addition,subtraction,multiplication,division')
    })

    it('clears everything when all four are already selected', async () => {
      const user = userEvent.setup()
      render(
        <Harness
          initial={['addition', 'subtraction', 'multiplication', 'division']}
        />,
      )

      await user.click(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      )

      expect(selection()).toBe('')
    })

    it('becomes checked when the four operations are picked one by one', async () => {
      const user = userEvent.setup()
      render(<Harness />)

      for (const name of ['Addition', 'Subtraction', 'Multiplication']) {
        await user.click(screen.getByRole('checkbox', { name }))
      }
      expect(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      ).not.toBeChecked()

      await user.click(screen.getByRole('checkbox', { name: 'Division' }))
      expect(
        screen.getByRole('checkbox', { name: 'Mixed operations' }),
      ).toBeChecked()
    })
  })

  it('can be operated with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    expect(screen.getByRole('checkbox', { name: 'Addition' })).toHaveFocus()
    await user.keyboard(' ')
    await user.tab()
    await user.tab()
    await user.keyboard(' ')

    expect(selection()).toBe('addition,multiplication')
  })

  it('shows a check mark for selected operations, not color alone', () => {
    render(<Harness initial={['addition']} />)

    const card = screen
      .getByRole('checkbox', { name: 'Addition' })
      .closest('label')!
    expect(card).toHaveTextContent('✓')
    const unselected = screen
      .getByRole('checkbox', { name: 'Subtraction' })
      .closest('label')!
    expect(unselected).not.toHaveTextContent('✓')
  })
})

describe('OperationSelector and its colours', () => {
  const accentOf = (name: string) =>
    screen
      .getByRole('checkbox', { name })
      .closest('label')!
      .getAttribute('data-accent')

  it('gives each operation the colour set for it', () => {
    render(<Harness />)

    expect(accentOf('Addition')).toBe(OPERATION_ACCENT.addition)
    expect(accentOf('Subtraction')).toBe(OPERATION_ACCENT.subtraction)
    expect(accentOf('Multiplication')).toBe(OPERATION_ACCENT.multiplication)
    expect(accentOf('Division')).toBe(OPERATION_ACCENT.division)
  })

  it('gives each operation a different colour', () => {
    render(<Harness />)

    const colours = [
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
    ].map(accentOf)
    expect(new Set(colours).size).toBe(4)
  })

  it('gives Mixed operations a colour of its own', () => {
    render(<Harness />)

    expect(accentOf('Mixed operations')).toBe('pink')
    expect(Object.values(OPERATION_ACCENT)).not.toContain('pink')
  })
})
