import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as slaController from '../controllers/slaController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);

// All authenticated users may read SLA policies
router.get(
  '/',
  [
    query('categoryId').optional({ nullable: true }).trim().matches(/^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid categoryId'),
    validate,
  ],
  slaController.listPolicies
);

router.get('/preview',
  [query('categoryId').optional({ nullable: true }).trim().matches(/^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid categoryId'), query('priority').isIn(['low', 'medium', 'high', 'urgent']), query('createdAt').optional().isISO8601(), validate],
  slaController.previewSLA
);

router.post('/:id/test-compute', [param('id').isUUID(), body('createdAt').optional().isISO8601(), validate], slaController.testCompute);

router.get('/:id', [param('id').isUUID(), validate], slaController.getPolicy);

// Only admin manages SLA policies
router.post(
  '/',
  requireRole('admin'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']),
    body('categoryId').optional({ nullable: true }).trim().matches(/^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid categoryId'),
    body('responseHours').optional().isInt({ min: 0 }),
    body('resolutionHours').optional().isInt({ min: 1 }),
    body('escalationHours').optional().isInt({ min: 0 }),
    body('workingHours').optional({ nullable: true }).isObject(),
    body('description').optional({ nullable: true }).trim(),
    validate,
  ],
  slaController.createPolicy
);

router.put(
  '/:id',
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('categoryId').optional({ nullable: true }).trim().matches(/^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid categoryId'),
    body('responseHours').optional().isInt({ min: 0 }),
    body('resolutionHours').optional().isInt({ min: 1 }),
    body('escalationHours').optional().isInt({ min: 0 }),
    body('workingHours').optional({ nullable: true }).isObject(),
    body('description').optional({ nullable: true }).trim(),
    body('isActive').optional().isBoolean(),
    validate,
  ],
  slaController.updatePolicy
);

router.delete('/:id', requireRole('admin'), [param('id').isUUID(), validate], slaController.deletePolicy);

export default router;
