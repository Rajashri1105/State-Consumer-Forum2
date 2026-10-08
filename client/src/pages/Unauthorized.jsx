import { Link as RouterLink } from 'react-router-dom';
import { Typography, Button, Container } from '@mui/material';
import { ShieldAlert } from 'lucide-react';
import { tokens } from '../theme/theme';

export default function Unauthorized() {
  return (
    <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
      <ShieldAlert size={56} color={tokens.error} style={{ marginBottom: 16 }} />
      <Typography variant="h3" fontWeight={700} gutterBottom>Access restricted</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Your account role doesn't have permission to view this page. If you believe this is a mistake, contact the forum administrator.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained" size="large">Go to Homepage</Button>
    </Container>
  );
}
