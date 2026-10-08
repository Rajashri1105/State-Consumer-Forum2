import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Grid, Paper, Box, Typography, Stack, Divider, Button, Alert } from '@mui/material';
import { Briefcase, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import { partyService } from '../../services/partyService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, ReplyStatusChip } from '../../components/common/StatusChips';

export default function PartyDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    partyService.myCases().then(({ data }) => setItems(data.data.items || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading your cases…" />;

  const awaiting = items.filter((c) => c.replyStatus === 'AWAITING_REPLY');
  const missed = items.filter((c) => c.replyStatus === 'EX_PARTE_ELIGIBLE');
  const open = items.filter((c) => !['CLOSED', 'DISPOSED', 'SETTLED', 'WITHDRAWN', 'REJECTED'].includes(c.status));
  const next = [...awaiting].sort((a, b) => new Date(a.replyDueDate) - new Date(b.replyDueDate))[0];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These are consumer complaints filed against you. Read each complaint, file your written reply before the deadline,
        ask for more time if you need it, or offer the consumer a settlement.
      </Typography>

      {next && (
        <Alert severity={dayjs(next.replyDueDate).diff(dayjs(), 'day') <= 3 ? 'error' : 'warning'} sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" component={RouterLink} to={`/party/cases/${next.id}`}>Reply now</Button>}>
          Your next reply is due on <b>{dayjs(next.replyDueDate).format('DD MMM YYYY')}</b> for case {next.complaintNumber}.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Cases Against Me" value={items.length} icon={Briefcase} accent="navy" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Reply Due" value={awaiting.length} icon={Clock} accent="warning" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Deadline Missed" value={missed.length} icon={AlertTriangle} accent="error" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Open Cases" value={open.length} icon={CheckCircle2} accent="info" /></Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>My cases</Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No complaints have been served on you yet.</Typography>
        ) : (
          <Stack divider={<Divider />} gap={1.5}>
            {items.map((c) => (
              <Box key={c.id} component={RouterLink} to={`/party/cases/${c.id}`}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', textDecoration: 'none', color: 'inherit', py: 0.5, '&:hover': { opacity: 0.8 } }}>
                <Box sx={{ minWidth: 0 }}>
                  <DocketTag>{c.complaintNumber}</DocketTag>
                  <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} · {c.category?.name} · ₹{Number(c.complaintAmount).toLocaleString('en-IN')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Served {dayjs(c.noticeIssuedAt).format('DD MMM YYYY')}{c.replyDueDate ? ` · reply due ${dayjs(c.replyDueDate).format('DD MMM YYYY')}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1}>
                  <ReplyStatusChip status={c.replyStatus} />
                  <StatusChip status={c.status} />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
