import pool from '../config/db.js';
import * as slaRepo from '../repository/slaRepository.js';
import * as auditService from './auditService.js';
import { SLA_RESOLUTION_HOURS, SLA_RESPONSE_HOURS } from '../config/constants.js';

export const listPolicies = async (includeInactive = false, categoryId = null) =>
  slaRepo.findAll(includeInactive, categoryId);

export const getPolicy = async (id) => {
  const policy = await slaRepo.findById(id);
  if (!policy) throw Object.assign(new Error('SLA policy not found'), { statusCode: 404 });
  return policy;
};

// Normalize an empty/whitespace categoryId to null (global/default policy).
const normalizeCategoryId = (categoryId) => {
  if (categoryId === undefined || categoryId === null) return null;
  const trimmed = String(categoryId).trim();
  return trimmed === '' ? null : trimmed;
};

export const createPolicy = async (user, payload) => {
  if (!['urgent', 'high', 'medium', 'low'].includes(payload.priority)) {
    throw Object.assign(new Error('Invalid priority'), { statusCode: 400 });
  }
  const categoryId = normalizeCategoryId(payload.categoryId);
  const name = String(payload.name || '').trim();
  if (!name) {
    throw Object.assign(new Error('Policy name is required'), { statusCode: 400 });
  }
  const existingByName = await slaRepo.findByName(name, categoryId);
  if (existingByName) {
    const scope = categoryId ? `category '${categoryId}'` : 'global';
    throw Object.assign(
      new Error(`An SLA policy named '${name}' (${scope}) already exists`),
      { statusCode: 409 }
    );
  }
  const responseHours = payload.responseHours !== undefined && payload.responseHours !== '' ? Number(payload.responseHours) : 4;
  const resolutionHours = payload.resolutionHours !== undefined && payload.resolutionHours !== '' ? Number(payload.resolutionHours) : 24;
  const escalationHours = payload.escalationHours !== undefined && payload.escalationHours !== null && payload.escalationHours !== ''
    ? Number(payload.escalationHours)
    : null;

  if (resolutionHours <= responseHours) {
    throw Object.assign(
      new Error(`Resolution time (${resolutionHours}h) must be strictly greater than first response time (${responseHours}h)`),
      { statusCode: 400 }
    );
  }

  if (escalationHours !== null && escalationHours !== undefined && escalationHours > 0) {
    if (escalationHours <= responseHours) {
      throw Object.assign(
        new Error(`Escalation time (${escalationHours}h) must be greater than first response time (${responseHours}h)`),
        { statusCode: 400 }
      );
    }
    if (escalationHours > resolutionHours) {
      throw Object.assign(
        new Error(`Escalation time (${escalationHours}h) must be less than or equal to resolution time (${resolutionHours}h)`),
        { statusCode: 400 }
      );
    }
  }

  const description = payload.description ? String(payload.description).trim() : null;

  const policy = await slaRepo.create({
    name,
    priority: payload.priority,
    responseHours,
    resolutionHours,
    description,
    categoryId,
    escalationHours,
    workingHours: payload.workingHours || null,
  });

  if (categoryId) {
    // If the category does not yet have an sla_policy_id, automatically set this as its default policy
    await pool.query(
      'UPDATE ticket_categories SET sla_policy_id = :policyId WHERE id = :categoryId AND (sla_policy_id IS NULL OR sla_policy_id = "")',
      { policyId: policy.id, categoryId }
    ).catch(() => {});
  }

  auditService.logAction(user.id, 'create', 'sla_policy', policy.id, { role: user.role, new: policy }).catch(() => {});
  return policy;
};

export const updatePolicy = async (user, id, payload) => {
  const policy = await slaRepo.findById(id);
  if (!policy) throw Object.assign(new Error('SLA policy not found'), { statusCode: 404 });

  const newCategoryId = normalizeCategoryId(payload.categoryId !== undefined ? payload.categoryId : policy.category_id);

  if (payload.name && payload.name.trim() !== policy.name) {
    const existingByName = await slaRepo.findByName(payload.name.trim(), newCategoryId);
    if (existingByName && existingByName.id !== id) {
      const scope = newCategoryId ? `category '${newCategoryId}'` : 'global';
      throw Object.assign(
        new Error(`An SLA policy named '${payload.name.trim()}' (${scope}) already exists`),
        { statusCode: 409 }
      );
    }
  }

  const effectiveResponse = payload.responseHours !== undefined && payload.responseHours !== '' ? Number(payload.responseHours) : Number(policy.response_hours ?? 4);
  const effectiveResolution = payload.resolutionHours !== undefined && payload.resolutionHours !== '' ? Number(payload.resolutionHours) : Number(policy.resolution_hours ?? 24);
  const effectiveEscalation = payload.escalationHours !== undefined
    ? (payload.escalationHours === null || payload.escalationHours === '' ? null : Number(payload.escalationHours))
    : (policy.escalation_hours !== null && policy.escalation_hours !== undefined ? Number(policy.escalation_hours) : null);

  if (effectiveResolution <= effectiveResponse) {
    throw Object.assign(
      new Error(`Resolution time (${effectiveResolution}h) must be strictly greater than first response time (${effectiveResponse}h)`),
      { statusCode: 400 }
    );
  }

  if (effectiveEscalation !== null && effectiveEscalation !== undefined && effectiveEscalation > 0) {
    if (effectiveEscalation <= effectiveResponse) {
      throw Object.assign(
        new Error(`Escalation time (${effectiveEscalation}h) must be greater than first response time (${effectiveResponse}h)`),
        { statusCode: 400 }
      );
    }
    if (effectiveEscalation > effectiveResolution) {
      throw Object.assign(
        new Error(`Escalation time (${effectiveEscalation}h) must be less than or equal to resolution time (${effectiveResolution}h)`),
        { statusCode: 400 }
      );
    }
  }

  const updated = await slaRepo.update(id, {
    name: payload.name !== undefined ? String(payload.name).trim() : undefined,
    priority: payload.priority,
    responseHours: payload.responseHours !== undefined && payload.responseHours !== '' ? Number(payload.responseHours) : undefined,
    resolutionHours: payload.resolutionHours !== undefined && payload.resolutionHours !== '' ? Number(payload.resolutionHours) : undefined,
    description: payload.description !== undefined ? (payload.description ? String(payload.description).trim() : null) : undefined,
    isActive: payload.isActive,
    categoryId: payload.categoryId !== undefined ? newCategoryId : undefined,
    escalationHours: payload.escalationHours !== undefined
      ? (payload.escalationHours === null || payload.escalationHours === '' ? null : Number(payload.escalationHours))
      : undefined,
    workingHours: payload.workingHours,
  });
  auditService.logAction(user.id, 'update', 'sla_policy', id, { role: user.role, old: policy, new: updated }).catch(() => {});
  return updated;
};

export const deletePolicy = async (user, id) => {
  const policy = await slaRepo.findById(id);
  if (!policy) throw Object.assign(new Error('SLA policy not found'), { statusCode: 404 });
  await slaRepo.remove(id);
  auditService.logAction(user.id, 'delete', 'sla_policy', id, { role: user.role, old: policy }).catch(() => {});
};

// ── Date computation helpers ──

const addHours = (date, hours) => new Date(date.getTime() + Number(hours) * 60 * 60 * 1000);

// Add business hours to a date honoring the working_hours window.
// working_hours shape: { workDays: [0..6], start: 'HH:MM', end: 'HH:MM', holidays: ['YYYY-MM-DD'] }
// Falls back to a flat 24/7 calendar when working_hours is missing/invalid.
const addBusinessHours = (date, hours, workingHours) => {
  try {
    if (!workingHours || !Array.isArray(workingHours.workDays) || workingHours.workDays.length === 0) {
      return addHours(date, hours);
    }
    const [startH, startM] = String(workingHours.start || '09:00').split(':').map(Number);
    const [endH, endM] = String(workingHours.end || '17:00').split(':').map(Number);
    const dayMs = (endH * 60 + endM - (startH * 60 + startM)) * 60 * 1000;
    if (dayMs <= 0) return addHours(date, hours);
    const holidays = new Set((workingHours.holidays || []).map((d) => String(d).slice(0, 10)));
    const isWorkingDay = (d) =>
      workingHours.workDays.includes(d.getDay()) && !holidays.has(d.toISOString().slice(0, 10));

    let remaining = hours * 60 * 60 * 1000;
    const result = new Date(date);
    // Advance to the start of the next working window if needed.
    const openWindow = (d) => {
      const next = new Date(d);
      next.setHours(startH, startM, 0, 0);
      return next;
    };
    if (!isWorkingDay(result) || result < openWindow(result)) {
      do {
        result.setDate(result.getDate() + 1);
        result.setHours(startH, startM, 0, 0);
      } while (!isWorkingDay(result));
    } else if (result > new Date(new Date(result).setHours(endH, endM, 0, 0))) {
      do {
        result.setDate(result.getDate() + 1);
        result.setHours(startH, startM, 0, 0);
      } while (!isWorkingDay(result));
    }

    while (remaining > 0) {
      const dayEnd = new Date(result).setHours(endH, endM, 0, 0);
      const avail = dayEnd - result.getTime();
      if (remaining <= avail) {
        result.setTime(result.getTime() + remaining);
        remaining = 0;
      } else {
        remaining -= avail;
        do {
          result.setDate(result.getDate() + 1);
          result.setHours(startH, startM, 0, 0);
        } while (!isWorkingDay(result));
      }
    }
    return result;
  } catch {
    return addHours(date, hours);
  }
};

// Compute all SLA due dates for a resolved policy.
// Returns { responseDueDate, resolutionDueDate, escalationDueDate }.
export const computeAllDueDates = (policy, createdAt = new Date()) => {
  const base = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const responseHours = Number(policy.response_hours ?? SLA_RESPONSE_HOURS[policy.priority] ?? 4);
  const resolutionHours = Number(policy.resolution_hours ?? SLA_RESOLUTION_HOURS[policy.priority] ?? 24);
  const escalationHours = Number(policy.escalation_hours ?? 0);
  const workingHours = policy.working_hours || null;

  const responseDueDate = addBusinessHours(base, responseHours, workingHours);
  const resolutionDueDate = addBusinessHours(base, resolutionHours, workingHours);
  const escalationDueDate =
    escalationHours > 0 ? addBusinessHours(base, escalationHours, workingHours) : null;

  return { responseDueDate, resolutionDueDate, escalationDueDate };
};

// Resolve the effective policy for a category and priority:
// 1. Policy matching categoryId and priority
// 2. Default policy linked to the category (ticket_categories.sla_policy_id)
// 3. Fallback to global policy for that priority
// 4. Default policy matching priority
export const resolveEffectivePolicy = async (categoryId = null, priority = 'medium', slaPolicyId = null) => {
  let policy = null;
  if (slaPolicyId) {
    policy = await slaRepo.findById(slaPolicyId);
  }
  if (!policy && categoryId) {
    policy = await slaRepo.findPolicyByCategoryAndPriority(categoryId, priority);
  }
  if (!policy && categoryId) {
    const [catRows] = await pool.query(
      'SELECT sla_policy_id FROM ticket_categories WHERE id = :categoryId LIMIT 1',
      { categoryId }
    );
    if (catRows[0]?.sla_policy_id) {
      policy = await slaRepo.findById(catRows[0].sla_policy_id);
    }
  }
  if (!policy) {
    policy = await slaRepo.findPolicyByCategoryAndPriority(null, priority);
  }
  return policy;
};

// Find the effective policy (category-specific else global) and compute its due dates.
// Returns the full due-dates object. Resolution due date is the SLA "due_date".
export const computeDueDate = async (priority, createdAt = new Date(), categoryId = null, slaPolicyId = null) => {
  const policy = await resolveEffectivePolicy(categoryId, priority, slaPolicyId);
  const effective = policy || {
    priority,
    response_hours: SLA_RESPONSE_HOURS[priority] || 4,
    resolution_hours: SLA_RESOLUTION_HOURS[priority] || 24,
    escalation_hours: 0,
    working_hours: null,
  };
  return computeAllDueDates(effective, createdAt);
};

// Compute resumed due dates for a reopened ticket (Option B):
// Subtracts elapsed active time prior to resolution from the policy SLA resolution hours,
// and sets due_date = reopenedAt + effectiveRemainingHours (with a minimum safety buffer if expired).
export const computeReopenDueDates = (
  policy,
  createdAt,
  resolvedAt,
  reopenedAt = new Date(),
  previousActiveMs = null
) => {
  const baseReopened = reopenedAt instanceof Date ? reopenedAt : new Date(reopenedAt);
  const priority = policy?.priority || 'medium';
  const resolutionHours = Number(policy?.resolution_hours ?? SLA_RESOLUTION_HOURS[priority] ?? 24);
  const escalationHours = Number(policy?.escalation_hours ?? 0);
  const workingHours = policy?.working_hours || null;

  let elapsedMs = 0;
  if (previousActiveMs !== null && previousActiveMs !== undefined) {
    elapsedMs = Math.max(0, Number(previousActiveMs));
  } else {
    const tStart = createdAt ? new Date(createdAt).getTime() : baseReopened.getTime();
    const tResolved = resolvedAt ? new Date(resolvedAt).getTime() : baseReopened.getTime();
    elapsedMs = Math.max(0, tResolved - tStart);
  }

  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const remainingHours = resolutionHours - elapsedHours;

  // Minimum safety buffer (e.g. 25% of policy or at least 2 hours, capped at 4 hours)
  const minBufferHours = Math.max(2, Math.min(4, Number((resolutionHours * 0.25).toFixed(1))));
  const effectiveRemainingHours = remainingHours > 0 ? Number(remainingHours.toFixed(2)) : minBufferHours;

  const resolutionDueDate = addBusinessHours(baseReopened, effectiveRemainingHours, workingHours);

  let escalationDueDate = null;
  if (escalationHours > 0) {
    const escRemaining = escalationHours - elapsedHours;
    if (escRemaining > 0 && escRemaining < effectiveRemainingHours) {
      escalationDueDate = addBusinessHours(baseReopened, Number(escRemaining.toFixed(2)), workingHours);
    } else if (effectiveRemainingHours > 2) {
      escalationDueDate = addBusinessHours(baseReopened, Number((effectiveRemainingHours * 0.75).toFixed(2)), workingHours);
    }
  }

  return {
    resolutionDueDate,
    escalationDueDate,
    effectiveRemainingHours,
    elapsedHours: Number(elapsedHours.toFixed(2)),
  };
};
