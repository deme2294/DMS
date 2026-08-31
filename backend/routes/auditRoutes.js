import { Router } from 'express';
import { body, query } from 'express-validator';
import * as auditController from '../controllers/auditController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('audit.read'));

// GET /api/audit  — used by both /audit and /audit/logs (frontend calls /audit/logs)
router.get(
  ['/', '/logs'],
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('userId').optional().isString(),
    query('action').optional().isString(),
    query('entityType').optional().isString(),
    query('startDate').optional().isString(),
    query('endDate').optional().isString(),
    validate,
  ],
  auditController.getAuditLogs
);

router.get('/actions', auditController.getAuditActions);

router.get('/export', auditController.exportAuditLogs);

router.post('/log', body('action').notEmpty(), validate, auditController.logAction);

export default router;
