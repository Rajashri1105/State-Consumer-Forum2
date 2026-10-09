import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, Button, Stack, Divider,
  Avatar, Chip, Alert, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Save, KeyRound, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { logoutUser, setUser } from '../../redux/slices/authSlice';
import { changePasswordSchema } from '../../utils/validationSchemas';
import { tokens } from '../../theme/theme';

const ROLE_LABEL = {
  CONSUMER: 'Consumer',
  OPPOSITE_PARTY: 'Opposite Party',
  CLERK: 'Forum Clerk',
  JUDGE: 'Judge',
  ADMIN: 'Administrator',
};

export default function Profile() {
  const { user, judgeProfile } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState({ loading: true, eligible: false, incompleteCases: [], error: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!['CONSUMER', 'OPPOSITE_PARTY'].includes(user?.role)) return undefined;

    let cancelled = false;
    authService.getAccountDeletionStatus()
      .then(({ data }) => {
        if (!cancelled) setDeletionStatus({ loading: false, ...data.data, error: '' });
      })
      .catch((err) => {
        if (!cancelled) {
          setDeletionStatus({
            loading: false,
            eligible: false,
            incompleteCases: [],
            error: err.response?.data?.message || 'Unable to check account deletion eligibility.',
          });
        }
      });

    return () => { cancelled = true; };
  }, [user?.role]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data } = await authService.updateProfile({ name, phone, address });
      dispatch(setUser(data.data.user));
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values) => {
    setChangingPassword(true);
    try {
      await authService.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const onDeleteAccount = async () => {
    setDeleteError('');
    setDeletingAccount(true);
    try {
      await authService.deleteAccount(deletePassword);
      toast.success('Your account has been deleted.');
      await dispatch(logoutUser());
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Unable to delete your account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>My Profile</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your personal information and account security.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={2.5} sx={{ mb: 3 }}>
          <Avatar sx={{ width: 76, height: 76, fontSize: '1.75rem', backgroundColor: tokens.ashokaNavy }}>
            {user?.name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>{user?.name}</Typography>
            <Chip size="small" label={ROLE_LABEL[user?.role] || user?.role} sx={{ backgroundColor: `${tokens.ashokaNavy}1A`, color: tokens.ashokaNavy, fontWeight: 700, mt: 0.5 }} />
          </Box>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Email" value={user?.email || ''} disabled helperText="Email cannot be changed" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Grid>
        </Grid>

        {user?.role === 'JUDGE' && judgeProfile && (
          <>
            <Divider sx={{ my: 3 }}><Typography variant="caption" color="text.secondary">Judge Profile (set by Administrator)</Typography></Divider>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Designation" value={judgeProfile.designation} disabled /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Court Room" value={judgeProfile.courtRoom || '—'} disabled /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Specialization" value={judgeProfile.specialization || '—'} disabled /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Max Hearings / Day" value={judgeProfile.maxHearingsPerDay} disabled /></Grid>
            </Grid>
          </>
        )}

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button variant="contained" startIcon={<Save size={16} />} onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <KeyRound size={18} color={tokens.docketBrass} />
          <Typography variant="subtitle1" fontWeight={700}>Change Password</Typography>
        </Stack>
        <Box component="form" onSubmit={handleSubmit(onChangePassword)} noValidate>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller name="currentPassword" control={control} render={({ field }) => (
                <TextField {...field} fullWidth type="password" label="Current Password" error={Boolean(errors.currentPassword)} helperText={errors.currentPassword?.message} />
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="newPassword" control={control} render={({ field }) => (
                <TextField {...field} fullWidth type="password" label="New Password" error={Boolean(errors.newPassword)} helperText={errors.newPassword?.message} />
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="confirmPassword" control={control} render={({ field }) => (
                <TextField {...field} fullWidth type="password" label="Confirm New Password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
              )} />
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button type="submit" variant="contained" color="secondary" disabled={changingPassword}>
              {changingPassword ? 'Updating…' : 'Update Password'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {['CONSUMER', 'OPPOSITE_PARTY'].includes(user?.role) && (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Delete Account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You can delete your account only after every complaint case linked to you is complete. Your login and profile information will be removed; completed case records will be retained in redacted form.
          </Typography>

          {deletionStatus.error ? (
            <Alert severity="error" sx={{ mb: 2 }}>{deletionStatus.error}</Alert>
          ) : deletionStatus.loading ? (
            <Alert severity="info" sx={{ mb: 2 }}>Checking your case status…</Alert>
          ) : !deletionStatus.eligible ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Account deletion is unavailable until all cases are completed.
              {deletionStatus.incompleteCases.length > 0 && (
                <Box component="ul" sx={{ mb: 0, pl: 2.5 }}>
                  {deletionStatus.incompleteCases.map((complaint) => (
                    <li key={complaint.complaintNumber}>
                      {complaint.complaintNumber}: {complaint.status.replaceAll('_', ' ').toLowerCase()}
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>All your cases are complete. Your account is eligible for deletion.</Alert>
          )}

          <Button
            variant="outlined"
            color="error"
            startIcon={<Trash2 size={16} />}
            disabled={deletionStatus.loading || !deletionStatus.eligible || Boolean(deletionStatus.error)}
            onClick={() => {
              setDeletePassword('');
              setDeleteError('');
              setDeleteDialogOpen(true);
            }}
          >
            Delete My Account
          </Button>
        </Paper>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => !deletingAccount && setDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This permanently removes your ability to log in and removes your profile details. Completed case records are retained in redacted form. Enter your current password to confirm.
          </DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Current password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deletingAccount}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={onDeleteAccount}
            disabled={deletingAccount || !deletePassword}
          >
            {deletingAccount ? 'Deleting…' : 'Permanently Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
