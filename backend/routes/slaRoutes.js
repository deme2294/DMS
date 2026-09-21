import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as slaController from '../controllers/slaController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);

const categoryIdValidator = (field = 'categoryId') =>
  (field === 'categoryId' ? query('categoryId') : body('categoryId'))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .custom((v) => !v || v === 'null' || v === 'undefined' || /^[0-9a-z-]{1,64}$/i.test(v))
    .withMessage('Invalid categoryId');

// All authenticated users may read SLA policies
router.get(
  '/',
  [
    categoryIdValidator('categoryId'),
    validate,
  ],
  slaController.listPolicies
);

router.get('/preview',
  [
    categoryIdValidator('categoryId'),
    query('priority').isIn(['low', 'medium', 'high', 'urgent']),
    query('createdAt').optional().isISO8601(),
    validate,
  ],
  slaController.previewSLA
);

router.post(
  '/:id/test-compute',
  [param('id').trim().notEmpty().isLength({ min: 1, max: 64 }), body('createdAt').optional().isISO8601(), validate],
  slaController.testCompute
);

router.get(
  '/:id',
  [param('id').trim().notEmpty().isLength({ min: 1, max: 64 }), validate],
  slaController.getPolicy
);

// Admin and CEO manage SLA policies
router.post(
  '/',
  requireRole('admin', 'ceo'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']),
    body('categoryId')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .custom((v) => !v || v === 'null' || v === 'undefined' || /^[0-9a-z-]{1,64}$/i.test(v))
      .withMessage('Invalid categoryId'),
    body('responseHours').optional().isInt({ min: 0 }),
    body('resolutionHours').optional().isInt({ min: 1 }),
    body('escalationHours')
      .optional({ nullable: true })
      .custom((v) => v === null || v === '' || v === undefined || (Number.isInteger(Number(v)) && Number(v) >= 0))
      .withMessage('escalationHours must be an integer >= 0 or empty'),
    body('workingHours').optional({ nullable: true }).isObject(),
    body('description').optional({ nullable: true }).trim(),
    validate,
  ],
  slaController.createPolicy
);

router.put(
  '/:id',
  requireRole('admin', 'ceo'),
  [
    param('id').trim().notEmpty().isLength({ min: 1, max: 64 }),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('categoryId')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .custom((v) => !v || v === 'null' || v === 'undefined' || /^[0-9a-z-]{1,64}$/i.test(v))
      .withMessage('Invalid categoryId'),
    body('responseHours').optional().isInt({ min: 0 }),
    body('resolutionHours').optional().isInt({ min: 1 }),
    body('escalationHours')
      .optional({ nullable: true })
      .custom((v) => v === null || v === '' || v === undefined || (Number.isInteger(Number(v)) && Number(v) >= 0))
      .withMessage('escalationHours must be an integer >= 0 or empty'),
    body('workingHours').optional({ nullable: true }).isObject(),
    body('description').optional({ nullable: true }).trim(),
    body('isActive').optional().isBoolean(),
    validate,
  ],
  slaController.updatePolicy
);

router.delete(
  '/:id',
  requireRole('admin', 'ceo'),
  [param('id').trim().notEmpty().isLength({ min: 1, max: 64 }), validate],
  slaController.deletePolicy
);

export default router;
