import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { uploadUserProfile } from '../config/multer.js';
import { handleUploadError } from '../middleware/uploadMiddleware.js';

const router = Router();

router.post(
  '/login',
  [
    body('identifier').custom((value, { req }) => {
      const id = value || req.body?.username || req.body?.email;
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new Error('Identifier, username, or email is required');
      }
      return true;
    }),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login
);

router.post('/refresh', authController.refreshToken);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

router.patch(
  '/me/profile',
  authenticate,
  uploadUserProfile.single('profileImage'),
  handleUploadError,
  [
    body('username').optional().trim().isLength({ min: 3, max: 80 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('currentPassword').optional().notEmpty(),
    body('newPassword').optional().isLength({ min: 8 }),
    body('confirmPassword').optional().notEmpty(),
    validate,
  ],
  authController.updateMyProfile
);

router.patch(
  '/me/theme',
  authenticate,
  [
    body('themePreference').isIn(['system', 'light', 'dark']).withMessage('Invalid theme preference'),
    validate,
  ],
  authController.updateMyTheme
);

export default router;
