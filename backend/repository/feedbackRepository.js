import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { sanitizeFeedback } from '../models/Feedback.js';

export const resolveFeedbackId = async (idOrShort) => {
  if (!idOrShort) return null;
  const str = String(idOrShort).trim();
  const isNumeric = /^\d+$/.test(str);
  const [rows] = await pool.query(
    `SELECT id FROM feedback
     WHERE id = ?
        OR id LIKE CONCAT(?, '%')
        ${isNumeric ? 'OR feedback_num = ?' : ''}
     ORDER BY CASE
       WHEN id = ? THEN 1
       WHEN ${isNumeric ? 'feedback_num = ?' : '0'} THEN 2
       ELSE 3
     END
     LIMIT 1`,
    isNumeric ? [str, str, Number(str), str, Number(str)] : [str, str, str]
  );
  return rows[0]?.id || idOrShort;
};

export const findById = async (id) => {
  const actualId = await resolveFeedbackId(id);
  const [rows] = await pool.query(
    `SELECT f.*, t.organization_name AS tenant_name, t.contact_person AS contact_person,
            tk.reference_number AS ticket_reference, tk.title AS ticket_title
     FROM feedback f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN tickets tk ON tk.id = f.ticket_id
     WHERE f.id = ? LIMIT 1`,
    [actualId]
  );
  return sanitizeFeedback(rows[0] || null);
};

export const findAll = async ({ search, status, page = 1, limit = 10 }, user) => {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  // Tenants can only see their own feedback
  if (user?.role === 'tenant' && user?.tenantId) {
    where += ' AND f.tenant_id = ?';
    params.push(user.tenantId);
  }

  if (search) {
    where += ' AND (f.subject LIKE ? OR f.message LIKE ? OR f.what_should_change LIKE ? OR f.what_is_wrong LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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
    `SELECT f.*, t.organization_name AS tenant_name, t.contact_person AS contact_person,
            tk.reference_number AS ticket_reference, tk.title AS ticket_title
     FROM feedback f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN tickets tk ON tk.id = f.ticket_id
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
  const { id, tenantId, ticketId, subject, message, rating, status, feedbackType, whatShouldChange, whatIsCorrect, whatIsWrong, howItShouldGo } = feedback;
  const [result] = await pool.query(
    `INSERT INTO feedback 
      (id, tenant_id, ticket_id, subject, message, rating, status, feedback_type, what_should_change, what_is_correct, what_is_wrong, how_it_should_go, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, tenantId, ticketId, subject, message, rating, status || 'pending', feedbackType, whatShouldChange, whatIsCorrect, whatIsWrong, howItShouldGo]
  );
  return id;
};

export const update = async (id, fields) => {
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
    'SELECT r.*, u.first_name, u.last_name, u.username FROM feedback_replies r JOIN users u ON u.id = r.replied_by WHERE r.feedback_id = ? ORDER BY r.created_at ASC',
    [actualId]
  );
  return rows;
};
