import { Router } from 'express';
import { param, query } from 'express-validator';
import * as reportController from '../controllers/reportController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('reports.read'));

router.get('/my-departments', reportController.getMyDepartments);
router.get('/tickets', reportController.getTicketReports);
router.get('/departments', reportController.getDepartmentReports);
router.get('/staff', reportController.getStaffReports);
router.get('/tenants', reportController.getTenantReports);

router.get(
    '/:type/export',
    [param('type').isIn(['tickets', 'departments', 'staff', 'tenants', 'comprehensive', 'all']), validate],
    reportController.exportReport
);


export default router;
