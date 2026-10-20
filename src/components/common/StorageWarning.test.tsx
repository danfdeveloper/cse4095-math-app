import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../../services/storageService'
import { activeSessionState } from '../../test/fixtures'
import { renderApp } from '../../test/renderApp'
import { blockStorage, fillStorage } from '../../test/storage'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

const warning = () => screen.queryByRole('alert')

describe('StorageWarning', () => {
  it('shows nothing when saving works', () => {
    renderApp('/')

    expect(warning()).not.toBeInTheDocument()
  })

  describe('when storage is unavailable', () => {
    it('warns on the first screen, kindly and in plain words', () => {
      restore = blockStorage()

      renderApp('/')

      expect(warning()).toHaveTextContent('Heads up:')
      expect(warning()).toHaveTextContent('cannot be saved in this browser')
      expect(warning()).toHaveTextContent('keep practicing')
    })

    it('does not use alarming or technical words', () => {
      restore = blockStorage()

      renderApp('/')

      expect(warning()?.textContent).not.toMatch(
        /error|exception|localStorage|quota|fail|crash|denied|SecurityError/i,
      )
    })

    it('appears on every page, since it is part of the layout', () => {
      restore = blockStorage()

      renderApp('/statistics')

      expect(warning()).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { level: 1, name: 'Statistics' }),
      ).toBeInTheDocument()
    })

    it('can be dismissed with an OK button, and then goes away', async () => {
      const user = userEvent.setup()
      restore = blockStorage()
      renderApp('/')

      await user.click(screen.getByRole('button', { name: 'OK' }))

      expect(warning()).not.toBeInTheDocument()
    })

    it('does not stop the app from working', async () => {
      const user = userEvent.setup()
      restore = blockStorage()
      const { router } = renderApp('/')

      await user.click(screen.getByRole('link', { name: 'Start Practice' }))

      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(
        screen.getByRole('heading', { level: 1, name: 'Practice Setup' }),
      ).toBeInTheDocument()
    })
  })

  describe('when storage is full', () => {
    it('warns during practice, and practice continues', async () => {
      const user = userEvent.setup()
      renderApp('/practice/session', {
        initialState: activeSessionState({ sessionLength: 'continuous' }),
      })
      // Saving worked at the start; now there is no room.
      restore = fillStorage()

      const choices = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-pressed') !== null)
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))
      await user.click(screen.getByRole('button', { name: 'I Got It Right' }))

      expect(warning()).toHaveTextContent('out of space')
      expect(screen.getByText('Question 2')).toBeInTheDocument()
    })
  })

  describe('when saved data is from a newer version', () => {
    it('explains that it is being left alone', () => {
      window.localStorage.setItem(STORAGE_KEYS.version, '{"version":9}')

      renderApp('/')

      expect(warning()).toHaveTextContent('newer version of this app')
      expect(warning()).toHaveTextContent('left alone')
    })
  })

  it('is announced to screen readers when it appears', () => {
    restore = blockStorage()

    renderApp('/')

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
