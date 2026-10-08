import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Stack, Button } from '@mui/material';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import dayjs from 'dayjs';
import { FileText, Clock, CheckCircle2, XCircle, Users, Gavel, ClipboardList, FileDown, AlertTriangle, UserCog } from 'lucide-react';
import { analyticsService } from '../../services/adminService';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import { downloadCsv } from '../../utils/csvExport';
import { tokens } from '../../theme/theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const CHART_COLORS = [tokens.ashokaNavy, tokens.docketBrass, tokens.success, tokens.warning, tokens.error, tokens.info, '#6A3FA0', '#B5651D', '#2E7D32', '#5D4037'];

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    analyticsService.getDashboard()
      .then(({ data }) => setData(data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Crunching analytics…" />;
  if (!data) return <Typography color="text.secondary">Analytics data is currently unavailable.</Typography>;

  const { overview, monthlyComplaints, registrationGrowth, categoryDistribution, avgResolutionDays, judgeWorkload, jurisdictionDistribution = [], escalation } = data;

  const monthLabels = monthlyComplaints.map((m) => dayjs(`${m.month}-01`).format('MMM YY'));

  const handleExportCsv = () => {
    const timestamp = dayjs().format('YYYY-MM-DD');

    downloadCsv(`scf-overview-${timestamp}`, [{
      metric: 'Total Complaints', value: overview.totalComplaints,
    }, {
      metric: 'Pending', value: overview.pending,
    }, {
      metric: 'Disposed', value: overview.disposed,
    }, {
      metric: 'Rejected', value: overview.rejected,
    }, {
      metric: 'Average Resolution Time (days)', value: avgResolutionDays,
    }, {
      metric: 'Total Consumers', value: overview.totalConsumers,
    }, {
      metric: 'Total Judges', value: overview.totalJudges,
    }, {
      metric: 'Total Clerks', value: overview.totalClerks,
    }]);

    downloadCsv(`scf-monthly-complaints-${timestamp}`, monthlyComplaints.map((m) => ({ month: m.month, complaintsFiled: m.count })));
    downloadCsv(`scf-category-distribution-${timestamp}`, categoryDistribution.map((c) => ({ category: c.category, complaints: c.count })));
    downloadCsv(`scf-jurisdiction-distribution-${timestamp}`, jurisdictionDistribution.map((j) => ({ jurisdiction: j.jurisdiction, complaints: j.count })));
    downloadCsv(`scf-judge-workload-${timestamp}`, judgeWorkload.map((j) => ({
      judge: j.name, designation: j.designation, pendingCases: j.pendingCases, hearingsToday: j.hearingsToday, hearingsThisWeek: j.hearingsThisWeek, workloadScore: j.workloadScore,
    })));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>Analytics &amp; Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            System-wide complaint volume, disposal performance, and judge workload.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<FileDown size={16} />} onClick={handleExportCsv}>
          Export CSV Reports
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}><StatCard label="Total Complaints" value={overview.totalComplaints} icon={FileText} accent="navy" /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><StatCard label="Pending" value={overview.pending} icon={Clock} accent="info" /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><StatCard label="Disposed" value={overview.disposed} icon={CheckCircle2} accent="success" /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><StatCard label="Rejected" value={overview.rejected} icon={XCircle} accent="error" /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><StatCard label="Avg. Resolution Time" value={`${avgResolutionDays}d`} icon={Clock} accent="brass" /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><StatCard label="Consumers" value={overview.totalConsumers} icon={Users} accent="info" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Judges" value={overview.totalJudges} icon={Gavel} accent="navy" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Clerks" value={overview.totalClerks} icon={ClipboardList} accent="brass" /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}><StatCard label="Delayed — Needs Attention" value={escalation?.delayedCount || 0} icon={AlertTriangle} accent="error" /></Grid>
        <Grid item xs={12} sm={6}><StatCard label="Needs Manual Judge Assignment" value={escalation?.needsManualAssignmentCount || 0} icon={UserCog} accent="warning" /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Monthly Complaint Volume</Typography>
            <Bar
              data={{
                labels: monthLabels,
                datasets: [{ label: 'Complaints Filed', data: monthlyComplaints.map((m) => m.count), backgroundColor: tokens.ashokaNavy, borderRadius: 4 }],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Consumer Registration Growth</Typography>
            <Line
              data={{
                labels: monthLabels,
                datasets: [{ label: 'New Consumers', data: registrationGrowth.map((m) => m.count), borderColor: tokens.docketBrass, backgroundColor: `${tokens.docketBrass}33`, fill: true, tension: 0.35 }],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Top Complaint Categories</Typography>
            {categoryDistribution.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No complaints filed yet.</Typography>
            ) : (
              <Doughnut
                data={{
                  labels: categoryDistribution.map((c) => c.category),
                  datasets: [{ data: categoryDistribution.map((c) => c.count), backgroundColor: CHART_COLORS }],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }}
              />
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Complaints by Jurisdiction</Typography>
            {jurisdictionDistribution.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No complaints filed yet.</Typography>
            ) : (
              <Doughnut
                data={{
                  labels: jurisdictionDistribution.map((j) => j.jurisdiction),
                  datasets: [{ data: jurisdictionDistribution.map((j) => j.count), backgroundColor: [tokens.ashokaNavy, tokens.docketBrass, tokens.error] }],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }}
              />
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Judge Workload</Typography>
            <Stack gap={1.5}>
              {judgeWorkload.map((j) => (
                <Box key={j.judgeId}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>{j.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{j.pendingCases} pending · {j.hearingsToday} today</Typography>
                  </Stack>
                  <Box sx={{ height: 6, borderRadius: 3, backgroundColor: `${tokens.ashokaNavy}1A`, mt: 0.5, overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 3, backgroundColor: tokens.ashokaNavy,
                      width: `${Math.min(100, (j.workloadScore / (Math.max(...judgeWorkload.map((x) => x.workloadScore), 1))) * 100)}%`,
                    }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
