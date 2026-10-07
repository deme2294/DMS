import { Router } from 'express';
import { body, query } from 'express-validator';
import * as tenantController from '../controllers/tenantController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRole } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';

const router = Router();

// Public — tenant self-registration
router.post(
  '/register',
  [
    body('organizationName').trim().isLength({ min: 2, max: 200 }),
    body('contactPerson').trim().isLength({ min: 2, max: 150 }),
    body('email').isEmail().normalizeEmail(),
    body('username').trim().isLength({ min: 3, max: 80 }),
    body('password').isLength({ min: 8 }),
    body('confirmPassword').trim().isLength({ min: 8 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('registrationNumber').optional().trim(),
    validate,
  ],
  tenantController.registerTenant
);

router.use(authenticate);

router.get('/profile/me', requireRole('tenant'), tenantController.getMyProfile);

router.put(
  '/profile/me',
  requireRole('tenant'),
  [
    body('contactPerson').optional().trim().isLength({ min: 2, max: 150 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('notes').optional().trim(),
    validate,
  ],
  tenantController.updateMyProfile
);

router.get(
  '/',
  authorize('tenants.manage'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('status').optional().custom((v) => !v || ['active', 'inactive', 'pending'].includes(v)).withMessage('Invalid status'),
    validate,
  ],
  tenantController.getTenants
);

router.get('/:id', authorize('tenants.manage'), [idParam(), validate], tenantController.getTenantById);
router.delete('/:id', authorize('tenants.manage'), [idParam(), validate], tenantController.deleteTenant);
router.patch('/:id/activate', authorize('tenants.manage'), [idParam(), validate], tenantController.activateTenant);
router.patch('/:id/deactivate', authorize('tenants.manage'), [idParam(), validate], tenantController.deactivateTenant);
router.patch('/:id/approve', authorize('tenants.manage'), [idParam(), validate], tenantController.approveTenant);

router.post(
  '/',
  authorize('tenants.manage'),
  [
    body('organizationName').trim().isLength({ min: 2, max: 255 }),
    body('registrationNumber').trim().notEmpty().withMessage('Registration number is required'),
    body('contactPerson').trim().isLength({ min: 2, max: 150 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('address').optional().trim(),
    body('notes').optional().trim(),
    body('status').optional().isIn(['active', 'inactive', 'pending']),
    body('username').trim().isLength({ min: 3, max: 100 }),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').trim().isLength({ min: 8 }),
    validate,
  ],
  tenantController.createTenant
);

router.put(
  '/:id',
  authorize('tenants.manage'),
  [
    idParam(),
    body('organizationName').optional().trim().isLength({ min: 2, max: 255 }),
    body('contactPerson').optional().trim().isLength({ min: 2, max: 150 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('registrationNumber').optional().trim(),
    body('notes').optional().trim(),
    body('status').optional().isIn(['active', 'inactive', 'pending']),
    validate,
  ],
  tenantController.updateTenant
);

export default router;
