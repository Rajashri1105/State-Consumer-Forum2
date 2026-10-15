const { body } = require('express-validator');

const submitVerdictValidator = [
  body('summary').trim().notEmpty().withMessage('Judgment summary is required').isLength({ min: 20, max: 10000 }),
  body('verdict').isIn(['In favor of Consumer', 'In favor of Opposite Party'])
    .withMessage('Verdict must be in favor of the consumer or opposite party'),
];

const finalizeJudgmentValidator = [
  body('consumerPresent').isBoolean().withMessage('Consumer attendance is required').toBoolean(),
  body('oppositePartyPresent').isBoolean().withMessage('Opposite party attendance is required').toBoolean(),
  body('witnessDetails').trim().notEmpty().withMessage('Enter witness names or None').isLength({ max: 2000 }),
  body('advocateDetails').trim().notEmpty().withMessage('Enter advocate names or None').isLength({ max: 2000 }),
];

module.exports = { submitVerdictValidator, finalizeJudgmentValidator };
