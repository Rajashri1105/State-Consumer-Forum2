const express = require('express');
const judgeLeaveController = require('../controllers/judgeLeaveController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/mine', authorize('JUDGE'), judgeLeaveController.listMyLeaves);
router.post('/mine', authorize('JUDGE'), judgeLeaveController.createMyLeave);

router.get('/today', authorize('CLERK', 'REGISTRAR', 'ADMIN', 'JUDGE'), judgeLeaveController.getTodaysAbsences);

router.get('/', authorize('REGISTRAR', 'ADMIN'), judgeLeaveController.listAllLeaves);
router.post('/', authorize('REGISTRAR', 'ADMIN'), judgeLeaveController.createLeaveForJudge);

router.delete('/:id', authorize('JUDGE', 'REGISTRAR', 'ADMIN'), judgeLeaveController.deleteLeave);

module.exports = router;
