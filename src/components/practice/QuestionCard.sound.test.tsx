import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeQuestion } from '../../test/fixtures'
import { QuestionCard } from './QuestionCard'

function renderCard() {
  const onSound = vi.fn()
  render(
    <QuestionCard
      question={makeQuestion()}
      questionNumber={1}
      onResult={() => {}}
      onSound={onSound}
    />,
  )
  return onSound
}
const button = (name: string) => screen.getByRole('button', { name })

describe('QuestionCard sounds', () => {
  it('makes no sound just for appearing', () => {
    expect(renderCard()).not.toHaveBeenCalled()
  })

  it('ticks for a pick, by click or by number key', async () => {
    const user = userEvent.setup()
    const onSound = renderCard()

    await user.click(button('48'))
    await user.keyboard('2')

    expect(onSound.mock.calls).toEqual([['pick'], ['pick']])
  })

  it('swoops for the flip, and not for a flip that cannot happen yet', async () => {
    const user = userEvent.setup()
    const onSound = renderCard()

    await user.click(button('Flip Card'))
    expect(onSound).not.toHaveBeenCalled()

    await user.click(button('56'))
    await user.click(button('Flip Card'))
    expect(onSound).toHaveBeenLastCalledWith('flip')
  })

  it.each([
    ['I Got It Right', 'right'],
    ['I Got It Wrong', 'wrong'],
  ])(
    'plays the %s sound once, however often it is pressed',
    async (name, effect) => {
      const user = userEvent.setup()
      const onSound = renderCard()
      await user.click(button('56'))
      await user.click(button('Flip Card'))
      onSound.mockClear()

      await user.click(button(name))
      await user.click(button(name))

      expect(onSound.mock.calls).toEqual([[effect]])
    },
  )

  it('plays nothing when there is no sound to play (sound effects off)', async () => {
    const user = userEvent.setup()
    render(
      <QuestionCard
        question={makeQuestion()}
        questionNumber={1}
        onResult={() => {}}
      />,
    )

    await user.click(button('56'))
    await user.click(button('Flip Card'))

    expect(button('I Got It Right')).toBeEnabled()
  })
})
