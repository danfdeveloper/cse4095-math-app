import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

function bar(value: number, max = 10) {
  render(
    <ProgressBar
      value={value}
      max={max}
      label="Session progress"
      valueText={`${value} of ${max} questions answered`}
    />,
  )
  return screen.getByRole('progressbar', { name: 'Session progress' })
}

describe('ProgressBar', () => {
  it('is announced as a progress bar with a name', () => {
    expect(bar(3)).toBeInTheDocument()
  })

  it('reports its value, range and a plain-words description', () => {
    const progress = bar(3)

    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '10')
    expect(progress).toHaveAttribute('aria-valuenow', '3')
    expect(progress).toHaveAttribute(
      'aria-valuetext',
      '3 of 10 questions answered',
    )
  })

  it('fills in proportion to the value', () => {
    const fill = bar(3).firstElementChild as HTMLElement

    expect(fill.style.width).toBe('30%')
  })

  it('starts empty and ends full', () => {
    const { unmount } = render(
      <ProgressBar value={0} max={5} label="p" valueText="" />,
    )
    expect(
      (screen.getByRole('progressbar').firstElementChild as HTMLElement).style
        .width,
    ).toBe('0%')
    unmount()

    render(<ProgressBar value={5} max={5} label="p" valueText="" />)
    expect(
      (screen.getByRole('progressbar').firstElementChild as HTMLElement).style
        .width,
    ).toBe('100%')
  })

  it('never goes past either end', () => {
    const { unmount } = render(
      <ProgressBar value={99} max={10} label="p" valueText="" />,
    )
    const over = screen.getByRole('progressbar')
    expect(over).toHaveAttribute('aria-valuenow', '10')
    expect((over.firstElementChild as HTMLElement).style.width).toBe('100%')
    unmount()

    render(<ProgressBar value={-4} max={10} label="p" valueText="" />)
    const under = screen.getByRole('progressbar')
    expect(under).toHaveAttribute('aria-valuenow', '0')
    expect((under.firstElementChild as HTMLElement).style.width).toBe('0%')
  })

  it('copes with a maximum of zero', () => {
    render(<ProgressBar value={0} max={0} label="p" valueText="" />)

    expect(
      (screen.getByRole('progressbar').firstElementChild as HTMLElement).style
        .width,
    ).toBe('0%')
  })
})
