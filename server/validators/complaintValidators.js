const { body, query } = require('express-validator');

const createComplaintValidator = [
  body('title').optional().trim().isLength({ max: 150 }).withMessage('Case title must be under 150 characters'),
  body('categoryId').trim().notEmpty().withMessage('Complaint category is required'),
  body('sellerName').trim().notEmpty().withMessage('Seller name is required'),
  body('oppositePartyName').trim().notEmpty().withMessage('Opposite party name is required'),
  body('oppositePartyAddress').optional().trim(),
  body('oppositePartyEmail').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid opposite party e-mail'),
  body('oppositePartyPhone').optional({ checkFalsy: true }).trim().isLength({ min: 7, max: 15 }).withMessage('Enter a valid opposite party phone'),
  body('additionalOppositeParties').optional().isArray().withMessage('Additional opposite parties must be a list'),
  body('additionalOppositeParties.*.name').optional().trim().notEmpty().withMessage('Each additional opposite party needs a name'),
  body('additionalOppositeParties.*.address').optional().trim(),
  body('additionalOppositeParties.*.email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid e-mail for each additional opposite party'),
  body('product').optional().trim(),
  body('service').optional().trim(),
  body('purchaseDate').optional().isISO8601().withMessage('Enter a valid purchase date'),
  body('invoiceNumber').optional().trim(),
  body('complaintAmount').notEmpty().withMessage('Complaint amount is required').isFloat({ min: 0 }).withMessage('Complaint amount must be a positive number'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 20 }).withMessage('Please provide a detailed description (min 20 characters)'),
  body('overrideDuplicateWarning').optional().isBoolean(),
  body('synopsisText').optional().trim(),
  body('synopsisManualConfirm').optional().isBoolean(),
];

const rejectComplaintValidator = [
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required').isLength({ min: 5 }),
];

// Allotment: pick a specific judge, or a bench (least-loaded judge inside it),
// or neither (system picks the least-loaded bench).
const allotComplaintValidator = [
  body('judgeId').optional({ nullable: true }).trim(),
  body('benchId').optional({ nullable: true }).trim(),
  body('reason').optional({ nullable: true }).trim().isLength({ max: 500 }),
];

const listComplaintsValidator = [
  query('status').optional().trim(),
  query('priority').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  createComplaintValidator,
  rejectComplaintValidator,
  allotComplaintValidator,
  listComplaintsValidator,
};
