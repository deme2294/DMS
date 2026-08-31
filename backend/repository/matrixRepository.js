import pool from '../config/db.js';

export const findDepartmentIdsByUser = async (userId) => {
  const [rows] = await pool.query(
    'SELECT department_id FROM user_departments WHERE user_id = ?',
    [userId]
  );
  return rows.map((r) => r.department_id);
};

export const findAssignments = async ({
  search,
  userId,
  departmentId,
  departmentIds,
  isManager = false,
  page = 1,
  limit = 20,
  sortBy = 'assigned_at',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['assigned_at', 'department_name', 'username'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'assigned_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = 'WHERE 1=1';
  const params = {};

  if (search) {
    where += ` AND (
      u.username LIKE :search OR u.first_name LIKE :search OR u.last_name LIKE :search OR
      u.email LIKE :search OR d.name LIKE :search OR d.code LIKE :search
    )`;
    params.search = `%${search}%`;
  }

  if (userId) {
    where += ' AND ud.user_id = :userId';
    params.userId = userId;
  }

  if (!isManager && departmentId) {
    where += ' AND ud.department_id = :departmentId';
    params.departmentId = departmentId;
  }

  if (isManager && Array.isArray(departmentIds)) {
    if (departmentIds.length > 0) {
      const placeholders = departmentIds.map((_, i) => `:deptId${i}`).join(',');
      where += ` AND ud.department_id IN (${placeholders})`;
      departmentIds.forEach((id, i) => { params[`deptId${i}`] = id; });
    } else {
      where += ' AND 1=0';
    }
  } else if (departmentIds && departmentIds.length > 0) {
    const placeholders = departmentIds.map((_, i) => `:deptId${i}`).join(',');
    where += ` AND ud.department_id IN (${placeholders})`;
    departmentIds.forEach((id, i) => { params[`deptId${i}`] = id; });
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM user_departments ud
     JOIN users u ON u.id = ud.user_id
     JOIN departments d ON d.id = ud.department_id
     ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       ud.id,
       ud.user_id,
       u.username,
       u.first_name,
       u.last_name,
       u.email,
       r.name AS user_role,
       ud.department_id,
       d.name AS department_name,
       d.code AS department_code,
       ud.assigned_at
     FROM user_departments ud
     JOIN users u ON u.id = ud.user_id
     JOIN roles r ON r.id = u.role_id
     JOIN departments d ON d.id = ud.department_id
     ${where}
     ORDER BY ${orderCol} ${orderDir}
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

export const findAssignmentById = async (id) => {
  const [rows] = await pool.query(
    `SELECT
       ud.id,
       ud.user_id,
       u.username,
       u.first_name,
       u.last_name,
       u.email,
       r.name AS user_role,
       ud.department_id,
       d.name AS department_name,
       d.code AS department_code,
       ud.assigned_at
     FROM user_departments ud
     JOIN users u ON u.id = ud.user_id
     JOIN roles r ON r.id = u.role_id
     JOIN departments d ON d.id = ud.department_id
     WHERE ud.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findAssignmentByPair = async (userId, departmentId) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, department_id, assigned_at
     FROM user_departments
     WHERE user_id = :userId AND department_id = :departmentId
     LIMIT 1`,
    { userId, departmentId }
  );
  return rows[0] || null;
};

export const findAssignmentByUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, department_id FROM user_departments WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

export const createAssignment = async ({ id, userId, departmentId }) => {
  await pool.query(
    `INSERT INTO user_departments (id, user_id, department_id)
     VALUES (:id, :userId, :departmentId)`,
    { id, userId, departmentId }
  );
};

export const deleteAssignment = async (id) => {
  await pool.query('DELETE FROM user_departments WHERE id = :id', { id });
};

export const replaceAssignment = async (oldId, { id, userId, departmentId }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_departments WHERE id = :oldId', { oldId });
    await conn.query(
      'INSERT INTO user_departments (id, user_id, department_id) VALUES (:id, :userId, :departmentId)',
      { id, userId, departmentId }
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const deleteAssignmentByPair = async (userId, departmentId) => {
  await pool.query(
    'DELETE FROM user_departments WHERE user_id = :userId AND department_id = :departmentId',
    { userId, departmentId }
  );
};

export const getMatrixGrid = async () => {
  const [departments] = await pool.query(
    `SELECT id, name, code, status
     FROM departments
     ORDER BY name ASC`
  );

  const [users] = await pool.query(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active'
       AND r.name IN ('admin', 'manager', 'staff')
     ORDER BY u.first_name, u.last_name`
  );

  const [assignments] = await pool.query(
    `SELECT user_id, department_id
     FROM user_departments`
  );

  const assignmentMap = assignments.reduce((acc, row) => {
    acc[row.user_id] = row.department_id;
    return acc;
  }, {});

  return {
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      status: d.status,
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      role: u.role,
      departmentId: assignmentMap[u.id] || null,
    })),
  };
};

export const replaceUserDepartment = async (userId, departmentId) => {
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

export const replaceDepartmentUser = async (departmentId, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (departmentId) {
      await conn.query('DELETE FROM user_departments WHERE department_id = :departmentId', { departmentId });
    }

    if (userId && departmentId) {
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

export const validateUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = :userId
       AND u.status = 'active'
       AND r.name IN ('admin', 'manager', 'staff')
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
};

export const validateDepartment = async (departmentId) => {
  const [rows] = await pool.query(
    `SELECT id FROM departments WHERE id = :departmentId AND status = 'active' LIMIT 1`,
    { departmentId }
  );
  return rows[0] || null;
};