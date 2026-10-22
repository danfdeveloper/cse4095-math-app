import {
  PRAISE_ACCURACY,
  PRAISE_MESSAGES,
  SUPPORT_MESSAGES,
} from '../constants/feedbackMessages'

/** Praise for a good result; support for a mistake, or a session that was hard. */
export type FeedbackKind = 'praise' | 'support'

/** What a message is for a question the student says they got right or wrong. */
export function feedbackKindForResult(selfReportedCorrect: boolean) {
  return selfReportedCorrect ? 'praise' : 'support'
}

/** What a message is for a whole session, from its accuracy (a percentage). */
export function feedbackKindForSession(accuracy: number): FeedbackKind {
  return accuracy >= PRAISE_ACCURACY ? 'praise' : 'support'
}

/**
 * A message picked at random, never the same one twice in a row, so that the
 * messages stay a pleasant surprise instead of a repeating sound bite. Pass the
 * previous message to avoid it. `random` is for tests.
 */
export function pickFeedback(
  kind: FeedbackKind,
  previous?: string,
  random: () => number = Math.random,
): string {
  const pool = kind === 'praise' ? PRAISE_MESSAGES : SUPPORT_MESSAGES
  const choices = pool.filter((message) => message !== previous)
  return choices[
    Math.min(Math.floor(random() * choices.length), choices.length - 1)
  ]
}
