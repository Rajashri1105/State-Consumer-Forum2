import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Stack, Alert, Link,
  Paper, Divider, InputAdornment, IconButton,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { authService } from '../../services/authService';

const schema = yup.object({
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must include at least one uppercase letter')
    .matches(/[0-9]/, 'Must include at least one number')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async ({ password }) => {
    setError(null);
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'This set-password link is invalid or has expired. Please contact the court office for a new invite.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 6 }}>
        <Alert severity="error">
          This link is missing its security token. Please use the link directly from the email you received.
        </Alert>
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          <Link component={RouterLink} to="/login">Go to login</Link>
        </Typography>
      </Box>
    );
  }

  if (done) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 6 }}>
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Password set successfully!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your email is verified and your portal account is now active. Please log in with your email address and the password you just created.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => {
              toast.success('You can now log in with your new password.');
              navigate('/login');
            }}
          >
            Go to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 4 }}>
      {/* Header banner */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0d3b66 0%, #1565c0 100%)',
          borderRadius: '12px 12px 0 0',
          px: 4, py: 3,
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >
        <LockOutlinedIcon sx={{ color: '#fff', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.2 }}>
            Set Your Portal Password
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            State Consumer Forum Portal — Opposite Party Access
          </Typography>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '0 0 12px 12px',
          borderTop: 'none',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create a password for your portal account. You will use it along with your email address to log in and manage your case.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap={2.5}>
            <TextField
              id="set-password-field"
              label="New password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              {...register('password')}
              error={Boolean(errors.password)}
              helperText={errors.password?.message || 'Min. 8 characters, one uppercase letter, one number'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" aria-label="toggle password visibility">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              id="set-password-confirm-field"
              label="Confirm new password"
              type={showConfirm ? 'text' : 'password'}
              fullWidth
              {...register('confirmPassword')}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end" aria-label="toggle confirm visibility">
                      {showConfirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              id="set-password-submit"
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #0d3b66 0%, #1565c0 100%)',
                fontWeight: 700,
                py: 1.5,
              }}
            >
              {loading ? 'Setting password…' : 'Set Password & Access Portal'}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Already set your password?{' '}
          <Link component={RouterLink} to="/login" fontWeight={600}>
            Log in here
          </Link>
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          This link is valid for 14 days from when you received the invitation email.
          If it has expired, contact the court office to resend the invite.
        </Typography>
      </Paper>
    </Box>
  );
}
