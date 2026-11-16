import pool from '../config/db.js';
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
  let parsedWorkingHours = working_hours || null;
  if (typeof working_hours === 'string') {
    try {
      parsedWorkingHours = JSON.parse(working_hours);
    } catch {
      parsedWorkingHours = null;
    }
  }
  return {
    ...rest,
    categoryId: category_id || null,
    responseHours: Number(response_hours ?? 0),
    resolutionHours: Number(resolution_hours ?? 0),
    escalationHours: escalation_hours !== null && escalation_hours !== undefined ? Number(escalation_hours) : null,
    workingHours: parsedWorkingHours,
    createdAt: created_at || null,
    updatedAt: updated_at || null,
    isActive: Boolean(is_active),
  };
};

const normalizePolicies = (policies) => policies.map(normalizePolicy);

export const listPolicies = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && ['admin', 'manager', 'ceo'].includes(req.user?.role);
    let categoryId = req.query.categoryId || null;
    if (categoryId === 'null' || categoryId === 'undefined' || categoryId === '') {
      categoryId = null;
    }
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
    const { categoryId, category, priority } = req.query;
    let catId = categoryId && categoryId !== 'null' && categoryId !== 'undefined' ? String(categoryId) : null;
    const prio = String(priority || 'medium');
    const createdAt = req.query.createdAt ? new Date(String(req.query.createdAt)) : new Date();

    let categoryName = 'Global';
    if (catId) {
      const [catRows] = await pool.query(
        'SELECT id, name FROM ticket_categories WHERE id = :id LIMIT 1',
        { id: catId }
      );
      if (catRows.length) {
        categoryName = catRows[0].name;
      }
    } else if (category && category !== 'null' && category !== 'undefined') {
      const [catRows] = await pool.query(
        'SELECT id, name FROM ticket_categories WHERE name = :name LIMIT 1',
        { name: String(category) }
      );
      if (catRows.length) {
        catId = catRows[0].id;
        categoryName = catRows[0].name;
      } else {
        categoryName = String(category);
      }
    }

    // Resolve specific policy explicitly configured for this category and priority
    const policy = await slaService.findSpecificPolicyForCategoryAndPriority(catId, prio);

    if (!policy) {
      return res.status(HTTP.OK).json({
        success: true,
        data: {
          exists: false,
          hasPolicy: false,
          policyId: null,
          policyName: null,
          priority: prio,
          category: categoryName,
          categoryId: catId,
          message: 'SLA is not created for the ticket categories and priority given',
        },
      });
    }

    const dueDates = slaService.computeAllDueDates(policy, createdAt);

    res.status(HTTP.OK).json({
      success: true,
      data: {
        exists: true,
        hasPolicy: true,
        policyId: policy.id,
        policyName: policy.name,
        priority: prio,
        category: categoryName,
        categoryId: catId,
        responseHours: Number(policy.response_hours ?? 4),
        resolutionHours: Number(policy.resolution_hours ?? 24),
        escalationHours: policy.escalation_hours !== null && policy.escalation_hours !== undefined ? Number(policy.escalation_hours) : null,
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
