import { Paper, Box, Typography } from '@mui/material';
import { tokens } from '../../theme/theme';

const ACCENTS = {
  navy: tokens.ashokaNavy,
  brass: tokens.docketBrass,
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
  info: tokens.info,
};

export default function StatCard({ label, value, icon: Icon, accent = 'navy', onClick }) {
  const color = ACCENTS[accent] || ACCENTS.navy;

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        borderLeft: `3px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease',
        '&:hover': onClick ? { boxShadow: '0 2px 10px rgba(15,52,96,0.10)' } : undefined,
      }}
    >
      {Icon && (
        <Box sx={{ width: 40, height: 40, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}1A`, color, flexShrink: 0 }}>
          <Icon size={20} strokeWidth={2} />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.15 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
      </Box>
    </Paper>
  );
}
