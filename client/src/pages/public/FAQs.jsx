import { useState } from 'react';
import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { tokens } from '../../theme/theme';

const FAQ_ITEMS = [
  {
    question: 'Who can file a complaint on this portal?',
    answer: 'Any consumer who has purchased goods or availed a service and believes there has been a deficiency, defect, or unfair trade practice can register and file a complaint. You do not need a lawyer to file or track your case.',
  },
  {
    question: 'Is there a fee to file a complaint?',
    answer: 'Filing fees, where applicable, depend on the value of the claim and are specified under the Consumer Protection Act, 2019. The portal will show any applicable fee before final submission.',
  },
  {
    question: 'How is my complaint priority decided?',
    answer: 'Every complaint is automatically screened against a set of configured rules — for example, complaints involving medical negligence, food safety, senior citizens, or children are treated as high priority. This happens instantly at submission, before any manual review.',
  },
  {
    question: 'How is my hearing date chosen?',
    answer: 'Once a judge is assigned, the portal\'s scheduling engine looks at that judge\'s existing calendar, availability, and forum holidays to suggest the earliest suitable date. A clerk can accept this suggestion or set a different date if needed.',
  },
  {
    question: 'What happens if my complaint looks similar to one I filed before?',
    answer: 'The portal compares new complaints against existing ones using the opposing party, your details, and the complaint description. If a likely duplicate is found, you will be shown the matching case(s) before your new complaint is finalized.',
  },
  {
    question: 'How will I know what is happening with my case?',
    answer: 'Every status change — verification, acceptance, judge assignment, hearing dates, and the final judgment — triggers both an email and an in-app notification, and is recorded on your complaint\'s timeline.',
  },
  {
    question: 'Can I upload evidence after I\'ve filed my complaint?',
    answer: 'Yes. You can add invoices, warranty cards, photographs, or other supporting documents from your complaint\'s detail page at any point before the case is closed.',
  },
  {
    question: 'How do I download the final judgment?',
    answer: 'Once the judge uploads a judgment, it appears on your complaint\'s detail page with a download link, and you will receive a notification the moment it is available.',
  },
];

export default function FAQs() {
  const [expanded, setExpanded] = useState('panel-0');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Typography variant="overline" color="secondary.dark" fontWeight={700}>Help Center</Typography>
      <Typography variant="h3" sx={{ mb: 1.5 }}>Frequently asked questions</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        Answers to the questions we hear most from consumers using the portal. If you can't find what
        you're looking for, reach out through our Contact page.
      </Typography>

      <Box>
        {FAQ_ITEMS.map((item, index) => {
          const panelId = `panel-${index}`;
          return (
            <Accordion
              key={panelId}
              expanded={expanded === panelId}
              onChange={(e, isExpanded) => setExpanded(isExpanded ? panelId : false)}
              disableGutters
              sx={{ border: `1px solid ${tokens.border}`, '&:before': { display: 'none' }, mb: 1.25, borderRadius: 1.5, overflow: 'hidden' }}
            >
              <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                <Typography variant="subtitle1" fontWeight={600}>{item.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">{item.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Container>
  );
}
