const express = require('express');
const judgmentController = require('../controllers/judgmentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploader } = require('../middleware/upload');
const { uploadJudgmentValidator } = require('../validators/judgmentValidators');

const router = express.Router();
const judgmentUploader = createUploader('judgments');

router.use(authenticate);

router.post('/:complaintId', authorize('JUDGE'), judgmentUploader.single('file'), uploadJudgmentValidator, validate, judgmentController.finalizeVerdict);
router.get('/:complaintId', judgmentController.getJudgment);

module.exports = router;
