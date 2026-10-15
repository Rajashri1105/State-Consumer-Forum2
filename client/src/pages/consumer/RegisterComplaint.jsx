import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box, Paper, Typography, Grid, TextField, MenuItem,
  Button, Stack, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, InputAdornment, Chip, IconButton, List, ListItem, ListItemIcon, ListItemText,
  RadioGroup, FormControlLabel, Radio, FormControl, FormLabel,
} from '@mui/material';
import { toast } from 'react-toastify';
import { AlertTriangle, Plus, Trash2, Sparkles, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { complaintSchema } from '../../utils/validationSchemas';
import { complaintService } from '../../services/complaintService';
import { categoryService } from '../../services/judgmentAndNotificationService';
import { useAuth } from '../../hooks/useAuth';
import { tokens } from '../../theme/theme';
import DocketTag from '../../components/common/DocketTag';
import FileDropzone from '../../components/common/FileDropzone';

const STATE_MIN_EXCLUSIVE = 5000000;  // ₹50,00,000
const STATE_MAX_INCLUSIVE = 20000000; // ₹2,00,00,000

export default function RegisterComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, duplicates: [], pendingValues: null });
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [districtOrderFiles, setDistrictOrderFiles] = useState([]);

  // Additional opposite parties
  const [additionalParties, setAdditionalParties] = useState([]);

  // --- Feature 2: AI-Assisted Complaint Drafting ---
  const [synopsisText, setSynopsisText] = useState('');
  const [synopsisSource, setSynopsisSource] = useState(null);
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false);
  const [synopsisManualConfirm, setSynopsisManualConfirm] = useState(false);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(complaintSchema),
    defaultValues: {
      caseType: 'NEW_COMPLAINT',
      categoryId: '', sellerName: '', oppositePartyName: '', oppositePartyAddress: '', oppositePartyEmail: '', oppositePartyPhone: '',
      product: '', service: '', purchaseDate: '', invoiceNumber: '', complaintAmount: '', description: '',
      districtCaseNumber: '', districtCommissionName: '', districtOrderDate: '', appealGrounds: '',
    },
  });

  const caseType = useWatch({ control, name: 'caseType' });
  const complaintAmount = useWatch({ control, name: 'complaintAmount' });
  const oppositePartyName = useWatch({ control, name: 'oppositePartyName' });
  const description = useWatch({ control, name: 'description' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const sellerName = useWatch({ control, name: 'sellerName' });

  const isAppeal = caseType === 'APPEAL';
  const amountNum = Number(complaintAmount) || 0;

  // Fee and jurisdiction preview logic
  let feeText = '₹0';
  let rangeStatus = { valid: true, message: '' };

  if (isAppeal) {
    feeText = '₹0 (No court fee for appeals)';
    if (complaintAmount !== '' && amountNum <= 0) {
      rangeStatus = { valid: false, message: 'Amount in dispute must be greater than zero.' };
    }
  } else {
    if (complaintAmount !== '') {
      if (amountNum <= STATE_MIN_EXCLUSIVE) {
        rangeStatus = { valid: false, message: 'Claims up to ₹50,00,000 are filed with the District Commission, not the State Commission.' };
        feeText = 'N/A';
      } else if (amountNum > STATE_MAX_INCLUSIVE) {
        rangeStatus = { valid: false, message: 'Claims above ₹2,00,00,000 are filed with the National Commission.' };
        feeText = 'N/A';
      } else if (amountNum <= 10000000) {
        feeText = '₹2,000';
      } else {
        feeText = '₹2,500';
      }
    } else {
      feeText = '₹2,000 (≤ ₹1 Cr) or ₹2,500 (> ₹1 Cr)';
    }
  }

  // Live checklist items
  const checklist = [
    { key: 'claimAmount', label: 'Claim / dispute amount is valid', passed: isAppeal ? amountNum > 0 : (amountNum > STATE_MIN_EXCLUSIVE && amountNum <= STATE_MAX_INCLUSIVE) },
    { key: 'oppositeParty', label: 'At least one opposite party specified', passed: Boolean(oppositePartyName && oppositePartyName.trim()) },
    ...(isAppeal ? [{ key: 'districtOrderProof', label: 'Certified copy of District Commission order uploaded', passed: districtOrderFiles.length > 0 }] : []),
    { key: 'evidence', label: isAppeal ? 'At least one order / proof document uploaded' : 'At least one evidence document uploaded', passed: isAppeal ? districtOrderFiles.length > 0 : evidenceFiles.length > 0 },
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
      const { data } = await complaintService.generateSynopsisDraft({
        categoryId, sellerName: isAppeal ? oppositePartyName : sellerName, oppositePartyName, complaintAmount, description,
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
      toast.error('Maximum 10 opposite parties total');
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
        sellerName: isAppeal ? (values.sellerName || values.oppositePartyName) : values.sellerName,
        purchaseDate: values.purchaseDate || undefined,
        districtOrderDate: values.districtOrderDate || undefined,
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

      // 1. Upload District Order File if appeal
      if (isAppeal && districtOrderFiles.length > 0) {
        const orderFormData = new FormData();
        orderFormData.append('type', 'DISTRICT_ORDER');
        districtOrderFiles.forEach((f) => orderFormData.append('files', f));
        try {
          await complaintService.uploadEvidence(complaint.id, orderFormData);
        } catch (orderErr) {
          toast.error('Complaint created, but uploading District Order document failed. Please re-upload on the case page.');
        }
      }

      // 2. Upload General Evidence Files if any
      if (evidenceFiles.length > 0) {
        const formData = new FormData();
        formData.append('type', 'OTHER');
        evidenceFiles.forEach((f) => formData.append('files', f));
        try {
          await complaintService.uploadEvidence(complaint.id, formData);
        } catch (evidenceErr) {
          toast.error('Complaint created, but evidence upload failed. Please add it on the case page.');
        }
      }

      toast.success(`${isAppeal ? 'Appeal' : 'Complaint'} ${complaint.complaintNumber} submitted successfully`);
      navigate(`/consumer/complaints/${complaint.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit filing');
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
      <Typography variant="h5" fontWeight={700} gutterBottom>State Consumer Commission Portal</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        File a new consumer complaint or an appeal against a District Commission order.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Filing Type Selection */}
          <FormControl component="fieldset" sx={{ mb: 3, w: '100%' }}>
            <FormLabel component="legend" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>Select Filing Type</FormLabel>
            <Controller
              name="caseType"
              control={control}
              render={({ field }) => (
                <RadioGroup row {...field} onChange={(e) => { field.onChange(e); setValue('caseType', e.target.value); }}>
                  <Paper variant="outlined" sx={{ p: 1.5, mr: 2, borderRadius: 1.5, borderColor: field.value === 'NEW_COMPLAINT' ? tokens.ashokaNavy : tokens.border }}>
                    <FormControlLabel value="NEW_COMPLAINT" control={<Radio />} label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>New Consumer Complaint</Typography>
                        <Typography variant="caption" color="text.secondary">Claims &gt; ₹50 Lakh up to ₹2 Crore</Typography>
                      </Box>
                    } />
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, borderColor: field.value === 'APPEAL' ? tokens.ashokaNavy : tokens.border }}>
                    <FormControlLabel value="APPEAL" control={<Radio />} label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>Appeal from District Order</Typography>
                        <Typography variant="caption" color="text.secondary">Appeal against a District Commission ruling (Fee: ₹0)</Typography>
                      </Box>
                    } />
                  </Paper>
                </RadioGroup>
              )}
            />
          </FormControl>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Consumer / Appellant Details</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Name" value={user?.name || ''} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={user?.email || ''} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Mobile" value={user?.phone || 'Not provided'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Address" value={user?.address || 'Not provided'} disabled /></Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Conditional Appeal Details */}
          {isAppeal && (
            <>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: tokens.ashokaNavy }}>
                District Commission Order Details (Appeal)
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Controller name="districtCaseNumber" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth label="District Case / Order Number" placeholder="e.g. CC/123/2024"
                      error={Boolean(errors.districtCaseNumber)} helperText={errors.districtCaseNumber?.message} />
                  )} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="districtCommissionName" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth label="District Commission Name" placeholder="e.g. District Commission, Pune"
                      error={Boolean(errors.districtCommissionName)} helperText={errors.districtCommissionName?.message} />
                  )} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="districtOrderDate" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth type="date" label="District Order Date" InputLabelProps={{ shrink: true }}
                      error={Boolean(errors.districtOrderDate)} helperText={errors.districtOrderDate?.message} />
                  )} />
                </Grid>
                <Grid item xs={12}>
                  <Controller name="appealGrounds" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth multiline rows={4} label="Grounds of Appeal"
                      placeholder="Specify why you are appealing against the District Commission order (min 50 characters)..."
                      error={Boolean(errors.appealGrounds)} helperText={errors.appealGrounds?.message} />
                  )} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Certified Copy of District Commission Order (Mandatory)
                  </Typography>
                  <FileDropzone label="Upload Certified District Order (PDF/JPG/PNG)" files={districtOrderFiles} onChange={setDistrictOrderFiles} />
                  {districtOrderFiles.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      * A certified copy of the District Commission order is mandatory for appeals.
                    </Typography>
                  )}
                </Grid>
              </Grid>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            {isAppeal ? 'Dispute & Case Information' : 'Complaint Information'}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="categoryId" control={control}
                render={({ field }) => (
                  <TextField {...field} select fullWidth label="Category" error={Boolean(errors.categoryId)} helperText={errors.categoryId?.message}>
                    <MenuItem value="" disabled>Select category</MenuItem>
                    {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="complaintAmount" control={control} render={({ field }) => (
                <TextField {...field} fullWidth type="number" label={isAppeal ? "Amount Awarded / in Dispute" : "Claim Amount"}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  error={Boolean(errors.complaintAmount)} helperText={errors.complaintAmount?.message} />
              )} />
            </Grid>

            <Grid item xs={12}>
              {!rangeStatus.valid ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {rangeStatus.message}
                </Alert>
              ) : (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Court Fee: <strong>{feeText}</strong> &nbsp;|&nbsp; Jurisdiction: <strong>State Commission</strong>
                  {!isAppeal && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      State Commission accepts complaints between ₹50,00,001 and ₹2,00,00,000. (Fees: ₹2,000 up to ₹1 Cr; ₹2,500 above ₹1 Cr).
                    </Typography>
                  )}
                </Alert>
              )}
            </Grid>

            {!isAppeal && (
              <>
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
              </>
            )}

            <Grid item xs={12}>
              <Controller name="description" control={control} render={({ field }) => (
                <TextField {...field} fullWidth multiline rows={5} label={isAppeal ? "Detailed Facts of Appeal" : "Detailed Description"}
                  placeholder={isAppeal ? "Summarize the dispute, District order findings, and reasons for appeal..." : "Describe what happened, what you expected, and what resolution you're seeking..."}
                  error={Boolean(errors.description)} helperText={errors.description?.message} />
              )} />
            </Grid>

            {/* Feature 2: AI-Assisted Synopsis */}
            <Grid item xs={12}>
              <Box sx={{ p: 2, border: `1px dashed ${tokens.border}`, borderRadius: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography variant="subtitle2" fontWeight={700}>Formal Filing Synopsis</Typography>
                  <Button
                    size="small" variant="outlined" startIcon={<Sparkles size={15} />}
                    onClick={handleGenerateSynopsis} disabled={generatingSynopsis}
                  >
                    {generatingSynopsis ? 'Generating…' : synopsisText ? 'Regenerate Synopsis' : 'Generate Synopsis'}
                  </Button>
                </Stack>
                {synopsisText ? (
                  <>
                    <TextField
                      fullWidth multiline minRows={5} sx={{ mt: 1.5 }}
                      value={synopsisText}
                      onChange={(e) => { setSynopsisText(e.target.value); setSynopsisManualConfirm(false); }}
                      helperText={synopsisSource === 'fallback' ? 'Rule-based draft — edit before filing.' : 'AI-generated draft — review and edit as needed.'}
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

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            Opposite Party / Respondent #1
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {isAppeal ? 'The successful party / respondent from the District Commission case.' : "The primary party you're filing this complaint against."}
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
                  helperText={errors.oppositePartyEmail?.message || 'The notice and case updates will be sent here.'} />
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
                <TextField fullWidth type="email" label="E-mail" value={party.email || ''} onChange={(e) => updatePartyRow(i, 'email', e.target.value)} />
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

          {/* Additional Evidence */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            {isAppeal ? 'Additional Evidence / Supporting Documents' : 'Evidence Documents'}
          </Typography>
          <FileDropzone label="Upload Evidence (Invoices, Receipts, Photos, etc.)" files={evidenceFiles} onChange={setEvidenceFiles} />

          <Divider sx={{ my: 3 }} />

          {/* Checklist */}
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
            <Button type="submit" variant="contained" size="large" disabled={submitting || !checklistComplete || !rangeStatus.valid}>
              {submitting ? 'Submitting…' : isAppeal ? 'Submit Appeal' : 'Submit Complaint'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialog.open} onClose={() => setDuplicateDialog({ open: false, duplicates: [], pendingValues: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color={tokens.warning} />
          Possible Duplicate Filing Found
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The system found existing filing(s) that closely match this one. Please review before continuing.
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
