import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Divider, Button, Chip } from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Bell } from 'lucide-react';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../redux/slices/notificationSlice';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

dayjs.extend(relativeTime);

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, unreadCount, status } = useSelector((state) => state.notifications);

  // Derive this role's home prefix from the current URL (e.g. /consumer/notifications -> /consumer)
  const homePrefix = `/${location.pathname.split('/')[1]}`;

  useEffect(() => {
    dispatch(fetchNotifications({ limit: 50 }));
  }, [dispatch]);

  const handleClick = (n) => {
    dispatch(markNotificationRead(n.id));
    if (n.relatedComplaintId) navigate(`${homePrefix}/complaints/${n.relatedComplaintId}`);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Notifications</Typography>
          <Typography variant="body2" color="text.secondary">Updates on your complaints and hearings.</Typography>
        </Box>
        {unreadCount > 0 && (
          <Button variant="outlined" onClick={() => dispatch(markAllNotificationsRead())}>Mark all as read</Button>
        )}
      </Stack>

      {status === 'loading' ? (
        <Loader label="Loading notifications…" />
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <Bell size={36} color={tokens.inkMuted} style={{ marginBottom: 12 }} />
          <Typography variant="body1" fontWeight={600}>No notifications yet</Typography>
          <Typography variant="body2" color="text.secondary">Updates on your complaints and hearings will show up here.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {items.map((n) => (
              <Box
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{
                  p: 2, cursor: n.relatedComplaintId ? 'pointer' : 'default',
                  backgroundColor: n.isRead ? 'transparent' : `${tokens.ashokaNavy}05`,
                  '&:hover': n.relatedComplaintId ? { backgroundColor: 'action.hover' } : undefined,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={700}>{n.title}</Typography>
                      {!n.isRead && <Chip size="small" label="New" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{n.message}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>{dayjs(n.createdAt).fromNow()}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
