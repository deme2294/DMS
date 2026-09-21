import pool from '../config/db.js';

export const getAdminDashboard = async () => {
  const [users] = await pool.query(`
    SELECT COUNT(*) AS total_users,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_users
    FROM users
  `);
  const [departments] = await pool.query(`
    SELECT COUNT(*) AS total_departments,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_departments
    FROM departments
  `);
  const [tenants] = await pool.query(`
    SELECT COUNT(*) AS total_tenants,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tenants,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_tenants
    FROM tenants
  `);
  const [tickets] = await pool.query(`
    SELECT COUNT(*) AS total_tickets,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tickets,
           SUM(CASE WHEN status IN ('open','assigned','pending') THEN 1 ELSE 0 END) AS pending_tickets
    FROM tickets
  `);
  const [feedback] = await pool.query(`
    SELECT COUNT(*) AS total_feedback,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_feedback,
           SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS read_feedback,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_feedback
    FROM feedback
  `);
  const [recent] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.priority, t.status,
           t.created_at, tn.organization_name AS tenant_name
    FROM tickets t
    JOIN tenants tn ON tn.id = t.tenant_id
    ORDER BY t.created_at DESC
    LIMIT 10
  `);
  const [monthlyTickets] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
    FROM tickets
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month
    ORDER BY month
  `);
  const [statusBreakdown] = await pool.query(`
    SELECT status, COUNT(*) AS count
    FROM tickets
    GROUP BY status
  `);

  return {
    users: users[0],
    departments: departments[0],
    tenants: tenants[0],
    tickets: tickets[0],
    feedback: feedback[0],
    recentTickets: recent,
    monthlyTickets,
    statusBreakdown,
  };
};

export const getManagerDashboard = async (userId) => {
  const [assignedTickets] = await pool.query(`
    SELECT COUNT(*) AS total_assigned,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN status IN ('open','assigned','pending') THEN 1 ELSE 0 END) AS pending
    FROM tickets
    WHERE assigned_to = :userId
  `, { userId });
  const [departmentTickets] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM tickets t
    JOIN departments d ON d.id = t.department_id
    LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.user_id = :userId
    WHERE d.head_user_id = :userId OR ud.user_id = :userId
  `, { userId });
  const [departmentInfo] = await pool.query(`
    SELECT d.name AS department_name,
           (SELECT COUNT(*) FROM user_departments WHERE department_id = d.id) AS user_count
    FROM departments d
    LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.user_id = :userId
    WHERE d.head_user_id = :userId OR ud.user_id = :userId
    LIMIT 1
  `, { userId });
  const [staffPerformance] = await pool.query(`
    SELECT u.id, u.first_name, u.last_name, u.username,
           COUNT(t.id) AS total_tickets,
           SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved
    FROM users u
    JOIN roles r ON r.id = u.role_id AND r.name = 'staff'
    LEFT JOIN tickets t ON t.assigned_to = u.id
    JOIN user_departments ud ON ud.user_id = u.id
    GROUP BY u.id
    ORDER BY resolved DESC
    LIMIT 10
  `);
  const [recentTickets] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.priority, t.status, t.created_at,
           u.first_name AS assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    ORDER BY t.created_at DESC
    LIMIT 10
  `);

  return {
    assignedTickets: assignedTickets[0],
    departmentTickets: departmentTickets[0],
    departmentName: departmentInfo[0]?.department_name || null,
    departmentUserCount: departmentInfo[0]?.user_count || 0,
    staffPerformance,
    recentTickets,
  };
};

export const getStaffDashboard = async (userId) => {
  const [assignedTickets] = await pool.query(`
    SELECT COUNT(*) AS total_assigned,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) AS new_assigned
    FROM tickets
    WHERE assigned_to = :userId
  `, { userId });
  const [todayTickets] = await pool.query(`
    SELECT COUNT(*) AS today_count
    FROM tickets
    WHERE assigned_to = :userId
      AND DATE(created_at) = CURDATE()
  `, { userId });
  const [recentTickets] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.priority, t.status, t.created_at,
           tn.organization_name AS tenant_name
    FROM tickets t
    JOIN tenants tn ON tn.id = t.tenant_id
    WHERE t.assigned_to = :userId
    ORDER BY t.created_at DESC
    LIMIT 10
  `, { userId });

  return {
    assignedTickets: assignedTickets[0],
    todayTickets: todayTickets[0],
    recentTickets,
  };
};

const ACTIVE_STATUS_SET = `'open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened'`;

export const getTicketStatistics = async () => {
  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`
  );
  const byStatus = {};
  statusRows.forEach((r) => { byStatus[r.status] = Number(r.count); });

  const [overdue] = await pool.query(
    `SELECT COUNT(*) AS count FROM tickets
     WHERE due_date IS NOT NULL AND due_date < NOW() AND status IN (${ACTIVE_STATUS_SET})`
  );
  const [total] = await pool.query(`SELECT COUNT(*) AS count FROM tickets`);
  const [resolvedAvg] = await pool.query(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, COALESCE(closed_at, resolved_at, NOW()))) AS avg_hours
     FROM tickets WHERE status IN ('closed','resolved','completed','approved')`
  );

  return {
    total: Number(total[0].count || 0),
    open: Number(byStatus.open || 0),
    assigned: Number(byStatus.assigned || 0),
    pending: Number(byStatus.pending || 0),
    inProgress: Number(byStatus.in_progress || 0),
    waitingTenant: Number(byStatus.waiting_tenant || 0),
    waitingVendor: Number(byStatus.waiting_vendor || 0),
    resolved: Number(byStatus.resolved || 0),
    reopened: Number(byStatus.reopened || 0),
    closed: Number(byStatus.closed || 0),
    completed: Number(byStatus.completed || 0),
    escalated: Number(byStatus.escalated || 0),
    cancelled: Number(byStatus.cancelled || 0),
    overdue: Number(overdue[0].count || 0),
    avgResolutionHours: Number(resolvedAvg[0].avg_hours || 0).toFixed(1),
  };
};

export const getTicketCharts = async () => {
  const [byCategory] = await pool.query(
    `SELECT category, COUNT(*) AS count FROM tickets GROUP BY category ORDER BY count DESC`
  );
  const [byDepartment] = await pool.query(
    `SELECT COALESCE(d.name, 'Unassigned') AS name, COUNT(*) AS count
     FROM tickets t LEFT JOIN departments d ON d.id = t.department_id
     GROUP BY d.name ORDER BY count DESC`
  );
  const [byPriority] = await pool.query(
    `SELECT priority, COUNT(*) AS count FROM tickets GROUP BY priority`
  );
  const [byStatus] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`
  );
  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM tickets WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month`
  );
  const [resolutionByPriority] = await pool.query(
    `SELECT priority, AVG(TIMESTAMPDIFF(HOUR, created_at, COALESCE(closed_at, resolved_at))) AS avg_hours
     FROM tickets WHERE status IN ('closed','resolved') AND closed_at IS NOT NULL
     GROUP BY priority`
  );

  return {
    byCategory,
    byDepartment,
    byPriority,
    byStatus,
    monthly,
    resolutionByPriority,
  };
};

export const getOverdueTickets = async (limit = 50) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.reference_number, t.title, t.priority, t.status, t.category,
            t.due_date, t.created_at, tn.organization_name AS tenant_name,
            d.name AS department_name, CONCAT(u.first_name,' ',u.last_name) AS assigned_to_name
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status IN (${ACTIVE_STATUS_SET})
     ORDER BY t.due_date ASC LIMIT :limit`,
    { limit: Number(limit) }
  );
  return rows;
};

export const getCeoDashboard = async () => {
  const [users] = await pool.query(`
    SELECT COUNT(*) AS total_users,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_users,
           SUM(CASE WHEN r.name = 'staff' THEN 1 ELSE 0 END) AS total_staff,
           SUM(CASE WHEN r.name = 'manager' THEN 1 ELSE 0 END) AS total_managers,
           SUM(CASE WHEN r.name = 'admin' THEN 1 ELSE 0 END) AS total_admins
    FROM users u
    JOIN roles r ON r.id = u.role_id
  `);
  const [departments] = await pool.query(`
    SELECT COUNT(*) AS total_departments,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_departments
    FROM departments
  `);
  const [tenants] = await pool.query(`
    SELECT COUNT(*) AS total_tenants,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tenants,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_tenants
    FROM tenants
  `);
  const [tickets] = await pool.query(`
    SELECT COUNT(*) AS total_tickets,
           SUM(CASE WHEN status IN ('open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened') THEN 1 ELSE 0 END) AS open_tickets,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_tickets,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tickets,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
           SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_tickets
    FROM tickets
  `);
  const [overdue] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE due_date IS NOT NULL AND due_date < NOW() AND status IN (${ACTIVE_STATUS_SET})
  `);
  const [nearDeadline] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE due_date IS NOT NULL AND due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
      AND status IN (${ACTIVE_STATUS_SET})
  `);
  const [withinSla] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${ACTIVE_STATUS_SET})
      AND (due_date IS NULL OR (is_overdue = 0 AND response_sla_breached = 0 AND escalation_sla_breached = 0))
  `);
  const [notices] = await pool.query(`SELECT COUNT(*) AS total_notices FROM notices`);
  const [knowledge] = await pool.query(`SELECT COUNT(*) AS total_articles FROM knowledge_base`);
  const [feedback] = await pool.query(`SELECT COUNT(*) AS total_feedback FROM feedback`);
  const [escalated] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE status = 'escalated'
  `);

  return {
    users: users[0],
    departments: departments[0],
    tenants: tenants[0],
    tickets: tickets[0],
    overdue: overdue[0],
    nearDeadline: nearDeadline[0],
    withinSla: withinSla[0],
    notices: notices[0],
    knowledge: knowledge[0],
    feedback: feedback[0],
    escalated: escalated[0],
  };
};

export const getCeoDepartmentPerformance = async () => {
  const [rows] = await pool.query(`
    SELECT d.id, d.name AS department_name,
           CONCAT(h.first_name, ' ', h.last_name) AS manager_name,
           COUNT(DISTINCT ud.user_id) AS employee_count,
           COUNT(t.id) AS total_tickets,
           SUM(CASE WHEN t.status IN ('open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened') THEN 1 ELSE 0 END) AS open_tickets,
           SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
           SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tickets,
           AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))) AS avg_resolution_hours
     FROM departments d
     LEFT JOIN users h ON h.id = d.head_user_id
     LEFT JOIN user_departments ud ON ud.department_id = d.id
     LEFT JOIN tickets t ON t.department_id = d.id
     GROUP BY d.id, d.name, manager_name
     ORDER BY resolved_tickets DESC
  `);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.resolved_tickets || 0)), 0);
  const withRank = rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    performance: max > 0 ? Math.round((Number(r.resolved_tickets || 0) / max) * 100) : 0,
  }));
  return withRank;
};

export const getCeoStaffPerformance = async () => {
  const [rows] = await pool.query(`
    SELECT u.id, u.first_name, u.last_name, u.username,
           d.name AS department_name,
           COUNT(t.id) AS assigned_tickets,
           SUM(CASE WHEN t.status IN ('closed','resolved') THEN 1 ELSE 0 END) AS completed_tickets,
           SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tickets,
           AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))) AS avg_resolution_hours
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'staff'
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = ud.department_id
     LEFT JOIN tickets t ON t.assigned_to = u.id
     GROUP BY u.id, u.first_name, u.last_name, u.username, d.name
     ORDER BY completed_tickets DESC
     LIMIT 20
  `);
  return rows;
};

export const getCeoTenantStats = async () => {
  const [rows] = await pool.query(`
    SELECT t.id, t.organization_name, t.status,
           COUNT(tk.id) AS tickets_submitted,
           SUM(CASE WHEN tk.status = 'closed' THEN 1 ELSE 0 END) AS tickets_closed,
           AVG(TIMESTAMPDIFF(HOUR, tk.created_at, COALESCE(tk.closed_at, tk.resolved_at))) AS avg_resolution_hours
    FROM tenants t
    LEFT JOIN tickets tk ON tk.tenant_id = t.id
    GROUP BY t.id, t.organization_name, t.status
    ORDER BY tickets_submitted DESC
    LIMIT 20
  `);
  return rows;
};

export const getCeoSystemStats = async () => {
  const [daily] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE DATE(created_at) = CURDATE()`);
  const [weekly] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
  const [monthly] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
  const [yearly] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`);
  const [newUsers] = await pool.query(`
    SELECT COUNT(*) AS count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
  const [newTenants] = await pool.query(`
    SELECT COUNT(*) AS count FROM tenants WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
  const [resolved] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets WHERE status IN ('resolved','closed')
      AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
  return {
    daily: daily[0]?.count || 0,
    weekly: weekly[0]?.count || 0,
    monthly: monthly[0]?.count || 0,
    yearly: yearly[0]?.count || 0,
    newUsers: newUsers[0]?.count || 0,
    newTenants: newTenants[0]?.count || 0,
    resolvedThisMonth: resolved[0]?.count || 0,
  };
};

export const getTenantDashboard = async (tenantId) => {
   const [myTickets] = await pool.query(`
      SELECT COUNT(*) AS total_tickets,
             SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_tickets,
             SUM(CASE WHEN status IN ('open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened') THEN 1 ELSE 0 END) AS open_tickets
      FROM tickets
      WHERE tenant_id = :tenantId
    `, { tenantId });
   const [slaStats] = await pool.query(`
      SELECT
        SUM(CASE WHEN status IN ('open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened')
                 AND due_date IS NOT NULL AND due_date < NOW() THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN status IN ('open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened')
                 AND due_date IS NOT NULL AND due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) THEN 1 ELSE 0 END) AS nearDeadline
      FROM tickets
      WHERE tenant_id = :tenantId
    `, { tenantId });
  const [recentTickets] = await pool.query(`
    SELECT t.id, t.reference_number, t.track_number, t.title, t.priority, t.status, t.created_at
    FROM tickets t
    WHERE t.tenant_id = :tenantId
    ORDER BY t.created_at DESC
    LIMIT 10
  `, { tenantId });
  const [pendingFeedback] = await pool.query(`
    SELECT COUNT(*) AS count
    FROM feedback
    WHERE tenant_id = :tenantId AND status = 'pending'
  `, { tenantId });
  const [activeNotices] = await pool.query(`
    SELECT COUNT(*) AS count
    FROM notices
    WHERE status = 'published'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (target_audience = 'tenant' OR target_audience = 'all')
  `);
  const [availableOffices] = await pool.query(
    `SELECT id, employee_name, building, office_number, floor, address, description, email, phone_extension, attachment, attachment_name, notes, created_at, updated_at
     FROM office_locations
     ORDER BY created_at DESC
     LIMIT 20`
  );
  const [myBookings] = await pool.query(
    `SELECT ob.id, ob.office_location_id, ob.purpose, ob.start_date, ob.end_date, ob.status, ob.notes,
            ol.employee_name, ol.building, ol.office_number, ol.floor, ol.address, ol.attachment, ol.attachment_name
     FROM office_bookings ob
     JOIN office_locations ol ON ol.id = ob.office_location_id
     WHERE ob.tenant_id = :tenantId
     ORDER BY ob.created_at DESC
     LIMIT 10`,
    { tenantId }
  );

  return {
    myTickets: myTickets[0],
    recentTickets,
    pendingFeedback: pendingFeedback[0],
    activeNotices: activeNotices[0],
    slaStats: slaStats[0] || { overdue: 0, nearDeadline: 0 },
    availableOffices,
    myBookings,
  };
};

export const getAdminSlaDashboard = async () => {
  const activeStatuses = `'open','assigned','in_progress','pending','waiting_tenant','waiting_vendor','escalated','reopened'`;
  const resolvedStatuses = `'closed','resolved'`;

  const [withinSla] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${activeStatuses}) AND is_overdue = 0 AND response_sla_breached = 0 AND escalation_sla_breached = 0
  `);
  const [approaching] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${activeStatuses})
      AND due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
  `);
  const [overdue] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${activeStatuses}) AND is_overdue = 1
  `);
  const [completedWithinSla] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${resolvedStatuses}) AND is_overdue = 0 AND response_sla_breached = 0
  `);
  const [completedAfterSla] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN (${resolvedStatuses}) AND (is_overdue = 1 OR response_sla_breached = 1)
  `);
  const [avgResolution] = await pool.query(`
    SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, COALESCE(closed_at, resolved_at, NOW()))) AS avg_hours
    FROM tickets WHERE status IN (${resolvedStatuses})
  `);
  const totalResolved = Number(completedWithinSla[0]?.count || 0) + Number(completedAfterSla[0]?.count || 0);
  const slaCompliance = totalResolved > 0
    ? ((Number(completedWithinSla[0]?.count || 0) / totalResolved) * 100)
    : 0;

  const [recentBreaches] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.priority, t.status, t.category,
           t.due_date, t.response_due_date, t.escalation_due_date,
           t.created_at, tn.organization_name AS tenant_name,
           d.name AS department_name, CONCAT(u.first_name,' ',u.last_name) AS assigned_to_name
    FROM tickets t
    LEFT JOIN tenants tn ON tn.id = t.tenant_id
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN users u ON u.id = t.assigned_to
     WHERE (t.is_overdue = 1 OR t.response_sla_breached = 1 OR t.escalation_sla_breached = 1)
       AND t.status NOT IN ('closed','resolved','rejected','cancelled')
    ORDER BY t.updated_at DESC LIMIT 20
  `);

  return {
    withinSla: withinSla[0]?.count || 0,
    approaching: approaching[0]?.count || 0,
    overdue: overdue[0]?.count || 0,
    completedWithinSla: completedWithinSla[0]?.count || 0,
    completedAfterSla: completedAfterSla[0]?.count || 0,
    avgResolutionHours: avgResolution[0]?.avg_hours || 0,
    slaCompliance,
    recentBreaches,
  };
};

export const getManagerSlaDashboard = async (userId) => {
  const [deptPerf] = await pool.query(`
    SELECT AVG(TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at, NOW()))) AS avg_hours,
           COUNT(*) AS total,
           SUM(CASE WHEN t.is_overdue = 0 AND t.response_sla_breached = 0 THEN 1 ELSE 0 END) AS within_sla
    FROM tickets t
    JOIN user_departments ud ON ud.department_id = t.department_id
    WHERE ud.user_id = :userId AND t.status NOT IN ('closed','resolved','rejected','cancelled')
  `, { userId });

  const [teamPerf] = await pool.query(`
    SELECT u.id, u.first_name, u.last_name, u.username,
           COUNT(t.id) AS total_tickets,
           SUM(CASE WHEN t.status IN ('closed','resolved') AND t.is_overdue = 0 THEN 1 ELSE 0 END) AS within_sla,
           SUM(CASE WHEN t.is_overdue = 1 OR t.response_sla_breached = 1 THEN 1 ELSE 0 END) AS breached
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'staff'
     JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN tickets t ON t.assigned_to = u.id AND t.status NOT IN ('closed','resolved','rejected','cancelled')
     JOIN user_departments mgr_ud ON mgr_ud.department_id = ud.department_id AND mgr_ud.user_id = :userId
     GROUP BY u.id
     ORDER BY within_sla DESC
     LIMIT 20
  `, { userId });

  const [overdue] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets t
    JOIN user_departments ud ON ud.department_id = t.department_id
    WHERE ud.user_id = :userId AND t.status NOT IN ('closed','resolved','rejected','cancelled')
      AND (t.is_overdue = 1 OR t.response_sla_breached = 1)
  `, { userId });

  const [nearDeadline] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets t
    JOIN user_departments ud ON ud.department_id = t.department_id
    WHERE ud.user_id = :userId AND t.status NOT IN ('closed','resolved','rejected','cancelled')
      AND t.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
  `, { userId });

  return {
    departmentSlaPerformance: deptPerf[0] || {},
    teamSlaPerformance: teamPerf,
    overdueTickets: overdue[0]?.count || 0,
    ticketsNearDeadline: nearDeadline[0]?.count || 0,
  };
};

export const getStaffSlaDashboard = async (userId) => {
  const [assigned] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE assigned_to = :userId AND status NOT IN ('closed','resolved','rejected','cancelled')
  `, { userId });

  const [overdue] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE assigned_to = :userId AND status NOT IN ('closed','resolved','rejected','cancelled')
      AND (is_overdue = 1 OR response_sla_breached = 1)
  `, { userId });

  const [upcoming] = await pool.query(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE assigned_to = :userId AND status NOT IN ('closed','resolved','rejected','cancelled')
      AND (response_due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
           OR due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR))
  `, { userId });

  const [assignedList] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.status, t.priority, t.category,
           t.created_at, t.due_date, t.response_due_date, t.escalation_due_date,
           t.is_overdue, t.response_sla_breached, t.escalation_sla_breached,
           TIMESTAMPDIFF(MINUTE, NOW(), t.due_date) AS resolution_remaining_minutes,
           TIMESTAMPDIFF(MINUTE, NOW(), t.response_due_date) AS response_remaining_minutes,
           TIMESTAMPDIFF(MINUTE, NOW(), t.escalation_due_date) AS escalation_remaining_minutes
     FROM tickets t
     WHERE t.assigned_to = :userId AND t.status NOT IN ('closed','resolved','rejected','cancelled')
     ORDER BY t.due_date ASC
  `, { userId });

  const assignedTicketsList = assignedList.map((t) => {
    let remainingTime = null;
    let slaStatus = 'on_track';
    const now = new Date();
    if (t.response_sla_breached) {
      slaStatus = 'response_breached';
    } else if (t.escalation_sla_breached) {
      slaStatus = 'escalation_breached';
    } else if (t.is_overdue) {
      slaStatus = 'overdue';
    } else if (t.due_date) {
      const due = new Date(t.due_date);
      const diffMs = due.getTime() - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs < 0) {
        slaStatus = 'overdue';
      } else if (diffHrs <= 1) {
        slaStatus = 'approaching';
        remainingTime = formatRemainingTime(diffMs);
      } else {
        remainingTime = formatRemainingTime(diffMs);
      }
    }
    return { ...t, remaining_time: remainingTime, sla_status: slaStatus };
  });

  return {
    assignedTickets: assigned[0]?.count || 0,
    overdueTickets: overdue[0]?.count || 0,
    upcomingDeadlines: upcoming[0]?.count || 0,
    assignedTicketsList,
  };
};

export const getAdminAnalytics = async ({ timeframe = '6m', departmentId = null } = {}) => {
  let dateFilter = '';
  const queryParams = {};

  if (timeframe === '7d') {
    dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (timeframe === '30d') {
    dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (timeframe === '90d') {
    dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
  } else if (timeframe === '6m') {
    dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
  } else if (timeframe === '12m') {
    dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
  }

  let deptFilter = '';
  if (departmentId && departmentId !== 'all') {
    if (departmentId === 'unassigned') {
      deptFilter = 'AND t.department_id IS NULL';
    } else {
      deptFilter = 'AND t.department_id = :departmentId';
      queryParams.departmentId = departmentId;
    }
  }

  // 1. Overall KPIs
  const [kpiRows] = await pool.query(`
    SELECT
      COUNT(*) AS total_tickets,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved_tickets,
      SUM(CASE WHEN (t.status IN ('open', 'submitted', 'assigned', 'assigned_department', 'assigned_staff', 'pending', 'under_review', 'pending_approval')) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN (t.status IN ('in_progress', 'reopened', 'escalated', 'waiting_vendor') OR (t.status = 'waiting_tenant' AND t.resolved_at IS NULL)) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS in_progress_tickets,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND (t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL) THEN 1 ELSE 0 END) AS overdue_tickets,
      AVG(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
               THEN TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at)) / 60.0 ELSE NULL END) AS avg_resolution_hours,
      AVG(CASE WHEN tr.first_reply_at IS NOT NULL
               THEN TIMESTAMPDIFF(MINUTE, t.created_at, tr.first_reply_at) / 60.0 ELSE NULL END) AS avg_first_response_hours,
      SUM(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.is_overdue = 0 AND (t.due_date IS NULL OR COALESCE(t.resolved_at, t.closed_at) <= t.due_date)) THEN 1 ELSE 0 END) AS resolved_within_sla
    FROM tickets t
    LEFT JOIN (
      SELECT tr.ticket_id, MIN(tr.created_at) AS first_reply_at
      FROM ticket_replies tr
      JOIN tickets tk ON tk.id = tr.ticket_id
      WHERE tr.is_internal = 0 AND tr.user_id != tk.created_by
      GROUP BY tr.ticket_id
    ) tr ON tr.ticket_id = t.id
    WHERE 1=1 ${dateFilter} ${deptFilter}
  `, queryParams);

  // Month-over-month and week-over-week growth query
  const [growthRows] = await pool.query(`
    SELECT
      SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS current_period_count,
      SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND t.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previous_period_count,
      SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS current_week_count,
      SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND t.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS previous_week_count
    FROM tickets t
    WHERE 1=1 ${deptFilter}
  `, queryParams);

  // 2. Monthly breakdown
  const monthlyDateConstraint = timeframe === 'all' ? '' : 'WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
  const monthlyWhere = monthlyDateConstraint
    ? `${monthlyDateConstraint} ${deptFilter}`
    : (deptFilter ? `WHERE 1=1 ${deptFilter}` : '');

  const [monthlyTrends] = await pool.query(`
    SELECT
      DATE_FORMAT(t.created_at, '%Y-%m') AS month_key,
      DATE_FORMAT(t.created_at, '%b %Y') AS month_label,
      COUNT(*) AS total_created,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS total_resolved,
      SUM(CASE WHEN t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS active_backlog,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS overdue_count,
      ROUND(AVG(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at)) / 60.0 ELSE NULL END), 1) AS avg_resolution_hours
    FROM tickets t
    ${monthlyWhere}
    GROUP BY month_key, month_label
    ORDER BY month_key ASC
  `, queryParams);

  // 3. Weekly breakdown (last 12 weeks)
  const [weeklyTrends] = await pool.query(`
    SELECT
      YEARWEEK(t.created_at, 1) AS week_key,
      DATE_FORMAT(DATE_SUB(t.created_at, INTERVAL WEEKDAY(t.created_at) DAY), '%b %d') AS week_label,
      DATE_FORMAT(DATE_SUB(t.created_at, INTERVAL WEEKDAY(t.created_at) DAY), '%Y-%m-%d') AS week_start_date,
      COUNT(*) AS total_created,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS total_resolved,
      SUM(CASE WHEN (t.status IN ('in_progress', 'reopened', 'escalated', 'waiting_vendor') OR (t.status = 'waiting_tenant' AND t.resolved_at IS NULL)) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS overdue_count
    FROM tickets t
    WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK) ${deptFilter}
    GROUP BY week_key, week_label, week_start_date
    ORDER BY week_key ASC
  `, queryParams);

  // 4. Daily breakdown (last 14 days)
  const [dailyTrends] = await pool.query(`
    SELECT
      DATE_FORMAT(t.created_at, '%Y-%m-%d') AS date_key,
      DATE_FORMAT(t.created_at, '%a, %b %d') AS date_label,
      COUNT(*) AS total_created,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS total_resolved
    FROM tickets t
    WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ${deptFilter}
    GROUP BY date_key, date_label
    ORDER BY date_key ASC
  `, queryParams);

  // 5. Department-based analytics
  const [departmentAnalytics] = await pool.query(`
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      d.code AS department_code,
      COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unassigned') AS head_name,
      COUNT(t.id) AS total_tickets,
      SUM(CASE WHEN (t.status IN ('open', 'submitted', 'assigned', 'assigned_department', 'assigned_staff', 'pending', 'under_review', 'pending_approval')) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN (t.status IN ('in_progress', 'reopened', 'escalated', 'waiting_vendor') OR (t.status = 'waiting_tenant' AND t.resolved_at IS NULL)) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS in_progress_tickets,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved_tickets,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS overdue_tickets,
      ROUND(AVG(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at)) / 60.0 ELSE NULL END), 1) AS avg_resolution_hours,
      ROUND(SUM(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.is_overdue = 0 AND (t.due_date IS NULL OR COALESCE(t.resolved_at, t.closed_at) <= t.due_date)) THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END), 0), 1) AS sla_compliance_rate,
      ROUND(SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(t.id), 0), 1) AS resolution_rate
    FROM departments d
    LEFT JOIN users u ON u.id = d.head_user_id
    LEFT JOIN tickets t ON t.department_id = d.id ${dateFilter}
    GROUP BY d.id, d.name, d.code, head_name

    UNION ALL

    SELECT
      'unassigned' AS department_id,
      'General / Unassigned' AS department_name,
      'GEN' AS department_code,
      'Helpdesk Admin' AS head_name,
      COUNT(t.id) AS total_tickets,
      SUM(CASE WHEN (t.status IN ('open', 'submitted', 'assigned', 'assigned_department', 'assigned_staff', 'pending', 'under_review', 'pending_approval')) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN (t.status IN ('in_progress', 'reopened', 'escalated', 'waiting_vendor') OR (t.status = 'waiting_tenant' AND t.resolved_at IS NULL)) AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS in_progress_tickets,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved_tickets,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS overdue_tickets,
      ROUND(AVG(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at)) / 60.0 ELSE NULL END), 1) AS avg_resolution_hours,
      ROUND(SUM(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.is_overdue = 0 AND (t.due_date IS NULL OR COALESCE(t.resolved_at, t.closed_at) <= t.due_date)) THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END), 0), 1) AS sla_compliance_rate,
      ROUND(SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(t.id), 0), 1) AS resolution_rate
    FROM tickets t
    WHERE t.department_id IS NULL ${dateFilter}
    HAVING total_tickets > 0

    ORDER BY total_tickets DESC
  `);

  // 6. Status Breakdown
  const [statusBreakdown] = await pool.query(`
    SELECT
      t.status,
      COUNT(*) AS count
    FROM tickets t
    WHERE 1=1 ${dateFilter} ${deptFilter}
    GROUP BY t.status
    ORDER BY count DESC
  `, queryParams);

  // 7. Priority Distribution
  const [priorityDistribution] = await pool.query(`
    SELECT
      t.priority,
      COUNT(*) AS count,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN (t.is_overdue = 1 OR (t.due_date IS NOT NULL AND t.due_date < NOW())) AND t.status NOT IN ('resolved', 'closed', 'completed') AND t.resolved_at IS NULL THEN 1 ELSE 0 END) AS overdue,
      ROUND(AVG(CASE WHEN (t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL) AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at)) / 60.0 ELSE NULL END), 1) AS avg_hours
    FROM tickets t
    WHERE 1=1 ${dateFilter} ${deptFilter}
    GROUP BY t.priority
    ORDER BY FIELD(t.priority, 'urgent', 'high', 'medium', 'low')
  `, queryParams);

  // 8. Category Breakdown
  const [categoryBreakdown] = await pool.query(`
    SELECT
      COALESCE(t.category, 'General') AS category_name,
      COUNT(t.id) AS count,
      SUM(CASE WHEN t.status IN ('resolved', 'closed', 'completed') OR t.resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved
    FROM tickets t
    WHERE 1=1 ${dateFilter} ${deptFilter}
    GROUP BY category_name
    ORDER BY count DESC
    LIMIT 50
  `, queryParams);

  const kpis = kpiRows[0] || {};
  const growth = growthRows[0] || {};

  const total = Number(kpis.total_tickets || 0);
  const resolved = Number(kpis.resolved_tickets || 0);
  const open = Number(kpis.open_tickets || 0);
  const inProgress = Number(kpis.in_progress_tickets || 0);
  const overdue = Number(kpis.overdue_tickets || 0);
  const resolvedWithinSla = Number(kpis.resolved_within_sla || 0);

  const curMonth = Number(growth.current_period_count || 0);
  const prevMonth = Number(growth.previous_period_count || 0);
  const monthGrowthPercent = prevMonth === 0 ? (curMonth > 0 ? 100 : 0) : Number((((curMonth - prevMonth) / prevMonth) * 100).toFixed(1));

  const curWeek = Number(growth.current_week_count || 0);
  const prevWeek = Number(growth.previous_week_count || 0);
  const weekGrowthPercent = prevWeek === 0 ? (curWeek > 0 ? 100 : 0) : Number((((curWeek - prevWeek) / prevWeek) * 100).toFixed(1));

  const resolutionRate = total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 0;
  const overdueRate = total > 0 ? Number(((overdue / total) * 100).toFixed(1)) : 0;
  const slaComplianceRate = resolved > 0 ? Number(((resolvedWithinSla / resolved) * 100).toFixed(1)) : 100;

  return {
    kpis: {
      totalTickets: total,
      resolvedTickets: resolved,
      openTickets: open,
      inProgressTickets: inProgress,
      overdueTickets: overdue,
      resolutionRate,
      overdueRate,
      slaComplianceRate,
      avgResolutionHours: kpis.avg_resolution_hours ? Number(Number(kpis.avg_resolution_hours).toFixed(1)) : 0,
      avgFirstResponseHours: kpis.avg_first_response_hours ? Number(Number(kpis.avg_first_response_hours).toFixed(1)) : 0,
      monthGrowthPercent,
      weekGrowthPercent,
      currentMonthCount: curMonth,
      previousMonthCount: prevMonth,
      currentWeekCount: curWeek,
      previousWeekCount: prevWeek,
    },
    monthlyTrends: monthlyTrends.map((m) => ({
      monthKey: m.month_key,
      monthLabel: m.month_label,
      totalCreated: Number(m.total_created || 0),
      totalResolved: Number(m.total_resolved || 0),
      activeBacklog: Number(m.active_backlog || 0),
      overdueCount: Number(m.overdue_count || 0),
      avgResolutionHours: Number(m.avg_resolution_hours || 0),
    })),
    weeklyTrends: weeklyTrends.map((w) => ({
      weekKey: w.week_key,
      weekLabel: w.week_label,
      weekStartDate: w.week_start_date,
      totalCreated: Number(w.total_created || 0),
      totalResolved: Number(w.total_resolved || 0),
      inProgress: Number(w.in_progress || 0),
      overdueCount: Number(w.overdue_count || 0),
    })),
    dailyTrends: dailyTrends.map((d) => ({
      dateKey: d.date_key,
      dateLabel: d.date_label,
      totalCreated: Number(d.total_created || 0),
      totalResolved: Number(d.total_resolved || 0),
    })),
    departmentAnalytics: departmentAnalytics.map((dept) => ({
      departmentId: dept.department_id,
      departmentName: dept.department_name,
      departmentCode: dept.department_code,
      headName: dept.head_name || 'Unassigned',
      totalTickets: Number(dept.total_tickets || 0),
      openTickets: Number(dept.open_tickets || 0),
      inProgressTickets: Number(dept.in_progress_tickets || 0),
      resolvedTickets: Number(dept.resolved_tickets || 0),
      overdueTickets: Number(dept.overdue_tickets || 0),
      avgResolutionHours: Number(dept.avg_resolution_hours || 0),
      slaComplianceRate: Number(dept.sla_compliance_rate || 0),
      resolutionRate: Number(dept.resolution_rate || 0),
    })),
    statusBreakdown: statusBreakdown.map((sb) => ({
      status: sb.status,
      count: Number(sb.count || 0),
      percentage: total > 0 ? Number(((Number(sb.count || 0) / total) * 100).toFixed(1)) : 0,
    })),
    priorityDistribution: priorityDistribution.map((p) => ({
      priority: p.priority,
      count: Number(p.count || 0),
      resolved: Number(p.resolved || 0),
      overdue: Number(p.overdue || 0),
      avgHours: Number(p.avg_hours || 0),
      percentage: total > 0 ? Number(((Number(p.count || 0) / total) * 100).toFixed(1)) : 0,
    })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      categoryName: c.category_name,
      count: Number(c.count || 0),
      resolved: Number(c.resolved || 0),
    })),
  };
};

const formatRemainingTime = (ms) => {
  if (ms < 0) return 'Overdue';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} Day${days > 1 ? 's' : ''} Remaining`;
  }
  if (hours > 0) {
    return `${hours} Hour${hours > 1 ? 's' : ''} Remaining`;
  }
  return `${minutes} Minute${minutes > 1 ? 's' : ''} Remaining`;
};
