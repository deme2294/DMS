import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as departmentController from '../controllers/departmentController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, departmentIdParam } from '../middleware/validationMiddleware.js';

const router = Router();

// Reference list of active departments for dropdowns (tickets, communications, matrix)
router.get(
  '/active',
  optionalAuthenticate,
  departmentController.getActiveDepartments
);

router.use(authenticate);

router.get(
  '/heads',
  authorize('departments.manage'),
  departmentController.getEligibleHeads
);

router.get(
  '/',
  authorize('departments.manage'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('status').optional().custom((v) => !v || ['active', 'inactive'].includes(v)).withMessage('Invalid status'),
    validate,
  ],
  departmentController.getDepartments
);

// Member management — declared before '/:id' to avoid any path shadowing.
router.get('/:id/members', authorize('departments.manage'), [departmentIdParam('id'), validate], departmentController.getDepartmentMembers);
router.post(
  '/:id/members',
  authorize('departments.manage'),
  [
    departmentIdParam('id'),
    body('userIds').optional().isArray(),
    body('userIds.*').optional().isString().trim(),
    validate,
  ],
  departmentController.assignDepartmentUsers
);

router.get('/:id', authorize('departments.manage'), [departmentIdParam('id'), validate], departmentController.getDepartmentById);
router.delete('/:id', authorize('departments.manage'), [departmentIdParam('id'), validate], departmentController.deleteDepartment);
router.patch('/:id/activate', authorize('departments.manage'), [departmentIdParam('id'), validate], departmentController.activateDepartment);
router.patch('/:id/deactivate', authorize('departments.manage'), [departmentIdParam('id'), validate], departmentController.deactivateDepartment);

router.post(
  '/',
  authorize('departments.manage'),
  [
    body('name').trim().isLength({ min: 2, max: 150 }),
    body('code').trim().isLength({ min: 2, max: 50 }).matches(/^[A-Za-z0-9_-]+$/),
    body('description').optional().trim(),
    body('headUserId').optional({ nullable: true }).isString().trim(),
    body('status').optional().isIn(['active', 'inactive']),
    body('memberIds').optional().isArray(),
    body('memberIds.*').optional().isString().trim(),
    validate,
  ],
  departmentController.createDepartment
);

router.put(
  '/:id',
  authorize('departments.manage'),
  [
    departmentIdParam('id'),
    body('name').optional().trim().isLength({ min: 2, max: 150 }),
    body('code').optional().trim().isLength({ min: 2, max: 50 }).matches(/^[A-Za-z0-9_-]+$/),
    body('description').optional().trim(),
    body('headUserId').optional({ nullable: true }).isString().trim(),
    body('status').optional().isIn(['active', 'inactive']),
    body('memberIds').optional().isArray(),
    body('memberIds.*').optional().isString().trim(),
    validate,
  ],
  departmentController.updateDepartment
);

export default router;