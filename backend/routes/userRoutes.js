import { Router } from 'express';
import { body, query } from 'express-validator';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate, idParam } from '../middleware/validationMiddleware.js';
import { uploadUserProfile } from '../config/multer.js';
import { handleUploadError } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/roles', authorize('users.read', 'users.create', 'users.update'), userController.getRoles);

router.get(
  '/',
  authorize('users.read', 'matrix.manage'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
     query('role').optional().custom((v) => !v || ['admin', 'manager', 'staff', 'tenant'].includes(v)).withMessage('Invalid role'),
     query('status').optional().custom((v) => !v || ['active', 'inactive', 'locked'].includes(v)).withMessage('Invalid status'),
     query('departmentId').optional().custom((v) => !v || /^[0-9a-zA-Z_-]{2,36}$/i.test(v)).withMessage('Invalid departmentId'),
    validate,
  ],
  userController.getUsers
);

router.post(
  '/send-email',
  [
    body('to').isEmail().normalizeEmail().withMessage('Valid recipient email address is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message body is required'),
    body('toName').optional().trim(),
    validate,
  ],
  userController.sendDirectEmail
);

router.get('/:id', authorize('users.read'), [idParam(), validate], userController.getUserById);

router.post(
  '/',
  authorize('users.create'),
  uploadUserProfile.single('profileImage'),
  handleUploadError,
  [
    body('username').trim().isLength({ min: 3, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('roleId').isInt(),
    body('status').optional().isIn(['active', 'inactive']),
    validate,
  ],
  userController.createUser
);

router.put(
  '/:id',
  authorize('users.update'),
  uploadUserProfile.single('profileImage'),
  handleUploadError,
  [
    idParam(),
    body('username').optional().trim().isLength({ min: 3, max: 80 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('roleId').optional().isInt(),
    body('status').optional().isIn(['active', 'inactive', 'locked']),
    validate,
  ],
  userController.updateUser
);

router.delete('/:id', authorize('users.delete'), [idParam(), validate], userController.deleteUser);
router.patch('/:id/activate', authorize('users.update'), [idParam(), validate], userController.activateUser);
router.patch('/:id/deactivate', authorize('users.update'), [idParam(), validate], userController.deactivateUser);

router.patch(
  '/:id/reset-password',
  authorize('users.update'),
  [idParam(), body('newPassword').isLength({ min: 8 }), validate],
  userController.resetPassword
);

export default router;
