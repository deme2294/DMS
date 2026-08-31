import pool from '../config/db.js';

const statsSelect = `
  (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
  (SELECT COUNT(*) FROM tickets tk WHERE tk.tenant_id = t.id) AS ticket_count
`;

export const findAll = async ({
  search,
  status,
  page = 1,
  limit = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'organization_name', 'contact_person', 'email', 'status'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = 'WHERE 1=1';
  const params = {};

  if (search) {
    where += ` AND (
      t.organization_name LIKE :search OR
      t.contact_person LIKE :search OR
      t.email LIKE :search OR
      t.phone LIKE :search OR
      t.address LIKE :search OR
      t.registration_number LIKE :search
    )`;
    params.search = `%${search}%`;
  }

  if (status) {
    where += ' AND t.status = :status';
    params.status = status;
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM tenants t ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT t.*, ${statsSelect}
     FROM tenants t
     ${where}
     ORDER BY t.${orderCol} ${orderDir}
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
    `SELECT t.*, ${statsSelect}
     FROM tenants t
     WHERE t.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByEmail = async (email, excludeId = null) => {
  let sql = 'SELECT id FROM tenants WHERE email = :email';
  const params = { email };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const findByUsername = async (username, excludeId = null) => {
  let sql = 'SELECT id FROM tenants WHERE username = :username';
  const params = { username };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const findByRegistrationNumber = async (registrationNumber, excludeId = null) => {
  let sql = 'SELECT id FROM tenants WHERE registration_number = :registrationNumber';
  const params = { registrationNumber };
  if (excludeId) {
    sql += ' AND id != :excludeId';
    params.excludeId = excludeId;
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

export const create = async (tenant) => {
  await pool.query(
    `INSERT INTO tenants
      (id, organization_name, registration_number, contact_person, email, phone, address, notes, status, username, password, created_by)
     VALUES
      (:id, :organizationName, :registrationNumber, :contactPerson, :email, :phone, :address, :notes, :status, :username, :password, :createdBy)`,
    tenant
  );
};

export const update = async (id, fields) => {
  const allowed = [
    'organization_name',
    'registration_number',
    'contact_person',
    'email',
    'phone',
    'address',
    'notes',
    'status',
    'username',
    'password',
    'created_by',
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
  await pool.query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = :id`, params);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM tenants WHERE id = :id', { id });
};

export const countUsers = async (id) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM users WHERE tenant_id = :id',
    { id }
  );
  return rows[0].total;
};

export const countTickets = async (id) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM tickets WHERE tenant_id = :id',
    { id }
  );
  return rows[0].total;
};

export const getTenantRoleId = async () => {
  const [rows] = await pool.query(
    `SELECT id FROM roles WHERE name = 'tenant' LIMIT 1`
  );
  return rows[0]?.id;
};

export const createTenantUser = async (user) => {
  await pool.query(
    `INSERT INTO users
      (id, tenant_id, role_id, username, email, password_hash, first_name, last_name, phone, status, user_code)
     VALUES
      (:id, :tenantId, :roleId, :username, :email, :passwordHash, :firstName, :lastName, :phone, :status, :userCode)`,
    user
  );
};

export const findUsersByTenantId = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.tenant_id = :tenantId AND r.name = 'tenant'
     ORDER BY u.created_at DESC`,
    { tenantId }
  );
  return rows;
};
