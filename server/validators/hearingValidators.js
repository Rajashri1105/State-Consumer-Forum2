const { body } = require('express-validator');

const scheduleHearingValidator = [
  body('complaintId').trim().notEmpty().withMessage('Complaint is required'),
  body('useSuggested').optional().isBoolean(),
  body('scheduledDate').optional().isISO8601().withMessage('Enter a valid date'),
  body('scheduledTime').optional().trim(),
];

const rescheduleHearingValidator = [
  body('scheduledDate').notEmpty().withMessage('New date is required').isISO8601().withMessage('Enter a valid date'),
  body('scheduledTime').notEmpty().withMessage('New time slot is required'),
  body('remarks').optional().trim(),
];

const adjournHearingValidator = [
  body('adjournReason').trim().notEmpty().withMessage('Adjournment reason is required'),
];

const remarksValidator = [
  body('remarks').trim().notEmpty().withMessage('Remarks are required'),
];

module.exports = {
  scheduleHearingValidator,
  rescheduleHearingValidator,
  adjournHearingValidator,
  remarksValidator,
};
