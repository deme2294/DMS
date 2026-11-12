import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as feedbackController from '../controllers/feedbackController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';

const router = Router();

// GET /  — tenants see their own; others need feedback.read
router.get(
  '/',
  authenticate,
  (req, res, next) => {
    if (req.user?.role === 'tenant') return next();
    return authorize('feedback.read')(req, res, next);
  },
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional(),
    query('departmentId').optional(),
    validate,
  ],
  feedbackController.getFeedback
);

// POST /  — submit feedback (tenants or guests)
router.post(
  '/',
  optionalAuthenticate,
  [
    body('subject').trim().isLength({ min: 3, max: 200 }),
    body('message').trim().notEmpty(),
    body('categoryId').optional().trim(),
    body('serviceName').optional().trim(),
    body('ticketId').optional().trim(),
    body('departmentId').optional().trim(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    validate,
  ],
  feedbackController.createFeedback
);

// Detailed feedback views and updates (supports optionalAuthenticate for read endpoints)
router.get('/:id', optionalAuthenticate, [idParam(), validate], feedbackController.getFeedbackById);
router.get('/:id/replies', optionalAuthenticate, [idParam(), validate], feedbackController.getReplies);

router.put('/:id', authenticate, authorize('feedback.update'), [idParam(), validate], feedbackController.updateFeedback);
router.delete('/:id', authenticate, authorize('feedback.delete'), [idParam(), validate], feedbackController.deleteFeedback);
router.post(
  '/:id/replies',
  authenticate,
  (req, res, next) => {
    if (req.user?.role === 'tenant') return next();
    return authorize('feedback.update')(req, res, next);
  },
  [idParam(), body('message').trim().notEmpty(), validate],
  feedbackController.addReply
);
router.patch('/:id/respond', authenticate, authorize('feedback.update'), [idParam(), validate], feedbackController.respondToFeedback);
router.post('/:id/ai-response', authenticate, authorize('feedback.update'), [idParam(), validate], feedbackController.generateAiResponse);

// Department / Direct User & Staff feedback sharing assignments
router.patch(
  '/:id/assign-department',
  authenticate,
  authorize('feedback.update'),
  [
    idParam(),
    body('targetType').optional().isIn(['department', 'user']),
    body('departmentId').optional({ nullable: true }).trim(),
    body('departmentHeadId').optional({ nullable: true }).trim(),
    body('assignedToUserId').optional({ nullable: true }).trim(),
    validate,
  ],
  feedbackController.assignToDepartment
);

router.patch(
  '/:id/assign-staff',
  authenticate,
  authorize('feedback.update'),
  [
    idParam(),
    body('assignmentScope').optional({ values: 'falsy' }).isIn(['department_general', 'specific_staff']),
    body('assignedToUserId').optional({ values: 'falsy' }).trim(),
    body('assignedUserIds').optional({ values: 'falsy' }).isArray(),
    validate,
  ],
  feedbackController.assignToStaff
);

export default router;
