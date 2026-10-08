import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Stack, Chip, Alert, Pagination,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material';
import { Send, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { emailService } from '../../services/partyService';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';
import StatCard from '../../components/common/StatCard';

const STATUS_COLOR = { SENT: 'success', FAILED: 'error', SKIPPED: 'default' };

export default function AdminEmailLog() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [testTo, setTestTo] = useState(user?.email || '');
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    emailService.logs({ page, limit: 20, status: status || undefined, search: search || undefined })
      .then(({ data: res }) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load e-mail log'))
      .finally(() => setLoading(false));
  }, [page, status, search]);
  useEffect(load, [load]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data: res } = await emailService.sendTest(testTo);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
      load();
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>E-mail Log</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every case update e-mailed to consumers and opposite parties, with delivery status. Use the test button to check your mail server.
      </Typography>

      {data && !data.smtp.configured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          SMTP is not configured, so e-mails are only being recorded here as <b>SKIPPED</b>. Set <code>SMTP_HOST</code>, <code>SMTP_USER</code>,
          <code> SMTP_PASSWORD</code> and <code>EMAIL_FROM</code> in <code>server/.env</code> and restart the server.
        </Alert>
      )}

      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}><StatCard label="Sent" value={data.totals.sent} icon={Mail} accent="success" /></Grid>
          <Grid item xs={12} sm={4}><StatCard label="Failed" value={data.totals.failed} icon={Mail} accent="error" /></Grid>
          <Grid item xs={12} sm={4}><StatCard label="Skipped (no SMTP)" value={data.totals.skipped} icon={Mail} accent="warning" /></Grid>
        </Grid>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <TextField size="small" label="Send a test e-mail to" value={testTo} onChange={(e) => setTestTo(e.target.value)} sx={{ minWidth: 280 }} />
          <Button variant="contained" startIcon={<Send size={16} />} disabled={testing || !testTo} onClick={sendTest}>{testing ? 'Sending…' : 'Send test'}</Button>
          {data?.smtp.configured && <Typography variant="caption" color="text.secondary">Sending as {data.smtp.from} via {data.smtp.host}</Typography>}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}><TextField fullWidth size="small" placeholder="Search recipient or subject" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem><MenuItem value="SENT">Sent</MenuItem><MenuItem value="FAILED">Failed</MenuItem><MenuItem value="SKIPPED">Skipped</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {loading ? <Loader label="Loading…" /> : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>When</TableCell><TableCell>To</TableCell><TableCell>Subject</TableCell><TableCell>Event</TableCell><TableCell>Status</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(data?.items || []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(m.createdAt).format('DD MMM, h:mm A')}</TableCell>
                  <TableCell>{m.toEmail}</TableCell>
                  <TableCell>{m.subject}</TableCell>
                  <TableCell>{m.event || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={m.status} color={STATUS_COLOR[m.status]} />
                    {m.error && <Typography variant="caption" color="error" sx={{ display: 'block' }}>{m.error}</Typography>}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items || []).length === 0 && <TableRow><TableCell colSpan={5} align="center">No e-mails yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data && data.totalPages > 1 && <Stack alignItems="center" sx={{ mt: 2 }}><Pagination count={data.totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" /></Stack>}
    </Box>
  );
}
