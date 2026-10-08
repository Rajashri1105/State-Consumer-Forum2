const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { recordAudit } = require('../services/auditService');

// --------------------------------------------------------------------------
// Holidays
// --------------------------------------------------------------------------
async function listHolidays(req, res) {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  return new ApiResponse(200, { holidays }).send(res);
}

async function createHoliday(req, res) {
  const { date, description, isRecurringAnnual } = req.body;
  if (!date || !description) throw ApiError.badRequest('Date and description are required');

  const holiday = await prisma.holiday.create({
    data: { date: new Date(date), description, isRecurringAnnual: Boolean(isRecurringAnnual) },
  });
  await recordAudit({ userId: req.user.id, action: 'HOLIDAY_CREATED', entityType: 'Holiday', entityId: holiday.id, ipAddress: req.ip });
  return new ApiResponse(201, { holiday }, 'Holiday added').send(res);
}

async function deleteHoliday(req, res) {
  const { id } = req.params;
  await prisma.holiday.delete({ where: { id } });
  await recordAudit({ userId: req.user.id, action: 'HOLIDAY_DELETED', entityType: 'Holiday', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, null, 'Holiday removed').send(res);
}

// --------------------------------------------------------------------------
// Forum settings (single row)
// --------------------------------------------------------------------------
async function getForumSettings(req, res) {
  let settings = await prisma.forumSettings.findFirst();
  if (!settings) {
    settings = await prisma.forumSettings.create({ data: {} });
  }
  return new ApiResponse(200, { settings }).send(res);
}

async function updateForumSettings(req, res) {
  const { forumName, address, contactEmail, contactPhone, maxHearingsPerDayDefault, workingDays, hearingTimeSlots, overdueThresholdDays, allotmentMode, claimTimeoutHours } = req.body;

  if (allotmentMode !== undefined && !['AUTO', 'MANUAL'].includes(allotmentMode)) {
    throw ApiError.badRequest('allotmentMode must be AUTO or MANUAL');
  }

  let settings = await prisma.forumSettings.findFirst();
  if (!settings) settings = await prisma.forumSettings.create({ data: {} });

  const updated = await prisma.forumSettings.update({
    where: { id: settings.id },
    data: {
      ...(forumName !== undefined ? { forumName } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(contactEmail !== undefined ? { contactEmail } : {}),
      ...(contactPhone !== undefined ? { contactPhone } : {}),
      ...(maxHearingsPerDayDefault !== undefined ? { maxHearingsPerDayDefault } : {}),
      ...(workingDays !== undefined ? { workingDays } : {}),
      ...(hearingTimeSlots !== undefined ? { hearingTimeSlots } : {}),
      ...(overdueThresholdDays !== undefined ? { overdueThresholdDays: Number(overdueThresholdDays) } : {}),
      ...(allotmentMode !== undefined ? { allotmentMode } : {}),
      ...(claimTimeoutHours !== undefined ? { claimTimeoutHours: Math.max(1, Number(claimTimeoutHours)) } : {}),
    },
  });

  await recordAudit({ userId: req.user.id, action: 'FORUM_SETTINGS_UPDATED', entityType: 'ForumSettings', entityId: updated.id, ipAddress: req.ip });
  return new ApiResponse(200, { settings: updated }, 'Settings updated').send(res);
}

module.exports = { listHolidays, createHoliday, deleteHoliday, getForumSettings, updateForumSettings };
