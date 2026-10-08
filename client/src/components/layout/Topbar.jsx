import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Box, Menu, MenuItem, Avatar, Divider, ListItemIcon } from '@mui/material';
import { PanelLeftClose, PanelLeftOpen, LogOut, UserRound, KeyRound } from 'lucide-react';
import { toggleSidebar } from '../../redux/slices/uiSlice';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';

export default function Topbar({ sidebarCollapsed, homePrefix, pageTitle }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppBar position="sticky" color="inherit" sx={{ backgroundColor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1 }}>
        <IconButton onClick={() => dispatch(toggleSidebar())} aria-label="Toggle sidebar">
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </IconButton>

        <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem' }}>
          {pageTitle}
        </Typography>

        <NotificationBell homePrefix={homePrefix} />

        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Account menu" sx={{ ml: 0.5 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: '0.85rem', bgcolor: 'primary.main' }}>{initials}</Avatar>
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={700}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setAnchorEl(null); navigate(`${homePrefix}/profile`); }}>
            <ListItemIcon><UserRound size={18} /></ListItemIcon>
            My Profile
          </MenuItem>
          <MenuItem onClick={() => { setAnchorEl(null); navigate(`${homePrefix}/profile?tab=security`); }}>
            <ListItemIcon><KeyRound size={18} /></ListItemIcon>
            Change Password
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon><LogOut size={18} /></ListItemIcon>
            Log Out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
