import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);

// Pending category requests (admin review queue)
router.get(
    '/requests',
    requireRole('admin', 'ceo'),
    [query('status').optional(), validate],
    categoryController.listRequests
);

// All authenticated users can read active categories
router.get('/', categoryController.getCategories);
router.get('/:id', [param('id').trim().notEmpty().isLength({ min: 1, max: 64 }), validate], categoryController.getCategoryById);

// Admin and manager can create / update categories
router.post(
    '/',
    requireRole('admin', 'manager', 'ceo'),
    [
        body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
        body('description').optional({ nullable: true }).trim(),
        body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-z-]{36}$/i.test(v)),
        body('slaPolicyId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-z-]{36}$/i.test(v)),
        body('routingType').optional().isIn(['general', 'direct']).withMessage('routingType must be general or direct'),
        body('departmentId').if((value, { req }) => req.body.routingType === 'direct').notEmpty().withMessage('Direct-routing categories require a department'),
        validate,
    ],
    categoryController.createCategory
);

router.put(
    '/:id',
    requireRole('admin', 'manager', 'ceo'),
    [
        param('id').trim().notEmpty().isLength({ min: 1, max: 64 }),
        body('name').optional().trim().isLength({ min: 2, max: 100 }),
        body('description').optional({ nullable: true }).trim(),
        body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-z-]{36}$/i.test(v)),
        body('slaPolicyId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-z-]{36}$/i.test(v)),
        body('routingType').optional().isIn(['general', 'direct']).withMessage('routingType must be general or direct'),
        body('departmentId').if((value, { req }) => req.body.routingType === 'direct').notEmpty().withMessage('Direct-routing categories require a department'),
        body('isActive').optional().isBoolean(),
        validate,
    ],
    categoryController.updateCategory
);

// Admin approves / rejects a manager-submitted category request
router.post(
    '/:id/approve',
    requireRole('admin', 'ceo'),
    [
        param('id').trim().notEmpty().isLength({ min: 1, max: 64 }),
        body('reviewNotes').optional({ nullable: true }).trim(),
        validate,
    ],
    categoryController.approveCategory
);

router.post(
    '/:id/reject',
    requireRole('admin', 'ceo'),
    [
        param('id').trim().notEmpty().isLength({ min: 1, max: 64 }),
        body('reviewNotes').optional({ nullable: true }).trim(),
        validate,
    ],
    categoryController.rejectCategory
);

// Only admin can delete
router.delete(
    '/:id',
    requireRole('admin', 'ceo'),
    [param('id').trim().notEmpty().isLength({ min: 1, max: 64 }), validate],
    categoryController.deleteCategory
);

export default router;
