const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUserValidator, updateUserValidator, updateStatusValidator } = require('../validators/userValidators');

const router = express.Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', userController.listUsers);
router.post('/', createUserValidator, validate, userController.createUser);
router.get('/:id', userController.getUserById);
router.patch('/:id', updateUserValidator, validate, userController.updateUser);
router.patch('/:id/status', updateStatusValidator, validate, userController.updateUserStatus);
router.delete('/:id', userController.deleteUser);

module.exports = router;
