import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, Link, Grid } from '@mui/material';
import { toast } from 'react-toastify';
import { registerSchema } from '../../utils/validationSchemas';
import { registerUser, clearAuthError } from '../../redux/slices/authSlice';

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((state) => state.auth);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(registerSchema),
  });

  const onSubmit = async (values) => {
    dispatch(clearAuthError());
    const { confirmPassword, ...payload } = values;
    const result = await dispatch(registerUser(payload));
    if (registerUser.fulfilled.match(result)) {
      toast.success('Registration successful! Please check your email to verify your account.');
      navigate('/login');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Create your consumer account</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Register to file and track complaints with the forum.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Full name" fullWidth {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Email address" type="email" fullWidth {...register('email')} error={Boolean(errors.email)} helperText={errors.email?.message} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Phone number" fullWidth {...register('phone')} error={Boolean(errors.phone)} helperText={errors.phone?.message} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" fullWidth multiline minRows={2} {...register('address')} error={Boolean(errors.address)} helperText={errors.address?.message} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Password" type="password" fullWidth {...register('password')} error={Boolean(errors.password)} helperText={errors.password?.message} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Confirm password" type="password" fullWidth {...register('confirmPassword')} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" size="large" fullWidth disabled={status === 'loading'}>
              {status === 'loading' ? 'Creating account…' : 'Create Account'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
        Already registered?{' '}
        <Link component={RouterLink} to="/login" fontWeight={600}>Log in</Link>
      </Typography>
    </Box>
  );
}
