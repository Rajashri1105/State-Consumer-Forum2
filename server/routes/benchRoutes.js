const express = require('express');
const benchController = require('../controllers/benchController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Read: Registrar needs the bench list + live workload to allot cases.
router.get('/', authorize('ADMIN', 'REGISTRAR'), benchController.listBenches);
router.get('/workload', authorize('ADMIN', 'REGISTRAR'), benchController.getWorkload);

// Structure changes (create benches, seat judges, attach court clerks): Admin only.
router.post('/', authorize('ADMIN'), benchController.createBench);
router.patch('/:id', authorize('ADMIN'), benchController.updateBench);
router.delete('/:id', authorize('ADMIN'), benchController.deleteBench);
router.post('/:id/judges', authorize('ADMIN'), benchController.addJudge);
router.delete('/:id/judges/:judgeId', authorize('ADMIN'), benchController.removeJudge);
router.post('/:id/clerks', authorize('ADMIN'), benchController.addClerk);
router.delete('/:id/clerks/:clerkId', authorize('ADMIN'), benchController.removeClerk);

module.exports = router;
