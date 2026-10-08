import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Grid, Paper, Box, Typography, Button, Stack, Divider, TextField, MenuItem, Chip, LinearProgress,
} from '@mui/material';
import { Landmark, Inbox, AlertTriangle, UserX, Gavel, Check, XCircle, Wand2 } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import { reassignmentService } from '../../services/reassignmentService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { PriorityChip, StatusChip } from '../../components/common/StatusChips';
import { tokens } from '../../theme/theme';

export default function RegistrarDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [benches, setBenches] = useState([]);
  const [reassignments, setReassignments] = useState([]);
  const [delayed, setDelayed] = useState([]);
  const [pick, setPick] = useState({});      // complaintId -> benchId
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [queueRes, reassignRes, delayedRes] = await Promise.all([
        complaintService.getAllotmentQueue(),
        reassignmentService.list('PENDING'),
        complaintService.list({ isDelayed: true, limit: 8 }),
      ]);
      setQueue(queueRes.data.data.items || []);
      setBenches(queueRes.data.data.benches || []);
      setReassignments(reassignRes.data.data.requests || []);
      setDelayed(delayedRes.data.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allot = async (complaint, benchId) => {
    setBusyId(complaint.id);
    try {
      await complaintService.allot(complaint.id, benchId ? { benchId } : {});
      toast.success(`${complaint.complaintNumber} allotted`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Allotment failed');
    } finally {
      setBusyId(null);
    }
  };

  const decideReassignment = async (r, approve) => {
    setBusyId(r.id);
    try {
      if (approve) await reassignmentService.approve(r.id); else await reassignmentService.reject(r.id);
      toast.success(approve ? 'Reassignment approved' : 'Reassignment rejected — reschedule the hearing manually');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader label="Loading Registrar dashboard…" />;

  const manualCount = queue.filter((c) => c.status === 'NEEDS_MANUAL_ASSIGNMENT').length;
  const maxPending = Math.max(1, ...benches.map((b) => b.pendingCases));
  const activeBenches = benches.filter((b) => b.isActive && b.judges.length > 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name?.split(' ')[0]}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        You distribute cases to benches and keep the workload balanced. You can also move a case to a different bench at any time.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Awaiting Allotment" value={queue.length} icon={Inbox} accent="info" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Needs Manual Decision" value={manualCount} icon={AlertTriangle} accent="warning" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Judge-Leave Reassignments" value={reassignments.length} icon={UserX} accent="navy" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Delayed Cases" value={delayed.length} icon={AlertTriangle} accent="error" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Allotment queue</Typography>
            {queue.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing waiting. In automatic mode, accepted complaints go straight to the least-loaded bench.
              </Typography>
            ) : (
              <Stack divider={<Divider />} gap={2}>
                {queue.map((c) => (
                  <Box key={c.id}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <DocketTag>{c.complaintNumber}</DocketTag>
                          <StatusChip status={c.status} />
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} · {c.category?.name} · ₹{Number(c.complaintAmount).toLocaleString('en-IN')}</Typography>
                        {c.allotments?.[0]?.method === 'RECUSAL' && (
                          <Typography variant="caption" color="warning.dark">Judge recused: {c.allotments[0].reason}</Typography>
                        )}
                      </Box>
                      <Stack direction="row" gap={1} alignItems="center">
                        <PriorityChip priority={c.priority} />
                        <Button size="small" component={RouterLink} to={`/registrar/complaints/${c.id}`}>Open</Button>
                      </Stack>
                    </Stack>
                    <Stack direction="row" gap={1} sx={{ mt: 1.25 }} alignItems="center" flexWrap="wrap">
                      <Button size="small" variant="contained" startIcon={<Wand2 size={14} />} disabled={busyId === c.id} onClick={() => allot(c, null)}>
                        Auto-allot (least loaded)
                      </Button>
                      <TextField size="small" select label="or choose bench" sx={{ minWidth: 170 }}
                        value={pick[c.id] || ''} onChange={(e) => setPick((p) => ({ ...p, [c.id]: e.target.value }))}>
                        {activeBenches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name} · {b.pendingCases} pending</MenuItem>)}
                      </TextField>
                      <Button size="small" variant="outlined" disabled={!pick[c.id] || busyId === c.id} onClick={() => allot(c, pick[c.id])}>Allot</Button>
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
                <Typography variant="subtitle1" fontWeight={700}>Judge on leave — hearings to move</Typography>
              </Stack>
              <Stack divider={<Divider />} gap={1.5}>
                {reassignments.map((r) => (
                  <Stack key={r.id} direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{r.complaint?.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {r.originalJudgeName} is unavailable
                        {r.recommendedJudgeName ? ` — recommended: ${r.recommendedJudgeName}` : ' — no automatic replacement found'}
                      </Typography>
                      {r.recommendedDate && (
                        <Typography variant="caption" color="text.secondary">New slot: {dayjs(r.recommendedDate).format('DD MMM YYYY')} at {r.recommendedTime}</Typography>
                      )}
                    </Box>
                    <Stack direction="row" gap={1}>
                      <Button size="small" variant="contained" color="success" startIcon={<Check size={14} />}
                        disabled={!r.recommendedJudgeId || busyId === r.id} onClick={() => decideReassignment(r, true)}>Approve</Button>
                      <Button size="small" color="error" startIcon={<XCircle size={14} />}
                        disabled={busyId === r.id} onClick={() => decideReassignment(r, false)}>Reject</Button>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <Landmark size={18} color={tokens.ashokaNavy} />
              <Typography variant="subtitle1" fontWeight={700}>Bench workload</Typography>
            </Stack>
            {benches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No benches have been set up yet.</Typography>
            ) : (
              <Stack gap={2}>
                {benches.map((b) => (
                  <Box key={b.id} sx={{ opacity: b.isActive ? 1 : 0.55 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700}>{b.name}{b.courtRoom ? ` · ${b.courtRoom}` : ''}</Typography>
                      <Typography variant="caption" color="text.secondary">{b.pendingCases} pending · {b.hearingsToday} today</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={(b.pendingCases / maxPending) * 100} sx={{ my: 0.75, height: 6, borderRadius: 3 }} />
                    <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                      {b.judges.map((j) => (
                        <Chip key={j.judgeId} size="small" icon={<Gavel size={12} />} label={j.name}
                          color={j.onLeaveToday ? 'warning' : 'default'} variant={j.onLeaveToday ? 'filled' : 'outlined'} />
                      ))}
                      {b.judges.length === 0 && <Chip size="small" color="error" variant="outlined" label="No judge seated" />}
                      {b.judgesOnLeave > 0 && <Typography variant="caption" color="warning.dark">on leave today</Typography>}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Court clerk: {b.clerks.length ? b.clerks.map((c) => c.name).join(', ') : 'none assigned'}
                    </Typography>
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
