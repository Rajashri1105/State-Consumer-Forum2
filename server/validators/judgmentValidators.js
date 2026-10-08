const { body } = require('express-validator');

const uploadJudgmentValidator = [
  body('summary').trim().notEmpty().withMessage('Judgment summary is required').isLength({ min: 20 }),
  body('verdict').trim().notEmpty().withMessage('Verdict is required'),
];

module.exports = { uploadJudgmentValidator };
