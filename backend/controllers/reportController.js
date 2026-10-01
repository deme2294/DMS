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
    const hasFilter = Boolean(req.query.startDate || req.query.endDate || req.query.departmentId);
    const data = {
      totalDepartments: rows.length,
      activeDepartments: hasFilter
        ? rows.filter((r) => Number(r.total_tickets || 0) > 0).length
        : rows.filter((r) => r.status === 'active').length,
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
    const hasFilter = Boolean(req.query.startDate || req.query.endDate || req.query.departmentId);
    const data = {
      totalStaff: rows.length,
      activeStaff: hasFilter
        ? rows.filter((r) => Number(r.total_assigned || 0) > 0).length
        : rows.filter((r) => r.status === 'active').length,
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
    const hasFilter = Boolean(req.query.startDate || req.query.endDate || req.query.tenantId || req.query.departmentId);
    const data = {
      totalTenants: rows.length,
      activeTenants: hasFilter
        ? rows.filter((r) => Number(r.total_tickets || 0) > 0).length
        : rows.filter((r) => r.status === 'active').length,
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

const toCsv = (headers, rows) => {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    if (Array.isArray(row)) {
      lines.push(row.map(escape).join(','));
    } else {
      lines.push(headers.map((h) => escape(row[h])).join(','));
    }
  }
  return lines.join('\r\n');
};

export const exportReport = async (req, res, next) => {
  try {
    const { type } = req.params;

    let csv = '';
    let filename = `report-${type}.csv`;

    if (type === 'tickets') {
      const raw = await reportService.getTicketReports(req.query, req.user);
      const total = Number(raw.stats?.total_tickets || 0);
      const resolved = Number(raw.stats?.resolved || 0) + Number(raw.stats?.closed || 0);
      const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      const lines = [];
      lines.push('=== TICKET REPORT SUMMARY ===');
      lines.push(`Total Tickets,${total}`);
      lines.push(`Resolved Tickets,${Number(raw.stats?.resolved || 0)}`);
      lines.push(`Closed Tickets,${Number(raw.stats?.closed || 0)}`);
      lines.push(`In Progress Tickets,${Number(raw.stats?.in_progress || 0)}`);
      lines.push(`Pending/Submitted Tickets,${Number(raw.stats?.pending || 0)}`);
      lines.push(`Resolution Rate,${resRate}%`);
      lines.push(`Avg Resolution Hours,${Number(raw.stats?.avg_resolve_hours || 0).toFixed(1)}`);
      lines.push('');

      lines.push('=== STATUS DISTRIBUTION ===');
      lines.push('Status,Count,Percentage Share (%)');
      (raw.byStatus || []).forEach((s) => {
        const count = Number(s.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${s.status}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== PRIORITY DISTRIBUTION ===');
      lines.push('Priority,Count,Percentage Share (%)');
      (raw.byPriority || []).forEach((p) => {
        const count = Number(p.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${p.priority}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== CATEGORY BREAKDOWN ===');
      lines.push('Category,Ticket Count,Percentage Share (%)');
      (raw.byCategory || []).forEach((c) => {
        const count = Number(c.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${c.category}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== MONTHLY INFLOW TREND (GRAPH DATA) ===');
      lines.push('Month,Ticket Count');
      (raw.monthlyTrend || []).forEach((m) => {
        lines.push(`"${m.month}",${Number(m.count)}`);
      });
      lines.push('');

      lines.push('=== RESOLUTION VELOCITY BY PRIORITY ===');
      lines.push('Priority,Resolved Count,Avg Resolution Hours');
      (raw.resolutionByPriority || []).forEach((r) => {
        lines.push(`"${r.priority}",${Number(r.resolved_count || 0)},${Number(r.avg_resolve_hours || 0).toFixed(1)}`);
      });

      csv = lines.join('\r\n');
      filename = 'report-tickets.csv';
    } else if (type === 'departments') {
      const rows = await reportService.getDepartmentReports(req.query, req.user);
      const formatted = rows.map((d) => {
        const total = Number(d.total_tickets || 0);
        const resolved = Number(d.resolved || 0) + Number(d.closed || 0);
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        return {
          'Department ID': d.id,
          'Department Name': d.name,
          'Department Code': d.code || 'N/A',
          'Total Tickets': total,
          'Open / Pending': Number(d.open_tickets || 0),
          'In Progress': Number(d.in_progress || 0),
          'Resolved': Number(d.resolved || 0),
          'Closed': Number(d.closed || 0),
          'Resolution Rate (%)': `${rate}%`,
          'Avg Resolution (Hours)': Number(d.avg_resolve_hours || 0).toFixed(1),
        };
      });
      csv = toCsv(
        ['Department ID', 'Department Name', 'Department Code', 'Total Tickets', 'Open / Pending', 'In Progress', 'Resolved', 'Closed', 'Resolution Rate (%)', 'Avg Resolution (Hours)'],
        formatted
      );
      filename = 'report-departments.csv';
    } else if (type === 'staff') {
      const rows = await reportService.getStaffReports(req.query, req.user);
      const formatted = rows.map((s) => {
        const total = Number(s.total_assigned || 0);
        const resolved = Number(s.resolved || 0);
        const inProgress = Number(s.in_progress || 0);
        const pending = Math.max(0, total - resolved);
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        return {
          'Staff ID': s.id,
          'First Name': s.first_name,
          'Last Name': s.last_name,
          'Full Name': `${s.first_name} ${s.last_name}`,
          'Username': s.username || 'N/A',
          'Email': s.email,
          'Account Status': s.status || 'active',
          'Total Assigned Tickets': total,
          'In Progress Tickets': inProgress,
          'Resolved Tickets': resolved,
          'Pending Workload': pending,
          'Resolution Rate (%)': `${rate}%`,
        };
      });
      csv = toCsv(
        ['Staff ID', 'First Name', 'Last Name', 'Full Name', 'Username', 'Email', 'Account Status', 'Total Assigned Tickets', 'In Progress Tickets', 'Resolved Tickets', 'Pending Workload', 'Resolution Rate (%)'],
        formatted
      );
      filename = 'report-staff.csv';
    } else if (type === 'tenants') {
      const rows = await reportService.getTenantReports(req.query, req.user);
      const formatted = rows.map((t) => {
        const total = Number(t.total_tickets || 0);
        const resolved = Number(t.resolved || 0) + Number(t.closed || 0);
        const active = Math.max(0, total - resolved);
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        return {
          'Tenant ID': t.tenant_id,
          'Organization Name': t.organization_name,
          'Email': t.email || 'N/A',
          'Total Tickets': total,
          'Resolved Tickets': Number(t.resolved || 0),
          'Closed Tickets': Number(t.closed || 0),
          'Active Tickets': active,
          'Resolution Rate (%)': `${rate}%`,
        };
      });
      csv = toCsv(
        ['Tenant ID', 'Organization Name', 'Email', 'Total Tickets', 'Resolved Tickets', 'Closed Tickets', 'Active Tickets', 'Resolution Rate (%)'],
        formatted
      );
      filename = 'report-tenants.csv';
    } else if (type === 'comprehensive' || type === 'all') {
      const [rawTickets, rawDepts, rawStaff, rawTenants] = await Promise.all([
        reportService.getTicketReports(req.query, req.user),
        reportService.getDepartmentReports(req.query, req.user),
        reportService.getStaffReports(req.query, req.user),
        reportService.getTenantReports(req.query, req.user),
      ]);

      const total = Number(rawTickets.stats?.total_tickets || 0);
      const resolved = Number(rawTickets.stats?.resolved || 0) + Number(rawTickets.stats?.closed || 0);
      const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      const lines = [];
      lines.push('================================================================');
      lines.push('HELP DESK MANAGEMENT SYSTEM - COMPREHENSIVE ANALYTICS REPORT');
      lines.push(`Generated At,${new Date().toISOString()}`);
      lines.push('================================================================');
      lines.push('');

      lines.push('=== 1. EXECUTIVE KPI SUMMARY ===');
      lines.push('Metric,Value');
      lines.push(`Total Tickets,${total}`);
      lines.push(`Resolved Tickets,${Number(rawTickets.stats?.resolved || 0)}`);
      lines.push(`Closed Tickets,${Number(rawTickets.stats?.closed || 0)}`);
      lines.push(`In Progress Tickets,${Number(rawTickets.stats?.in_progress || 0)}`);
      lines.push(`Pending/Submitted Tickets,${Number(rawTickets.stats?.pending || 0)}`);
      lines.push(`Resolution Rate,${resRate}%`);
      lines.push(`Avg Resolution Turnaround (Hours),${Number(rawTickets.stats?.avg_resolve_hours || 0).toFixed(1)}`);
      lines.push('');

      lines.push('=== 2. TICKET STATUS BREAKDOWN ===');
      lines.push('Status,Count,Share (%)');
      (rawTickets.byStatus || []).forEach((s) => {
        const count = Number(s.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${s.status}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== 3. TICKET PRIORITY BREAKDOWN ===');
      lines.push('Priority,Count,Share (%)');
      (rawTickets.byPriority || []).forEach((p) => {
        const count = Number(p.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${p.priority}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== 4. TICKET CATEGORY BREAKDOWN ===');
      lines.push('Category,Ticket Count,Share (%)');
      (rawTickets.byCategory || []).forEach((c) => {
        const count = Number(c.count);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`"${c.category}",${count},${pct}%`);
      });
      lines.push('');

      lines.push('=== 5. MONTHLY INFLOW TREND (GRAPH DATA) ===');
      lines.push('Month,Ticket Count');
      (rawTickets.monthlyTrend || []).forEach((m) => {
        lines.push(`"${m.month}",${Number(m.count)}`);
      });
      lines.push('');

      lines.push('=== 6. RESOLUTION VELOCITY BY PRIORITY ===');
      lines.push('Priority,Resolved Count,Avg Resolution Hours');
      (rawTickets.resolutionByPriority || []).forEach((r) => {
        lines.push(`"${r.priority}",${Number(r.resolved_count || 0)},${Number(r.avg_resolve_hours || 0).toFixed(1)}`);
      });
      lines.push('');

      lines.push('=== 7. DEPARTMENT OPERATIONAL PERFORMANCE ===');
      lines.push('Department ID,Department Name,Department Code,Total Tickets,Open / Pending,In Progress,Resolved,Closed,Resolution Rate (%),Avg Resolution (Hours)');
      rawDepts.forEach((d) => {
        const dTotal = Number(d.total_tickets || 0);
        const dResolved = Number(d.resolved || 0) + Number(d.closed || 0);
        const dRate = dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0;
        lines.push(`"${d.id}","${d.name}","${d.code || 'N/A'}",${dTotal},${Number(d.open_tickets || 0)},${Number(d.in_progress || 0)},${Number(d.resolved || 0)},${Number(d.closed || 0)},"${dRate}%",${Number(d.avg_resolve_hours || 0).toFixed(1)}`);
      });
      lines.push('');

      lines.push('=== 8. STAFF PERFORMANCE MATRIX ===');
      lines.push('Staff ID,Full Name,Username,Email,Account Status,Total Assigned Tickets,In Progress Tickets,Resolved Tickets,Pending Workload,Resolution Rate (%)');
      rawStaff.forEach((s) => {
        const sTotal = Number(s.total_assigned || 0);
        const sResolved = Number(s.resolved || 0);
        const sInProgress = Number(s.in_progress || 0);
        const sPending = Math.max(0, sTotal - sResolved);
        const sRate = sTotal > 0 ? Math.round((sResolved / sTotal) * 100) : 0;
        lines.push(`"${s.id}","${s.first_name} ${s.last_name}","${s.username || 'N/A'}","${s.email}","${s.status || 'active'}",${sTotal},${sInProgress},${sResolved},${sPending},"${sRate}%"`);
      });
      lines.push('');

      lines.push('=== 9. TENANT ACTIVITY LEDGER ===');
      lines.push('Tenant ID,Organization Name,Email,Total Tickets,Resolved Tickets,Closed Tickets,Active Tickets,Resolution Rate (%)');
      rawTenants.forEach((t) => {
        const tTotal = Number(t.total_tickets || 0);
        const tResolved = Number(t.resolved || 0) + Number(t.closed || 0);
        const tActive = Math.max(0, tTotal - tResolved);
        const tRate = tTotal > 0 ? Math.round((tResolved / tTotal) * 100) : 0;
        lines.push(`"${t.tenant_id}","${t.organization_name}","${t.email || 'N/A'}",${tTotal},${Number(t.resolved || 0)},${Number(t.closed || 0)},${tActive},"${tRate}%"`);
      });

      csv = lines.join('\r\n');
      filename = 'report-comprehensive.csv';
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

