import * as slaService from '../services/slaService.js';
import { HTTP } from '../config/constants.js';

const normalizePolicy = (policy) => {
  if (!policy) return null;
  const {
    is_active,
    category_id,
    response_hours,
    resolution_hours,
    escalation_hours,
    working_hours,
    created_at,
    updated_at,
    ...rest
  } = policy;
  return {
    ...rest,
    categoryId: category_id || null,
    responseHours: Number(response_hours ?? 0),
    resolutionHours: Number(resolution_hours ?? 0),
    escalationHours: Number(escalation_hours ?? 0),
    workingHours: working_hours || null,
    createdAt: created_at || null,
    updatedAt: updated_at || null,
    isActive: Boolean(is_active),
  };
};

const normalizePolicies = (policies) => policies.map(normalizePolicy);

export const listPolicies = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'admin';
    const categoryId = req.query.categoryId || null;
    const data = await slaService.listPolicies(includeInactive, categoryId);
    res.status(HTTP.OK).json({ success: true, data: normalizePolicies(data) });
  } catch (err) {
    next(err);
  }
};

export const getPolicy = async (req, res, next) => {
  try {
    const data = await slaService.getPolicy(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: normalizePolicy(data) });
  } catch (err) {
    next(err);
  }
};

export const createPolicy = async (req, res, next) => {
  try {
    const data = await slaService.createPolicy(req.user, req.body);
    res.status(HTTP.CREATED).json({ success: true, message: 'SLA policy created', data: normalizePolicy(data) });
  } catch (err) {
    next(err);
  }
};

export const updatePolicy = async (req, res, next) => {
  try {
    const data = await slaService.updatePolicy(req.user, req.params.id, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'SLA policy updated', data: normalizePolicy(data) });
  } catch (err) {
    next(err);
  }
};

export const deletePolicy = async (req, res, next) => {
  try {
    await slaService.deletePolicy(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'SLA policy deleted' });
  } catch (err) {
    next(err);
  }
};

export const previewSLA = async (req, res, next) => {
  try {
    const { categoryId, priority } = req.query;
    const createdAt = req.query.createdAt ? new Date(String(req.query.createdAt)) : new Date();
    const dueDates = await slaService.computeDueDate(
      String(priority || 'medium'),
      createdAt,
      categoryId ? String(categoryId) : null
    );
    const policies = await slaService.listPolicies(true, categoryId ? String(categoryId) : null);
    const policy = policies.find(p => p.priority === priority && (!categoryId || p.category_id === categoryId)) || null;

    let categoryName = 'Global';
    if (categoryId) {
      const [catRows] = await pool.query(
        'SELECT name FROM ticket_categories WHERE id = :id LIMIT 1',
        { id: String(categoryId) }
      );
      if (catRows.length) categoryName = catRows[0].name;
    }

    res.status(HTTP.OK).json({
      success: true,
      data: {
        policyId: policy?.id || null,
        policyName: policy?.name || 'Default SLA',
        priority: String(priority || 'medium'),
        category: categoryName,
        categoryId: categoryId || null,
        responseHours: policy?.response_hours ?? 4,
        resolutionHours: policy?.resolution_hours ?? 24,
        escalationHours: policy?.escalation_hours ?? 0,
        responseDueDate: dueDates.responseDueDate,
        resolutionDueDate: dueDates.resolutionDueDate,
        escalationDueDate: dueDates.escalationDueDate,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const testCompute = async (req, res, next) => {
  try {
    const policy = await slaService.getPolicy(req.params.id);
    const createdAt = req.body.createdAt ? new Date(req.body.createdAt) : new Date();
    const dueDates = slaService.computeAllDueDates(policy, createdAt);
    res.status(HTTP.OK).json({
      success: true,
      data: {
        policy,
        createdAt,
        responseDueDate: dueDates.responseDueDate,
        resolutionDueDate: dueDates.resolutionDueDate,
        escalationDueDate: dueDates.escalationDueDate,
      },
    });
  } catch (err) {
    next(err);
  }
};
