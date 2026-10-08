import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { IconButton, Badge, Menu, MenuItem, Typography, Box, Divider, Button } from '@mui/material';
import { Bell } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  fetchUnreadCount, fetchNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../redux/slices/notificationSlice';

dayjs.extend(relativeTime);

export default function NotificationBell({ homePrefix }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, unreadCount } = useSelector((state) => state.notifications);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    dispatch(fetchUnreadCount());
    const interval = setInterval(() => dispatch(fetchUnreadCount()), 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    dispatch(fetchNotifications({ limit: 6 }));
  };

  const handleItemClick = (notification) => {
    dispatch(markNotificationRead(notification.id));
    setAnchorEl(null);
    if (notification.relatedComplaintId) {
      navigate(`${homePrefix}/complaints/${notification.relatedComplaintId}`);
    }
  };

  return (
    <>
      <IconButton onClick={handleOpen} aria-label={`Notifications, ${unreadCount} unread`}>
        <Badge badgeContent={unreadCount} color="error">
          <Bell size={22} />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 360, maxHeight: 420 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => dispatch(markAllNotificationsRead())}>Mark all read</Button>
          )}
        </Box>
        <Divider />
        {items.length === 0 && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Nothing here yet. Updates on your complaints will appear as they happen.</Typography>
          </Box>
        )}
        {items.map((n) => (
          <MenuItem key={n.id} onClick={() => handleItemClick(n)} sx={{ whiteSpace: 'normal', alignItems: 'flex-start', py: 1.25, backgroundColor: n.isRead ? 'transparent' : 'action.hover' }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
              <Typography variant="caption" color="text.secondary" component="p">{n.message}</Typography>
              <Typography variant="caption" color="text.disabled">{dayjs(n.createdAt).fromNow()}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
