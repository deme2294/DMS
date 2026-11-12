import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { sanitizeFeedback } from '../models/Feedback.js';

let columnsEnsuredPromise = null;
export const ensureFeedbackAssignmentColumns = async () => {
  if (!columnsEnsuredPromise) {
    columnsEnsuredPromise = (async () => {
      try {
        const [cols] = await pool.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feedback'
             AND COLUMN_NAME IN ('assignment_scope', 'assigned_user_ids')`
        );
        const existing = new Set(cols.map((c) => c.COLUMN_NAME));
        if (!existing.has('assignment_scope')) {
          await pool.query('ALTER TABLE feedback ADD COLUMN assignment_scope VARCHAR(32) NULL AFTER assigned_to_user_id');
        }
        if (!existing.has('assigned_user_ids')) {
          await pool.query('ALTER TABLE feedback ADD COLUMN assigned_user_ids TEXT NULL AFTER assignment_scope');
        }
      } catch (err) {
        columnsEnsuredPromise = null;
        console.warn('[feedbackRepository] Could not verify assignment columns:', err.message);
      }
    })();
  }
  return columnsEnsuredPromise;
};

export const resolveFeedbackId = async (idOrShort) => {
  if (!idOrShort) return null;
  const str = String(idOrShort).trim();
  const isNumeric = /^\d+$/.test(str);
  const [rows] = await pool.query(
    `SELECT id FROM feedback
     WHERE id = ?
        OR id LIKE CONCAT(?, '%')
        OR legacy_id = ?
        OR legacy_id LIKE CONCAT(?, '%')
        ${isNumeric ? 'OR feedback_num = ?' : ''}
     ORDER BY CASE
       WHEN id = ? THEN 1
       WHEN ${isNumeric ? 'feedback_num = ?' : '0'} THEN 2
       WHEN legacy_id = ? THEN 3
       ELSE 4
     END
     LIMIT 1`,
    isNumeric ? [str, str, str, str, Number(str), str, Number(str), str] : [str, str, str, str, str, str]
  );
  return rows[0]?.id || idOrShort;
};

export const findById = async (id) => {
  await ensureFeedbackAssignmentColumns();
  const actualId = await resolveFeedbackId(id);
  const [rows] = await pool.query(
    `SELECT f.*, 
            COALESCE(tc.routing_type, tk.routing_type, 'general') AS routing_type,
            COALESCE(f.department_id, tc.department_id, tk.department_id) AS resolved_department_id,
            t.organization_name AS tenant_name, t.contact_person AS contact_person,
            tk.reference_number AS ticket_reference, tk.title AS ticket_title,
            d.name AS department_name,
            tc.name AS category_name,
            u_mgr.first_name AS dept_head_first_name, u_mgr.last_name AS dept_head_last_name,
            u_mgr.email AS dept_head_email,
            u_assign.first_name AS assigned_first_name, u_assign.last_name AS assigned_last_name,
            u_assign.email AS assigned_to_email
     FROM feedback f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN tickets tk ON tk.id = f.ticket_id
     LEFT JOIN departments d ON d.id = f.department_id
     LEFT JOIN ticket_categories tc ON tc.id = f.category_id
     LEFT JOIN users u_mgr ON u_mgr.id = f.department_head_id
     LEFT JOIN users u_assign ON u_assign.id = f.assigned_to_user_id
     WHERE f.id = ? LIMIT 1`,
    [actualId]
  );
  return sanitizeFeedback(rows[0] || null);
};

export const findAll = async ({ search, status, departmentId, categoryId, page = 1, limit = 10 }, user) => {
  await ensureFeedbackAssignmentColumns();
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  const userDeptIds = [
    user?.department_id,
    user?.departmentId,
    ...(user?.departments || []).map((d) => d.id),
  ].filter(Boolean);

  // Role-based visibility
  if (user?.role === 'tenant') {
    const tenantId = user.tenantId || user.tenant_id;
    if (tenantId) {
      where += ' AND f.tenant_id = ?';
      params.push(tenantId);
    }
  } else if (user?.role === 'manager') {
    if (userDeptIds.length > 0) {
      where += ` AND (f.department_id IN (${userDeptIds.map(() => '?').join(', ')}) OR f.department_head_id = ?)`;
      params.push(...userDeptIds, user.id);
    } else {
      where += ' AND f.department_head_id = ?';
      params.push(user.id);
    }
  } else if (user?.role === 'staff') {
    if (userDeptIds.length > 0) {
      where += ` AND (f.assigned_to_user_id = ? OR f.assigned_user_ids LIKE CONCAT('%"', ?, '"%') OR (f.assignment_scope = 'department_general' AND f.department_id IN (${userDeptIds.map(() => '?').join(', ')})))`;
      params.push(user.id, user.id, ...userDeptIds);
    } else {
      where += ` AND (f.assigned_to_user_id = ? OR f.assigned_user_ids LIKE CONCAT('%"', ?, '"%'))`;
      params.push(user.id, user.id);
    }
  }

  if (departmentId) {
    where += ' AND f.department_id = ?';
    params.push(departmentId);
  }

  if (categoryId) {
    where += ' AND f.category_id = ?';
    params.push(categoryId);
  }

  if (search) {
    where += ' AND (f.subject LIKE ? OR f.message LIKE ? OR f.what_should_change LIKE ? OR f.what_is_wrong LIKE ? OR f.admin_directive LIKE ? OR f.service_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    where += ' AND f.status = ?';
    params.push(status);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM feedback f ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT f.*, 
            COALESCE(tc.routing_type, tk.routing_type, 'general') AS routing_type,
            COALESCE(f.department_id, tc.department_id, tk.department_id) AS resolved_department_id,
            t.organization_name AS tenant_name, t.contact_person AS contact_person,
            tk.reference_number AS ticket_reference, tk.title AS ticket_title,
            d.name AS department_name,
            tc.name AS category_name,
            u_mgr.first_name AS dept_head_first_name, u_mgr.last_name AS dept_head_last_name,
            u_mgr.email AS dept_head_email,
            u_assign.first_name AS assigned_first_name, u_assign.last_name AS assigned_last_name,
            u_assign.email AS assigned_to_email
     FROM feedback f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN tickets tk ON tk.id = f.ticket_id
     LEFT JOIN departments d ON d.id = f.department_id
     LEFT JOIN ticket_categories tc ON tc.id = f.category_id
     LEFT JOIN users u_mgr ON u_mgr.id = f.department_head_id
     LEFT JOIN users u_assign ON u_assign.id = f.assigned_to_user_id
     ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    data: rows.map(sanitizeFeedback),
    pagination: {
      total: Number(countRows[0].total),
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(countRows[0].total) / Number(limit)),
    },
  };
};

export const findByTenant = async (tenantId) => {
  const [rows] = await pool.query(
    'SELECT * FROM feedback WHERE tenant_id = ? ORDER BY created_at DESC',
    [tenantId]
  );
  return rows;
};

export const create = async (feedback) => {
  const {
    id,
    feedbackNum,
    tenantId,
    ticketId,
    categoryId,
    serviceName,
    departmentId,
    departmentHeadId,
    assignedToUserId,
    subject,
    message,
    rating,
    status,
    feedbackType,
    whatShouldChange,
    whatIsCorrect,
    whatIsWrong,
    howItShouldGo,
    adminDirective,
    departmentNotes,
  } = feedback;

  const fNum = feedbackNum || (/^\d+$/.test(id) ? Number(id) : null);

  await pool.query(
    `INSERT INTO feedback 
      (id, feedback_num, tenant_id, ticket_id, category_id, service_name, department_id, department_head_id, assigned_to_user_id, subject, message, rating, status, feedback_type, what_should_change, what_is_correct, what_is_wrong, how_it_should_go, admin_directive, department_notes, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      fNum,
      tenantId,
      ticketId || null,
      categoryId || null,
      serviceName || null,
      departmentId || null,
      departmentHeadId || null,
      assignedToUserId || null,
      subject,
      message,
      rating,
      status || 'pending',
      feedbackType || 'suggestion',
      whatShouldChange || null,
      whatIsCorrect || null,
      whatIsWrong || null,
      howItShouldGo || null,
      adminDirective || null,
      departmentNotes || null,
    ]
  );
  return id;
};

export const update = async (id, fields) => {
  await ensureFeedbackAssignmentColumns();
  const actualId = await resolveFeedbackId(id);
  const sets = [];
  const params = [];
  Object.entries(fields).forEach(([key, value]) => {
    sets.push(`${key} = ?`);
    params.push(value);
  });
  sets.push('updated_at = NOW()');
  params.push(actualId);
  await pool.query(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const remove = async (id) => {
  const actualId = await resolveFeedbackId(id);
  await pool.query('DELETE FROM feedback WHERE id = ?', [actualId]);
};

export const addReply = async (id, replyBy, replyMessage) => {
  const actualId = await resolveFeedbackId(id);
  const [result] = await pool.query(
    'INSERT INTO feedback_replies (id, feedback_id, replied_by, message, created_at) VALUES (UUID(), ?, ?, ?, NOW())',
    [actualId, replyBy, replyMessage]
  );
  return result.insertId;
};

export const getReplies = async (feedbackId) => {
  const actualId = await resolveFeedbackId(feedbackId);
  const [rows] = await pool.query(
    'SELECT r.*, u.first_name, u.last_name, u.username FROM feedback_replies r LEFT JOIN users u ON u.id = r.replied_by WHERE r.feedback_id = ? ORDER BY r.created_at ASC',
    [actualId]
  );
  return rows;
};
