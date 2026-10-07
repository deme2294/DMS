import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

export const findAll = async ({ search, role, status, departmentId, managerDepartmentIds, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' }) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'username', 'email', 'first_name', 'last_name', 'status'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  let where = 'WHERE 1=1';
  const params = {};

  if (search) {
    where += ` AND (
      u.username LIKE :search OR u.email LIKE :search OR
      u.first_name LIKE :search OR u.last_name LIKE :search OR u.phone LIKE :search OR
      u.user_code LIKE :search
    )`;
    params.search = `%${search}%`;
  }
  if (role) {
    where += ' AND r.name = :role';
    params.role = role;
  }
  if (status) {
    where += ' AND u.status = :status';
    params.status = status;
  }
  if (managerDepartmentIds && managerDepartmentIds.length > 0) {
    const placeholders = managerDepartmentIds.map((_, i) => `:mgrDeptId${i}`).join(',');
    if (departmentId) {
      if (!managerDepartmentIds.includes(departmentId)) {
        where += ' AND 1=0';
      } else {
        where += ' AND EXISTS (SELECT 1 FROM user_departments ud WHERE ud.user_id = u.id AND ud.department_id = :departmentId)';
        params.departmentId = departmentId;
      }
    } else {
      where += ` AND EXISTS (SELECT 1 FROM user_departments ud WHERE ud.user_id = u.id AND ud.department_id IN (${placeholders}))`;
      managerDepartmentIds.forEach((id, i) => { params[`mgrDeptId${i}`] = id; });
    }
  } else if (departmentId) {
    where += ' AND EXISTS (SELECT 1 FROM user_departments ud WHERE ud.user_id = u.id AND ud.department_id = :departmentId)';
    params.departmentId = departmentId;
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT u.id, u.tenant_id, u.role_id, r.name AS role, u.username, u.email,
            u.first_name, u.last_name, u.phone, u.profile_image, u.status, u.theme_preference,
            u.user_code, u.last_login_at, u.created_at, u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY u.${orderCol} ${orderDir}
      LIMIT :limit OFFSET :offset`,
    { ...params, limit: Number(limit), offset: Number(offset) }
  );

  const userIds = rows.map((r) => r.id);

  let departmentsMap = {};
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    const [deptRows] = await pool.query(
      `SELECT ud.user_id, d.id, d.name, d.code
       FROM user_departments ud
       JOIN departments d ON d.id = ud.department_id
       WHERE ud.user_id IN (${placeholders})`,
      userIds
    );
    for (const row of deptRows) {
      if (!departmentsMap[row.user_id]) departmentsMap[row.user_id] = [];
      departmentsMap[row.user_id].push({ id: row.id, name: row.name, code: row.code });
    }
  }

  return {
    data: rows.map((row) => ({
      ...row,
      departments: departmentsMap[row.id] || [],
    })),
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.tenant_id, u.role_id, r.name AS role, u.username, u.email,
            u.first_name, u.last_name, u.phone, u.profile_image, u.status, u.theme_preference,
            u.user_code, u.last_login_at, u.created_at, u.updated_at,
            t.organization_name AS tenant_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = :id OR u.user_code = :id
      LIMIT 1`,
    { id }
  );
  if (!rows.length) return null;
  const user = rows[0];

  const [deptRows] = await pool.query(
    `SELECT d.id, d.name, d.code
     FROM user_departments ud
     JOIN departments d ON d.id = ud.department_id
     WHERE ud.user_id = :id`,
    { id }
  );

  return {
    ...user,
    departments: deptRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
  };
};

export const findByUsername = async (username, excludeId = null) => {
  let sql = 'SELECT id FROM users WHERE username = :username';
  const params = { username };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const findByEmail = async (email, excludeId = null) => {
  let sql = 'SELECT id FROM users WHERE email = :email';
  const params = { email };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const create = async (user) => {
  await pool.query(
    `INSERT INTO users
       (id, tenant_id, role_id, username, email, password_hash, first_name, last_name, phone, profile_image, status, user_code)
      VALUES
       (:id, :tenantId, :roleId, :username, :email, :passwordHash, :firstName, :lastName, :phone, :profileImage, :status, :userCode)`,
    user
  );
};

export const update = async (id, fields) => {
  const allowed = ['tenant_id', 'role_id', 'username', 'email', 'first_name', 'last_name', 'phone', 'profile_image', 'status', 'theme_preference'];
  const sets = [];
  const params = { id };

  Object.entries(fields).forEach(([key, value]) => {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = :${key}`);
      params[key] = value;
    }
  });

  if (!sets.length) return;
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = :id`, params);
};

export const updatePassword = async (id, passwordHash) => {
  await pool.query(
    `UPDATE users SET password_hash = :passwordHash, failed_login_attempts = 0, locked_until = NULL WHERE id = :id`,
    { id, passwordHash }
  );
};

export const remove = async (id) => {
  await pool.query('DELETE FROM users WHERE id = :id', { id });
};

export const setDepartment = async (userId, departmentId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_departments WHERE user_id = :userId', { userId });

    if (departmentId) {
      await conn.query(
        `INSERT INTO user_departments (id, user_id, department_id)
         VALUES (UUID(), :userId, :departmentId)`,
        { userId, departmentId }
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

export const getAllRoles = async () => {
  const [rows] = await pool.query('SELECT id, name, description FROM roles ORDER BY id');
  return rows;
};

export const findRoleById = async (roleId) => {
  const [rows] = await pool.query(
    'SELECT id, name, description FROM roles WHERE id = :id LIMIT 1',
    { id: roleId }
  );
  return rows[0] || null;
};

export const countByRole = async (roleName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = :roleName`,
    { roleName }
  );
  return rows[0].total;
};

/**
 * Resolve the set of active users that should receive a notice for the given
 * target audience.
 *   - 'all'            → every active user
 *   - 'admin'|'manager'|'staff'|'tenant' → users whose role name matches
 *   - 'department'     → active users assigned to any department
 * Returns [{ id, email, first_name }]
 */
export const getAudienceUsers = async (audience) => {
  const roleNames = ['admin', 'manager', 'staff', 'tenant'];
  let sql;

  if (audience === 'all') {
    sql = `SELECT u.id, u.email, u.first_name
           FROM users u
           WHERE u.status = 'active'`;
  } else if (audience === 'department') {
    sql = `SELECT DISTINCT u.id, u.email, u.first_name
           FROM users u
           JOIN user_departments ud ON ud.user_id = u.id
           WHERE u.status = 'active'`;
  } else if (roleNames.includes(audience)) {
    sql = `SELECT u.id, u.email, u.first_name
           FROM users u
           JOIN roles r ON r.id = u.role_id
           WHERE u.status = 'active' AND r.name = :audience`;
  } else {
    return [];
  }

  const [rows] = await pool.query(sql, { audience });
  return rows;
};

export const getNextUserCode = async () => {
  const [rows] = await pool.query(
    `SELECT user_code FROM users WHERE user_code REGEXP '^[0-9]{4,6}$' ORDER BY CAST(user_code AS UNSIGNED) DESC LIMIT 1`
  );
  let nextNum = 1001;
  if (rows.length && rows[0].user_code) {
    const val = parseInt(rows[0].user_code, 10);
    if (!isNaN(val) && val >= 1000 && val < 999999) {
      nextNum = val + 1;
    }
  }

  while (true) {
    const code = String(nextNum);
    const [exists] = await pool.query('SELECT id FROM users WHERE user_code = :code LIMIT 1', { code });
    if (!exists.length) {
      return code;
    }
    nextNum++;
  }
};
