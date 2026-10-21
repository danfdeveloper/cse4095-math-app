import { useMemo } from 'react'
import {
  buildMistakeStatistics,
  splitMistakes,
  type MistakeStatistics,
} from '../services/mistakeStatistics'
import type { MistakePattern } from '../types/mistake'
import { usePracticeSession } from './usePracticeSession'

export interface MistakeView {
  summary: MistakeStatistics
  /** Mistakes still to practice, most missed first. */
  active: MistakePattern[]
  mastered: MistakePattern[]
  /** False until something has been answered incorrectly. */
  hasMistakes: boolean
}

/** What the statistics page shows about mistakes, worked out from the saved mistakes and attempts. */
export function useMistakeStatistics(): MistakeView {
  const { mistakePatterns, attempts } = usePracticeSession()

  return useMemo(() => {
    const { active, mastered } = splitMistakes(mistakePatterns)
    return {
      summary: buildMistakeStatistics(mistakePatterns, attempts),
      active,
      mastered,
      hasMistakes: mistakePatterns.length > 0,
    }
  }, [mistakePatterns, attempts])
}
