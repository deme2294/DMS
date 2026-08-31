import pool from '../config/db.js';

export const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM office_locations WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

export const findAll = async ({ search, buildingId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (employee_name LIKE ? OR employee_number LIKE ? OR building LIKE ? OR description LIKE ? OR address LIKE ? OR office_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (buildingId) {
    where += ' AND building_id = ?';
    params.push(buildingId);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM office_locations ${where}`, params);
  const [rows] = await pool.query(
    `SELECT * FROM office_locations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

export const searchPublic = async (search) => {
  if (!search || !search.trim()) {
    const [rows] = await pool.query(
      'SELECT * FROM office_locations ORDER BY employee_name ASC LIMIT 50'
    );
    return rows;
  }
  const term = `%${search.trim()}%`;
  const [rows] = await pool.query(
    `SELECT * FROM office_locations
     WHERE employee_name LIKE ? OR employee_number LIKE ? OR building LIKE ? OR email LIKE ? OR address LIKE ? OR description LIKE ?
     ORDER BY employee_name ASC`,
    [term, term, term, term, term, term]
  );
  return rows;
};

export const findAvailableForTenant = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT ol.* FROM office_locations ol
     ORDER BY ol.employee_name ASC`
  );
  return rows;
};

export const create = async (location) => {
  const { id, userId, employeeName, employeeNumber, email, phoneExtension, officeNumber, floor, building, buildingId, description, attachment, attachmentName, address, notes } = location;
  const [result] = await pool.query(
    `INSERT INTO office_locations (id, user_id, employee_name, employee_number, email, phone_extension, office_number, floor, building, building_id, description, attachment, attachment_name, address, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, userId, employeeName || null, employeeNumber || null, email || null, phoneExtension || null, officeNumber || null, floor || null, building || null, buildingId || null, description || null, attachment || null, attachmentName || null, address || null, notes || null]
  );
  return id;
};

export const update = async (id, fields) => {
  const sets = [];
  const params = [];
  const dbKeyMap = {
    employeeName: 'employee_name',
    employeeNumber: 'employee_number',
    phoneExtension: 'phone_extension',
    officeNumber: 'office_number',
    buildingId: 'building_id',
    attachmentName: 'attachment_name',
    address: 'address',
    notes: 'notes',
  };
  Object.entries(fields).forEach(([key, value]) => {
    const dbKey = dbKeyMap[key] || key;
    sets.push(`${dbKey} = ?`);
    params.push(value);
  });
  sets.push('updated_at = NOW()');
  params.push(id);
  await pool.query(`UPDATE office_locations SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM office_locations WHERE id = ?', [id]);
};

export const getBuildings = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT building, building_id
     FROM office_locations
     WHERE building IS NOT NULL AND building != ''
     ORDER BY building ASC`
  );
  return rows;
};

export const createBooking = async (booking) => {
  const { id, officeLocationId, tenantId, bookedByUserId, purpose, startDate, endDate, notes } = booking;
  const [result] = await pool.query(
    `INSERT INTO office_bookings (id, office_location_id, tenant_id, booked_by_user_id, purpose, start_date, end_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, officeLocationId, tenantId, bookedByUserId, purpose, startDate, endDate, notes]
  );
  return id;
};

export const findBookingById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ob.*, ol.employee_name, ol.building, ol.office_number, ol.floor, ol.address, ol.latitude, ol.longitude
     FROM office_bookings ob
     JOIN office_locations ol ON ol.id = ob.office_location_id
     WHERE ob.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const findBookingsByTenant = async (tenantId, { page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM office_bookings WHERE tenant_id = ?`,
    [tenantId]
  );
  const [rows] = await pool.query(
    `SELECT ob.*, ol.employee_name, ol.building, ol.office_number, ol.floor, ol.address, ol.latitude, ol.longitude
     FROM office_bookings ob
     JOIN office_locations ol ON ol.id = ob.office_location_id
     WHERE ob.tenant_id = ?
     ORDER BY ob.created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, Number(limit), Number(offset)]
  );
  return {
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

export const findBookingsByOffice = async (officeLocationId) => {
  const [rows] = await pool.query(
    `SELECT ob.*, u.first_name AS booked_by_first_name, u.last_name AS booked_by_last_name
     FROM office_bookings ob
     JOIN users u ON u.id = ob.booked_by_user_id
     WHERE ob.office_location_id = ?
     ORDER BY ob.created_at DESC`,
    [officeLocationId]
  );
  return rows;
};

export const updateBooking = async (id, fields) => {
  const sets = [];
  const params = [];
  Object.entries(fields).forEach(([key, value]) => {
    sets.push(`${key} = ?`);
    params.push(value);
  });
  sets.push('updated_at = NOW()');
  params.push(id);
  await pool.query(`UPDATE office_bookings SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const removeBooking = async (id) => {
  await pool.query('DELETE FROM office_bookings WHERE id = ?', [id]);
};

export const getOfficeStats = async (tenantId) => {
  const [total] = await pool.query(
    `SELECT COUNT(*) AS total FROM office_locations`
  );
  const [myBookings] = await pool.query(
    `SELECT COUNT(*) AS total FROM office_bookings WHERE tenant_id = ? AND status IN ('pending','confirmed','active')`,
    [tenantId]
  );
  const [byBuilding] = await pool.query(
    `SELECT building, COUNT(*) AS count FROM office_locations GROUP BY building ORDER BY building ASC`
  );
  return {
    totalOffices: Number(total[0]?.total || 0),
    myActiveBookings: Number(myBookings[0]?.total || 0),
    byBuilding: byBuilding,
  };
};
