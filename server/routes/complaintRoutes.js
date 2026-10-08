const express = require('express');
const complaintController = require('../controllers/complaintController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploader } = require('../middleware/upload');
const {
  createComplaintValidator,
  rejectComplaintValidator,
  allotComplaintValidator,
  listComplaintsValidator,
} = require('../validators/complaintValidators');

const router = express.Router();
const evidenceUploader = createUploader('evidence');

router.use(authenticate);

// Consumer
router.post('/', authorize('CONSUMER'), createComplaintValidator, validate, complaintController.createComplaint);
router.post('/synopsis/generate', authorize('CONSUMER'), complaintController.generateSynopsisDraft);
router.post('/:id/synopsis/generate', authorize('CONSUMER'), complaintController.regenerateSynopsis);
router.get('/:id/synopsis/pdf', authorize('CONSUMER', 'CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN'), complaintController.downloadSynopsisPdf);
router.get('/:id/completeness', authorize('CONSUMER', 'CLERK', 'REGISTRAR', 'ADMIN'), complaintController.getCompleteness);
router.post('/:id/evidence', authorize('CONSUMER'), evidenceUploader.array('files', 10), complaintController.uploadEvidence);
router.get('/mine', authorize('CONSUMER'), listComplaintsValidator, validate, complaintController.getMyComplaints);
router.patch('/:id/withdraw', authorize('CONSUMER'), complaintController.withdrawComplaint);
router.post('/:id/feedback', authorize('CONSUMER'), complaintController.submitFeedback);
router.patch('/:id/resubmit', authorize('CONSUMER'), complaintController.resubmitComplaint);

// Lists — every role is scoped inside the controller (see services/scopeService.js)
router.get('/', authorize('CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN'), listComplaintsValidator, validate, complaintController.listComplaints);

// Scrutiny (intake) clerk: claim -> verify | defective | reject
router.patch('/:id/claim', authorize('CLERK'), complaintController.claimComplaint);
router.patch('/:id/release', authorize('CLERK'), complaintController.releaseComplaint);
router.patch('/:id/verify', authorize('CLERK'), complaintController.verifyAndAccept);
router.patch('/:id/defective', authorize('CLERK'), complaintController.markDefective);
router.patch('/:id/reject', authorize('CLERK'), rejectComplaintValidator, validate, complaintController.rejectComplaint);

// Registrar: bench allotment + re-allotment
router.get('/judge-recommendations', authorize('REGISTRAR', 'ADMIN'), complaintController.getJudgeRecommendations);
router.get('/allotment-queue', authorize('REGISTRAR', 'ADMIN'), complaintController.getAllotmentQueue);
router.patch('/:id/allot', authorize('REGISTRAR', 'ADMIN'), allotComplaintValidator, validate, complaintController.allotComplaint);

// Judge: recuse (conflict of interest) -> back to Registrar
router.post('/:id/recuse', authorize('JUDGE'), complaintController.recuseComplaint);

// Shared (access-controlled inside controller)
router.get('/:id/receipt', complaintController.downloadReceipt);
router.get('/:id', complaintController.getComplaintById);

module.exports = router;
