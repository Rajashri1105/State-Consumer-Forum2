const express = require('express');
const hearingController = require('../controllers/hearingController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  scheduleHearingValidator,
  rescheduleHearingValidator,
  adjournHearingValidator,
  remarksValidator,
} = require('../validators/hearingValidators');

const router = express.Router();

router.use(authenticate);

router.get('/calendar', hearingController.getCalendar);
router.get('/suggest', authorize('CLERK', 'REGISTRAR', 'ADMIN'), hearingController.getSuggestedDate);
router.post('/', authorize('CLERK', 'REGISTRAR', 'ADMIN'), scheduleHearingValidator, validate, hearingController.scheduleHearing);
router.patch('/:id/reschedule', authorize('CLERK', 'REGISTRAR', 'ADMIN'), rescheduleHearingValidator, validate, hearingController.rescheduleHearing);
router.patch('/:id/adjourn', authorize('JUDGE'), adjournHearingValidator, validate, hearingController.adjournHearing);
router.patch('/:id/complete', authorize('JUDGE'), remarksValidator, validate, hearingController.completeHearing);
router.get('/:id/notice-status', authorize('CLERK', 'JUDGE', 'REGISTRAR', 'ADMIN', 'CONSUMER'), hearingController.getNoticeStatus);
router.post('/:id/notice-status/:channel/resend', authorize('CLERK', 'REGISTRAR', 'ADMIN'), hearingController.resendNotice);

module.exports = router;
