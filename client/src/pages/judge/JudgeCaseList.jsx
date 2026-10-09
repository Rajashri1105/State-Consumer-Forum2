import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Stack, Divider, Pagination, InputAdornment,
} from '@mui/material';
import { Search, Gavel } from 'lucide-react';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, PriorityChip } from '../../components/common/StatusChips';
import { tokens } from '../../theme/theme';
import { getComplaintTitle } from '../../utils/complaintTitle';

const STATUS_OPTIONS = [
  '', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED', 'DISPOSED', 'CLOSED',
];

export default function JudgeCaseList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Backend automatically scopes this to the logged-in judge's assigned complaints.
    complaintService.list({ page, limit: 15, status: status || undefined, search: search || undefined })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.data.items || []);
        setTotalPages(data.data.totalPages || 1);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, search]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Assigned Cases</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complaints currently assigned to you.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth size="small" placeholder="Search by complaint number or opposite party"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Loader label="Loading your cases…" />
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <Gavel size={40} color={tokens.inkMuted} style={{ marginBottom: 12 }} />
          <Typography variant="body1" fontWeight={600}>No cases assigned yet</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {items.map((c) => (
              <Box
                key={c.id}
                component={RouterLink}
                to={`/judge/cases/${c.id}`}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  p: 2, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Box sx={{ minWidth: 0, flex: '1 1 280px' }}>
                  <DocketTag>{c.complaintNumber}</DocketTag>
                  <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{getComplaintTitle(c)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Filed {dayjs(c.submittedAt).format('DD MMM YYYY')} · {c.category?.name}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} alignItems="center">
                  <PriorityChip priority={c.priority} />
                  <StatusChip status={c.status} />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}
    </Box>
  );
}
