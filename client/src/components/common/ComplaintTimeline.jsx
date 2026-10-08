import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { tokens } from '../../theme/theme';

export default function ComplaintTimeline({ entries }) {
  if (!entries || entries.length === 0) {
    return <Typography variant="body2" color="text.secondary">No timeline entries yet.</Typography>;
  }

  return (
    <Box>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        return (
          <Box key={entry.id} sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
              <Box sx={{
                width: 12, height: 12, borderRadius: '50%',
                backgroundColor: isLast ? tokens.docketBrass : tokens.ashokaNavy,
                flexShrink: 0, mt: 0.5,
              }} />
              {!isLast && <Box sx={{ width: 2, flex: 1, backgroundColor: tokens.border, my: 0.5 }} />}
            </Box>
            <Box sx={{ pb: isLast ? 0 : 3, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>{entry.stage}</Typography>
              {entry.remarks && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{entry.remarks}</Typography>
              )}
              <Typography variant="caption" color="text.disabled">
                {dayjs(entry.createdAt).format('DD MMM YYYY, hh:mm A')}
                {entry.actor && ` · ${entry.actor.name} (${entry.actor.role})`}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
