import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/settings'
import { listAppKeys, STORAGE_KEYS } from '../services/storageService'
import { makeAttempt, makeMistakePattern, makeSession } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { blockStorage, breakStorageMethod, stored } from '../test/storage'

type User = ReturnType<typeof userEvent.setup>

const sound = () => screen.getByRole('checkbox', { name: 'Sound effects' })
const animation = () =>
  screen.getByRole('checkbox', { name: 'Card flip animation' })
const explanations = () =>
  screen.getByRole('checkbox', { name: 'Show explanations' })
const clearButton = () =>
  screen.getByRole('button', { name: 'Clear All Application Data' })
const savedSettings = () =>
  stored(STORAGE_KEYS.settings) as Record<string, unknown> | undefined

/** Real data in storage, in every place the app saves something. */
function saveEverything() {
  window.localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      soundEffectsEnabled: true,
      showExplanations: false,
      defaultOperations: ['division'],
      defaultDifficulty: 4,
      defaultSessionLength: 5,
    }),
  )
  window.localStorage.setItem(
    STORAGE_KEYS.sessions,
    JSON.stringify([makeSession()]),
  )
  window.localStorage.setItem(
    STORAGE_KEYS.attempts,
    JSON.stringify([makeAttempt()]),
  )
  window.localStorage.setItem(
    STORAGE_KEYS.mistakePatterns,
    JSON.stringify([makeMistakePattern()]),
  )
  // Something that belongs to another app on the same site.
  window.localStorage.setItem('someOtherApp.theme', 'dark')
}

/** Everything in storage right now, key by key (works with any Storage). */
function snapshot(): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)!
    result[key] = window.localStorage.getItem(key)
  }
  return result
}

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

describe('SettingsPage', () => {
  describe('what it shows', () => {
    it('has a Settings heading and says changes save themselves', () => {
      renderApp('/settings')

      expect(
        screen.getByRole('heading', { level: 1, name: 'Settings' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your changes are saved automatically on this device.',
        ),
      ).toBeVisible()
    })

    it('has a headed section for each kind of setting, in order', () => {
      renderApp('/settings')

      expect(
        screen
          .getAllByRole('heading', { level: 2 })
          .map((heading) => heading.textContent),
      ).toEqual([
        'While you practice',
        'Starting choices',
        'Practicing mistakes',
        'Your data',
      ])
    })

    it('names every group of controls', () => {
      renderApp('/settings')

      for (const name of [
        'Turn these on or off',
        'Which operations are picked to begin with?',
        'Which level is picked to begin with?',
        'How many questions to begin with?',
      ]) {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      }
    })

    it('shows the built-in settings on a first visit', () => {
      renderApp('/settings')

      expect(sound()).not.toBeChecked()
      expect(animation()).toBeChecked()
      expect(explanations()).toBeChecked()
      for (const box of screen
        .getByRole('group', {
          name: 'Which operations are picked to begin with?',
        })
        .querySelectorAll('input'))
        expect(box).not.toBeChecked()
      expect(
        screen.getByRole('radio', { name: 'Level 1: Beginner' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: '10 questions' })).toBeChecked()
    })

    it('shows what was saved last time', () => {
      saveEverything()
      renderApp('/settings')

      expect(sound()).toBeChecked()
      expect(animation()).toBeChecked()
      expect(explanations()).not.toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
      expect(
        screen.getByRole('checkbox', { name: 'Addition' }),
      ).not.toBeChecked()
      expect(
        screen.getByRole('radio', { name: 'Level 4: Advanced' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: '5 questions' })).toBeChecked()
    })

    it('saves nothing just for being opened', () => {
      renderApp('/settings')

      expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
    })

    it('is honest that sounds are not available yet', () => {
      renderApp('/settings')

      expect(sound()).toHaveAccessibleDescription(
        'Sounds are coming soon. Your choice will be remembered.',
      )
    })
  })

  describe('the on-or-off settings', () => {
    it.each([
      ['Sound effects', 'soundEffectsEnabled', false],
      ['Card flip animation', 'cardAnimationEnabled', true],
      ['Show explanations', 'showExplanations', true],
    ] as const)(
      '%s can be turned on and off, and is saved each time',
      async (name, key, startsOn) => {
        const user = userEvent.setup()
        renderApp('/settings')
        const box = () => screen.getByRole('checkbox', { name })
        const expectChecked = (on: boolean) =>
          on ? expect(box()).toBeChecked() : expect(box()).not.toBeChecked()

        await user.click(box())
        expectChecked(!startsOn)
        expect(savedSettings()?.[key]).toBe(!startsOn)

        await user.click(box())
        expectChecked(startsOn)
        expect(savedSettings()?.[key]).toBe(startsOn)
      },
    )

    it('changes only the setting that was clicked', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.click(animation())

      expect(savedSettings()).toEqual({
        ...DEFAULT_SETTINGS,
        cardAnimationEnabled: false,
      })
    })

    it('can be changed with the keyboard alone', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.tab() // skip past the header links to the first setting
      let guard = 0
      while (document.activeElement !== sound() && guard++ < 20)
        await user.tab()
      await user.keyboard(' ')

      expect(sound()).toBeChecked()
      expect(savedSettings()?.soundEffectsEnabled).toBe(true)
    })
  })

  describe('the starting choices', () => {
    it('saves the operations picked, in a steady order', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.click(screen.getByRole('checkbox', { name: 'Division' }))
      await user.click(screen.getByRole('checkbox', { name: 'Addition' }))

      expect(savedSettings()?.defaultOperations).toEqual([
        'addition',
        'division',
      ])
    })

    it('can pick all four with Mixed operations, and then none', async () => {
      const user = userEvent.setup()
      renderApp('/settings')
      const mixed = () =>
        screen.getByRole('checkbox', { name: 'Mixed operations' })

      await user.click(mixed())
      expect(savedSettings()?.defaultOperations).toEqual([
        'addition',
        'subtraction',
        'multiplication',
        'division',
      ])

      await user.click(mixed())
      expect(savedSettings()?.defaultOperations).toEqual([])
    })

    it('saves the level', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.click(
        screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
      )

      expect(savedSettings()?.defaultDifficulty).toBe(3)
      expect(
        screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
      ).toBeChecked()
    })

    it.each([
      ['5 questions', 5],
      ['20 questions', 20],
      ['Continuous practice', 'continuous'],
    ] as const)('saves "%s" as the session length', async (name, length) => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.click(screen.getByRole('radio', { name }))

      expect(savedSettings()?.defaultSessionLength).toBe(length)
    })

    it('is still there after the app is closed and opened again', async () => {
      const user = userEvent.setup()
      const first = renderApp('/settings')
      await user.click(screen.getByRole('checkbox', { name: 'Subtraction' }))
      await user.click(screen.getByRole('radio', { name: 'Level 2: Easy' }))
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(animation())
      first.unmount()

      renderApp('/settings')

      expect(
        screen.getByRole('checkbox', { name: 'Subtraction' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Level 2: Easy' })).toBeChecked()
      expect(screen.getByRole('radio', { name: '20 questions' })).toBeChecked()
      expect(animation()).not.toBeChecked()
    })

    it('is what the practice setup page starts with', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')
      await user.click(screen.getByRole('checkbox', { name: 'Multiplication' }))
      await user.click(screen.getByRole('radio', { name: 'Level 2: Easy' }))
      await user.click(screen.getByRole('radio', { name: '5 questions' }))

      await act(() => router.navigate('/practice/setup'))

      expect(
        screen.getByRole('checkbox', { name: 'Multiplication' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Level 2: Easy' })).toBeChecked()
      expect(screen.getByRole('radio', { name: '5 questions' })).toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Start Session' }),
      ).toBeEnabled()
    })
  })

  describe('the effect on practice', () => {
    async function playToTheBackOfACard(
      user: User,
      router: ReturnType<typeof renderApp>['router'],
    ) {
      await act(() => router.navigate('/practice/setup'))
      await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
      await user.click(screen.getByRole('button', { name: 'Start Session' }))
      const choices = within(screen.getByRole('group')).getAllByRole('button')
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))
    }

    it('shows explanations on the card back when that is on', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')

      await playToTheBackOfACard(user, router)

      expect(
        screen.getByRole('heading', { name: /^How to solve it/ }),
      ).toBeInTheDocument()
    })

    it('leaves explanations out once they are turned off', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')
      await user.click(explanations())

      await playToTheBackOfACard(user, router)

      expect(
        screen.queryByRole('heading', { name: /^How to solve it/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'I Got It Right' }),
      ).toBeEnabled()
    })

    it('stops animating the card once that is turned off', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')
      await user.click(animation())

      await playToTheBackOfACard(user, router)

      expect(document.querySelector('[data-animated]')).toHaveAttribute(
        'data-animated',
        'false',
      )
    })

    it('animates the card by default', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')

      await playToTheBackOfACard(user, router)

      expect(document.querySelector('[data-animated]')).toHaveAttribute(
        'data-animated',
        'true',
      )
    })
  })

  describe('clearing all application data', () => {
    async function openTheQuestion(user: User) {
      await user.click(clearButton())
      return screen.getByRole('dialog', { name: 'Erase everything?' })
    }

    it('says what the button erases', () => {
      renderApp('/settings')

      expect(
        screen.getByText(
          /including your settings, practice history, statistics and mistakes/,
        ),
      ).toBeVisible()
    })

    it('does not ask, or erase anything, until the button is pressed', () => {
      saveEverything()
      renderApp('/settings')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // The four saved items and the version stamp, with nothing erased.
      expect(listAppKeys()).toHaveLength(5)
      expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toContain(
        'attempt-1',
      )
    })

    it('asks first, with a strong warning that it cannot be undone', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      const dialog = await openTheQuestion(user)

      expect(dialog).toHaveAccessibleDescription(
        /permanently erase all of your settings, practice history, statistics and mistakes.*cannot be undone/,
      )
      expect(
        within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
      ).toBeInTheDocument()
    })

    it('puts keyboard focus on the safe choice', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      const dialog = await openTheQuestion(user)

      expect(
        within(dialog).getByRole('button', { name: 'No, Keep My Data' }),
      ).toHaveFocus()
    })

    it('keeps everything when the student says no', async () => {
      const user = userEvent.setup()
      saveEverything()
      const { router } = renderApp('/settings')
      const before = snapshot()

      const dialog = await openTheQuestion(user)
      await user.click(
        within(dialog).getByRole('button', { name: 'No, Keep My Data' }),
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/settings')
      expect(snapshot()).toEqual(before)
      expect(sound()).toBeChecked()
    })

    it('keeps everything when Escape is pressed', async () => {
      const user = userEvent.setup()
      saveEverything()
      const { router } = renderApp('/settings')
      const before = snapshot()

      const dialog = await openTheQuestion(user)
      // jsdom does not turn Escape into this event; a real browser does.
      fireEvent(dialog, new Event('cancel', { cancelable: true }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/settings')
      expect(snapshot()).toEqual(before)
    })

    describe('when confirmed', () => {
      async function confirm(user: User) {
        const dialog = await openTheQuestion(user)
        await user.click(
          within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
        )
      }

      it('returns to the home page and says everything was erased', async () => {
        const user = userEvent.setup()
        saveEverything()
        const { router } = renderApp('/settings')

        await confirm(user)

        expect(router.state.location.pathname).toBe('/')
        expect(screen.getByRole('status')).toHaveTextContent(
          'All of your saved data was erased.',
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      it('erases the settings, sessions, attempts and mistake patterns', async () => {
        const user = userEvent.setup()
        saveEverything()
        renderApp('/settings')

        await confirm(user)

        expect(
          window.localStorage.getItem(STORAGE_KEYS.sessions),
        ).not.toContain('session-1')
        expect(
          window.localStorage.getItem(STORAGE_KEYS.attempts),
        ).not.toContain('attempt-1')
        expect(stored(STORAGE_KEYS.mistakePatterns)).toEqual([])
        expect(savedSettings()).toEqual(DEFAULT_SETTINGS)
      })

      it('leaves other apps’ data alone', async () => {
        const user = userEvent.setup()
        saveEverything()
        renderApp('/settings')

        await confirm(user)

        expect(window.localStorage.getItem('someOtherApp.theme')).toBe('dark')
      })

      it('restores every default, on screen and when the app is opened again', async () => {
        const user = userEvent.setup()
        saveEverything()
        const first = renderApp('/settings')
        await confirm(user)

        await act(() => first.router.navigate('/settings'))
        expect(sound()).not.toBeChecked()
        expect(explanations()).toBeChecked()
        expect(
          screen.getByRole('checkbox', { name: 'Division' }),
        ).not.toBeChecked()
        expect(
          screen.getByRole('radio', { name: 'Level 1: Beginner' }),
        ).toBeChecked()
        expect(
          screen.getByRole('radio', { name: '10 questions' }),
        ).toBeChecked()

        first.unmount()
        renderApp('/settings')
        expect(sound()).not.toBeChecked()
        expect(explanations()).toBeChecked()
        expect(
          screen.getByRole('radio', { name: 'Level 1: Beginner' }),
        ).toBeChecked()
      })

      it('empties the statistics', async () => {
        const user = userEvent.setup()
        saveEverything()
        const { router } = renderApp('/statistics')
        expect(screen.queryByText('No practice yet')).not.toBeInTheDocument()
        await act(() => router.navigate('/settings'))

        await confirm(user)
        await act(() => router.navigate('/statistics'))

        expect(screen.getByText('No practice yet')).toBeVisible()
      })

      it('ends a practice session that was under way', async () => {
        const user = userEvent.setup()
        const { router, probe } = renderApp('/practice/setup')
        await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
        await user.click(screen.getByRole('button', { name: 'Start Session' }))
        expect(probe().session).not.toBeNull()
        await act(() => router.navigate('/settings'))

        await confirm(user)

        expect(probe().session).toBeNull()
        expect(probe().isActive).toBe(false)
      })

      it('does not show the notice again on a later visit to the home page', async () => {
        const user = userEvent.setup()
        const { router } = renderApp('/settings')
        await confirm(user)
        expect(screen.getByRole('status')).toBeInTheDocument()

        await act(() => router.navigate('/practice/setup'))
        await act(() => router.navigate('/'))

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      it('lets the app save again afterwards', async () => {
        const user = userEvent.setup()
        saveEverything()
        const { router } = renderApp('/settings')
        await confirm(user)
        await act(() => router.navigate('/settings'))

        await user.click(animation())

        expect(savedSettings()?.cardAnimationEnabled).toBe(false)
      })

      it('stamps the saved-data version so the next visit reads it normally', async () => {
        const user = userEvent.setup()
        saveEverything()
        renderApp('/settings')

        await confirm(user)

        expect(stored(STORAGE_KEYS.version)).toEqual({ version: 1 })
      })

      it('works the same when the app has nothing saved', async () => {
        const user = userEvent.setup()
        const { router } = renderApp('/settings')

        await confirm(user)

        expect(router.state.location.pathname).toBe('/')
        expect(screen.getByRole('status')).toBeInTheDocument()
      })

      it('recovers an app that was refusing to save because the data came from a newer version', async () => {
        const user = userEvent.setup()
        window.localStorage.setItem(STORAGE_KEYS.version, '{"version":9}')
        window.localStorage.setItem(
          STORAGE_KEYS.attempts,
          JSON.stringify([makeAttempt()]),
        )
        const { router } = renderApp('/settings')
        expect(screen.getByRole('alert')).toHaveTextContent('newer version')
        await user.click(animation()) // not saved: the newer data is left alone
        expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()

        await confirm(user)

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(stored(STORAGE_KEYS.version)).toEqual({ version: 1 })
        await act(() => router.navigate('/settings'))
        await user.click(animation())
        expect(savedSettings()?.cardAnimationEnabled).toBe(false)
      })
    })

    describe('when the browser will not let the data be erased', () => {
      it('says so, and changes nothing', async () => {
        const user = userEvent.setup()
        saveEverything()
        const { router } = renderApp('/settings')
        const before = snapshot()
        restore = breakStorageMethod('removeItem')

        const dialog = await openTheQuestion(user)
        await user.click(
          within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
        )

        expect(screen.getByRole('alert')).toHaveTextContent(
          'Your data could not be erased.',
        )
        expect(router.state.location.pathname).toBe('/settings')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(snapshot()).toEqual(before)
        expect(sound()).toBeChecked()
      })

      it('works when tried again once the browser allows it', async () => {
        const user = userEvent.setup()
        saveEverything()
        const { router } = renderApp('/settings')
        restore = breakStorageMethod('removeItem')
        let dialog = await openTheQuestion(user)
        await user.click(
          within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
        )
        restore()
        restore = undefined

        dialog = await openTheQuestion(user)
        await user.click(
          within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
        )

        expect(router.state.location.pathname).toBe('/')
        expect(window.localStorage.getItem('someOtherApp.theme')).toBe('dark')
        expect(savedSettings()).toEqual(DEFAULT_SETTINGS)
      })
    })

    it('still resets the app when storage is switched off, since nothing is saved', async () => {
      const user = userEvent.setup()
      restore = blockStorage()
      const { router } = renderApp('/settings')
      await user.click(sound())
      expect(sound()).toBeChecked()

      const dialog = await openTheQuestion(user)
      await user.click(
        within(dialog).getByRole('button', { name: 'Yes, Erase Everything' }),
      )

      expect(router.state.location.pathname).toBe('/')
      await act(() => router.navigate('/settings'))
      expect(sound()).not.toBeChecked()
    })
  })

  describe('the number of correct answers that master a mistake', () => {
    const threshold = () =>
      screen.getByRole('combobox', {
        name: 'Correct answers to master a mistake',
      }) as HTMLSelectElement

    it('offers 1 to 10, starting at 3', () => {
      renderApp('/settings')

      expect(threshold().value).toBe('3')
      expect(
        within(threshold())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    })

    it('says what it means and when it applies', () => {
      renderApp('/settings')

      expect(threshold()).toHaveAccessibleDescription(
        /How many similar questions you must get right before a mistake counts as mastered\. A change applies from now on\. Mistakes you have already mastered stay mastered\./,
      )
    })

    it('is in a section of its own', () => {
      renderApp('/settings')

      expect(
        screen.getByRole('region', { name: 'Practicing mistakes' }),
      ).toContainElement(threshold())
    })

    it.each([1, 2, 5, 10])(
      'can be changed to %i, and is saved',
      async (count) => {
        const user = userEvent.setup()
        renderApp('/settings')

        await user.selectOptions(threshold(), String(count))

        expect(threshold().value).toBe(String(count))
        expect(savedSettings()?.masteryThreshold).toBe(count)
      },
    )

    it('is still there after the app is closed and opened again', async () => {
      const user = userEvent.setup()
      const first = renderApp('/settings')
      await user.selectOptions(threshold(), '7')
      first.unmount()

      renderApp('/settings')

      expect(threshold().value).toBe('7')
    })

    it('changes only itself', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      await user.selectOptions(threshold(), '4')

      expect(savedSettings()).toEqual({
        ...DEFAULT_SETTINGS,
        masteryThreshold: 4,
      })
    })

    it('can be reached with Tab', async () => {
      const user = userEvent.setup()
      renderApp('/settings')

      let guard = 0
      while (document.activeElement !== threshold() && guard++ < 60)
        await user.tab()

      // Changing it with the arrow keys is the browser's own behaviour, checked in a real browser.
      expect(threshold()).toHaveFocus()
    })

    it('goes back to 3 when everything is cleared', async () => {
      const user = userEvent.setup()
      const { router } = renderApp('/settings')
      await user.selectOptions(threshold(), '9')

      await user.click(clearButton())
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Yes, Erase Everything',
        }),
      )
      await act(() => router.navigate('/settings'))

      expect(threshold().value).toBe('3')
    })
  })

  describe('the colours of the settings', () => {
    const accentOf = (name: string) =>
      screen
        .getByRole('checkbox', { name })
        .closest('label')!
        .getAttribute('data-accent')

    it('gives each of the three switches a colour of its own', () => {
      renderApp('/settings')

      const colours = [
        'Sound effects',
        'Card flip animation',
        'Show explanations',
      ].map(accentOf)
      expect(colours.every(Boolean)).toBe(true)
      expect(new Set(colours).size).toBe(3)
    })

    it('keeps the check mark for a switch that is on, whatever its colour', () => {
      renderApp('/settings')

      expect(
        screen
          .getByRole('checkbox', { name: 'Show explanations' })
          .closest('label'),
      ).toHaveTextContent('✓')
    })
  })
})
