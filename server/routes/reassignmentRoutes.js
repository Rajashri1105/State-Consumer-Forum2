const express = require('express');
const reassignmentController = require('../controllers/reassignmentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('CLERK', 'REGISTRAR', 'ADMIN'));

router.get('/', reassignmentController.listReassignments);
router.patch('/:id/approve', reassignmentController.approveReassignment);
router.patch('/:id/reject', reassignmentController.rejectReassignment);

module.exports = router;
