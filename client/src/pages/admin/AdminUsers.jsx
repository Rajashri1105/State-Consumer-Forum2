import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Stack,
  Divider, Pagination, InputAdornment, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Search, UserPlus, Shield, Gavel, ClipboardList, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { adminUserService } from '../../services/adminService';
import { benchService } from '../../services/benchService';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

const ROLE_OPTIONS = ['', 'CONSUMER', 'OPPOSITE_PARTY', 'CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN'];
const CREATABLE_ROLES = ['CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN'];

const ROLE_ICON = { CLERK: ClipboardList, JUDGE: Gavel, REGISTRAR: Shield, ADMIN: Shield };
const ROLE_COLOR = { CONSUMER: tokens.info, CLERK: tokens.docketBrass, JUDGE: '#6A3FA0', REGISTRAR: tokens.success, OPPOSITE_PARTY: tokens.info, ADMIN: tokens.ashokaNavy };

const emptyForm = {
  name: '', email: '', password: '', role: 'CLERK', phone: '', address: '',
  designation: '', courtRoom: '', specialization: '', maxHearingsPerDay: 8,
  clerkType: 'SCRUTINY', benchId: '',
};

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [benches, setBenches] = useState([]);

  useEffect(() => {
    benchService.list().then(({ data }) => setBenches(data.data.benches || [])).catch(() => { /* optional */ });
  }, []);

  const load = () => {
    setLoading(true);
    adminUserService.list({ page, limit: 15, role: role || undefined, search: search || undefined })
      .then(({ data }) => {
        setItems(data.data.items || []);
        setTotalPages(data.data.totalPages || 1);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, role, search]);

  const handleToggleStatus = async (user) => {
    try {
      await adminUserService.setStatus(user.id, !user.isActive);
      toast.success(`${user.name} ${user.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.role) {
      toast.error('Name, email, password, and role are required');
      return;
    }
    if (form.role === 'CLERK' && form.clerkType === 'COURT' && !form.benchId) {
      toast.error('Choose the bench this court clerk belongs to');
      return;
    }
    setSubmitting(true);
    try {
      await adminUserService.create({
        ...form,
        clerkType: form.role === 'CLERK' ? form.clerkType : undefined,
        benchId: (form.role === 'JUDGE' || (form.role === 'CLERK' && form.clerkType === 'COURT')) ? (form.benchId || undefined) : undefined,
      });
      toast.success(`${form.role} account created`);
      setCreateDialog(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminUserService.remove(deleteTarget.id);
      toast.success(`${deleteTarget.name}'s account was permanently deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Manage Users</Typography>
          <Typography variant="body2" color="text.secondary">Create and manage clerk, judge, and administrator accounts.</Typography>
        </Box>
        <Button variant="contained" startIcon={<UserPlus size={18} />} onClick={() => { setForm(emptyForm); setCreateDialog(true); }}>
          Add Staff Account
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth size="small" placeholder="Search by name or email"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" select label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              {ROLE_OPTIONS.map((r) => <MenuItem key={r} value={r}>{r || 'All Roles'}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {loading ? <Loader label="Loading users…" /> : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {items.map((u) => {
              const RoleIcon = ROLE_ICON[u.role];
              return (
                <Stack key={u.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }} flexWrap="wrap" gap={1.5}>
                  <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      {RoleIcon && <RoleIcon size={15} color={ROLE_COLOR[u.role]} />}
                      <Typography variant="body2" fontWeight={700}>{u.name}</Typography>
                      <Chip size="small" label={u.role} sx={{ backgroundColor: `${ROLE_COLOR[u.role]}1A`, color: ROLE_COLOR[u.role], fontWeight: 700 }} />
                      {!u.isActive && <Chip size="small" label="Deactivated" color="error" variant="outlined" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {u.email} · Joined {dayjs(u.createdAt).format('DD MMM YYYY')}
                      {u.judgeProfile && ` · ${u.judgeProfile.designation}, ${u.judgeProfile.bench?.name || 'not seated on a bench'}`}
                      {u.role === 'CLERK' && ` · ${u.clerkType === 'COURT' ? `Court clerk, ${u.bench?.name || 'no bench'}` : 'Scrutiny clerk (shared intake queue)'}`}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <FormControlLabel
                      control={<Switch checked={u.isActive} onChange={() => handleToggleStatus(u)} />}
                      label={u.isActive ? 'Active' : 'Inactive'}
                    />
                    <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setDeleteTarget(u)}>
                      Delete
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}

      {/* -------------------- Create staff account dialog -------------------- */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Staff Account</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {CREATABLE_ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="email" label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="password" label="Temporary Password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Grid>

            {form.role === 'CLERK' && (
              <>
                <Grid item xs={12}><Divider><Typography variant="caption">Clerk Type</Typography></Divider></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth select label="Clerk Type" value={form.clerkType} onChange={(e) => setForm((f) => ({ ...f, clerkType: e.target.value }))}
                    helperText={form.clerkType === 'SCRUTINY' ? 'Works the shared intake queue (claim, verify, defective).' : 'Belongs to one bench: schedules hearings and runs its cause list.'}>
                    <MenuItem value="SCRUTINY">Scrutiny (intake) clerk</MenuItem>
                    <MenuItem value="COURT">Court clerk</MenuItem>
                  </TextField>
                </Grid>
                {form.clerkType === 'COURT' && (
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth select label="Bench" value={form.benchId} onChange={(e) => setForm((f) => ({ ...f, benchId: e.target.value }))}>
                      {benches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                )}
              </>
            )}

            {form.role === 'JUDGE' && (
              <>
                <Grid item xs={12}><Divider><Typography variant="caption">Judge Profile</Typography></Divider></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Designation" placeholder="e.g. Member, President" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Court Room" value={form.courtRoom} onChange={(e) => setForm((f) => ({ ...f, courtRoom: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth select label="Bench (optional)" value={form.benchId} onChange={(e) => setForm((f) => ({ ...f, benchId: e.target.value }))}
                    helperText="A judge must sit on a bench to receive cases.">
                    <MenuItem value="">Not seated yet</MenuItem>
                    {benches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Specialization" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth type="number" label="Max Hearings / Day" value={form.maxHearingsPerDay} onChange={(e) => setForm((f) => ({ ...f, maxHearingsPerDay: Number(e.target.value) }))} />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Delete confirmation -------------------- */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Permanently Delete Account?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete <strong>{deleteTarget?.name}</strong>'s account. This cannot be undone.
            If this account has any complaints, evidence, hearings, or judgments on record, deletion will be
            blocked automatically — deactivate it instead to preserve the audit trail.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
