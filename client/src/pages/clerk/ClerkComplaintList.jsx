import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Stack,
  Divider, Pagination, InputAdornment, Chip, ToggleButtonGroup, ToggleButton, Button,
} from '@mui/material';
import { Search, FileText, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import { benchService } from '../../services/benchService';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { StatusChip, PriorityChip } from '../../components/common/StatusChips';
import { tokens } from '../../theme/theme';

const ALL_STATUSES = [
  '', 'SUBMITTED', 'UNDER_VERIFICATION', 'DEFECTIVE', 'REJECTED',
  'PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT', 'JUDGE_ASSIGNED',
  'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'DISPOSED', 'CLOSED', 'WITHDRAWN', 'SETTLED',
];
const COURT_STATUSES = ['', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'DISPOSED', 'CLOSED'];
const PRIORITY_OPTIONS = ['', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * One list, three audiences (everything is scoped server-side — see scopeService):
 *   scrutiny clerk -> "Intake queue" (claim) + "My claimed"
 *   court clerk    -> their bench's cases
 *   registrar      -> every case, filterable by bench
 */
export default function ClerkComplaintList({ homePrefix = '/clerk' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRegistrar = user?.role === 'REGISTRAR';
  const isCourt = user?.role === 'CLERK' && user?.clerkType === 'COURT';
  const isScrutiny = user?.role === 'CLERK' && !isCourt;

  const [tab, setTab] = useState(isScrutiny ? 'intake' : 'all'); // scrutiny: intake | mine
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState(isCourt ? 'JUDGE_ASSIGNED' : '');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [benchId, setBenchId] = useState('');
  const [benches, setBenches] = useState([]);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    if (isRegistrar) benchService.list().then(({ data }) => setBenches(data.data.benches || [])).catch(() => {});
  }, [isRegistrar]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {
      page, limit: 15, priority: priority || undefined, search: search || undefined,
    };
    if (isScrutiny) {
      if (tab === 'intake') params.status = 'SUBMITTED';
      else params.myQueue = true;
    } else {
      params.status = status || undefined;
      if (isRegistrar && benchId) params.benchId = benchId;
    }
    complaintService.list(params)
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.data.items || []);
        setTotalPages(data.data.totalPages || 1);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, priority, search, tab, benchId, isScrutiny, isRegistrar]);

  const claim = async (e, c) => {
    e.preventDefault();
    e.stopPropagation();
    setClaimingId(c.id);
    try {
      await complaintService.claim(c.id);
      toast.success(`${c.complaintNumber} claimed — opening it for scrutiny`);
      navigate(`${homePrefix}/complaints/${c.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not claim this complaint');
      setPage(1);
      setTab('intake');
      setClaimingId(null);
    }
  };

  const title = isScrutiny ? 'Intake & Verification' : isCourt ? 'Bench Cases' : 'All Complaints';
  const subtitle = isScrutiny
    ? 'Claim a complaint from the shared queue, then verify it, mark it defective, or reject it.'
    : isCourt
      ? 'Complaints allotted to your bench. Schedule hearings and keep the file moving.'
      : 'Every complaint in the forum. Use the bench filter to see one court\'s docket.';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>

      {isScrutiny && (
        <ToggleButtonGroup
          value={tab} exclusive size="small" sx={{ mb: 2 }}
          onChange={(_, val) => { if (val) { setTab(val); setPage(1); } }}
        >
          <ToggleButton value="intake">Intake queue (unclaimed)</ToggleButton>
          <ToggleButton value="mine">My claimed &amp; history</ToggleButton>
        </ToggleButtonGroup>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={isScrutiny ? 8 : 5}>
            <TextField
              fullWidth size="small" placeholder="Search by complaint number, seller, or opposite party"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            />
          </Grid>
          {!isScrutiny && (
            <Grid item xs={6} sm={isRegistrar ? 2.5 : 4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                {(isCourt ? COURT_STATUSES : ALL_STATUSES).map((s) => <MenuItem key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All Statuses'}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          {isRegistrar && (
            <Grid item xs={6} sm={2.5}>
              <TextField fullWidth size="small" select label="Bench" value={benchId} onChange={(e) => { setBenchId(e.target.value); setPage(1); }}>
                <MenuItem value="">All benches</MenuItem>
                {benches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid item xs={6} sm={isScrutiny ? 4 : isRegistrar ? 2 : 3}>
            <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              {PRIORITY_OPTIONS.map((p) => <MenuItem key={p} value={p}>{p || 'All Priorities'}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Loader label="Loading complaints…" />
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <FileText size={40} color={tokens.inkMuted} style={{ marginBottom: 12 }} />
          <Typography variant="body1" fontWeight={600}>
            {isScrutiny && tab === 'intake' ? 'The intake queue is empty' : 'No complaints match these filters'}
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {items.map((c) => (
              <Box
                key={c.id}
                component={RouterLink}
                to={`${homePrefix}/complaints/${c.id}`}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  p: 2, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Box sx={{ minWidth: 0, flex: '1 1 280px' }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <DocketTag>{c.complaintNumber}</DocketTag>
                    {c.duplicateOverridden && (
                      <Chip size="small" icon={<AlertTriangle size={13} />} label="Possible duplicate"
                        sx={{ backgroundColor: `${tokens.warning}1A`, color: tokens.warning, fontWeight: 700 }} />
                    )}
                    {c.isDelayed && (
                      <Chip size="small" icon={<AlertTriangle size={13} />} label="Delayed — needs attention"
                        sx={{ backgroundColor: `${tokens.error}1A`, color: tokens.error, fontWeight: 700 }} />
                    )}
                    {c.bench && !isCourt && <Chip size="small" variant="outlined" label={c.bench.name} />}
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>{c.consumer?.name} · {c.sellerName} vs {c.oppositePartyName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Filed {dayjs(c.submittedAt).format('DD MMM YYYY')} · {c.category?.name}
                    {c.status === 'UNDER_VERIFICATION' && c.assignedClerk && ` · Claimed by ${c.assignedClerk.id === user?.id ? 'you' : c.assignedClerk.name}`}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} alignItems="center">
                  <PriorityChip priority={c.priority} />
                  <StatusChip status={c.status} />
                  {isScrutiny && c.status === 'SUBMITTED' && (
                    <Button size="small" variant="contained" startIcon={<ClipboardCheck size={14} />}
                      disabled={claimingId === c.id} onClick={(e) => claim(e, c)}>
                      Claim
                    </Button>
                  )}
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
