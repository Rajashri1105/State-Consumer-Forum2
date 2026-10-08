import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Stack, Divider,
  IconButton, FormGroup, FormControlLabel, Checkbox, Chip, MenuItem,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Trash2, CalendarPlus, Settings2, CalendarDays, Clock, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { settingsService } from '../../services/adminService';
import Loader from '../../components/common/Loader';
import { tokens } from '../../theme/theme';

const WEEKDAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
];

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', description: '' });
  const [newTimeSlot, setNewTimeSlot] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([settingsService.getForumSettings(), settingsService.listHolidays()])
      .then(([sRes, hRes]) => {
        setSettings(sRes.data.data.settings);
        setHolidays(hRes.data.data.holidays || []);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleWorkingDay = (day) => {
    setSettings((s) => {
      const days = s.workingDays.includes(day) ? s.workingDays.filter((d) => d !== day) : [...s.workingDays, day].sort();
      return { ...s, workingDays: days };
    });
  };

  const addTimeSlot = () => {
    const slot = newTimeSlot.trim();
    if (!slot) return;
    if (settings.hearingTimeSlots.includes(slot)) {
      toast.error('That time slot is already in the list');
      return;
    }
    setSettings((s) => ({ ...s, hearingTimeSlots: [...s.hearingTimeSlots, slot] }));
    setNewTimeSlot('');
  };

  const removeTimeSlot = (slot) => {
    setSettings((s) => ({ ...s, hearingTimeSlots: s.hearingTimeSlots.filter((t) => t !== slot) }));
  };

  // Regenerates the standard court schedule: 10:30 AM-4:30 PM, 15-minute
  // sessions, with the 1:30-2:30 PM lunch break excluded.
  const resetToStandardSchedule = () => {
    const slots = [
      '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
      '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM', '1:00 PM', '1:15 PM',
      '2:30 PM', '2:45 PM', '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM', '4:00 PM', '4:15 PM',
    ];
    setSettings((s) => ({
      ...s,
      hearingTimeSlots: slots,
      sessionDurationMinutes: 15,
      courtStartTime: '10:30 AM',
      courtEndTime: '04:30 PM',
      lunchStartTime: '01:30 PM',
      lunchEndTime: '02:30 PM',
      maxHearingsPerDayDefault: slots.length,
    }));
    toast.success('Reset to the standard court schedule — click Save to apply');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsService.updateForumSettings(settings);
      toast.success('Forum settings updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.description.trim()) {
      toast.error('Date and description are required');
      return;
    }
    try {
      await settingsService.createHoliday(newHoliday);
      toast.success('Holiday added');
      setNewHoliday({ date: '', description: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await settingsService.deleteHoliday(id);
      toast.success('Holiday removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove holiday');
    }
  };

  if (loading || !settings) return <Loader label="Loading settings…" />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>System Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Forum details, working days, and the holiday calendar used by the hearing scheduling engine.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <Settings2 size={18} color={tokens.ashokaNavy} />
              <Typography variant="subtitle1" fontWeight={700}>Forum Details</Typography>
            </Stack>
            <Stack gap={2}>
              <TextField fullWidth label="Forum Name" value={settings.forumName} onChange={(e) => setSettings((s) => ({ ...s, forumName: e.target.value }))} />
              <TextField fullWidth label="Address" value={settings.address || ''} onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))} />
              <TextField fullWidth label="Contact Email" value={settings.contactEmail || ''} onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))} />
              <TextField fullWidth label="Contact Phone" value={settings.contactPhone || ''} onChange={(e) => setSettings((s) => ({ ...s, contactPhone: e.target.value }))} />
              <TextField
                fullWidth type="number" label="Default Max Hearings / Day"
                value={settings.maxHearingsPerDayDefault}
                onChange={(e) => setSettings((s) => ({ ...s, maxHearingsPerDayDefault: Number(e.target.value) }))}
              />
              <TextField
                fullWidth select label="Bench Allotment Mode"
                value={settings.allotmentMode || 'AUTO'}
                onChange={(e) => setSettings((s) => ({ ...s, allotmentMode: e.target.value }))}
                helperText="Automatic: an accepted complaint goes straight to the least-loaded bench. Manual: it waits in the Registrar's allotment queue."
              >
                <MenuItem value="AUTO">Automatic (least-loaded bench)</MenuItem>
                <MenuItem value="MANUAL">Manual (Registrar allots)</MenuItem>
              </TextField>
              <TextField
                fullWidth type="number" label="Intake Claim Timeout (hours)"
                value={settings.claimTimeoutHours ?? 4}
                onChange={(e) => setSettings((s) => ({ ...s, claimTimeoutHours: Number(e.target.value) }))}
                helperText="A complaint a scrutiny clerk claims but doesn't act on returns to the shared queue after this long."
              />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Working Days</Typography>
                <FormGroup row>
                  {WEEKDAYS.map((d) => (
                    <FormControlLabel
                      key={d.value}
                      control={<Checkbox checked={settings.workingDays.includes(d.value)} onChange={() => toggleWorkingDay(d.value)} size="small" />}
                      label={d.label}
                    />
                  ))}
                </FormGroup>
              </Box>
              <Button variant="contained" onClick={handleSaveSettings} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save Settings'}
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <CalendarDays size={18} color={tokens.docketBrass} />
              <Typography variant="subtitle1" fontWeight={700}>Holiday Calendar</Typography>
            </Stack>

            <Stack direction="row" gap={1.5} sx={{ mb: 2 }}>
              <TextField
                type="date" size="small" label="Date" InputLabelProps={{ shrink: true }}
                value={newHoliday.date} onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
              />
              <TextField
                size="small" label="Description" fullWidth
                value={newHoliday.description} onChange={(e) => setNewHoliday((h) => ({ ...h, description: e.target.value }))}
              />
              <Button variant="contained" onClick={handleAddHoliday} startIcon={<CalendarPlus size={16} />} sx={{ flexShrink: 0 }}>
                Add
              </Button>
            </Stack>

            <Stack divider={<Divider />} sx={{ maxHeight: 360, overflowY: 'auto' }}>
              {holidays.map((h) => (
                <Stack key={h.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{h.description}</Typography>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">{dayjs(h.date).format('DD MMM YYYY')}</Typography>
                      {h.isRecurringAnnual && <Chip size="small" label="Annual" sx={{ height: 18, fontSize: '0.65rem' }} />}
                    </Stack>
                  </Box>
                  <IconButton size="small" onClick={() => handleDeleteHoliday(h.id)}>
                    <Trash2 size={15} color={tokens.error} />
                  </IconButton>
                </Stack>
              ))}
              {holidays.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No holidays configured yet.</Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <Clock size={18} color={tokens.ashokaNavy} />
              <Typography variant="subtitle1" fontWeight={700}>Hearing Time Slots</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These slots are offered by the scheduling engine and shown in the clerk's scheduling
              dialogs. A day can host at most this many hearings, regardless of a judge's individual limit.
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Court Start" value={settings.courtStartTime || ''} onChange={(e) => setSettings((s) => ({ ...s, courtStartTime: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Court End" value={settings.courtEndTime || ''} onChange={(e) => setSettings((s) => ({ ...s, courtEndTime: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Lunch Start" value={settings.lunchStartTime || ''} onChange={(e) => setSettings((s) => ({ ...s, lunchStartTime: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Lunch End" value={settings.lunchEndTime || ''} onChange={(e) => setSettings((s) => ({ ...s, lunchEndTime: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" type="number" label="Session Length (minutes)"
                  value={settings.sessionDurationMinutes || 15}
                  onChange={(e) => setSettings((s) => ({ ...s, sessionDurationMinutes: Number(e.target.value) }))}
                />
              </Grid>
            </Grid>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              These fields are informational/reference values — the actual bookable slots are the list below.
              Use "Reset to Standard Schedule" to regenerate them from the fields above (10:30 AM-4:30 PM, 15-min
              sessions, lunch excluded).
            </Typography>
            <Button size="small" variant="outlined" onClick={resetToStandardSchedule} sx={{ mb: 2 }}>
              Reset to Standard Schedule
            </Button>

            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {(settings.hearingTimeSlots || []).map((slot) => (
                <Chip key={slot} label={slot} onDelete={() => removeTimeSlot(slot)} />
              ))}
              {(settings.hearingTimeSlots || []).length === 0 && (
                <Typography variant="body2" color="text.secondary">No time slots configured.</Typography>
              )}
            </Stack>

            <Stack direction="row" gap={1.5}>
              <TextField
                size="small" label="Add slot (e.g. 05:30 PM)" value={newTimeSlot}
                onChange={(e) => setNewTimeSlot(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTimeSlot(); } }}
              />
              <Button variant="outlined" startIcon={<Plus size={16} />} onClick={addTimeSlot}>Add Slot</Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
