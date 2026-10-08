import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Typography, Button, Container, Stack, Divider } from '@mui/material';
import { Scale } from 'lucide-react';
import { tokens } from '../theme/theme';

const PUBLIC_NAV = [
  { label: 'Home', path: '/' },
  { label: 'About the Forum', path: '/about' },
  { label: 'Consumer Rights', path: '/consumer-rights' },
  { label: 'Complaint Procedure', path: '/complaint-procedure' },
  { label: 'FAQs', path: '/faqs' },
  { label: 'Contact', path: '/contact' },
];

export default function PublicLayout() {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Box sx={{ backgroundColor: tokens.ashokaNavyDark, color: '#fff', py: 0.5 }}>
        <Container maxWidth="lg">
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Government of India · Department of Consumer Affairs
          </Typography>
        </Container>
      </Box>

      <AppBar position="sticky" color="inherit" sx={{ backgroundColor: '#fff' }}>
        <Toolbar component={Container} maxWidth="lg" sx={{ gap: 3 }}>
          <Stack direction="row" alignItems="center" gap={1} component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
            <Scale size={26} color={tokens.ashokaNavy} />
            <Typography variant="subtitle1" fontWeight={700} color={tokens.ashokaNavy}>
              State Consumer Forum
            </Typography>
          </Stack>

          <Stack direction="row" gap={0.5} sx={{ flex: 1, display: { xs: 'none', md: 'flex' } }}>
            {PUBLIC_NAV.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                sx={{
                  color: location.pathname === item.path ? tokens.ashokaNavy : tokens.inkMuted,
                  fontWeight: location.pathname === item.path ? 700 : 500,
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Stack direction="row" gap={1}>
            <Button component={RouterLink} to="/login" variant="outlined">Log In</Button>
            <Button component={RouterLink} to="/register" variant="contained">Register</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>

      <Box sx={{ backgroundColor: tokens.deepSlate, color: 'rgba(255,255,255,0.8)', mt: 6 }}>
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={3}>
            <Box sx={{ maxWidth: 360 }}>
              <Typography variant="subtitle1" fontWeight={700} color="#fff">State Consumer Forum Portal</Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                A digital-first venue for filing, tracking, and resolving consumer disputes under the Consumer Protection Act, 2019.
              </Typography>
            </Box>
            <Stack direction="row" gap={6}>
              <Stack gap={0.75}>
                <Typography variant="overline" sx={{ opacity: 0.6 }}>Portal</Typography>
                {PUBLIC_NAV.slice(1).map((item) => (
                  <Typography key={item.path} component={RouterLink} to={item.path} variant="body2" sx={{ color: 'inherit', textDecoration: 'none', opacity: 0.85, '&:hover': { opacity: 1 } }}>
                    {item.label}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          </Stack>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.15)' }} />
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            © {new Date().getFullYear()} State Consumer Disputes Redressal Forum. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
