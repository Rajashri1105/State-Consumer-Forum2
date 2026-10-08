import { Link as RouterLink } from 'react-router-dom';
import { Typography, Button, Container } from '@mui/material';
import { FileQuestion } from 'lucide-react';
import { tokens } from '../theme/theme';

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
      <FileQuestion size={56} color={tokens.docketBrass} style={{ marginBottom: 16 }} />
      <Typography variant="h3" fontWeight={700} gutterBottom>Page not found</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The page you're looking for doesn't exist or may have moved. Check the address, or head back to the homepage.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained" size="large">Go to Homepage</Button>
    </Container>
  );
}
