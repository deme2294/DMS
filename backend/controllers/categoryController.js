import * as categoryService from '../services/categoryService.js';
import { HTTP } from '../config/constants.js';

const normalizeCategory = (category) => {
  if (!category) return null;
  const {
    is_active,
    department_id,
    department_name,
    routing_type,
    sla_policy_id,
    sla_policy_name,
    sla_priority,
    sla_response_hours,
    sla_resolution_hours,
    sla_escalation_hours,
    created_by_name,
    requested_by_name,
    reviewed_by_name,
    review_notes,
    reviewed_at,
    created_at,
    updated_at,
    ...rest
  } = category;
  return {
    ...rest,
    isActive: Boolean(is_active),
    departmentId: department_id || null,
    departmentName: department_name || null,
    routingType: routing_type || 'general',
    slaPolicyId: sla_policy_id || null,
    slaPolicyName: sla_policy_name || null,
    slaPriority: sla_priority || null,
    slaResponseHours: sla_response_hours !== null && sla_response_hours !== undefined ? Number(sla_response_hours) : null,
    slaResolutionHours: sla_resolution_hours !== null && sla_resolution_hours !== undefined ? Number(sla_resolution_hours) : null,
    slaEscalationHours: sla_escalation_hours !== null && sla_escalation_hours !== undefined ? Number(sla_escalation_hours) : null,
    createdByName: created_by_name || null,
    requestedByName: requested_by_name || null,
    reviewedByName: reviewed_by_name || null,
    reviewNotes: review_notes || null,
    reviewedAt: reviewed_at || null,
    createdAt: created_at || null,
    updatedAt: updated_at || null,
  };
};

const normalizeCategories = (categories) => categories.map(normalizeCategory);

export const getCategories = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const canFilterStatus = ['admin', 'manager', 'ceo'].includes(role);

    let status = req.query.status;
    if (!status) {
      if (req.query.includeInactive === 'true') {
        status = 'all';
      } else if (req.query.isActive === 'false' || req.query.onlyInactive === 'true') {
        status = 'inactive';
      } else if (req.query.isActive === 'true') {
        status = 'active';
      } else {
        status = 'active';
      }
    }

    // Only authorized roles can view inactive or all categories
    if (!canFilterStatus && status !== 'active') {
      status = 'active';
    }

    const data = await categoryService.listCategories({ status, includeInactive: status === 'all' });
    res.status(HTTP.OK).json({ success: true, data: normalizeCategories(data) });
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const data = await categoryService.getCategory(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const data = req.user.role === 'manager'
      ? await categoryService.requestCategory(req.user, req.body)
      : await categoryService.createCategory(req.user, req.body);
    res.status(HTTP.CREATED).json({ success: true, message: 'Category created', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const data = await categoryService.updateCategory(req.user, req.params.id, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Category updated', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const approveCategory = async (req, res, next) => {
  try {
    const data = await categoryService.approveCategory(req.user, req.params.id, req.body.reviewNotes);
    res.status(HTTP.OK).json({ success: true, message: 'Category approved', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const rejectCategory = async (req, res, next) => {
  try {
    const data = await categoryService.rejectCategory(req.user, req.params.id, req.body.reviewNotes);
    res.status(HTTP.OK).json({ success: true, message: 'Category rejected', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const listRequests = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || null;
    const data = await categoryService.listRequests(statusFilter);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
