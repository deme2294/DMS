import { v4 as uuidv4 } from 'uuid';
import * as deptRepo from '../repository/departmentRepository.js';
import pool from '../config/db.js';
import { sanitizeDepartment } from '../models/Department.js';

const validateHeadUser = async (headUserId) => {
  if (!headUserId) return;

  const [rows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = :headUserId
       AND u.status = 'active'
       AND r.name IN ('admin', 'manager', 'staff')
     LIMIT 1`,
    { headUserId }
  );

  if (!rows.length) {
    throw Object.assign(new Error('Invalid department head user'), { statusCode: 400 });
  }
};

const validateMemberUsers = async (userIds) => {
  const ids = [...new Set(userIds || [])];
  if (!ids.length) return ids;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE id IN (${placeholders}) AND status = 'active'`,
    ids
  );
  if (rows.length !== ids.length) {
    throw Object.assign(
      new Error('One or more selected users are invalid or inactive'),
      { statusCode: 400 }
    );
  }
  return ids;
};

const validateNoDuplicateDepartments = async (userIds, excludeDepartmentId = null) => {
  const ids = [...new Set(userIds || [])];
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(',');
  let query = `SELECT user_id, department_id FROM user_departments WHERE user_id IN (${placeholders})`;
  const params = [...ids];

  if (excludeDepartmentId) {
    query += ' AND department_id != ?';
    params.push(excludeDepartmentId);
  }

  const [rows] = await pool.query(query, params);
  if (rows.length > 0) {
    throw Object.assign(
      new Error('User already assigned to another department'),
      { statusCode: 409 }
    );
  }
};

export const listDepartments = async (query, managerDepartmentIds = null, isManager = false) => {
  if (isManager) {
    const rows = Array.isArray(managerDepartmentIds) && managerDepartmentIds.length > 0
      ? await deptRepo.findByIds(managerDepartmentIds)
      : [];
    return {
      data: rows.map(sanitizeDepartment),
      pagination: {
        total: rows.length,
        page: 1,
        limit: rows.length || 10,
        totalPages: 1,
      },
    };
  }
  const result = await deptRepo.findAll(query);
  return {
    ...result,
    data: result.data.map(sanitizeDepartment),
  };
};

export const getDepartment = async (id) => {
  const dept = await deptRepo.findById(id);
  if (!dept) throw Object.assign(new Error('Department not found'), { statusCode: 404 });
  return sanitizeDepartment(dept);
};

export const createDepartment = async (payload) => {
  const existingName = await deptRepo.findByName(payload.name);
  if (existingName) {
    throw Object.assign(new Error('Department name already exists'), { statusCode: 409 });
  }

  const existingCode = await deptRepo.findByCode(payload.code);
  if (existingCode) {
    throw Object.assign(new Error('Department code already exists'), { statusCode: 409 });
  }

  await validateHeadUser(payload.headUserId);

  // Generate a concise 4 to 6 symbol department ID (e.g. IT-01, HR-01, FIN-01)
  const cleanCode = (payload.code || 'DEP').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let basePrefix = cleanCode.slice(0, 3);
  if (basePrefix.length < 2) basePrefix = (cleanCode + 'X').slice(0, 2);

  let id = `${basePrefix}-01`;
  let suffix = 1;
  while (await deptRepo.findById(id)) {
    suffix += 1;
    const numStr = String(suffix).padStart(2, '0');
    id = `${basePrefix}-${numStr}`.slice(0, 6);
  }

  await deptRepo.create({
    id,
    name: payload.name,
    code: payload.code.toUpperCase(),
    description: payload.description || null,
    headUserId: payload.headUserId || null,
    status: payload.status || 'active',
  });

  if (payload.memberIds?.length) {
    const ids = await validateMemberUsers(payload.memberIds);
    await validateNoDuplicateDepartments(ids);
    await deptRepo.setMembers(id, ids);
  }

  return getDepartment(id);
};

export const updateDepartment = async (id, payload) => {
  const existing = await deptRepo.findById(id);
  if (!existing) throw Object.assign(new Error('Department not found'), { statusCode: 404 });

  if (payload.name) {
    const dup = await deptRepo.findByName(payload.name, id);
    if (dup) throw Object.assign(new Error('Department name already exists'), { statusCode: 409 });
  }

  if (payload.code) {
    const dup = await deptRepo.findByCode(payload.code, id);
    if (dup) throw Object.assign(new Error('Department code already exists'), { statusCode: 409 });
  }

  if (payload.headUserId !== undefined) {
    await validateHeadUser(payload.headUserId);
  }

  await deptRepo.update(id, {
    name: payload.name,
    code: payload.code ? payload.code.toUpperCase() : undefined,
    description: payload.description,
    head_user_id: payload.headUserId,
    status: payload.status,
  });

  if (payload.memberIds !== undefined) {
    const ids = await validateMemberUsers(payload.memberIds);
    await validateNoDuplicateDepartments(ids, id);
    await deptRepo.setMembers(id, ids);
  }

  return getDepartment(id);
};

export const deleteDepartment = async (id) => {
  const existing = await deptRepo.findById(id);
  if (!existing) throw Object.assign(new Error('Department not found'), { statusCode: 404 });

  const assignedCount = await deptRepo.countAssignedUsers(id);
  if (assignedCount > 0) {
    throw Object.assign(
      new Error('Cannot delete department with assigned users. Reassign users first.'),
      { statusCode: 400 }
    );
  }

  await deptRepo.remove(id);
};

export const activateDepartment = async (id) => updateDepartment(id, { status: 'active' });
export const deactivateDepartment = async (id) => updateDepartment(id, { status: 'inactive' });

export const getActiveDepartments = async () => {
  const rows = await deptRepo.findAllActive();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
  }));
};

export const getEligibleHeads = async () => {
  const rows = await deptRepo.findEligibleHeads();
  return rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    fullName: `${row.first_name} ${row.last_name}`,
  }));
};

export const getMyDepartmentIds = async (userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT d.id
     FROM departments d
     LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.user_id = :userId
     WHERE d.head_user_id = :userId OR ud.user_id = :userId`,
    { userId }
  );
  return rows.map((r) => r.id);
};

export const getDepartmentMembers = async (id) => {
  const dept = await deptRepo.findById(id);
  if (!dept) throw Object.assign(new Error('Department not found'), { statusCode: 404 });
  return deptRepo.getMembers(id);
};

export const assignUsers = async (id, userIds = []) => {
  const dept = await deptRepo.findById(id);
  if (!dept) throw Object.assign(new Error('Department not found'), { statusCode: 404 });
  const ids = await validateMemberUsers(userIds);
  await validateNoDuplicateDepartments(ids, id);
  await deptRepo.setMembers(id, ids);
  return getDepartment(id);
};