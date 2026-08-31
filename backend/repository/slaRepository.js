import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { SLA_RESOLUTION_HOURS, SLA_RESPONSE_HOURS } from '../config/constants.js';

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
  escalationHours = 0,
  workingHours = null,
}) => {
  const id = uuidv4();
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
      responseHours: responseHours ?? SLA_RESPONSE_HOURS[priority] ?? 4,
      resolutionHours: resolutionHours ?? SLA_RESOLUTION_HOURS[priority] ?? 24,
      escalationHours: escalationHours ?? 0,
      workingHours: workingHours || null,
      description: description || null,
    }
  );
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
  if (responseHours !== undefined) { sets.push('response_hours = :responseHours'); params.responseHours = responseHours; }
  if (resolutionHours !== undefined) { sets.push('resolution_hours = :resolutionHours'); params.resolutionHours = resolutionHours; }
  if (escalationHours !== undefined) { sets.push('escalation_hours = :escalationHours'); params.escalationHours = escalationHours; }
  if (workingHours !== undefined) { sets.push('working_hours = :workingHours'); params.workingHours = workingHours || null; }
  if (description !== undefined) { sets.push('description = :description'); params.description = description || null; }
  if (isActive !== undefined) { sets.push('is_active = :isActive'); params.isActive = isActive ? 1 : 0; }
  if (categoryId !== undefined) { sets.push('category_id = :categoryId'); params.categoryId = categoryId || null; }

  if (!sets.length) return findById(id);
  await pool.query(`UPDATE sla_policies SET ${sets.join(', ')} WHERE id = :id`, params);
  return findById(id);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM sla_policies WHERE id = :id', { id });
};
