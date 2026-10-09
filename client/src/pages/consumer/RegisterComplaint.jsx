import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box, Paper, Typography, Grid, TextField, MenuItem,
  Button, Stack, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, InputAdornment, Chip, IconButton, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { toast } from 'react-toastify';
import { AlertTriangle, Plus, Trash2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { complaintSchema } from '../../utils/validationSchemas';
import { complaintService } from '../../services/complaintService';
import { categoryService } from '../../services/judgmentAndNotificationService';
import { useAuth } from '../../hooks/useAuth';
import { tokens } from '../../theme/theme';
import DocketTag from '../../components/common/DocketTag';
import FileDropzone from '../../components/common/FileDropzone';

const COURT_FEE_RATE = 0.05;

// --------------------------------------------------------------------------
// Feature 1: Jurisdiction Determination Engine — client-side mirror of the
// server's rule-based thresholds, so the result appears the instant the
// consumer types the claim amount (same event as the court-fee preview).
// The server independently computes and stores the authoritative value.
// --------------------------------------------------------------------------
const DISTRICT_MAX = 5000000; // ₹50,00,000
const STATE_MAX = 20000000; // ₹2,00,00,000
function jurisdictionFor(amount) {
  const n = Number(amount) || 0;
  if (n <= DISTRICT_MAX) return 'District Commission';
  if (n <= STATE_MAX) return 'State Commission';
  return 'National Commission';
}

export default function RegisterComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, duplicates: [], pendingValues: null });
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  // Additional opposite parties beyond the primary one (which lives in the
  // main form via oppositePartyName/oppositePartyAddress).
  const [additionalParties, setAdditionalParties] = useState([]);

  // --- Feature 2: AI-Assisted Complaint Drafting ---
  const [synopsisText, setSynopsisText] = useState('');
  const [synopsisSource, setSynopsisSource] = useState(null); // 'openai' | 'gemini' | 'fallback' | 'manual'
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false);
  const [synopsisManualConfirm, setSynopsisManualConfirm] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(complaintSchema),
    defaultValues: {
      categoryId: '', sellerName: '', oppositePartyName: '', oppositePartyAddress: '', oppositePartyEmail: '', oppositePartyPhone: '',
      product: '', service: '', purchaseDate: '', invoiceNumber: '', complaintAmount: '', description: '',
    },
  });

  const complaintAmount = useWatch({ control, name: 'complaintAmount' });
  const oppositePartyName = useWatch({ control, name: 'oppositePartyName' });
  const description = useWatch({ control, name: 'description' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const sellerName = useWatch({ control, name: 'sellerName' });

  const courtFeePreview = complaintAmount && !isNaN(complaintAmount)
    ? (Number(complaintAmount) * COURT_FEE_RATE).toFixed(2)
    : '0.00';
  const jurisdictionPreview = jurisdictionFor(complaintAmount);

  // --- Feature 3: Document Completeness Checker (client-side live mirror
  // of server/services/completenessChecker.js) ---
  const checklist = [
    { key: 'claimAmount', label: 'Claim amount is greater than zero', passed: Number(complaintAmount) > 0 },
    { key: 'oppositeParty', label: 'At least one opposite party specified', passed: Boolean(oppositePartyName && oppositePartyName.trim()) },
    { key: 'evidence', label: 'At least one evidence document uploaded', passed: evidenceFiles.length > 0 },
    { key: 'synopsis', label: 'Synopsis generated or manually filled', passed: Boolean(synopsisText.trim() || synopsisManualConfirm) },
  ];
  const checklistComplete = checklist.every((c) => c.passed);

  const handleGenerateSynopsis = async () => {
    if (!description || description.trim().length < 20) {
      toast.error('Please write a detailed description (min 20 characters) before generating a synopsis');
      return;
    }
    setGeneratingSynopsis(true);
    try {
      const category = categories.find((c) => c.id === categoryId);
      const { data } = await complaintService.generateSynopsisDraft({
        categoryId, sellerName, oppositePartyName, complaintAmount, description,
      });
      setSynopsisText(data.data.synopsisText);
      setSynopsisSource(data.data.source);
      setSynopsisManualConfirm(false);
      toast.success(data.data.source === 'fallback' ? 'Draft generated (rule-based — no AI key configured)' : 'AI-generated draft ready — review and edit as needed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate synopsis');
    } finally {
      setGeneratingSynopsis(false);
    }
  };

  useEffect(() => {
    categoryService.list()
      .then(({ data }) => setCategories((data.data.categories || []).filter((c) => c.isActive)))
      .catch(() => toast.error('Could not load complaint categories. Please refresh the page.'));
  }, []);

  const addPartyRow = () => {
    if (additionalParties.length >= 9) {
      toast.error('Maximum 10 opposite parties total (1 primary + 9 additional)');
      return;
    }
    setAdditionalParties((prev) => [...prev, { name: '', address: '', email: '' }]);
  };

  const updatePartyRow = (index, field, value) => {
    setAdditionalParties((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const removePartyRow = (index) => {
    setAdditionalParties((prev) => prev.filter((_, i) => i !== index));
  };

  const submitComplaint = async (values, overrideDuplicateWarning = false) => {
    if (!checklistComplete) {
      toast.error('Please complete every item in the checklist before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await complaintService.create({
        ...values,
        purchaseDate: values.purchaseDate || undefined,
        overrideDuplicateWarning,
        additionalOppositeParties: additionalParties.filter((p) => p.name.trim()),
        synopsisText: synopsisManualConfirm ? undefined : synopsisText,
        synopsisManualConfirm,
      });

      if (data.data.possibleDuplicateFound) {
        setDuplicateDialog({ open: true, duplicates: data.data.duplicates, pendingValues: values });
        return;
      }

      const complaint = data.data.complaint;

      // Upload the staged evidence files right after creation — the
      // Document Completeness Checker requires evidence to exist before
      // this complaint can pass clerk verification, so we don't leave a
      // gap between "complaint created" and "evidence attached".
      if (evidenceFiles.length > 0) {
        const formData = new FormData();
        formData.append('type', 'OTHER');
        evidenceFiles.forEach((f) => formData.append('files', f));
        try {
          await complaintService.uploadEvidence(complaint.id, formData);
        } catch (evidenceErr) {
          toast.error('Complaint was submitted, but evidence upload failed — please add it from the complaint detail page.');
          navigate(`/consumer/complaints/${complaint.id}`);
          return;
        }
      }

      toast.success(`Complaint ${complaint.complaintNumber} submitted successfully`);
      navigate(`/consumer/complaints/${complaint.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (values) => submitComplaint(values, false);

  const handleFileAnyway = () => {
    const values = duplicateDialog.pendingValues;
    setDuplicateDialog({ open: false, duplicates: [], pendingValues: null });
    submitComplaint(values, true);
  };

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Register a Complaint</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Provide details of your dispute below. A unique complaint number will be generated once submitted.
      </Typography>

      {(
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Consumer Information</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Name" value={user?.name || ''} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={user?.email || ''} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Mobile" value={user?.phone || 'Not provided'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Address" value={user?.address || 'Not provided'} disabled /></Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary">
            To update these details, visit My Profile before filing your complaint.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Complaint Information</Typography>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="categoryId" control={control}
                  render={({ field }) => (
                    <TextField {...field} select fullWidth label="Complaint Category" error={Boolean(errors.categoryId)} helperText={errors.categoryId?.message}>
                      <MenuItem value="" disabled>Select a category</MenuItem>
                      {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="complaintAmount" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth type="number" label="Claim Amount"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    error={Boolean(errors.complaintAmount)} helperText={errors.complaintAmount?.message} />
                )} />
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Court Fee (5% of claim): <strong>₹{courtFeePreview}</strong> &nbsp;|&nbsp; Jurisdiction: <strong>{jurisdictionPreview}</strong>
                </Alert>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller name="product" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Product (if applicable)" />
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="service" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Service (if applicable)" />
                )} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller name="sellerName" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Seller / Trader Name" error={Boolean(errors.sellerName)} helperText={errors.sellerName?.message} />
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="invoiceNumber" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Invoice Number" />
                )} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller name="purchaseDate" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth type="date" label="Purchase Date" InputLabelProps={{ shrink: true }} />
                )} />
              </Grid>

              <Grid item xs={12}>
                <Controller name="description" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth multiline rows={5} label="Detailed Description"
                    placeholder="Describe what happened, what you expected, and what resolution you're seeking..."
                    error={Boolean(errors.description)} helperText={errors.description?.message} />
                )} />
              </Grid>

              {/* -------------------- Feature 2: AI-Assisted Complaint Drafting -------------------- */}
              <Grid item xs={12}>
                <Box sx={{ p: 2, border: `1px dashed ${tokens.border}`, borderRadius: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                    <Typography variant="subtitle2" fontWeight={700}>Formal Complaint Synopsis</Typography>
                    <Button
                      size="small" variant="outlined" startIcon={<Sparkles size={15} />}
                      onClick={handleGenerateSynopsis} disabled={generatingSynopsis}
                    >
                      {generatingSynopsis ? 'Generating…' : synopsisText ? 'Regenerate Formal Synopsis' : 'Generate Formal Synopsis'}
                    </Button>
                  </Stack>
                  {synopsisText ? (
                    <>
                      <TextField
                        fullWidth multiline minRows={6} sx={{ mt: 1.5 }}
                        value={synopsisText}
                        onChange={(e) => { setSynopsisText(e.target.value); setSynopsisManualConfirm(false); }}
                        helperText={synopsisSource === 'fallback'
                          ? 'Rule-based draft (no AI key configured) — edit as needed before filing.'
                          : synopsisSource
                            ? `AI-generated draft (${synopsisSource}) — review and edit before filing.`
                            : undefined}
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button size="small" onClick={() => setSynopsisText('')}>Clear</Button>
                      </Stack>
                    </>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Not generated yet. You can also
                      </Typography>
                      <Button size="small" onClick={() => setSynopsisManualConfirm(true)} disabled={synopsisManualConfirm}>
                        {synopsisManualConfirm ? 'Marked as manually filled ✓' : 'mark this as manually filled'}
                      </Button>
                    </Stack>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Opposite Party (Respondent) #1</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              The primary party you're filing this complaint against.
            </Typography>
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller name="oppositePartyName" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Opposite Party Name" error={Boolean(errors.oppositePartyName)} helperText={errors.oppositePartyName?.message} />
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="oppositePartyAddress" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Opposite Party Address" />
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="oppositePartyEmail" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth type="email" label="Opposite Party E-mail"
                    error={Boolean(errors.oppositePartyEmail)}
                    helperText={errors.oppositePartyEmail?.message || 'Strongly recommended — the notice and every case update are e-mailed here, and they get a portal login to reply.'} />
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="oppositePartyPhone" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Opposite Party Phone (optional)" error={Boolean(errors.oppositePartyPhone)} helperText={errors.oppositePartyPhone?.message} />
                )} />
              </Grid>
            </Grid>

            {additionalParties.map((party, i) => (
              <Grid container spacing={2} key={i} sx={{ mb: 1, alignItems: 'flex-start' }}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Opposite Party #{i + 2}</Typography>
                </Grid>
                <Grid item xs={12} sm={3.5}>
                  <TextField fullWidth label="Name" value={party.name} onChange={(e) => updatePartyRow(i, 'name', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={3.5}>
                  <TextField fullWidth label="Address" value={party.address} onChange={(e) => updatePartyRow(i, 'address', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={3.5}>
                  <TextField fullWidth type="email" label="E-mail (gets updates)" value={party.email || ''} onChange={(e) => updatePartyRow(i, 'email', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton size="small" onClick={() => removePartyRow(i)}><Trash2 size={16} color={tokens.error} /></IconButton>
                </Grid>
              </Grid>
            ))}

            <Button size="small" startIcon={<Plus size={15} />} onClick={addPartyRow} sx={{ mt: 1 }}>
              Add Another Opposite Party
            </Button>

            <Divider sx={{ my: 3 }} />

            {/* -------------------- Evidence upload (now part of the same step) -------------------- */}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Evidence</Typography>
            <FileDropzone label="Supporting Documents" files={evidenceFiles} onChange={setEvidenceFiles} />

            <Divider sx={{ my: 3 }} />

            {/* -------------------- Feature 3: Document Completeness Checker -------------------- */}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Before You Submit</Typography>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <List dense disablePadding>
                {checklist.map((item) => (
                  <ListItem key={item.key} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {item.passed
                        ? <CheckCircle2 size={18} color={tokens.success} />
                        : <XCircle size={18} color={tokens.error} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ variant: 'body2', color: item.passed ? 'text.primary' : 'text.secondary' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" size="large" disabled={submitting || !checklistComplete}>
                {submitting ? 'Submitting…' : 'Submit Complaint'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      )}

      {/* -------------------- Duplicate warning dialog -------------------- */}
      <Dialog open={duplicateDialog.open} onClose={() => setDuplicateDialog({ open: false, duplicates: [], pendingValues: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color={tokens.warning} />
          Possible Duplicate Complaint Found
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The system found existing complaint(s) that closely match this one. Please review before continuing.
          </Typography>
          <Stack gap={1.5}>
            {duplicateDialog.duplicates.map((d) => (
              <Box key={d.complaint.id} sx={{ p: 1.5, border: `1px solid ${tokens.border}`, borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <DocketTag>{d.complaint.complaintNumber}</DocketTag>
                  <Chip size="small" label={`${Math.round(d.similarityScore * 100)}% similar`} sx={{ backgroundColor: `${tokens.warning}1A`, color: tokens.warning, fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2">vs. {d.complaint.oppositePartyName}</Typography>
                <Typography variant="caption" color="text.secondary">{d.reasons.join(' · ')}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDuplicateDialog({ open: false, duplicates: [], pendingValues: null })}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleFileAnyway} disabled={submitting}>
            File Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
