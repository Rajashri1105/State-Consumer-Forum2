const express = require('express');
const judgmentController = require('../controllers/judgmentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploader } = require('../middleware/upload');
const { submitVerdictValidator, finalizeJudgmentValidator } = require('../validators/judgmentValidators');

const router = express.Router();

router.use(authenticate);

router.post('/:complaintId/verdict', authorize('JUDGE'), submitVerdictValidator, validate, judgmentController.submitVerdict);
router.post('/:complaintId/final-document', authorize('CLERK'), finalizeJudgmentValidator, validate, judgmentController.finalizeJudgmentDocument);
router.get('/:complaintId', judgmentController.getJudgment);

module.exports = router;
