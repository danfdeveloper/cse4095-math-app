import { fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAnswerShortcuts } from './useAnswerShortcuts'

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element | Document = document,
) {
  return fireEvent.keyDown(target, { key, ...init })
}

function setup(
  options: Partial<Parameters<typeof useAnswerShortcuts>[0]> = {},
) {
  const onChoose = vi.fn()
  const hook = renderHook(
    (props: Parameters<typeof useAnswerShortcuts>[0]) =>
      useAnswerShortcuts(props),
    { initialProps: { enabled: true, count: 4, onChoose, ...options } },
  )
  return { onChoose, ...hook }
}

describe('useAnswerShortcuts', () => {
  it.each([
    ['1', 0],
    ['2', 1],
    ['3', 2],
    ['4', 3],
  ])('picks choice %s with the key %s', (key, position) => {
    const { onChoose } = setup()

    press(key)

    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith(position)
  })

  it.each([
    '5',
    '9',
    '0',
    'a',
    'Enter',
    ' ',
    'ArrowDown',
    '-',
    'Tab',
    'Escape',
  ])('ignores the key %j', (key) => {
    const { onChoose } = setup()

    press(key)

    expect(onChoose).not.toHaveBeenCalled()
  })

  it('only uses as many keys as there are choices', () => {
    const { onChoose } = setup({ count: 2 })

    press('3')
    press('4')
    expect(onChoose).not.toHaveBeenCalled()

    press('2')
    expect(onChoose).toHaveBeenCalledWith(1)
  })

  it('does nothing while it is off', () => {
    const { onChoose } = setup({ enabled: false })

    press('1')

    expect(onChoose).not.toHaveBeenCalled()
  })

  it('starts and stops with its being turned on and off', () => {
    const { onChoose, rerender } = setup({ enabled: false })
    rerender({ enabled: true, count: 4, onChoose })
    press('1')
    expect(onChoose).toHaveBeenCalledTimes(1)

    rerender({ enabled: false, count: 4, onChoose })
    press('1')
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('stops listening when it is no longer used', () => {
    const { onChoose, unmount } = setup()
    unmount()

    press('1')

    expect(onChoose).not.toHaveBeenCalled()
  })

  it('uses the latest function it is given', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = setup({ onChoose: first })
    rerender({ enabled: true, count: 4, onChoose: second })

    press('1')

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  describe('leaves the key to the page', () => {
    it.each([
      ['Ctrl', { ctrlKey: true }],
      ['Alt', { altKey: true }],
      ['Cmd', { metaKey: true }],
    ])('when %s is held, as in the browser’s own shortcuts', (_, modifier) => {
      const { onChoose } = setup()

      press('1', modifier)

      expect(onChoose).not.toHaveBeenCalled()
    })

    it('when Shift is held, as it makes no other key', () => {
      // Shift+1 types "!" on most keyboards, so its key is not "1".
      const { onChoose } = setup()

      press('!', { shiftKey: true })

      expect(onChoose).not.toHaveBeenCalled()
    })

    it('when the key is held down and repeats', () => {
      const { onChoose } = setup()

      press('1', { repeat: true })

      expect(onChoose).not.toHaveBeenCalled()
    })

    it('when something else has already used it', () => {
      const { onChoose } = setup()
      document.addEventListener('keydown', (event) => event.preventDefault(), {
        once: true,
        capture: true,
      })

      press('1')

      expect(onChoose).not.toHaveBeenCalled()
    })

    it.each([
      ['a text box', '<input type="text" />'],
      ['a number box', '<input type="number" />'],
      ['a text area', '<textarea></textarea>'],
      ['a menu', '<select><option>1</option></select>'],
      ['an editable area', '<div contenteditable="true">x</div>'],
    ])('when typing in %s', (_, html) => {
      const { onChoose } = setup()
      const { container } = render(
        <div dangerouslySetInnerHTML={{ __html: html }} />,
      )
      const field = container.firstElementChild!
        .firstElementChild as HTMLElement
      // jsdom does not work out contenteditable from the attribute alone.
      if (field.getAttribute('contenteditable') === 'true') {
        Object.defineProperty(field, 'isContentEditable', { value: true })
      }

      press('1', {}, field)

      expect(onChoose).not.toHaveBeenCalled()
    })

    it('when a dialog is open', () => {
      const { onChoose } = setup()
      const dialog = document.createElement('dialog')
      dialog.setAttribute('open', '')
      document.body.appendChild(dialog)

      press('1')
      expect(onChoose).not.toHaveBeenCalled()

      dialog.remove()
      press('1')
      expect(onChoose).toHaveBeenCalledTimes(1)
    })
  })

  it('works when focus is on a button, which does not use the number keys', () => {
    const { onChoose } = setup()
    const { container } = render(<button>Flip Card</button>)
    const button = container.querySelector('button')!
    button.focus()

    press('3', {}, button)

    expect(onChoose).toHaveBeenCalledWith(2)
  })

  it('stops the key from doing anything else', () => {
    setup()

    const notCancelled = press('1')

    // fireEvent returns false when preventDefault was called.
    expect(notCancelled).toBe(false)
  })

  it('does not stop other keys from doing what they do', () => {
    setup()

    expect(press('Tab')).toBe(true)
    expect(press('7')).toBe(true)
  })
})
