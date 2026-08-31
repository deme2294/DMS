import * as reportService from '../services/reportService.js';
import pool from '../config/db.js';
import { HTTP } from '../config/constants.js';

// ── Manager: fetch own assigned departments ───────────────────────────────────
export const getMyDepartments = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.code
       FROM departments d
       JOIN user_departments ud ON ud.department_id = d.id
       WHERE ud.user_id = ? AND d.status = 'active'
       ORDER BY d.name ASC`,
      [req.user.id]
    );
    res.status(HTTP.OK).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getTicketReports = async (req, res, next) => {
  try {
    const raw = await reportService.getTicketReports(req.query, req.user);
    const data = {
      totalTickets: Number(raw.stats.total_tickets || 0),
      resolved: Number(raw.stats.resolved || 0),
      closed: Number(raw.stats.closed || 0),
      inProgress: Number(raw.stats.in_progress || 0),
      pending: Number(raw.stats.pending || 0),
      avgResolutionHours: Number(raw.stats.avg_resolve_hours || 0),
      statusCounts: Object.fromEntries((raw.byStatus || []).map((s) => [s.status, Number(s.count)])),
      priorityCounts: Object.fromEntries((raw.byPriority || []).map((p) => [p.priority, Number(p.count)])),
      categoryCounts: Object.fromEntries((raw.byCategory || []).map((c) => [c.category, Number(c.count)])),
      monthlyTrend: (raw.monthlyTrend || []).map((m) => ({ month: m.month, count: Number(m.count) })),
      resolutionTimeByPriority: (raw.resolutionByPriority || []).map((r) => ({
        priority: r.priority,
        avgHours: Number(r.avg_resolve_hours || 0),
        count: Number(r.resolved_count || 0),
      })),
      resolutionTimeByStatus: (raw.resolutionByStatus || []).map((r) => ({
        status: r.status,
        avgHours: Number(r.avg_resolve_hours || 0),
        count: Number(r.resolved_count || 0),
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentReports = async (req, res, next) => {
  try {
    const rows = await reportService.getDepartmentReports(req.query, req.user);
    const data = {
      totalDepartments: rows.length,
      activeDepartments: rows.filter((r) => r.status === 'active').length,
      departmentPerformance: rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        totalTickets: Number(r.total_tickets || 0),
        openTickets: Number(r.open_tickets || 0),
        resolvedTickets: Number(r.resolved || 0),
        closedTickets: Number(r.closed || 0),
        inProgressTickets: Number(r.in_progress || 0),
        avgResolutionTime: Number(r.avg_resolve_hours || 0),
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getStaffReports = async (req, res, next) => {
  try {
    const rows = await reportService.getStaffReports(req.query, req.user);
    const data = {
      totalStaff: rows.length,
      activeStaff: rows.filter((r) => r.status === 'active').length,
      staffPerformance: rows.map((r) => ({
        id: String(r.id),
        name: `${r.first_name} ${r.last_name}`,
        ticketCount: Number(r.total_assigned || 0),
        resolvedCount: Number(r.resolved || 0),
        inProgressCount: Number(r.in_progress || 0),
        avgRating: undefined,
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTenantReports = async (req, res, next) => {
  try {
    const rows = await reportService.getTenantReports(req.query, req.user);
    const data = {
      totalTenants: rows.length,
      activeTenants: rows.filter((r) => r.status === 'active').length,
      tenantActivity: rows.map((r) => ({
        id: String(r.tenant_id),
        organizationName: r.organization_name,
        ticketCount: Number(r.total_tickets || 0),
        userCount: 0,
      })),
    };
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ── CSV export helpers ────────────────────────────────────────────────────────

const toCsv = (headers, rows) => {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\r\n');
};

export const exportReport = async (req, res, next) => {
  try {
    const { type } = req.params;

    let csv = '';
    let filename = `report-${type}.csv`;

    if (type === 'tickets') {
      const raw = await reportService.getTicketReports(req.query, req.user);
      const rows = (raw.byStatus || []).map((s) => ({ status: s.status, count: Number(s.count) }));
      csv = toCsv(['status', 'count'], rows);
      filename = 'report-tickets.csv';
    } else if (type === 'departments') {
      const rows = await reportService.getDepartmentReports(req.query, req.user);
      csv = toCsv(['id', 'name', 'total_tickets', 'avg_resolve_hours'], rows);
      filename = 'report-departments.csv';
    } else if (type === 'staff') {
      const rows = await reportService.getStaffReports(req.query, req.user);
      csv = toCsv(['id', 'first_name', 'last_name', 'email', 'total_assigned', 'resolved'], rows);
      filename = 'report-staff.csv';
    } else if (type === 'tenants') {
      const rows = await reportService.getTenantReports(req.query, req.user);
      csv = toCsv(['tenant_id', 'organization_name', 'total_tickets', 'resolved', 'closed'], rows);
      filename = 'report-tenants.csv';
    } else {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Invalid report type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
