import { useEffect, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress, Link } from '@mui/material';
import { authService } from '../../services/authService';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing a token.');
      return;
    }
    authService.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'This verification link is invalid or has expired.');
      });
  }, [token]);

  return (
    <Box sx={{ textAlign: 'center' }}>
      {status === 'verifying' && (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Verifying your email…</Typography>
        </>
      )}
      {status === 'success' && (
        <>
          <Typography variant="h5" fontWeight={700} gutterBottom>Email verified</Typography>
          <Alert severity="success" sx={{ mb: 2 }}>Your account is now active. You can log in.</Alert>
          <Link component={RouterLink} to="/login">Go to log in</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <Typography variant="h5" fontWeight={700} gutterBottom>Verification failed</Typography>
          <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>
          <Link component={RouterLink} to="/login">Back to log in</Link>
        </>
      )}
    </Box>
  );
}
