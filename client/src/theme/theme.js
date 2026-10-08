import { createTheme } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Palette named after its role in the forum's world:
//   Ashoka Navy   — primary institutional blue (headers, sidebar, primary actions)
//   Deep Slate    — darker navy for the sidebar surface itself
//   Docket Brass  — muted seal/stamp gold, used sparingly for active states
//     and the "docket tag" signature element (complaint numbers, case IDs)
//   Mist Grey     — app background
//   Paper White   — card/surface background
export const tokens = {
  ashokaNavy: '#0F3460',
  ashokaNavyDark: '#0A2647',
  deepSlate: '#122C4A',
  docketBrass: '#96692B',
  docketBrassLight: '#C8985A',
  mistGrey: '#F1F4F7',
  paperWhite: '#FFFFFF',
  ink: '#1C2733',
  inkMuted: '#5B6B7C',
  success: '#2E7D32',
  warning: '#B45309',
  error: '#B3261E',
  info: '#1B6FA8',
  border: '#DCE3EA',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.ashokaNavy,
      dark: tokens.ashokaNavyDark,
      light: '#3B6394',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: tokens.docketBrassLight,
      light: tokens.docketBrassLight,
      contrastText: '#FFFFFF',
    },
    background: {
      default: tokens.mistGrey,
      paper: tokens.paperWhite,
    },
    text: {
      primary: tokens.ink,
      secondary: tokens.inkMuted,
    },
    success: { main: tokens.success },
    warning: { main: tokens.warning },
    error: { main: tokens.error },
    info: { main: tokens.info },
    divider: tokens.border,
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    h1: { fontFamily: '"Source Serif 4", serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontFamily: '"Source Serif 4", serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
    h4: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
    h5: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
    h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    caption: { fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.02em' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6, paddingInline: 18, boxShadow: 'none' },
        containedPrimary: {
          '&:hover': { boxShadow: 'none', backgroundColor: tokens.ashokaNavyDark },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: tokens.border },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none', borderBottom: `1px solid ${tokens.border}` },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: tokens.mistGrey,
          color: tokens.ink,
        },
      },
    },
  },
});

export default theme;
