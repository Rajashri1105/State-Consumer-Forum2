import { Container, Typography, Grid, Paper, Box } from '@mui/material';
import { ShieldCheck, Ear, BookOpen, Scale, Landmark, Users } from 'lucide-react';
import { tokens } from '../../theme/theme';

const RIGHTS = [
  { icon: ShieldCheck, title: 'Right to Safety', text: 'Protection against goods and services that are hazardous to life and property.' },
  { icon: BookOpen, title: 'Right to be Informed', text: 'Accurate information about the quality, quantity, and price of goods or services.' },
  { icon: Scale, title: 'Right to Choose', text: 'Access to a variety of goods and services at competitive prices.' },
  { icon: Ear, title: 'Right to be Heard', text: 'Your interests are entitled to due consideration at appropriate forums.' },
  { icon: Landmark, title: 'Right to Redressal', text: 'Fair settlement of genuine grievances against unfair or restrictive trade practices.' },
  { icon: Users, title: 'Right to Consumer Education', text: 'Access to knowledge and skills to make informed choices as an educated consumer.' },
];

export default function ConsumerRights() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
      <Typography variant="overline" color="secondary.dark" fontWeight={700}>Know Your Rights</Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>Consumer Rights under the Consumer Protection Act, 2019</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5, maxWidth: 720 }}>
        As a consumer, you are entitled to six fundamental rights recognized by law. Understanding
        them is the first step toward filing an effective complaint.
      </Typography>

      <Grid container spacing={3}>
        {RIGHTS.map(({ icon: Icon, title, text }) => (
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
  );
}
