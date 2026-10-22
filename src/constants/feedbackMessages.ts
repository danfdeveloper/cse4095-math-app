/**
 * The cheerful messages shown after a question and at the end of a session
 * (specification section 13.4). They are short, so that they are read at a
 * glance and fit on one line of a small screen, and they never say the student
 * was wrong or did badly: after a mistake they are about learning, not failing.
 */
export const PRAISE_MESSAGES: readonly string[] = [
  'Great job!',
  'Nice work!',
  'You got it!',
  'Awesome!',
  'Way to go!',
  'Super work!',
  'Fantastic!',
  'Well done!',
]

export const SUPPORT_MESSAGES: readonly string[] = [
  'Keep practicing!',
  'Good try!',
  'Mistakes help us learn.',
  'You can do it!',
  'Nice effort!',
  'Learning takes practice.',
  'You will get it next time!',
  'Every try helps you grow.',
]

/** A session at or above this accuracy ends with praise; below it, with encouragement. */
export const PRAISE_ACCURACY = 80
