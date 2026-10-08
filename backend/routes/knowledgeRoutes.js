import { Router } from 'express';
import { param, query, body } from 'express-validator';
import * as knowledgeController from '../controllers/knowledgeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { uploadKnowledgeAttachment } from '../config/multer.js';

const router = Router();

// Public published articles (no auth required) — tenants & visitors
router.get('/public', knowledgeController.listPublicArticles);

// Contributor my articles (drafts, pending, approved, published created by staff)
router.get(
  '/my-articles',
  authenticate,
  authorize('knowledge.create', 'knowledge.read'),
  knowledgeController.getMyArticles
);

// Contributor drafts
router.get(
  '/my-drafts',
  authenticate,
  authorize('knowledge.create'),
  knowledgeController.getMyDrafts
);

// Articles awaiting manager review
router.get(
  '/pending',
  authenticate,
  authorize('knowledge.approve', 'knowledge.review'),
  knowledgeController.getPendingReview
);

// Articles needing revision
router.get(
  '/needs-revision',
  authenticate,
  authorize('knowledge.create'),
  knowledgeController.getNeedsRevision
);

// Article statistics (admin, manager, staff - scoped to role)
router.get(
  '/stats',
  authenticate,
  authorize('knowledge.view_statistics', 'knowledge.read', 'knowledge.create'),
  knowledgeController.getStats
);

// Categories (any authenticated reader)
router.get('/categories', authenticate, authorize('knowledge.read'), knowledgeController.getCategories);

// Categories CRUD (admin / authenticated readers)
router.get('/categories/all', authenticate, authorize('knowledge.read', 'knowledge.manage_categories'), knowledgeController.listCategories);
router.get('/categories/:id', authenticate, authorize('knowledge.read'), [
  param('id').isString().notEmpty(),
  validate,
], knowledgeController.getCategoryById);
router.post('/categories', authenticate, authorize('knowledge.manage_categories'), [
  body('name').notEmpty(),
  validate,
], knowledgeController.createCategory);
router.put('/categories/:id', authenticate, authorize('knowledge.manage_categories'), [
  param('id').isString().notEmpty(),
  body('name').optional().notEmpty(),
  validate,
], knowledgeController.updateCategory);
router.delete('/categories/:id', authenticate, authorize('knowledge.manage_categories'), [
  param('id').isString().notEmpty(),
  validate,
], knowledgeController.deleteCategory);

// Popular and recent published articles
router.get('/popular', authenticate, authorize('knowledge.read'), knowledgeController.getPopularArticles);
router.get('/recent', authenticate, authorize('knowledge.read'), knowledgeController.getRecentArticles);

// List / search (role-scoped in service)
router.get(
  '/',
  authenticate,
  authorize('knowledge.read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional(),
    query('status').optional(),
    query('search').optional(),
    query('authorId').optional(),
    validate,
  ],
  knowledgeController.listArticles
);

// Search endpoint
router.get(
  '/search',
  authenticate,
  authorize('knowledge.read'),
  [
    query('q').optional().isString(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate,
  ],
  knowledgeController.searchArticles
);

// Single article by ID or reference
router.get(
  '/:id',
  authenticate,
  authorize('knowledge.read'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.getArticleById
);

router.get(
  '/reference/:reference',
  authenticate,
  authorize('knowledge.read'),
  [param('reference').isString().notEmpty(), validate],
  knowledgeController.getArticleByReference
);

// Create (staff, manager, admin)
router.post(
  '/',
  authenticate,
  authorize('knowledge.create'),
  [
    body('title').notEmpty(),
    body('content').notEmpty(),
    body('category').optional(),
    validate,
  ],
  knowledgeController.createArticle
);

// Update (scoped by role in service)
router.put(
  '/:id',
  authenticate,
  authorize('knowledge.update'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.updateArticle
);

// Submit own draft for review
router.post(
  '/:id/submit',
  authenticate,
  authorize('knowledge.submit', 'knowledge.create'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.submitForReview
);

// Request revision
router.post(
  '/:id/request-revision',
  authenticate,
  authorize('knowledge.request_revision', 'knowledge.approve'),
  [param('id').isString().notEmpty(), body('reason').optional(), validate],
  knowledgeController.requestRevision
);

// Approve / reject (manager, admin)
router.post(
  '/:id/approve',
  authenticate,
  authorize('knowledge.approve'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.approveArticle
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('knowledge.reject', 'knowledge.approve'),
  [param('id').isString().notEmpty(), body('reason').notEmpty(), validate],
  knowledgeController.rejectArticle
);

// Publish (admin only)
router.post(
  '/:id/publish',
  authenticate,
  authorize('knowledge.publish'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.publishArticle
);

// Unpublish (admin only)
router.post(
  '/:id/unpublish',
  authenticate,
  authorize('knowledge.unpublish'),
  [param('id').isString().notEmpty(), body('reason').optional(), validate],
  knowledgeController.unpublishArticle
);

// Archive / restore (admin only)
router.post(
  '/:id/archive',
  authenticate,
  authorize('knowledge.archive'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.archiveArticle
);

router.post(
  '/:id/restore',
  authenticate,
  authorize('knowledge.restore', 'knowledge.archive'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.restoreArticle
);

router.post(
  '/:id/draft',
  authenticate,
  authorize('knowledge.update', 'knowledge.create'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.moveToDraft
);

router.post(
  '/:id/to-draft',
  authenticate,
  authorize('knowledge.update', 'knowledge.create'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.moveToDraft
);

// Delete (admin only)
router.delete(
  '/:id',
  authenticate,
  authorize('knowledge.delete'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.deleteArticle
);

// Rate helpfulness (tenant)
router.post(
  '/:id/feedback',
  authenticate,
  authorize('knowledge.rate'),
  [
    param('id').isString().notEmpty(),
    body('helpful').isBoolean(),
    body('reason').optional().isString(),
    body('comment').optional().isString(),
    validate,
  ],
  knowledgeController.rateArticle
);

// Versions
router.get(
  '/:id/versions',
  authenticate,
  authorize('knowledge.view_versions', 'knowledge.read'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.getVersions
);

router.get(
  '/:id/versions/:versionId',
  authenticate,
  authorize('knowledge.view_versions', 'knowledge.read'),
  [param('id').isString().notEmpty(), param('versionId').isString().notEmpty(), validate],
  knowledgeController.getVersionById
);

router.post(
  '/:id/versions/:versionId/restore',
  authenticate,
  authorize('knowledge.manage_versions', 'knowledge.restore', 'knowledge.update'),
  [param('id').isString().notEmpty(), param('versionId').isString().notEmpty(), validate],
  knowledgeController.restoreVersion
);

router.post(
  '/:id/versions',
  authenticate,
  authorize('knowledge.manage_versions', 'knowledge.create', 'knowledge.update'),
  [
    param('id').isString().notEmpty(),
    body('versionNumber').optional(),
    body('title').optional(),
    body('content').optional(),
    validate,
  ],
  knowledgeController.createVersion
);

// Attachments
router.post(
  '/:id/attachments',
  authenticate,
  authorize('knowledge.create', 'knowledge.update', 'knowledge.submit', 'knowledge.review', 'knowledge.approve', 'knowledge.request_revision', 'knowledge.publish', 'knowledge.manage', 'knowledge.read'),
  uploadKnowledgeAttachment.single('file'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.uploadAttachment
);

router.get(
  '/:id/attachments',
  authenticate,
  authorize('knowledge.read'),
  [param('id').isString().notEmpty(), validate],
  knowledgeController.getAttachments
);

router.get(
  '/attachments/:attachmentId/stream',
  authenticate,
  authorize('knowledge.read'),
  [param('attachmentId').isString().notEmpty(), validate],
  knowledgeController.streamAttachment
);

router.delete(
  '/attachments/:attachmentId',
  authenticate,
  authorize('knowledge.create', 'knowledge.update', 'knowledge.submit', 'knowledge.review', 'knowledge.approve', 'knowledge.request_revision', 'knowledge.delete', 'knowledge.manage', 'knowledge.read'),
  [param('attachmentId').isString().notEmpty(), validate],
  knowledgeController.deleteAttachment
);

export default router;
