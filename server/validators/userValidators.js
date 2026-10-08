const { body } = require('express-validator');

const createUserValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').notEmpty().withMessage('Role is required').isIn(['CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN']).withMessage('Role must be CLERK, JUDGE, REGISTRAR, or ADMIN'),
  body('clerkType').optional({ nullable: true, checkFalsy: true }).isIn(['SCRUTINY', 'COURT']).withMessage('Clerk type must be SCRUTINY or COURT'),
  body('benchId').optional({ nullable: true, checkFalsy: true }).isString(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('designation').optional().trim(),
  body('courtRoom').optional().trim(),
  body('specialization').optional().trim(),
  body('maxHearingsPerDay').optional().isInt({ min: 1, max: 20 }),
];

const updateUserValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('designation').optional().trim(),
  body('courtRoom').optional().trim(),
  body('specialization').optional().trim(),
  body('maxHearingsPerDay').optional().isInt({ min: 1, max: 20 }),
];

const updateStatusValidator = [
  body('isActive').notEmpty().withMessage('isActive is required').isBoolean().withMessage('isActive must be true or false'),
];

module.exports = { createUserValidator, updateUserValidator, updateStatusValidator };
