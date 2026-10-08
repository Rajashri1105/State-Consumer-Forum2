const { body } = require('express-validator');

const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  body('defaultPriority').optional().isIn(['HIGH', 'MEDIUM', 'LOW']).withMessage('Priority must be HIGH, MEDIUM, or LOW'),
];

const priorityRuleValidator = [
  body('keyword').trim().notEmpty().withMessage('Keyword is required'),
  body('priority').notEmpty().withMessage('Priority is required').isIn(['HIGH', 'MEDIUM', 'LOW']),
  body('categoryId').optional({ nullable: true }).trim(),
];

module.exports = { categoryValidator, priorityRuleValidator };
