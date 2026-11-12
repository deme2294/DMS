import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { resolveUserId } from './userRepository.js';
import { resolveDepartmentId } from './departmentRepository.js';

const baseSelect = `
  t.*,
  tn.organization_name AS tenant_name,
  tn.email AS tenant_email,
  tn.phone AS tenant_phone,
  tn.contact_person AS tenant_contact_person,
  CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name,
  cu.email AS created_by_email,
  cu.phone AS created_by_phone,
  d.name AS department_name,
  CONCAT(au.first_name, ' ', au.last_name) AS assigned_to_name,
  CONCAT(ru.first_name, ' ', ru.last_name) AS reopened_by_name,
  CONCAT(rr_u.first_name, ' ', rr_u.last_name) AS reopen_requested_by_name
`;

const attachmentSelect = `'' AS attachments_placeholder`;

const parseAttachments = (row) => {
  if (!row) return row;
  // attachments are fetched separately via fetchAttachmentsByTicketId
  row.attachments = row.attachments || [];
  return row;
};

export const resolveTicketId = async (idOrShort) => {
  if (!idOrShort) return null;
  const str = String(idOrShort).trim();
  const isNumeric = /^\d+$/.test(str);
  const [rows] = await pool.query(
    `SELECT id FROM tickets
     WHERE id = :str
        OR id LIKE CONCAT(:str, '%')
        OR reference_number = :str
        OR track_number = :str
        ${isNumeric ? 'OR ticket_num = :num' : ''}
     ORDER BY CASE
       WHEN id = :str THEN 1
       WHEN ${isNumeric ? 'ticket_num = :num' : '0'} THEN 2
       WHEN reference_number = :str THEN 3
       WHEN track_number = :str THEN 4
       ELSE 5
     END
     LIMIT 1`,
    { str, num: isNumeric ? Number(str) : 0 }
  );
  return rows[0]?.id || idOrShort;
};

const fetchAttachmentsByTicketId = async (ticketId) => {
  const actualId = await resolveTicketId(ticketId);
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
    [actualId]
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
  if (status) {
    if (status === 'escalated') {
      where += " AND (t.status = 'escalated' OR t.status LIKE 'escalated.%' OR t.is_escalated = 1)";
    } else if (status === 'resolved') {
      where += " AND (t.status = 'resolved' OR t.status = 'escalated.resolved' OR (t.status = 'resolved' AND t.is_escalated = 1))";
    } else if (status.startsWith('escalated.')) {
      const sub = status.replace('escalated.', '');
      where += " AND (t.status = :status OR (t.status = :subStatus AND t.is_escalated = 1))";
      params.status = status;
      params.subStatus = sub;
    } else {
      where += " AND (t.status = :status OR t.status = CONCAT('escalated.', :status))";
      params.status = status;
    }
  }
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
     LEFT JOIN users ru ON ru.id = t.reopened_by
     LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
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

export const findById = async (idOrShort) => {
  if (!idOrShort) return null;
  const str = String(idOrShort).trim();
  const isNumeric = /^\d+$/.test(str);
  const [rows] = await pool.query(
    `SELECT ${baseSelect}
     FROM tickets t
     LEFT JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN departments d ON d.id = t.department_id
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN users ru ON ru.id = t.reopened_by
     LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
     WHERE t.id = :str
        OR t.id LIKE CONCAT(:str, '%')
        OR t.reference_number = :str
        OR t.track_number = :str
        ${isNumeric ? 'OR t.ticket_num = :num' : ''}
     ORDER BY CASE
       WHEN t.id = :str THEN 1
       WHEN ${isNumeric ? 't.ticket_num = :num' : '0'} THEN 2
       WHEN t.reference_number = :str THEN 3
       WHEN t.track_number = :str THEN 4
       ELSE 5
     END
     LIMIT 1`,
    { str, num: isNumeric ? Number(str) : 0 }
  );
  if (!rows[0]) return null;
  const attachments = await fetchAttachmentsByTicketId(rows[0].id);
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
     LEFT JOIN users ru ON ru.id = t.reopened_by
     LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
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
  const actualId = await resolveTicketId(id);
  const allowed = [
    'department_id', 'assigned_to', 'title', 'description',
    'priority', 'category', 'status', 'resolved_at', 'closed_at',
    'due_date', 'response_due_date', 'escalation_due_date', 'sla_policy_id',
    'completed_at', 'approved_at',
    'escalated_at', 'reopened_at', 'cancelled_at',     'merged_into',
    'tenant_confirmation_status', 'is_escalated', 'approved_by', 'reopened_by', 'reopen_reason',
    'reopen_requested_at', 'reopen_requested_by', 'reopen_request_reason', 'reopen_status',
    'first_response_at',
    'routing_type', 'sla_agreement_accepted', 'sla_agreement_accepted_at',
  ];
  const sets = [];
  const params = { id: actualId };

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
  const actualId = await resolveTicketId(id);
  await pool.query('DELETE FROM tickets WHERE id = :id', { id: actualId });
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

export const findAttachmentById = async (attachmentId) => {
  const cleanId = String(attachmentId).trim();
  const [rows] = await pool.query(
    `SELECT a.*,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name,
            r.name AS uploaded_by_role
     FROM ticket_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE a.id = ? LIMIT 1`,
    [cleanId]
  );
  return rows[0] || null;
};

export const updateAttachmentComment = async (attachmentId, comment) => {
  const cleanId = String(attachmentId).trim();
  await pool.query(
    `UPDATE ticket_attachments SET comment = ? WHERE id = ?`,
    [comment, cleanId]
  );
  return findAttachmentById(cleanId);
};

export const deleteAttachment = async (attachmentId, ticketId = null) => {
  const cleanId = String(attachmentId).trim();

  // 1. Remove references from ticket_replies where this attachment is linked
  await pool.query(
    `UPDATE ticket_replies SET attachment_id = NULL WHERE attachment_id = ?`,
    [cleanId]
  ).catch(() => {});

  // 2. Permanently delete from ticket_attachments table in database
  const [result] = await pool.query(
    `DELETE FROM ticket_attachments WHERE id = ?`,
    [cleanId]
  );

  // 3. Update the ticket's attachment_count column in tickets table
  if (ticketId) {
    const actualTicketId = await resolveTicketId(ticketId);
    await pool.query(
      `UPDATE tickets 
       SET attachment_count = (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ?) 
       WHERE id = ?`,
      [actualTicketId, actualTicketId]
    ).catch(() => {});
  }

  return result;
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
  const actualId = await resolveTicketId(ticketId);
  const [rows] = await pool.query(
    `SELECT h.*, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
     FROM ticket_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.ticket_id = :actualId
     ORDER BY h.created_at ASC`,
    { actualId }
  );
  return rows;
};

export const getManagerDepartmentIds = async (userId) => {
  const actualUserId = (await resolveUserId(userId)) || userId;
  const [rows] = await pool.query(
    `SELECT DISTINCT d.id
     FROM departments d
     LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.user_id = :userId
     WHERE d.head_user_id = :userId OR ud.user_id = :userId`,
    { userId: actualUserId }
  );
  return rows.map((r) => r.id);
};

export const getUserDepartmentIds = async (userId) => {
  const actualUserId = (await resolveUserId(userId)) || userId;
  const [rows] = await pool.query(
    `SELECT DISTINCT d.id
     FROM departments d
     LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.user_id = :userId
     WHERE d.head_user_id = :userId OR ud.user_id = :userId`,
    { userId: actualUserId }
  );
  return rows.map((r) => r.id);
};

/**
 * Fetch tickets visible to a manager.
 *
 * Visibility rule:
 *   1. Any ticket assigned to this manager (t.assigned_to = :managerId)
 *   2. Any ticket with an active assignment to this manager in assignments table
 *   3. Any ticket in one of the manager's assigned or headed departments
 */
export const findAllForManager = async ({
  managerId,
  departmentIds = [],
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
  const actualManagerId = (await resolveUserId(managerId)) || managerId;
  const actualDeptFilter = departmentId ? ((await resolveDepartmentId(departmentId)) || departmentId) : null;
  const actualAssignedTo = assignedTo ? ((await resolveUserId(assignedTo)) || assignedTo) : null;
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'updated_at', 'priority', 'status', 'title', 'reference_number', 'due_date'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Resolve departmentIds array if any
  const resolvedDeptIds = [];
  if (Array.isArray(departmentIds)) {
    for (const d of departmentIds) {
      if (d) {
        const rd = (await resolveDepartmentId(d)) || d;
        if (rd && !resolvedDeptIds.includes(rd)) resolvedDeptIds.push(rd);
      }
    }
  }

  // Manager visibility:
  // 1. Directly assigned to manager (t.assigned_to = :managerId)
  // 2. Active assignment in assignments table for this manager
  // 3. Any ticket in the manager's assigned or headed departments
  const scopeClauses = [
    't.assigned_to = ?',
    'EXISTS (SELECT 1 FROM assignments a WHERE a.ticket_id = t.id AND a.assigned_to = ? AND a.status IN (\'pending\', \'accepted\'))'
  ];
  const scopeParams = [actualManagerId, actualManagerId];

  if (resolvedDeptIds.length > 0) {
    const placeholders = resolvedDeptIds.map(() => '?').join(',');
    scopeClauses.push(`t.department_id IN (${placeholders})`);
    scopeClauses.push(`t.auto_department_id IN (${placeholders})`);
    scopeParams.push(...resolvedDeptIds, ...resolvedDeptIds);
  }

  const scopeClause = `(${scopeClauses.join(' OR ')})`;

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
  if (status) {
    if (status === 'escalated') {
      extraClauses.push("(t.status = 'escalated' OR t.status LIKE 'escalated.%' OR t.is_escalated = 1)");
    } else if (status === 'resolved') {
      extraClauses.push("(t.status = 'resolved' OR t.status = 'escalated.resolved' OR (t.status = 'resolved' AND t.is_escalated = 1))");
    } else if (status.startsWith('escalated.')) {
      const sub = status.replace('escalated.', '');
      extraClauses.push("(t.status = ? OR (t.status = ? AND t.is_escalated = 1))");
      extraParams.push(status, sub);
    } else {
      extraClauses.push("(t.status = ? OR t.status = CONCAT('escalated.', ?))");
      extraParams.push(status, status);
    }
  }
  if (priority) { extraClauses.push('t.priority = ?'); extraParams.push(priority); }
  if (category) { extraClauses.push('t.category = ?'); extraParams.push(category); }
  if (actualAssignedTo) { extraClauses.push('t.assigned_to = ?'); extraParams.push(actualAssignedTo); }
  if (fromDate) { extraClauses.push('DATE(t.created_at) >= ?'); extraParams.push(fromDate); }
  if (toDate) { extraClauses.push('DATE(t.created_at) <= ?'); extraParams.push(toDate); }

  // Optional: manager filters down to a department via the UI dropdown
  if (actualDeptFilter) {
    extraClauses.push('(t.department_id = ? OR t.auto_department_id = ?)');
    extraParams.push(actualDeptFilter, actualDeptFilter);
  }

  const extraWhere = extraClauses.length ? ` AND ${extraClauses.join(' AND ')}` : '';

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
    LEFT JOIN users ru ON ru.id = t.reopened_by
    LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
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
  // Strictly return active, approved categories from ticket_categories (empty if none exist).
  try {
    const [rows] = await pool.query(
      `SELECT name FROM ticket_categories
       WHERE is_active = 1 AND status = 'approved'
         AND NOT EXISTS (SELECT 1 FROM departments d WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(ticket_categories.name)))
       ORDER BY name ASC`
    );
    return rows.map((r) => r.name);
  } catch (_) {
    return [];
  }
};

export const addReply = async (reply) => {
  await pool.query(
    `INSERT INTO ticket_replies (id, ticket_id, user_id, message, visibility, attachment_id, type, is_internal, department_ids, target_user_id)
     VALUES (:id, :ticketId, :userId, :message, :visibility, :attachmentId, :type, :isInternal, :departmentIds, :targetUserId)`,
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
      targetUserId: reply.targetUserId || null,
    }
  );
};

export const getReplies = async (ticketId) => {
  const actualId = await resolveTicketId(ticketId);
  const [rows] = await pool.query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name,
            ro.name AS user_role,
            CONCAT(tu.first_name, ' ', tu.last_name) AS target_user_name,
            tro.name AS target_user_role,
            COALESCE(GROUP_CONCAT(ud.department_id), '') AS author_department_ids
     FROM ticket_replies r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN roles ro ON ro.id = u.role_id
     LEFT JOIN users tu ON tu.id = r.target_user_id
     LEFT JOIN roles tro ON tro.id = tu.role_id
     LEFT JOIN user_departments ud ON ud.user_id = r.user_id
     WHERE r.ticket_id = :actualId
     GROUP BY r.id
     ORDER BY r.created_at ASC`,
    { actualId }
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
  const actualId = await resolveTicketId(ticketId);
  let sql = `SELECT * FROM assignments WHERE ticket_id = :actualId AND status IN ('pending', 'accepted')`;
  const params = { actualId };
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
  const actualId = await resolveTicketId(ticketId);
  const [rows] = await pool.query(
    `SELECT a.*, CONCAT(b.first_name,' ',b.last_name) AS assigned_by_name,
            CONCAT(t.first_name,' ',t.last_name) AS assigned_to_name
     FROM assignments a
     LEFT JOIN users b ON b.id = a.assigned_by
     LEFT JOIN users t ON t.id = a.assigned_to
     WHERE a.ticket_id = :actualId ORDER BY a.created_at ASC`,
    { actualId }
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
     LEFT JOIN users ru ON ru.id = t.reopened_by
     LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
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
    LEFT JOIN users ru ON ru.id = t.reopened_by
    LEFT JOIN users rr_u ON rr_u.id = t.reopen_requested_by
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
  const actualId = await resolveTicketId(ticketId);
  const [status] = await pool.query(
    `SELECT h.id, 'status' AS type, h.from_status, h.to_status, h.notes, h.role,
            h.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor_name
     FROM ticket_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.ticket_id = :actualId`,
    { actualId }
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
     WHERE r.ticket_id = :actualId
     GROUP BY r.id
     ORDER BY r.created_at ASC`,
    { actualId }
  );
  const [attachments] = await pool.query(
    `SELECT a.id, 'attachment' AS type, a.file_name AS message, a.file_path, a.mime_type,
            a.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor_name
     FROM ticket_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.ticket_id = :actualId`,
    { actualId }
  );
  const [assignments] = await pool.query(
    `SELECT a.id, 'assignment' AS type, a.role, a.status, a.notes,
            a.created_at, CONCAT(t.first_name,' ',t.last_name) AS actor_name
     FROM assignments a
     LEFT JOIN users t ON t.id = a.assigned_to
     WHERE a.ticket_id = :actualId`,
    { actualId }
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
  const actualDeptId = (await resolveDepartmentId(departmentId)) || departmentId;

  // 1. Check if department head is an active user with role 'manager'
  const [headRows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role, 1 AS is_head
     FROM departments d
     JOIN users u ON u.id = d.head_user_id
     JOIN roles r ON r.id = u.role_id
     WHERE d.id = :actualDeptId
       AND r.name = 'manager'
       AND u.status = 'active'
     LIMIT 1`,
    { actualDeptId }
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
     WHERE ud.department_id = :actualDeptId
       AND r.name = 'manager'
       AND u.status = 'active'
     ORDER BY u.created_at ASC
     LIMIT 1`,
    { actualDeptId }
  );

  return mgrRows[0] || null;
};

/**
 * List all active managers assigned to a department (matching role = 'manager' and user_departments or head).
 */
export const findDepartmentManagers = async (departmentId) => {
  if (!departmentId) return [];
  const actualDeptId = (await resolveDepartmentId(departmentId)) || departmentId;
  const [rows] = await pool.query(
    `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, r.name AS role,
            (CASE WHEN d.head_user_id = u.id THEN 1 ELSE 0 END) AS is_head
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = :actualDeptId
     WHERE (ud.department_id = :actualDeptId OR d.head_user_id = u.id)
       AND r.name = 'manager'
       AND u.status = 'active'
     ORDER BY is_head DESC, u.first_name ASC, u.last_name ASC`,
    { actualDeptId }
  );
  return rows;
};

/**
 * Validates that a user is an active manager belonging to the specified department.
 */
export const validateDepartmentManager = async (userId, departmentId) => {
  if (!userId || !departmentId) return false;
  const actualUserId = (await resolveUserId(userId)) || userId;
  const actualDeptId = (await resolveDepartmentId(departmentId)) || departmentId;
  const [rows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = :actualDeptId
     WHERE u.id = :actualUserId
       AND (ud.department_id = :actualDeptId OR d.head_user_id = u.id)
       AND r.name = 'manager'
       AND u.status = 'active'
     LIMIT 1`,
    { actualUserId, actualDeptId }
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

