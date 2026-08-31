import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as feedbackController from '../controllers/feedbackController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);

// GET /  — tenants see their own; others need feedback.read
router.get(
  '/',
  (req, res, next) => {
    if (req.user?.role === 'tenant') return next();
    return authorize('feedback.read')(req, res, next);
  },
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional(),
    validate,
  ],
  feedbackController.getFeedback
);

// POST /  — tenants submit feedback
router.post(
  '/',
  [
    body('subject').trim().isLength({ min: 3, max: 200 }),
    body('message').trim().notEmpty(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    validate,
  ],
  feedbackController.createFeedback
);

// Admin/staff manage feedback
router.get('/:id', [idParam(), validate], feedbackController.getFeedbackById);
router.put('/:id', authorize('feedback.update'), [idParam(), validate], feedbackController.updateFeedback);
router.delete('/:id', authorize('feedback.delete'), [idParam(), validate], feedbackController.deleteFeedback);
router.get('/:id/replies', [idParam(), validate], feedbackController.getReplies);
router.post('/:id/replies', authorize('feedback.update'), [idParam(), body('message').trim().notEmpty(), validate], feedbackController.addReply);
router.patch('/:id/respond', authorize('feedback.update'), [idParam(), validate], feedbackController.respondToFeedback);

export default router;
