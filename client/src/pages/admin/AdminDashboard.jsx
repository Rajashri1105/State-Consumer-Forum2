import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Grid, Paper, Box, Typography, Button, Stack, Divider } from '@mui/material';
import { FolderCog, Users, BarChart3, ScrollText, Tags, ListTree, AlertTriangle, UserCog, Landmark } from 'lucide-react';
import { categoryService } from '../../services/judgmentAndNotificationService';
import { complaintService } from '../../services/complaintService';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { tokens } from '../../theme/theme';

const QUICK_ACTIONS = [
  { label: 'Manage Users', icon: Users, to: '/admin/users', variant: 'contained' },
  { label: 'Benches', icon: Landmark, to: '/admin/benches', variant: 'outlined' },
  { label: 'Categories & Priority Rules', icon: FolderCog, to: '/admin/categories', variant: 'outlined' },
  { label: 'Analytics & Reports', icon: BarChart3, to: '/admin/analytics', variant: 'outlined' },
  { label: 'Audit Logs', icon: ScrollText, to: '/admin/audit-logs', variant: 'outlined' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [priorityRules, setPriorityRules] = useState([]);
  const [delayed, setDelayed] = useState([]);
  const [manualAssignment, setManualAssignment] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [categoriesRes, rulesRes, delayedRes, manualRes] = await Promise.all([
          categoryService.list(),
          categoryService.listPriorityRules(),
          complaintService.list({ isDelayed: true, limit: 10 }),
          complaintService.getAllotmentQueue(),
        ]);
        if (cancelled) return;
        setCategories(categoriesRes.data.data.categories || []);
        setPriorityRules(rulesRes.data.data.rules || []);
        setDelayed(delayedRes.data.data.items || []);
        setManualAssignment(manualRes.data.data.items || []);
      } catch {
        // Tolerate partial failure; cards show zero rather than blocking the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader label="Loading administrator dashboard…" />;

  const activeCategories = categories.filter((c) => c.isActive).length;
  const activeRules = priorityRules.filter((r) => r.isActive).length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Welcome, {user?.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        System configuration overview. Full charts (monthly volume, judge workload, disposal time) live under Analytics &amp; Reports.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Active Categories" value={activeCategories} icon={Tags} accent="navy" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Active Priority Rules" value={activeRules} icon={ListTree} accent="brass" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Delayed — Needs Attention" value={delayed.length} icon={AlertTriangle} accent="error" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Awaiting Bench Allotment" value={manualAssignment.length} icon={UserCog} accent="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Complaint categories</Typography>
            {categories.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No categories configured yet.</Typography>
            ) : (
              <Stack divider={<Divider />} gap={1.25}>
                {categories.slice(0, 8).map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">Default: {c.defaultPriority}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          {(delayed.length > 0 || manualAssignment.length > 0) && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 2.5, borderColor: tokens.error }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <AlertTriangle size={18} color={tokens.error} />
                <Typography variant="subtitle1" fontWeight={700}>Escalation Alerts</Typography>
              </Stack>
              <Stack divider={<Divider />} gap={1.25}>
                {[...delayed, ...manualAssignment.filter((m) => !delayed.some((d) => d.id === m.id))].map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <DocketTag>{c.complaintNumber}</DocketTag>
                      <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>
                        {c.delayReason || (['NEEDS_MANUAL_ASSIGNMENT', 'PENDING_ALLOTMENT'].includes(c.status) ? 'Waiting for bench allotment' : '')}
                      </Typography>
                    </Box>
                    <Button size="small" component={RouterLink} to={`/admin/complaints/${c.id}`}>View</Button>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quick actions</Typography>
            <Stack gap={1.25}>
              {QUICK_ACTIONS.map((a) => (
                <Button key={a.label} component={RouterLink} to={a.to} variant={a.variant} startIcon={<a.icon size={18} />} sx={{ justifyContent: 'flex-start' }}>
                  {a.label}
                </Button>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
