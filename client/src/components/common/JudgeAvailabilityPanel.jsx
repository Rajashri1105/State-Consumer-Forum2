import { useEffect, useState } from 'react';
import { Paper, Typography, Stack, Box, Chip } from '@mui/material';
import { UserX } from 'lucide-react';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import { tokens } from '../../theme/theme';

export default function JudgeAvailabilityPanel() {
  const [onLeave, setOnLeave] = useState(null);

  useEffect(() => {
    leaveService.getTodaysAbsences()
      .then(({ data }) => setOnLeave(data.data.onLeave || []))
      .catch(() => setOnLeave([]));
  }, []);

  if (onLeave === null) return null; // loading — render nothing rather than a flash of empty state

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        <UserX size={16} color={tokens.warning} />
        <Typography variant="subtitle2" fontWeight={700}>Judge Availability Today</Typography>
      </Stack>
      {onLeave.length === 0 ? (
        <Typography variant="body2" color="text.secondary">All judges are available today.</Typography>
      ) : (
        <Stack gap={1}>
          {onLeave.map((l) => (
            <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{l.judge?.user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">{l.reason}</Typography>
              </Box>
              <Chip
                size="small"
                label={`Until ${dayjs(l.endDate).format('DD MMM')}`}
                sx={{ backgroundColor: `${tokens.warning}1A`, color: tokens.warning, fontWeight: 700 }}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
