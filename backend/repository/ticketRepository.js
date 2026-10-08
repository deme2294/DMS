import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const baseSelect = `
  t.*,
  tn.organization_name AS tenant_name,
  CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name,
  d.name AS department_name,
  CONCAT(au.first_name, ' ', au.last_name) AS assigned_to_name
`;

const attachmentSelect = `'' AS attachments_placeholder`;

const parseAttachments = (row) => {
  if (!row) return row;
  // attachments are fetched separately via fetchAttachmentsByTicketId
  row.attachments = row.attachments || [];
  return row;
};

const fetchAttachmentsByTicketId = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.ticket_id, a.file_name, a.original_name, a.file_path, a.file_size, a.mime_type,
            a.uploaded_by, a.comment, a.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name,
            r.name AS uploaded_by_role
     FROM ticket_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE a.ticket_id = ?
     ORDER BY a.created_at ASC`,
    [ticketId]
  );
  return rows;
};

export const generateReferenceNumber = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM tickets WHERE YEAR(created_at) = :year`,
    { year }
  );
  const seq = String(rows[0].total + 1).padStart(5, '0');
  return `HD-${year}-${seq}`;
};

export const generateTrackNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TRK-${ts}-${rand}`;
};

export const findAll = async ({
  search,
  status,
  priority,
  category,
  departmentId,
  tenantId,
  assignedTo,
  createdBy,
  fromDate,
  toDate,
  keyword,
  page = 1,
  limit = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'updated_at', 'priority', 'status', 'title', 'reference_number', 'due_date'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = 'WHERE 1=1';
  const params = {};

  if (search) {
    where += ` AND (
      t.title LIKE :search OR t.description LIKE :search OR
      t.reference_number LIKE :search OR t.track_number LIKE :search OR
      t.category LIKE :search
    )`;
    params.search = `%${search}%`;
  }
  if (keyword) {
    where += ` AND (t.title LIKE :keyword OR t.description LIKE :keyword OR t.category LIKE :keyword)`;
    params.keyword = `%${keyword}%`;
  }
  if (status) { where += ' AND t.status = :status'; params.status = status; }
  if (priority) { where += ' AND t.priority = :priority'; params.priority = priority; }
  if (category) { where += ' AND t.category = :category'; params.category = category; }
  if (departmentId) { where += ' AND t.department_id = :departmentId'; params.departmentId = departmentId; }
  if (tenantId) { where += ' AND t.tenant_id = :tenantId'; params.tenantId = tenantId; }
  if (assignedTo) { where += ' AND t.assigned_to = :assignedTo'; params.assignedTo = assignedTo; }
  if (createdBy) { where += ' AND t.created_by = :createdBy'; params.createdBy = createdBy; }
  if (fromDate) { where += ' AND DATE(t.created_at) >= :fromDate'; params.fromDate = fromDate; }
  if (toDate) { where += ' AND DATE(t.created_at) <= :toDate'; params.toDate = toDate; }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM tickets t ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT ${baseSelect}
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users au ON au.id = t.assigned_to
     ${where}
     ORDER BY t.${orderCol} ${orderDir}
     LIMIT :limit OFFSET :offset`,
    { ...params, limit: Number(limit), offset: Number(offset) }
  );

  // Fetch attachments for each ticket in one query
  const ticketIds = rows.map((r) => r.id);
  let attachmentsMap = {};
  if (ticketIds.length) {
    const placeholders = ticketIds.map(() => '?').join(',');
    const [attRows] = await pool.query(
      `SELECT a.id, a.ticket_id, a.file_name, a.original_name, a.file_path, a.file_size, a.mime_type,
              a.uploaded_by, a.comment, a.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name,
              r.name AS uploaded_by_role
       FROM ticket_attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE a.ticket_id IN (${placeholders})
       ORDER BY a.created_at ASC`,
      ticketIds
    );
    for (const att of attRows) {
      if (!attachmentsMap[att.ticket_id]) attachmentsMap[att.ticket_id] = [];
      attachmentsMap[att.ticket_id].push(att);
    }
  }

  return {
    data: rows.map((r) => ({ ...r, attachments: attachmentsMap[r.id] || [] })),
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit) || 1,
    },
  };
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${baseSelect}
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users au ON au.id = t.assigned_to
     WHERE t.id = :id
     LIMIT 1`,
    { id }
  );
  if (!rows[0]) return null;
  const attachments = await fetchAttachmentsByTicketId(id);
  return { ...rows[0], attachments };
};

export const findByTrackNumber = async (trackNumber) => {
  const [rows] = await pool.query(
    `SELECT ${baseSelect}
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users au ON au.id = t.assigned_to
     WHERE t.track_number = :trackNumber
     LIMIT 1`,
    { trackNumber }
  );
  if (!rows[0]) return null;
  const attachments = await fetchAttachmentsByTicketId(rows[0].id);
  return { ...rows[0], attachments };
};

export const create = async (ticket) => {
  await pool.query(
    `INSERT INTO tickets
       (id, reference_number, track_number, tenant_id, created_by, department_id,
        assigned_to, title, description, priority, category, status,
        due_date, response_due_date, escalation_due_date, sla_policy_id, auto_department_id,
        routing_type, sla_agreement_accepted, sla_agreement_accepted_at)
     VALUES
       (:id, :referenceNumber, :trackNumber, :tenantId, :createdBy, :departmentId,
        :assignedTo, :title, :description, :priority, :category, :status,
        :dueDate, :responseDueDate, :escalationDueDate, :slaPolicyId, :autoDepartmentId,
        :routingType, :slaAgreementAccepted, :slaAgreementAcceptedAt)`,
    ticket
  );
};

export const update = async (id, fields) => {
  const allowed = [
    'department_id', 'assigned_to', 'title', 'description',
    'priority', 'category', 'status', 'resolved_at', 'closed_at',
    'due_date', 'response_due_date', 'escalation_due_date', 'sla_policy_id',
    'completed_at', 'approved_at',
    'escalated_at', 'reopened_at', 'cancelled_at',     'merged_into',
    'tenant_confirmation_status', 'is_escalated', 'approved_by', 'reopened_by', 'reopen_reason',
    'routing_type', 'sla_agreement_accepted', 'sla_agreement_accepted_at',
  ];
  const sets = [];
  const params = { id };

  Object.entries(fields).forEach(([key, value]) => {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = :${key}`);
      params[key] = value;
    }
  });

  if (!sets.length) return;
  await pool.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = :id`, params);
};

// Resolve the department + routing type linked to a category name (auto-detection)
export const getDepartmentForCategory = async (categoryName) => {
  const [rows] = await pool.query(
    `SELECT department_id, sla_policy_id, routing_type
     FROM ticket_categories
     WHERE name = :name AND status = 'approved' LIMIT 1`,
    { name: categoryName }
  );
  return rows[0] || { department_id: null, sla_policy_id: null, routing_type: 'general' };
};

export const remove = async (id) => {
  await pool.query('DELETE FROM tickets WHERE id = :id', { id });
};

export const addAttachment = async (attachment) => {
  await pool.query(
    `INSERT INTO ticket_attachments
       (id, ticket_id, file_name, original_name, file_path, file_size, mime_type, uploaded_by, comment)
     VALUES
       (:id, :ticketId, :fileName, :originalName, :filePath, :fileSize, :mimeType, :uploadedBy, :comment)`,
    {
      id: attachment.id,
      ticketId: attachment.ticketId,
      fileName: attachment.fileName,
      originalName: attachment.originalName || attachment.fileName,
      filePath: attachment.filePath,
      fileSize: attachment.fileSize != null ? attachment.fileSize : 0,
      mimeType: attachment.mimeType || null,
      uploadedBy: attachment.uploadedBy,
      comment: attachment.comment || null,
    }
  );
};

export const logStatusHistory = async ({ id, ticketId, fromStatus, toStatus, changedBy, notes, role, browser }) => {
  await pool.query(
    `INSERT INTO ticket_status_history (id, ticket_id, from_status, to_status, changed_by, notes, role, browser)
     VALUES (:id, :ticketId, :fromStatus, :toStatus, :changedBy, :notes, :role, :browser)`,
    {
      id,
      ticketId,
      fromStatus,
      toStatus,
      changedBy,
      notes: notes || null,
      role: role || null,
      browser: browser || null,
    }
  );
};

export const getStatusHistory = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT h.*, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
     FROM ticket_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.ticket_id = :ticketId
     ORDER BY h.created_at ASC`,
    { ticketId }
  );
  return rows;
};

export const getManagerDepartmentIds = async (userId) => {
  const [rows] = await pool.query(
    `SELECT department_id FROM user_departments WHERE user_id = :userId`,
    { userId }
  );
  return rows.map((r) => r.department_id);
};

export const getUserDepartmentIds = async (userId) => {
  const [rows] = await pool.query(
    `SELECT department_id FROM user_departments WHERE user_id = :userId`,
    { userId }
  );
  return rows.map((r) => r.department_id);
};

/**
 * Fetch tickets visible to a manager.
 *
 * Visibility rule (OR):
 *   1. ticket.department_id is one of the manager's departments, OR
 *   2. ticket.assigned_to = managerId  AND  (ticket.department_id IN manager's depts OR ticket.department_id IS NULL)
 *
 * Cross-department tickets that happen to be directly assigned to this manager
 * are intentionally excluded (they belong to another manager's scope).
 */
export const findAllForManager = async ({
  managerId,
  departmentIds,
  search,
  status,
  priority,
  category,
  departmentId,   // optional single-dept filter chosen by the user in the UI
  assignedTo,
  fromDate,
  toDate,
  keyword,
  page = 1,
  limit = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'updated_at', 'priority', 'status', 'title', 'reference_number', 'due_date'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // If there are no departments, only show directly-assigned (dept IS NULL) tickets.
  const hasDepts = departmentIds && departmentIds.length > 0;

  let scopeClause;
  if (hasDepts) {
    const placeholders = departmentIds.map(() => '?').join(',');
    // Visibility: in dept  OR  (directly assigned AND dept is mine or null)
    scopeClause = `(t.department_id IN (${placeholders})
                   OR (t.assigned_to = ? AND (t.department_id IN (${placeholders}) OR t.department_id IS NULL)))`;
  } else {
    // Manager has no departments yet — only see directly-assigned with no dept
    scopeClause = `(t.assigned_to = ? AND t.department_id IS NULL)`;
  }

  // Extra filters
  const extraClauses = [];
  const extraParams = [];

  if (search) {
    extraClauses.push(`(t.title LIKE ? OR t.description LIKE ? OR t.reference_number LIKE ? OR t.track_number LIKE ? OR t.category LIKE ?)`);
    const s = `%${search}%`;
    extraParams.push(s, s, s, s, s);
  }
  if (keyword) {
    extraClauses.push(`(t.title LIKE ? OR t.description LIKE ? OR t.category LIKE ?)`);
    const k = `%${keyword}%`;
    extraParams.push(k, k, k);
  }
  if (status) { extraClauses.push('t.status = ?'); extraParams.push(status); }
  if (priority) { extraClauses.push('t.priority = ?'); extraParams.push(priority); }
  if (category) { extraClauses.push('t.category = ?'); extraParams.push(category); }
  if (assignedTo) { extraClauses.push('t.assigned_to = ?'); extraParams.push(assignedTo); }
  if (fromDate) { extraClauses.push('DATE(t.created_at) >= ?'); extraParams.push(fromDate); }
  if (toDate) { extraClauses.push('DATE(t.created_at) <= ?'); extraParams.push(toDate); }

  // Optional: manager filters down to one of their own departments via the UI dropdown
  if (departmentId && hasDepts && departmentIds.includes(departmentId)) {
    extraClauses.push('t.department_id = ?');
    extraParams.push(departmentId);
  }

  const extraWhere = extraClauses.length ? ` AND ${extraClauses.join(' AND ')}` : '';

  // Build positional param arrays for count and data queries
  let scopeParams;
  if (hasDepts) {
    scopeParams = [...departmentIds, managerId, ...departmentIds];
  } else {
    scopeParams = [managerId];
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tickets t
    WHERE ${scopeClause}${extraWhere}
  `;
  const [countRows] = await pool.query(countSql, [...scopeParams, ...extraParams]);

  const dataSql = `
    SELECT ${baseSelect}
    FROM tickets t
    LEFT JOIN tenants tn ON tn.id = t.tenant_id
    LEFT JOIN users cu ON cu.id = t.created_by
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN users au ON au.id = t.assigned_to
    WHERE ${scopeClause}${extraWhere}
    ORDER BY t.${orderCol} ${orderDir}
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(dataSql, [...scopeParams, ...extraParams, Number(limit), Number(offset)]);

  // Fetch attachments in one batch
  const ticketIds = rows.map((r) => r.id);
  let attachmentsMap = {};
  if (ticketIds.length) {
    const ph = ticketIds.map(() => '?').join(',');
    const [attRows] = await pool.query(
      `SELECT a.id, a.ticket_id, a.file_name, a.original_name, a.file_path, a.file_size, a.mime_type,
              a.uploaded_by, a.comment, a.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name,
              r.name AS uploaded_by_role
       FROM ticket_attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE a.ticket_id IN (${ph})
       ORDER BY a.created_at ASC`,
      ticketIds
    );
    for (const att of attRows) {
      if (!attachmentsMap[att.ticket_id]) attachmentsMap[att.ticket_id] = [];
      attachmentsMap[att.ticket_id].push(att);
    }
  }

  const total = countRows[0].total;
  return {
    data: rows.map((r) => ({ ...r, attachments: attachmentsMap[r.id] || [] })),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};


export const getCategories = async () => {
  // Prefer the managed ticket_categories table; fall back to distinct values in tickets.
  // Only APPROVED + active categories are exposed to the tenant ticket form.
  try {
    const [rows] = await pool.query(
      `SELECT name FROM ticket_categories WHERE is_active = 1 AND status = 'approved' ORDER BY name ASC`
    );
    if (rows.length) return rows.map((r) => r.name);
  } catch (_) { /* table may not exist yet */ }
  const [rows] = await pool.query(
    `SELECT DISTINCT category FROM tickets ORDER BY category ASC`
  );
  return rows.map((r) => r.category);
};

export const addReply = async (reply) => {
  await pool.query(
    `INSERT INTO ticket_replies (id, ticket_id, user_id, message, visibility, attachment_id, type, is_internal, department_ids)
     VALUES (:id, :ticketId, :userId, :message, :visibility, :attachmentId, :type, :isInternal, :departmentIds)`,
    {
      id: reply.id,
      ticketId: reply.ticketId,
      userId: reply.userId,
      message: reply.message,
      visibility: reply.visibility || 'all',
      attachmentId: reply.attachmentId || null,
      type: reply.type || 'reply',
      isInternal: reply.isInternal || 0,
      departmentIds: reply.departmentIds || null,
    }
  );
};

export const getReplies = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name,
            ro.name AS user_role,
            COALESCE(GROUP_CONCAT(ud.department_id), '') AS author_department_ids
     FROM ticket_replies r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN roles ro ON ro.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = r.user_id
     WHERE r.ticket_id = :ticketId
     GROUP BY r.id
     ORDER BY r.created_at ASC`,
    { ticketId }
  );
  return rows;
};

// ── Assignment lifecycle (assignments table) ──
export const createAssignment = async ({
  ticketId, assignedBy, assignedTo, role, notes, priority, category, fromAssignmentId, status = 'pending', acceptedAt = null,
}) => {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO assignments
       (id, ticket_id, assigned_by, assigned_to, role, notes, priority, category, from_assignment_id, status, accepted_at)
     VALUES (:id, :ticketId, :assignedBy, :assignedTo, :role, :notes, :priority, :category, :fromAssignmentId, :status, :acceptedAt)`,
    {
      id,
      ticketId,
      assignedBy,
      assignedTo,
      role,
      notes: notes || null,
      priority: priority || null,
      category: category || null,
      fromAssignmentId: fromAssignmentId || null,
      status,
      acceptedAt: acceptedAt || (status === 'accepted' ? new Date() : null),
    }
  );
  return id;
};

export const findActiveAssignment = async (ticketId, role) => {
  let sql = `SELECT * FROM assignments WHERE ticket_id = :ticketId AND status IN ('pending', 'accepted')`;
  const params = { ticketId };
  if (role) { sql += ' AND role = :role'; params.role = role; }
  sql += ' ORDER BY created_at DESC LIMIT 1';
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const acceptAssignment = async (id, acceptedAt = new Date()) => {
  await pool.query(
    `UPDATE assignments SET status = 'accepted', accepted_at = :acceptedAt WHERE id = :id`,
    { id, acceptedAt }
  );
};

export const rejectAssignment = async (id, rejectedAt = new Date()) => {
  await pool.query(
    `UPDATE assignments SET status = 'rejected', rejected_at = :rejectedAt WHERE id = :id`,
    { id, rejectedAt }
  );
};

export const reassignAssignment = async (id, reassignedAt = new Date()) => {
  await pool.query(
    `UPDATE assignments SET status = 'rejected', reassigned_at = :reassignedAt WHERE id = :id`,
    { id, reassignedAt }
  );
};

// Admin-controlled override of assignment attribution (assigned_by / assigned_to on a given assignment row).
export const updateAssignment = async (id, fields) => {
  const allowed = ['assigned_by', 'assigned_to', 'role', 'notes', 'priority', 'category', 'status', 'accepted_at', 'rejected_at', 'reassigned_at'];
  const sets = [];
  const params = { id };
  Object.entries(fields).forEach(([key, value]) => {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = :${key}`);
      params[key] = value;
    }
  });
  if (!sets.length) return;
  await pool.query(`UPDATE assignments SET ${sets.join(', ')} WHERE id = :id`, params);
};

export const getAssignments = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT a.*, CONCAT(b.first_name,' ',b.last_name) AS assigned_by_name,
            CONCAT(t.first_name,' ',t.last_name) AS assigned_to_name
     FROM assignments a
     LEFT JOIN users b ON b.id = a.assigned_by
     LEFT JOIN users t ON t.id = a.assigned_to
     WHERE a.ticket_id = :ticketId ORDER BY a.created_at ASC`,
    { ticketId }
  );
  return rows;
};

// Mark tickets as merged into a target ticket
export const mergeInto = async (sourceIds, targetId) => {
  if (!sourceIds.length) return;
  const placeholders = sourceIds.map(() => '?').join(',');
  await pool.query(
    `UPDATE tickets SET merged_into = ?, status = 'cancelled', cancelled_at = NOW() WHERE id IN (${placeholders})`,
    [targetId, ...sourceIds]
  );
};

// Find ticket by UUID id, reference_number, or track_number
export const findByIdOrRef = async (idOrRef) => {
  if (!idOrRef) return null;
  const [rows] = await pool.query(
    `SELECT ${baseSelect}
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users au ON au.id = t.assigned_to
     WHERE t.id = :idOrRef OR t.reference_number = :idOrRef OR t.track_number = :idOrRef
     LIMIT 1`,
    { idOrRef }
  );
  if (!rows[0]) return null;
  const attachments = await fetchAttachmentsByTicketId(rows[0].id);
  return { ...rows[0], attachments };
};

// Find eligible candidate tickets to merge into a target ticket
export const findMergeCandidates = async (targetTicketId, tenantId, search) => {
  let query = `
    SELECT ${baseSelect}
    FROM tickets t
    LEFT JOIN tenants tn ON tn.id = t.tenant_id
    LEFT JOIN users cu ON cu.id = t.created_by
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN users au ON au.id = t.assigned_to
    WHERE t.id != :targetTicketId
      AND t.merged_into IS NULL
      AND t.status NOT IN ('cancelled', 'closed')
  `;
  const params = { targetTicketId, tenantId: tenantId || null };

  if (search && search.trim()) {
    query += ` AND (t.title LIKE :search OR t.reference_number LIKE :search OR t.track_number LIKE :search OR tn.organization_name LIKE :search)`;
    params.search = `%${search.trim()}%`;
  }

  query += `
    ORDER BY (t.tenant_id = :tenantId) DESC, t.created_at DESC
    LIMIT 25
  `;

  const [rows] = await pool.query(query, params);
  return rows;
};

// ── Timeline aggregation (status history + replies + attachments) ──
export const getTimeline = async (ticketId) => {
  const [status] = await pool.query(
    `SELECT h.id, 'status' AS type, h.from_status, h.to_status, h.notes, h.role,
            h.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor_name
     FROM ticket_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.ticket_id = :ticketId`,
    { ticketId }
  );
  const [comments] = await pool.query(
    `SELECT r.id, 'comment' AS type, r.message, r.visibility, r.type AS comment_type,
            r.created_at, CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
            r.user_id, ro.name AS user_role,
            r.department_ids, COALESCE(GROUP_CONCAT(ud.department_id), '') AS author_department_ids
     FROM ticket_replies r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN roles ro ON ro.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = r.user_id
     WHERE r.ticket_id = :ticketId
     GROUP BY r.id
     ORDER BY r.created_at ASC`,
    { ticketId }
  );
  const [attachments] = await pool.query(
    `SELECT a.id, 'attachment' AS type, a.file_name AS message, a.file_path, a.mime_type,
            a.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor_name
     FROM ticket_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.ticket_id = :ticketId`,
    { ticketId }
  );
  const [assignments] = await pool.query(
    `SELECT a.id, 'assignment' AS type, a.role, a.status, a.notes,
            a.created_at, CONCAT(t.first_name,' ',t.last_name) AS actor_name
     FROM assignments a
     LEFT JOIN users t ON t.id = a.assigned_to
     WHERE a.ticket_id = :ticketId`,
    { ticketId }
  );

  const events = [
    ...status.map((e) => ({ ...e, kind: 'status' })),
    ...comments.map((e) => ({ ...e, kind: 'comment' })),
    ...attachments.map((e) => ({ ...e, kind: 'attachment' })),
    ...assignments.map((e) => ({ ...e, kind: 'assignment' })),
  ];
  events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return events;
};

/**
 * Find the primary active manager for a department considering BOTH department and role ('manager').
 * Prioritizes the department head if they are an active manager, otherwise takes the first active manager.
 */
export const findDepartmentManager = async (departmentId) => {
  if (!departmentId) return null;

  // 1. Check if department head is an active user with role 'manager' in this department
  const [headRows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role, 1 AS is_head
     FROM departments d
     JOIN users u ON u.id = d.head_user_id
     JOIN roles r ON r.id = u.role_id
     JOIN user_departments ud ON ud.user_id = u.id AND ud.department_id = d.id
     WHERE d.id = :departmentId
       AND r.name = 'manager'
       AND u.status = 'active'
     LIMIT 1`,
    { departmentId }
  );
  if (headRows.length > 0) {
    return headRows[0];
  }

  // 2. Query any active user in user_departments for this department with role 'manager'
  const [mgrRows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role, 0 AS is_head
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN user_departments ud ON ud.user_id = u.id
     WHERE ud.department_id = :departmentId
       AND r.name = 'manager'
       AND u.status = 'active'
     ORDER BY u.created_at ASC
     LIMIT 1`,
    { departmentId }
  );

  return mgrRows[0] || null;
};

/**
 * List all active managers assigned to a department (matching role = 'manager' and user_departments).
 */
export const findDepartmentManagers = async (departmentId) => {
  if (!departmentId) return [];
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role,
            (CASE WHEN d.head_user_id = u.id THEN 1 ELSE 0 END) AS is_head
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = ud.department_id
     WHERE ud.department_id = :departmentId
       AND r.name = 'manager'
       AND u.status = 'active'
     ORDER BY is_head DESC, u.first_name ASC, u.last_name ASC`,
    { departmentId }
  );
  return rows;
};

/**
 * Validates that a user is an active manager belonging to the specified department.
 */
export const validateDepartmentManager = async (userId, departmentId) => {
  if (!userId || !departmentId) return false;
  const [rows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN user_departments ud ON ud.user_id = u.id
     WHERE u.id = :userId
       AND ud.department_id = :departmentId
       AND r.name = 'manager'
       AND u.status = 'active'
     LIMIT 1`,
    { userId, departmentId }
  );
  return rows.length > 0;
};

/**
 * Validates that a user is active staff belonging to the specified department.
 */
export const validateDepartmentStaff = async (userId, departmentId) => {
  if (!userId || !departmentId) return false;
  const [rows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN user_departments ud ON ud.user_id = u.id
     WHERE u.id = :userId
       AND ud.department_id = :departmentId
       AND r.name = 'staff'
       AND u.status = 'active'
     LIMIT 1`,
    { userId, departmentId }
  );
  return rows.length > 0;
};

