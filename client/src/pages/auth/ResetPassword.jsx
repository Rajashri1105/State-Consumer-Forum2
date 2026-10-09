import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Stack, Alert, Link } from '@mui/material';
import { toast } from 'react-toastify';
import { resetPasswordSchema } from '../../utils/validationSchemas';
import { authService } from '../../services/authService';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resetComplete, setResetComplete] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(resetPasswordSchema),
  });

  const onSubmit = async ({ password }) => {
    setError(null);
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setResetComplete(true);
      toast.success('Password reset and email verified successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>This reset link is missing a token. Please request a new one.</Alert>
        <Link component={RouterLink} to="/forgot-password">Request another reset link</Link>
      </Box>
    );
  }

  if (resetComplete) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>Password updated</Typography>
        <Alert severity="success" sx={{ mb: 2 }}>
          Your password has been reset and your email verified. Your old password will no longer work; log in with the new password you just created.
        </Alert>
        <Button variant="contained" size="large" fullWidth onClick={() => navigate('/login', { replace: true })}>
          Continue to log in
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Set a new password</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={2.25}>
          <TextField label="New password" type="password" fullWidth {...register('password')} error={Boolean(errors.password)} helperText={errors.password?.message} />
          <TextField label="Confirm new password" type="password" fullWidth {...register('confirmPassword')} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/forgot-password">Request a new reset link</Link>
      </Typography>
    </Box>
  );
}
