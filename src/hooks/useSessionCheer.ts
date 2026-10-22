import { useState } from 'react'
import { feedbackKindForSession, pickFeedback } from '../services/feedback'
import { useSettings } from './useSettings'

/**
 * The cheerful message for the end of a session, or null when feedback effects
 * are off or nothing was answered. It is picked once, when the page opens, and
 * kept, so that it does not change each time the page is drawn again.
 */
export function useSessionCheer(
  attempted: number,
  accuracy: number,
): string | null {
  const { settings } = useSettings()
  const [cheer] = useState(() =>
    settings.feedbackEffectsEnabled && attempted > 0
      ? pickFeedback(feedbackKindForSession(accuracy))
      : null,
  )
  return cheer
}
