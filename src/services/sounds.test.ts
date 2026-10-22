import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  playSound,
  resetSoundsForTests,
  SOUND_NOTES,
  SOUND_VOLUME,
  type SoundEffect,
} from './sounds'

/** A stand-in for the browser's Web Audio, recording the notes played. */
function fakeAudio(state: AudioContextState = 'running') {
  const notes: { wave: string; start: number; stop: number; peak: number }[] =
    []
  const made = { contexts: 0, resumed: 0 }
  class FakeContext {
    state = state
    currentTime = 10
    destination = {}
    constructor() {
      made.contexts++
    }
    resume() {
      made.resumed++
      return Promise.resolve()
    }
    createOscillator() {
      const note = { wave: '', start: 0, stop: 0, peak: 0 }
      notes.push(note)
      return {
        set type(value: string) {
          note.wave = value
        },
        frequency: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
        start: (at: number) => {
          note.start = at
        },
        stop: (at: number) => {
          note.stop = at
        },
      }
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: (value: number) => {
            const note = notes.at(-1)!
            note.peak = Math.max(note.peak, value)
          },
        },
        connect: () => {},
      }
    }
  }
  vi.stubGlobal('AudioContext', FakeContext)
  return { notes, made }
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetSoundsForTests()
})

describe('playSound', () => {
  it.each(['pick', 'flip', 'right', 'wrong'] as SoundEffect[])(
    'plays the %s sound, quietly and briefly',
    (effect) => {
      const { notes } = fakeAudio()

      playSound(effect)

      expect(notes).toHaveLength(SOUND_NOTES[effect].length)
      for (const note of notes) {
        expect(note.peak).toBe(SOUND_VOLUME)
        expect(note.stop - note.start).toBeLessThan(0.3)
      }
    },
  )

  it('keeps every sound short and quiet, so it never startles', () => {
    expect(SOUND_VOLUME).toBeLessThanOrEqual(0.1)
    for (const notes of Object.values(SOUND_NOTES)) {
      const end = Math.max(...notes.map((note) => note.at + note.length))
      expect(end).toBeLessThanOrEqual(0.3)
    }
  })

  it('makes a mistake sound gentle: one low note, never a harsh buzz', () => {
    const [note] = SOUND_NOTES.wrong
    expect(SOUND_NOTES.wrong).toHaveLength(1)
    expect(note.wave).toBe('sine')
    expect(note.to).toBeLessThanOrEqual(note.from)
    expect(note.from).toBeLessThan(SOUND_NOTES.right[0].from)
  })

  it('makes a right answer two notes going up', () => {
    const [first, second] = SOUND_NOTES.right
    expect(second.from).toBeGreaterThan(first.from)
  })

  it('uses one audio context for every sound', () => {
    const { made } = fakeAudio()

    playSound('pick')
    playSound('flip')
    playSound('right')

    expect(made.contexts).toBe(1)
  })

  it('wakes up an audio context the browser started paused', () => {
    const { made } = fakeAudio('suspended')

    playSound('pick')

    expect(made.resumed).toBe(1)
  })

  it('makes nothing until a sound is wanted', () => {
    const { made } = fakeAudio()

    expect(made.contexts).toBe(0)
  })

  it('stays silent, without an error, in a browser with no Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)

    expect(() => playSound('right')).not.toThrow()
  })

  it('stays silent, without an error, when the browser refuses to make sound', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new DOMException('Not allowed', 'NotAllowedError')
        }
      },
    )

    expect(() => playSound('wrong')).not.toThrow()
  })
})
