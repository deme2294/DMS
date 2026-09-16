import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRole } from '../middleware/roleMiddleware.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('dashboard.read'), dashboardController.getAdminDashboard);
router.get('/admin/analytics', authorize('dashboard.read', 'executive.analytics'), dashboardController.getAdminAnalytics);
router.get('/admin/sla', authorize('dashboard.read'), dashboardController.getAdminSlaDashboard);
router.get('/manager', requireRole('manager'), dashboardController.getManagerDashboard);
router.get('/manager/sla', requireRole('manager'), dashboardController.getManagerSlaDashboard);
router.get('/staff', requireRole('staff'), dashboardController.getStaffDashboard);
router.get('/staff/sla', requireRole('staff'), dashboardController.getStaffSlaDashboard);
router.get('/tenant', requireRole('tenant'), dashboardController.getTenantDashboard);

// ── CEO Executive Dashboard (highest privilege, role + permission gated) ──
router.get('/ceo', requireRole('ceo'), authorize('ceo.dashboard'), dashboardController.getCeoDashboard);
router.get('/ceo/analytics', requireRole('ceo', 'admin'), authorize('executive.analytics', 'dashboard.read'), dashboardController.getAdminAnalytics);
router.get('/ceo/departments', requireRole('ceo'), authorize('executive.analytics'), dashboardController.getCeoDepartmentPerformance);
router.get('/ceo/staff', requireRole('ceo'), authorize('executive.analytics'), dashboardController.getCeoStaffPerformance);
router.get('/ceo/tenants', requireRole('ceo'), authorize('executive.analytics'), dashboardController.getCeoTenantStats);
router.get('/ceo/system', requireRole('ceo'), authorize('executive.analytics'), dashboardController.getCeoSystemStats);

router.get('/tickets/stats', authorize('dashboard.read', 'tickets.read'), dashboardController.getTicketStats);
router.get('/tickets/charts', authorize('dashboard.read', 'tickets.read'), dashboardController.getTicketCharts);
router.get('/tickets/overdue', authorize('dashboard.read', 'tickets.read'), dashboardController.getOverdueTickets);

export default router;
