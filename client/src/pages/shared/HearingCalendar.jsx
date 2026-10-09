import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Paper, IconButton, Grid, Stack, Chip, Tabs, Tab, Divider } from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import dayjs from 'dayjs';
import { hearingService } from '../../services/hearingService';
import Loader from '../../components/common/Loader';
import DocketTag from '../../components/common/DocketTag';
import { tokens } from '../../theme/theme';
import { getComplaintTitle } from '../../utils/complaintTitle';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLOR = {
  SCHEDULED: tokens.info, COMPLETED: tokens.success, ADJOURNED: tokens.warning, CANCELLED: tokens.inkMuted,
};

function HearingRow({ h, homePrefix }) {
  return (
    <Box
      component={RouterLink}
      to={`${homePrefix}/complaints/${h.complaint?.id}`}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
        p: 1.5, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap',
        '&:hover': { backgroundColor: 'action.hover' }, borderRadius: 1,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
        <CalendarClock size={16} color={tokens.ashokaNavy} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>
            {dayjs(h.scheduledDate).format('DD MMM YYYY')} · {h.scheduledTime}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            <DocketTag>{h.complaint?.complaintNumber}</DocketTag>
            <Typography variant="caption" color="text.secondary" noWrap>{getComplaintTitle(h.complaint)}</Typography>
          </Stack>
          <Typography variant="caption" color="text.disabled">Judge: {h.judge?.user?.name}</Typography>
        </Box>
      </Stack>
      <Chip size="small" label={h.status} sx={{ backgroundColor: `${STATUS_COLOR[h.status]}1A`, color: STATUS_COLOR[h.status], fontWeight: 700 }} />
    </Box>
  );
}

export default function HearingCalendar({ homePrefix }) {
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [loading, setLoading] = useState(true);
  const [hearings, setHearings] = useState([]);
  const [groups, setGroups] = useState({ today: [], upcoming: [], completed: [], adjourned: [] });
  const [tab, setTab] = useState('today');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hearingService.getCalendar({ from: month.startOf('month').toISOString(), to: month.endOf('month').toISOString() })
      .then(({ data }) => {
        if (cancelled) return;
        setHearings(data.data.hearings || []);
        setGroups({
          today: data.data.today || [],
          upcoming: data.data.upcoming || [],
          completed: data.data.completed || [],
          adjourned: data.data.adjourned || [],
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  const hearingsByDay = useMemo(() => {
    const map = {};
    hearings.forEach((h) => {
      const key = dayjs(h.scheduledDate).format('YYYY-MM-DD');
      (map[key] ||= []).push(h);
    });
    return map;
  }, [hearings]);

  const gridCells = useMemo(() => {
    const startOfMonth = month.startOf('month');
    const daysInMonth = month.daysInMonth();
    const leadingBlanks = startOfMonth.day();
    const cells = Array.from({ length: leadingBlanks }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(startOfMonth.date(d));
    return cells;
  }, [month]);

  const activeList = groups[tab] || [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Hearing Calendar</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monthly view of scheduled, completed, and adjourned hearings.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <IconButton onClick={() => setMonth((m) => m.subtract(1, 'month'))}><ChevronLeft size={20} /></IconButton>
          <Typography variant="subtitle1" fontWeight={700}>{month.format('MMMM YYYY')}</Typography>
          <IconButton onClick={() => setMonth((m) => m.add(1, 'month'))}><ChevronRight size={20} /></IconButton>
        </Stack>

        {loading ? <Loader label="Loading calendar…" minHeight={200} /> : (
          <Grid container spacing={0.75}>
            {WEEKDAYS.map((d) => (
              <Grid item xs={12 / 7} key={d}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>{d}</Typography>
              </Grid>
            ))}
            {gridCells.map((day, i) => {
              const key = day ? day.format('YYYY-MM-DD') : `blank-${i}`;
              const dayHearings = day ? hearingsByDay[key] || [] : [];
              const isToday = day && day.isSame(dayjs(), 'day');
              return (
                <Grid item xs={12 / 7} key={key}>
                  <Box
                    sx={{
                      minHeight: 64, borderRadius: 1, p: 0.75,
                      border: `1px solid ${tokens.border}`,
                      backgroundColor: isToday ? `${tokens.ashokaNavy}0D` : 'transparent',
                      opacity: day ? 1 : 0.35,
                    }}
                  >
                    {day && (
                      <>
                        <Typography variant="caption" fontWeight={isToday ? 700 : 500}>{day.date()}</Typography>
                        {dayHearings.slice(0, 2).map((h) => (
                          <Box key={h.id} sx={{
                            fontSize: '0.65rem', mt: 0.5, px: 0.5, py: 0.25, borderRadius: 0.5,
                            backgroundColor: `${STATUS_COLOR[h.status]}1A`, color: STATUS_COLOR[h.status],
                            fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {h.scheduledTime}
                          </Box>
                        ))}
                        {dayHearings.length > 2 && (
                          <Typography variant="caption" color="text.secondary">+{dayHearings.length - 2} more</Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${tokens.border}` }}>
          <Tab value="today" label={`Today (${groups.today.length})`} />
          <Tab value="upcoming" label={`Upcoming (${groups.upcoming.length})`} />
          <Tab value="completed" label={`Completed (${groups.completed.length})`} />
          <Tab value="adjourned" label={`Adjourned (${groups.adjourned.length})`} />
        </Tabs>
        <Box sx={{ p: 1 }}>
          {activeList.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nothing here.</Typography>
          ) : (
            <Stack divider={<Divider />}>
              {activeList.map((h) => <HearingRow key={h.id} h={h} homePrefix={homePrefix} />)}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
