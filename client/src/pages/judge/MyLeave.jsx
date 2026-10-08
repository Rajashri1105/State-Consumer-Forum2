import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Stack, Divider,
  IconButton, Alert, Chip,
} from '@mui/material';
import { toast } from 'react-toastify';
import { CalendarPlus, Trash2, CalendarOff } from 'lucide-react';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { tokens } from '../../theme/theme';

export default function MyLeave() {
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  const load = () => {
    setLoading(true);
    leaveService.listMine()
      .then(({ data }) => setLeaves(data.data.leaves || []))
      .catch(() => toast.error('Failed to load your leave records'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error('Start date, end date, and reason are all required');
      return;
    }
    if (dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
      toast.error('End date cannot be before start date');
      return;
    }

    setSubmitting(true);
    setConflicts([]);
    try {
      const { data } = await leaveService.createMine(form);
      toast.success(data.message || 'Leave recorded');
      if (data.data.conflictingHearings?.length) {
        setConflicts(data.data.conflictingHearings);
      }
      setForm({ startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await leaveService.remove(id);
      toast.success('Leave record removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove leave record');
    }
  };

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>My Leave</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Mark upcoming leave so the scheduling engine avoids booking hearings on those dates.
        The forum clerk is shown any hearings that already fall within a period you mark.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Mark Leave</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth type="date" label="Start Date" InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth type="date" label="End Date" InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth label="Reason" placeholder="e.g. Medical leave, personal leave, training"
              value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </Grid>
        </Grid>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="contained" startIcon={<CalendarPlus size={16} />} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Mark Leave'}
          </Button>
        </Stack>

        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              {conflicts.length} scheduled hearing(s) fall within this period and need rescheduling:
            </Typography>
            <Stack gap={0.5}>
              {conflicts.map((h) => (
                <Typography key={h.id} variant="body2">
                  <DocketTag>{h.complaint?.complaintNumber}</DocketTag> — {dayjs(h.scheduledDate).format('DD MMM YYYY')} at {h.scheduledTime}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>My Leave Records</Typography>
        {loading ? (
          <Loader label="Loading your leave records…" minHeight={120} />
        ) : leaves.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CalendarOff size={32} color={tokens.inkMuted} style={{ marginBottom: 8 }} />
            <Typography variant="body2" color="text.secondary">No leave records yet.</Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />} gap={0.5}>
            {leaves.map((l) => (
              <Stack key={l.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{l.reason}</Typography>
                  <Chip
                    size="small"
                    label={`${dayjs(l.startDate).format('DD MMM YYYY')} – ${dayjs(l.endDate).format('DD MMM YYYY')}`}
                    sx={{ mt: 0.5, backgroundColor: `${tokens.warning}1A`, color: tokens.warning, fontWeight: 700 }}
                  />
                </Box>
                <IconButton size="small" onClick={() => handleDelete(l.id)}>
                  <Trash2 size={16} color={tokens.error} />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
