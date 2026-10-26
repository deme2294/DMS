import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as slaController from '../controllers/slaController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

const categoryIdValidator = (field = 'categoryId') =>
  (field === 'categoryId' ? query('categoryId') : body('categoryId'))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .custom((v) => !v || v === 'null' || v === 'undefined' || /^[0-9a-z-]{1,64}$/i.test(v))
    .withMessage('Invalid categoryId');

// SLA preview for ticket creation / forms (available to all users)
router.get('/preview',
  optionalAuthenticate,
  [
    categoryIdValidator('categoryId'),
    query('priority').isIn(['low', 'medium', 'high', 'urgent']),
    query('createdAt').optional().isISO8601(),
    validate,
  ],
  slaController.previewSLA
);

// Read policies
router.get(
  '/',
  optionalAuthenticate,
  [
    categoryIdValidator('categoryId'),
    validate,
  ],
  slaController.listPolicies
);

// Admin / CEO management operations require authentication
router.use(authenticate);

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
    body('resolutionHours')
      .optional()
      .isInt({ min: 1 })
      .custom((val, { req }) => {
        const resp = req.body.responseHours !== undefined && req.body.responseHours !== '' ? Number(req.body.responseHours) : 4;
        if (Number(val) <= resp) {
          throw new Error(`Resolution Time (${val}h) must be strictly greater than First Response Time (${resp}h)`);
        }
        return true;
      }),
    body('escalationHours')
      .optional({ nullable: true })
      .custom((v, { req }) => {
        if (v === null || v === '' || v === undefined) return true;
        const esc = Number(v);
        if (!Number.isInteger(esc) || esc < 0) {
          throw new Error('escalationHours must be an integer >= 0 or empty');
        }
        if (esc > 0) {
          const resp = req.body.responseHours !== undefined && req.body.responseHours !== '' ? Number(req.body.responseHours) : 4;
          const res = req.body.resolutionHours !== undefined && req.body.resolutionHours !== '' ? Number(req.body.resolutionHours) : 24;
          if (esc <= resp) {
            throw new Error(`Escalation Time (${esc}h) must be greater than First Response Time (${resp}h)`);
          }
          if (esc > res) {
            throw new Error(`Escalation Time (${esc}h) must be less than or equal to Resolution Time (${res}h)`);
          }
        }
        return true;
      }),
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
    body('resolutionHours')
      .optional()
      .isInt({ min: 1 })
      .custom((val, { req }) => {
        if (req.body.responseHours !== undefined && req.body.responseHours !== '') {
          const resp = Number(req.body.responseHours);
          if (Number(val) <= resp) {
            throw new Error(`Resolution Time (${val}h) must be strictly greater than First Response Time (${resp}h)`);
          }
        }
        return true;
      }),
    body('escalationHours')
      .optional({ nullable: true })
      .custom((v, { req }) => {
        if (v === null || v === '' || v === undefined) return true;
        const esc = Number(v);
        if (!Number.isInteger(esc) || esc < 0) {
          throw new Error('escalationHours must be an integer >= 0 or empty');
        }
        if (esc > 0) {
          if (req.body.responseHours !== undefined && req.body.responseHours !== '') {
            const resp = Number(req.body.responseHours);
            if (esc <= resp) {
              throw new Error(`Escalation Time (${esc}h) must be greater than First Response Time (${resp}h)`);
            }
          }
          if (req.body.resolutionHours !== undefined && req.body.resolutionHours !== '') {
            const res = Number(req.body.resolutionHours);
            if (esc > res) {
              throw new Error(`Escalation Time (${esc}h) must be less than or equal to Resolution Time (${res}h)`);
            }
          }
        }
        return true;
      }),
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
