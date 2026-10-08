import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Button, Divider, Chip, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import { MessageSquare, Clock, Handshake, Download, Check, X, Paperclip } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { partyService } from '../../services/partyService';
import { fileUrl } from '../../utils/fileUrl';
import { ReplyStatusChip } from './StatusChips';
import { tokens } from '../../theme/theme';

const OFFER_COLOR = { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'error', WITHDRAWN: 'default' };

/**
 * The opposite party's side of a case: reply status & deadline, replies, extension
 * requests and settlement offers. One component, used by every role:
 *   opposite party -> file reply / ask for time / offer settlement
 *   judge          -> grant or refuse an extension
 *   consumer       -> accept or reject a settlement offer
 *   clerks / registrar -> read-only
 */
export default function PartyResponsePanel({ complaintId, user, complaintStatus, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'reply' | 'extension' | 'settlement' | { type: 'decide', req }
  const [form, setForm] = useState({});
  const [files, setFiles] = useState([]);

  const load = useCallback(() => {
    partyService.responses(complaintId).then(({ data: res }) => setData(res.data)).catch(() => setData(null));
  }, [complaintId]);
  useEffect(load, [load]);

  if (!data || !data.noticeIssuedAt) return null; // nothing to show before the notice is served

  const isParty = user?.role === 'OPPOSITE_PARTY';
  const isConsumer = user?.role === 'CONSUMER';
  const canDecideExtension = ['JUDGE', 'REGISTRAR', 'ADMIN'].includes(user?.role);
  const open = data.caseOpen;
  const daysLeft = data.replyDueDate ? dayjs(data.replyDueDate).diff(dayjs(), 'day') : null;
  const extensionLeft = data.maxExtensionDays - data.extensionDaysGranted;
  const pendingExtension = data.extensions.find((e) => e.status === 'PENDING');
  const pendingOffer = data.offers.find((o) => o.status === 'PENDING');

  const close = () => { setDialog(null); setForm({}); setFiles([]); };
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      close();
      load();
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <MessageSquare size={18} color={tokens.ashokaNavy} />
          <Typography variant="subtitle1" fontWeight={700}>Opposite Party&apos;s Response</Typography>
          <ReplyStatusChip status={data.replyStatus} />
        </Stack>
        {data.replyDueDate && (
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Clock size={15} color={tokens.inkMuted} />
            <Typography variant="body2" color="text.secondary">
              Reply due {dayjs(data.replyDueDate).format('DD MMM YYYY')}
              {data.replyStatus === 'AWAITING_REPLY' && daysLeft !== null && (daysLeft >= 0 ? ` · ${daysLeft} day(s) left` : ' · overdue')}
              {data.extensionDaysGranted > 0 && ` · extended by ${data.extensionDaysGranted} day(s)`}
            </Typography>
          </Stack>
        )}
      </Stack>

      {data.replyStatus === 'EX_PARTE_ELIGIBLE' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {isParty
            ? 'You missed the reply deadline. You may still file a reply, but the bench is free to proceed without it.'
            : 'The reply deadline passed without a reply — the bench may proceed ex parte.'}
        </Alert>
      )}
      {!data.hasPortalAccount && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          The opposite party has no portal login (their e-mail belongs to another account), so they cannot reply online.
        </Alert>
      )}

      {/* ------- party actions ------- */}
      {isParty && open && (
        <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mb: 2 }}>
          <Button variant="contained" onClick={() => setDialog('reply')}>
            {data.replyStatus === 'REPLY_FILED' ? 'File Another Reply' : 'File Written Reply'}
          </Button>
          {data.replyStatus === 'AWAITING_REPLY' && extensionLeft > 0 && !pendingExtension && (
            <Button variant="outlined" onClick={() => { setForm({ daysRequested: Math.min(7, extensionLeft) }); setDialog('extension'); }}>Ask for More Time</Button>
          )}
          {!pendingOffer && <Button variant="outlined" startIcon={<Handshake size={16} />} onClick={() => setDialog('settlement')}>Offer Settlement</Button>}
        </Stack>
      )}

      {/* ------- extension requests ------- */}
      {data.extensions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">Extension requests</Typography>
          <Stack divider={<Divider />} gap={1} sx={{ mt: 0.5 }}>
            {data.extensions.map((e) => (
              <Box key={e.id}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Chip size="small" label={e.status} color={e.status === 'APPROVED' ? 'success' : e.status === 'REJECTED' ? 'error' : 'warning'} />
                  <Typography variant="body2" fontWeight={600}>{e.daysRequested} day(s) requested{e.daysGranted ? ` · ${e.daysGranted} granted` : ''}</Typography>
                  <Typography variant="caption" color="text.secondary">{dayjs(e.createdAt).format('DD MMM YYYY')}</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.25 }}>{e.reason}</Typography>
                {e.decisionNote && <Typography variant="caption" color="text.secondary">Judge&apos;s note: {e.decisionNote}</Typography>}
                {e.status === 'PENDING' && canDecideExtension && open && (
                  <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="contained" color="success" startIcon={<Check size={14} />}
                      onClick={() => { setForm({ days: Math.min(e.daysRequested, extensionLeft), note: '' }); setDialog({ type: 'decide', req: e, approve: true }); }}>Grant</Button>
                    <Button size="small" color="error" startIcon={<X size={14} />}
                      onClick={() => { setForm({ note: '' }); setDialog({ type: 'decide', req: e, approve: false }); }}>Refuse</Button>
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* ------- replies ------- */}
      <Typography variant="caption" color="text.secondary">Written replies</Typography>
      {data.replies.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>No reply has been filed yet.</Typography>
      ) : (
        <Stack divider={<Divider />} gap={1.5} sx={{ mt: 0.5, mb: 2 }}>
          {data.replies.map((r) => (
            <Box key={r.id}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">{dayjs(r.createdAt).format('DD MMM YYYY, h:mm A')}</Typography>
                {r.isLate && <Chip size="small" color="error" variant="outlined" label="Filed late" />}
              </Stack>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{r.text}</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
                {(r.documents || []).map((d, i) => (
                  <Button key={i} size="small" startIcon={<Download size={13} />} href={fileUrl(d.filePath)} target="_blank" rel="noopener noreferrer">{d.fileName}</Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* ------- settlement offers ------- */}
      {data.offers.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">Settlement offers</Typography>
          <Stack divider={<Divider />} gap={1.25} sx={{ mt: 0.5 }}>
            {data.offers.map((o) => (
              <Box key={o.id}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Chip size="small" label={o.status} color={OFFER_COLOR[o.status]} />
                  {o.amount !== null && <Typography variant="body2" fontWeight={700}>₹{Number(o.amount).toLocaleString('en-IN')}</Typography>}
                  <Typography variant="caption" color="text.secondary">{dayjs(o.createdAt).format('DD MMM YYYY')}</Typography>
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{o.terms}</Typography>
                {o.responseNote && <Typography variant="caption" color="text.secondary">Consumer&apos;s note: {o.responseNote}</Typography>}
                {o.status === 'PENDING' && open && isConsumer && (
                  <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="contained" color="success" onClick={() => { setForm({ note: '' }); setDialog({ type: 'respond', offer: o, accept: true }); }}>Accept &amp; Close Case</Button>
                    <Button size="small" color="error" onClick={() => { setForm({ note: '' }); setDialog({ type: 'respond', offer: o, accept: false }); }}>Reject</Button>
                  </Stack>
                )}
                {o.status === 'PENDING' && isParty && open && (
                  <Button size="small" sx={{ mt: 0.5 }} onClick={() => run(() => partyService.withdrawSettlement(o.id), 'Offer withdrawn')}>Withdraw offer</Button>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* ===================== dialogs ===================== */}
      <Dialog open={dialog === 'reply'} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>File Written Reply</DialogTitle>
        <DialogContent dividers>
          <TextField autoFocus fullWidth multiline rows={6} label="Your reply" value={form.text || ''} onChange={(e) => setForm({ ...form, text: e.target.value })}
            helperText="Answer each allegation. Attach bills, correspondence or other documents that support you." />
          <Button component="label" size="small" startIcon={<Paperclip size={14} />} sx={{ mt: 1.5 }}>
            Attach documents (up to 5)
            <input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
          </Button>
          {files.map((f) => <Typography key={f.name} variant="caption" sx={{ display: 'block' }}>{f.name}</Typography>)}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => run(() => partyService.fileReply(complaintId, form.text || '', files), 'Reply filed')}>{busy ? 'Filing…' : 'File Reply'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'extension'} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>Ask for More Time</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary">The law allows at most {data.maxExtensionDays} extra days in total ({extensionLeft} left). The judge decides.</Typography>
          <TextField select fullWidth sx={{ mt: 1.5 }} label="Extra days" value={form.daysRequested || ''} onChange={(e) => setForm({ ...form, daysRequested: e.target.value })}>
            {Array.from({ length: extensionLeft }, (_, i) => i + 1).map((d) => <MenuItem key={d} value={d}>{d} day(s)</MenuItem>)}
          </TextField>
          <TextField fullWidth multiline rows={3} sx={{ mt: 2 }} label="Why do you need more time?" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => run(() => partyService.requestExtension(complaintId, { daysRequested: form.daysRequested, reason: form.reason }), 'Request sent to the judge')}>Send Request</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'settlement'} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>Offer a Settlement</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary">If the consumer accepts, the case closes as settled and any scheduled hearings are cancelled.</Typography>
          <TextField fullWidth type="number" sx={{ mt: 1.5 }} label="Amount offered (₹, optional)" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField fullWidth multiline rows={4} sx={{ mt: 2 }} label="Terms of the offer" value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })}
            placeholder="e.g. Full refund of the purchase price plus ₹2,000 compensation within 15 days." />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => run(() => partyService.offerSettlement(complaintId, { amount: form.amount, terms: form.terms }), 'Offer sent to the consumer')}>Send Offer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog?.type === 'decide'} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog?.approve ? 'Grant Extension' : 'Refuse Extension'}</DialogTitle>
        <DialogContent dividers>
          {dialog?.approve && (
            <TextField select fullWidth sx={{ mb: 2 }} label="Days to grant" value={form.days || ''} onChange={(e) => setForm({ ...form, days: e.target.value })}>
              {Array.from({ length: Math.min(dialog.req.daysRequested, extensionLeft) }, (_, i) => i + 1).map((d) => <MenuItem key={d} value={d}>{d} day(s)</MenuItem>)}
            </TextField>
          )}
          <TextField fullWidth multiline rows={2} label="Note (optional)" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" color={dialog?.approve ? 'success' : 'error'} disabled={busy}
            onClick={() => run(() => partyService.decideExtension(dialog.req.id, { approve: dialog.approve, days: form.days, note: form.note }), dialog.approve ? 'Extension granted' : 'Extension refused')}>
            {dialog?.approve ? 'Grant' : 'Refuse'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog?.type === 'respond'} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog?.accept ? 'Accept this settlement?' : 'Reject this settlement?'}</DialogTitle>
        <DialogContent dividers>
          {dialog?.accept && <Alert severity="warning" sx={{ mb: 2 }}>Accepting closes the case permanently as settled. You cannot reopen it.</Alert>}
          <TextField fullWidth multiline rows={2} label="Note (optional)" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" color={dialog?.accept ? 'success' : 'error'} disabled={busy}
            onClick={() => run(() => partyService.respondToSettlement(dialog.offer.id, { accept: dialog.accept, note: form.note }), dialog.accept ? 'Settlement accepted — case closed' : 'Offer rejected')}>
            {dialog?.accept ? 'Accept & Close Case' : 'Reject Offer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
