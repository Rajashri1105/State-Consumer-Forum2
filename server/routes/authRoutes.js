const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  verifyEmailValidator,
  updateProfileValidator,
  deleteAccountValidator,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, registerValidator, validate, authController.register);
router.post('/verify-email', authLimiter, verifyEmailValidator, validate, authController.verifyEmail);
router.post('/resend-verification', authLimiter, forgotPasswordValidator, validate, authController.resendVerification);
router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, validate, authController.resetPassword);

router.get('/me', authenticate, authController.getMe);
router.get('/account-deletion-status', authenticate, authController.getAccountDeletionStatus);
router.post('/change-password', authenticate, changePasswordValidator, validate, authController.changePassword);
router.patch('/profile', authenticate, updateProfileValidator, validate, authController.updateProfile);
router.delete('/account', authenticate, deleteAccountValidator, validate, authController.deleteAccount);

module.exports = router;
