import { NavLink, useLocation } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { Scale } from 'lucide-react';
import { tokens } from '../../theme/theme';
import { NAV_CONFIG, ROLE_LABELS } from '../../routes/navConfig';

const SIDEBAR_WIDTH = 264;

export default function Sidebar({ role, collapsed }) {
  const location = useLocation();
  const items = NAV_CONFIG[role] || [];

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: collapsed ? 76 : SIDEBAR_WIDTH,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: tokens.deepSlate,
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflowX: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 3 }}>
        <Scale size={26} color={tokens.docketBrassLight} strokeWidth={2} />
        {!collapsed && (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15, color: '#fff' }}>
              State Consumer Forum
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit', letterSpacing: 0 }}>
              {ROLE_LABELS[role]} Portal
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {items.map(({ label, icon: Icon, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <ListItemButton
              key={path}
              component={NavLink}
              to={path}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                py: 1.1,
                color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                backgroundColor: active ? 'rgba(150,105,43,0.35)' : 'transparent',
                borderLeft: active ? `3px solid ${tokens.docketBrassLight}` : '3px solid transparent',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                <Icon size={20} strokeWidth={2} />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 600 : 500 }} />}
            </ListItemButton>
          );
        })}
      </List>

      {!collapsed && (
        <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit' }}>
            Government of India · Consumer Affairs
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export { SIDEBAR_WIDTH };
