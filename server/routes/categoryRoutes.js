const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { categoryValidator, priorityRuleValidator } = require('../validators/categoryValidators');

const router = express.Router();
router.use(authenticate);

// Categories are readable by all authenticated roles (needed for complaint form),
// but only admins can modify them.
router.get('/', categoryController.listCategories);
router.post('/', authorize('ADMIN'), categoryValidator, validate, categoryController.createCategory);
router.patch('/:id', authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', authorize('ADMIN'), categoryController.deleteCategory);

router.get('/priority-rules/all', authorize('ADMIN', 'CLERK'), categoryController.listPriorityRules);
router.post('/priority-rules', authorize('ADMIN'), priorityRuleValidator, validate, categoryController.createPriorityRule);
router.patch('/priority-rules/:id', authorize('ADMIN'), categoryController.updatePriorityRule);
router.delete('/priority-rules/:id', authorize('ADMIN'), categoryController.deletePriorityRule);

module.exports = router;
