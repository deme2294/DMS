import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as ticketController from '../controllers/ticketController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRole } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';
import { uploadTicketAttachment } from '../config/multer.js';
import { handleUploadError } from '../middleware/uploadMiddleware.js';
import { TICKET_PRIORITIES, TICKET_STATUS } from '../config/constants.js';

const router = Router();

// Public — no auth
router.get(
  '/track/:trackNumber',
  [param('trackNumber').trim().notEmpty(), validate],
  ticketController.trackTicket
);

router.use(authenticate);

router.get('/categories', authorize('tickets.read', 'tickets.create'), ticketController.getCategories);

router.get(
  '/',
  authorize('tickets.read', 'tickets.create'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().custom((v) => !v || TICKET_STATUS.includes(v)).withMessage('Invalid status'),
    query('priority').optional().custom((v) => !v || TICKET_PRIORITIES.includes(v)).withMessage('Invalid priority'),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    validate,
  ],
  ticketController.getTickets
);

// Notifications — declared before '/:id' so they are not captured as a ticket id.
router.get('/notifications', authorize('tickets.read', 'tickets.create'), ticketController.getNotifications);
router.get('/notifications/unread-count', authorize('tickets.read', 'tickets.create'), ticketController.getUnreadCount);
router.patch('/notifications/:id/read', authorize('tickets.read', 'tickets.create'), ticketController.markNotificationRead);
router.patch('/notifications/read-all', authorize('tickets.read', 'tickets.create'), ticketController.markAllNotificationsRead);
router.delete('/notifications/:id', authorize('tickets.read', 'tickets.create'), ticketController.deleteNotification);

router.get('/:id', authorize('tickets.read', 'tickets.create'), [idParam(), validate], ticketController.getTicketById);
router.get('/:id/timeline', authorize('tickets.read', 'tickets.create'), [idParam(), validate], ticketController.getTimeline);

router.post(
  '/',
  authorize('tickets.create'),
  uploadTicketAttachment.array('attachments', 5),
  handleUploadError,
  [
    body('title').trim().isLength({ min: 3, max: 200 }),
    body('description').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('priority').optional().isIn(TICKET_PRIORITIES),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    validate,
  ],
  ticketController.createTicket
);

router.put(
  '/:id',
  authorize('tickets.read', 'tickets.assign', 'tickets.create'),
  [
    idParam(),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('description').optional().trim().notEmpty(),
    body('category').optional().trim().notEmpty(),
    body('priority').optional().isIn(TICKET_PRIORITIES),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    body('assignedTo').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    validate,
  ],
  ticketController.updateTicket
);

// Admin assigns a department manager
router.post(
  '/:id/assign-department',
  requireRole('admin'),
  [
    idParam(),
    body('departmentId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('departmentId required'),
    body('notes').optional({ nullable: true }).trim(),
    validate,
  ],
  ticketController.assignDepartment
);

// Admin / Manager assigns staff
router.post(
  '/:id/assign-staff',
  authorize('tickets.assign'),
  [
    idParam(),
    body('staffId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('staffId required'),
    body('notes').optional({ nullable: true }).trim(),
    validate,
  ],
  ticketController.assignStaff
);

// Reassign staff
router.post(
  '/:id/reassign',
  authorize('tickets.reassign'),
  [
    idParam(),
    body('staffId').custom((v) => /^[0-9a-f-]{36}$/i.test(v)).withMessage('staffId required'),
    body('notes').optional({ nullable: true }).trim(),
    validate,
  ],
  ticketController.reassignStaff
);

// Admin overrides assignment attribution (assigned_to / assigned_by)
router.patch(
  '/:id/assignment',
  requireRole('admin'),
  [
    idParam(),
    body('assignedTo').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('assignedTo must be a valid user id'),
    body('assignedBy').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)).withMessage('assignedBy must be a valid user id'),
    body('notes').optional({ nullable: true }).trim(),
    validate,
  ],
  ticketController.overrideAssignment
);

// Accept / reject assignment (manager or staff)
router.post('/:id/accept', authorize('tickets.assign', 'tickets.read'), [idParam(), validate], ticketController.acceptAssignment);
router.post(
  '/:id/reject',
  authorize('tickets.assign', 'tickets.read'),
  [idParam(), body('reason').optional({ nullable: true }).trim(), validate],
  ticketController.rejectAssignment
);

// Escalate
router.post(
  '/:id/escalate',
  authorize('tickets.escalate', 'tickets.assign'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.escalateTicket
);

// Merge duplicates
router.post(
  '/:id/merge',
  requireRole('admin'),
  [
    idParam(),
    body('sourceIds').isArray({ min: 1 }).withMessage('sourceIds required'),
    body('notes').optional({ nullable: true }).trim(),
    validate,
  ],
  ticketController.mergeTickets
);

// Close / Reopen
router.post(
  '/:id/close',
  authorize('tickets.close', 'tickets.assign'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.closeTicket
);
router.post(
  '/:id/reopen',
  authorize('tickets.reopen', 'tickets.assign'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.reopenTicket
);

// Admin approves / rejects completion, and tenant approves own resolution
router.post(
  '/:id/approve',
  authorize('tickets.approve', 'tickets.create'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.approveCompletion
);
router.post(
  '/:id/reject-completion',
  authorize('tickets.approve', 'tickets.create'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.rejectCompletion
);

// Manager marks completed
router.post(
  '/:id/complete',
  authorize('tickets.complete'),
  [idParam(), body('notes').optional({ nullable: true }).trim(), validate],
  ticketController.markCompleted
);

// Change priority / category
router.patch(
  '/:id/priority',
  authorize('tickets.change_priority', 'tickets.assign'),
  [idParam(), body('priority').isIn(TICKET_PRIORITIES), validate],
  ticketController.changePriority
);
router.patch(
  '/:id/category',
  authorize('tickets.change_category', 'tickets.assign'),
  [idParam(), body('category').trim().notEmpty(), validate],
  ticketController.changeCategory
);

// Internal note (staff/admin/manager)
router.post(
  '/:id/internal-note',
  authorize('tickets.internal_note'),
  [idParam(), body('message').trim().notEmpty(), body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)), validate],
  ticketController.addInternalNote
);

router.patch(
  '/:id/status',
  authorize('tickets.read', 'tickets.assign', 'tickets.approve', 'tickets.close', 'tickets.create'),
  [
    idParam(),
    body('status').isIn(TICKET_STATUS),
    body('notes').optional().trim(),
    body('departmentId').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    body('assignedTo').optional({ nullable: true }).custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    validate,
  ],
  ticketController.changeStatus
);

router.post(
  '/:id/attachments',
  authorize('tickets.read', 'tickets.create'),
  uploadTicketAttachment.array('attachments', 5),
  handleUploadError,
  [idParam(), validate],
  ticketController.uploadAttachments
);

router.post(
  '/:id/replies',
  authorize('tickets.read', 'tickets.create'),
  [
    idParam(),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('visibility').optional().isIn(['all', 'internal']),
    body('attachmentId').optional().custom((v) => !v || /^[0-9a-f-]{36}$/i.test(v)),
    validate,
  ],
  ticketController.addReply
);

router.get('/:id/replies', authorize('tickets.read', 'tickets.create'), [idParam(), validate], ticketController.getReplies);

router.delete('/:id', requireRole('admin'), [idParam(), validate], ticketController.deleteTicket);

export default router;
