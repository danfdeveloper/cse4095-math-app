import { formatQuestionCount } from '../../utils/format'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface LeaveSessionDialogProps {
  open: boolean
  /** How many questions have been answered so far. */
  answered: number
  onKeepPracticing: () => void
  onLeave: () => void
}

/**
 * Asks before the student goes somewhere else in the middle of a session
 * (specification section 16). Leaving ends the session, so the question says
 * what happens to what was answered, and the safe choice is to stay.
 */
export function LeaveSessionDialog({
  open,
  answered,
  onKeepPracticing,
  onLeave,
}: LeaveSessionDialogProps) {
  const nothingAnswered = answered === 0
  return (
    <ConfirmDialog
      open={open}
      title="Leave this session?"
      message={
        nothingAnswered
          ? 'You have not answered any questions yet, so nothing will be kept if you leave.'
          : `You have answered ${formatQuestionCount(answered)} so far. If you leave, the session ends, and your answers stay in your statistics.`
      }
      confirmLabel={nothingAnswered ? 'Leave' : 'End Session and Leave'}
      cancelLabel="Keep Practicing"
      onCancel={onKeepPracticing}
      onConfirm={onLeave}
    />
  )
}
