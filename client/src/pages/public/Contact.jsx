import { Container, Typography, Grid, Paper, Stack, Box } from '@mui/material';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { tokens } from '../../theme/theme';

const CONTACT_CARDS = [
  {
    icon: MapPin,
    title: 'Office Address',
    lines: ['State Consumer Disputes Redressal Forum', 'Civil Lines, District Court Complex', 'State Capital — 110001'],
  },
  {
    icon: Phone,
    title: 'Helpline',
    lines: ['1800-11-4000 (Toll-free)', 'Mon – Fri, 10:00 AM – 5:00 PM'],
  },
  {
    icon: Mail,
    title: 'Email',
    lines: ['contact@consumerforum.gov.in', 'Response within 2 working days'],
  },
  {
    icon: Clock,
    title: 'Office Hours',
    lines: ['Monday – Friday: 10:00 AM – 5:00 PM', 'Closed on government holidays'],
  },
];

export default function Contact() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Typography variant="overline" color="secondary.dark" fontWeight={700}>Get in Touch</Typography>
      <Typography variant="h3" sx={{ mb: 1.5 }}>Contact the Forum</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        For questions about an existing complaint, please log in and use the notification center on
        your dashboard — our staff can respond fastest through the portal. For anything else, reach
        us directly using the details below.
      </Typography>

      <Grid container spacing={2.5}>
        {CONTACT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Grid item xs={12} sm={6} key={card.title}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', backgroundColor: tokens.mistGrey }}>
                    <Icon size={18} color={tokens.ashokaNavy} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
                </Stack>
                {card.lines.map((line) => (
                  <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>
                ))}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
