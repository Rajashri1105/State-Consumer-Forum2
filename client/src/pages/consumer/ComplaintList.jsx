import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Stack,
  Divider, Pagination, InputAdornment,
} from '@mui/material';
import { Search, FilePlus2, FileText } from 'lucide-react';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, PriorityChip } from '../../components/common/StatusChips';
import { tokens } from '../../theme/theme';
import { getComplaintTitle } from '../../utils/complaintTitle';

const STATUS_OPTIONS = [
  '', 'SUBMITTED', 'UNDER_VERIFICATION', 'ACCEPTED', 'REJECTED', 'JUDGE_ASSIGNED',
  'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED', 'DISPOSED', 'CLOSED', 'WITHDRAWN', 'SETTLED',
];
const PRIORITY_OPTIONS = ['', 'HIGH', 'MEDIUM', 'LOW'];

export default function ComplaintList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    complaintService.getMine({ page, limit: 10, status: status || undefined, priority: priority || undefined })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.data.items || []);
        setTotalPages(data.data.totalPages || 1);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, priority]);

  const filtered = search
    ? items.filter((c) =>
        c.complaintNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.oppositePartyName.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Track Complaints</Typography>
          <Typography variant="body2" color="text.secondary">View the status and history of every complaint you've filed.</Typography>
        </Box>
        <Button component={RouterLink} to="/consumer/complaints/new" variant="contained" startIcon={<FilePlus2 size={18} />}>
          Register Complaint
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth size="small" placeholder="Search by complaint number or opposite party"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={6} sm={3.5}>
            <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3.5}>
            <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              {PRIORITY_OPTIONS.map((p) => <MenuItem key={p} value={p}>{p || 'All Priorities'}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Loader label="Loading your complaints…" />
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <FileText size={40} color={tokens.inkMuted} style={{ marginBottom: 12 }} />
          <Typography variant="body1" fontWeight={600}>No complaints found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {items.length === 0 ? "You haven't filed any complaints yet." : 'Try adjusting your search or filters.'}
          </Typography>
          {items.length === 0 && (
            <Button component={RouterLink} to="/consumer/complaints/new" variant="contained" startIcon={<FilePlus2 size={18} />}>
              Register Your First Complaint
            </Button>
          )}
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {filtered.map((c) => (
              <Box
                key={c.id}
                component={RouterLink}
                to={`/consumer/complaints/${c.id}`}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  p: 2, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
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
