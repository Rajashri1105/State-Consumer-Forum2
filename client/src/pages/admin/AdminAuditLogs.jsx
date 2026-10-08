import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, Divider, Pagination, Chip } from '@mui/material';
import dayjs from 'dayjs';
import { auditLogService } from '../../services/adminService';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

export default function AdminAuditLogs() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    auditLogService.list({ page, limit: 25 })
      .then(({ data }) => {
        setItems(data.data.items || []);
        setTotalPages(data.data.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Audit Logs</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A record of security-relevant actions taken across the portal.
      </Typography>

      {loading ? <Loader label="Loading audit logs…" /> : (
        <Paper variant="outlined">
          <Stack divider={<Divider />}>
            {items.map((log) => (
              <Box key={log.id} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                  <Chip size="small" label={log.action} sx={{ backgroundColor: `${tokens.ashokaNavy}1A`, color: tokens.ashokaNavy, fontWeight: 700 }} />
                  <Typography variant="body2" color="text.secondary">{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {log.user ? `${log.user.name} (${log.user.role})` : 'System'} · {dayjs(log.createdAt).format('DD MMM YYYY, hh:mm A')}
                  {log.ipAddress && ` · ${log.ipAddress}`}
                </Typography>
              </Box>
            ))}
            {items.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>No audit log entries yet.</Typography>
            )}
          </Stack>
        </Paper>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}
    </Box>
  );
}
