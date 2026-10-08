import { Box } from '@mui/material';
import { tokens } from '../../theme/theme';

/**
 * The portal's signature visual motif: a monospace "docket tag" used
 * everywhere a complaint number or case ID appears (dashboard cards,
 * table rows, page headers, timeline entries) — evoking a stamped
 * court-docket reference so case numbers are instantly recognizable
 * as a distinct category of information, not just another data field.
 */
export default function DocketTag({ children, variant = 'default', sx = {} }) {
  const isInverse = variant === 'inverse';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '0.8125rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '3px 10px 3px 8px',
        borderRadius: '4px',
        border: `1px solid ${isInverse ? 'rgba(255,255,255,0.35)' : tokens.border}`,
        color: isInverse ? '#FFFFFF' : tokens.ashokaNavy,
        backgroundColor: isInverse ? 'rgba(255,255,255,0.08)' : tokens.mistGrey,
        position: 'relative',
        '&::before': {
          content: '""',
          width: '3px',
          alignSelf: 'stretch',
          borderRadius: '2px',
          backgroundColor: tokens.docketBrass,
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
