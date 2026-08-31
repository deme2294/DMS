import { Router } from 'express';
import { body, query } from 'express-validator';
import * as noticeController from '../controllers/noticeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, idParam, uuidBody } from '../middleware/validationMiddleware.js';

const router = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
router.get('/public', noticeController.getPublicNotices);
router.get('/categories', noticeController.getNoticeCategories);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED NOTICE ROUTES FOR STAFF & MANAGER
// ══════════════════════════════════════════════════════════════════════════════

// Get notices for current user (staff/manager) - filtered by role and department
router.get(
  '/my/inbox',
  authorize('notices.read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  noticeController.getMyNotices
);

// Get notices created by current user (manager's created notices)
router.get(
  '/my/created',
  authorize('notices.create'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  noticeController.getMyCreatedNotices
);

// Get staff in manager's own department (no department ID needed)
router.get(
  '/department/staff',
  authorize('notices.read'), // Changed from notices.create to notices.read
  noticeController.getDepartmentStaff
);

// Get departments managed by the current user
router.get(
  '/my/departments',
  authorize('notices.read'),
  noticeController.getMyDepartments
);

// Get staff in specific department (with department ID)
router.get(
  '/department/:departmentId/staff',
  authorize('notices.create'),
  noticeController.getDepartmentStaff
);

// Get assignable notices (admin notices that manager can forward to staff)
router.get(
  '/assignable',
  authorize('notices.read'), // Changed from notices.create to notices.read
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  noticeController.getAssignableNotices
);

// Create targeted notice (admin/manager)
router.post(
  '/targeted',
  authorize('notices.create'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional(),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('targetAudience').optional().isIn(['all', 'admin', 'manager', 'staff', 'tenant', 'department']),
    uuidBody('departmentId'),
    uuidBody('assignedTo'),
    validate,
  ],
  noticeController.createTargetedNotice
);

// Update targeted notice
router.put(
  '/targeted/:id',
  authorize('notices.update'),
  [
    idParam(),
    body('title').optional().trim().notEmpty(),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    validate,
  ],
  noticeController.updateTargetedNotice
);

// Assign notice to staff member (manager action)
router.post(
  '/:id/assign',
  authorize('notices.create'),
  [
    idParam(),
    body('staffUserId').trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Staff user ID is required'),
    validate,
  ],
  noticeController.assignNoticeToStaff
);

// Get notice with full details (creator, assignment info)
router.get(
  '/:id/details',
  authorize('notices.read'),
  [idParam(), validate],
  noticeController.getNoticeWithDetails
);

// ══════════════════════════════════════════════════════════════════════════════
// NOTICE REPLIES
// ══════════════════════════════════════════════════════════════════════════════

// Get replies for a notice
router.get(
  '/:id/replies',
  authorize('notices.read'),
  [idParam(), validate],
  noticeController.getNoticeReplies
);

// Create a reply to a notice
router.post(
  '/:id/replies',
  authorize('notices.read'),
  [
    idParam(),
    body('message').trim().notEmpty().withMessage('Reply message is required'),
    body('visibility').optional().isIn(['all', 'internal']),
    validate,
  ],
  noticeController.createNoticeReply
);

// Update a notice reply
router.put(
  '/replies/:id',
  authorize('notices.read'),
  [
    idParam(),
    body('message').optional().trim().notEmpty(),
    body('visibility').optional().isIn(['all', 'internal']),
    validate,
  ],
  noticeController.updateNoticeReply
);

// Delete a notice reply
router.delete(
  '/replies/:id',
  authorize('notices.read'),
  [idParam(), validate],
  noticeController.deleteNoticeReply
);

// ══════════════════════════════════════════════════════════════════════════════
// STANDARD NOTICE ROUTES (Admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get(
  '/',
  authorize('notices.read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  noticeController.getNotices
);

router.get('/me/acknowledgements', authorize('notices.read'), noticeController.getMyAcknowledged);

router.get('/:id', authorize('notices.read'), noticeController.getNoticeById);
router.post('/', authorize('notices.create'), noticeController.createNotice);
router.put('/:id', authorize('notices.update'), noticeController.updateNotice);
router.delete('/:id', authorize('notices.delete'), noticeController.deleteNotice);

// Recipient acknowledgement + admin oversight (authenticated)
router.post('/:id/acknowledge', authorize('notices.read'), noticeController.acknowledgeNotice);
router.get('/:id/recipients', authorize('notices.read'), noticeController.getNoticeRecipients);
router.get('/:id/recipients/counts', authorize('notices.read'), noticeController.getNoticeRecipientCounts);

// Manual trigger for the expiry/warning job (admin convenience)
router.post('/process-expirations', authorize('notices.manage'), noticeController.processExpirations);

export default router;
