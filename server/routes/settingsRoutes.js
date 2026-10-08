const express = require('express');
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Readable by any authenticated role — clerks need hearingTimeSlots/workingDays
// to populate hearing scheduling dropdowns.
router.get('/forum', settingsController.getForumSettings);

router.get('/holidays', authorize('ADMIN'), settingsController.listHolidays);
router.post('/holidays', authorize('ADMIN'), settingsController.createHoliday);
router.delete('/holidays/:id', authorize('ADMIN'), settingsController.deleteHoliday);

router.patch('/forum', authorize('ADMIN'), settingsController.updateForumSettings);

module.exports = router;
