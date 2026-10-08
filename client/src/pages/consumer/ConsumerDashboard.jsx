import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Grid, Paper, Box, Typography, Button, Stack, Divider } from '@mui/material';
import { FilePlus2, Search, Upload, CalendarClock, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import { hearingService } from '../../services/hearingService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, PriorityChip } from '../../components/common/StatusChips';

const PENDING_STATUSES = ['SUBMITTED', 'UNDER_VERIFICATION'];
const IN_PROGRESS_STATUSES = ['ACCEPTED', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED'];
const DISPOSED_STATUSES = ['DISPOSED', 'CLOSED'];

const QUICK_ACTIONS = [
  { label: 'Register Complaint', icon: FilePlus2, to: '/consumer/complaints/new', variant: 'contained' },
  { label: 'Track Complaints', icon: Search, to: '/consumer/complaints', variant: 'outlined' },
  { label: 'Upload Documents', icon: Upload, to: '/consumer/complaints', variant: 'outlined' },
  { label: 'Hearing Calendar', icon: CalendarClock, to: '/consumer/hearings', variant: 'outlined' },
];

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [upcomingHearings, setUpcomingHearings] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [complaintsRes, calendarRes] = await Promise.all([
          complaintService.getMine({ limit: 100 }),
          hearingService.getCalendar({}),
        ]);
        if (cancelled) return;
        setComplaints(complaintsRes.data.data.items || []);
        setUpcomingHearings((calendarRes.data.data.upcoming || []).slice(0, 5));
      } catch {
        // Dashboard tolerates partial failure — cards below simply show zero.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader label="Loading your dashboard…" />;

  const total = complaints.length;
  const pending = complaints.filter((c) => PENDING_STATUSES.includes(c.status)).length;
  const inProgress = complaints.filter((c) => IN_PROGRESS_STATUSES.includes(c.status)).length;
  const rejected = complaints.filter((c) => c.status === 'REJECTED').length;
  const disposed = complaints.filter((c) => DISPOSED_STATUSES.includes(c.status)).length;
  const recent = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome back, {user?.name?.split(' ')[0]}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Here's an overview of your complaints and upcoming hearings.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Total Complaints" value={total} icon={FileText} accent="navy" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Pending" value={pending} icon={Clock} accent="info" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="In Progress" value={inProgress} icon={CheckCircle2} accent="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Rejected" value={rejected} icon={XCircle} accent="error" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard label="Disposed" value={disposed} icon={CheckCircle2} accent="success" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Recent complaints</Typography>
            {recent.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                You haven't filed any complaints yet. Use "Register Complaint" to get started.
              </Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.5}>
                {recent.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.5, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.oppositePartyName}</Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <PriorityChip priority={c.priority} />
                      <StatusChip status={c.status} />
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
                <Button
                  key={a.label}
                  component={RouterLink}
                  to={a.to}
                  variant={a.variant}
                  startIcon={<a.icon size={18} />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {a.label}
                </Button>
              ))}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Upcoming hearings</Typography>
            {upcomingHearings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No upcoming hearings scheduled.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.25}>
                {upcomingHearings.map((h) => (
                  <Box key={h.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {dayjs(h.scheduledDate).format('DD MMM YYYY')} · {h.scheduledTime}
                    </Typography>
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
