import { Chip } from '@mui/material';
import { tokens } from '../../theme/theme';

const STATUS_COLORS = {
  SUBMITTED: { bg: '#EAF1F8', fg: tokens.info },
  UNDER_VERIFICATION: { bg: '#EAF1F8', fg: tokens.info },
  ACCEPTED: { bg: '#E7F3E8', fg: tokens.success },
  REJECTED: { bg: '#FBEAEA', fg: tokens.error },
  DEFECTIVE: { bg: '#FFF4E5', fg: tokens.warning },
  SETTLED: { bg: '#E7F6EC', fg: tokens.success },
  PENDING_ALLOTMENT: { bg: '#F1EBFA', fg: '#6A3FA0' },
  NEEDS_MANUAL_ASSIGNMENT: { bg: '#FBEAEA', fg: tokens.error },
  PENDING_JUDGE_CONFIRMATION: { bg: '#F1EBFA', fg: '#6A3FA0' },
  JUDGE_ASSIGNED: { bg: '#F1EBFA', fg: '#6A3FA0' },
  HEARING_SCHEDULED: { bg: '#FFF4E5', fg: tokens.warning },
  HEARING_COMPLETED: { bg: '#FFF4E5', fg: tokens.warning },
  JUDGMENT_UPLOADED: { bg: '#E7F3E8', fg: tokens.success },
  DISPOSED: { bg: '#EDEFF2', fg: tokens.inkMuted },
  CLOSED: { bg: '#EDEFF2', fg: tokens.inkMuted },
  WITHDRAWN: { bg: '#EDEFF2', fg: tokens.inkMuted },
};

const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  UNDER_VERIFICATION: 'Under Verification',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  DEFECTIVE: 'Defective — Needs Correction',
  SETTLED: 'Settled',
  PENDING_ALLOTMENT: 'Awaiting Bench Allotment',
  NEEDS_MANUAL_ASSIGNMENT: 'Awaiting Registrar',
  PENDING_JUDGE_CONFIRMATION: 'Awaiting Allotment',
  JUDGE_ASSIGNED: 'Allotted to Bench',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  HEARING_COMPLETED: 'Hearing Completed',
  JUDGMENT_UPLOADED: 'Judgment Uploaded',
  DISPOSED: 'Disposed',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
};

const PRIORITY_COLORS = {
  HIGH: { bg: '#FBEAEA', fg: tokens.error },
  MEDIUM: { bg: '#FFF4E5', fg: tokens.warning },
  LOW: { bg: '#E7F3E8', fg: tokens.success },
};

export function StatusChip({ status, size = 'small' }) {
  const c = STATUS_COLORS[status] || { bg: '#EDEFF2', fg: tokens.inkMuted };
  return (
    <Chip
      size={size}
      label={STATUS_LABELS[status] || status}
      sx={{ backgroundColor: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.72rem' }}
    />
  );
}

export function PriorityChip({ priority, size = 'small' }) {
  const c = PRIORITY_COLORS[priority] || { bg: '#EDEFF2', fg: tokens.inkMuted };
  return (
    <Chip
      size={size}
      label={priority}
      sx={{ backgroundColor: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.72rem' }}
    />
  );
}

const REPLY_COLORS = {
  NOT_APPLICABLE: { bg: '#EDEFF2', fg: tokens.inkMuted, label: 'Notice not served' },
  AWAITING_REPLY: { bg: '#FFF4E5', fg: tokens.warning, label: 'Awaiting reply' },
  REPLY_FILED: { bg: '#E7F3E8', fg: tokens.success, label: 'Reply filed' },
  EX_PARTE_ELIGIBLE: { bg: '#FBEAEA', fg: tokens.error, label: 'Reply deadline missed' },
  SETTLED: { bg: '#E7F6EC', fg: tokens.success, label: 'Case settled' },
};

/** Where the opposite party stands on filing their reply. */
export function ReplyStatusChip({ status, size = 'small' }) {
  const c = REPLY_COLORS[status] || REPLY_COLORS.NOT_APPLICABLE;
  return <Chip size={size} label={c.label} sx={{ backgroundColor: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.72rem' }} />;
}
