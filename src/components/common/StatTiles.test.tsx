import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatTiles } from './StatTiles'

describe('StatTiles', () => {
  const tiles = [
    { label: 'Correct', value: 7 },
    { label: 'Accuracy', value: '70%' },
  ]

  it('shows each label with its value', () => {
    render(<StatTiles tiles={tiles} />)

    expect(
      screen.getByText('Correct', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('7')
    expect(
      screen.getByText('Accuracy', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('70%')
  })

  it('puts the label before the value in the page, so it is read first', () => {
    render(<StatTiles tiles={tiles} />)

    const label = screen.getByText('Correct', { selector: 'dt' })
    expect(label.nextElementSibling?.tagName).toBe('DD')
  })

  it('shows zero as a number', () => {
    render(<StatTiles tiles={[{ label: 'Incorrect', value: 0 }]} />)

    expect(
      screen.getByText('Incorrect', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('0')
  })

  it('renders nothing but an empty list for no tiles', () => {
    const { container } = render(<StatTiles tiles={[]} />)

    expect(container.querySelectorAll('dt')).toHaveLength(0)
  })
})
