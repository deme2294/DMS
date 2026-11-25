import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const getNextCategoryId = async () => {
  const [rows] = await pool.query(
    "SELECT id FROM ticket_categories WHERE id REGEXP '^[0-9]{4}$' ORDER BY CAST(id AS UNSIGNED) DESC LIMIT 1"
  );
  let nextNum = 4001;
  if (rows.length && rows[0].id) {
    const val = parseInt(rows[0].id, 10);
    if (!isNaN(val) && val >= 4000 && val < 4999) {
      nextNum = val + 1;
    }
  }
  while (nextNum <= 4999) {
    const idStr = String(nextNum);
    const [exists] = await pool.query('SELECT id FROM ticket_categories WHERE id = :idStr LIMIT 1', { idStr });
    if (!exists.length) return idStr;
    nextNum++;
  }
  return String(nextNum);
};

export const findAll = async ({ status = 'active', includeInactive = false, includePending = false } = {}) => {
  let where = 'WHERE 1=1';
  if (status === 'inactive' || status === '0') {
    where += ' AND tc.is_active = 0';
  } else if (status === 'all' || includeInactive) {
    // Show both active and inactive
  } else {
    // Default to active only
    where += ' AND tc.is_active = 1';
  }
  if (!includePending) where += " AND tc.status = 'approved'";
  const [rows] = await pool.query(
    `SELECT tc.id, tc.name, tc.description, tc.department_id,
        tc.is_active, tc.status, tc.routing_type, tc.reassign_time_minutes, tc.sla_policy_id,
        tc.requested_by, tc.reviewed_by, tc.reviewed_at, tc.review_notes,
        tc.created_at, tc.updated_at,
        d.name AS department_name,
        CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name,
        CONCAT(ru.first_name, ' ', ru.last_name) AS requested_by_name,
        CONCAT(rv.first_name, ' ', rv.last_name) AS reviewed_by_name,
        sp.name AS sla_policy_name, sp.priority AS sla_priority,
        sp.response_hours AS sla_response_hours, sp.resolution_hours AS sla_resolution_hours,
        sp.escalation_hours AS sla_escalation_hours
      FROM ticket_categories tc
      LEFT JOIN departments d ON d.id = tc.department_id
      LEFT JOIN users cu ON cu.id = tc.created_by
      LEFT JOIN users ru ON ru.id = tc.requested_by
      LEFT JOIN users rv ON rv.id = tc.reviewed_by
      LEFT JOIN sla_policies sp ON sp.id = tc.sla_policy_id
      ${where}
      ORDER BY tc.name ASC`
  );
  return rows;
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT tc.id, tc.name, tc.description, tc.department_id,
        tc.is_active, tc.status, tc.routing_type, tc.reassign_time_minutes, tc.sla_policy_id,
        tc.requested_by, tc.reviewed_by, tc.reviewed_at, tc.review_notes,
        tc.created_at, tc.updated_at,
        d.name AS department_name,
        CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name,
        CONCAT(ru.first_name, ' ', ru.last_name) AS requested_by_name,
        CONCAT(rv.first_name, ' ', rv.last_name) AS reviewed_by_name,
        sp.name AS sla_policy_name, sp.priority AS sla_priority,
        sp.response_hours AS sla_response_hours, sp.resolution_hours AS sla_resolution_hours,
        sp.escalation_hours AS sla_escalation_hours
      FROM ticket_categories tc
      LEFT JOIN departments d ON d.id = tc.department_id
      LEFT JOIN users cu ON cu.id = tc.created_by
      LEFT JOIN users ru ON ru.id = tc.requested_by
      LEFT JOIN users rv ON rv.id = tc.reviewed_by
      LEFT JOIN sla_policies sp ON sp.id = tc.sla_policy_id
      WHERE tc.id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByName = async (name, excludeId = null) => {
  let sql = 'SELECT id FROM ticket_categories WHERE name = :name';
  const params = { name };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const create = async ({
  name,
  description,
  departmentId,
  createdBy,
  status = 'approved',
  requestedBy = null,
  slaPolicyId = null,
  routingType = 'general',
  reassignTimeMinutes = 30,
}) => {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO ticket_categories
       (id, name, description, department_id, is_active, status, routing_type, reassign_time_minutes, sla_policy_id, created_by, requested_by)
     VALUES (:id, :name, :description, :departmentId, 1, :status, :routingType, :reassignTimeMinutes, :slaPolicyId, :createdBy, :requestedBy)`,
    {
      id,
      name,
      description: description || null,
      departmentId: departmentId || null,
      status,
      routingType,
      reassignTimeMinutes: Number(reassignTimeMinutes) || 30,
      slaPolicyId: slaPolicyId || null,
      createdBy,
      requestedBy,
    }
  );
  return findById(id);
};

export const update = async (id, {
  name, description, departmentId, isActive, status, slaPolicyId, routingType, reassignTimeMinutes,
  reviewedBy = null, reviewNotes = null, reviewedAt = null,
}) => {
  const sets = [];
  const params = { id };

  if (name !== undefined) { sets.push('name = :name'); params.name = name; }
  if (description !== undefined) { sets.push('description = :description'); params.description = description || null; }
  if (departmentId !== undefined) { sets.push('department_id = :departmentId'); params.departmentId = departmentId || null; }
  if (isActive !== undefined) { sets.push('is_active = :isActive'); params.isActive = isActive ? 1 : 0; }
  if (status !== undefined) { sets.push('status = :status'); params.status = status; }
  if (slaPolicyId !== undefined) { sets.push('sla_policy_id = :slaPolicyId'); params.slaPolicyId = slaPolicyId || null; }
  if (routingType !== undefined) { sets.push('routing_type = :routingType'); params.routingType = routingType; }
  if (reassignTimeMinutes !== undefined) { sets.push('reassign_time_minutes = :reassignTimeMinutes'); params.reassignTimeMinutes = Number(reassignTimeMinutes) || 30; }
  if (reviewedBy !== undefined) { sets.push('reviewed_by = :reviewedBy'); params.reviewedBy = reviewedBy; }
  if (reviewNotes !== undefined) { sets.push('review_notes = :reviewNotes'); params.reviewNotes = reviewNotes || null; }
  if (reviewedAt !== undefined) { sets.push('reviewed_at = :reviewedAt'); params.reviewedAt = reviewedAt; }

  if (!sets.length) return findById(id);
  await pool.query(`UPDATE ticket_categories SET ${sets.join(', ')} WHERE id = :id`, params);
  return findById(id);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM ticket_categories WHERE id = :id', { id });
};

// ── Ticket category requests (approval history) ──
export const createRequest = async ({
  categoryId, requestedBy, departmentId, name, description, status = 'pending',
}) => {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO ticket_category_requests
       (id, category_id, requested_by, department_id, name, description, status)
     VALUES (:id, :categoryId, :requestedBy, :departmentId, :name, :description, :status)`,
    { id, categoryId, requestedBy, departmentId: departmentId || null, name, description: description || null, status }
  );
  return findRequestById(id);
};

export const findRequestById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ticket_category_requests WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findRequestsByCategory = async (categoryId) => {
  const [rows] = await pool.query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS requested_by_name,
        CONCAT(v.first_name, ' ', v.last_name) AS reviewed_by_name
     FROM ticket_category_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users v ON v.id = r.reviewed_by
     WHERE r.category_id = :categoryId ORDER BY r.created_at DESC`,
    { categoryId }
  );
  return rows;
};

export const listRequests = async (statusFilter = null) => {
  let where = '';
  const params = {};
  if (statusFilter) { where = 'WHERE r.status = :status'; params.status = statusFilter; }
  const [rows] = await pool.query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS requested_by_name,
        CONCAT(v.first_name, ' ', v.last_name) AS reviewed_by_name,
        d.name AS department_name
     FROM ticket_category_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users v ON v.id = r.reviewed_by
     LEFT JOIN departments d ON d.id = r.department_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
};

export const updateRequest = async (id, { status, reviewedBy, reviewNotes, reviewedAt }) => {
  await pool.query(
    `UPDATE ticket_category_requests
       SET status = :status, reviewed_by = :reviewedBy, review_notes = :reviewNotes, reviewed_at = :reviewedAt
     WHERE id = :id`,
    { id, status, reviewedBy, reviewNotes: reviewNotes || null, reviewedAt }
  );
  return findRequestById(id);
};
