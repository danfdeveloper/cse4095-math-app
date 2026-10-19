import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

function mainNav() {
  return within(screen.getByRole('navigation', { name: 'Main' }))
}

describe('Navigation', () => {
  it('links to each top-level section', () => {
    renderApp('/')

    expect(mainNav().getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(mainNav().getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'href',
      '/practice/setup',
    )
    expect(mainNav().getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'href',
      '/statistics',
    )
    expect(mainNav().getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('marks Home as current only on the home page', () => {
    renderApp('/')
    expect(mainNav().getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('does not mark Home as current on other pages', () => {
    renderApp('/statistics')

    expect(mainNav().getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(mainNav().getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it.each(['/practice/setup', '/practice/session', '/practice/summary'])(
    'marks Practice as current on %s',
    (path) => {
      renderApp(path)

      expect(mainNav().getByRole('link', { name: 'Practice' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    },
  )

  it('marks nothing as current on an unknown page', () => {
    renderApp('/no/such/page')

    for (const link of mainNav().getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })
})
