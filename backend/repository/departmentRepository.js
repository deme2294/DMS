import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const headSelect = `
  u.first_name AS head_first_name,
  u.last_name AS head_last_name,
  u.email AS head_email,
  CONCAT(u.first_name, ' ', u.last_name) AS head_name
`;

const userCountSelect = `
  (
    SELECT COUNT(*)
    FROM user_departments ud
    WHERE ud.department_id = d.id
  ) AS user_count
`;

export const findByIds = async (ids) => {
  if (!ids || !ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT d.*, ${headSelect}, ${userCountSelect}
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_user_id
     WHERE d.id IN (${placeholders})
     ORDER BY d.created_at DESC`,
    ids
  );
  return rows;
};

export const findAll = async ({
  search,
  status,
  page = 1,
  limit = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'name', 'code', 'status'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = 'WHERE 1=1';
  const params = {};

  if (search) {
    where += ` AND (
      d.name LIKE :search OR d.code LIKE :search OR d.description LIKE :search
    )`;
    params.search = `%${search}%`;
  }

  if (status) {
    where += ' AND d.status = :status';
    params.status = status;
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM departments d ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT d.*, ${headSelect}, ${userCountSelect}
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_user_id
     ${where}
     ORDER BY d.${orderCol} ${orderDir}
     LIMIT :limit OFFSET :offset`,
    { ...params, limit: Number(limit), offset: Number(offset) }
  );

  return {
    data: rows,
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
    `SELECT d.*, ${headSelect}, ${userCountSelect}
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_user_id
     WHERE d.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByName = async (name, excludeId = null) => {
  let sql = 'SELECT id FROM departments WHERE name = :name';
  const params = { name };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const findByCode = async (code, excludeId = null) => {
  let sql = 'SELECT id FROM departments WHERE code = :code';
  const params = { code };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const create = async (dept) => {
  await pool.query(
    `INSERT INTO departments (id, name, code, description, head_user_id, status)
     VALUES (:id, :name, :code, :description, :headUserId, :status)`,
    dept
  );
};

export const update = async (id, fields) => {
  const allowed = ['name', 'code', 'description', 'head_user_id', 'status'];
  const sets = [];
  const params = { id };

  Object.entries(fields).forEach(([key, value]) => {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = :${key}`);
      params[key] = value;
    }
  });

  if (!sets.length) return;
  await pool.query(`UPDATE departments SET ${sets.join(', ')} WHERE id = :id`, params);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM departments WHERE id = :id', { id });
};

export const countAssignedUsers = async (id) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM user_departments WHERE department_id = :id',
    { id }
  );
  return rows[0].total;
};

/** Lightweight list for dropdowns (Users module, Matrix, etc.) */
export const findAllActive = async () => {
  const [rows] = await pool.query(
    `SELECT id, name, code
     FROM departments
     WHERE status = 'active'
     ORDER BY name ASC`
  );
  return rows;
};

/** Users eligible to be department head (admin/manager/staff, active) */
export const findEligibleHeads = async () => {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active'
       AND r.name IN ('admin', 'manager', 'staff')
     ORDER BY u.first_name, u.last_name`
  );
  return rows;
};

/** Members (users) assigned to a department */
export const getMembers = async (departmentId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.status, r.name AS role
     FROM user_departments ud
     JOIN users u ON u.id = ud.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE ud.department_id = :departmentId
     ORDER BY u.first_name, u.last_name`,
    { departmentId }
  );
  return rows;
};

/** Replace a department's full member set (active users only). */
export const setMembers = async (departmentId, userIds = []) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_departments WHERE department_id = :departmentId', { departmentId });
    for (const userId of userIds) {
      await conn.query(
        `INSERT INTO user_departments (id, user_id, department_id)
         VALUES (:id, :userId, :departmentId)`,
        { id: uuidv4(), userId, departmentId }
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};