import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Stack,
  Divider, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, IconButton,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Plus, Trash2, Tags, ListTree } from 'lucide-react';
import { categoryService } from '../../services/judgmentAndNotificationService';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

const PRIORITY_COLOR = { HIGH: tokens.error, MEDIUM: tokens.warning, LOW: tokens.success };

export default function AdminCategories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', defaultPriority: 'MEDIUM' });

  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ keyword: '', categoryId: '', priority: 'MEDIUM' });

  const load = () => {
    setLoading(true);
    Promise.all([categoryService.list(), categoryService.listPriorityRules()])
      .then(([catRes, ruleRes]) => {
        setCategories(catRes.data.data.categories || []);
        setRules(ruleRes.data.data.rules || []);
      })
      .catch(() => toast.error('Failed to load categories/rules'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) { toast.error('Category name is required'); return; }
    try {
      await categoryService.create(categoryForm);
      toast.success('Category created');
      setCategoryDialog(false);
      setCategoryForm({ name: '', description: '', defaultPriority: 'MEDIUM' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    }
  };

  const handleToggleCategory = async (cat) => {
    try {
      await categoryService.update(cat.id, { isActive: !cat.isActive });
      toast.success(`${cat.name} ${cat.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    }
  };

  const handleCreateRule = async () => {
    if (!ruleForm.keyword.trim()) { toast.error('Keyword is required'); return; }
    try {
      await categoryService.createPriorityRule({ ...ruleForm, categoryId: ruleForm.categoryId || undefined });
      toast.success('Priority rule created');
      setRuleDialog(false);
      setRuleForm({ keyword: '', categoryId: '', priority: 'MEDIUM' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create priority rule');
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await categoryService.updatePriorityRule(rule.id, { isActive: !rule.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update rule');
    }
  };

  const handleDeleteRule = async (rule) => {
    try {
      await categoryService.removePriorityRule(rule.id);
      toast.success('Priority rule deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete rule');
    }
  };

  if (loading) return <Loader label="Loading configuration…" />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Categories &amp; Priority Rules</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure complaint categories and the keyword rules that drive automatic priority assignment.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Tags size={18} color={tokens.ashokaNavy} />
                <Typography variant="subtitle1" fontWeight={700}>Complaint Categories</Typography>
              </Stack>
              <Button size="small" startIcon={<Plus size={15} />} onClick={() => setCategoryDialog(true)}>Add</Button>
            </Stack>
            <Stack divider={<Divider />} gap={0.5}>
              {categories.map((c) => (
                <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    <Chip size="small" label={`Default: ${c.defaultPriority}`} sx={{ backgroundColor: `${PRIORITY_COLOR[c.defaultPriority]}1A`, color: PRIORITY_COLOR[c.defaultPriority], fontWeight: 700, mt: 0.5 }} />
                  </Box>
                  <Switch checked={c.isActive} onChange={() => handleToggleCategory(c)} size="small" />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <ListTree size={18} color={tokens.docketBrass} />
                <Typography variant="subtitle1" fontWeight={700}>Priority Keyword Rules</Typography>
              </Stack>
              <Button size="small" startIcon={<Plus size={15} />} onClick={() => setRuleDialog(true)}>Add</Button>
            </Stack>
            <Stack divider={<Divider />} gap={0.5}>
              {rules.map((r) => (
                <Stack key={r.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>"{r.keyword}"</Typography>
                    <Chip size="small" label={r.priority} sx={{ backgroundColor: `${PRIORITY_COLOR[r.priority]}1A`, color: PRIORITY_COLOR[r.priority], fontWeight: 700, mt: 0.5 }} />
                  </Box>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Switch checked={r.isActive} onChange={() => handleToggleRule(r)} size="small" />
                    <IconButton size="small" onClick={() => handleDeleteRule(r)}><Trash2 size={15} color={tokens.error} /></IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* -------------------- Add category dialog -------------------- */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Complaint Category</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} sx={{ mt: 0.5 }}>
            <TextField fullWidth label="Category Name" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField fullWidth label="Description" value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} />
            <TextField fullWidth select label="Default Priority" value={categoryForm.defaultPriority} onChange={(e) => setCategoryForm((f) => ({ ...f, defaultPriority: e.target.value }))}>
              {['HIGH', 'MEDIUM', 'LOW'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCategoryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCategory}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* -------------------- Add priority rule dialog -------------------- */}
      <Dialog open={ruleDialog} onClose={() => setRuleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Priority Rule</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth label="Keyword" placeholder="e.g. senior citizen, food safety, warranty"
              value={ruleForm.keyword} onChange={(e) => setRuleForm((f) => ({ ...f, keyword: e.target.value }))}
            />
            <TextField fullWidth select label="Priority" value={ruleForm.priority} onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}>
              {['HIGH', 'MEDIUM', 'LOW'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="Associate with Category (optional)" value={ruleForm.categoryId} onChange={(e) => setRuleForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRuleDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRule}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
