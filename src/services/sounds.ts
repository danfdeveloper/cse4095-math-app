/**
 * The app's sound effects (the "Sound effects" setting, specification section
 * 6.7). Each is a short, quiet tone made by the browser itself, so there are
 * no sound files to download. A sound that cannot play, because the browser
 * has no Web Audio or refuses it, is simply skipped: it never stops practice.
 */
export type SoundEffect = 'pick' | 'flip' | 'right' | 'wrong'

interface Note {
  /** Pitch at the start and end, in Hz: a slide when they differ. */
  from: number
  to: number
  /** Seconds after the sound starts. */
  at: number
  /** Seconds. */
  length: number
  wave: OscillatorType
}

/**
 * Soft and short. Getting one right is two notes going up; getting one wrong
 * is a single low, gentle note, never a buzzer, so it does not feel like a
 * telling-off.
 */
export const SOUND_NOTES: Record<SoundEffect, readonly Note[]> = {
  pick: [{ from: 880, to: 880, at: 0, length: 0.05, wave: 'sine' }],
  flip: [{ from: 330, to: 660, at: 0, length: 0.14, wave: 'triangle' }],
  right: [
    { from: 523.25, to: 523.25, at: 0, length: 0.12, wave: 'sine' },
    { from: 659.25, to: 659.25, at: 0.11, length: 0.18, wave: 'sine' },
  ],
  wrong: [{ from: 392, to: 349.23, at: 0, length: 0.22, wave: 'sine' }],
}

/** Loud enough to hear, quiet enough for a classroom. */
export const SOUND_VOLUME = 0.08

let context: AudioContext | null = null

/** One shared audio context, made the first time a sound is wanted. */
function audio(): AudioContext | null {
  if (context !== null) return context
  const Context =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
  if (Context === undefined) return null
  context = new Context()
  return context
}

/** Plays a sound effect. Never throws. */
export function playSound(effect: SoundEffect): void {
  try {
    const sound = audio()
    if (sound === null) return
    // A browser may start the context paused until the page is touched; a tap has just happened.
    if (sound.state === 'suspended') void sound.resume()
    const start = sound.currentTime
    for (const note of SOUND_NOTES[effect]) {
      const oscillator = sound.createOscillator()
      const volume = sound.createGain()
      const begin = start + note.at
      const end = begin + note.length
      oscillator.type = note.wave
      oscillator.frequency.setValueAtTime(note.from, begin)
      oscillator.frequency.linearRampToValueAtTime(note.to, end)
      // A quick fade in and out, so a note never clicks.
      volume.gain.setValueAtTime(0, begin)
      volume.gain.linearRampToValueAtTime(SOUND_VOLUME, begin + 0.01)
      volume.gain.linearRampToValueAtTime(0, end)
      oscillator.connect(volume)
      volume.connect(sound.destination)
      oscillator.start(begin)
      oscillator.stop(end + 0.02)
    }
  } catch {
    // No sound this time; practice goes on.
  }
}

/** Forgets the shared audio context. For tests. */
export function resetSoundsForTests(): void {
  context = null
}
