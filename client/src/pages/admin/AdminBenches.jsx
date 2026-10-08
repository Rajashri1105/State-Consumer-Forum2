import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Stack, Divider, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Switch, FormControlLabel,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Landmark, Plus, Gavel, ClipboardList, X, Trash2 } from 'lucide-react';
import { benchService } from '../../services/benchService';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

export default function AdminBenches() {
  const [loading, setLoading] = useState(true);
  const [benches, setBenches] = useState([]);
  const [unseatedJudges, setUnseatedJudges] = useState([]);
  const [scrutinyClerks, setScrutinyClerks] = useState([]);

  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: '', courtRoom: '' });
  const [saving, setSaving] = useState(false);

  // Per-bench dropdown selections for "seat judge" / "attach court clerk".
  const [judgePick, setJudgePick] = useState({});
  const [clerkPick, setClerkPick] = useState({});

  const load = () => {
    setLoading(true);
    benchService.list()
      .then(({ data }) => {
        setBenches(data.data.benches || []);
        setUnseatedJudges(data.data.unseatedJudges || []);
        setScrutinyClerks(data.data.scrutinyClerks || []);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load benches'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const run = async (fn, okMessage) => {
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Bench name is required'); return; }
    setSaving(true);
    try {
      await benchService.create(form);
      toast.success('Bench created');
      setCreateDialog(false);
      setForm({ name: '', courtRoom: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bench');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading benches…" />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Benches</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            A bench is a court: a judge plus its own court clerk. Accepted complaints are allotted to a bench, and from then on
            only that bench&apos;s judge and court clerk handle the case. Scrutiny clerks are not tied to a bench — they share the intake queue.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreateDialog(true)}>New Bench</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, my: 3 }}>
        <Typography variant="subtitle2" fontWeight={700}>Intake (scrutiny) clerks — shared queue</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
          {scrutinyClerks.length === 0
            ? <Typography variant="body2" color="text.secondary">No scrutiny clerks yet. Create one under Manage Users → CLERK → Scrutiny.</Typography>
            : scrutinyClerks.map((c) => <Chip key={c.id} icon={<ClipboardList size={14} />} label={c.name} variant="outlined" />)}
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {benches.map((b) => (
          <Grid item xs={12} md={6} key={b.id}>
            <Paper variant="outlined" sx={{ p: 2.5, height: '100%', opacity: b.isActive ? 1 : 0.65 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" gap={1}>
                  <Landmark size={18} color={tokens.ashokaNavy} />
                  <Typography variant="subtitle1" fontWeight={700}>{b.name}</Typography>
                  {b.courtRoom && <Chip size="small" label={b.courtRoom} />}
                </Stack>
                <Stack direction="row" alignItems="center">
                  <FormControlLabel
                    control={<Switch size="small" checked={b.isActive} onChange={() => run(() => benchService.update(b.id, { isActive: !b.isActive }), b.isActive ? 'Bench deactivated — it will receive no new cases' : 'Bench activated')} />}
                    label={<Typography variant="caption">{b.isActive ? 'Active' : 'Inactive'}</Typography>}
                  />
                  <IconButton size="small" color="error" title="Delete bench (only if it never handled a case)"
                    onClick={() => run(() => benchService.remove(b.id), 'Bench deleted')}><Trash2 size={16} /></IconButton>
                </Stack>
              </Stack>
              <Typography variant="caption" color="text.secondary">{b._count?.complaints || 0} case(s) handled</Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary">Judges</Typography>
              <Stack gap={0.75} sx={{ my: 0.75 }}>
                {b.judges.length === 0 && <Typography variant="body2" color="text.secondary">No judge seated — this bench cannot receive cases.</Typography>}
                {b.judges.map((j) => (
                  <Stack key={j.id} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Gavel size={14} color="#6A3FA0" />
                      <Typography variant="body2" fontWeight={600}>{j.user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{j.designation}</Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => run(() => benchService.removeJudge(b.id, j.id), 'Judge removed from bench')}><X size={14} /></IconButton>
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" gap={1}>
                <TextField size="small" select fullWidth label="Seat a judge" value={judgePick[b.id] || ''} onChange={(e) => setJudgePick((p) => ({ ...p, [b.id]: e.target.value }))}>
                  {unseatedJudges.length === 0 && <MenuItem disabled value="">No unseated judges</MenuItem>}
                  {unseatedJudges.map((j) => <MenuItem key={j.id} value={j.id}>{j.user.name}</MenuItem>)}
                </TextField>
                <Button disabled={!judgePick[b.id]} onClick={() => run(() => benchService.addJudge(b.id, judgePick[b.id]), 'Judge seated').then(() => setJudgePick((p) => ({ ...p, [b.id]: '' })))}>Add</Button>
              </Stack>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary">Court clerks</Typography>
              <Stack gap={0.75} sx={{ my: 0.75 }}>
                {b.clerks.length === 0 && <Typography variant="body2" color="text.secondary">No court clerk — nobody can schedule hearings for this bench.</Typography>}
                {b.clerks.map((c) => (
                  <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" gap={1}>
                      <ClipboardList size={14} color={tokens.docketBrass} />
                      <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    </Stack>
                    <IconButton size="small" title="Move back to the intake pool" onClick={() => run(() => benchService.removeClerk(b.id, c.id), 'Clerk moved back to the intake pool')}><X size={14} /></IconButton>
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" gap={1}>
                <TextField size="small" select fullWidth label="Attach a clerk" value={clerkPick[b.id] || ''} onChange={(e) => setClerkPick((p) => ({ ...p, [b.id]: e.target.value }))}>
                  {scrutinyClerks.length === 0 && <MenuItem disabled value="">No scrutiny clerks available</MenuItem>}
                  {scrutinyClerks.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <Button disabled={!clerkPick[b.id]} onClick={() => run(() => benchService.addClerk(b.id, clerkPick[b.id]), 'Court clerk attached').then(() => setClerkPick((p) => ({ ...p, [b.id]: '' })))}>Add</Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
        {benches.length === 0 && (
          <Grid item xs={12}><Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography>No benches yet. Create the first one.</Typography></Paper></Grid>
        )}
      </Grid>

      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Bench</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} sx={{ mt: 0.5 }}>
            <TextField autoFocus fullWidth label="Bench name" placeholder="e.g. Bench 4" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField fullWidth label="Court room (optional)" value={form.courtRoom} onChange={(e) => setForm((f) => ({ ...f, courtRoom: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
