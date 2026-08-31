import * as categoryRepo from '../repository/categoryRepository.js';
import * as auditService from './auditService.js';
import pool from '../config/db.js';

const getManagerDepartmentId = async (userId) => {
  const [rows] = await pool.query(
    'SELECT department_id FROM user_departments WHERE user_id = :userId LIMIT 1',
    { userId }
  );
  return rows[0]?.department_id || null;
};

export const listCategories = async (includeInactive = false) =>
  categoryRepo.findAll({ includeInactive });

export const getCategory = async (id) => {
  const cat = await categoryRepo.findById(id);
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  return cat;
};

// Admin creates an approved category immediately
export const createCategory = async (user, { name, description, departmentId, slaPolicyId, routingType = 'general' }) => {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only admin can create approved categories directly'), { statusCode: 403 });
  }
  if (routingType === 'direct' && !departmentId) {
    throw Object.assign(new Error('Direct-routing categories must be linked to a department'), { statusCode: 400 });
  }
  const existing = await categoryRepo.findByName(name);
  if (existing) {
    throw Object.assign(new Error('A category with this name already exists'), { statusCode: 409 });
  }
  const cat = await categoryRepo.create({
    name: name.trim(),
    description,
    departmentId,
    createdBy: user.id,
    status: 'approved',
    slaPolicyId,
    routingType,
  });
  auditService.logAction(user.id, 'create', 'ticket_category', cat.id, { role: user.role, new: cat }).catch(() => { });
  return cat;
};

// Manager creates a category that becomes PENDING admin approval
export const requestCategory = async (user, { name, description, slaPolicyId, routingType = 'general' }) => {
  if (user.role !== 'manager') {
    throw Object.assign(new Error('Only managers can request new categories'), { statusCode: 403 });
  }
  const existing = await categoryRepo.findByName(name);
  if (existing) {
    throw Object.assign(new Error('A category with this name already exists'), { statusCode: 409 });
  }
  const departmentId = await getManagerDepartmentId(user.id);

  const cat = await categoryRepo.create({
    name: name.trim(),
    description,
    departmentId,
    createdBy: user.id,
    status: 'pending',
    requestedBy: user.id,
    slaPolicyId,
    routingType: routingType === 'direct' ? 'direct' : 'general',
  });

  await categoryRepo.createRequest({
    categoryId: cat.id,
    requestedBy: user.id,
    departmentId,
    name: cat.name,
    description: cat.description,
    status: 'pending',
  });

  auditService.logAction(user.id, 'request', 'ticket_category', cat.id, { role: user.role, new: cat }).catch(() => { });
  return cat;
};

export const updateCategory = async (user, id, payload) => {
  if (!['admin', 'manager'].includes(user.role)) {
    throw Object.assign(new Error('Only admin or manager can update categories'), { statusCode: 403 });
  }
  const cat = await categoryRepo.findById(id);
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

  if (payload.name) {
    const existing = await categoryRepo.findByName(payload.name, id);
    if (existing) {
      throw Object.assign(new Error('A category with this name already exists'), { statusCode: 409 });
    }
  }

  const updated = await categoryRepo.update(id, {
    name: payload.name?.trim(),
    description: payload.description,
    departmentId: payload.departmentId,
    isActive: payload.isActive,
    slaPolicyId: payload.slaPolicyId,
    routingType: payload.routingType,
  });

  auditService.logAction(user.id, 'update', 'ticket_category', id, { role: user.role, old: cat, new: updated }).catch(() => { });
  return updated;
};

// Admin approves a pending category request
export const approveCategory = async (user, id, reviewNotes) => {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only admin can approve categories'), { statusCode: 403 });
  }
  const cat = await categoryRepo.findById(id);
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

  const updated = await categoryRepo.update(id, {
    status: 'approved',
    isActive: true,
    reviewedBy: user.id,
    reviewNotes,
    reviewedAt: new Date(),
  });

  const reqs = await categoryRepo.findRequestsByCategory(id);
  if (reqs.length) {
    await categoryRepo.updateRequest(reqs[0].id, {
      status: 'approved',
      reviewedBy: user.id,
      reviewNotes,
      reviewedAt: new Date(),
    });
  }

  auditService.logAction(user.id, 'approve', 'ticket_category', id, { role: user.role, new: updated }).catch(() => { });
  return updated;
};

// Admin rejects a pending category request
export const rejectCategory = async (user, id, reviewNotes) => {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only admin can reject categories'), { statusCode: 403 });
  }
  const cat = await categoryRepo.findById(id);
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

  const updated = await categoryRepo.update(id, {
    status: 'rejected',
    isActive: false,
    reviewedBy: user.id,
    reviewNotes,
    reviewedAt: new Date(),
  });

  const reqs = await categoryRepo.findRequestsByCategory(id);
  if (reqs.length) {
    await categoryRepo.updateRequest(reqs[0].id, {
      status: 'rejected',
      reviewedBy: user.id,
      reviewNotes,
      reviewedAt: new Date(),
    });
  }

  auditService.logAction(user.id, 'reject', 'ticket_category', id, { role: user.role, new: updated }).catch(() => { });
  return updated;
};

export const deleteCategory = async (user, id) => {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only admin can delete categories'), { statusCode: 403 });
  }
  const cat = await categoryRepo.findById(id);
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  await categoryRepo.remove(id);
  auditService.logAction(user.id, 'delete', 'ticket_category', id, { role: user.role, old: cat }).catch(() => { });
};

export const listRequests = async (statusFilter = null) => categoryRepo.listRequests(statusFilter);

