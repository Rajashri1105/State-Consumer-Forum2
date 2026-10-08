import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Grid, Paper, Box, Typography, Button, Stack, Divider } from '@mui/material';
import { ClipboardCheck, CalendarClock, CheckCircle2, XCircle, FileCheck2, Gavel, UserX, Check, AlertTriangle, Inbox, Undo2 } from 'lucide-react';
import { complaintService } from '../../services/complaintService';
import { hearingService } from '../../services/hearingService';
import { reassignmentService } from '../../services/reassignmentService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { PriorityChip } from '../../components/common/StatusChips';
import JudgeAvailabilityPanel from '../../components/common/JudgeAvailabilityPanel';
import { tokens } from '../../theme/theme';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const QUICK_ACTIONS = [
  { label: 'Bench Cases', icon: ClipboardCheck, to: '/clerk/complaints', variant: 'contained' },
  { label: 'Cause List & Hearings', icon: CalendarClock, to: '/clerk/hearings', variant: 'outlined' },
];

function CourtClerkDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState([]);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [disposed, setDisposed] = useState(0);
  const [pendingScheduling, setPendingScheduling] = useState(0);
  const [todayHearings, setTodayHearings] = useState([]);
  const [reassignments, setReassignments] = useState([]);
  const [reassignmentActionLoading, setReassignmentActionLoading] = useState(null);
  const [delayed, setDelayed] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [pendingRes, completedRes, scheduledRes, disposedRes, judgeAssignedRes, calendarRes, reassignRes, delayedRes] = await Promise.all([
          complaintService.list({ status: 'JUDGE_ASSIGNED', limit: 10 }),
          complaintService.list({ status: 'HEARING_COMPLETED', limit: 1 }),
          complaintService.list({ status: 'HEARING_SCHEDULED', limit: 1 }),
          complaintService.list({ status: 'CLOSED', limit: 1 }),
          complaintService.list({ status: 'JUDGE_ASSIGNED', limit: 1 }),
          hearingService.getCalendar({}),
          reassignmentService.list('PENDING'),
          complaintService.list({ isDelayed: true, limit: 10 }),
        ]);
        if (cancelled) return;
        setPendingVerification(pendingRes.data.data.items || []);
        setAccepted(scheduledRes.data.data.total || 0);
        setRejected(completedRes.data.data.total || 0);
        setDisposed(disposedRes.data.data.total || 0);
        setPendingScheduling(judgeAssignedRes.data.data.total || 0);
        setTodayHearings(calendarRes.data.data.today || []);
        setReassignments(reassignRes.data.data.requests || []);
        setDelayed(delayedRes.data.data.items || []);
      } catch {
        // Tolerate partial failure; cards show zero rather than blocking the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const handleApproveReassignment = async (req) => {
    setReassignmentActionLoading(req.id);
    try {
      await reassignmentService.approve(req.id);
      toast.success('Reassignment approved — consumer and new judge notified');
      setReassignments((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve reassignment');
    } finally {
      setReassignmentActionLoading(null);
    }
  };

  const handleRejectReassignment = async (req) => {
    setReassignmentActionLoading(req.id);
    try {
      await reassignmentService.reject(req.id);
      toast.success('Reassignment rejected — remember to reschedule this hearing manually');
      setReassignments((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject reassignment');
    } finally {
      setReassignmentActionLoading(null);
    }
  };

  if (loading) return <Loader label="Loading court clerk dashboard…" />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name?.split(' ')[0]}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cases allotted to your bench and today's cause list.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Awaiting First Hearing" value={pendingVerification.length} icon={ClipboardCheck} accent="info" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Today's Hearings" value={todayHearings.length} icon={CalendarClock} accent="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Hearings Scheduled" value={accepted} icon={Gavel} accent="navy" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Awaiting Judgment" value={rejected} icon={CheckCircle2} accent="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
                  </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Disposed Cases" value={disposed} icon={CheckCircle2} accent="navy" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Delayed — Needs Attention" value={delayed.length} icon={AlertTriangle} accent="error" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Allotted to your bench — schedule the first hearing</Typography>
            {pendingVerification.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No new cases waiting for a hearing date.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.5}>
                {pendingVerification.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} vs {c.oppositePartyName}</Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <PriorityChip priority={c.priority} />
                      <Button size="small" component={RouterLink} to={`/clerk/complaints/${c.id}`} startIcon={<FileCheck2 size={16} />}>
                        Schedule
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          {reassignments.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 2, borderColor: tokens.warning }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <UserX size={18} color={tokens.warning} />
                <Typography variant="subtitle1" fontWeight={700}>Judge Absence — Reassignment Requests</Typography>
              </Stack>
              <Stack divider={<Divider />} gap={1.5}>
                {reassignments.map((r) => (
                  <Box key={r.id}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <DocketTag>{r.complaint?.complaintNumber}</DocketTag>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {r.originalJudgeName} is unavailable
                          {r.recommendedJudgeName ? ` — recommended replacement: ${r.recommendedJudgeName}` : ' — no automatic replacement found'}
                        </Typography>
                        {r.recommendedDate && (
                          <Typography variant="caption" color="text.secondary">
                            New slot: {dayjs(r.recommendedDate).format('DD MMM YYYY')} at {r.recommendedTime}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" gap={1}>
                        <Button
                          size="small" variant="contained" color="success" startIcon={<Check size={14} />}
                          disabled={!r.recommendedJudgeId || reassignmentActionLoading === r.id}
                          onClick={() => handleApproveReassignment(r)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small" color="error" startIcon={<XCircle size={14} />}
                          disabled={reassignmentActionLoading === r.id}
                          onClick={() => handleRejectReassignment(r)}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
          {delayed.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 2, borderColor: tokens.error }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <AlertTriangle size={18} color={tokens.error} />
                <Typography variant="subtitle1" fontWeight={700}>Delayed — Needs Attention</Typography>
              </Stack>
              <Stack divider={<Divider />} gap={1.25}>
                {delayed.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.delayReason}</Typography>
                    </Box>
                    <Button size="small" component={RouterLink} to={`/clerk/complaints/${c.id}`}>View</Button>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quick actions</Typography>
            <Stack gap={1.25}>
              {QUICK_ACTIONS.map((a) => (
                <Button key={a.label} component={RouterLink} to={a.to} variant={a.variant} startIcon={<a.icon size={18} />} sx={{ justifyContent: 'flex-start' }}>
                  {a.label}
                </Button>
              ))}
            </Stack>
          </Paper>

          <Box sx={{ mb: 2 }}>
            <JudgeAvailabilityPanel />
          </Box>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Today's hearings</Typography>
            {todayHearings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hearings scheduled for today.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.25}>
                {todayHearings.map((h) => (
                  <Box key={h.id}>
                    <Typography variant="body2" fontWeight={600}>{h.scheduledTime} · {h.judge?.user?.name}</Typography>
                    <DocketTag sx={{ mt: 0.5 }}>{h.complaint?.complaintNumber}</DocketTag>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}


// --------------------------------------------------------------------------
// Scrutiny (intake) clerk: shared queue, claim -> verify / defective / reject
// --------------------------------------------------------------------------
function ScrutinyClerkDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [mine, setMine] = useState([]);
  const [counts, setCounts] = useState({ defective: 0, rejected: 0, passed: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [queueRes, mineRes, defRes, rejRes, passedRes] = await Promise.all([
          complaintService.list({ status: 'SUBMITTED', limit: 8 }),
          complaintService.list({ status: 'UNDER_VERIFICATION', myQueue: true, limit: 10 }),
          complaintService.list({ status: 'DEFECTIVE', myQueue: true, limit: 1 }),
          complaintService.list({ status: 'REJECTED', myQueue: true, limit: 1 }),
          complaintService.list({ status: 'JUDGE_ASSIGNED', myQueue: true, limit: 1 }),
        ]);
        if (cancelled) return;
        setQueue(queueRes.data.data.items || []);
        setQueueTotal(queueRes.data.data.total || 0);
        setMine(mineRes.data.data.items || []);
        setCounts({
          defective: defRes.data.data.total || 0,
          rejected: rejRes.data.data.total || 0,
          passed: passedRes.data.data.total || 0,
        });
      } catch {
        // Tolerate partial failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader label="Loading intake dashboard…" />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name?.split(' ')[0]}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        You work the shared intake queue. Claim a complaint, check it, then accept it, return it as defective, or reject it.
        Accepted complaints are allotted to a bench automatically.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}><StatCard label="In Intake Queue" value={queueTotal} icon={Inbox} accent="info" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Claimed by Me" value={mine.length} icon={ClipboardCheck} accent="navy" /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Passed to Benches" value={counts.passed} icon={CheckCircle2} accent="success" /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Returned Defective" value={counts.defective} icon={Undo2} accent="warning" /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Rejected" value={counts.rejected} icon={XCircle} accent="error" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Claimed by me — finish these</Typography>
            {mine.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nothing claimed right now.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.5}>
                {mine.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} vs {c.oppositePartyName}</Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <PriorityChip priority={c.priority} />
                      <Button size="small" component={RouterLink} to={`/clerk/complaints/${c.id}`} startIcon={<FileCheck2 size={16} />}>Continue</Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Intake queue (unclaimed)</Typography>
              <Button size="small" component={RouterLink} to="/clerk/complaints">Open full queue</Button>
            </Stack>
            {queue.length === 0 ? (
              <Typography variant="body2" color="text.secondary">The queue is empty — nothing is waiting for scrutiny.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.5}>
                {queue.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} vs {c.oppositePartyName}</Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <PriorityChip priority={c.priority} />
                      <Button size="small" variant="outlined" component={RouterLink} to="/clerk/complaints">Claim</Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function ClerkDashboard() {
  const { user } = useAuth();
  return user?.clerkType === 'COURT' ? <CourtClerkDashboard /> : <ScrutinyClerkDashboard />;
}
