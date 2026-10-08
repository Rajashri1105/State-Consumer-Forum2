import { Box, CircularProgress, Typography } from '@mui/material';

export default function Loader({ label = 'Loading…', minHeight = 240 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, gap: 1.5 }}>
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}
