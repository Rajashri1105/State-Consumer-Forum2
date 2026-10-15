const { body, query } = require('express-validator');

const createComplaintValidator = [
  body('caseType').optional().isIn(['NEW_COMPLAINT', 'APPEAL']).withMessage('Invalid case type'),
  body('categoryId').trim().notEmpty().withMessage('Complaint category is required'),
  body('sellerName').custom((value, { req }) => {
    if (req.body.caseType === 'APPEAL') return true;
    if (!value || !value.trim()) throw new Error('Seller name is required');
    return true;
  }),
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
  body('complaintAmount')
    .notEmpty().withMessage('Claim / dispute amount is required')
    .isFloat({ gt: 0 }).withMessage('Claim / dispute amount must be greater than zero'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 20 }).withMessage('Please provide a detailed description (min 20 characters)'),
  
  // Appeal-specific validations
  body('districtCaseNumber').custom((value, { req }) => {
    if (req.body.caseType === 'APPEAL') {
      if (!value || !value.trim()) throw new Error('District case number is required for appeals');
    }
    return true;
  }),
  body('districtCommissionName').custom((value, { req }) => {
    if (req.body.caseType === 'APPEAL') {
      if (!value || !value.trim()) throw new Error('District Commission name is required for appeals');
    }
    return true;
  }),
  body('districtOrderDate').custom((value, { req }) => {
    if (req.body.caseType === 'APPEAL') {
      if (!value) throw new Error('District order date is required for appeals');
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new Error('Enter a valid District order date');
      if (d > new Date()) throw new Error('District order date cannot be in the future');
    }
    return true;
  }),
  body('appealGrounds').custom((value, { req }) => {
    if (req.body.caseType === 'APPEAL') {
      if (!value || !value.trim()) throw new Error('Grounds of appeal are required');
      if (value.trim().length < 50) throw new Error('Grounds of appeal must be at least 50 characters');
    }
    return true;
  }),

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
  query('caseType').optional().isIn(['NEW_COMPLAINT', 'APPEAL']),
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
