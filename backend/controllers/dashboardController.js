import * as dashboardRepo from '../repository/dashboardRepository.js';
import pool from '../config/db.js';
import { HTTP } from '../config/constants.js';
import * as departmentService from '../services/departmentService.js';

export const getAdminDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getAdminDashboard();
    const data = {
      stats: {
        totalUsers: Number(raw.users.total_users || 0),
        activeUsers: Number(raw.users.active_users || 0),
        inactiveUsers: Number(raw.users.inactive_users || 0),
        totalTenants: Number(raw.tenants.total_tenants || 0),
        activeTenants: Number(raw.tenants.active_tenants || 0),
        inactiveTenants: Number(raw.tenants.inactive_tenants || 0),
        totalTickets: Number(raw.tickets.total_tickets || 0),
        openTickets: Number(raw.tickets.pending_tickets || 0),
        inProgressTickets: Number(raw.tickets.in_progress_tickets || 0),
        resolvedTickets: Number(raw.tickets.resolved_tickets || 0),
         totalDepartments: Number(raw.departments.total_departments || 0),
         totalFeedback: Number(raw.feedback.total_feedback || 0),
         pendingFeedback: Number(raw.feedback.pending_feedback || 0),
         readFeedback: Number(raw.feedback.read_feedback || 0),
         resolvedFeedback: Number(raw.feedback.resolved_feedback || 0),
      },
      recentTickets: raw.recentTickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        tenantName: t.tenant_name,
        departmentName: null,
        referenceNumber: t.reference_number,
      })),
      recentUsers: [],
      monthlyTickets: raw.monthlyTickets,
      statusBreakdown: raw.statusBreakdown,
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getManagerDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getManagerDashboard(req.user.id);
    const departmentIds = await departmentService.getMyDepartmentIds(req.user.id);

    const data = {
      stats: {
        departmentTickets: Number(raw.departmentTickets.total || 0),
        openTickets: Number(raw.assignedTickets.total_assigned || 0),
        resolvedTickets: Number(raw.assignedTickets.resolved || 0),
        inProgressTickets: Number(raw.assignedTickets.in_progress || 0),
        pendingApproval: Number(raw.assignedTickets.pending || 0),
      },
      department: departmentIds.length ? {
        id: departmentIds[0],
        name: raw.departmentName || 'Your Department',
        userCount: Number(raw.departmentUserCount || 0),
      } : null,
      recentTickets: raw.recentTickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        departmentName: null,
        referenceNumber: null,
        assignedToName: t.assigned_to_name,
      })),
      staffPerformance: raw.staffPerformance,
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getStaffDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getStaffDashboard(req.user.id);
    const data = {
      stats: {
        assignedTickets: Number(raw.assignedTickets.total_assigned || 0),
        openTickets: Number(raw.assignedTickets.new_assigned || 0),
        inProgressTickets: Number(raw.assignedTickets.in_progress || 0),
        resolvedToday: Number(raw.todayTickets.today_count || 0),
        resolvedTickets: Number(raw.assignedTickets.resolved || 0),
      },
      assignedTickets: raw.recentTickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        tenantName: t.tenant_name,
        departmentName: null,
        referenceNumber: null,
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTicketStats = async (req, res, next) => {
  try {
    const data = await dashboardRepo.getTicketStatistics(req.user);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTicketCharts = async (req, res, next) => {
  try {
    const data = await dashboardRepo.getTicketCharts(req.user);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getOverdueTickets = async (req, res, next) => {
  try {
    const data = await dashboardRepo.getOverdueTickets(req.user, Number(req.query.limit || 50));
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAdminSlaDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getAdminSlaDashboard();
    const data = {
      stats: {
        ticketsWithinSla: Number(raw.withinSla || 0),
        ticketsApproachingDeadline: Number(raw.approaching || 0),
        overdueTickets: Number(raw.overdue || 0),
        completedWithinSla: Number(raw.completedWithinSla || 0),
        completedAfterSla: Number(raw.completedAfterSla || 0),
        avgResolutionHours: Number(raw.avgResolutionHours || 0).toFixed(1),
        slaCompliancePercentage: Number(raw.slaCompliance || 0).toFixed(1),
      },
      recentBreaches: raw.recentBreaches || [],
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getManagerSlaDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getManagerSlaDashboard(req.user.id);
    const data = {
      stats: {
        departmentSlaPerformance: raw.departmentSlaPerformance || {},
        teamSlaPerformance: raw.teamSlaPerformance || [],
        overdueTickets: Number(raw.overdueTickets || 0),
        ticketsNearDeadline: Number(raw.ticketsNearDeadline || 0),
      },
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getStaffSlaDashboard = async (req, res, next) => {
  try {
    const raw = await dashboardRepo.getStaffSlaDashboard(req.user.id);
    const data = {
      stats: {
        assignedTickets: Number(raw.assignedTickets || 0),
        overdueTickets: Number(raw.overdueTickets || 0),
        upcomingDeadlines: Number(raw.upcomingDeadlines || 0),
      },
      assignedTickets: (raw.assignedTicketsList || []).map((t) => ({
        id: t.id,
        referenceNumber: t.reference_number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        assignedDate: t.created_at,
        responseDue: t.response_due_date,
        resolutionDue: t.due_date,
        remainingTime: t.remaining_time || null,
        slaStatus: t.sla_status || 'on_track',
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTenantDashboard = async (req, res, next) => {
  try {
    // tenant_id comes from req.user (set by authMiddleware)
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'No tenant account linked to this user' });
    }
    const raw = await dashboardRepo.getTenantDashboard(tenantId);
    const data = {
      stats: {
        totalTickets: Number(raw.myTickets.total_tickets || 0),
        openTickets: Number(raw.myTickets.open_tickets || 0),
        inProgressTickets: Number(raw.myTickets.in_progress_tickets || 0),
        resolvedTickets: Number(raw.myTickets.resolved_tickets || 0),
        closedTickets: Number(raw.myTickets.closed_tickets || 0),
        overdueTickets: Number(raw.slaStats?.overdue || 0),
        upcomingDeadlines: Number(raw.slaStats?.nearDeadline || 0),
      },
      recentTickets: raw.recentTickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        referenceNumber: t.reference_number,
        trackNumber: t.track_number,
        departmentName: null,
      })),
      pendingFeedback: raw.pendingFeedback,
      activeNotices: raw.activeNotices,
      availableOffices: raw.availableOffices.map((o) => ({
        id: o.id,
        employeeName: o.employee_name,
        building: o.building,
        officeNumber: o.office_number,
        floor: o.floor,
        address: o.address,
        latitude: o.latitude,
        longitude: o.longitude,
        availabilityStatus: o.availability_status,
        pricePerMonth: o.price_per_month,
      })),
      myBookings: raw.myBookings.map((b) => ({
        id: b.id,
        officeLocationId: b.office_location_id,
        officeName: b.employee_name,
        building: b.building,
        officeNumber: b.office_number,
        floor: b.floor,
        purpose: b.purpose,
        startDate: b.start_date,
        endDate: b.end_date,
        status: b.status,
        notes: b.notes,
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ── CEO Executive Dashboard ──
export const getCeoDashboard = async (_req, res, next) => {
  try {
    const raw = await dashboardRepo.getCeoDashboard();
    const data = {
      stats: {
        totalTenants: Number(raw.tenants.total_tenants || 0),
        totalUsers: Number(raw.users.total_users || 0),
        totalDepartments: Number(raw.departments.total_departments || 0),
        totalStaff: Number(raw.users.total_staff || 0),
        totalDepartmentManagers: Number(raw.users.total_managers || 0),
        totalGeneralManagers: Number(raw.users.total_admins || 0),
        totalAdmins: Number(raw.users.total_admins || 0),
        activeUsers: Number(raw.users.active_users || 0),
        inactiveUsers: Number(raw.users.inactive_users || 0),
        totalTickets: Number(raw.tickets.total_tickets || 0),
        openTickets: Number(raw.tickets.open_tickets || 0),
        pendingTickets: Number(raw.tickets.pending_tickets || 0),
        inProgressTickets: Number(raw.tickets.in_progress_tickets || 0),
        resolvedTickets: Number(raw.tickets.resolved_tickets || 0),
        closedTickets: Number(raw.tickets.closed_tickets || 0),
        overdueTickets: Number(raw.overdue.count || 0),
        knowledgeArticles: Number(raw.knowledge.total_articles || 0),
        feedbackReceived: Number(raw.feedback.total_feedback || 0),
        noticesPublished: Number(raw.notices.total_notices || 0),
        escalatedTickets: Number(raw.escalated.count || 0),
        withinSla: Number(raw.withinSla?.count || 0),
        nearDeadline: Number(raw.nearDeadline?.count || 0),
      },
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCeoDepartmentPerformance = async (_req, res, next) => {
  try {
    const data = await dashboardRepo.getCeoDepartmentPerformance();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCeoStaffPerformance = async (_req, res, next) => {
  try {
    const data = await dashboardRepo.getCeoStaffPerformance();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCeoTenantStats = async (_req, res, next) => {
  try {
    const data = await dashboardRepo.getCeoTenantStats();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCeoSystemStats = async (_req, res, next) => {
  try {
    const data = await dashboardRepo.getCeoSystemStats();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAdminAnalytics = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || '6m';
    const departmentId = req.query.departmentId || null;
    const data = await dashboardRepo.getAdminAnalytics({ timeframe, departmentId, user: req.user });
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

