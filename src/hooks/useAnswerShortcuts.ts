import { useEffect, useRef } from 'react'

interface AnswerShortcuts {
  /** Off once an answer cannot be changed any more. */
  enabled: boolean
  /** How many choices there are: the keys 1 to this number are used. */
  count: number
  /** Called with the zero-based position of the choice the key stands for. */
  onChoose: (position: number) => void
}

/** Where a key press should be left to the page: typing, or a choice among other controls. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

/**
 * The number keys pick answers (specification section 14): 1 for the first
 * choice shown, 2 for the second, and so on. A key is left alone when it is
 * typed into a field, held down, pressed with Ctrl, Alt or Cmd, already used
 * by something else, or pressed while a dialog is open.
 */
export function useAnswerShortcuts({
  enabled,
  count,
  onChoose,
}: AnswerShortcuts) {
  // The latest callback, so the listener does not need to be put back each time.
  const choose = useRef(onChoose)
  useEffect(() => {
    choose.current = onChoose
  }, [onChoose])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isTypingTarget(event.target) ||
        document.querySelector('dialog[open]') !== null
      ) {
        return
      }

      const position = Number(event.key) - 1
      if (!/^[1-9]$/.test(event.key) || position >= count) return

      event.preventDefault()
      choose.current(position)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, count])
}
