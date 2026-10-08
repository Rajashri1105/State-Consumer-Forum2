import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Paper, Grid, Stack, Button, Divider } from '@mui/material';
import { ArrowLeft, Download } from 'lucide-react';
import dayjs from 'dayjs';
import { complaintService } from '../../services/complaintService';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import ComplaintTimeline from '../../components/common/ComplaintTimeline';
import PartyResponsePanel from '../../components/common/PartyResponsePanel';
import { StatusChip } from '../../components/common/StatusChips';
import { fileUrl } from '../../utils/fileUrl';

/** The opposite party's view of a case: what is alleged, what to do, what happens next. */
export default function PartyCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const load = useCallback(() => {
    complaintService.getById(id)
      .then(({ data }) => { setComplaint(data.data.complaint); setTimeline(data.data.timeline || []); })
      .catch(() => navigate('/party/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);
  useEffect(load, [load]);

  if (loading) return <Loader label="Loading case…" />;
  if (!complaint) return null;

  const nextHearing = (complaint.hearings || []).filter((h) => h.status === 'SCHEDULED').sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0];

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
        <DocketTag>{complaint.complaintNumber}</DocketTag>
        <StatusChip status={complaint.status} />
      </Stack>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{complaint.title}</Typography>

      {nextHearing && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700}>Next hearing</Typography>
          <Typography variant="body1">{dayjs(nextHearing.scheduledDate).format('dddd, DD MMM YYYY')} at {nextHearing.scheduledTime}{complaint.bench ? ` · ${complaint.bench.name}${complaint.bench.courtRoom ? ` (${complaint.bench.courtRoom})` : ''}` : ''}</Typography>
        </Paper>
      )}

      <PartyResponsePanel complaintId={complaint.id} user={user} complaintStatus={complaint.status} onChanged={load} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>The complaint</Typography>
            <Typography variant="caption" color="text.secondary">Filed by</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{complaint.consumer?.name}</Typography>
            <Typography variant="caption" color="text.secondary">Against</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{complaint.oppositePartyName} (seller: {complaint.sellerName})</Typography>
            <Typography variant="caption" color="text.secondary">Amount claimed</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>₹{Number(complaint.complaintAmount).toLocaleString('en-IN')}</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">What the consumer says happened</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{complaint.description}</Typography>
            {complaint.synopsisText && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">Synopsis</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{complaint.synopsisText}</Typography>
              </>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Documents filed by the consumer</Typography>
            {(complaint.evidence || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No documents.</Typography>
            ) : (
              <Stack gap={0.5}>
                {complaint.evidence.map((ev) => (
                  <Button key={ev.id} size="small" sx={{ justifyContent: 'flex-start' }} startIcon={<Download size={14} />} href={fileUrl(ev.filePath)} target="_blank" rel="noopener noreferrer">{ev.fileName}</Button>
                ))}
              </Stack>
            )}
          </Paper>

          {complaint.judgment && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Verdict</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1.5 }}>{complaint.judgment.verdict}</Typography>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />} href={fileUrl(complaint.judgment.filePath)} target="_blank" rel="noopener noreferrer">Download judgment</Button>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Case progress</Typography>
            <ComplaintTimeline entries={timeline} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
