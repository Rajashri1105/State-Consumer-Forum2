import { Container, Typography, Grid, Paper, Box } from '@mui/material';
import { tokens } from '../../theme/theme';

const STATS = [
  { label: 'Consumer complaints filed', value: '100+' },
  { label: 'Cases disposed', value: '30+' },
  { label: 'Sitting judges', value: '10' },
  { label: 'Average hearing lead time', value: '3–7 days' },
];

export default function About() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Typography variant="overline" color="secondary.dark" fontWeight={700}>About Us</Typography>
      <Typography variant="h3" sx={{ mb: 3 }}>The State Consumer Disputes Redressal Forum</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        The State Consumer Disputes Redressal Commission is a statutory body constituted under the Consumer Protection Act, 2019.
        It has pecuniary jurisdiction over original consumer complaints with claim amounts exceeding ₹50,00,000 up to ₹2,00,00,000,
        as well as appellate jurisdiction over orders passed by District Consumer Commissions.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        This State Commission portal digitizes the entire process — from filing a new complaint or appeal to receiving court orders
        and final judgments — ensuring transparent, digitized case management for consumers, appellants, clerks, and judges.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 6 }}>
        {STATS.map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color={tokens.ashokaNavy}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" gutterBottom>Our mandate</Typography>
      <Box component="ul" sx={{ color: 'text.secondary', pl: 3 }}>
        <li><Typography variant="body1" sx={{ mb: 1 }}>Provide a simple, speedy, and inexpensive forum for consumer redressal.</Typography></li>
        <li><Typography variant="body1" sx={{ mb: 1 }}>Ensure transparency at every stage of a case through a public timeline.</Typography></li>
        <li><Typography variant="body1" sx={{ mb: 1 }}>Reduce the burden of manual scheduling and paperwork on forum staff.</Typography></li>
        <li><Typography variant="body1">Maintain a secure, auditable digital record of every complaint and judgment.</Typography></li>
      </Box>
    </Container>
  );
}
