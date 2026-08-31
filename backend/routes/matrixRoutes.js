import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as matrixController from '../controllers/matrixController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('matrix.manage'));

// ── Static / named routes MUST come before /:id to avoid shadowing ───────────

router.get('/grid', matrixController.getMatrixGrid);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('userId').optional().custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('userId must be a valid UUID'),
    query('departmentId').optional().custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId must be a valid UUID'),
    validate,
  ],
  matrixController.getAssignments
);

router.post(
  '/user-departments',
  [
    body('userId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('userId must be a valid UUID'),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId must be a valid UUID'),
    validate,
  ],
  matrixController.assignUserToDepartment
);

router.post(
  '/department-users',
  [
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId must be a valid UUID'),
    body('userId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('userId must be a valid UUID'),
    validate,
  ],
  matrixController.assignDepartmentToUser
);

// PATCH /toggle must be before /:id
router.patch(
  '/toggle',
  [
    body('userId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('userId must be a valid UUID'),
    body('departmentId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId must be a valid UUID'),
    body('assigned').isBoolean().toBoolean(),
    validate,
  ],
  matrixController.toggleAssignment
);

// DELETE /pair/:userId/:departmentId must be before /:id
router.delete(
  '/pair/:userId/:departmentId',
  [
    idParam('userId'),
    idParam('departmentId'),
    validate,
  ],
  matrixController.deleteAssignmentByPair
);

router.post(
  '/',
  [
    body('userId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('userId must be a valid UUID'),
    body('departmentId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId must be a valid UUID'),
    validate,
  ],
  matrixController.createAssignment
);

router.get('/:id', [idParam(), validate], matrixController.getAssignmentById);
router.put('/:id', [idParam(), body('userId').optional().custom((v) => /^[0-9a-f-]{36}$/i.test(v)), body('departmentId').optional().custom((v) => /^[0-9a-f-]{36}$/i.test(v)), validate], matrixController.updateAssignment);
router.delete('/:id', [idParam(), validate], matrixController.deleteAssignment);

export default router;
