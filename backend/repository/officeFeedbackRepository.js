import pool from '../config/db.js';

export const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM office_feedback WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

export const findByOffice = async (officeLocationId) => {
  const [rows] = await pool.query(
    `SELECT of.*, u.first_name, u.last_name, u.username, t.organization_name AS tenant_name
     FROM office_feedback of
     JOIN users u ON u.id = of.user_id
     JOIN tenants t ON t.id = of.tenant_id
     WHERE of.office_location_id = ?
     ORDER BY of.created_at DESC`,
    [officeLocationId]
  );
  return rows;
};

export const findByOfficeAndTenant = async (officeLocationId, tenantId) => {
  const [rows] = await pool.query(
    'SELECT * FROM office_feedback WHERE office_location_id = ? AND tenant_id = ? ORDER BY created_at DESC',
    [officeLocationId, tenantId]
  );
  return rows;
};

export const create = async (feedback) => {
  const { id, officeLocationId, tenantId, userId, subject, message, rating, status } = feedback;
  const [result] = await pool.query(
    `INSERT INTO office_feedback (id, office_location_id, tenant_id, user_id, subject, message, rating, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, officeLocationId, tenantId, userId, subject, message, rating || null, status || 'pending']
  );
  return id;
};

export const update = async (id, fields) => {
  const sets = [];
  const params = [];
  Object.entries(fields).forEach(([key, value]) => {
    sets.push(`${key} = ?`);
    params.push(value);
  });
  sets.push('updated_at = NOW()');
  params.push(id);
  await pool.query(`UPDATE office_feedback SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM office_feedback WHERE id = ?', [id]);
};
