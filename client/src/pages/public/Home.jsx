import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Button, Grid, Stack, Paper } from '@mui/material';
import { FilePlus2, Gavel, CalendarClock, ShieldCheck, BarChart3, Bell } from 'lucide-react';
import DocketTag from '../../components/common/DocketTag';
import { tokens } from '../../theme/theme';

const STAGES = [
  'Complaint Submitted', 'Verification', 'Accepted', 'Judge Assigned',
  'Hearing Scheduled', 'Hearing Completed', 'Judgment Uploaded', 'Case Closed',
];

const FEATURES = [
  { icon: CalendarClock, title: 'Intelligent hearing scheduling', text: 'Hearing dates are suggested automatically based on judge availability, workload, and case priority — clerks can accept or adjust.' },
  { icon: ShieldCheck, title: 'Automatic priority triage', text: 'Cases involving medical negligence, food safety, or senior citizens are flagged high-priority the moment they\u2019re filed.' },
  { icon: Gavel, title: 'Balanced judge workload', text: 'New cases are assigned to the judge with the lightest current caseload, so no bench is overloaded.' },
  { icon: BarChart3, title: 'Duplicate detection', text: 'Before a complaint is saved, it\u2019s checked against existing cases for the same parties and similar facts.' },
  { icon: Bell, title: 'Real-time updates', text: 'Consumers are notified by email and in-app the moment their case status changes.' },
  { icon: FilePlus2, title: 'Fully paperless', text: 'File complaints, upload evidence, and download judgments — no physical paperwork required.' },
];

export default function Home() {
  return (
    <Box>
      {/* Hero */}
      <Box sx={{ backgroundColor: tokens.ashokaNavyDark, color: '#fff', py: { xs: 8, md: 11 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <DocketTag variant="inverse" sx={{ mb: 2 }}>SCF-2026-000001</DocketTag>
              <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '2.8rem' }, mb: 2 }}>
                File. Track. Resolve.
                <br />Consumer disputes, end to end — online.
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.85, mb: 4, maxWidth: 560 }}>
                The State Consumer Disputes Redressal Forum portal lets you register a complaint,
                upload evidence, follow every hearing, and download your judgment — without a single visit to a counter.
              </Typography>
              <Stack direction="row" gap={2}>
                <Button component={RouterLink} to="/register" variant="contained" color="secondary" size="large">
                  File a Complaint
                </Button>
                <Button component={RouterLink} to="/complaint-procedure" variant="outlined" size="large" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
                  How It Works
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 3, backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.2)' }}>
                <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.6)' }}>Case Timeline</Typography>
                <Stack sx={{ mt: 1.5 }}>
                  {STAGES.map((stage, i) => (
                    <Stack key={stage} direction="row" gap={1.5} alignItems="flex-start" sx={{ position: 'relative', pb: i < STAGES.length - 1 ? 2.5 : 0 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: tokens.docketBrassLight, flexShrink: 0 }} />
                        {i < STAGES.length - 1 && <Box sx={{ width: '2px', flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', minHeight: 18 }} />}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: '-3px' }}>{stage}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography variant="overline" color="secondary.dark" sx={{ fontWeight: 700 }}>Built for speed and fairness</Typography>
        <Typography variant="h4" sx={{ mb: 5, maxWidth: 640 }}>
          Automation that helps the forum move faster — without replacing human judgment.
        </Typography>
        <Grid container spacing={3}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Grid item xs={12} sm={6} md={4} key={title}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 1.5, backgroundColor: tokens.mistGrey, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <Icon size={22} color={tokens.ashokaNavy} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>{title}</Typography>
                <Typography variant="body2" color="text.secondary">{text}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
