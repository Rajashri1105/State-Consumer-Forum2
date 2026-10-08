const express = require('express');
const partyController = require('../controllers/partyController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);

const replyUploader = createUploader('replies');

// Opposite party
router.get('/cases', authorize('OPPOSITE_PARTY'), partyController.listMyCases);
router.post('/:id/reply', authorize('OPPOSITE_PARTY'), replyUploader.array('files', 5), partyController.fileReply);
router.post('/:id/extension', authorize('OPPOSITE_PARTY'), partyController.requestExtension);
router.post('/:id/settlement', authorize('OPPOSITE_PARTY'), partyController.offerSettlement);
router.patch('/settlements/:offerId/withdraw', authorize('OPPOSITE_PARTY'), partyController.withdrawSettlement);

// Judge (of the case) / Registrar / Admin decide extension requests
router.patch('/extensions/:extId', authorize('JUDGE', 'REGISTRAR', 'ADMIN'), partyController.decideExtension);

// Consumer answers a settlement offer
router.patch('/settlements/:offerId', authorize('CONSUMER'), partyController.respondToSettlement);

// Read the party-side record of a case (access is checked per role in the controller)
router.get('/:id/responses', partyController.getResponses);

// Resend portal invite to opposite party (Registrar, Admin, Court Clerk)
router.post('/:id/resend-invite', authorize('REGISTRAR', 'ADMIN', 'CLERK'), partyController.resendInvite);

module.exports = router;
