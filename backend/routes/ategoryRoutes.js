import { Router } from 'express';
import { body, param } from 'express-validator';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);

// All authenticated users can read categories (only approved/active shown)
router.get('/', categoryController.getCategories);
router.get('/requests', requireRole('admin'), categoryController.listRequests);
router.get('/:id', [param('id').isUUID(), validate], categoryController.getCategoryById);

// Admin and manager can create categories (manager requests → pending)
router.post(
  '/',
  requireRole('admin', 'manager'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
    body('description').optional({ nullable: true }).trim(),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    body('slaPolicyId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    validate,
  ],
  categoryController.createCategory
);

// Admin approves / rejects category requests
router.post(
  '/:id/approve',
  requireRole('admin'),
  [param('id').isUUID(), body('reviewNotes').optional({ nullable: true }).trim(), validate],
  categoryController.approveCategory
);

router.post(
  '/:id/reject',
  requireRole('admin'),
  [param('id').isUUID(), body('reviewNotes').optional({ nullable: true }).trim(), validate],
  categoryController.rejectCategory
);

router.put(
  '/:id',
  requireRole('admin', 'manager'),
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('description').optional({ nullable: true }).trim(),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    body('slaPolicyId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    body('isActive').optional().isBoolean(),
    validate,
  ],
  categoryController.updateCategory
);

// Only admin can delete
router.delete(
  '/:id',
  requireRole('admin'),
  [param('id').isUUID(), validate],
  categoryController.deleteCategory
);

export default router;
