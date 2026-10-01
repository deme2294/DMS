import pool from '../config/db.js';

// ── Helper: fetch department IDs for a manager ─────────────────────────────
export const getManagerDepartmentIds = async (userId) => {
  const [rows] = await pool.query(
    'SELECT department_id FROM user_departments WHERE user_id = ?',
    [userId]
  );
  return rows.map((r) => r.department_id);
};

// ── Ticket Reports ─────────────────────────────────────────────────────────
export const getTicketReports = async (filters, managerDeptIds = null) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    const sDate = filters.startDate.length === 10 ? `${filters.startDate} 00:00:00` : filters.startDate;
    where += ' AND t.created_at >= ?';
    params.push(sDate);
  }
  if (filters.endDate) {
    const eDate = filters.endDate.length === 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
    where += ' AND t.created_at <= ?';
    params.push(eDate);
  }
  if (filters.departmentId) {
    where += ' AND t.department_id = ?';
    params.push(filters.departmentId);
  } else if (managerDeptIds && managerDeptIds.length > 0) {
    // If manager and no specific department filter, scope to their departments
    const placeholders = managerDeptIds.map(() => '?').join(', ');
    where += ` AND t.department_id IN (${placeholders})`;
    params.push(...managerDeptIds);
  }
  if (filters.status) {
    where += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    where += ' AND t.priority = ?';
    params.push(filters.priority);
  }

  const [stats] = await pool.query(
    `SELECT COUNT(t.id) AS total_tickets,
            SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status = 'submitted' THEN 1 ELSE 0 END) AS pending,
            AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.resolved_at, t.closed_at, NOW()))) AS avg_resolve_hours
     FROM tickets t ${where}`,
    params
  );

  const [byDepartment] = await pool.query(
    `SELECT d.name AS department, d.code, COUNT(t.id) AS count,
            SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status IN ('open','assigned','pending','waiting_tenant','waiting_vendor','escalated','reopened') THEN 1 ELSE 0 END) AS open_tickets
     FROM tickets t
     JOIN departments d ON d.id = t.department_id
     ${where} GROUP BY t.department_id, d.name, d.code ORDER BY count DESC`,
    params
  );

  const [byPriority] = await pool.query(
    `SELECT t.priority, COUNT(*) AS count FROM tickets t ${where} GROUP BY t.priority`,
    params
  );

  const [byStatus] = await pool.query(
    `SELECT t.status, COUNT(*) AS count FROM tickets t ${where} GROUP BY t.status`,
    params
  );

  const [byCategory] = await pool.query(
    `SELECT COALESCE(t.category, 'Uncategorized') AS category, COUNT(*) AS count
     FROM tickets t ${where}
     GROUP BY t.category ORDER BY count DESC`,
    params
  );

  const [monthlyTrend] = await pool.query(
    `SELECT DATE_FORMAT(t.created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM tickets t ${where}
     GROUP BY month ORDER BY month DESC LIMIT 12`,
    params
  );

  const [resolutionByPriority] = await pool.query(
    `SELECT t.priority,
            AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.resolved_at, t.closed_at, NOW()))) AS avg_resolve_hours,
            COUNT(*) AS resolved_count
     FROM tickets t ${where} AND t.status IN ('resolved', 'closed')
     GROUP BY t.priority`,
    params
  );

  const [resolutionByStatus] = await pool.query(
    `SELECT t.status,
            AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.resolved_at, t.closed_at, NOW()))) AS avg_resolve_hours,
            COUNT(*) AS resolved_count
     FROM tickets t ${where} AND t.status IN ('resolved', 'closed')
     GROUP BY t.status`,
    params
  );

  return {
    stats: stats[0] || {},
    byDepartment,
    byPriority,
    byStatus,
    byCategory,
    monthlyTrend,
    resolutionByPriority,
    resolutionByStatus,
  };
};

// ── Department Reports ─────────────────────────────────────────────────────
export const getDepartmentReports = async (filters, managerDeptIds = null) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    const sDate = filters.startDate.length === 10 ? `${filters.startDate} 00:00:00` : filters.startDate;
    where += ' AND t.created_at >= ?';
    params.push(sDate);
  }
  if (filters.endDate) {
    const eDate = filters.endDate.length === 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
    where += ' AND t.created_at <= ?';
    params.push(eDate);
  }
  if (filters.departmentId) {
    where += ' AND d.id = ?';
    params.push(filters.departmentId);
  }

  // Build department scope: manager sees only their departments
  let deptScope = '';
  const deptParams = [];
  if (managerDeptIds && managerDeptIds.length > 0) {
    const placeholders = managerDeptIds.map(() => '?').join(', ');
    deptScope = `AND d.id IN (${placeholders})`;
    deptParams.push(...managerDeptIds);
  }

  const hasDateFilter = Boolean(filters.startDate || filters.endDate);
  const joinType = hasDateFilter ? 'JOIN' : 'LEFT JOIN';

  const [departments] = await pool.query(
    `SELECT d.id, d.name, d.code, d.status,
            COUNT(t.id) AS total_tickets,
            SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status IN ('open','assigned','pending','waiting_tenant','waiting_vendor','escalated','reopened') THEN 1 ELSE 0 END) AS open_tickets,
            AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at, NOW()))) AS avg_resolve_hours
     FROM departments d
     ${joinType} tickets t ON t.department_id = d.id
     ${where}
     ${deptScope}
     GROUP BY d.id, d.name, d.code, d.status
     ORDER BY total_tickets DESC`,
    [...params, ...deptParams]
  );

  return departments;
};

// ── Staff Reports ──────────────────────────────────────────────────────────
export const getStaffReports = async (filters, managerDeptIds = null) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    const sDate = filters.startDate.length === 10 ? `${filters.startDate} 00:00:00` : filters.startDate;
    where += ' AND t.created_at >= ?';
    params.push(sDate);
  }
  if (filters.endDate) {
    const eDate = filters.endDate.length === 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
    where += ' AND t.created_at <= ?';
    params.push(eDate);
  }
  if (filters.departmentId) {
    where += ' AND t.department_id = ?';
    params.push(filters.departmentId);
  }

  // For manager: only show staff who belong to the manager's department(s)
  let deptJoin = '';
  let deptWhere = '';
  const deptParams = [];
  if (managerDeptIds && managerDeptIds.length > 0) {
    const placeholders = managerDeptIds.map(() => '?').join(', ');
    deptJoin = 'JOIN user_departments ud ON ud.user_id = u.id';
    deptWhere = `AND ud.department_id IN (${placeholders})`;
    deptParams.push(...managerDeptIds);
  }

  const hasDateFilter = Boolean(filters.startDate || filters.endDate || filters.departmentId);
  const joinType = hasDateFilter ? 'JOIN' : 'LEFT JOIN';

  const [staff] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.status,
            COUNT(t.id) AS total_assigned,
            SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'staff'
     ${deptJoin}
     ${joinType} tickets t ON t.assigned_to = u.id
     ${where}
     ${deptWhere}
     GROUP BY u.id, u.first_name, u.last_name, u.username, u.email, u.status
     ORDER BY total_assigned DESC`,
    [...params, ...deptParams]
  );

  return staff;
};

// ── Tenant Reports ─────────────────────────────────────────────────────────
export const getTenantReports = async (filters, managerDeptIds = null) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    const sDate = filters.startDate.length === 10 ? `${filters.startDate} 00:00:00` : filters.startDate;
    where += ' AND t.created_at >= ?';
    params.push(sDate);
  }
  if (filters.endDate) {
    const eDate = filters.endDate.length === 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
    where += ' AND t.created_at <= ?';
    params.push(eDate);
  }
  if (filters.tenantId) {
    where += ' AND t.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.departmentId) {
    where += ' AND t.department_id = ?';
    params.push(filters.departmentId);
  }

  // For manager: only show tenants whose tickets are in manager's departments
  if (managerDeptIds && managerDeptIds.length > 0) {
    const placeholders = managerDeptIds.map(() => '?').join(', ');
    where += ` AND t.department_id IN (${placeholders})`;
    params.push(...managerDeptIds);
  }

  const [tenants] = await pool.query(
    `SELECT t.tenant_id, tn.organization_name, tn.email, tn.status,
            COUNT(t.id) AS total_tickets,
            SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed
     FROM tickets t
     JOIN tenants tn ON tn.id = t.tenant_id
     ${where}
     GROUP BY t.tenant_id, tn.organization_name, tn.email, tn.status
     ORDER BY total_tickets DESC`,
    params
  );

  return tenants;
};
