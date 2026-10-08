import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { Scale } from 'lucide-react';
import { tokens } from '../theme/theme';

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.mistGrey,
        backgroundImage: `linear-gradient(180deg, ${tokens.ashokaNavyDark} 0%, ${tokens.ashokaNavy} 220px, ${tokens.mistGrey} 220px)`,
        px: 2,
        py: 6,
      }}
    >
      <Stack alignItems="center" gap={3} sx={{ width: '100%', maxWidth: 440 }}>
        <Stack direction="row" alignItems="center" gap={1.25} component={RouterLink} to="/" sx={{ textDecoration: 'none' }}>
          <Scale size={28} color="#fff" />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>State Consumer Forum</Typography>
        </Stack>

        <Paper variant="outlined" sx={{ width: '100%', p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
          <Outlet />
        </Paper>

        <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
          Government of India · Department of Consumer Affairs
        </Typography>
      </Stack>
    </Box>
  );
}
