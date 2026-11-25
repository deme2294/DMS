import { v4 as uuidv4 } from 'uuid';
import * as ticketRepo from '../repository/ticketRepository.js';
import * as operationalRepo from '../repository/operationalEscalationRepository.js';
import * as collaboratorRepo from '../repository/collaboratorRepository.js';
import * as slaEscalationRepo from '../repository/slaEscalationRepository.js';
import { sanitizeTicket } from '../models/Ticket.js';
import { TICKET_STATUS_TRANSITIONS, TICKET_PRIORITIES } from '../config/constants.js';
import * as auditService from './auditService.js';
import { sendTicketCreatedEmail, sendTicketStatusEmail, sendTicketAssignedEmail, sendTicketReplyEmail, sendTicketResolvedEmail, sendTicketClosedEmail, sendTicketEscalatedEmail, sendTicketCompletedEmail, sendTicketApprovedEmail, sendTicketReopenedEmail, sendTicketMergedEmail, sendTicketAcceptedEmail, sendTicketRejectedEmail, sendNewTicketAdminAlert } from './emailService.js';
import * as notificationService from './notificationService.js';
import * as slaService from './slaService.js';
import * as slaRepo from '../repository/slaRepository.js';
import * as categoryRepo from '../repository/categoryRepository.js';
import * as userRepository from '../repository/userRepository.js';
import * as feedbackRepo from '../repository/feedbackRepository.js';
import { getNextFeedbackId } from './feedbackService.js';
import { broadcastTicketEvent } from './socketService.js';
import { compareTicketsForDuplicate, scanForDuplicates } from './duplicateDetectionService.js';
import pool from '../config/db.js';

const canTransition = (role, fromStatus, toStatus) => {
  const map = TICKET_STATUS_TRANSITIONS[role];
  if (!map) return false;
  return (map[fromStatus] || []).includes(toStatus);
};

const buildScope = async (user) => {
  if (user.role === 'admin' || user.role === 'ceo') return {};
  if (user.role === 'tenant') return { tenantId: user.tenant_id, createdBy: user.id };
  if (user.role === 'staff') return { assignedTo: user.id };
  if (user.role === 'manager') {
    const deptIds = await ticketRepo.getManagerDepartmentIds(user.id);
    // Include managerId so listTickets can apply the OR-visibility rule
    return { departmentIds: deptIds, managerId: user.id };
  }
  return { impossible: true };
};

const applyScopeToQuery = (scope, query) => {
  if (scope.impossible) return { ...query, impossible: true };
  if (scope.tenantId) return { ...query, tenantId: scope.tenantId };
  if (scope.assignedTo) return { ...query, assignedTo: scope.assignedTo };
  // Manager scope is handled separately via findAllForManager — pass through as-is
  if (scope.departmentIds) return { ...query, departmentIds: scope.departmentIds, managerId: scope.managerId };
  return query;
};

export const canAccessTicket = async (user, ticket) => {
  if (!ticket) return false;
  if (user.role === 'admin' || user.role === 'ceo') return true;
  if (user.role === 'tenant') {
    const isDirectOwner = String(ticket.tenant_id) === String(user.tenant_id) || String(ticket.created_by) === String(user.id);
    if (isDirectOwner) return true;

    // If this is a primary ticket, allow access if any of this tenant's tickets were merged into it
    try {
      const [mergedMatch] = await pool.query(
        `SELECT 1 FROM tickets WHERE merged_into = ? AND (tenant_id = ? OR created_by = ?) LIMIT 1`,
        [ticket.id, user.tenant_id || '', user.id]
      );
      if (mergedMatch && mergedMatch.length > 0) return true;
    } catch (err) {
      console.error('[canAccessTicket] Error checking merged tenant access:', err.message);
    }

    return false;
  }

  // 1. Direct assignment: if user is directly assigned to the ticket, allow access
  if (
    (ticket.assigned_to && String(ticket.assigned_to) === String(user.id)) ||
    (ticket.current_assigned_user_id && String(ticket.current_assigned_user_id) === String(user.id))
  ) {
    return true;
  }

  // 2. Active or historical assignment on this ticket in assignments table
  try {
    const [assignmentRows] = await pool.query(
      'SELECT 1 FROM assignments WHERE ticket_id = ? AND (assigned_to = ? OR assigned_by = ?) LIMIT 1',
      [ticket.id, user.id, user.id]
    );
    if (assignmentRows && assignmentRows.length > 0) return true;
  } catch (err) {
    console.error('[canAccessTicket] Error querying assignments:', err.message);
  }

  // 3. Department-based access for manager / staff
  try {
    const userDeptIds = await ticketRepo.getUserDepartmentIds(user.id);
    const managerDeptIds = user.role === 'manager' ? await ticketRepo.getManagerDepartmentIds(user.id) : [];
    const allDepts = Array.from(new Set([...userDeptIds, ...managerDeptIds].map(String)));

    const ticketDept = ticket.department_id || ticket.current_department_id || ticket.auto_department_id;
    if (ticketDept && allDepts.includes(String(ticketDept))) return true;

    // Check category auto-detected department fallback if ticket department not set yet
    if (ticket.category) {
      const catInfo = await ticketRepo.getDepartmentForCategory(ticket.category).catch(() => null);
      if (catInfo?.department_id && allDepts.includes(String(catInfo.department_id))) return true;
    }
  } catch (err) {
    console.error('[canAccessTicket] Error checking department access:', err.message);
  }

  return false;
};

const getClientMeta = (meta) => ({
  ip: meta?.ip || null,
  browser: meta?.browser || null,
});

const logStatus = async (ticketId, from, to, user, notes, meta) => {
  await ticketRepo.logStatusHistory({
    id: uuidv4(),
    ticketId,
    fromStatus: from,
    toStatus: to,
    changedBy: user.id,
    notes,
    role: user.role,
    browser: meta?.browser || null,
  });
};

export const listTickets = async (user, query) => {
  const scope = await buildScope(user);
  const scopedQuery = applyScopeToQuery(scope, query);

  if (scopedQuery.impossible) {
    return { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  }

  let result;

  // ── Manager: use the dedicated OR-visibility query ──────────────────────────
  if (scopedQuery.managerId) {
    // If the UI is filtering by a departmentId that is NOT in the manager's depts, return nothing
    if (
      scopedQuery.departmentId &&
      scopedQuery.departmentIds &&
      !scopedQuery.departmentIds.includes(scopedQuery.departmentId)
    ) {
      return { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
    }

    result = await ticketRepo.findAllForManager({
      managerId: scopedQuery.managerId,
      departmentIds: scopedQuery.departmentIds || [],
      search: scopedQuery.search,
      status: scopedQuery.status,
      priority: scopedQuery.priority,
      category: scopedQuery.category,
      departmentId: scopedQuery.departmentId,
      assignedTo: scopedQuery.assignedTo,
      fromDate: scopedQuery.fromDate,
      toDate: scopedQuery.toDate,
      keyword: scopedQuery.keyword,
      page: scopedQuery.page || 1,
      limit: scopedQuery.limit || 10,
      sortBy: scopedQuery.sortBy,
      sortOrder: scopedQuery.sortOrder,
    });
  } else {
    // ── All other roles (admin, tenant, staff) ───────────────────────────────
    result = await ticketRepo.findAll({ ...scopedQuery, departmentIds: undefined, managerId: undefined });
  }

  return { ...result, data: result.data.map(sanitizeTicket) };
};

export const getCategoryCooldownMinutes = async (categoryNameOrId) => {
  let cooldownMinutes = parseInt(process.env.ASSIGNMENT_LOCK_MINUTES || '30', 10);
  if (!categoryNameOrId) return cooldownMinutes;
  try {
    const categoryRecord = await categoryRepo.findByName(categoryNameOrId).catch(() => null);
    if (categoryRecord && categoryRecord.reassign_time_minutes != null) {
      return parseInt(categoryRecord.reassign_time_minutes, 10);
    }
    const allCats = await categoryRepo.findAll().catch(() => []);
    const str = String(categoryNameOrId).toLowerCase().trim();
    const matched = allCats.find(
      (c) => c.name.toLowerCase().trim() === str || c.id === categoryNameOrId
    );
    if (matched && matched.reassign_time_minutes != null) {
      return parseInt(matched.reassign_time_minutes, 10);
    }
  } catch { }
  return cooldownMinutes;
};

export const getTicket = async (user, id) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  const history = await ticketRepo.getStatusHistory(ticket.id);
  const assignments = await ticketRepo.getAssignments(ticket.id);

  // Look up category for this ticket to get its custom reassign_time_minutes (set in minutes or hours),
  // but prefer dynamically set ticket.reassign_time_minutes or ticket.staff_reassign_time_minutes if present!
  const categoryCooldownMinutes = await getCategoryCooldownMinutes(ticket.category);
  const cooldownMinutes = ticket.reassign_time_minutes !== null && ticket.reassign_time_minutes !== undefined
    ? Number(ticket.reassign_time_minutes)
    : categoryCooldownMinutes;
  const staffCooldownMinutes = ticket.staff_reassign_time_minutes !== null && ticket.staff_reassign_time_minutes !== undefined
    ? Number(ticket.staff_reassign_time_minutes)
    : categoryCooldownMinutes;
  const now = Date.now();

  // Active department assignment lock
  const activeDeptAssignment = [...assignments].reverse().find(
    (a) => a.role === 'department_manager' && ['pending', 'accepted'].includes(a.status)
  );
  const pendingDeptAssignment = [...assignments].reverse().find(
    (a) => a.role === 'department_manager' && a.status === 'pending'
  );
  let deptAssignmentLock = null;
  if (activeDeptAssignment && activeDeptAssignment.created_at) {
    const elapsedMinutes = Math.floor((now - new Date(activeDeptAssignment.created_at).getTime()) / 60000);
    const remainingMinutes = Math.max(0, cooldownMinutes - elapsedMinutes);
    const lockUntilDate = new Date(new Date(activeDeptAssignment.created_at).getTime() + cooldownMinutes * 60000);
    deptAssignmentLock = {
      isLocked: cooldownMinutes > 0 && remainingMinutes > 0,
      remainingMinutes: cooldownMinutes === 0 ? 0 : remainingMinutes,
      cooldownMinutes,
      lockDurationMinutes: cooldownMinutes,
      isCustomTime: ticket.reassign_time_minutes !== null && ticket.reassign_time_minutes !== undefined,
      lockUntil: cooldownMinutes === 0 ? null : lockUntilDate.toISOString(),
      assignedAt: activeDeptAssignment.created_at,
      assignedToName: activeDeptAssignment.assigned_to_name || 'Department Manager',
      departmentId: activeDeptAssignment.department_id || ticket.department_id,
      departmentName: activeDeptAssignment.department_name || null,
    };
  }

  // Active staff assignment lock
  const activeStaffAssignment = [...assignments].reverse().find(
    (a) => a.role === 'staff' && ['pending', 'accepted'].includes(a.status)
  );
  const pendingStaffAssignment = [...assignments].reverse().find(
    (a) => a.role === 'staff' && a.status === 'pending'
  );
  const latestRejectedAssignment = [...assignments].reverse().find(
    (a) => a.status === 'rejected'
  );

  const pendingAssignmentInfo = {
    deptAssignmentStatus: activeDeptAssignment?.status || null,
    isDeptPending: Boolean(pendingDeptAssignment),
    deptManagerId: activeDeptAssignment?.assigned_to || null,
    staffAssignmentStatus: activeStaffAssignment?.status || null,
    isStaffPending: Boolean(pendingStaffAssignment),
    staffId: activeStaffAssignment?.assigned_to || null,
    latestRejectedAssignment: latestRejectedAssignment ? {
      id: latestRejectedAssignment.id,
      role: latestRejectedAssignment.role,
      notes: latestRejectedAssignment.notes,
      rejectedAt: latestRejectedAssignment.rejected_at || latestRejectedAssignment.updated_at,
    } : null,
  };
  let staffAssignmentLock = null;
  if (activeStaffAssignment && activeStaffAssignment.created_at) {
    const elapsedMinutes = Math.floor((now - new Date(activeStaffAssignment.created_at).getTime()) / 60000);
    const remainingMinutes = Math.max(0, staffCooldownMinutes - elapsedMinutes);
    const lockUntilDate = new Date(new Date(activeStaffAssignment.created_at).getTime() + staffCooldownMinutes * 60000);
    staffAssignmentLock = {
      isLocked: staffCooldownMinutes > 0 && remainingMinutes > 0,
      remainingMinutes: staffCooldownMinutes === 0 ? 0 : remainingMinutes,
      cooldownMinutes: staffCooldownMinutes,
      lockDurationMinutes: staffCooldownMinutes,
      isCustomTime: ticket.staff_reassign_time_minutes !== null && ticket.staff_reassign_time_minutes !== undefined,
      lockUntil: staffCooldownMinutes === 0 ? null : lockUntilDate.toISOString(),
      assignedAt: activeStaffAssignment.created_at,
      assignedToName: activeStaffAssignment.assigned_to_name || 'Staff Member',
    };
  }

  // Extract previous departments and previous staff history (strictly those assigned before, excluding current)
  const previousDepartments = [];
  const seenDeptIds = new Set();
  const previousStaff = [];
  const seenStaffIds = new Set();

  for (const a of [...assignments].reverse()) {
    if (a.role === 'department_manager' && a.department_id && a.department_id !== ticket.department_id) {
      if (!seenDeptIds.has(a.department_id)) {
        seenDeptIds.add(a.department_id);
        previousDepartments.push({
          departmentId: a.department_id,
          departmentName: a.department_name || 'Department',
          assignedAt: a.created_at,
          managerId: a.assigned_to,
          managerName: a.assigned_to_name,
        });
      }
    }
    if (a.role === 'staff' && a.assigned_to && a.assigned_to !== ticket.assigned_to) {
      if (!seenStaffIds.has(a.assigned_to)) {
        seenStaffIds.add(a.assigned_to);
        previousStaff.push({
          staffId: a.assigned_to,
          staffName: a.assigned_to_name,
          assignedAt: a.created_at,
        });
      }
    }
  }

  const operationalEscalations = await operationalRepo.findByTicketId(ticket.id).catch(() => []);
  const slaEscalations = await slaEscalationRepo.findByTicketId(ticket.id).catch(() => []);
  const collaborators = await collaboratorRepo.findByTicketId(ticket.id).catch(() => []);

  // Fetch linked duplicate tickets if this ticket is a primary ticket
  const linkedTicketsRaw = await ticketRepo.getMergedTickets(ticket.id).catch(() => []);
  const linkedTickets = linkedTicketsRaw.map((lt) => ({
    id: lt.id,
    referenceNumber: lt.reference_number || lt.referenceNumber || lt.id,
    trackNumber: lt.track_number || lt.trackNumber,
    title: lt.title,
    description: lt.description,
    status: lt.status,
    priority: lt.priority,
    category: lt.category,
    departmentId: lt.department_id || lt.departmentId,
    departmentName: lt.department_name || lt.departmentName,
    createdBy: lt.created_by || lt.createdBy,
    createdByName: lt.created_by_name || lt.createdByName,
    tenantId: lt.tenant_id || lt.tenantId,
    tenantName: lt.tenant_name || lt.tenantName,
    mergedAt: lt.merged_at || lt.mergedAt || lt.created_at,
    mergedBy: lt.merged_by || lt.mergedBy,
    mergedByName: lt.merged_by_name || lt.mergedByName,
    mergeReason: lt.merge_reason || lt.mergeReason,
    similarityScore: lt.similarity_score !== undefined && lt.similarity_score !== null ? lt.similarity_score : lt.similarityScore,
    originalStatus: lt.original_status || lt.originalStatus,
    originalSlaStatus: lt.original_sla_status || lt.originalSlaStatus,
    ...lt,
  }));

  // Fetch primary ticket details if this ticket was merged into another ticket
  const primaryTicketRaw = ticket.merged_into
    ? await ticketRepo.getPrimaryTicketForMerged(ticket.id).catch(() => null)
    : null;
  const primaryTicketInfo = primaryTicketRaw ? {
    primaryId: primaryTicketRaw.primary_id || primaryTicketRaw.primaryId,
    primaryReference: primaryTicketRaw.primary_reference || primaryTicketRaw.primaryReference,
    primaryTrackNumber: primaryTicketRaw.primary_track_number || primaryTicketRaw.primaryTrackNumber,
    primaryTitle: primaryTicketRaw.primary_title || primaryTicketRaw.primaryTitle,
    primaryStatus: primaryTicketRaw.primary_status || primaryTicketRaw.primaryStatus,
    primaryResolutionNotes: primaryTicketRaw.primary_resolution_notes || primaryTicketRaw.primaryResolutionNotes,
    primaryResolvedAt: primaryTicketRaw.primary_resolved_at || primaryTicketRaw.primaryResolvedAt,
    primaryClosedAt: primaryTicketRaw.primary_closed_at || primaryTicketRaw.primaryClosedAt,
    primaryDepartmentId: primaryTicketRaw.primary_department_id || primaryTicketRaw.primaryDepartmentId,
    primaryDepartmentName: primaryTicketRaw.primary_department_name || primaryTicketRaw.primaryDepartmentName,
    primaryAssignedTo: primaryTicketRaw.primary_assigned_to || primaryTicketRaw.primaryAssignedTo,
    primaryAssignedToName: primaryTicketRaw.primary_assigned_to_name || primaryTicketRaw.primaryAssignedToName,
    mergeReason: primaryTicketRaw.merge_reason || primaryTicketRaw.mergeReason,
    mergedAt: primaryTicketRaw.merged_at || primaryTicketRaw.mergedAt,
    mergedByName: primaryTicketRaw.merged_by_name || primaryTicketRaw.mergedByName,
    originalStatus: primaryTicketRaw.original_status || primaryTicketRaw.originalStatus,
    originalSlaStatus: primaryTicketRaw.original_sla_status || primaryTicketRaw.originalSlaStatus,
    ...primaryTicketRaw,
  } : null;

  return {
    ...sanitizeTicket(ticket),
    deptAssignmentLock,
    staffAssignmentLock,
    previousDepartments,
    previousStaff,
    operationalEscalations,
    slaEscalations,
    collaborators,
    linkedTickets,
    primaryTicketInfo,
    pendingAssignmentInfo,
    statusHistory: history.map((h) => ({
      id: h.id, fromStatus: h.from_status, toStatus: h.to_status, changedBy: h.changed_by,
      changedByName: h.changed_by_name, notes: h.notes, role: h.role, createdAt: h.created_at,
    })),
    assignments: assignments.map((a) => ({
      id: a.id, role: a.role, status: a.status, notes: a.notes,
      departmentId: a.department_id, departmentName: a.department_name,
      assignedTo: a.assigned_to, assignedToName: a.assigned_to_name,
      assignedBy: a.assigned_by, assignedByName: a.assigned_by_name,
      createdAt: a.created_at,
    })),
  };
};

export const trackTicket = async (trackNumber) => {
  const ticket = await ticketRepo.findByTrackNumber(trackNumber);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  let primaryTicketInfo = null;
  if (ticket.merged_into) {
    const rawPrimary = await ticketRepo.getPrimaryTicketForMerged(ticket.id).catch(() => null);
    if (rawPrimary) {
      primaryTicketInfo = {
        primaryReference: rawPrimary.primary_reference || rawPrimary.primaryReference,
        primaryTrackNumber: rawPrimary.primary_track_number || rawPrimary.primaryTrackNumber,
        primaryTitle: rawPrimary.primary_title || rawPrimary.primaryTitle,
        primaryStatus: rawPrimary.primary_status || rawPrimary.primaryStatus,
        primaryResolutionNotes: rawPrimary.primary_resolution_notes || rawPrimary.primaryResolutionNotes,
        mergeReason: rawPrimary.merge_reason || rawPrimary.mergeReason,
        mergedAt: rawPrimary.merged_at || rawPrimary.mergedAt,
      };
    }
  }

  return {
    referenceNumber: ticket.reference_number,
    trackNumber: ticket.track_number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    departmentName: ticket.department_name,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    mergedInto: ticket.merged_into,
    primaryTicketInfo,
  };
};

// Auto-route a "direct" category ticket straight to the owning department manager
// (bypasses the admin queue — the category itself designates the destination department).
// Considers BOTH department and role ('manager') to avoid cross-department misrouting.
const routeTicketToDepartment = async (ticketId, departmentId, ticket, meta = {}) => {
  const notes = 'Automatically routed to your department';
  // Consider BOTH department and role: find active manager for this exact department
  const manager = await ticketRepo.findDepartmentManager(departmentId);
  const managerId = manager?.id || null;

  await ticketRepo.update(ticketId, { department_id: departmentId, status: 'assigned', assigned_to: managerId });
  await logStatus(ticketId, 'open', 'assigned', { id: null, role: 'system' }, notes, meta);
  await ticketRepo.createAssignment({
    ticketId,
    assignedBy: null,
    assignedTo: managerId,
    role: 'department_manager',
    notes,
    priority: ticket.priority,
    category: ticket.category,
  });
  const updated = await getTicket({ id: null, role: 'admin' }, ticketId);
  await notificationService.notifyTicketAssignedToDepartment(updated, departmentId);
  if (managerId) {
    await notificationService.notifyTicketAssigned(updated, managerId, null);
  }
  auditService.logAction(null, 'auto_route_direct', 'ticket', ticketId, meta?.ip, { departmentId, managerId, routingType: 'direct' }, { role: 'system', browser: meta?.browser }).catch(() => { });
  return updated;
};

export const createTicket = async (user, payload, files = [], meta = {}) => {
  if (user.role !== 'tenant') {
    throw Object.assign(new Error('Only tenants can create tickets'), { statusCode: 403 });
  }
  if (!user.tenant_id) {
    throw Object.assign(new Error('Tenant account required'), { statusCode: 400 });
  }

  // Auto-detect department from category and resolve canonical ticket_categories name
  let categoryRecord = await categoryRepo.findByName(payload.category).catch(() => null);
  if (!categoryRecord && payload.category) {
    categoryRecord = await categoryRepo.findById(payload.category).catch(() => null);
  }
  if (!categoryRecord && payload.category) {
    const [deptMatch] = await pool.query(
      'SELECT id FROM departments WHERE LOWER(TRIM(name)) = LOWER(TRIM(:cat)) LIMIT 1',
      { cat: payload.category }
    ).catch(() => [[]]);
    if (deptMatch && deptMatch.length > 0) {
      throw Object.assign(new Error('Invalid category: please select a created ticket category rather than a department name'), { statusCode: 400 });
    }
  }
  const canonicalCategory = categoryRecord?.name || payload.category;
  const catInfo = await ticketRepo.getDepartmentForCategory(canonicalCategory).catch(() => ({ department_id: null, sla_policy_id: null, routing_type: 'general' }));
  const departmentId = catInfo.department_id || payload.departmentId || null;
  const routingType = catInfo.routing_type || 'general';
  const categoryId = categoryRecord?.id || null;

  const id = uuidv4();
  const referenceNumber = await ticketRepo.generateReferenceNumber();
  const trackNumber = ticketRepo.generateTrackNumber();
  const priority = payload.priority || 'medium';
  const specificPolicy = await slaService.findSpecificPolicyForCategoryAndPriority(categoryId, priority);
  let dueDates = null;
  let dueDate = null;
  let responseDueDate = null;
  let escalationDueDate = null;
  let slaPolicyId = null;
  let slaAgreementAccepted = false;

  if (specificPolicy) {
    slaPolicyId = specificPolicy.id;
    dueDates = slaService.computeAllDueDates(specificPolicy, new Date());
    dueDate = dueDates.resolutionDueDate;
    responseDueDate = dueDates.responseDueDate;
    escalationDueDate = dueDates.escalationDueDate;
    slaAgreementAccepted = true;
  }

  await ticketRepo.create({
    id,
    referenceNumber,
    trackNumber,
    tenantId: user.tenant_id,
    createdBy: user.id,
    departmentId,
    assignedTo: null,
    title: payload.title,
    description: payload.description,
    priority,
    category: canonicalCategory,
    status: 'open',
    dueDate,
    responseDueDate,
    escalationDueDate,
    slaPolicyId,
    autoDepartmentId: departmentId,
    routingType,
    slaAgreementAccepted,
    slaAgreementAcceptedAt: slaAgreementAccepted ? new Date() : null,
  });

  const initialComment = payload.comment || payload.attachmentComment || 'Initial ticket attachment';
  for (const file of files) {
    await ticketRepo.addAttachment({
      id: uuidv4(), ticketId: id, fileName: file.originalname,
      originalName: file.originalname, fileSize: file.size || 0,
      filePath: `/uploads/tickets/${file.filename}`, mimeType: file.mimetype, uploadedBy: user.id,
      comment: initialComment,
    });
  }

  await logStatus(id, null, 'open', user, 'Ticket submitted');

  const created = await getTicket(user, id);

  const [submitterRows] = await pool.query(
    'SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: user.id }
  );
  if (submitterRows.length) {
    sendTicketCreatedEmail({
      email: submitterRows[0].email, firstName: submitterRows[0].first_name,
      ticket: { referenceNumber: created.referenceNumber, trackNumber: created.trackNumber, title: created.title, priority: created.priority },
    }).catch(() => { });
  }

  // Ensure external tickets reach the created system email (demshuterefe94@gmail.com)
  sendNewTicketAdminAlert({
    ticket: created,
    submitterName: submitterRows.length ? `${submitterRows[0].first_name || ''} ${submitterRows[0].last_name || ''}`.trim() : (user.username || 'External Submitter'),
    submitterEmail: submitterRows.length ? submitterRows[0].email : user.email,
  }).catch(() => { });

  auditService.logAction(user.id, 'create', 'ticket', id, meta?.ip, { referenceNumber: created.referenceNumber, routingType }, { role: user.role, browser: meta?.browser }).catch(() => { });

  // Always notify submitting tenant in-app so their notification bell and toast acknowledge receipt
  await notificationService.notifyTenantTicketCreated(created, user.id).catch(() => { });

  if (routingType === 'direct' && departmentId) {
    // Direct-routing category: bypass the admin queue, route straight to the owning department
    await routeTicketToDepartment(id, departmentId, created, meta);
    return getTicket(user, id);
  }

  // General category: keep existing behaviour (admins notified; admin assigns the department)
  await notificationService.notifyTicketCreated(created, user.id);
  return created;
};

export const updateTicket = async (user, id, payload, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (baseStatus === 'closed') {
    throw Object.assign(
      new Error('Closed tickets are inactive and read-only. A Closed ticket cannot be modified or processed until reopening is requested by the tenant and approved by an authorized manager or administrator.'),
      { statusCode: 400 }
    );
  }

  const isTenant = user.role === 'tenant';
  const isRejectedOrCancelled = ['rejected', 'cancelled'].includes(ticket.status);
  if (isRejectedOrCancelled && isTenant) {
    throw Object.assign(new Error('Cannot update rejected or cancelled ticket'), { statusCode: 400 });
  }
  if (baseStatus === 'waiting_tenant' && !isTenant) {
    if (payload.departmentId !== undefined || payload.assignedTo !== undefined) {
      throw Object.assign(new Error('Cannot assign department or staff: Ticket is waiting for tenant response/confirmation.'), { statusCode: 400 });
    }
  }

  const updateFields = {};
  if (!isTenant) {
    const targetDeptId = payload.departmentId !== undefined ? payload.departmentId : ticket.department_id;
    if (payload.departmentId !== undefined) updateFields.department_id = payload.departmentId;

    if (payload.assignedTo !== undefined) {
      if (payload.assignedTo) {
        const targetUser = await userRepository.findById(payload.assignedTo);
        if (!targetUser) throw Object.assign(new Error('Assignee user not found'), { statusCode: 404 });
        if (targetUser.status !== 'active') throw Object.assign(new Error('Assignee user is not active'), { statusCode: 400 });
        if (targetUser.role === 'tenant') throw Object.assign(new Error('Cannot assign tickets to tenants'), { statusCode: 400 });

        if (targetDeptId) {
          const inDept = targetUser.departments && targetUser.departments.some((d) => d.id === targetDeptId);
          if (!inDept) {
            if (targetUser.role === 'manager') {
              throw Object.assign(new Error('Selected manager does not belong to the ticket department. Both department and role must match.'), { statusCode: 400 });
            }
            throw Object.assign(new Error('Assignee does not belong to the ticket department'), { statusCode: 400 });
          }
        }
        updateFields.assigned_to = payload.assignedTo;
      } else {
        updateFields.assigned_to = null;
      }
    } else if (payload.departmentId !== undefined && payload.departmentId !== ticket.department_id && ticket.assigned_to) {
      // Department changed, but assignedTo wasn't explicitly provided.
      // Verify if the current assignee belongs to the new department; if not, re-route to new department's manager
      const currentAssignee = await userRepository.findById(ticket.assigned_to);
      const stillInDept = currentAssignee?.departments && currentAssignee.departments.some((d) => d.id === payload.departmentId);
      if (!stillInDept) {
        const newDeptMgr = await ticketRepo.findDepartmentManager(payload.departmentId);
        updateFields.assigned_to = newDeptMgr?.id || null;
      }
    }
  }
  if (payload.title) updateFields.title = payload.title;
  if (payload.description) updateFields.description = payload.description;
  if (payload.priority && TICKET_PRIORITIES.includes(payload.priority)) updateFields.priority = payload.priority;
  if (payload.category) updateFields.category = payload.category;

  if (isTenant && !['open'].includes(ticket.status)) {
    delete updateFields.title;
    delete updateFields.description;
    delete updateFields.priority;
    delete updateFields.category;
  }

  await ticketRepo.update(id, updateFields);
  const old = sanitizeTicket(ticket);
  const updated = await getTicket(user, id);
  auditService.logAction(user.id, 'update', 'ticket', id, meta?.ip, { referenceNumber: updated.referenceNumber }, { role: user.role, oldValue: old, newValue: sanitizeTicket(ticket), browser: meta?.browser }).catch(() => { });
  return updated;
};

export const changeStatus = async (user, id, { status, notes }, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  if (ticket.merged_into) {
    throw Object.assign(
      new Error(`Action not permitted: This ticket has been merged into primary ticket #${ticket.merged_into}. All status updates must be performed on the primary ticket.`),
      { statusCode: 400 }
    );
  }

  // If status is reopened, delegate to dedicated reopenTicket handler
  if (status === 'reopened') {
    return reopenTicket(user, id, notes, meta);
  }

  // If status is closed, delegate to dedicated closeTicket handler (enforcing tenant resolution confirmation)
  if (status === 'closed') {
    return closeTicket(user, id, notes, meta);
  }

  const currentBase = (ticket.status || '').replace(/^escalated\./, '');
  if (currentBase === 'closed') {
    throw Object.assign(
      new Error('Closed tickets are inactive and read-only. A Closed ticket cannot have its status changed until reopening is requested by the tenant and approved by an authorized manager or administrator.'),
      { statusCode: 400 }
    );
  }
  if (currentBase === 'waiting_tenant' && user.role !== 'tenant') {
    throw Object.assign(new Error('This ticket is waiting for tenant response/confirmation and cannot have its status changed until the tenant responds.'), { statusCode: 400 });
  }

  // Multi-tier role-aware resolution routing:
  let targetStatus = status;
  if (status === 'resolved') {
    if (user.role === 'staff') {
      targetStatus = 'under_review';
    } else if (user.role === 'manager') {
      targetStatus = 'pending_approval';
    } else if (user.role === 'admin' || user.role === 'ceo') {
      targetStatus = 'waiting_tenant';
    }
  }

  // Staff cannot directly approve or finalize tickets
  if (user.role === 'staff' && ['completed', 'waiting_tenant', 'pending_approval'].includes(targetStatus)) {
    throw Object.assign(new Error('Staff cannot directly approve or complete tickets. Please resolve the ticket to submit for Department Manager approval.'), { statusCode: 403 });
  }

  if (!canTransition(user.role, ticket.status, targetStatus) && !canTransition(user.role, ticket.status, status)) {
    throw Object.assign(new Error(`Cannot transition from ${ticket.status} to ${targetStatus}`), { statusCode: 400 });
  }

  const updateFields = { status: targetStatus };
  if (targetStatus === 'waiting_tenant' || targetStatus === 'resolved') {
    updateFields.resolved_at = updateFields.resolved_at || new Date();
    updateFields.tenant_confirmation_status = 'pending';
  }
  if (targetStatus === 'completed') {
    updateFields.completed_at = new Date();
    updateFields.closed_at = new Date();
    updateFields.tenant_confirmation_status = 'approved';
    updateFields.approved_by = user.id;
    updateFields.approved_at = new Date();
  }
  if (targetStatus === 'closed') updateFields.closed_at = new Date();
  if (targetStatus === 'reopened') updateFields.reopened_at = new Date();
  if (targetStatus === 'cancelled') updateFields.cancelled_at = new Date();
  if (targetStatus === 'escalated') {
    updateFields.is_escalated = 1;
    updateFields.escalated_at = new Date();
  }

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, targetStatus, user, notes, meta);

  const updated = await getTicket(user, id);

  if (ticket.created_by && ticket.created_by !== user.id) {
    await notificationService.notifyTicketStatusChanged(updated, targetStatus, user.id);
  }
  if (targetStatus === 'waiting_tenant' || targetStatus === 'resolved') {
    await notificationService.notifyTicketResolved(updated);
  }
  if (targetStatus === 'completed') {
    sendTicketCompletedEmail(updated).catch(() => { });
  }
  if (targetStatus === 'reopened') {
    await notificationService.notifyTicketReopened(updated, user.id, notes);
    sendTicketReopenedEmail(updated).catch(() => { });
  }
  if (targetStatus === 'closed') {
    await notificationService.notifyTicketClosed(updated);
  }

  // Synchronize status updates and resolution outcome to all linked duplicate tickets
  const syncedMerged = await ticketRepo.syncPrimaryOutcomeToMerged(
    id,
    targetStatus,
    notes || `Status synchronized from updated primary ticket #${ticket.reference_number || ticket.id} to "${targetStatus}"`,
    user.id
  ).catch(() => []);
  if (syncedMerged && syncedMerged.length > 0) {
    await notificationService.notifyMergedTicketPrimaryOutcome({
      primaryTicket: updated,
      mergedTickets: syncedMerged,
      outcomeStatus: targetStatus,
      notes,
    }).catch(() => { });
  }

  auditService.logAction(user.id, 'status_change', 'ticket', id, meta?.ip, { from: ticket.status, to: targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

export const deleteTicket = async (user, id) => {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only admin can delete tickets'), { statusCode: 403 });
  }
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  await ticketRepo.remove(id);
};

// ── Admin: assign department manager (considering BOTH department and role) ──
export const assignDepartment = async (user, id, departmentId, notes, managerId = null, meta = {}, reassignTimeMinutes = undefined, overrideLock = false) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let assignNote = notes;
  if (ticket.merged_into) {
    assignNote = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Updated for tenant management, linked to Primary Ticket #${ticket.merged_into}]`;
  }

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (baseStatus === 'closed') {
    throw Object.assign(new Error('Closed tickets are inactive and read-only. Cannot assign department to a closed ticket.'), { statusCode: 400 });
  }
  if (baseStatus === 'waiting_tenant') {
    throw Object.assign(new Error('Cannot assign department: Ticket is waiting for tenant response/confirmation.'), { statusCode: 400 });
  }

  // Direct-route tickets are already routed to their owning department at creation,
  // so the admin must not (re)assign a department here. They are notified instead.
  if (ticket.routing_type === 'direct') {
    throw Object.assign(new Error('Direct-route tickets are already routed to a department and cannot be assigned by admin'), { statusCode: 400 });
  }

  // Resolve manager considering BOTH department and role
  let targetManagerId = null;
  const previousDeptId = ticket.department_id;
  const isDeptReassignment = !!(previousDeptId && previousDeptId !== departmentId);
  if (managerId) {
    const mgrUser = await userRepository.findById(managerId);
    if (!mgrUser) throw Object.assign(new Error('Selected manager not found'), { statusCode: 404 });
    if (mgrUser.status !== 'active') throw Object.assign(new Error('Selected manager is not active'), { statusCode: 400 });

    // Role verification: MUST have the 'manager' role
    if (mgrUser.role !== 'manager') {
      throw Object.assign(new Error("Selected user does not have the 'manager' role. Tickets must be assigned to a department manager."), { statusCode: 400 });
    }

    // Department verification: MUST belong to the specified department
    const inDept = mgrUser.departments && mgrUser.departments.some((d) => d.id === departmentId);
    if (!inDept) {
      throw Object.assign(new Error("Selected manager does not belong to the target department. Ticket routing must consider both department and role."), { statusCode: 400 });
    }
    targetManagerId = mgrUser.id;
  } else {
    // Automatically find the active manager for this department matching both criteria
    const resolvedManager = await ticketRepo.findDepartmentManager(departmentId);
    targetManagerId = resolvedManager?.id || null;
  }

  // Verify department stay duration before allowing reassignment (respecting category or custom ticket time)
  const categoryCooldownMinutes = await getCategoryCooldownMinutes(ticket.category);
  const cooldownMinutes = ticket.reassign_time_minutes !== null && ticket.reassign_time_minutes !== undefined
    ? Number(ticket.reassign_time_minutes)
    : categoryCooldownMinutes;

  const activeDept = await ticketRepo.findActiveAssignment(id, 'department_manager');
  if (activeDept && activeDept.created_at && cooldownMinutes > 0 && !overrideLock && user.role !== 'admin' && user.role !== 'ceo') {
    const elapsedMinutes = Math.floor((Date.now() - new Date(activeDept.created_at).getTime()) / 60000);
    if (elapsedMinutes < cooldownMinutes) {
      const remainingMinutes = cooldownMinutes - elapsedMinutes;
      throw Object.assign(
        new Error(`Department assignment locked: The ticket was assigned to this department ${elapsedMinutes} minute(s) ago. Based on ticket rules, it must stay with the department for at least ${cooldownMinutes} minutes before reassignment (${remainingMinutes} minute(s) remaining).`),
        { statusCode: 400 }
      );
    }
  }

  // Close previous active assignments if reassigned
  if (activeDept) {
    await ticketRepo.reassignAssignment(activeDept.id);
  }
  const activeStaff = await ticketRepo.findActiveAssignment(id, 'staff');
  if (activeStaff) {
    await ticketRepo.reassignAssignment(activeStaff.id);
  }

  const deptUpdatePayload = {
    department_id: departmentId,
    assigned_to: targetManagerId,
    status: 'assigned',
  };
  if (reassignTimeMinutes !== undefined && reassignTimeMinutes !== null && reassignTimeMinutes !== '') {
    deptUpdatePayload.reassign_time_minutes = Math.max(0, parseInt(reassignTimeMinutes, 10));
  }
  await ticketRepo.update(id, deptUpdatePayload);

  await logStatus(id, ticket.status, 'assigned', user, notes || 'Assigned to department manager', meta);
  await ticketRepo.createAssignment({
    ticketId: id,
    departmentId,
    assignedBy: user.id,
    assignedTo: targetManagerId,
    role: 'department_manager',
    notes,
    priority: ticket.priority,
    category: ticket.category,
    fromAssignmentId: activeDept?.id || null,
    status: 'pending',
    acceptedAt: null,
  });

  const updated = await getTicket(user, id);
  if (isDeptReassignment) {
    await notificationService.notifyTicketDepartmentReassigned(updated, previousDeptId, departmentId, user.id, notes);
  } else {
    await notificationService.notifyTicketAssignedToDepartment(updated, departmentId);
  }
  if (targetManagerId) {
    await notificationService.notifyTicketAssigned(updated, targetManagerId, user.id);
  }
  auditService.logAction(user.id, 'assign_department', 'ticket', id, meta?.ip, { departmentId, managerId: targetManagerId, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

// ── Manager: assign / reassign staff (validating BOTH department and role) ──
export const assignStaff = async (user, id, staffId, notes, meta = {}, reassignTimeMinutes = undefined, overrideLock = false) => {
  // Admin cannot directly assign staff: only assign to department
  if (user.role === 'admin') {
    throw Object.assign(
      new Error('Admins cannot directly assign staff. Please assign the ticket to a department so the department manager can assign appropriate staff.'),
      { statusCode: 403 }
    );
  }

  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  const previousStaffId = ticket.assigned_to;
  const isStaffReassignment = !!(previousStaffId && previousStaffId !== staffId);

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (baseStatus === 'closed') {
    throw Object.assign(new Error('Closed tickets are inactive and read-only. Cannot assign staff to a closed ticket.'), { statusCode: 400 });
  }
  if (baseStatus === 'waiting_tenant') {
    throw Object.assign(new Error('Cannot assign staff: Ticket is waiting for tenant response/confirmation.'), { statusCode: 400 });
  }

  // Validate manager belongs to the ticket's department
  if (user.role === 'manager' && ticket.department_id) {
    const mgrUser = await userRepository.findById(user.id);
    const belongsToDept = mgrUser?.departments && mgrUser.departments.some((d) => d.id === ticket.department_id);
    if (!belongsToDept) {
      throw Object.assign(new Error('You can only assign staff for tickets belonging to your department'), { statusCode: 403 });
    }
  }

  // Validate staff member's role and department
  const staff = await userRepository.findById(staffId);
  if (!staff) throw Object.assign(new Error('Staff user not found'), { statusCode: 404 });
  if (staff.status !== 'active') throw Object.assign(new Error('Selected staff member is not active'), { statusCode: 400 });
  if (staff.role !== 'staff') {
    throw Object.assign(new Error("Selected user does not have the 'staff' role"), { statusCode: 400 });
  }
  if (ticket.department_id && (!staff.departments || !staff.departments.some((d) => d.id === ticket.department_id))) {
    throw Object.assign(new Error("Staff member does not belong to the ticket's department"), { statusCode: 400 });
  }

  // If the department manager assignment is still pending, automatically accept it
  const activeDeptMgr = await ticketRepo.findActiveAssignment(id, 'department_manager');
  if (activeDeptMgr && activeDeptMgr.status === 'pending') {
    await ticketRepo.acceptAssignment(activeDeptMgr.id);
  }

  // Verify staff stay duration before allowing reassignment
  const active = await ticketRepo.findActiveAssignment(id, 'staff');
  if (active && active.created_at) {
    const categoryCooldownMinutes = await getCategoryCooldownMinutes(ticket.category);
    const cooldownMinutes = ticket.staff_reassign_time_minutes !== null && ticket.staff_reassign_time_minutes !== undefined
      ? Number(ticket.staff_reassign_time_minutes)
      : categoryCooldownMinutes;

    if (cooldownMinutes > 0 && !overrideLock && user.role !== 'admin' && user.role !== 'ceo') {
      const elapsedMinutes = Math.floor((Date.now() - new Date(active.created_at).getTime()) / 60000);
      if (elapsedMinutes < cooldownMinutes) {
        const remainingMinutes = cooldownMinutes - elapsedMinutes;
        throw Object.assign(
          new Error(`Staff assignment locked: The ticket was assigned to staff ${elapsedMinutes} minute(s) ago. Staff must be given at least ${cooldownMinutes} minutes before reassignment (${remainingMinutes} minute(s) remaining).`),
          { statusCode: 400 }
        );
      }
    }
  }

  if (active) {
    await ticketRepo.reassignAssignment(active.id);
  }

  // Assign ticket to staff with pending staff acceptance
  const staffUpdatePayload = { assigned_to: staffId, status: 'assigned' };
  if (reassignTimeMinutes !== undefined && reassignTimeMinutes !== null && reassignTimeMinutes !== '') {
    staffUpdatePayload.staff_reassign_time_minutes = Math.max(0, parseInt(reassignTimeMinutes, 10));
  }
  await ticketRepo.update(id, staffUpdatePayload);

  await logStatus(id, ticket.status, 'assigned', user, notes || `Assigned to ${staff.first_name || 'staff'} ${staff.last_name || ''} by department manager`, meta);
  await ticketRepo.createAssignment({
    ticketId: id,
    departmentId: ticket.department_id,
    assignedBy: user.id,
    assignedTo: staffId,
    role: 'staff',
    notes,
    priority: ticket.priority,
    category: ticket.category,
    fromAssignmentId: active?.id || null,
    status: 'pending',
    acceptedAt: null,
  });

  if (notes && notes.trim()) {
    const noteReplyId = uuidv4();
    await ticketRepo.addReply({
      id: noteReplyId,
      ticketId: id,
      userId: user.id,
      message: `[Assigned to ${staff.first_name || 'Staff'} ${staff.last_name || ''}]: ${notes.trim()}`,
      visibility: 'department',
      attachmentId: null,
      type: 'note',
      isInternal: 1,
      departmentIds: ticket.department_id || null,
      targetUserId: staffId,
    });
  }

  const updated = await getTicket(user, id);
  if (isStaffReassignment) {
    await notificationService.notifyStaffReassigned(updated, previousStaffId, staffId, user.id, notes);
  } else {
    await notificationService.notifyTicketAssigned(updated, staffId, user.id);
  }
  auditService.logAction(user.id, 'assign_staff', 'ticket', id, meta?.ip, { staffId, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

// ── Dynamically update reassign needed time for department or staff ──
export const updateReassignTime = async (user, id, reassignTimeMinutes, target = 'department', meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const mins = Math.max(0, parseInt(reassignTimeMinutes, 10));
  if (target === 'department') {
    if (user.role !== 'admin' && user.role !== 'ceo') {
      throw Object.assign(new Error('Only Administrator or CEO can adjust department reassignment time'), { statusCode: 403 });
    }
    await ticketRepo.update(id, { reassign_time_minutes: mins });
    await logStatus(id, ticket.status, ticket.status, user, `Dynamically adjusted department reassignment needed time to ${mins} minute(s)`, meta);
  } else {
    if (user.role !== 'admin' && user.role !== 'ceo' && user.role !== 'manager') {
      throw Object.assign(new Error('Only Administrator or Manager can adjust staff reassignment time'), { statusCode: 403 });
    }
    await ticketRepo.update(id, { staff_reassign_time_minutes: mins });
    await logStatus(id, ticket.status, ticket.status, user, `Dynamically adjusted staff reassignment needed time to ${mins} minute(s)`, meta);
  }

  return await getTicket(user, id);
};

// ── Accept / reject an assignment ──
export const acceptAssignment = async (user, id, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  if (user.role === 'staff') {
    // Staff can ONLY accept if they are the designated assigned staff member
    if (String(ticket.assigned_to) !== String(user.id)) {
      throw Object.assign(new Error('Only the assigned staff user can accept this ticket assignment'), { statusCode: 403 });
    }
    const activeStaff = await ticketRepo.findPendingAssignment(id, 'staff');
    if (!activeStaff) {
      const currentActive = await ticketRepo.findActiveAssignment(id, 'staff');
      if (currentActive && currentActive.status === 'accepted') {
        return await getTicket(user, id);
      }
      throw Object.assign(new Error('No pending staff assignment to accept'), { statusCode: 400 });
    }
    if (activeStaff.assigned_to && String(activeStaff.assigned_to) !== String(user.id)) {
      throw Object.assign(new Error('Only the assigned staff user can accept this ticket assignment'), { statusCode: 403 });
    }

    await ticketRepo.acceptAssignment(activeStaff.id);
    await ticketRepo.update(id, { status: 'in_progress' });
    await logStatus(id, ticket.status, 'in_progress', user, 'Staff accepted ticket assignment. Ticket is now In Progress.', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyTicketAccepted(updated, user.id);
    sendTicketAcceptedEmail(updated, user.id).catch(() => { });
    auditService.logAction(user.id, 'accept_assignment', 'ticket', id, meta?.ip, { role: 'staff' }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  if (user.role === 'manager') {
    // Department Manager accepts assignment from Admin to the department
    const mgrUser = await userRepository.findById(user.id);
    const inDept = mgrUser?.departments && mgrUser.departments.some((d) => String(d.id) === String(ticket.department_id));
    if (!inDept) {
      throw Object.assign(new Error('You do not belong to the department assigned to this ticket'), { statusCode: 403 });
    }

    const activeDept = await ticketRepo.findPendingAssignment(id, 'department_manager');
    if (!activeDept) {
      const currentActive = await ticketRepo.findActiveAssignment(id, 'department_manager');
      if (currentActive && currentActive.status === 'accepted') {
        return await getTicket(user, id);
      }
      throw Object.assign(new Error('No pending department assignment from Admin to accept'), { statusCode: 400 });
    }

    await ticketRepo.acceptAssignment(activeDept.id);
    if (!activeDept.assigned_to) {
      await ticketRepo.updateAssignment(activeDept.id, { assigned_to: user.id });
    }

    const updateFields = {};
    if (!ticket.assigned_to) {
      updateFields.assigned_to = user.id;
    }
    if (Object.keys(updateFields).length > 0) {
      await ticketRepo.update(id, updateFields);
    }

    await logStatus(id, ticket.status, ticket.status, user, 'Department Manager accepted ticket assignment for the department', meta);

    await ticketRepo.addReply({
      id: uuidv4(),
      ticketId: id,
      userId: user.id,
      message: `✅ Department Manager (${user.first_name || 'Manager'} ${user.last_name || ''}) accepted the ticket assignment from Admin. Ready for staff delegation.`,
      visibility: 'internal',
      type: 'note',
      isInternal: 1,
      departmentIds: ticket.department_id || null,
    }).catch(() => { });

    const updated = await getTicket(user, id);
    await notificationService.notifyTicketAccepted(updated, user.id);
    sendTicketAcceptedEmail(updated, user.id).catch(() => { });
    auditService.logAction(user.id, 'accept_assignment', 'ticket', id, meta?.ip, { role: 'department_manager' }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  throw Object.assign(new Error('Only department managers or assigned staff can accept assignments'), { statusCode: 403 });
};

export const rejectAssignment = async (user, id, reason, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  if (!reason || !reason.trim()) {
    throw Object.assign(new Error('A reason for rejecting the assignment is required'), { statusCode: 400 });
  }
  const cleanReason = reason.trim();

  if (user.role === 'staff') {
    // Only assigned staff can reject
    if (String(ticket.assigned_to) !== String(user.id)) {
      throw Object.assign(new Error('Only the assigned staff user can reject this assignment'), { statusCode: 403 });
    }
    const activeStaff = await ticketRepo.findActiveAssignment(id, 'staff');
    if (!activeStaff) {
      throw Object.assign(new Error('No active staff assignment to reject'), { statusCode: 400 });
    }

    await ticketRepo.rejectAssignment(activeStaff.id, new Date(), cleanReason);

    // Look up department manager to re-route assignment to department manager
    const deptMgr = await ticketRepo.findDepartmentManager(ticket.department_id);
    const newAssignedTo = deptMgr?.id || null;
    await ticketRepo.update(id, { assigned_to: newAssignedTo, status: 'assigned' });

    await logStatus(id, ticket.status, 'assigned', user, `Staff rejected assignment: ${cleanReason}`, meta);

    // Add visible department note with the rejection reason
    await ticketRepo.addReply({
      id: uuidv4(),
      ticketId: id,
      userId: user.id,
      message: `❌ [Assignment Rejected by Staff (${user.first_name || 'Staff'} ${user.last_name || ''})]: ${cleanReason}`,
      visibility: 'department',
      type: 'note',
      isInternal: 1,
      departmentIds: ticket.department_id || null,
    });

    const updated = await getTicket(user, id);
    if (deptMgr?.id) {
      await notificationService.notifyStaffRejected(updated, deptMgr.id, user.id, cleanReason).catch(() => { });
    }
    auditService.logAction(user.id, 'reject_assignment', 'ticket', id, meta?.ip, { role: 'staff', reason: cleanReason }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  if (user.role === 'manager') {
    // Manager rejects department assignment from Admin
    const mgrUser = await userRepository.findById(user.id);
    const inDept = mgrUser?.departments && mgrUser.departments.some((d) => String(d.id) === String(ticket.department_id));
    if (!inDept) {
      throw Object.assign(new Error('You do not belong to the department assigned to this ticket'), { statusCode: 403 });
    }

    const activeDept = await ticketRepo.findActiveAssignment(id, 'department_manager');
    if (!activeDept) {
      throw Object.assign(new Error('No active department assignment to reject'), { statusCode: 400 });
    }

    await ticketRepo.rejectAssignment(activeDept.id, new Date(), cleanReason);
    // Unassign from department and return ticket to Admin (status 'open')
    await ticketRepo.update(id, { department_id: null, assigned_to: null, status: 'open' });

    await logStatus(id, ticket.status, 'open', user, `Department Manager rejected assignment: ${cleanReason}`, meta);

    // Add internal note with rejection reason
    await ticketRepo.addReply({
      id: uuidv4(),
      ticketId: id,
      userId: user.id,
      message: `❌ [Department Assignment Rejected by Manager (${user.first_name || 'Manager'} ${user.last_name || ''})]: ${cleanReason}`,
      visibility: 'internal',
      type: 'note',
      isInternal: 1,
    });

    const updated = await getTicket(user, id);
    await notificationService.notifyTicketRejected(updated, user.id, cleanReason);
    sendTicketRejectedEmail(updated, user.id, cleanReason).catch(() => { });
    auditService.logAction(user.id, 'reject_assignment', 'ticket', id, meta?.ip, { role: 'department_manager', reason: cleanReason }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  throw Object.assign(new Error('Only department managers or assigned staff can reject assignments'), { statusCode: 403 });
};

export const reassignStaff = async (user, id, staffId, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }
  return assignStaff(user, id, staffId, notes, meta);
};

export const remindStaff = async (user, id, payload = {}, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const notes = typeof payload === 'string' ? payload : (payload.notes || '');
  const targetUserId = typeof payload === 'object' ? (payload.targetUserId || payload.target_user_id || null) : null;
  const targetDeptId = typeof payload === 'object' ? (payload.departmentId || payload.targetDepartmentId || ticket.department_id || ticket.current_department_id || ticket.auto_department_id) : (ticket.department_id || ticket.current_department_id || ticket.auto_department_id);

  // 1. If Admin / CEO: Sends reminder to the Department Manager
  if (user.role === 'admin' || user.role === 'ceo') {
    let targetManager = null;
    if (targetUserId) {
      const [u] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE id = :id LIMIT 1', { id: targetUserId });
      if (u && u.length > 0) targetManager = u[0];
    }

    if (!targetManager && targetDeptId) {
      const managers = await ticketRepo.findDepartmentManagers(targetDeptId);
      if (managers && managers.length > 0) {
        targetManager = managers[0];
      }
    }

    if (!targetManager && ticket.assigned_to) {
      const [u] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE id = :id LIMIT 1', { id: ticket.assigned_to });
      if (u && u.length > 0) targetManager = u[0];
    }

    if (!targetManager) {
      throw Object.assign(
        new Error('No Department Manager found for this ticket. Please ensure the ticket is assigned to a department with an active manager.'),
        { statusCode: 400 }
      );
    }

    await notificationService.notifyManagerReminder(ticket, targetManager, user, notes);
    const mgrName = `${targetManager.first_name || ''} ${targetManager.last_name || ''}`.trim() || 'Department Manager';
    await logStatus(ticket.id, ticket.status, ticket.status, user, `Admin reminder dispatched to Department Manager ${mgrName}: ${notes || 'Action required'}`, meta);
    return {
      message: `Reminder successfully sent to Department Manager (${mgrName})`,
      targetUser: { id: targetManager.id, name: mgrName, role: 'manager' }
    };
  }

  // 2. If Department Manager: Sends reminder to a staff member in their department (selected or assigned)
  if (user.role === 'manager') {
    let targetStaff = null;
    if (targetUserId) {
      const [u] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE id = :id LIMIT 1', { id: targetUserId });
      if (u && u.length > 0) targetStaff = u[0];
    }

    if (!targetStaff && ticket.assigned_to && String(ticket.assigned_to) !== String(user.id)) {
      const [u] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, r.name as role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = :id LIMIT 1`,
        { id: ticket.assigned_to }
      );
      if (u && u.length > 0) targetStaff = u[0];
    }

    if (!targetStaff) {
      throw Object.assign(
        new Error('Please select a staff member from your department to send the reminder to.'),
        { statusCode: 400 }
      );
    }

    await notificationService.notifyStaffReminder(ticket, targetStaff, user, notes);
    const staffName = `${targetStaff.first_name || ''} ${targetStaff.last_name || ''}`.trim() || 'Staff Member';
    await logStatus(ticket.id, ticket.status, ticket.status, user, `Reminder dispatched to staff member ${staffName}: ${notes || 'Action required'}`, meta);
    return {
      message: `Reminder successfully sent to staff member (${staffName})`,
      targetUser: { id: targetStaff.id, name: staffName, role: 'staff' }
    };
  }

  throw Object.assign(new Error('Only Administrators and Department Managers can dispatch assignment reminders.'), { statusCode: 403 });
};

// ── Admin: override assignment attribution (assigned_to / assigned_by) ──
// Lets an admin fetch and control who is recorded as the assignee (assigned_to)
// and who is recorded as the assigner (assigned_by) on a staff assignment.
// Whenever any user performs an assignment/status action, the admin can re-control
// the attribution. Status history stays immutable (audit); this override writes a
// new history entry attributed to the admin.
export const overrideAssignment = async (user, id, { assignedTo, assignedBy, notes }, meta = {}) => {
  if (user.role !== 'admin') throw Object.assign(new Error('Only admin can override assignment attribution'), { statusCode: 403 });

  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (baseStatus === 'closed') {
    throw Object.assign(new Error('Closed tickets are inactive and read-only. Cannot modify assignments on a closed ticket.'), { statusCode: 400 });
  }
  if (baseStatus === 'waiting_tenant') {
    throw Object.assign(new Error('Cannot override assignment: Ticket is waiting for tenant response/confirmation.'), { statusCode: 400 });
  }

  const onlyAttribution = assignedTo === undefined;
  const attributionUser = assignedBy ? assignedBy : user.id;

  if (assignedBy !== undefined && attributionUser) {
    const actor = await userRepository.findById(attributionUser);
    if (!actor) throw Object.assign(new Error('Attribution user not found'), { statusCode: 404 });
  }

  if (onlyAttribution) {
    if (!assignedBy) throw Object.assign(new Error('Provide assignedBy to override attribution'), { statusCode: 400 });
    const active = await ticketRepo.findActiveAssignment(id, 'staff');
    if (!active) throw Object.assign(new Error('No active staff assignment to reattribute'), { statusCode: 400 });
    await ticketRepo.updateAssignment(active.id, { assigned_by: attributionUser });
    await logStatus(id, ticket.status, ticket.status, user, notes || `Assignment attribution set to ${attributionUser}`, meta);
    const updated = await getTicket(user, id);
    auditService.logAction(user.id, 'override_attribution', 'ticket', id, meta?.ip, { assignedBy: attributionUser, notes, assignmentId: active.id }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Reassign current assignee (optionally with a custom attribution user)
  const newAssignedTo = assignedTo || null;
  if (newAssignedTo) {
    throw Object.assign(
      new Error('Admins cannot directly assign staff. Please assign the ticket to a department so the department manager can assign appropriate staff.'),
      { statusCode: 403 }
    );
  }

  const prev = await ticketRepo.findActiveAssignment(id, 'staff');
  if (prev) {
    await ticketRepo.reassignAssignment(prev.id);
  }

  await ticketRepo.update(id, { assigned_to: newAssignedTo, status: newAssignedTo ? 'assigned' : ticket.status });
  await ticketRepo.createAssignment({
    ticketId: id,
    departmentId: ticket.department_id, assignedBy: attributionUser, assignedTo: newAssignedTo, role: 'staff', notes,
    priority: ticket.priority, category: ticket.category, fromAssignmentId: prev?.id || null,
  });

  const toStatus = newAssignedTo ? 'assigned' : ticket.status;
  await logStatus(id, ticket.status, toStatus, user, notes || `Assignment overridden by admin`, meta);

  const updated = await getTicket(user, id);
  if (newAssignedTo) {
    await notificationService.notifyTicketAssigned(updated, newAssignedTo, attributionUser);
  }
  auditService.logAction(user.id, 'override_assignment', 'ticket', id, meta?.ip, { assignedTo: newAssignedTo, assignedBy: attributionUser, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

export const escalateTicket = async (user, id, notes, meta = {}, extra = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  // 1. Staff can only escalate tickets assigned to them
  if (user.role === 'staff' && ticket.assigned_to !== user.id) {
    throw Object.assign(new Error('Staff can only escalate tickets assigned to them'), { statusCode: 403 });
  }

  // 2. Department managers cannot directly escalate tickets to higher authority.
  // Managers review staff escalations and either assign collaborators to resolve within their level or approve the escalation to higher authority.
  if (user.role === 'manager') {
    throw Object.assign(
      new Error('Department managers cannot escalate tickets directly to higher authorities. Managers review and approve escalations submitted by department staff or add collaborators to resolve them internally.'),
      { statusCode: 403 }
    );
  }

  // 3. Determine destination and status
  // Staff escalates to Department Manager; Admin or Executive escalates to Admin/Executive
  const destination = (user.role === 'staff') ? 'manager' : 'admin';
  const newOpStatus = destination === 'admin' ? 'pending_admin' : 'pending_manager';
  const escalationReason = extra.reason || extra.escalationReason || notes || `Escalated by ${user.role} to ${destination}`;
  const problemDescription = extra.problemDescription || notes || 'Assigned work escalated to higher authority for review, collaboration, or decision';
  const actionsAttempted = extra.actionsAttempted || 'Work investigated and attempted; higher authority intervention required';
  const assistanceRequired = extra.assistanceRequired || (destination === 'admin' ? 'Administrative decision / cross-department intervention required' : 'Department Manager review / additional collaborators required');

  await pool.query(
    `UPDATE tickets
     SET status = 'escalated',
         is_escalated = 1,
         escalated_at = NOW(),
         operational_escalation_status = :newOpStatus,
         operational_escalation_reason = :escalationReason,
         updated_at = NOW()
     WHERE id = :id`,
    { id: ticket.id, newOpStatus, escalationReason }
  );

  // Create an operational escalation entry so Manager/Admin can review and add collaborators
  await operationalRepo.create({
    ticketId: ticket.id,
    requestingUserId: user.id,
    departmentId: ticket.department_id || null,
    escalationReason,
    problemDescription,
    actionsAttempted,
    assistanceRequired,
    destination,
    status: newOpStatus,
  }).catch(() => { });

  await logStatus(id, ticket.status, 'escalated', user, notes || `Ticket escalated to ${destination}`, meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketEscalated(updated, user.id, escalationReason).catch(() => { });
  sendTicketEscalatedEmail(updated, escalationReason).catch(() => { });
  auditService.logAction(user.id, 'escalate', 'ticket', id, meta?.ip, { notes: escalationReason, destination }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

export const getMergeCandidates = async (user, targetId, search) => {
  const target = (await ticketRepo.findById(targetId)) || (await ticketRepo.findByIdOrRef(targetId));
  if (!target) throw Object.assign(new Error('Target ticket not found'), { statusCode: 404 });

  if (user.role !== 'admin' && user.role !== 'ceo' && user.role !== 'manager') {
    throw Object.assign(new Error('Only Administrators, CEO, and Department Managers can view merge candidates'), { statusCode: 403 });
  }

  let deptFilter = null;
  if (user.role === 'manager') {
    const isAccessible = await canAccessTicket(user, target);
    if (!isAccessible) {
      throw Object.assign(
        new Error('Unauthorized: Department Managers can only view merge candidates for tickets assigned to them or their department.'),
        { statusCode: 403 }
      );
    }

    const userDeptIds = (await ticketRepo.getUserDepartmentIds(user.id)).map(String);
    const mgrDeptIds = (await ticketRepo.getManagerDepartmentIds(user.id)).map(String);
    const allManagerDeptIds = Array.from(new Set([...userDeptIds, ...mgrDeptIds].filter(Boolean)));
    if (target.department_id) allManagerDeptIds.push(String(target.department_id));
    if (target.auto_department_id) allManagerDeptIds.push(String(target.auto_department_id));
    if (target.current_department_id) allManagerDeptIds.push(String(target.current_department_id));

    if (target.category) {
      const catInfo = await ticketRepo.getDepartmentForCategory(target.category).catch(() => null);
      if (catInfo?.department_id) allManagerDeptIds.push(String(catInfo.department_id));
    }

    deptFilter = allManagerDeptIds;
  } else {
    // Admin and CEO have unrestricted system-wide access across all departments
    deptFilter = null;
  }

  const rows = await ticketRepo.findMergeCandidates(
    target.id,
    target.tenant_id,
    search,
    deptFilter,
    user.role === 'manager' ? user.id : null,
    target.category
  );

  // STRICT RULE: Only tickets in the exact same category as the target ticket can be merge candidates
  const targetCategory = (target.category || '').toLowerCase().trim();
  const eligibleRows = rows.filter((row) => {
    if (!targetCategory) return false;
    const rowCategory = (row.category || '').toLowerCase().trim();
    return rowCategory === targetCategory;
  });

  const scored = eligibleRows.map((row) => {
    const sanitized = sanitizeTicket(row);
    const comparison = compareTicketsForDuplicate(target, row);
    return {
      ...sanitized,
      similarityScore: comparison.score,
      similarityConfidence: comparison.confidence,
      similarityReasons: comparison.reasons,
      isSuggestedDuplicate: comparison.isSuggestedDuplicate,
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored;
};

export const getGlobalDuplicateSuggestions = async (user, departmentId = null) => {
  if (user.role !== 'admin' && user.role !== 'ceo' && user.role !== 'manager') {
    throw Object.assign(new Error('Access denied: Only Admins and Department Managers can access duplicate detection'), { statusCode: 403 });
  }

  let filterDept = null;
  if (user.role === 'manager') {
    const userDeptIds = (await ticketRepo.getUserDepartmentIds(user.id)).map(String);
    const mgrDeptIds = (await ticketRepo.getManagerDepartmentIds(user.id)).map(String);
    const allDepts = Array.from(new Set([...userDeptIds, ...mgrDeptIds].filter(Boolean)));
    if (allDepts.length === 0) {
      return [];
    }
    filterDept = allDepts;
  } else {
    filterDept = departmentId || null;
  }

  const activeTickets = await ticketRepo.findGlobalDuplicateSuggestions(filterDept);
  let suggestions = scanForDuplicates(activeTickets, { minScore: 40 });

  if (user.role === 'manager') {
    const filterDeptStrs = (filterDept || []).map(String);
    suggestions = suggestions
      .map((item) => {
        const deptA = String(item.ticketA?.department_id || item.ticketA?.departmentId || '');
        const deptB = String(item.ticketB?.department_id || item.ticketB?.departmentId || '');
        const canManageA = filterDeptStrs.includes(deptA);
        const canManageB = filterDeptStrs.includes(deptB);

        if (!canManageA && canManageB) {
          return {
            ...item,
            ticketA: item.ticketB,
            ticketB: item.ticketA,
            primaryCandidate: item.ticketB,
            duplicateCandidate: item.ticketA,
          };
        }
        return item;
      })
      .filter((item) => {
        const deptA = String(item.ticketA?.department_id || item.ticketA?.departmentId || '');
        const deptB = String(item.ticketB?.department_id || item.ticketB?.departmentId || '');
        return filterDeptStrs.includes(deptA) || filterDeptStrs.includes(deptB);
      });
  }

  return suggestions;
};

export const getMergedTicketsLedger = async (user, departmentId = null) => {
  if (user.role !== 'admin' && user.role !== 'ceo' && user.role !== 'manager') {
    throw Object.assign(new Error('Access denied: Only Admins, CEO, and Department Managers can view merged tickets ledger'), { statusCode: 403 });
  }

  let filterDept = null;
  if (user.role === 'manager') {
    const userDeptIds = (await ticketRepo.getUserDepartmentIds(user.id)).map(String);
    const mgrDeptIds = (await ticketRepo.getManagerDepartmentIds(user.id)).map(String);
    const allDepts = Array.from(new Set([...userDeptIds, ...mgrDeptIds].filter(Boolean)));
    if (allDepts.length === 0) {
      return [];
    }
    filterDept = allDepts;
  } else {
    filterDept = departmentId || null;
  }

  const ledger = await ticketRepo.findMergedTicketsLedger(filterDept);
  return ledger;
};

export const mergeTickets = async (user, targetId, sourceIds, notes, meta = {}) => {
  if (user.role !== 'admin' && user.role !== 'ceo' && user.role !== 'manager') {
    throw Object.assign(new Error('Only Administrators, CEO, and Department Managers can merge tickets'), { statusCode: 403 });
  }

  const target = (await ticketRepo.findById(targetId)) || (await ticketRepo.findByIdOrRef(targetId));
  if (!target) throw Object.assign(new Error('Target ticket not found'), { statusCode: 404 });

  let allManagerDeptIds = [];
  if (user.role === 'manager') {
    const isTargetAccessible = await canAccessTicket(user, target);
    if (!isTargetAccessible) {
      throw Object.assign(
        new Error('Unauthorized: Department Managers can only merge tickets assigned to them or their department.'),
        { statusCode: 403 }
      );
    }
    const userDeptIds = (await ticketRepo.getUserDepartmentIds(user.id)).map(String);
    const mgrDeptIds = (await ticketRepo.getManagerDepartmentIds(user.id)).map(String);
    allManagerDeptIds = Array.from(new Set([...userDeptIds, ...mgrDeptIds].filter(Boolean)));
    if (target.department_id) allManagerDeptIds.push(String(target.department_id));
    if (target.auto_department_id) allManagerDeptIds.push(String(target.auto_department_id));
    if (target.current_department_id) allManagerDeptIds.push(String(target.current_department_id));
    if (target.category) {
      const catInfo = await ticketRepo.getDepartmentForCategory(target.category).catch(() => null);
      if (catInfo?.department_id) allManagerDeptIds.push(String(catInfo.department_id));
    }
  } else {
    // Admin and CEO have unrestricted system-wide access across all departments
    if (!(await canAccessTicket(user, target))) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
  }

  if (target.merged_into) {
    throw Object.assign(
      new Error(`Cannot merge into a ticket that has already been merged into another ticket. Ticket #${target.reference_number || target.id} is merged into #${target.merged_into}.`),
      { statusCode: 400 }
    );
  }

  const mergeReason = (notes && notes.trim().length >= 3)
    ? notes.trim()
    : 'Duplicate reports combined into primary incident';

  // Resolve source IDs or reference numbers
  const resolvedSources = [];
  const seenIds = new Set();

  for (const sid of (sourceIds || [])) {
    const raw = String(sid).trim();
    if (!raw) continue;
    let src = await ticketRepo.findById(raw);
    if (!src) {
      src = await ticketRepo.findByIdOrRef(raw);
    }
    if (!src) {
      throw Object.assign(new Error(`Ticket "${raw}" could not be found or is inactive.`), { statusCode: 404 });
    }
    if (src.id === target.id) {
      throw Object.assign(new Error(`Cannot merge ticket #${src.reference_number || src.id} into itself. Please select a different ticket.`), { statusCode: 400 });
    }
    if (src.merged_into) {
      throw Object.assign(new Error(`Ticket #${src.reference_number || src.id} has already been merged into primary ticket #${src.merged_into} and cannot be merged again.`), { statusCode: 400 });
    }

    // STRICT RULE: All merged tickets must belong to the exact same category as the primary ticket. Different categories can never be merged.
    const targetCat = (target.category || '').toLowerCase().trim();
    const srcCat = (src.category || '').toLowerCase().trim();
    if (targetCat && srcCat && targetCat !== srcCat) {
      throw Object.assign(
        new Error(
          `Cannot merge tickets with different categories. Target ticket #${target.reference_number || target.id} belongs to category "${target.category}", but candidate ticket #${src.reference_number || src.id} belongs to category "${src.category}". Tickets must have the exact same category to be merged.`
        ),
        { statusCode: 400 }
      );
    }

    if (user.role === 'manager') {
      const isSrcAccessible = await canAccessTicket(user, src);
      const srcDept = String(src.department_id || src.current_department_id || src.auto_department_id || '');
      const isInDept = srcDept && allManagerDeptIds.includes(srcDept);
      if (!isSrcAccessible && !isInDept) {
        throw Object.assign(
          new Error(`Unauthorized: Ticket #${src.reference_number || src.id} is not assigned to your department.`),
          { statusCode: 403 }
        );
      }
    }

    if (!seenIds.has(src.id)) {
      seenIds.add(src.id);
      resolvedSources.push(src);
    }
  }

  if (!resolvedSources.length) {
    throw Object.assign(new Error('No valid source tickets to merge. Please select or provide active tickets.'), { statusCode: 400 });
  }

  const validIds = resolvedSources.map((s) => s.id);

  const sourceRefs = resolvedSources.map((s) => s.reference_number || s.id);

  // Calculate similarity scores for audit trail
  const similarityScores = {};
  for (const src of resolvedSources) {
    const comp = compareTicketsForDuplicate(target, src);
    similarityScores[src.id] = comp.score;
  }

  // Transactionally execute merge updating tickets, ticket_merges, and preserving SLA
  await ticketRepo.mergeTicketsAtomic({
    primaryId: target.id,
    sourceTickets: resolvedSources,
    mergedBy: user.id,
    reason: mergeReason,
    similarityScores,
  });

  const targetRef = target.reference_number || target.id;

  for (const src of resolvedSources) {
    const srcRef = src.reference_number || src.id;
    await logStatus(
      src.id,
      src.status,
      'cancelled',
      user,
      `Merged into Primary Ticket ${targetRef}. Reason: ${mergeReason}`,
      meta
    );

    // Notify secondary ticket tenant with tracking details
    await notificationService.notifyTicketMergedToSecondary({
      sourceTicket: src,
      primaryTicket: target,
      mergedBy: user,
      reason: mergeReason,
    }).catch(() => { });
  }

  // Record an internal timeline event on the target ticket documenting what was merged
  await logStatus(
    target.id,
    target.status,
    target.status,
    user,
    `Merged ticket(s) ${sourceRefs.join(', ')} into this ticket. Reason: ${mergeReason}`,
    meta
  );

  // Add an internal reply note on target ticket so staff and manager see the merged history
  await ticketRepo.addReply({
    id: uuidv4(),
    ticketId: target.id,
    userId: user.id,
    message: `📎 Duplicate Ticket(s) Merged:\nThe following duplicate ticket(s) were merged into this primary ticket by ${user.first_name || ''} ${user.last_name || ''} (${user.role}):\n• ${sourceRefs.join(', ')}\n\nReason: ${mergeReason}\n\nAll original IDs, tenant identities, descriptions, attachments, and audit histories are preserved. Original SLA timers are preserved and frozen as of merge time.`,
    visibility: 'internal',
    attachmentId: null,
    type: 'note',
    isInternal: 1,
    departmentIds: target.department_id || null,
  }).catch(() => { });

  const updated = await getTicket(user, target.id);
  await notificationService.notifyTicketMerged(updated, validIds.length, mergeReason, user, resolvedSources).catch(() => { });
  sendTicketMergedEmail(updated, validIds.length).catch(() => { });
  auditService.logAction(
    user.id,
    'merge',
    'ticket',
    target.id,
    meta?.ip,
    { sourceIds: validIds, sourceRefs, reason: mergeReason, similarityScores },
    { role: user.role, browser: meta?.browser }
  ).catch(() => { });

  return updated;
};

export const closeTicket = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  if (ticket.merged_into) {
    throw Object.assign(
      new Error(`Action not permitted: This ticket has been merged into primary ticket #${ticket.merged_into}. Ticket lifecycle is tracked on the primary ticket.`),
      { statusCode: 400 }
    );
  }

  // A ticket can be marked Closed only after all required work has been completed and the issue has been resolved.
  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (!['waiting_tenant', 'resolved', 'completed'].includes(baseStatus)) {
    throw Object.assign(
      new Error('A ticket can only be marked Closed after all required work has been completed and the issue has been resolved.'),
      { statusCode: 400 }
    );
  }

  // The tenant must confirm that the issue is resolved before the ticket can be finally closed.
  const isTenant = user.role === 'tenant';
  const isTenantConfirmed = ticket.tenant_confirmation_status === 'approved' || isTenant;
  if (!isTenantConfirmed) {
    throw Object.assign(
      new Error('The tenant must confirm that the issue is resolved before the ticket can be finally closed.'),
      { statusCode: 400 }
    );
  }

  const now = new Date();
  const updateFields = {
    status: 'closed',
    closed_at: now,
    tenant_confirmation_status: 'approved',
    reopen_status: 'none',
  };
  if (!ticket.completed_at) updateFields.completed_at = now;
  if (!ticket.resolved_at) updateFields.resolved_at = now;
  if (!ticket.approved_by && isTenant) {
    updateFields.approved_by = user.id;
    updateFields.approved_at = now;
  }

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, 'closed', user, notes || 'Ticket marked closed after tenant resolution confirmation', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketClosed(updated);
  broadcastTicketEvent(id, 'ticket:closed', { ticketId: id, status: 'closed' });
  broadcastTicketEvent(id, 'ticket:updated', { ticketId: id, status: 'closed' });

  // Synchronize closure to all linked duplicate tickets
  const syncedMerged = await ticketRepo.syncPrimaryOutcomeToMerged(
    id,
    'closed',
    notes || `Closed with primary ticket #${ticket.reference_number || ticket.id}`,
    user.id
  ).catch(() => []);
  if (syncedMerged && syncedMerged.length > 0) {
    await notificationService.notifyMergedTicketPrimaryOutcome({
      primaryTicket: updated,
      mergedTickets: syncedMerged,
      outcomeStatus: 'closed',
      notes,
    }).catch(() => { });
  }

  auditService.logAction(
    user.id,
    'close',
    'ticket',
    id,
    meta?.ip,
    { from: ticket.status, to: 'closed', notes, tenantConfirmationStatus: 'approved' },
    { role: user.role, browser: meta?.browser }
  ).catch(() => { });

  return updated;
};

export const calculateActiveElapsedMs = (ticket, history = []) => {
  if (!ticket) return 0;
  if (!history || history.length === 0) {
    if (ticket.resolved_at && ticket.created_at) {
      return Math.max(0, new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime());
    }
    return 0;
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime()
  );

  let totalActiveMs = 0;
  let activeStart = new Date(ticket.created_at).getTime();
  let isCurrentlyActive = true;

  const INACTIVE_STATUSES = ['resolved', 'completed', 'closed', 'waiting_tenant'];
  const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'pending', 'under_review', 'pending_approval', 'reopened', 'escalated'];

  for (const entry of sorted) {
    const t = new Date(entry.created_at || entry.createdAt).getTime();
    const toStatus = entry.to_status || entry.toStatus;

    if (isCurrentlyActive && INACTIVE_STATUSES.includes(toStatus)) {
      totalActiveMs += Math.max(0, t - activeStart);
      isCurrentlyActive = false;
    } else if (!isCurrentlyActive && ACTIVE_STATUSES.includes(toStatus)) {
      activeStart = t;
      isCurrentlyActive = true;
    }
  }

  return totalActiveMs;
};

// ── Reopening Workflow ──

/**
 * requestReopenTicket
 * Only the Tenant who created the ticket can submit a reopening request.
 * The tenant must provide a reason explaining why the issue is unfinished, unresolved, or requires further attention.
 * A Closed ticket remains inactive until the tenant submits a reopening request.
 */
export const requestReopenTicket = async (user, id, reason, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  // Only Tenant can submit a reopening request
  if (user.role !== 'tenant') {
    throw Object.assign(new Error('Only the Tenant who created the ticket can submit a reopening request.'), { statusCode: 403 });
  }

  // Must be the original tenant creator of the ticket
  const isCreator = ticket.created_by === user.id;
  if (!isCreator) {
    throw Object.assign(new Error('Only the original tenant who created the ticket can request reopening.'), { statusCode: 403 });
  }

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (!['closed', 'completed'].includes(baseStatus)) {
    throw Object.assign(
      new Error(`Cannot request reopening for ticket in '${ticket.status}' status. Reopening requests can only be submitted for Closed tickets.`),
      { statusCode: 400 }
    );
  }

  if (ticket.reopen_status === 'requested') {
    throw Object.assign(new Error('A reopening request is already pending review for this ticket.'), { statusCode: 400 });
  }

  const cleanReason = (typeof reason === 'string' ? reason : (reason?.reason || reason?.notes || '')).trim();
  if (!cleanReason) {
    throw Object.assign(new Error('A reason explaining why the issue is unfinished, unresolved, or requires further attention is required.'), { statusCode: 400 });
  }

  const now = new Date();
  const updateFields = {
    reopen_status: 'requested',
    reopen_requested_at: now,
    reopen_requested_by: user.id,
    reopen_request_reason: cleanReason,
  };

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, ticket.status, user, `Tenant requested ticket reopening: ${cleanReason}`, meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketReopenRequested(updated, user.id, cleanReason);
  broadcastTicketEvent(id, 'ticket:reopen_requested', { ticketId: id, reason: cleanReason });
  broadcastTicketEvent(id, 'ticket:updated', { ticketId: id, reopenStatus: 'requested' });

  auditService.logAction(
    user.id,
    'reopen_requested',
    'ticket',
    id,
    meta?.ip,
    { reason: cleanReason, status: ticket.status },
    { role: user.role, browser: meta?.browser }
  ).catch(() => { });

  return updated;
};

/**
 * approveReopenTicket
 * The Admin can approve and reopen any ticket.
 * The Department Manager can approve and reopen only tickets directly routed to or assigned to their department.
 * Staff cannot reopen Closed tickets or independently approve reopening requests.
 */
export const approveReopenTicket = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  // Staff cannot reopen Closed tickets or independently approve reopening requests
  if (user.role === 'staff') {
    throw Object.assign(new Error('Staff cannot reopen Closed tickets or independently approve reopening requests.'), { statusCode: 403 });
  }

  // Tenant cannot approve reopening requests
  if (user.role === 'tenant') {
    throw Object.assign(new Error('Tenants cannot approve ticket reopening.'), { statusCode: 403 });
  }

  // Role permissions: Admin can approve any; Dept Manager can approve only tickets directly routed or assigned to their department
  if (user.role === 'manager') {
    const deptIds = await ticketRepo.getManagerDepartmentIds(user.id);
    const ticketDept = ticket.department_id || ticket.auto_department_id;
    const isDirectlyRoutedOrAssigned = (ticketDept && deptIds.includes(ticketDept)) || ticket.assigned_to === user.id;
    if (!isDirectlyRoutedOrAssigned) {
      throw Object.assign(
        new Error('Department Managers can approve and reopen only tickets directly routed to or assigned to their department.'),
        { statusCode: 403 }
      );
    }
  } else if (user.role !== 'admin' && user.role !== 'ceo') {
    throw Object.assign(new Error(`Role ${user.role} is not permitted to approve reopening.`), { statusCode: 403 });
  }

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (baseStatus === 'reopened') {
    throw Object.assign(new Error('Ticket is already reopened and in active workflow.'), { statusCode: 400 });
  }

  const reason = (typeof notes === 'string' ? notes : (meta?.reason || notes?.reason || notes?.notes || '')).trim()
    || ticket.reopen_request_reason
    || 'Reopening approved by management';

  const now = new Date();

  // Retrieve ticket history to calculate cumulative active elapsed time across repeated resolutions
  const history = await ticketRepo.getStatusHistory(id);
  const activeElapsedMs = calculateActiveElapsedMs(ticket, history);

  // SLA Resolution: Apply Option B (Resume Remaining Resolution SLA Time)
  const categoryRecord = ticket.category ? await categoryRepo.findByName(ticket.category).catch(() => null) : null;
  const categoryId = categoryRecord?.id || ticket.category_id || null;
  const policy = await slaService.resolveEffectivePolicy(categoryId, ticket.priority, ticket.sla_policy_id);

  const { resolutionDueDate, escalationDueDate, effectiveRemainingHours, elapsedHours } =
    slaService.computeReopenDueDates(
      policy || { priority: ticket.priority },
      ticket.created_at,
      ticket.resolved_at || ticket.closed_at,
      now,
      activeElapsedMs
    );

  const updateFields = {
    status: 'reopened',
    reopen_status: 'approved',
    reopened_at: now,
    reopened_by: user.id,
    reopen_reason: reason,
    due_date: resolutionDueDate,
    escalation_due_date: escalationDueDate,
    is_overdue: 0,
    last_sla_warning_at: null,
    escalation_sla_breached: 0,
    tenant_confirmation_status: 'rejected',
  };

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, 'reopened', user, `Reopening approved: ${reason}`, meta);

  const updated = await getTicket(user, id);

  await notificationService.notifyTicketReopened(updated, user.id, reason);
  sendTicketReopenedEmail(updated).catch(() => { });
  broadcastTicketEvent(id, 'ticket:reopened', { ticketId: id, status: 'reopened' });
  broadcastTicketEvent(id, 'ticket:updated', { ticketId: id, status: 'reopened' });

  auditService.logAction(
    user.id,
    'approve_reopen',
    'ticket',
    id,
    meta?.ip,
    {
      from: ticket.status,
      to: 'reopened',
      reason,
      previousDueDate: ticket.due_date,
      newDueDate: resolutionDueDate,
      effectiveRemainingHours,
      elapsedHours,
    },
    { role: user.role, browser: meta?.browser }
  ).catch(() => { });

  return updated;
};

/**
 * rejectReopenTicket
 * Admin or authorized Department Manager declines tenant reopening request.
 * Ticket remains Closed (Inactive).
 */
export const rejectReopenTicket = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  if (user.role === 'staff' || user.role === 'tenant') {
    throw Object.assign(new Error('Only Administrators or authorized Department Managers can decline reopening requests.'), { statusCode: 403 });
  }

  if (user.role === 'manager') {
    const deptIds = await ticketRepo.getManagerDepartmentIds(user.id);
    const ticketDept = ticket.department_id || ticket.auto_department_id;
    const isDirectlyRoutedOrAssigned = (ticketDept && deptIds.includes(ticketDept)) || ticket.assigned_to === user.id;
    if (!isDirectlyRoutedOrAssigned) {
      throw Object.assign(
        new Error('Department Managers can decline reopening requests only for tickets directly routed to or assigned to their department.'),
        { statusCode: 403 }
      );
    }
  }

  if (ticket.reopen_status !== 'requested') {
    throw Object.assign(new Error('This ticket does not have a pending reopening request.'), { statusCode: 400 });
  }

  const cleanNotes = (typeof notes === 'string' ? notes : (notes?.notes || notes?.reason || '')).trim();
  if (!cleanNotes) {
    throw Object.assign(new Error('A reason is required to decline the reopening request.'), { statusCode: 400 });
  }

  const updateFields = {
    reopen_status: 'rejected',
  };

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, ticket.status, user, `Reopening request declined: ${cleanNotes}`, meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketReopenRejected(updated, user.id, cleanNotes);
  broadcastTicketEvent(id, 'ticket:reopen_declined', { ticketId: id, notes: cleanNotes });
  broadcastTicketEvent(id, 'ticket:updated', { ticketId: id, reopenStatus: 'rejected' });

  auditService.logAction(
    user.id,
    'reject_reopen',
    'ticket',
    id,
    meta?.ip,
    { notes: cleanNotes, fromReopenStatus: 'requested', toReopenStatus: 'rejected' },
    { role: user.role, browser: meta?.browser }
  ).catch(() => { });

  return updated;
};

/**
 * reopenTicket
 * Enforces the complete lifecycle:
 * Closed (Inactive) → Tenant Requests Reopening → Admin/Authorized Department Manager Approves → Reopened (Active)
 */
export const reopenTicket = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  // Staff cannot reopen Closed tickets or independently approve reopening requests
  if (user.role === 'staff') {
    throw Object.assign(
      new Error('Staff cannot reopen Closed tickets or independently approve reopening requests.'),
      { statusCode: 403 }
    );
  }

  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');

  // Critical business rule: For a Closed ticket, tenant submits a request; admin / manager approves
  if (['closed', 'completed'].includes(baseStatus)) {
    if (user.role === 'tenant') {
      return requestReopenTicket(user, id, notes, meta);
    }
    return approveReopenTicket(user, id, notes, meta);
  }

  // If waiting for tenant, tenant rejecting resolution
  if (baseStatus === 'waiting_tenant') {
    if (user.role !== 'tenant') {
      throw Object.assign(new Error('This ticket is waiting for tenant response/confirmation and cannot be reopened until the tenant responds.'), { statusCode: 400 });
    }
    return approveReopenTicket({ ...user, role: 'admin' }, id, notes || 'Tenant rejected proposed solution (issue not resolved)', meta);
  }

  // Resolved status prior to closure
  if (baseStatus === 'resolved') {
    if (user.role === 'tenant') {
      return requestReopenTicket(user, id, notes, meta);
    }
    return approveReopenTicket(user, id, notes, meta);
  }

  throw Object.assign(
    new Error(`Cannot transition from ${ticket.status} to reopened. Only resolved or closed tickets can be reopened.`),
    { statusCode: 400 }
  );
};

export const approveResolution = async (user, id, notes, meta = {}, feedbackData = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  const now = new Date();

  // Tier 1: Staff CANNOT approve resolutions
  if (user.role === 'staff') {
    throw Object.assign(
      new Error('Staff cannot approve ticket resolutions. Only Department Managers, Admins, or Tenants can approve.'),
      { statusCode: 403 }
    );
  }

  // Tier 2: Department Manager approves staff's resolution (under_review -> pending_approval)
  if (user.role === 'manager') {
    if (ticket.status !== 'under_review') {
      throw Object.assign(
        new Error(`Department Manager can only approve tickets currently 'under_review'. Current status is '${ticket.status}'.`),
        { statusCode: 400 }
      );
    }
    const targetStatus = 'pending_approval';
    await ticketRepo.update(id, { status: targetStatus });
    await logStatus(id, ticket.status, targetStatus, user, notes || 'Department Manager approved resolution; submitted for Admin verification', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyManagerApprovedResolution(updated, user.id, notes);
    auditService.logAction(user.id, 'manager_approve_resolution', 'ticket', id, meta?.ip, { notes, targetStatus }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Tier 3: Admin verifies & approves resolution (pending_approval or under_review -> waiting_tenant)
  if (user.role === 'admin' || user.role === 'ceo') {
    if (['pending_approval', 'under_review'].includes(ticket.status)) {
      let slaAchieved = false;
      const dueDate = ticket.due_date ? new Date(ticket.due_date) : null;
      if (dueDate && now <= dueDate) {
        slaAchieved = true;
      }

      const targetStatus = 'waiting_tenant';
      const updateFields = {
        status: targetStatus,
        resolved_at: now,
        tenant_confirmation_status: 'pending',
      };
      if (ticket.due_date) updateFields.is_overdue = slaAchieved ? 0 : 1;
      updateFields.sla_achieved = slaAchieved ? 1 : 0;
      updateFields.sla_status = slaAchieved ? 'completed_successfully' : 'resolution_breached';

      await ticketRepo.update(id, updateFields);
      await logStatus(id, ticket.status, targetStatus, user, notes || 'Admin verified and approved resolution; routed to tenant for confirmation', meta);

      const updated = await getTicket(user, id);
      await notificationService.notifyAdminVerifiedResolution(updated, user.id, notes);
      auditService.logAction(user.id, 'admin_verify_resolution', 'ticket', id, meta?.ip, { targetStatus, slaAchieved }, { role: user.role, browser: meta?.browser }).catch(() => { });
      return updated;
    }
  }

  // Tier 4: Tenant confirms resolution as solved (waiting_tenant or resolved -> completed)
  if (user.role === 'tenant' || user.role === 'admin' || user.role === 'ceo') {
    if (!['waiting_tenant', 'resolved', 'pending_approval', 'completed', 'escalated'].includes(ticket.status)) {
      throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be confirmed as completed'), { statusCode: 400 });
    }

    const updateFields = {
      status: 'closed',
      closed_at: now,
      completed_at: now,
      tenant_confirmation_status: 'approved',
      approved_by: user.id,
      approved_at: now,
      reopen_status: 'none',
    };
    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, 'closed', user, notes || 'Tenant confirmed issue resolved; ticket closed', meta);

    // Save Tenant satisfaction feedback if rating or feedback text is provided
    const ratingVal = feedbackData?.rating ? Number(feedbackData.rating) : null;
    const feedbackText = feedbackData?.feedback || feedbackData?.message || notes;
    if (ratingVal || feedbackText) {
      const fbId = await getNextFeedbackId().catch(() => null);
      const fbNum = fbId && /^\d+$/.test(fbId) ? Number(fbId) : null;
      await feedbackRepo.create({
        id: fbId || uuidv4().slice(0, 8),
        feedbackNum: fbNum,
        tenantId: user.tenant_id || ticket.tenant_id || null,
        ticketId: id,
        subject: `Ticket ${ticket.reference_number || ticket.referenceNumber} Resolution Feedback`,
        message: feedbackText || 'Tenant confirmed issue resolved',
        rating: ratingVal || 5,
        feedbackType: 'suggestion',
        status: 'resolved',
      }).catch((err) => console.error('[FEEDBACK] Error saving tenant feedback:', err));
    }

    const updated = await getTicket(user, id);
    await notificationService.notifyTenantConfirmedResolution(updated, user.id, ratingVal, feedbackText);
    sendTicketCompletedEmail(updated).catch(() => { });
    auditService.logAction(user.id, 'tenant_confirm_resolution', 'ticket', id, meta?.ip, { notes, rating: ratingVal, newStatus: 'completed' }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  throw Object.assign(new Error('Unauthorized to approve resolution'), { statusCode: 403 });
};

export const rejectResolution = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let staffNotes = notes;
  if (ticket.merged_into) {
    staffNotes = `${notes ? notes + ' ' : ''}[Merged Ticket Assignment: Designated for tenant case management under Primary Ticket #${ticket.merged_into}]`;
  }

  if (user.role === 'staff') {
    throw Object.assign(new Error('Staff cannot reject ticket resolutions'), { statusCode: 403 });
  }

  const now = new Date();

  // Tier 2: Manager requests rework from Staff (under_review -> in_progress)
  if (user.role === 'manager') {
    if (ticket.status !== 'under_review') {
      throw Object.assign(
        new Error(`Department Manager can only request rework on tickets 'under_review'. Current status is '${ticket.status}'.`),
        { statusCode: 400 }
      );
    }
    const updateFields = {
      status: 'in_progress',
      reopen_reason: notes || 'Department Manager requested rework',
    };
    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, 'in_progress', user, notes || 'Department Manager requested rework', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyReworkRequested(updated, user.id, notes || 'Department Manager requested rework', 'staff');
    auditService.logAction(user.id, 'manager_request_rework', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Tier 3: Admin returns resolution for revision (pending_approval -> in_progress)
  if ((user.role === 'admin' || user.role === 'ceo') && ticket.status === 'pending_approval') {
    const updateFields = {
      status: 'in_progress',
      reopen_reason: notes || 'Admin returned resolution for revision',
    };
    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, 'in_progress', user, notes || 'Admin returned resolution for revision', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyReworkRequested(updated, user.id, notes || 'Admin returned for revision', 'manager');
    auditService.logAction(user.id, 'admin_return_revision', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Tier 4: Tenant rejects resolution (issue NOT solved) -> reopen ticket
  if (!['waiting_tenant', 'resolved', 'pending_approval', 'escalated'].includes(ticket.status)) {
    throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be rejected'), { statusCode: 400 });
  }

  return reopenTicket(user, id, notes || 'Tenant rejected proposed solution (issue not resolved)', meta);
};

export const markResolved = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const rawTicketStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (rawTicketStatus === 'waiting_tenant') {
    throw Object.assign(new Error('Ticket is already resolved and waiting for tenant response/confirmation.'), { statusCode: 400 });
  }

  const now = new Date();

  // Tier 1: Staff resolves -> transitions to under_review (Department Manager Approval Pending)
  if (user.role === 'staff') {
    if (!['in_progress', 'assigned'].includes(ticket.status)) {
      throw Object.assign(
        new Error(`Cannot submit resolution from status '${ticket.status}'. Ticket must be in progress.`),
        { statusCode: 400 }
      );
    }
    const targetStatus = 'under_review';
    await ticketRepo.update(id, { status: targetStatus });
    await logStatus(id, ticket.status, targetStatus, user, notes || 'Staff marked ticket resolved; submitted for Department Manager approval', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyStaffSubmittedResolution(updated, user.id, notes);
    auditService.logAction(user.id, 'staff_resolve_submitted', 'ticket', id, meta?.ip, { targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Tier 2: Department Manager approves / resolves -> transitions to pending_approval (Admin Verification Pending)
  if (user.role === 'manager') {
    if (!['under_review', 'in_progress', 'assigned'].includes(ticket.status)) {
      throw Object.assign(
        new Error(`Cannot approve resolution from status '${ticket.status}'. Ticket must be under review or in progress.`),
        { statusCode: 400 }
      );
    }
    const targetStatus = 'pending_approval';
    await ticketRepo.update(id, { status: targetStatus });
    await logStatus(id, ticket.status, targetStatus, user, notes || 'Department Manager approved resolution; submitted for Admin verification', meta);

    const updated = await getTicket(user, id);
    await notificationService.notifyManagerApprovedResolution(updated, user.id, notes);
    auditService.logAction(user.id, 'manager_resolve_approved', 'ticket', id, meta?.ip, { targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  // Tier 3: Admin verifies & resolves -> transitions to waiting_tenant (Notifies Tenant for confirmation)
  if (user.role === 'admin' || user.role === 'ceo') {
    let slaAchieved = false;
    const dueDate = ticket.due_date ? new Date(ticket.due_date) : null;
    if (dueDate && now <= dueDate) {
      slaAchieved = true;
    }

    const targetStatus = 'waiting_tenant';
    const updateFields = {
      status: targetStatus,
      resolved_at: now,
      tenant_confirmation_status: 'pending',
    };
    if (ticket.due_date) updateFields.is_overdue = slaAchieved ? 0 : 1;
    updateFields.sla_achieved = slaAchieved ? 1 : 0;
    updateFields.sla_status = slaAchieved ? 'completed_successfully' : 'resolution_breached';

    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, targetStatus, user, notes || 'Admin verified and marked resolved; awaiting tenant confirmation', meta);

    const updated = await getTicket(user, id);
    const resolutionMinutes = dueDate
      ? Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 60000)
      : null;

    await notificationService.notifyAdminVerifiedResolution(updated, user.id, notes);
    auditService.logAction(user.id, 'admin_verified_resolution', 'ticket', id, meta?.ip, { targetStatus, slaAchieved, resolutionMinutes }, { role: user.role, browser: meta?.browser }).catch(() => { });
    return updated;
  }

  throw Object.assign(new Error('Unauthorized to mark ticket resolved'), { statusCode: 403 });
};

export const changePriority = async (user, id, priority, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  if (!TICKET_PRIORITIES.includes(priority)) throw Object.assign(new Error('Invalid priority'), { statusCode: 400 });

  const old = ticket.priority;
  await ticketRepo.update(id, { priority });
  const categoryRecord = await categoryRepo.findByName(ticket.category).catch(() => null);
  const dueDates = await slaService.computeDueDate(priority, new Date(ticket.created_at), categoryRecord?.id || null);

  const effectivePolicy = await slaService.resolveEffectivePolicy(
    categoryRecord?.id || null,
    priority,
    categoryRecord?.sla_policy_id || null
  );
  const updateFields = {
    due_date: dueDates.resolutionDueDate,
    response_due_date: dueDates.responseDueDate,
    escalation_due_date: dueDates.escalationDueDate,
  };
  if (effectivePolicy?.id) {
    updateFields.sla_policy_id = effectivePolicy.id;
  }
  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, ticket.status, user, `Priority changed: ${old} -> ${priority}`, meta);

  const updated = await getTicket(user, id);
  auditService.logAction(user.id, 'change_priority', 'ticket', id, meta?.ip, { from: old, to: priority }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

export const changeCategory = async (user, id, category, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const old = ticket.category;
  let categoryRecord = await categoryRepo.findByName(category).catch(() => null);
  if (!categoryRecord && category) {
    categoryRecord = await categoryRepo.findById(category).catch(() => null);
  }
  if (!categoryRecord && category) {
    const [deptMatch] = await pool.query(
      'SELECT id FROM departments WHERE LOWER(TRIM(name)) = LOWER(TRIM(:cat)) LIMIT 1',
      { cat: category }
    ).catch(() => [[]]);
    if (deptMatch && deptMatch.length > 0) {
      throw Object.assign(new Error('Invalid category: please select a created ticket category rather than a department name'), { statusCode: 400 });
    }
  }
  const canonicalCategory = categoryRecord?.name || category;
  const catInfo = await ticketRepo.getDepartmentForCategory(canonicalCategory).catch(() => ({ department_id: null, sla_policy_id: null, routing_type: 'general' }));
  const updateFields = { category: canonicalCategory };
  if (catInfo.department_id) updateFields.department_id = catInfo.department_id;
  updateFields.routing_type = catInfo.routing_type || 'general';
  const dueDates = await slaService.computeDueDate(ticket.priority, new Date(ticket.created_at), categoryRecord?.id || null);
  updateFields.due_date = dueDates.resolutionDueDate;
  updateFields.response_due_date = dueDates.responseDueDate;
  updateFields.escalation_due_date = dueDates.escalationDueDate;

  const effectivePolicy = await slaService.resolveEffectivePolicy(
    categoryRecord?.id || null,
    ticket.priority,
    categoryRecord?.sla_policy_id || catInfo.sla_policy_id || null
  );
  if (effectivePolicy?.id) {
    updateFields.sla_policy_id = effectivePolicy.id;
  }

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, ticket.status, user, `Category changed: ${old} -> ${category}`, meta);

  const updated = await getTicket(user, id);
  auditService.logAction(user.id, 'change_category', 'ticket', id, meta?.ip, { from: old, to: category }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return updated;
};

export const addInternalNote = async (user, id, message, attachmentId = null, departmentId = null, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  if (!['admin', 'manager', 'staff'].includes(user.role)) {
    throw Object.assign(new Error('Only staff can add internal notes'), { statusCode: 403 });
  }

  const replyId = uuidv4();
  await ticketRepo.addReply({ id: replyId, ticketId: id, userId: user.id, message, visibility: 'internal', attachmentId, type: 'note', isInternal: 1, departmentIds: departmentId });
  const saved = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  await notificationService.notifyInternalNote(saved, user.id, departmentId);
  auditService.logAction(user.id, 'internal_note', 'ticket', id, meta?.ip, { message, departmentId }, { role: user.role, browser: meta?.browser }).catch(() => { });
  return getTicket(user, id);
};

export const addAttachments = async (user, id, files = [], comment = null, meta = {}) => {
  const ticket = (await ticketRepo.findById(id)) || (await ticketRepo.findByIdOrRef(id));
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  // Enforce max 5 attachments
  if ((ticket.attachments?.length || 0) + files.length > 5) {
    throw Object.assign(new Error('Maximum 5 attachments allowed'), { statusCode: 400 });
  }
  const cleanComment = typeof comment === 'string' && comment.trim() ? comment.trim() : null;
  for (const file of files) {
    await ticketRepo.addAttachment({
      id: uuidv4(), ticketId: id, fileName: file.originalname,
      originalName: file.originalname, fileSize: file.size || 0,
      filePath: `/uploads/tickets/${file.filename}`, mimeType: file.mimetype, uploadedBy: user.id,
      comment: cleanComment,
    });
  }
  const reasonText = cleanComment ? `Uploaded ${files.length} file(s) — Reason: "${cleanComment}"` : `Uploaded ${files.length} file(s)`;
  await logStatus(id, ticket.status, ticket.status, user, reasonText, meta);
  return getTicket(user, id);
};

export const getCategories = async () => ticketRepo.getCategories();

// Visibility model for ticket replies:
//   all       -> tenant + all team
//   internal  -> team only (department-restricted), hidden from tenant
//   tenant    -> tenant only, hidden from staff
//   department-> chosen department only, hidden from tenant
//   both      -> tenant + chosen department
const splitCsv = (v) => (v || '').toString().split(',').map((s) => s.trim()).filter(Boolean);

export const isReplyVisible = (user, reply, userDeptIds = [], ticket = null) => {
  const visibility = reply.visibility;
  const isInternal = visibility === 'internal' || visibility === 'admin' || reply.isInternal === 1 || reply.isInternal === true;
  const deptIds = splitCsv(reply.departmentIds || reply.department_ids);
  const authorDepts = splitCsv(reply.authorDepartmentIds || reply.author_department_ids);
  const targetUserId = reply.target_user_id || reply.targetUserId;

  // Author of the reply can always see their own reply
  const isAuthor = (reply.userId && reply.userId === user.id) || (reply.user_id && reply.user_id === user.id);
  if (isAuthor) return true;

  // Admin and CEO can always see everything
  if (user.role === 'admin' || user.role === 'ceo') return true;

  // If reply was assigned / directed to a specific staff user:
  if (targetUserId) {
    if (user.id === targetUserId) return true;
    const ticketDeptId = ticket?.department_id || ticket?.departmentId || ticket?.auto_department_id;
    const isInTicketDept = ticketDeptId && userDeptIds.includes(ticketDeptId);
    if (user.role === 'manager' && (isInTicketDept || authorDepts.some((d) => userDeptIds.includes(d)))) return true;
    return false;
  }

  // Admin-only replies are strictly between the author and Admins
  if (visibility === 'admin') return false;

  // Check if reply author was a tenant
  const isAuthorTenant = reply.user_role === 'tenant' || reply.userRole === 'tenant' || reply.author_role === 'tenant' || (ticket && (ticket.created_by === (reply.user_id || reply.userId)));

  if (user.role === 'tenant') {
    if (visibility === 'department' || visibility === 'internal' || isInternal) return false;
    return true;
  }

  // Viewing user is staff, manager, or other internal role
  const routingType = ticket?.routing_type || ticket?.routingType || 'general';
  const ticketDeptId = ticket?.department_id || ticket?.departmentId || ticket?.auto_department_id;
  const isAssignedUser = ticket && (ticket.assigned_to === user.id || ticket.assignedTo === user.id);
  const isInTicketDept = ticketDeptId && userDeptIds.includes(ticketDeptId);
  const isInReplyDepts = deptIds.length > 0 && deptIds.some((d) => userDeptIds.includes(d));

  if (isAuthorTenant) {
    if (routingType === 'direct') {
      // Direct category routing: routed to the Department Manager of that department (and Admin)
      // Staff should NOT see raw tenant comments directly; the manager assigns comments/tasks to staff.
      if (user.role === 'manager' && isInTicketDept) return true;
      return false;
    } else {
      // General category routing: strictly routed to Admin.
      // Neither staff nor department managers see tenant comments directly.
      return false;
    }
  }

  // If viewing user is staff: only sees comments assigned directly to them or internal department notes
  if (user.role === 'staff') {
    if (visibility === 'department' && (isInTicketDept || isInReplyDepts)) return true;
    if (visibility === 'all' && (isInTicketDept || isAssignedUser)) return true;
    return false;
  }

  // Staff / Manager / Admin author replies:
  if (visibility === 'all') return true;
  if (visibility === 'tenant') {
    if (isAssignedUser || isInTicketDept) return true;
    return false;
  }

  // internal | department | both => department restricted
  if (isAssignedUser) return true;
  if (isInTicketDept) return true;

  if (deptIds.length === 0) {
    if (visibility === 'internal') {
      return authorDepts.length === 0 ? false : authorDepts.some((d) => userDeptIds.includes(d));
    }
    return false;
  }
  return deptIds.some((d) => userDeptIds.includes(d));
};

export const addReply = async (user, ticketId, message, visibility = 'all', attachmentId = null, meta = {}, departmentIds = null, targetUserId = null) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let effectiveVisibility = visibility;
  let effectiveDeptIds = departmentIds;

  // When a comment or reply is created by a tenant:
  // - Direct ticket categories: routed to the Department Manager of the ticket category's department
  // - General ticket categories: routed strictly to Admin
  if (user.role === 'tenant') {
    let routingType = ticket.routing_type;
    let targetDeptId = ticket.department_id || ticket.auto_department_id;

    if (!routingType || !targetDeptId) {
      const catInfo = await ticketRepo.getDepartmentForCategory(ticket.category).catch(() => null);
      if (catInfo) {
        if (!routingType) routingType = catInfo.routing_type;
        if (!targetDeptId) targetDeptId = catInfo.department_id;
      }
    }
    routingType = routingType || 'general';

    if (routingType === 'direct') {
      effectiveVisibility = 'both';
      effectiveDeptIds = targetDeptId || null;
    } else {
      effectiveVisibility = 'admin';
      effectiveDeptIds = null;
    }
  }

  if (targetUserId) {
    effectiveVisibility = 'department';
  }

  // Enforce tenant announcement / tenant-facing response routing rules:
  // - General routing: only Admin can announce or respond directly to tenants
  // - Direct routing: only the Department Head (manager) of the assigned department can announce or respond directly to tenants
  if (
    ['admin', 'manager', 'staff'].includes(user.role) &&
    ['all', 'tenant', 'both'].includes(effectiveVisibility)
  ) {
    let ticketRouting = ticket.routing_type;
    let ticketDeptId = ticket.department_id || ticket.auto_department_id;
    if (!ticketRouting || !ticketDeptId) {
      const catInfo = await ticketRepo.getDepartmentForCategory(ticket.category).catch(() => null);
      if (catInfo) {
        if (!ticketRouting) ticketRouting = catInfo.routing_type;
        if (!ticketDeptId) ticketDeptId = catInfo.department_id;
      }
    }
    ticketRouting = ticketRouting || 'general';

    if (ticketRouting === 'direct') {
      if (user.role !== 'manager') {
        throw Object.assign(
          new Error('For direct-routing tickets, only the Head of the assigned department can announce or respond to the tenant.'),
          { statusCode: 403 }
        );
      }
      const userDeptIds = await ticketRepo.getUserDepartmentIds(user.id);
      if (!ticketDeptId || !userDeptIds.includes(ticketDeptId)) {
        throw Object.assign(
          new Error('Only the Department Head of the ticket\'s assigned department can announce or respond to the tenant.'),
          { statusCode: 403 }
        );
      }
    } else if (user.role !== 'admin') {
      throw Object.assign(
        new Error('For general-routing tickets, only Admin can announce or respond to the tenant.'),
        { statusCode: 403 }
      );
    }
  }

  const replyId = uuidv4();
  const isInternal = (effectiveVisibility === 'internal' || effectiveVisibility === 'department' || effectiveVisibility === 'admin' || !!targetUserId) ? 1 : 0;
  await ticketRepo.addReply({
    id: replyId, ticketId, userId: user.id, message, visibility: effectiveVisibility, attachmentId,
    type: 'reply', isInternal, departmentIds: effectiveDeptIds || null,
    targetUserId: targetUserId || null,
  });

  // If the ticket was waiting for tenant response/confirmation, a tenant reply unlocks it and automatically transitions back to in_progress
  const baseStatus = (ticket.status || '').replace(/^escalated\./, '');
  if (user.role === 'tenant' && baseStatus === 'waiting_tenant') {
    const targetStatus = ticket.status.startsWith('escalated.') ? 'escalated.in_progress' : (ticket.status === 'escalated' ? 'escalated' : 'in_progress');
    const updatePayload = {
      status: targetStatus,
    };
    await ticketRepo.update(ticketId, updatePayload);
    await logStatus(ticketId, ticket.status, targetStatus, user, 'Tenant replied to inquiry: Ticket resumed to In Progress', meta);
    broadcastTicketEvent(ticketId, 'ticket:updated', { ticketId, status: targetStatus });
  }

  // Track response SLA satisfaction when staff/manager/admin responds to user
  if (!isInternal && ['admin', 'manager', 'staff'].includes(user.role)) {
    if (ticket.response_due_date && (ticket.response_sla_breached === null || ticket.response_sla_breached === 0)) {
      const now = new Date();
      const breached = now > new Date(ticket.response_due_date) ? 1 : 0;
      await ticketRepo.update(ticketId, {
        response_sla_breached: breached,
      }).catch(() => { });
    }
  }

  const savedTicket = await ticketRepo.findById(ticketId);
  await notificationService.notifyTicketReply(savedTicket, user.id, isInternal === 1, effectiveVisibility, targetUserId, message);

  const replies = await ticketRepo.getReplies(ticketId);
  return replies.find((r) => r.id === replyId) || { id: replyId };
};

export const getReplies = async (user, ticketId) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const replies = await ticketRepo.getReplies(ticketId);

  const userDeptIds = (user.role === 'tenant' || user.role === 'admin' || user.role === 'ceo')
    ? []
    : await ticketRepo.getUserDepartmentIds(user.id);

  const visible = replies.filter((r) => isReplyVisible(user, r, userDeptIds, ticket));

  return visible.map((r) => ({
    id: r.id, ticketId: r.ticket_id, userId: r.user_id, userName: r.user_name,
    userRole: r.user_role,
    targetUserId: r.target_user_id, targetUserName: r.target_user_name, targetUserRole: r.target_user_role,
    message: r.message, visibility: r.visibility, type: r.type, isInternal: !!r.is_internal,
    attachmentId: r.attachment_id, createdAt: r.created_at,
    departmentIds: r.department_ids, authorDepartmentIds: r.author_department_ids,
  }));
};

export const getTimeline = async (user, ticketId) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  const events = await ticketRepo.getTimeline(ticketId);

  const userDeptIds = (user.role === 'tenant' || user.role === 'admin' || user.role === 'ceo')
    ? []
    : await ticketRepo.getUserDepartmentIds(user.id);

  const filtered = events.filter((e) => (e.kind !== 'comment' && e.type !== 'comment') || isReplyVisible(user, e, userDeptIds, ticket));

  return filtered.map((e) => ({
    id: e.id, kind: e.kind, type: e.type, message: e.message, notes: e.notes,
    fromStatus: e.from_status, toStatus: e.to_status, visibility: e.visibility,
    userRole: e.user_role,
    isInternal: e.visibility === 'internal' || e.visibility === 'department' || e.visibility === 'admin',
    actorName: e.actor_name, createdAt: e.created_at,
    departmentIds: e.department_ids, authorDepartmentIds: e.author_department_ids,
  }));
};

export const getUserNotifications = (userId, options = {}) => notificationService.getUserNotifications(userId, options);
export const getUserUnreadCount = (userId) => notificationService.getUserUnreadCount(userId);
export const markNotificationAsRead = (id, userId) => notificationService.markNotificationAsRead(id, userId);
export const markAllNotificationsAsRead = (userId) => notificationService.markAllNotificationsRead(userId);
export const deleteNotification = (id, userId) => notificationService.deleteNotification(id, userId);

export const getDepartmentManagers = async (departmentId) => {
  return ticketRepo.findDepartmentManagers(departmentId);
};

// Backward-compatible aliases (new behavior preserved)
export { approveResolution as approveCompletion };
export { rejectResolution as rejectCompletion };
export { markResolved as markCompleted };

