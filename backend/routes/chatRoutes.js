import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as chatController from '../controllers/chatController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';
import { uploadChatAttachment } from '../config/multer.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===================== ROOMS =====================

// Get all rooms for current user
router.get(
  '/rooms',
  chatController.getUserRooms
);

// Get room by ID
router.get(
  '/rooms/:roomId',
  [param('roomId').isUUID(), validate],
  chatController.getRoomById
);

// Create ticket room
router.post(
  '/rooms/ticket',
  [
    body('ticketId').trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('ticketId must be a valid UUID'),
    body('name').optional().trim(),
    validate
  ],
  chatController.createTicketRoom
);

// Create department room
router.post(
  '/rooms/department',
  [
    body('departmentId').trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('departmentId must be a valid UUID'),
    body('name').optional().trim(),
    validate
  ],
  chatController.createDepartmentRoom
);

// Create direct message room
router.post(
  '/rooms/direct',
  [
    body('userId').trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('userId must be a valid UUID'),
    body('name').optional().trim(),
    validate
  ],
  chatController.createDirectRoom
);

// Get room participants
router.get(
  '/rooms/:roomId/participants',
  [param('roomId').isUUID(), validate],
  chatController.getRoomParticipants
);

// Add participant to room
router.post(
  '/rooms/:roomId/participants',
  [
    param('roomId').isUUID(),
    body('userId').isUUID(),
    validate
  ],
  chatController.addParticipant
);

// ===================== MESSAGES =====================

// Get messages in a room
router.get(
  '/rooms/:roomId/messages',
  [
    param('roomId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validate
  ],
  chatController.getRoomMessages
);

// Send message
router.post(
  '/messages',
  [
    body('roomId').isUUID(),
    body('message').trim().notEmpty(),
    body('messageType').optional().isIn(['text', 'image', 'file']),
    validate
  ],
  chatController.sendMessage
);

// Edit message
router.put(
  '/messages/:messageId',
  [
    param('messageId').isUUID(),
    body('message').trim().notEmpty(),
    validate
  ],
  chatController.editMessage
);

// Delete message
router.delete(
  '/messages/:messageId',
  [param('messageId').isUUID(), validate],
  chatController.deleteMessage
);

// Mark messages as read
router.post(
  '/rooms/:roomId/read',
  [
    param('roomId').isUUID(),
    body('messageIds').optional().isArray(),
    validate
  ],
  chatController.markAsRead
);

// Get unread count
router.get(
  '/unread',
  chatController.getUnreadCount
);

// ===================== SEARCH =====================

// Search messages
router.get(
  '/search',
  [query('q').trim().notEmpty(), validate],
  chatController.searchMessages
);

// ===================== UPLOAD =====================

// Upload attachment
router.post(
  '/upload',
  uploadChatAttachment.single('file'),
  chatController.uploadAttachment
);

// ===================== ONLINE STATUS =====================

// Get user online status
router.get(
  '/online-status/:userId',
  [param('userId').isUUID(), validate],
  chatController.getUserOnlineStatus
);

// Get all online users
router.get(
  '/online-users',
  chatController.getOnlineUsers
);

// Get users available for chat (based on role permissions)
router.get(
  '/users',
  chatController.getChatUsers
);

// Get departments available for chat (based on role permissions)
router.get(
  '/departments',
  chatController.getChatDepartments
);

// Get members of a department with online status for chat
router.get(
  '/departments/:departmentId/members',
  [param('departmentId').isUUID(), validate],
  chatController.getDepartmentChatMembers
);

// Get members of a ticket with online status for chat
router.get(
  '/tickets/:ticketId/members',
  [param('ticketId').isUUID(), validate],
  chatController.getTicketChatMembers
);

export default router;
