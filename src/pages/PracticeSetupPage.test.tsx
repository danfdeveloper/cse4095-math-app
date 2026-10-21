import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { initialPracticeSessionState } from '../app/practiceSessionState'
import { STORAGE_KEYS } from '../services/storageService'
import { makeMistakePattern } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { stored } from '../test/storage'

const startButton = () => screen.getByRole('button', { name: 'Start Session' })

async function chooseOperation(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('checkbox', { name }))
}

async function chooseDifficulty(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('radio', { name }))
}

describe('PracticeSetupPage', () => {
  it('shows the operation, difficulty, and session-length selectors', () => {
    renderApp('/practice/setup')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Practice Setup' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'What do you want to practice?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'How hard should it be?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'How many questions?' }),
    ).toBeInTheDocument()
  })

  describe('Start Session button', () => {
    it('is disabled until an operation is chosen', () => {
      renderApp('/practice/setup')

      expect(startButton()).toBeDisabled()
    })

    it('stays disabled with a difficulty but no operation', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseDifficulty(user, 'Level 1: Beginner')

      expect(startButton()).toBeDisabled()
    })

    it('is enabled once an operation is chosen, since a difficulty is always picked', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')

      expect(startButton()).toBeEnabled()
    })

    it('is enabled with an operation and a difficulty the student chose', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 3: Intermediate')

      expect(startButton()).toBeEnabled()
    })

    it('is disabled again if the last operation is deselected', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 1: Beginner')

      await chooseOperation(user, 'Addition')

      expect(startButton()).toBeDisabled()
    })
  })

  describe('validation message', () => {
    it('explains what is missing when no operation is chosen', () => {
      renderApp('/practice/setup')

      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose at least one operation to start.',
      )
      expect(startButton()).toHaveAccessibleDescription(
        'Choose at least one operation to start.',
      )
    })

    it('asks for an operation when only a difficulty is chosen', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseDifficulty(user, 'Level 2: Easy')

      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose at least one operation to start.',
      )
    })

    it('goes away when the configuration is valid', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Division')
      await chooseDifficulty(user, 'Level 2: Easy')

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('starting a session', () => {
    // The chosen setup is kept in the shared practice state, which the probe reads.
    it('starts a session with the chosen setup', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Multiplication')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().session).toMatchObject({
        operations: ['addition', 'multiplication'],
        difficulty: 3,
        sessionLength: 20,
        attempted: 0,
      })
      expect(probe().isActive).toBe(true)
    })

    it('shows the first question of the session it started', async () => {
      const user = userEvent.setup()
      renderApp('/practice/setup')

      await chooseOperation(user, 'Multiplication')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(screen.getByRole('radio', { name: '20 questions' }))
      await user.click(startButton())

      expect(screen.getByText('Question 1 of 20')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        /^\d+ × \d+ = \?$/,
      )
    })

    it('uses the default session length when it is not changed', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Subtraction')
      await chooseDifficulty(user, 'Level 1: Beginner')
      await user.click(startButton())

      expect(probe().session).toMatchObject({
        operations: ['subtraction'],
        difficulty: 1,
        sessionLength: 10,
      })
    })

    it('starts with all four operations when "Mixed operations" is chosen', async () => {
      const user = userEvent.setup()
      const { probe } = renderApp('/practice/setup')

      await chooseOperation(user, 'Mixed operations')
      await chooseDifficulty(user, 'Level 4: Advanced')
      await user.click(
        screen.getByRole('radio', { name: 'Continuous practice' }),
      )
      await user.click(startButton())

      expect(probe().session).toMatchObject({
        operations: ['addition', 'subtraction', 'multiplication', 'division'],
        difficulty: 4,
        sessionLength: 'continuous',
      })
    })

    it('does not start when no operation is chosen', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(probe().session).toBeNull()
    })

    it('can be completed using only the keyboard', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')

      screen.getByRole('checkbox', { name: 'Addition' }).focus()
      await user.keyboard(' ')
      screen.getByRole('radio', { name: 'Level 2: Easy' }).focus()
      await user.keyboard(' ')
      startButton().focus()
      await user.keyboard('{Enter}')

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().session).toMatchObject({
        operations: ['addition'],
        difficulty: 2,
        sessionLength: 10,
      })
    })

    it('starts a fresh session each time', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderApp('/practice/setup')
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 1: Beginner')
      await user.click(startButton())
      const firstId = probe().session?.id

      // Back to a new, empty setup page, then start again.
      await act(() => router.navigate('/practice/setup'))
      await chooseOperation(user, 'Division')
      await chooseDifficulty(user, 'Level 2: Easy')
      await user.click(startButton())

      expect(probe().session?.id).not.toBe(firstId)
      expect(probe().session?.operations).toEqual(['division'])
    })
  })

  describe('when opened from a session summary', () => {
    const previous = {
      operations: ['subtraction', 'division'],
      difficulty: 3,
      sessionLength: 20,
    }
    const openWith = (state: unknown) =>
      renderApp({ pathname: '/practice/setup', state })

    it('starts from that session\u2019s choices', () => {
      openWith({ config: previous })

      expect(
        screen.getByRole('checkbox', { name: 'Subtraction' }),
      ).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
      expect(
        screen.getByRole('checkbox', { name: 'Addition' }),
      ).not.toBeChecked()
      expect(
        screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: '20 questions' })).toBeChecked()
    })

    it('can start straight away, with no validation message', () => {
      openWith({ config: previous })

      expect(startButton()).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('works with continuous practice', () => {
      openWith({ config: { ...previous, sessionLength: 'continuous' } })

      expect(
        screen.getByRole('radio', { name: 'Continuous practice' }),
      ).toBeChecked()
    })

    it.each([
      [
        'an unusable setup',
        { config: { operations: [], difficulty: 3, sessionLength: 20 } },
      ],
      ['state without a setup', { somethingElse: true }],
      ['state that is not an object', 'nonsense'],
      ['no state at all', null],
    ])('ignores %s and starts from the defaults', (_, state) => {
      openWith(state)

      for (const box of screen.getAllByRole('checkbox'))
        expect(box).not.toBeChecked()
      expect(
        screen.getByRole('radio', { name: 'Level 1: Beginner' }),
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: '10 questions' })).toBeChecked()
      expect(startButton()).toBeDisabled()
    })

    it('does not carry the choices over to a later visit', async () => {
      const { router } = openWith({ config: previous })

      await act(() => router.navigate('/practice/summary'))
      await act(() => router.navigate('/practice/setup'))

      for (const box of screen.getAllByRole('checkbox'))
        expect(box).not.toBeChecked()
    })
  })
})

describe('PracticeSetupPage with saved defaults', () => {
  const saveDefaults = () =>
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        defaultOperations: ['subtraction', 'division'],
        defaultDifficulty: 3,
        defaultSessionLength: 20,
      }),
    )

  it('starts with the saved operations, difficulty and length picked', () => {
    saveDefaults()
    renderApp('/practice/setup')

    expect(screen.getByRole('checkbox', { name: 'Subtraction' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Addition' })).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Multiplication' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: '20 questions' })).toBeChecked()
  })

  it('can start straight away, and starts the saved setup', async () => {
    const user = userEvent.setup()
    saveDefaults()
    const { router, probe } = renderApp('/practice/setup')

    expect(startButton()).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(startButton())

    expect(router.state.location.pathname).toBe('/practice/session')
    expect(probe().session).toMatchObject({
      operations: ['subtraction', 'division'],
      difficulty: 3,
      sessionLength: 20,
    })
  })

  it('lets one session differ without changing the saved defaults', async () => {
    const user = userEvent.setup()
    saveDefaults()
    const { router, probe } = renderApp('/practice/setup')

    await chooseOperation(user, 'Addition')
    await chooseOperation(user, 'Division')
    await chooseDifficulty(user, 'Level 4: Advanced')
    await user.click(screen.getByRole('radio', { name: 'Continuous practice' }))
    await user.click(startButton())

    expect(probe().session).toMatchObject({
      operations: ['addition', 'subtraction'],
      difficulty: 4,
      sessionLength: 'continuous',
    })
    expect(stored(STORAGE_KEYS.settings)).toEqual({
      defaultOperations: ['subtraction', 'division'],
      defaultDifficulty: 3,
      defaultSessionLength: 20,
    })

    await act(() => router.navigate('/practice/setup'))
    expect(screen.getByRole('checkbox', { name: 'Division' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Addition' })).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Level 3: Intermediate' }),
    ).toBeChecked()
  })

  it('does not change the saved defaults just by opening the page', () => {
    saveDefaults()
    renderApp('/practice/setup')

    expect(stored(STORAGE_KEYS.settings)).toEqual({
      defaultOperations: ['subtraction', 'division'],
      defaultDifficulty: 3,
      defaultSessionLength: 20,
    })
  })

  it('prefers the choices of the session the student came from', () => {
    saveDefaults()
    renderApp({
      pathname: '/practice/setup',
      state: {
        config: {
          operations: ['multiplication'],
          difficulty: 1,
          sessionLength: 5,
        },
      },
    })

    expect(
      screen.getByRole('checkbox', { name: 'Multiplication' }),
    ).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Division' })).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Level 1: Beginner' }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: '5 questions' })).toBeChecked()
  })
})

describe('PracticeSetupPage and practicing mistakes', () => {
  const addition = (a: number, b: number, overrides = {}) =>
    makeMistakePattern({
      operation: 'addition',
      firstOperand: a,
      secondOperand: b,
      correctAnswer: a + b,
      difficulty: 2,
      ...overrides,
    })
  const division = (overrides = {}) =>
    makeMistakePattern({
      operation: 'division',
      firstOperand: 56,
      secondOperand: 7,
      correctAnswer: 8,
      difficulty: 3,
      ...overrides,
    })

  function renderSetup(
    patterns: ReturnType<typeof makeMistakePattern>[],
    entry: Parameters<typeof renderApp>[0] = '/practice/setup',
  ) {
    return renderApp(entry, {
      initialState: {
        ...initialPracticeSessionState,
        mistakePatterns: patterns,
      },
    })
  }
  const mistakesOption = () =>
    screen.getByRole('radio', { name: 'Practice mistakes' })
  const regularOption = () =>
    screen.getByRole('radio', { name: 'Regular practice' })

  it('offers regular practice and mistake practice, with regular chosen', () => {
    renderSetup([addition(12, 15)])

    expect(
      screen.getByRole('group', { name: 'What kind of practice?' }),
    ).toBeInTheDocument()
    expect(regularOption()).toBeChecked()
    expect(mistakesOption()).not.toBeChecked()
  })

  describe('with no mistakes', () => {
    it('disables mistake practice, and says why', () => {
      renderSetup([])

      expect(mistakesOption()).toBeDisabled()
      expect(mistakesOption()).toHaveAccessibleDescription(
        'No mistakes to practice yet. Questions you get wrong will show up here.',
      )
    })

    it('treats only mastered mistakes as none', () => {
      renderSetup([
        addition(12, 15, { mastered: true, similarCorrectCount: 3 }),
      ])

      expect(mistakesOption()).toBeDisabled()
    })

    it('still starts regular practice as before', async () => {
      const user = userEvent.setup()
      const { probe } = renderSetup([])
      await chooseOperation(user, 'Addition')

      await user.click(startButton())

      expect(probe().session?.mode).toBeUndefined()
      expect(probe().currentQuestion?.source).toBe('regular')
    })
  })

  describe('with mistakes', () => {
    it('enables mistake practice and shows how many mistakes there are to practice', () => {
      renderSetup([addition(12, 15), addition(21, 9), division()])

      expect(mistakesOption()).toBeEnabled()
      expect(mistakesOption()).toHaveAccessibleDescription(
        '3 mistakes to practice. Questions like the ones you got wrong.',
      )
    })

    it('counts one mistake as "1 mistake"', () => {
      renderSetup([addition(12, 15)])

      expect(mistakesOption()).toHaveAccessibleDescription(
        '1 mistake to practice. Questions like the ones you got wrong.',
      )
    })

    it('does not count mastered mistakes', () => {
      renderSetup([
        addition(12, 15),
        addition(21, 9, { mastered: true, similarCorrectCount: 3 }),
      ])

      expect(mistakesOption()).toHaveAccessibleDescription(
        '1 mistake to practice. Questions like the ones you got wrong.',
      )
    })

    it('counts every operation and level, whatever is picked above', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15), division()])
      await chooseOperation(user, 'Multiplication')
      await chooseDifficulty(user, 'Level 4: Advanced')

      expect(mistakesOption()).toHaveAccessibleDescription(
        '2 mistakes to practice. Questions like the ones you got wrong.',
      )
    })
  })

  describe('starting a mistake-review session', () => {
    it('starts one for the mistakes the choices cover', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSetup([
        addition(12, 15),
        addition(21, 9),
        division(),
      ])
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 2: Easy')
      await user.click(mistakesOption())

      expect(startButton()).toBeEnabled()
      await user.click(startButton())

      expect(router.state.location.pathname).toBe('/practice/session')
      expect(probe().session).toMatchObject({
        mode: 'mistake-review',
        operations: ['addition'],
        difficulty: 2,
        sessionLength: 10,
      })
      expect(probe().currentQuestion?.source).toBe('mistake-review')
      expect([addition(12, 15).id, addition(21, 9).id]).toContain(
        probe().currentQuestion?.mistakePatternId,
      )
      expect(screen.getByText('Mistake practice')).toBeVisible()
    })

    it('uses the question count that was chosen', async () => {
      const user = userEvent.setup()
      const { probe } = renderSetup([addition(12, 15)])
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 2: Easy')
      await user.click(screen.getByRole('radio', { name: '5 questions' }))
      await user.click(mistakesOption())

      await user.click(startButton())

      expect(probe().session?.sessionLength).toBe(5)
      expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    })

    it('still needs an operation, and says so first', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15)])

      await user.click(mistakesOption())

      expect(startButton()).toBeDisabled()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose at least one operation to start.',
      )
    })

    it('needs a mistake that the choices cover, and says so in words', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15)]) // Level 2 addition
      await chooseOperation(user, 'Addition') // the page starts on Level 1

      await user.click(mistakesOption())

      expect(startButton()).toBeDisabled()
      expect(screen.getByRole('status')).toHaveTextContent(
        'You have no mistakes to practice for these choices. Try other operations or another level.',
      )
      expect(startButton()).toHaveAccessibleDescription(
        'You have no mistakes to practice for these choices. Try other operations or another level.',
      )
    })

    it('becomes ready when the choices come to cover a mistake', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15)])
      await chooseOperation(user, 'Addition')
      await user.click(mistakesOption())
      expect(startButton()).toBeDisabled()

      await chooseDifficulty(user, 'Level 2: Easy')

      expect(startButton()).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('becomes ready again after going back to regular practice', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15)])
      await chooseOperation(user, 'Multiplication')
      await user.click(mistakesOption())
      expect(startButton()).toBeDisabled()

      await user.click(regularOption())

      expect(startButton()).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('does not count mistakes of an operation that is not picked', async () => {
      const user = userEvent.setup()
      renderSetup([division()])
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 3: Intermediate')
      await user.click(mistakesOption())

      expect(startButton()).toBeDisabled()

      await chooseOperation(user, 'Division')
      expect(startButton()).toBeEnabled()
    })

    it('does not start when the form is submitted anyway', async () => {
      const user = userEvent.setup()
      const { router, probe } = renderSetup([addition(12, 15)])
      await chooseOperation(user, 'Multiplication')
      await user.click(mistakesOption())

      fireEvent.submit(
        screen.getByRole('button', { name: 'Start Session' }).closest('form')!,
      )

      expect(router.state.location.pathname).toBe('/practice/setup')
      expect(probe().session).toBeNull()
    })

    it('does not change the saved settings', async () => {
      const user = userEvent.setup()
      renderSetup([addition(12, 15)])
      await chooseOperation(user, 'Addition')
      await chooseDifficulty(user, 'Level 2: Easy')
      await user.click(mistakesOption())

      await user.click(startButton())

      expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
    })

    it('starts every session as regular practice on a later visit', async () => {
      const user = userEvent.setup()
      const { router } = renderSetup([addition(12, 15)])
      await user.click(mistakesOption())

      await act(() => router.navigate('/'))
      await act(() => router.navigate('/practice/setup'))

      expect(regularOption()).toBeChecked()
    })
  })

  describe('when opened from a session summary', () => {
    const fromSummary = (mode?: 'mistake-review' | 'regular') => ({
      pathname: '/practice/setup',
      state: {
        config: {
          operations: ['addition'],
          difficulty: 2,
          sessionLength: 5,
          ...(mode === undefined ? {} : { mode }),
        },
      },
    })

    it('keeps mistake practice if the session was, and there are mistakes to practice', () => {
      renderSetup([addition(12, 15)], fromSummary('mistake-review'))

      expect(mistakesOption()).toBeChecked()
      expect(startButton()).toBeEnabled()
    })

    it('goes back to regular practice if there are no mistakes left to practice', () => {
      renderSetup(
        [addition(12, 15, { mastered: true, similarCorrectCount: 3 })],
        fromSummary('mistake-review'),
      )

      expect(regularOption()).toBeChecked()
      expect(mistakesOption()).toBeDisabled()
    })

    it.each([[undefined], ['regular' as const]])(
      'stays regular for a session of mode %j',
      (mode) => {
        renderSetup([addition(12, 15)], fromSummary(mode))

        expect(regularOption()).toBeChecked()
      },
    )
  })
})
