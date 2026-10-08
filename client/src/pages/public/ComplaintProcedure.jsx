import { Container, Typography, Stack, Box, Paper, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens } from '../../theme/theme';

const STEPS = [
  { title: 'Register & file your complaint', text: 'Create a consumer account, then fill in the complaint form with the seller/opposite party details, purchase information, and a detailed description of the issue.' },
  { title: 'Upload evidence', text: 'Attach your invoice, warranty card, photos, or any supporting documents. These strengthen your case and speed up verification.' },
  { title: 'Clerk verification', text: 'A forum clerk reviews your complaint for completeness and checks for duplicate filings before accepting it.' },
  { title: 'Priority & judge assignment', text: 'The system assigns a priority level automatically, then the clerk assigns the case to the judge with the most available capacity.' },
  { title: 'Hearing scheduled', text: 'A hearing date is suggested automatically based on the judge\u2019s calendar and your case priority. You\u2019ll be notified by email and in-app.' },
  { title: 'Hearing & judgment', text: 'Attend the hearing (in person or as directed). Once concluded, the judge uploads a judgment, which you can download from your dashboard.' },
];

export default function ComplaintProcedure() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Typography variant="overline" color="secondary.dark" fontWeight={700}>Step by Step</Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>How to file and track a complaint</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        The entire process happens online, in the order below. You can check exactly which stage
        your case is in at any time from your dashboard.
      </Typography>

      <Stack gap={2}>
        {STEPS.map((step, i) => (
          <Paper key={step.title} variant="outlined" sx={{ p: 3, display: 'flex', gap: 2.5 }}>
            <Box sx={{
              flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
              backgroundColor: tokens.ashokaNavy, color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem',
            }}>
              {i + 1}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{step.title}</Typography>
              <Typography variant="body2" color="text.secondary">{step.text}</Typography>
            </Box>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ mt: 5, textAlign: 'center' }}>
        <Button component={RouterLink} to="/register" variant="contained" size="large">Start Your Complaint</Button>
      </Box>
    </Container>
  );
}
