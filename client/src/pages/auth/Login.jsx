import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, TextField, Button, Typography, Stack, Alert, Link } from '@mui/material';
import { toast } from 'react-toastify';
import { loginSchema } from '../../utils/validationSchemas';
import { loginUser, clearAuthError } from '../../redux/slices/authSlice';
import { roleHomePath } from '../../routes/guards';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useSelector((state) => state.auth);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(loginSchema),
  });

  const onSubmit = async (values) => {
    dispatch(clearAuthError());
    const result = await dispatch(loginUser(values));
    if (loginUser.fulfilled.match(result)) {
      toast.success('Welcome back!');
      const redirectTo = location.state?.from?.pathname || roleHomePath(result.payload.role);
      navigate(redirectTo, { replace: true });
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Log in to your account</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Access your complaints, hearings, and case updates.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          {error.includes('verify your email') && (
            <>
              {' '}
              <Link component={RouterLink} to="/forgot-password" color="inherit" fontWeight={700}>
                Request a password reset to verify your email.
              </Link>
            </>
          )}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={2.25}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            autoComplete="email"
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            autoComplete="current-password"
            {...register('password')}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />

          <Box sx={{ textAlign: 'right' }}>
            <Link component={RouterLink} to="/forgot-password" variant="body2">Forgot password?</Link>
          </Box>

          <Button type="submit" variant="contained" size="large" disabled={status === 'loading'}>
            {status === 'loading' ? 'Logging in…' : 'Log In'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
        New to the portal?{' '}
        <Link component={RouterLink} to="/register" fontWeight={600}>Register as a Consumer</Link>
      </Typography>
    </Box>
  );
}
