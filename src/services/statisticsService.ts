import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import type { DifficultyLevel, MathOperation } from '../types/question'
import type { PracticeAttempt, PracticeSession } from '../types/session'
import type { AppStatistics, OperationStatistics } from '../types/statistics'

/**
 * Correct answers as a whole-number percentage of attempts (0 when nothing was
 * attempted). Rounded to the nearest percent, but never 100 unless every answer
 * was right, so 199 of 200 does not read as perfect.
 */
export function calculateAccuracy(correct: number, attempted: number): number {
  if (attempted <= 0) return 0

  const ratio = Math.min(Math.max(correct / attempted, 0), 1)
  const percent = Math.round(ratio * 100)
  return ratio < 1 ? Math.min(percent, 99) : 100
}

export interface SessionSummaryData {
  attempted: number
  correct: number
  incorrect: number
  accuracy: number
  /** Questions in this session that came from reviewing past mistakes. */
  mistakeReviewCount: number
}

/** The numbers shown when a session ends. */
export function summarizeSession(
  session: PracticeSession,
  attempts: readonly PracticeAttempt[],
): SessionSummaryData {
  return {
    attempted: session.attempted,
    correct: session.correct,
    incorrect: session.incorrect,
    accuracy: calculateAccuracy(session.correct, session.attempted),
    mistakeReviewCount: attempts.filter(
      (attempt) =>
        attempt.sessionId === session.id && attempt.source === 'mistake-review',
    ).length,
  }
}

/** How many recent sessions the statistics page lists. */
export const RECENT_SESSIONS_SHOWN = 10

function emptyCounts(): OperationStatistics {
  return { attempted: 0, correct: 0, incorrect: 0 }
}

/** Statistics with nothing recorded: every count is zero. */
export function createEmptyStatistics(): AppStatistics {
  return {
    ...emptyCounts(),
    byOperation: {
      addition: emptyCounts(),
      subtraction: emptyCounts(),
      multiplication: emptyCounts(),
      division: emptyCounts(),
    },
    byDifficulty: {
      1: emptyCounts(),
      2: emptyCounts(),
      3: emptyCounts(),
      4: emptyCounts(),
    },
    mistakeReview: emptyCounts(),
  }
}

function addToCounts(
  counts: OperationStatistics,
  correct: boolean,
  direction: 1 | -1,
): OperationStatistics {
  // Never below zero, so removing something that was never counted cannot go negative.
  const step = (value: number) => Math.max(0, value + direction)
  return {
    attempted: step(counts.attempted),
    correct: correct ? step(counts.correct) : counts.correct,
    incorrect: correct ? counts.incorrect : step(counts.incorrect),
  }
}

function applyAttempt(
  statistics: AppStatistics,
  attempt: Pick<
    PracticeAttempt,
    'operation' | 'difficulty' | 'selfReportedCorrect' | 'source'
  >,
  direction: 1 | -1,
): AppStatistics {
  const { operation, difficulty, selfReportedCorrect: correct } = attempt
  return {
    ...addToCounts(statistics, correct, direction),
    byOperation: {
      ...statistics.byOperation,
      [operation]: addToCounts(
        statistics.byOperation[operation],
        correct,
        direction,
      ),
    },
    byDifficulty: {
      ...statistics.byDifficulty,
      [difficulty]: addToCounts(
        statistics.byDifficulty[difficulty],
        correct,
        direction,
      ),
    },
    mistakeReview:
      attempt.source === 'mistake-review'
        ? addToCounts(statistics.mistakeReview, correct, direction)
        : statistics.mistakeReview,
  }
}

/** The statistics with one more answered question counted. The original is not changed. */
export function recordAttemptInStatistics(
  statistics: AppStatistics,
  attempt: PracticeAttempt,
): AppStatistics {
  return applyAttempt(statistics, attempt, 1)
}

/** The statistics with one answered question taken back out. The original is not changed. */
export function removeAttemptFromStatistics(
  statistics: AppStatistics,
  attempt: PracticeAttempt,
): AppStatistics {
  return applyAttempt(statistics, attempt, -1)
}

/** Totals worked out from a list of attempts, for rebuilding statistics that were lost or damaged. */
export function statisticsFromAttempts(
  attempts: readonly PracticeAttempt[],
): AppStatistics {
  return attempts.reduce(recordAttemptInStatistics, createEmptyStatistics())
}

/** One row of counts with its accuracy, for showing on screen. */
export interface StatisticsRow extends OperationStatistics {
  accuracy: number
}

export interface OperationRow extends StatisticsRow {
  operation: MathOperation
}

export interface DifficultyRow extends StatisticsRow {
  difficulty: DifficultyLevel
}

export interface RecentSessionRow {
  id: string
  startedAt: string
  operations: PracticeSession['operations']
  difficulty: DifficultyLevel
  attempted: number
  correct: number
  incorrect: number
  accuracy: number
  /** Ended normally, or ended early on purpose. */
  finished: boolean
  /** The session still being practiced right now. */
  inProgress: boolean
  /** A session of practice on earlier mistakes, not regular practice. */
  mistakePractice: boolean
}

export interface StatisticsView {
  /** False until at least one question has been answered. */
  hasData: boolean
  overall: StatisticsRow
  byOperation: OperationRow[]
  byDifficulty: DifficultyRow[]
  recentSessions: RecentSessionRow[]
}

function withAccuracy(counts: OperationStatistics): StatisticsRow {
  return {
    attempted: counts.attempted,
    correct: counts.correct,
    incorrect: counts.incorrect,
    accuracy: calculateAccuracy(counts.correct, counts.attempted),
  }
}

/** The most recent sessions, newest first. */
export function recentSessionRows(
  sessions: readonly PracticeSession[],
  activeSessionId: string | null = null,
  limit: number = RECENT_SESSIONS_SHOWN,
): RecentSessionRow[] {
  return [...sessions]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, limit)
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      operations: session.operations,
      difficulty: session.difficulty,
      attempted: session.attempted,
      correct: session.correct,
      incorrect: session.incorrect,
      accuracy: calculateAccuracy(session.correct, session.attempted),
      finished: session.completedAt !== undefined,
      inProgress:
        session.completedAt === undefined && session.id === activeSessionId,
      mistakePractice: session.mode === 'mistake-review',
    }))
}

/** Everything the statistics page shows, worked out from the saved totals and sessions. */
export function buildStatisticsView(
  statistics: AppStatistics,
  sessions: readonly PracticeSession[],
  activeSessionId: string | null = null,
): StatisticsView {
  return {
    hasData: statistics.attempted > 0,
    overall: withAccuracy(statistics),
    byOperation: MATH_OPERATIONS.map((operation) => ({
      operation,
      ...withAccuracy(statistics.byOperation[operation]),
    })),
    byDifficulty: DIFFICULTY_LEVELS.map((difficulty) => ({
      difficulty,
      ...withAccuracy(statistics.byDifficulty[difficulty]),
    })),
    recentSessions: recentSessionRows(sessions, activeSessionId),
  }
}
