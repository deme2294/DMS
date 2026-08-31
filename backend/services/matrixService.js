import { v4 as uuidv4 } from 'uuid';
import * as matrixRepo from '../repository/matrixRepository.js';
import { sanitizeAssignment } from '../models/UserDepartment.js';
import pool from '../config/db.js';

export const listAssignments = async (query, managerDepartmentIds = null, isManager = false) => {
  const result = await matrixRepo.findAssignments(query, managerDepartmentIds, isManager);
  return {
    ...result,
    data: result.data.map(sanitizeAssignment),
  };
};

export const getAssignment = async (id) => {
  const row = await matrixRepo.findAssignmentById(id);
  if (!row) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
  return sanitizeAssignment(row);
};

export const getMatrixGrid = async (managerDepartmentIds = null) => {
  let departments;
  let users;
  let assignments;

  if (managerDepartmentIds && managerDepartmentIds.length > 0) {
    const placeholders = managerDepartmentIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id, name, code, status
       FROM departments
       WHERE id IN (${placeholders})
       ORDER BY name ASC`,
      managerDepartmentIds
    );
    departments = rows;

    const [userRows] = await pool.query(
      `SELECT DISTINCT ud.user_id
       FROM user_departments ud
       WHERE ud.department_id IN (${placeholders})`,
      managerDepartmentIds
    );
    const userIdsInDepts = userRows.map((r) => r.user_id);

    if (userIdsInDepts.length > 0) {
      const uPlaceholders = userIdsInDepts.map(() => '?').join(',');
      const [uRows] = await pool.query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.email, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.status = 'active'
           AND r.name IN ('admin', 'manager', 'staff')
           AND u.id IN (${uPlaceholders})
         ORDER BY u.first_name, u.last_name`,
        userIdsInDepts
      );
      users = uRows;
    } else {
      users = [];
    }

    [assignments] = await pool.query(
      `SELECT user_id, department_id
       FROM user_departments
       WHERE department_id IN (${placeholders})`,
      managerDepartmentIds
    );
  } else {
    // Admin / unrestricted view: return ALL active departments, active users, and assignments
    const [dRows] = await pool.query(
      `SELECT id, name, code, status
       FROM departments
       WHERE status = 'active'
       ORDER BY name ASC`
    );
    departments = dRows;

    const [uRows] = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'active'
         AND r.name IN ('admin', 'manager', 'staff')
       ORDER BY u.first_name, u.last_name`
    );
    users = uRows;

    const [aRows] = await pool.query(
      `SELECT user_id, department_id
       FROM user_departments`
    );
    assignments = aRows;
  }

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

export const assignUserToDepartment = async (userId, departmentId, managerDepartmentIds = null) => {
  if (managerDepartmentIds && managerDepartmentIds.length > 0 && departmentId && !managerDepartmentIds.includes(departmentId)) {
    throw Object.assign(new Error('Access denied: cannot assign users outside your departments'), { statusCode: 403 });
  }

  const user = await matrixRepo.validateUser(userId);
  if (!user) throw Object.assign(new Error('Invalid user for matrix assignment'), { statusCode: 400 });

  if (departmentId) {
    const dept = await matrixRepo.validateDepartment(departmentId);
    if (!dept) {
      throw Object.assign(new Error(`Invalid or inactive department: ${departmentId}`), { statusCode: 400 });
    }

    const existing = await matrixRepo.findAssignmentByUser(userId);
    if (existing && existing.department_id !== departmentId) {
      throw Object.assign(new Error('User already assigned to another department'), { statusCode: 409 });
    }
  }

  await matrixRepo.replaceUserDepartment(userId, departmentId || null);
  return getMatrixGrid(managerDepartmentIds);
};

export const assignDepartmentToUser = async (departmentId, userId, managerDepartmentIds = null) => {
  if (managerDepartmentIds && managerDepartmentIds.length > 0 && departmentId && !managerDepartmentIds.includes(departmentId)) {
    throw Object.assign(new Error('Access denied: cannot assign users outside your departments'), { statusCode: 403 });
  }

  if (departmentId) {
    const dept = await matrixRepo.validateDepartment(departmentId);
    if (!dept) throw Object.assign(new Error('Invalid or inactive department'), { statusCode: 400 });
  }

  if (userId) {
    const user = await matrixRepo.validateUser(userId);
    if (!user) {
      throw Object.assign(new Error(`Invalid user for matrix assignment: ${userId}`), { statusCode: 400 });
    }
  }

  if (userId && departmentId) {
    const existing = await matrixRepo.findAssignmentByUser(userId);
    if (existing && existing.department_id !== departmentId) {
      throw Object.assign(new Error('User already assigned to another department'), { statusCode: 409 });
    }
  }

  await matrixRepo.replaceDepartmentUser(departmentId || null, userId || null);
  return getMatrixGrid(managerDepartmentIds);
};

export const createAssignment = async ({ userId, departmentId }, managerDepartmentIds = null) => {
  if (managerDepartmentIds && managerDepartmentIds.length > 0 && !managerDepartmentIds.includes(departmentId)) {
    throw Object.assign(new Error('Access denied: cannot assign users outside your departments'), { statusCode: 403 });
  }

  const user = await matrixRepo.validateUser(userId);
  if (!user) throw Object.assign(new Error('Invalid user for matrix assignment'), { statusCode: 400 });

  const dept = await matrixRepo.validateDepartment(departmentId);
  if (!dept) throw Object.assign(new Error('Invalid or inactive department'), { statusCode: 400 });

  const existing = await matrixRepo.findAssignmentByPair(userId, departmentId);
  if (existing) {
    throw Object.assign(new Error('Assignment already exists'), { statusCode: 409 });
  }

  const existingAssignment = await matrixRepo.findAssignmentByUser(userId);
  if (existingAssignment && existingAssignment.department_id !== departmentId) {
    throw Object.assign(new Error('User already assigned to another department'), { statusCode: 409 });
  }

  const id = uuidv4();
  await matrixRepo.createAssignment({ id, userId, departmentId });
  return getAssignment(id);
};

export const toggleAssignment = async ({ userId, departmentId, assigned }, managerDepartmentIds = null) => {
  if (managerDepartmentIds && managerDepartmentIds.length > 0 && !managerDepartmentIds.includes(departmentId)) {
    throw Object.assign(new Error('Access denied: cannot assign users outside your departments'), { statusCode: 403 });
  }

  if (assigned) {
    const existing = await matrixRepo.findAssignmentByPair(userId, departmentId);
    if (existing) {
      return getAssignment(existing.id);
    }
    return createAssignment({ userId, departmentId }, managerDepartmentIds);
  }

  const existing = await matrixRepo.findAssignmentByPair(userId, departmentId);
  if (!existing) {
    return { userId, departmentId, assigned: false };
  }

  await matrixRepo.deleteAssignmentByPair(userId, departmentId);
  return { userId, departmentId, assigned: false };
};

export const updateAssignment = async (id, { userId, departmentId }, managerDepartmentIds = null) => {
  const existing = await matrixRepo.findAssignmentById(id);
  if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });

  const nextUserId = userId || existing.user_id;
  const nextDepartmentId = departmentId || existing.department_id;

  if (managerDepartmentIds && managerDepartmentIds.length > 0 && !managerDepartmentIds.includes(nextDepartmentId)) {
    throw Object.assign(new Error('Access denied: cannot assign users outside your departments'), { statusCode: 403 });
  }

  const duplicate = await matrixRepo.findAssignmentByPair(nextUserId, nextDepartmentId);
  if (duplicate && duplicate.id !== id) {
    throw Object.assign(new Error('Assignment already exists'), { statusCode: 409 });
  }

  const existingAssignment = await matrixRepo.findAssignmentByUser(nextUserId);
  if (existingAssignment && existingAssignment.department_id !== nextDepartmentId) {
    throw Object.assign(new Error('User already assigned to another department'), { statusCode: 409 });
  }

  // Atomic replace inside a transaction
  const newId = uuidv4();
  await matrixRepo.replaceAssignment(id, { id: newId, userId: nextUserId, departmentId: nextDepartmentId });
  return getAssignment(newId);
};

export const deleteAssignment = async (id, managerDepartmentIds = null) => {
  const existing = await matrixRepo.findAssignmentById(id);
  if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });

  if (managerDepartmentIds && managerDepartmentIds.length > 0 && !managerDepartmentIds.includes(existing.department_id)) {
    throw Object.assign(new Error('Access denied: cannot delete assignments outside your departments'), { statusCode: 403 });
  }

  await matrixRepo.deleteAssignment(id);
};

export const deleteAssignmentByPair = async (userId, departmentId, managerDepartmentIds = null) => {
  const existing = await matrixRepo.findAssignmentByPair(userId, departmentId);
  if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });

  if (managerDepartmentIds && managerDepartmentIds.length > 0 && !managerDepartmentIds.includes(departmentId)) {
    throw Object.assign(new Error('Access denied: cannot delete assignments outside your departments'), { statusCode: 403 });
  }

  await matrixRepo.deleteAssignmentByPair(userId, departmentId);
};