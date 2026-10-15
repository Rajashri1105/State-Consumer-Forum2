import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Stack, Divider, Button, Chip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  RadioGroup, FormControlLabel, Radio, MenuItem, IconButton,
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Download, FileText, CalendarClock, Gavel, Upload,
  CheckCircle2, XCircle, UserCog, CalendarPlus, RefreshCcw, FileSignature, Ban, FileDown, Star,
  AlertTriangle, ClipboardCheck, Sparkles, Send, Landmark,
} from 'lucide-react';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import { hearingService } from '../../services/hearingService';
import { judgmentService } from '../../services/judgmentAndNotificationService';
import { settingsService } from '../../services/adminService';
import { partyService } from '../../services/partyService';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, PriorityChip } from '../../components/common/StatusChips';
import ComplaintTimeline from '../../components/common/ComplaintTimeline';
import FileDropzone from '../../components/common/FileDropzone';
import { fileUrl } from '../../utils/fileUrl';
import PartyResponsePanel from '../../components/common/PartyResponsePanel';
import { tokens } from '../../theme/theme';
import { getComplaintTitle } from '../../utils/complaintTitle';

const HEARING_STATUS_COLOR = {
  SCHEDULED: tokens.info, COMPLETED: tokens.success, ADJOURNED: tokens.warning, CANCELLED: tokens.inkMuted,
};

// REJECTED is intentionally excluded so consumers can still upload evidence before re-appealing.
const TERMINAL_STATUSES = ['DISPOSED', 'CLOSED', 'SETTLED'];
const NON_WITHDRAWABLE_STATUSES = ['HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED', 'DISPOSED', 'CLOSED', 'REJECTED', 'WITHDRAWN', 'SETTLED'];
const FEEDBACK_ELIGIBLE_STATUSES = ['DISPOSED', 'CLOSED'];
// Statuses in which the Registrar may allot / re-allot the case to a bench.
const ALLOTTABLE_STATUSES = ['PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED'];

function useDateAvailability({ date, enabled, complaintId, hearingId, scheduledTime }) {
  const [state, setState] = useState({ loading: false, result: null, error: null });

  useEffect(() => {
    if (!enabled || !date) {
      setState({ loading: false, result: null, error: null });
      return undefined;
    }

    let cancelled = false;
    setState({ loading: true, result: null, error: null });
    const timer = setTimeout(async () => {
      try {
        const { data } = await hearingService.getDateAvailability({
          ...(hearingId ? { hearingId } : { complaintId }),
          date,
          ...(scheduledTime ? { scheduledTime } : {}),
        });
        if (!cancelled) setState({ loading: false, result: data.data, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            result: null,
            error: err.response?.data?.message || 'Could not verify this hearing date.',
          });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [date, enabled, complaintId, hearingId, scheduledTime]);

  return state;
}

function DateAvailabilityNotice({ state, onChoose }) {
  if (state.loading) {
    return <Typography variant="caption" color="text.secondary">Checking judge and forum availability…</Typography>;
  }
  if (!state.error && (!state.result || state.result.available)) return null;

  return (
    <Alert severity={state.error ? 'error' : 'warning'}>
      <Typography variant="body2">
        {state.error || `${state.result.reason} Please choose another day.`}
      </Typography>
      {state.result?.options?.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          {state.result.options.map((option) => (
            <Button
              key={option.date}
              size="small"
              variant="outlined"
              onClick={() => onChoose(option.date, option.time)}
            >
              {dayjs(option.date).format('ddd, DD MMM')} · {option.time}
            </Button>
          ))}
        </Stack>
      )}
    </Alert>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
    </Box>
  );
}

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // -------------------- Clerk workflow actions --------------------
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [defectDialog, setDefectDialog] = useState(false);
  const [defectRemarks, setDefectRemarks] = useState('');
  const [recuseDialog, setRecuseDialog] = useState(false);
  const [recuseReason, setRecuseReason] = useState('');
  const [assignDialog, setAssignDialog] = useState(false); // Registrar: bench allotment dialog
  const [judgeRanking, setJudgeRanking] = useState(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState('');
  const [allotReason, setAllotReason] = useState('');
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [useSuggested, setUseSuggested] = useState(true);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleRemarks, setRescheduleRemarks] = useState('');
  const scheduleDateAvailability = useDateAvailability({
    date: manualDate,
    enabled: scheduleDialog && !useSuggested,
    complaintId: id,
    scheduledTime: manualTime,
  });
  const rescheduleDateAvailability = useDateAvailability({
    date: rescheduleDate,
    enabled: Boolean(rescheduleTarget),
    hearingId: rescheduleTarget?.id,
    scheduledTime: rescheduleTime,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState([
    '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
    '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM', '1:00 PM', '1:15 PM',
    '2:30 PM', '2:45 PM', '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM', '4:00 PM', '4:15 PM',
  ]);

  // -------------------- Consumer actions --------------------
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // -------------------- Judge workflow actions --------------------
  const [adjournTarget, setAdjournTarget] = useState(null);
  const [adjournReason, setAdjournReason] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [judgmentDialog, setJudgmentDialog] = useState(false);
  const [judgmentSummary, setJudgmentSummary] = useState('');
  const [judgmentVerdict, setJudgmentVerdict] = useState('');
  const [finalDocumentDialog, setFinalDocumentDialog] = useState(false);
  const [consumerPresent, setConsumerPresent] = useState('Present');
  const [oppositePartyPresent, setOppositePartyPresent] = useState('Present');
  const [witnessDetails, setWitnessDetails] = useState('None');
  const [advocateDetails, setAdvocateDetails] = useState('None');

  // -------------------- Feature 4: Notice Delivery Tracker --------------------
  const [noticeStatuses, setNoticeStatuses] = useState({}); // hearingId -> deliveries[]
  const [resendingChannel, setResendingChannel] = useState(null); // `${hearingId}-${channel}`

  // -------------------- Feature 2: synopsis download --------------------
  const [downloadingSynopsis, setDownloadingSynopsis] = useState(false);

  // -------------------- Resend portal invite --------------------
  const [resendingInvite, setResendingInvite] = useState(false);

  const handleResendPortalInvite = async () => {
    setResendingInvite(true);
    try {
      await partyService.resendInvite(id);
      toast.success('Portal invitation email resent to the opposite party');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend portal invitation');
    } finally {
      setResendingInvite(false);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      complaintService.getById(id),
      settingsService.getForumSettings().catch(() => null),
    ])
      .then(([{ data }, settingsRes]) => {
        setComplaint(data.data.complaint);
        setTimeline(data.data.timeline || []);

        // Apply time slots from settings if available
        if (settingsRes) {
          const slots = settingsRes.data?.data?.settings?.hearingTimeSlots;
          if (Array.isArray(slots) && slots.length) setTimeSlots(slots);
        }

        // Fetch all hearing notice statuses in parallel — one Promise per hearing
        const hearings = data.data.complaint.hearings || [];
        if (hearings.length > 0) {
          Promise.all(
            hearings.map((h) =>
              hearingService.getNoticeStatus(h.id)
                .then(({ data: d }) => ({ hearingId: h.id, deliveries: d.data.deliveries || [] }))
                .catch(() => ({ hearingId: h.id, deliveries: [] }))
            )
          ).then((results) => {
            const statusMap = {};
            results.forEach(({ hearingId, deliveries }) => { statusMap[hearingId] = deliveries; });
            setNoticeStatuses(statusMap);
          });
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load complaint'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  const handleClaim = async () => {
    setActionLoading(true);
    try {
      await complaintService.claim(id);
      toast.success('Complaint claimed — it is now yours to scrutinise');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not claim this complaint');
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    setActionLoading(true);
    try {
      await complaintService.release(id);
      toast.success('Complaint returned to the intake queue');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDefective = async () => {
    if (!defectRemarks.trim()) { toast.error('Please describe what the consumer needs to fix'); return; }
    setActionLoading(true);
    try {
      await complaintService.markDefective(id, defectRemarks.trim());
      toast.success('Marked defective — the consumer has been notified');
      setDefectDialog(false);
      setDefectRemarks('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark defective');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    setActionLoading(true);
    try {
      await complaintService.resubmit(id);
      toast.success('Complaint resubmitted for scrutiny');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resubmit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecuse = async () => {
    if (!recuseReason.trim()) { toast.error('A reason is required'); return; }
    setActionLoading(true);
    try {
      await complaintService.recuse(id, recuseReason.trim());
      toast.success('Recusal recorded — the case went back to the Registrar');
      setRecuseDialog(false);
      setRecuseReason('');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to recuse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyAccept = async () => {
    setActionLoading(true);
    try {
      const { data } = await complaintService.verify(id);
      toast.success(data.message || 'Complaint verified and accepted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Please provide a reason for rejection'); return; }
    setActionLoading(true);
    try {
      await complaintService.reject(id, rejectionReason.trim());
      toast.success('Complaint rejected');
      setRejectDialog(false);
      setRejectionReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const openAssignDialog = async () => {
    setAssignDialog(true);
    setAllotReason('');
    setJudgeRanking(null);
    try {
      const { data } = await complaintService.getJudgeRecommendations();
      setJudgeRanking(data.data.ranked || []);
      setSelectedJudgeId(data.data.recommended?.judgeId || '');
    } catch {
      toast.error('Failed to load judge workload rankings');
    }
  };

  const handleAssignJudge = async () => {
    if (!selectedJudgeId) return;
    setActionLoading(true);
    try {
      const { data } = await complaintService.allot(id, { judgeId: selectedJudgeId, reason: allotReason.trim() || undefined });
      const cancelled = data.data.cancelledHearings;
      toast.success(cancelled ? `Allotted. ${cancelled} scheduled hearing(s) cancelled — the new court clerk will reschedule.` : 'Case allotted to the bench');
      setAssignDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allot case');
    } finally {
      setActionLoading(false);
    }
  };

  const openScheduleDialog = async () => {
    setScheduleDialog(true);
    setSuggestion(null);
    setUseSuggested(true);
    setManualDate('');
    setManualTime('');
    try {
      const { data } = await hearingService.getSuggestion(id);
      setSuggestion(data.data.suggestion);
    } catch (err) {
      setUseSuggested(false);
      toast.error(err.response?.data?.message || 'No suggested slot found — set a date manually');
    }
  };

  const handleScheduleHearing = async () => {
    setActionLoading(true);
    try {
      await hearingService.schedule({
        complaintId: id,
        useSuggested,
        scheduledDate: useSuggested ? undefined : manualDate,
        scheduledTime: useSuggested ? undefined : manualTime,
      });
      toast.success('Hearing scheduled successfully');
      setScheduleDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule hearing');
    } finally {
      setActionLoading(false);
    }
  };

  const openRescheduleDialog = (hearing) => {
    setRescheduleTarget(hearing);
    setRescheduleDate(dayjs(hearing.scheduledDate).format('YYYY-MM-DD'));
    setRescheduleTime(hearing.scheduledTime);
    setRescheduleRemarks('');
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) { toast.error('Date and time are required'); return; }
    setActionLoading(true);
    try {
      await hearingService.reschedule(rescheduleTarget.id, {
        scheduledDate: rescheduleDate, scheduledTime: rescheduleTime, remarks: rescheduleRemarks,
      });
      toast.success('Hearing rescheduled');
      setRescheduleTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reschedule hearing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setActionLoading(true);
    try {
      await complaintService.withdraw(id, withdrawReason.trim());
      toast.success('Complaint withdrawn');
      setWithdrawConfirm(false);
      setWithdrawReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      const response = await complaintService.downloadReceipt(id);
      // response.data is already a Blob (responseType: 'blob')
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${complaint.complaintNumber}-receipt.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // When responseType is 'blob', error response body is also a Blob — parse it to JSON to extract the message.
      let message = 'Failed to download receipt';
      try {
        const errData = err.response?.data;
        if (errData instanceof Blob) {
          const text = await errData.text();
          const json = JSON.parse(text);
          message = json.message || message;
        } else if (errData?.message) {
          message = errData.message;
        }
      } catch { /* ignore parse errors */ }
      toast.error(message);
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleReappeal = async () => {
    setActionLoading(true);
    try {
      await complaintService.reappeal(id);
      toast.success('Complaint re-appealed — it is back in the scrutiny queue');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-appeal complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (feedbackRating === 0) { toast.error('Please select a star rating'); return; }
    setSubmittingFeedback(true);
    try {
      await complaintService.submitFeedback(id, { rating: feedbackRating, comments: feedbackComments.trim() });
      toast.success('Thank you for your feedback');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleAdjourn = async () => {
    if (!adjournReason.trim()) { toast.error('Please provide a reason for adjournment'); return; }
    setActionLoading(true);
    try {
      await hearingService.adjourn(adjournTarget.id, adjournReason.trim());
      toast.success('Hearing adjourned');
      setAdjournTarget(null);
      setAdjournReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjourn hearing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteHearing = async () => {
    if (!completeRemarks.trim()) { toast.error('Please add remarks for this hearing'); return; }
    setActionLoading(true);
    try {
      await hearingService.complete(completeTarget.id, completeRemarks.trim());
      toast.success('Hearing marked as completed');
      setCompleteTarget(null);
      setCompleteRemarks('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete hearing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeVerdict = async () => {
    if (!judgmentSummary.trim() || !judgmentVerdict.trim()) {
      toast.error('Choose the party in whose favor the verdict is given and provide a summary');
      return;
    }
    setActionLoading(true);
    try {
      await judgmentService.submitVerdict(id, {
        summary: judgmentSummary.trim(),
        verdict: judgmentVerdict,
      });
      toast.success('Verdict submitted to the court clerk for final document preparation');
      setJudgmentDialog(false);
      setJudgmentSummary('');
      setJudgmentVerdict('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize verdict');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeJudgmentDocument = async () => {
    if (!witnessDetails.trim() || !advocateDetails.trim()) {
      toast.error('Enter witness and advocate names, or enter None');
      return;
    }
    setActionLoading(true);
    try {
      await judgmentService.finalizeDocument(id, {
        consumerPresent: consumerPresent === 'Present',
        oppositePartyPresent: oppositePartyPresent === 'Present',
        witnessDetails: witnessDetails.trim(),
        advocateDetails: advocateDetails.trim(),
      });
      toast.success('Final judgment document published to both parties');
      setFinalDocumentDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish final judgment document');
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------- Feature 4: Notice Delivery Tracker --------------------
  const handleResendNotice = async (hearingId, channel) => {
    setResendingChannel(`${hearingId}-${channel}`);
    try {
      await hearingService.resendNotice(hearingId, channel);
      toast.success(`Notice resent over ${channel}`);
      const { data } = await hearingService.getNoticeStatus(hearingId);
      setNoticeStatuses((prev) => ({ ...prev, [hearingId]: data.data.deliveries || [] }));
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to resend over ${channel}`);
    } finally {
      setResendingChannel(null);
    }
  };

  // -------------------- Feature 2: download synopsis PDF --------------------
  const handleDownloadSynopsis = async () => {
    setDownloadingSynopsis(true);
    try {
      const response = await complaintService.downloadSynopsisPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${complaint.complaintNumber}-synopsis.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download synopsis');
    } finally {
      setDownloadingSynopsis(false);
    }
  };

  const handleUploadMoreEvidence = async () => {
    if (newFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('type', 'OTHER');
      newFiles.forEach((f) => formData.append('files', f));
      await complaintService.uploadEvidence(id, formData);
      toast.success('Evidence uploaded successfully');
      setNewFiles([]);
      setShowEvidenceUpload(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loader label="Loading complaint…" />;
  if (!complaint) return null;

  const isScrutinyClerk = user?.role === 'CLERK' && user?.clerkType !== 'COURT';
  const isCourtClerk = user?.role === 'CLERK' && user?.clerkType === 'COURT';
  const isRegistrarOrAdmin = ['REGISTRAR', 'ADMIN'].includes(user?.role);
  const canManageHearings = isCourtClerk || isRegistrarOrAdmin;
  const claimedByMe = complaint.assignedClerkId === user?.id || complaint.assignedClerk?.id === user?.id;
  const isAppeal = complaint.caseType === 'APPEAL';

  const isCourtClerkOfBench = isCourtClerk && Boolean(user?.benchId) && complaint.benchId === user?.benchId;
  const canResendInvite = (isRegistrarOrAdmin || isCourtClerkOfBench) && Boolean(complaint.oppositePartyEmail);
  const canPrepareFinalJudgment = isCourtClerkOfBench && complaint.status === 'JUDGMENT_UPLOADED'
    && Boolean(complaint.judgment) && !complaint.judgment.filePath;
  const isAssignedJudge = user?.role === 'JUDGE' && complaint.assignedJudge?.user?.id === user.id;

  const canAddEvidence = user?.role === 'CONSUMER' && !TERMINAL_STATUSES.includes(complaint.status) && complaint.status !== 'WITHDRAWN';

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Box>
          <DocketTag>{complaint.complaintNumber}</DocketTag>
          <Typography variant="h6" sx={{ mt: 1 }}>{getComplaintTitle(complaint)}</Typography>
          <Typography variant="body2" color="text.secondary">
            Filed {dayjs(complaint.submittedAt).format('DD MMM YYYY, hh:mm A')} · {complaint.category?.name}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <PriorityChip priority={complaint.priority} size="medium" />
          <StatusChip status={complaint.status} size="medium" />
        </Stack>
      </Stack>

      {complaint.duplicateOverridden && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderColor: tokens.warning, backgroundColor: `${tokens.warning}0D` }}>
          <Typography variant="body2" color="warning.dark">
            This complaint was flagged as a possible duplicate at submission and filed anyway for review.
          </Typography>
        </Paper>
      )}

      {complaint.isDelayed && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderColor: tokens.error, backgroundColor: `${tokens.error}0D` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <AlertTriangle size={18} color={tokens.error} />
            <Typography variant="body2" fontWeight={700} color="error.dark">Delayed — needs attention</Typography>
          </Stack>
          {complaint.delayReason && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{complaint.delayReason}</Typography>
          )}
        </Paper>
      )}

      {complaint.needsManualAssignment && complaint.status === 'NEEDS_MANUAL_ASSIGNMENT' && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderColor: tokens.warning, backgroundColor: `${tokens.warning}0D` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <AlertTriangle size={18} color={tokens.warning} />
            <Typography variant="body2" fontWeight={700} color="warning.dark">Waiting for the Registrar to allot a bench</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            No bench could be picked automatically (every judge is on leave or unavailable) or the judge recused. The Registrar must allot this case to a bench.
          </Typography>
        </Paper>
      )}

      {/* Opposite party's reply, extension requests and settlement offers (appears once the notice is served) */}
      <PartyResponsePanel complaintId={complaint.id} user={user} complaintStatus={complaint.status} onChanged={load} />

      {user?.role === 'CONSUMER' && complaint.status === 'DEFECTIVE' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: tokens.warning, backgroundColor: `${tokens.warning}0D` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <AlertTriangle size={18} color={tokens.warning} />
            <Typography variant="body2" fontWeight={700} color="warning.dark">Your complaint needs correction</Typography>
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>{complaint.defectRemarks}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Add the missing documents under Evidence below, then resubmit. It will go back into the scrutiny queue.
          </Typography>
          <Button sx={{ mt: 1.5 }} variant="contained" startIcon={<Send size={16} />} onClick={handleResubmit} disabled={actionLoading}>
            Resubmit for Scrutiny
          </Button>
        </Paper>
      )}

      {user?.role === 'CONSUMER' && complaint.status === 'REJECTED' && complaint.reappealCount === 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: tokens.error, backgroundColor: `${tokens.error}0D` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <XCircle size={18} color={tokens.error} />
            <Typography variant="body2" fontWeight={700} color="error.dark">Your complaint was rejected by the scrutiny clerk</Typography>
          </Stack>
          {complaint.rejectionReason && (
            <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
              <strong>Reason:</strong> {complaint.rejectionReason}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            You have <strong>1 re-appeal attempt</strong> available. If you believe the rejection was incorrect or have rectified the issue, click below to send your complaint back to the scrutiny queue for a fresh review.
            This is your only opportunity to re-appeal this complaint.
          </Typography>
          <Button sx={{ mt: 1.5 }} variant="contained" color="error" startIcon={<RefreshCcw size={16} />} onClick={handleReappeal} disabled={actionLoading}>
            Re-appeal (Send back to Scrutiny) — 1 attempt remaining
          </Button>
        </Paper>
      )}

      {user?.role === 'CONSUMER' && complaint.status === 'REJECTED' && complaint.reappealCount >= 1 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: tokens.error, backgroundColor: `${tokens.error}1A`, border: '2px solid' }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <XCircle size={22} color={tokens.error} />
            <Typography variant="body2" fontWeight={700} color="error.dark" fontSize="0.95rem">
              Final Rejection — No Further Re-appeal Permitted
            </Typography>
          </Stack>
          {complaint.rejectionReason && (
            <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
              <strong>Reason:</strong> {complaint.rejectionReason}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1, color: 'error.dark' }}>
            Your complaint has been rejected twice by the scrutiny team. Your one permitted re-appeal has already been used.
            This complaint cannot be reopened or re-appealed again.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            ⚠️ If you still wish to pursue the matter, please <strong>file a new complaint</strong> addressing the rejection reasons noted above.
            The new complaint will be treated as a fresh submission.
          </Typography>
        </Paper>
      )}

      {user?.role === 'CONSUMER' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>My Actions</Typography>
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            <Button variant="outlined" startIcon={<FileDown size={16} />} onClick={handleDownloadReceipt} disabled={downloadingReceipt}>
              {downloadingReceipt ? 'Preparing…' : 'Download Receipt'}
            </Button>
            {!NON_WITHDRAWABLE_STATUSES.includes(complaint.status) && (
              <Button variant="outlined" color="error" startIcon={<Ban size={16} />} onClick={() => setWithdrawConfirm(true)}>
                Withdraw Complaint
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {isScrutinyClerk && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: `${tokens.ashokaNavy}05` }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Scrutiny Actions</Typography>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            {complaint.status === 'SUBMITTED' && (
              <Button variant="contained" startIcon={<ClipboardCheck size={16} />} onClick={handleClaim} disabled={actionLoading}>
                Claim for Scrutiny
              </Button>
            )}
            {complaint.status === 'UNDER_VERIFICATION' && claimedByMe && (
              <>
                <Button variant="contained" color="success" startIcon={<CheckCircle2 size={16} />} onClick={handleVerifyAccept} disabled={actionLoading}>
                  Verify &amp; Accept
                </Button>
                <Button variant="outlined" color="warning" startIcon={<AlertTriangle size={16} />} onClick={() => setDefectDialog(true)}>
                  Mark Defective
                </Button>
                <Button variant="outlined" color="error" startIcon={<XCircle size={16} />} onClick={() => setRejectDialog(true)}>
                  Reject
                </Button>
                <Button startIcon={<RefreshCcw size={16} />} onClick={handleRelease} disabled={actionLoading}>
                  Release to Queue
                </Button>
              </>
            )}
            {complaint.status === 'UNDER_VERIFICATION' && !claimedByMe && (
              <Typography variant="body2" color="text.secondary">Being scrutinised by {complaint.assignedClerk?.name || 'another clerk'}.</Typography>
            )}
            {!['SUBMITTED', 'UNDER_VERIFICATION'].includes(complaint.status) && (
              <Typography variant="body2" color="text.secondary">
                Scrutiny is finished for this complaint{complaint.bench ? ` — it is with ${complaint.bench.name}.` : '.'}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {isCourtClerk && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: `${tokens.ashokaNavy}05` }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Court Clerk Actions{complaint.bench ? ` — ${complaint.bench.name}` : ''}</Typography>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            {complaint.status === 'JUDGE_ASSIGNED' && (
              <Button variant="contained" startIcon={<CalendarPlus size={16} />} onClick={openScheduleDialog}>
                Schedule Hearing
              </Button>
            )}
            {canResendInvite && (
              <Button variant="outlined" startIcon={<Send size={16} />} onClick={handleResendPortalInvite} disabled={resendingInvite}>
                {resendingInvite ? 'Sending…' : 'Resend Portal Invite'}
              </Button>
            )}
            {canPrepareFinalJudgment && (
              <Button variant="contained" startIcon={<FileSignature size={16} />} onClick={() => setFinalDocumentDialog(true)}>
                Prepare Final Judgment Document
              </Button>
            )}
            {complaint.status !== 'JUDGE_ASSIGNED' && !canResendInvite && !canPrepareFinalJudgment && (
              <Typography variant="body2" color="text.secondary">No clerk action needed at this stage.</Typography>
            )}
          </Stack>
        </Paper>
      )}

      {isRegistrarOrAdmin && (ALLOTTABLE_STATUSES.includes(complaint.status) || canResendInvite) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: `${tokens.warning}0D` }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Registrar &amp; Admin Actions</Typography>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            {ALLOTTABLE_STATUSES.includes(complaint.status) && (
              <Button variant="contained" startIcon={<Landmark size={16} />} onClick={openAssignDialog}>
                {['PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT'].includes(complaint.status) ? 'Allot to a Bench' : 'Re-allot to Another Bench'}
              </Button>
            )}
            {canResendInvite && (
              <Button variant="outlined" startIcon={<Send size={16} />} onClick={handleResendPortalInvite} disabled={resendingInvite}>
                {resendingInvite ? 'Sending…' : 'Resend Portal Invite'}
              </Button>
            )}
            {complaint.bench && (
              <Typography variant="body2" color="text.secondary">Currently with {complaint.bench.name}.</Typography>
            )}
          </Stack>
        </Paper>
      )}
      {isRegistrarOrAdmin && complaint.status === 'HEARING_SCHEDULED' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -1.5 }}>
          Re-allotting a case that has a hearing scheduled cancels that hearing so the new bench can reschedule it.
        </Typography>
      )}

      {user?.role === 'JUDGE' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: `${tokens.docketBrass}0D` }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Judge Actions</Typography>
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            {complaint.status === 'HEARING_SCHEDULED' && (() => {
              const activeHearing = complaint.hearings?.find((h) => h.status === 'SCHEDULED');
              if (!activeHearing) return <Typography variant="body2" color="text.secondary">No active hearing found.</Typography>;
              return (
                <>
                  <Button variant="contained" color="success" startIcon={<CheckCircle2 size={16} />} onClick={() => { setCompleteTarget(activeHearing); setCompleteRemarks(''); }}>
                    Mark Hearing Completed
                  </Button>
                  <Button variant="outlined" color="warning" startIcon={<RefreshCcw size={16} />} onClick={() => { setAdjournTarget(activeHearing); setAdjournReason(''); }}>
                    Adjourn Hearing
                  </Button>
                </>
              );
            })()}
            {isAssignedJudge && complaint.status === 'HEARING_COMPLETED' && (
              <Button variant="contained" startIcon={<FileSignature size={16} />} onClick={() => setJudgmentDialog(true)}>
                Submit Verdict
              </Button>
            )}
            {complaint.status === 'JUDGE_ASSIGNED' && (
              <Button variant="outlined" color="error" startIcon={<Ban size={16} />} onClick={() => setRecuseDialog(true)}>
                Recuse (conflict of interest)
              </Button>
            )}
            {!['HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGE_ASSIGNED'].includes(complaint.status) && (
              <Typography variant="body2" color="text.secondary">No judge action needed at this stage.</Typography>
            )}
            {complaint.status === 'JUDGE_ASSIGNED' && (
              <Typography variant="body2" color="text.secondary">Waiting for the court clerk to schedule the first hearing.</Typography>
            )}
            {isAssignedJudge && complaint.status === 'JUDGMENT_UPLOADED' && (
              <Typography variant="body2" color="text.secondary">Your verdict is with the court clerk for final document preparation.</Typography>
            )}
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Complaint Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}><InfoRow label="Filing Type" value={complaint.caseType === 'APPEAL' ? 'Appeal from District Order' : 'New Complaint'} /></Grid>
              <Grid item xs={6}><InfoRow label="Jurisdiction" value="State Commission" /></Grid>
              {!isAppeal && <Grid item xs={6}><InfoRow label="Product" value={complaint.product} /></Grid>}
              {!isAppeal && <Grid item xs={6}><InfoRow label="Service" value={complaint.service} /></Grid>}
              {!isAppeal && <Grid item xs={6}><InfoRow label="Invoice Number" value={complaint.invoiceNumber} /></Grid>}
              {!isAppeal && <Grid item xs={6}><InfoRow label="Purchase Date" value={complaint.purchaseDate ? dayjs(complaint.purchaseDate).format('DD MMM YYYY') : null} /></Grid>}
              <Grid item xs={6}><InfoRow label={isAppeal ? "Amount Awarded / in Dispute" : "Claim Amount"} value={`₹ ${Number(complaint.complaintAmount).toLocaleString('en-IN')}`} /></Grid>
              <Grid item xs={6}><InfoRow label="Court Fee" value={complaint.caseType === 'APPEAL' ? '₹ 0 (No fee for appeals)' : `₹ ${Number(complaint.courtFee || 0).toLocaleString('en-IN')}`} /></Grid>
              
              {complaint.caseType === 'APPEAL' && (
                <>
                  <Grid item xs={6}><InfoRow label="District Case Number" value={complaint.districtCaseNumber} /></Grid>
                  <Grid item xs={6}><InfoRow label="District Commission" value={complaint.districtCommissionName} /></Grid>
                  <Grid item xs={6}><InfoRow label="District Order Date" value={complaint.districtOrderDate ? dayjs(complaint.districtOrderDate).format('DD MMM YYYY') : null} /></Grid>
                  {complaint.appealGrounds && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Grounds of Appeal</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{complaint.appealGrounds}</Typography>
                    </Grid>
                  )}
                </>
              )}

              <Grid item xs={12}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                  <InfoRow label="Opposite Party (Primary)" value={`${complaint.oppositePartyName}${complaint.oppositePartyAddress ? ` — ${complaint.oppositePartyAddress}` : ''}`} />
                  {canResendInvite && (
                    <Button size="small" variant="outlined" startIcon={<Send size={14} />} onClick={handleResendPortalInvite} disabled={resendingInvite}>
                      {resendingInvite ? 'Sending invite…' : 'Resend Portal Invite'}
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>

            {complaint.synopsisText && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Formal Synopsis</Typography>
                  <Button size="small" startIcon={<Download size={13} />} onClick={handleDownloadSynopsis} disabled={downloadingSynopsis}>
                    {downloadingSynopsis ? 'Preparing…' : 'Download PDF'}
                  </Button>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{complaint.synopsisText}</Typography>
              </>
            )}

            {complaint.oppositeParties?.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">Additional Opposite Parties</Typography>
                <Stack gap={0.5} sx={{ mt: 0.5 }}>
                  {complaint.oppositeParties.map((p, i) => (
                    <Typography key={p.id} variant="body2" fontWeight={600}>
                      {i + 2}. {p.name}{p.address ? ` — ${p.address}` : ''}
                    </Typography>
                  ))}
                </Stack>
              </>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">Description</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{complaint.description}</Typography>

            {user?.role !== 'CONSUMER' && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">Consumer</Typography>
                <Typography variant="body2" fontWeight={600}>{complaint.consumerName || complaint.consumer?.name} · {complaint.consumer?.email} · {complaint.consumer?.phone || 'No phone on file'}</Typography>
              </>
            )}

            {user?.role !== 'CONSUMER' && (complaint.bench || complaint.assignedClerk) && (
              <>
                <Divider sx={{ my: 1.5 }} />
                {complaint.bench && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">Bench</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {complaint.bench.name}{complaint.bench.courtRoom ? ` · ${complaint.bench.courtRoom}` : ''}
                      {complaint.allottedAt ? ` · allotted ${dayjs(complaint.allottedAt).format('DD MMM YYYY')}${complaint.allottedBy ? ` by ${complaint.allottedBy.name}` : ' (automatic)'}` : ''}
                    </Typography>
                  </Box>
                )}
                {complaint.assignedClerk && (
                  <>
                    <Typography variant="caption" color="text.secondary">Scrutinised by</Typography>
                    <Typography variant="body2" fontWeight={600}>{complaint.assignedClerk.name} · {complaint.assignedClerk.email}</Typography>
                  </>
                )}
              </>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Evidence</Typography>
              {canAddEvidence && (
                <Button size="small" startIcon={<Upload size={15} />} onClick={() => setShowEvidenceUpload((s) => !s)}>
                  {showEvidenceUpload ? 'Cancel' : 'Add Evidence'}
                </Button>
              )}
            </Stack>

            {showEvidenceUpload && (
              <Box sx={{ mb: 2 }}>
                <FileDropzone label={null} files={newFiles} onChange={setNewFiles} />
                <Button sx={{ mt: 1.5 }} size="small" variant="contained" disabled={uploading || newFiles.length === 0} onClick={handleUploadMoreEvidence}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              </Box>
            )}

            {complaint.evidence?.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No evidence uploaded yet.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1}>
                {complaint.evidence?.map((ev) => (
                  <Stack key={ev.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                      <FileText size={16} color={tokens.ashokaNavy} />
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="body2" noWrap>{ev.fileName}</Typography>
                          {ev.type === 'DISTRICT_ORDER' && (
                            <Chip size="small" label="Certified District Order" color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{dayjs(ev.uploadedAt).format('DD MMM YYYY')}</Typography>
                      </Box>
                    </Stack>
                    <Button size="small" href={fileUrl(ev.filePath)} target="_blank" rel="noopener noreferrer" startIcon={<Download size={14} />}>
                      Download
                    </Button>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Hearings</Typography>
            {complaint.hearings?.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hearings scheduled yet.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1}>
                {complaint.hearings?.map((h) => (
                  <Stack key={h.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }} flexWrap="wrap" gap={1}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CalendarClock size={16} color={tokens.ashokaNavy} />
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(h.scheduledDate).format('DD MMM YYYY')} · {h.scheduledTime}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip size="small" label={h.status} sx={{ backgroundColor: `${HEARING_STATUS_COLOR[h.status]}1A`, color: HEARING_STATUS_COLOR[h.status], fontWeight: 700 }} />
                      {h.noticeFilePath && (
                        <Button size="small" href={fileUrl(h.noticeFilePath)} target="_blank" rel="noopener noreferrer" startIcon={<Download size={13} />}>Notice</Button>
                      )}
                      {canManageHearings && h.status === 'SCHEDULED' && (
                        <Button size="small" startIcon={<RefreshCcw size={13} />} onClick={() => openRescheduleDialog(h)}>Reschedule</Button>
                      )}
                    </Stack>
                    {(h.remarks || h.adjournReason) && (
                      <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                        {h.adjournReason || h.remarks}
                      </Typography>
                    )}
                    {noticeStatuses[h.id]?.length > 0 && (
                      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ width: '100%' }}>
                        {noticeStatuses[h.id].map((d) => (
                          <Chip
                            key={d.id}
                            size="small"
                            label={`${d.channel} ${d.status === 'DELIVERED' ? '✓ Delivered' : d.status === 'FAILED' ? '✗ Failed' : '… Pending'}`}
                            sx={{
                              backgroundColor: `${d.status === 'DELIVERED' ? tokens.success : d.status === 'FAILED' ? tokens.error : tokens.inkMuted}1A`,
                              color: d.status === 'DELIVERED' ? tokens.success : d.status === 'FAILED' ? tokens.error : tokens.inkMuted,
                              fontWeight: 700,
                            }}
                          />
                        ))}
                        {canManageHearings && noticeStatuses[h.id].some((d) => d.status === 'FAILED') && (
                          <Button
                            size="small" startIcon={<Send size={12} />}
                            onClick={() => handleResendNotice(h.id, noticeStatuses[h.id].find((d) => d.status === 'FAILED').channel)}
                            disabled={resendingChannel === `${h.id}-${noticeStatuses[h.id].find((d) => d.status === 'FAILED')?.channel}`}
                          >
                            Resend
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Judgment</Typography>
            {complaint.judgment ? (
              <Box>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                  <Gavel size={16} color={tokens.docketBrass} />
                  <Typography variant="body2" fontWeight={700}>{complaint.judgment.verdict}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{complaint.judgment.summary}</Typography>
                {complaint.judgment.filePath ? (
                  <Button variant="outlined" size="small" startIcon={<Download size={14} />} href={fileUrl(complaint.judgment.filePath)} target="_blank" rel="noopener noreferrer">
                    Download Final Judgment
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">The final document is being prepared by the court clerk.</Typography>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">Judgment has not been uploaded yet.</Typography>
            )}
          </Paper>

          {user?.role === 'CONSUMER' && FEEDBACK_ELIGIBLE_STATUSES.includes(complaint.status) && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                {complaint.feedback ? 'Your Feedback' : 'Rate Your Experience'}
              </Typography>

              {complaint.feedback ? (
                <Box>
                  <Stack direction="row" gap={0.5} sx={{ mb: 1 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={22} fill={n <= complaint.feedback.rating ? tokens.docketBrass : 'none'} color={tokens.docketBrass} />
                    ))}
                  </Stack>
                  {complaint.feedback.comments && (
                    <Typography variant="body2" color="text.secondary">{complaint.feedback.comments}</Typography>
                  )}
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                    Submitted {dayjs(complaint.feedback.submittedAt).format('DD MMM YYYY')}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Now that your case has concluded, let us know how the process went.
                  </Typography>
                  <Stack direction="row" gap={0.5} sx={{ mb: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <IconButton
                        key={n} size="small"
                        onClick={() => setFeedbackRating(n)}
                        onMouseEnter={() => setFeedbackHoverRating(n)}
                        onMouseLeave={() => setFeedbackHoverRating(0)}
                      >
                        <Star size={26} fill={n <= (feedbackHoverRating || feedbackRating) ? tokens.docketBrass : 'none'} color={tokens.docketBrass} />
                      </IconButton>
                    ))}
                  </Stack>
                  <TextField
                    fullWidth multiline rows={3} label="Comments (optional)"
                    value={feedbackComments} onChange={(e) => setFeedbackComments(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                    {submittingFeedback ? 'Submitting…' : 'Submit Feedback'}
                  </Button>
                </Box>
              )}
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Case Timeline</Typography>
            <ComplaintTimeline entries={timeline} />
          </Paper>
        </Grid>
      </Grid>

      {/* -------------------- Reject dialog -------------------- */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Complaint</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus fullWidth multiline rows={3} label="Reason for rejection"
            value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this complaint does not meet the forum's requirements..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={actionLoading}>
            {actionLoading ? 'Rejecting…' : 'Reject Complaint'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Mark defective dialog (Scrutiny clerk) -------------------- */}
      <Dialog open={defectDialog} onClose={() => setDefectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Complaint Defective</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            The consumer is told exactly what to fix and can resubmit. The complaint then returns to the intake queue.
          </Typography>
          <TextField
            autoFocus fullWidth multiline rows={3} label="What is defective / missing?"
            value={defectRemarks} onChange={(e) => setDefectRemarks(e.target.value)}
            placeholder="e.g. Signed copy of the sale agreement is missing; payment receipt is unreadable."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDefectDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleMarkDefective} disabled={actionLoading}>
            {actionLoading ? 'Saving…' : 'Return to Consumer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Recuse dialog (Judge) -------------------- */}
      <Dialog open={recuseDialog} onClose={() => setRecuseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Recuse from this Case</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            The case goes back to the Registrar, who will allot it to another bench. Your reason is recorded in the case history.
          </Typography>
          <TextField
            autoFocus fullWidth multiline rows={3} label="Reason for recusal"
            value={recuseReason} onChange={(e) => setRecuseReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRecuseDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRecuse} disabled={actionLoading}>
            {actionLoading ? 'Saving…' : 'Recuse'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Bench allotment dialog (Registrar) -------------------- */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Allot Case to a Bench</DialogTitle>
        <DialogContent dividers>
          {judgeRanking === null ? (
            <Loader label="Computing judge workload rankings…" minHeight={120} />
          ) : judgeRanking.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No judge is currently available (all on leave or not seated on a bench).</Typography>
          ) : (
            <RadioGroup value={selectedJudgeId} onChange={(e) => setSelectedJudgeId(e.target.value)}>
              {judgeRanking.map((j, i) => (
                <Paper key={j.judgeId} variant="outlined" sx={{ p: 1.5, mb: 1, borderColor: selectedJudgeId === j.judgeId ? tokens.ashokaNavy : tokens.border }}>
                  <FormControlLabel
                    value={j.judgeId}
                    control={<Radio />}
                    sx={{ width: '100%', m: 0 }}
                    label={
                      <Box sx={{ ml: 1 }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight={700}>{j.name}</Typography>
                          {i === 0 && <Chip size="small" label="Recommended" color="success" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {j.benchName || 'No bench'} · {j.designation} · {j.pendingCases} pending cases · {j.hearingsToday} hearings today
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              ))}
            </RadioGroup>
          )}
          <TextField
            fullWidth size="small" sx={{ mt: 1.5 }} label="Reason (optional, kept in the audit trail)"
            value={allotReason} onChange={(e) => setAllotReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignJudge} disabled={actionLoading || !selectedJudgeId}>
            {actionLoading ? 'Allotting…' : 'Allot to Bench'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Schedule hearing dialog (scheduling engine) -------------------- */}
      <Dialog open={scheduleDialog} onClose={() => setScheduleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Hearing</DialogTitle>
        <DialogContent dividers>
          <RadioGroup value={useSuggested ? 'suggested' : 'manual'} onChange={(e) => setUseSuggested(e.target.value === 'suggested')}>
            <FormControlLabel
              value="suggested" control={<Radio />} disabled={!suggestion}
              label={
                suggestion ? (
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      System-suggested: {dayjs(suggestion.suggestedDate).format('DD MMM YYYY')} at {suggestion.suggestedTime}
                    </Typography>
                    <Stack sx={{ mt: 0.5 }}>
                      {suggestion.reasoning.map((r, i) => (
                        <Typography key={i} variant="caption" color="text.secondary">• {r}</Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No available slot found — set a date manually below.</Typography>
                )
              }
            />
            <FormControlLabel value="manual" control={<Radio />} label="Set a date and time manually" sx={{ mt: 1.5 }} />
          </RadioGroup>

          {!useSuggested && (
            <Stack gap={1.5} sx={{ mt: 2 }}>
              <Stack direction="row" gap={2}>
                <TextField
                  fullWidth type="date" label="Hearing Date" InputLabelProps={{ shrink: true }}
                  inputProps={{ min: dayjs().format('YYYY-MM-DD') }}
                  value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                />
                <TextField
                  fullWidth select label="Time Slot" value={manualTime} onChange={(e) => setManualTime(e.target.value)}
                >
                  {timeSlots.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <DateAvailabilityNotice
                state={scheduleDateAvailability}
                onChoose={(date, time) => { setManualDate(date); setManualTime(time); }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setScheduleDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleScheduleHearing}
            disabled={actionLoading || (!useSuggested && (
              !manualDate || !manualTime || scheduleDateAvailability.loading
              || Boolean(scheduleDateAvailability.error)
              || Boolean(scheduleDateAvailability.result && !scheduleDateAvailability.result.available)
            ))}
          >
            {actionLoading ? 'Scheduling…' : 'Confirm Hearing'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Reschedule hearing dialog -------------------- */}
      <Dialog open={Boolean(rescheduleTarget)} onClose={() => setRescheduleTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reschedule Hearing</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2}>
            <Stack direction="row" gap={2}>
              <TextField
                fullWidth type="date" label="New Date" InputLabelProps={{ shrink: true }}
                inputProps={{ min: dayjs().format('YYYY-MM-DD') }}
                value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
              />
              <TextField fullWidth select label="New Time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)}>
                {timeSlots.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <DateAvailabilityNotice
              state={rescheduleDateAvailability}
              onChoose={(date, time) => { setRescheduleDate(date); setRescheduleTime(time); }}
            />
            <TextField fullWidth multiline rows={2} label="Remarks (optional)" value={rescheduleRemarks} onChange={(e) => setRescheduleRemarks(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRescheduleTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleReschedule}
            disabled={actionLoading || rescheduleDateAvailability.loading
              || Boolean(rescheduleDateAvailability.error)
              || Boolean(rescheduleDateAvailability.result && !rescheduleDateAvailability.result.available)}
          >
            {actionLoading ? 'Saving…' : 'Confirm New Date'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Adjourn hearing dialog -------------------- */}
      <Dialog open={Boolean(adjournTarget)} onClose={() => setAdjournTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Adjourn Hearing</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus fullWidth multiline rows={3} label="Reason for adjournment"
            value={adjournReason} onChange={(e) => setAdjournReason(e.target.value)}
            placeholder="E.g. Opposite party did not appear; additional evidence requested..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAdjournTarget(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleAdjourn} disabled={actionLoading}>
            {actionLoading ? 'Saving…' : 'Adjourn Hearing'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Complete hearing dialog -------------------- */}
      <Dialog open={Boolean(completeTarget)} onClose={() => setCompleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Hearing as Completed</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus fullWidth multiline rows={4} label="Hearing remarks"
            value={completeRemarks} onChange={(e) => setCompleteRemarks(e.target.value)}
            placeholder="Record what was argued, evidence examined, and any directions given..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCompleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleCompleteHearing} disabled={actionLoading}>
            {actionLoading ? 'Saving…' : 'Mark Completed'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Judge verdict dialog -------------------- */}
      <Dialog open={judgmentDialog} onClose={() => setJudgmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Verdict</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the party in whose favor you decide the case and record the judgment summary. The court clerk will prepare the final document.
          </Typography>
          <Stack gap={2}>
            <TextField
              select fullWidth label="Verdict" value={judgmentVerdict} onChange={(e) => setJudgmentVerdict(e.target.value)}
            >
              <MenuItem value="In favor of Consumer">In favor of Consumer</MenuItem>
              <MenuItem value="In favor of Opposite Party">In favor of Opposite Party</MenuItem>
            </TextField>
            <TextField
              fullWidth multiline rows={4} label="Judgment summary"
              value={judgmentSummary} onChange={(e) => setJudgmentSummary(e.target.value)}
              placeholder="Summarize the forum's findings and directions..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setJudgmentDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<FileSignature size={15} />} onClick={handleFinalizeVerdict} disabled={actionLoading}>
            {actionLoading ? 'Submitting…' : 'Submit Verdict'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Court clerk final judgment document -------------------- */}
      <Dialog open={finalDocumentDialog} onClose={() => setFinalDocumentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Prepare Final Judgment Document</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Confirm who appeared and list the witnesses and advocates. Case, bench, party, judge, filing-date, order-date, verdict, and summary details will be added automatically.
          </Typography>
          <Stack gap={2}>
            <TextField select fullWidth label="Consumer" value={consumerPresent} onChange={(e) => setConsumerPresent(e.target.value)}>
              <MenuItem value="Present">Present</MenuItem>
              <MenuItem value="Absent">Absent</MenuItem>
            </TextField>
            <TextField select fullWidth label="Opposite party" value={oppositePartyPresent} onChange={(e) => setOppositePartyPresent(e.target.value)}>
              <MenuItem value="Present">Present</MenuItem>
              <MenuItem value="Absent">Absent</MenuItem>
            </TextField>
            <TextField
              fullWidth label="Witness(es)" value={witnessDetails} onChange={(e) => setWitnessDetails(e.target.value)}
              helperText="Enter the names of witnesses who appeared, or None"
            />
            <TextField
              fullWidth label="Advocate(s)" value={advocateDetails} onChange={(e) => setAdvocateDetails(e.target.value)}
              helperText="Enter the names of advocates who appeared, or None"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setFinalDocumentDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<FileSignature size={15} />} onClick={handleFinalizeJudgmentDocument} disabled={actionLoading}>
            {actionLoading ? 'Publishing…' : 'Generate & Publish'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Withdraw complaint confirmation -------------------- */}
      <Dialog open={withdrawConfirm} onClose={() => setWithdrawConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw This Complaint?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This marks the complaint as withdrawn and closes the case. This action cannot be undone.
          </Typography>
          <TextField
            fullWidth multiline rows={2} label="Reason (optional)"
            value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setWithdrawConfirm(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleWithdraw} disabled={actionLoading}>
            {actionLoading ? 'Withdrawing…' : 'Withdraw Complaint'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
