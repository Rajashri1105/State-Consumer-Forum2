import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Stack, Alert, Link } from '@mui/material';
import { forgotPasswordSchema } from '../../utils/validationSchemas';
import { authService } from '../../services/authService';

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
  });

  const onSubmit = async ({ email }) => {
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send a reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>Check your email</Typography>
        <Alert severity="success">
          If a consumer or opposite-party account with that email exists, we sent a password reset link. Opening it verifies your email and lets you choose a new password. The link expires in 1 hour.
        </Alert>
        <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
          <Link component={RouterLink} to="/login">Back to log in</Link>
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Reset your password</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the email used for your consumer or opposite-party account. We’ll send a verification link to reset your password.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={2.25}>
          <TextField label="Email address" type="email" fullWidth {...register('email')} error={Boolean(errors.email)} helperText={errors.email?.message} />
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/login">Back to log in</Link>
      </Typography>
    </Box>
  );
}
