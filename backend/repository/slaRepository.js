import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { SLA_RESOLUTION_HOURS, SLA_RESPONSE_HOURS } from '../config/constants.js';

export const getNextSlaId = async () => {
  const [rows] = await pool.query(
    "SELECT id FROM sla_policies WHERE id REGEXP '^[0-9]{4}$' ORDER BY CAST(id AS UNSIGNED) DESC LIMIT 1"
  );
  let nextNum = 5001;
  if (rows.length && rows[0].id) {
    const val = parseInt(rows[0].id, 10);
    if (!isNaN(val) && val >= 5000 && val < 5999) {
      nextNum = val + 1;
    }
  }
  while (nextNum <= 5999) {
    const idStr = String(nextNum);
    const [exists] = await pool.query('SELECT id FROM sla_policies WHERE id = :idStr LIMIT 1', { idStr });
    if (!exists.length) return idStr;
    nextNum++;
  }
  return String(nextNum);
};


export const findAll = async (includeInactive = false, categoryId = null) => {
  let where = includeInactive ? '' : 'WHERE is_active = 1';
  const params = {};
  if (categoryId) {
    const clause = 'category_id = :categoryId';
    where += where ? ` AND ${clause}` : `WHERE ${clause}`;
    params.categoryId = categoryId;
  }
  const [rows] = await pool.query(
    `SELECT id, name, priority, category_id, response_hours, resolution_hours, escalation_hours,
            working_hours, description, is_active, created_at, updated_at
     FROM sla_policies ${where} ORDER BY FIELD(priority, 'urgent','high','medium','low')`,
    params
  );
  return rows;
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, name, priority, category_id, response_hours, resolution_hours, escalation_hours,
            working_hours, description, is_active, created_at, updated_at
     FROM sla_policies WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByPriority = async (priority, categoryId = null) => {
  const [rows] = await pool.query(
    `SELECT id, name, priority, category_id, response_hours, resolution_hours, escalation_hours,
             working_hours, description
      FROM sla_policies WHERE priority = :priority AND category_id <=> :categoryId AND is_active = 1 LIMIT 1`,
    { priority, categoryId }
  );
  return rows[0] || null;
};


export const findByPriorityAndCategory = async (priority, categoryId = null, excludeId = null) => {
  let sql = `SELECT id, name, priority, category_id, is_active
             FROM sla_policies
             WHERE LOWER(priority) = LOWER(:priority) AND category_id <=> :categoryId`;
  const params = { priority, categoryId };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  sql += ' LIMIT 1';
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const findByName = async (name, categoryId = null) => {
  const [rows] = await pool.query(
    `SELECT id, name, priority, category_id, response_hours, resolution_hours, escalation_hours,
             working_hours, description
      FROM sla_policies WHERE name = :name AND category_id <=> :categoryId AND is_active = 1 LIMIT 1`,
    { name, categoryId }
  );
  return rows[0] || null;
};

// Resolve the effective policy for a category+priority: prefer a category-specific
// policy, falling back to the global (category_id IS NULL) default.
export const findPolicyByCategoryAndPriority = async (categoryId = null, priority) => {
  let sql = `SELECT id, name, priority, category_id, response_hours, resolution_hours,
                    escalation_hours, working_hours, description
             FROM sla_policies WHERE priority = :priority AND is_active = 1`;
  const params = { priority, categoryId };
  if (categoryId) {
    sql += ` AND (category_id = :categoryId OR category_id IS NULL)
             ORDER BY CASE WHEN category_id = :categoryId THEN 0 ELSE 1 END LIMIT 1`;
  } else {
    sql += ` AND category_id IS NULL LIMIT 1`;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const create = async ({
  name,
  priority,
  responseHours,
  resolutionHours,
  description,
  categoryId = null,
  escalationHours = null,
  workingHours = null,
}) => {
  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO sla_policies
         (id, name, priority, category_id, response_hours, resolution_hours, escalation_hours, working_hours, description)
       VALUES
         (:id, :name, :priority, :categoryId, :responseHours, :resolutionHours, :escalationHours, :workingHours, :description)`,
      {
        id,
        name,
        priority,
        categoryId: categoryId || null,
        responseHours: responseHours !== undefined && responseHours !== null ? Number(responseHours) : (SLA_RESPONSE_HOURS[priority] ?? 4),
        resolutionHours: resolutionHours !== undefined && resolutionHours !== null ? Number(resolutionHours) : (SLA_RESOLUTION_HOURS[priority] ?? 24),
        escalationHours: escalationHours !== null && escalationHours !== undefined && escalationHours !== '' ? Number(escalationHours) : null,
        workingHours: workingHours && typeof workingHours === 'object' ? JSON.stringify(workingHours) : (workingHours || null),
        description: description || null,
      }
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry')) {
      throw Object.assign(
        new Error(`An SLA policy for this category and priority combination already exists. Duplicate SLA policies are not allowed.`),
        { statusCode: 409 }
      );
    }
    throw err;
  }
  return findById(id);
};

export const update = async (id, {
  name,
  priority,
  responseHours,
  resolutionHours,
  description,
  isActive,
  categoryId,
  escalationHours,
  workingHours,
}) => {
  const sets = [];
  const params = { id };
  if (name !== undefined) { sets.push('name = :name'); params.name = name; }
  if (priority !== undefined) { sets.push('priority = :priority'); params.priority = priority; }
  if (responseHours !== undefined) { sets.push('response_hours = :responseHours'); params.responseHours = Number(responseHours); }
  if (resolutionHours !== undefined) { sets.push('resolution_hours = :resolutionHours'); params.resolutionHours = Number(resolutionHours); }
  if (escalationHours !== undefined) {
    sets.push('escalation_hours = :escalationHours');
    params.escalationHours = escalationHours !== null && escalationHours !== undefined && escalationHours !== '' ? Number(escalationHours) : null;
  }
  if (workingHours !== undefined) {
    sets.push('working_hours = :workingHours');
    params.workingHours = workingHours && typeof workingHours === 'object' ? JSON.stringify(workingHours) : (workingHours || null);
  }
  if (description !== undefined) { sets.push('description = :description'); params.description = description || null; }
  if (isActive !== undefined) { sets.push('is_active = :isActive'); params.isActive = isActive ? 1 : 0; }
  if (categoryId !== undefined) { sets.push('category_id = :categoryId'); params.categoryId = categoryId || null; }

  if (!sets.length) return findById(id);
  try {
    await pool.query(`UPDATE sla_policies SET ${sets.join(', ')} WHERE id = :id`, params);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry')) {
      throw Object.assign(
        new Error(`An SLA policy for this category and priority combination already exists. Duplicate SLA policies are not allowed.`),
        { statusCode: 409 }
      );
    }
    throw err;
  }
  return findById(id);
};

export const remove = async (id) => {
  await pool.query('UPDATE ticket_categories SET sla_policy_id = NULL WHERE sla_policy_id = :id', { id });
  await pool.query('DELETE FROM sla_policies WHERE id = :id', { id });
};
