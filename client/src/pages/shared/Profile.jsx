import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box, Typography, Paper, Grid, TextField, Button, Stack, Divider,
  Avatar, Chip,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Save, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { setUser } from '../../redux/slices/authSlice';
import { changePasswordSchema } from '../../utils/validationSchemas';
import { tokens } from '../../theme/theme';

const ROLE_LABEL = { CONSUMER: 'Consumer', CLERK: 'Forum Clerk', JUDGE: 'Judge', ADMIN: 'Administrator' };

export default function Profile() {
  const { user, judgeProfile } = useAuth();
  const dispatch = useDispatch();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
    </Box>
  );
}
