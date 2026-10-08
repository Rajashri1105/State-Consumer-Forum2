import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Grid, Paper, Box, Typography, Button, Stack, Divider } from '@mui/material';
import { Gavel, CalendarClock, FileSignature, CheckCircle2 } from 'lucide-react';
import { complaintService } from '../../services/complaintService';
import { hearingService } from '../../services/hearingService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { PriorityChip } from '../../components/common/StatusChips';

const QUICK_ACTIONS = [
  { label: 'Assigned Cases', icon: Gavel, to: '/judge/cases', variant: 'contained' },
  { label: 'Hearing Calendar', icon: CalendarClock, to: '/judge/hearings', variant: 'outlined' },
];

export default function JudgeDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayHearings, setTodayHearings] = useState([]);
  const [upcomingHearings, setUpcomingHearings] = useState([]);
  const [pendingJudgments, setPendingJudgments] = useState([]);
  const [disposedCount, setDisposedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [calendarRes, hearingCompletedRes, closedRes] = await Promise.all([
          hearingService.getCalendar({}),
          complaintService.list({ status: 'HEARING_COMPLETED', limit: 10 }),
          complaintService.list({ status: 'CLOSED', limit: 1 }),
        ]);
        if (cancelled) return;
        setTodayHearings(calendarRes.data.data.today || []);
        setUpcomingHearings((calendarRes.data.data.upcoming || []).slice(0, 5));
        setPendingJudgments(hearingCompletedRes.data.data.items || []);
        setDisposedCount(closedRes.data.data.total || 0);
      } catch {
        // Tolerate partial failure; cards show zero rather than blocking the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader label="Loading judge dashboard…" />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your hearing schedule and cases awaiting judgment.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Today's Hearings" value={todayHearings.length} icon={CalendarClock} accent="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Upcoming Hearings" value={upcomingHearings.length} icon={CalendarClock} accent="info" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Pending Judgments" value={pendingJudgments.length} icon={FileSignature} accent="navy" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Disposed Cases" value={disposedCount} icon={CheckCircle2} accent="success" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Awaiting judgment</Typography>
            {pendingJudgments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No cases are currently awaiting judgment.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.5}>
                {pendingJudgments.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} vs {c.oppositePartyName}</Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <PriorityChip priority={c.priority} />
                      <Button size="small" component={RouterLink} to="/judge/cases" startIcon={<FileSignature size={16} />}>
                        Upload Judgment
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
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

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Today's hearings</Typography>
            {todayHearings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hearings scheduled for today.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.25}>
                {todayHearings.map((h) => (
                  <Box key={h.id}>
                    <Typography variant="body2" fontWeight={600}>{h.scheduledTime}</Typography>
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
