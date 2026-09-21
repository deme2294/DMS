import { v4 as uuidv4 } from 'uuid';
import * as ticketRepo from '../repository/ticketRepository.js';
import { sanitizeTicket } from '../models/Ticket.js';
import { TICKET_STATUS_TRANSITIONS, TICKET_PRIORITIES } from '../config/constants.js';
import * as auditService from './auditService.js';
import { sendTicketCreatedEmail, sendTicketStatusEmail, sendTicketAssignedEmail, sendTicketReplyEmail, sendTicketResolvedEmail, sendTicketClosedEmail, sendTicketEscalatedEmail, sendTicketCompletedEmail, sendTicketApprovedEmail, sendTicketReopenedEmail, sendTicketMergedEmail, sendTicketAcceptedEmail, sendTicketRejectedEmail } from './emailService.js';
import * as notificationService from './notificationService.js';
import * as slaService from './slaService.js';
import * as slaRepo from '../repository/slaRepository.js';
import * as categoryRepo from '../repository/categoryRepository.js';
import * as userRepository from '../repository/userRepository.js';
import pool from '../config/db.js';

const canTransition = (role, fromStatus, toStatus) => {
  const map = TICKET_STATUS_TRANSITIONS[role];
  if (!map) return false;
  return (map[fromStatus] || []).includes(toStatus);
};

const buildScope = async (user) => {
  if (user.role === 'admin') return {};
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

const canAccessTicket = async (user, ticket) => {
  if (!ticket) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'tenant') return ticket.tenant_id === user.tenant_id;
  if (user.role === 'staff') return ticket.assigned_to === user.id;
  if (user.role === 'manager') {
    const deptIds = await ticketRepo.getManagerDepartmentIds(user.id);
    // Standard dept-based access
    if (ticket.department_id && deptIds.includes(ticket.department_id)) return true;
    // Direct assignment: allow if the ticket's dept is manager's (or unset) — not cross-dept
    if (ticket.assigned_to === user.id) {
      return !ticket.department_id || deptIds.includes(ticket.department_id);
    }
    return false;
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

export const getTicket = async (user, id) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  const history = await ticketRepo.getStatusHistory(id);
  const assignments = await ticketRepo.getAssignments(id);
  return {
    ...sanitizeTicket(ticket),
    statusHistory: history.map((h) => ({
      id: h.id, fromStatus: h.from_status, toStatus: h.to_status, changedBy: h.changed_by,
      changedByName: h.changed_by_name, notes: h.notes, role: h.role, createdAt: h.created_at,
    })),
    assignments: assignments.map((a) => ({
      id: a.id, role: a.role, status: a.status, notes: a.notes,
      assignedTo: a.assigned_to, assignedToName: a.assigned_to_name,
      assignedBy: a.assigned_by, assignedByName: a.assigned_by_name,
      createdAt: a.created_at,
    })),
  };
};

export const trackTicket = async (trackNumber) => {
  const ticket = await ticketRepo.findByTrackNumber(trackNumber);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
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
  };
};

// Auto-route a "direct" category ticket straight to the owning department manager
// (bypasses the admin queue — the category itself designates the destination department).
const routeTicketToDepartment = async (ticketId, departmentId, ticket, meta = {}) => {
  const notes = 'Automatically routed to your department';
  await ticketRepo.update(ticketId, { department_id: departmentId, status: 'assigned', assigned_to: null });
  await logStatus(ticketId, 'open', 'assigned', { id: null, role: 'system' }, notes, meta);
  await ticketRepo.createAssignment({
    ticketId, assignedBy: null, assignedTo: null, role: 'department_manager',
    notes, priority: ticket.priority, category: ticket.category,
  });
  const updated = await getTicket({ id: null, role: 'admin' }, ticketId);
  await notificationService.notifyTicketAssignedToDepartment(updated, departmentId);
  auditService.logAction(null, 'auto_route_direct', 'ticket', ticketId, meta?.ip, { departmentId, routingType: 'direct' }, { role: 'system', browser: meta?.browser }).catch(() => {});
  return updated;
};

export const createTicket = async (user, payload, files = [], meta = {}) => {
  if (user.role !== 'tenant') {
    throw Object.assign(new Error('Only tenants can create tickets'), { statusCode: 403 });
  }
  if (!user.tenant_id) {
    throw Object.assign(new Error('Tenant account required'), { statusCode: 400 });
  }

  // Auto-detect department from category
  const catInfo = await ticketRepo.getDepartmentForCategory(payload.category).catch(() => ({ department_id: null, sla_policy_id: null, routing_type: 'general' }));
  const departmentId = catInfo.department_id || payload.departmentId || null;
  const routingType = catInfo.routing_type || 'general';
  const categoryRecord = await categoryRepo.findByName(payload.category).catch(() => null);
  const categoryId = categoryRecord?.id || null;

  const id = uuidv4();
  const referenceNumber = await ticketRepo.generateReferenceNumber();
  const trackNumber = ticketRepo.generateTrackNumber();
  const priority = payload.priority || 'medium';
  const effectivePolicy = await slaService.resolveEffectivePolicy(categoryId, priority, catInfo.sla_policy_id);
  const dueDates = slaService.computeAllDueDates(
    effectivePolicy || {
      priority,
      response_hours: 4,
      resolution_hours: 24,
      escalation_hours: 0,
      working_hours: null,
    },
    new Date()
  );
  const dueDate = dueDates.resolutionDueDate;
  const slaPolicyId = effectivePolicy?.id || catInfo.sla_policy_id || null;

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
    category: payload.category,
    status: 'open',
    dueDate,
    responseDueDate: dueDates.responseDueDate,
    escalationDueDate: dueDates.escalationDueDate,
    slaPolicyId,
    autoDepartmentId: departmentId,
    routingType,
    slaAgreementAccepted: true,
    slaAgreementAcceptedAt: new Date(),
  });

  for (const file of files) {
    await ticketRepo.addAttachment({
      id: uuidv4(), ticketId: id, fileName: file.originalname,
      originalName: file.originalname, fileSize: file.size || 0,
      filePath: `/uploads/tickets/${file.filename}`, mimeType: file.mimetype, uploadedBy: user.id,
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
    }).catch(() => {});
  }

  auditService.logAction(user.id, 'create', 'ticket', id, meta?.ip, { referenceNumber: created.referenceNumber, routingType }, { role: user.role, browser: meta?.browser }).catch(() => {});

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

  const isTenant = user.role === 'tenant';
  const isClosed = ['closed', 'rejected', 'cancelled'].includes(ticket.status);
  if (isClosed && isTenant) {
    throw Object.assign(new Error('Cannot update closed or rejected ticket'), { statusCode: 400 });
  }

  const updateFields = {};
  if (!isTenant) {
    if (payload.departmentId !== undefined) updateFields.department_id = payload.departmentId;
    if (payload.assignedTo !== undefined) updateFields.assigned_to = payload.assignedTo;
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
  auditService.logAction(user.id, 'update', 'ticket', id, meta?.ip, { referenceNumber: updated.referenceNumber }, { role: user.role, oldValue: old, newValue: sanitizeTicket(ticket), browser: meta?.browser }).catch(() => {});
  return updated;
};

export const changeStatus = async (user, id, { status, notes }, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  // If Admin / Staff / Manager selects 'resolved', route to 'waiting_tenant' so tenant can confirm/approve
  let targetStatus = status;
  if (status === 'resolved' && user.role !== 'tenant') {
    targetStatus = 'waiting_tenant';
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
    sendTicketCompletedEmail(updated).catch(() => {});
  }
  if (targetStatus === 'reopened') {
    await notificationService.notifyTicketReopened(updated, user.id, notes);
    sendTicketReopenedEmail(updated).catch(() => {});
  }
  if (targetStatus === 'closed') {
    await notificationService.notifyTicketClosed(updated);
  }

  auditService.logAction(user.id, 'status_change', 'ticket', id, meta?.ip, { from: ticket.status, to: targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
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

// ── Admin: assign department manager ──
export const assignDepartment = async (user, id, departmentId, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  // Direct-route tickets are already routed to their owning department at creation,
  // so the admin must not (re)assign a department here. They are notified instead.
  if (ticket.routing_type === 'direct') {
    throw Object.assign(new Error('Direct-route tickets are already routed to a department and cannot be assigned by admin'), { statusCode: 400 });
  }

  await ticketRepo.update(id, { department_id: departmentId });
  await logStatus(id, ticket.status, 'assigned', user, notes || 'Assigned to department', meta);
  await ticketRepo.createAssignment({ ticketId: id, assignedBy: user.id, assignedTo: null, role: 'department_manager', notes, priority: ticket.priority, category: ticket.category });

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketAssignedToDepartment(updated, departmentId);
  auditService.logAction(user.id, 'assign_department', 'ticket', id, meta?.ip, { departmentId, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

// ── Manager: assign / reassign staff ──
export const assignStaff = async (user, id, staffId, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const active = await ticketRepo.findActiveAssignment(id, 'staff');
  if (active) {
    await ticketRepo.reassignAssignment(active.id);
  }

  await ticketRepo.update(id, { assigned_to: staffId, status: 'assigned' });
  await logStatus(id, ticket.status, 'assigned', user, notes || 'Assigned to staff', meta);
  await ticketRepo.createAssignment({ ticketId: id, assignedBy: user.id, assignedTo: staffId, role: 'staff', notes, priority: ticket.priority, category: ticket.category, fromAssignmentId: active?.id || null });

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketAssigned(updated, staffId, user.id);
  auditService.logAction(user.id, 'assign_staff', 'ticket', id, meta?.ip, { staffId, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

// ── Accept / reject an assignment ──
export const acceptAssignment = async (user, id, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const role = user.role === 'manager' ? 'department_manager' : 'staff';
  const active = await ticketRepo.findActiveAssignment(id, role);
  if (!active) throw Object.assign(new Error('No pending assignment to accept'), { statusCode: 400 });

  await ticketRepo.acceptAssignment(active.id);
  if (ticket.status === 'assigned') {
    await ticketRepo.update(id, { status: 'in_progress' });
    await logStatus(id, 'assigned', 'in_progress', user, 'Assignment accepted', meta);
  }
  const updated = await getTicket(user, id);
  await notificationService.notifyTicketAccepted(updated, user.id);
  sendTicketAcceptedEmail(updated, user.id).catch(() => {});
  auditService.logAction(user.id, 'accept_assignment', 'ticket', id, meta?.ip, { role }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const rejectAssignment = async (user, id, reason, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const role = user.role === 'manager' ? 'department_manager' : 'staff';
  const active = await ticketRepo.findActiveAssignment(id, role);
  if (!active) throw Object.assign(new Error('No pending assignment to reject'), { statusCode: 400 });

  await ticketRepo.rejectAssignment(active.id);
  const backStatus = 'open';
  await ticketRepo.update(id, { status: backStatus });
  await logStatus(id, ticket.status, backStatus, user, reason || 'Assignment rejected', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketRejected(updated, user.id, reason);
  sendTicketRejectedEmail(updated, user.id, reason).catch(() => {});
  auditService.logAction(user.id, 'reject_assignment', 'ticket', id, meta?.ip, { role, reason }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const reassignStaff = async (user, id, staffId, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  return assignStaff(user, id, staffId, notes, meta);
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
    auditService.logAction(user.id, 'override_attribution', 'ticket', id, meta?.ip, { assignedBy: attributionUser, notes, assignmentId: active.id }, { role: user.role, browser: meta?.browser }).catch(() => {});
    return updated;
  }

  // Reassign current assignee (optionally with a custom attribution user)
  const newAssignedTo = assignedTo || null;
  if (newAssignedTo) {
    const target = await userRepository.findById(newAssignedTo);
    if (!target) throw Object.assign(new Error('Assignee user not found'), { statusCode: 404 });
    if (ticket.department_id && !target.departments.some((d) => d.id === ticket.department_id)) {
      throw Object.assign(new Error('Assignee does not belong to the ticket department'), { statusCode: 400 });
    }
  }

  const prev = await ticketRepo.findActiveAssignment(id, 'staff');
  if (prev) {
    await ticketRepo.reassignAssignment(prev.id);
  }

  await ticketRepo.update(id, { assigned_to: newAssignedTo, status: newAssignedTo ? 'assigned' : ticket.status });
  await ticketRepo.createAssignment({
    ticketId: id, assignedBy: attributionUser, assignedTo: newAssignedTo, role: 'staff', notes,
    priority: ticket.priority, category: ticket.category, fromAssignmentId: prev?.id || null,
  });

  const toStatus = newAssignedTo ? 'assigned' : ticket.status;
  await logStatus(id, ticket.status, toStatus, user, notes || `Assignment overridden by admin`, meta);

  const updated = await getTicket(user, id);
  if (newAssignedTo) {
    await notificationService.notifyTicketAssigned(updated, newAssignedTo, attributionUser);
  }
  auditService.logAction(user.id, 'override_assignment', 'ticket', id, meta?.ip, { assignedTo: newAssignedTo, assignedBy: attributionUser, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const escalateTicket = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  await ticketRepo.update(id, { status: 'escalated', is_escalated: true, escalated_at: new Date() });
  await logStatus(id, ticket.status, 'escalated', user, notes || 'Ticket escalated', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketEscalated(updated, user.id, notes);
  sendTicketEscalatedEmail(updated, notes).catch(() => {});
  auditService.logAction(user.id, 'escalate', 'ticket', id, meta?.ip, { notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const mergeTickets = async (user, targetId, sourceIds, notes, meta = {}) => {
  const target = await ticketRepo.findById(targetId);
  if (!target) throw Object.assign(new Error('Target ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, target))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const valid = sourceIds.filter((sid) => sid !== targetId);
  if (!valid.length) throw Object.assign(new Error('No valid source tickets'), { statusCode: 400 });

  await ticketRepo.mergeInto(valid, targetId);
  for (const sid of valid) {
    await logStatus(sid, 'merged', 'cancelled', user, `Merged into ${target.reference_number}`, meta);
  }

  const updated = await getTicket(user, targetId);
  await notificationService.notifyTicketMerged(updated, valid.length, notes);
  sendTicketMergedEmail(updated, valid.length).catch(() => {});
  auditService.logAction(user.id, 'merge', 'ticket', targetId, meta?.ip, { sourceIds: valid, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const closeTicket = async (user, id, notes, meta = {}) => {
  return changeStatus(user, id, { status: 'closed', notes }, meta);
};

export const reopenTicket = async (user, id, notes, meta = {}) => {
  return changeStatus(user, id, { status: 'reopened', notes }, meta);
};

export const approveResolution = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  if (!['waiting_tenant', 'resolved', 'pending_approval', 'completed', 'escalated'].includes(ticket.status)) {
    throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be approved'), { statusCode: 400 });
  }

  const now = new Date();
  const updateFields = {
    status: 'completed',
    closed_at: now,
    completed_at: now,
    tenant_confirmation_status: 'approved',
    approved_by: user.id,
    approved_at: now,
  };
  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, 'completed', user, notes || 'Tenant approved resolution as fixed', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketStatusChanged(updated, 'completed', user.id);
  sendTicketCompletedEmail(updated).catch(() => {});
  auditService.logAction(user.id, 'approve_resolution', 'ticket', id, meta?.ip, { notes, newStatus: 'completed' }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const rejectResolution = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  if (!['waiting_tenant', 'resolved', 'pending_approval', 'escalated'].includes(ticket.status)) {
    throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be rejected'), { statusCode: 400 });
  }

  const now = new Date();
  const updateFields = {
    status: 'in_progress',
    tenant_confirmation_status: 'rejected',
    reopened_by: user.id,
    reopened_at: now,
    reopen_reason: notes || null,
  };
  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, 'in_progress', user, notes || 'Tenant rejected resolution (issue not fixed)', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketReopened(updated, user.id, notes);
  sendTicketReopenedEmail(updated).catch(() => {});
  auditService.logAction(user.id, 'reject_resolution', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const markResolved = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const now = new Date();
  let slaAchieved = false;
  const dueDate = ticket.due_date ? new Date(ticket.due_date) : null;
  if (dueDate && now <= dueDate) {
    slaAchieved = true;
  }

  // Route to waiting_tenant so tenant can approve resolution
  const targetStatus = 'waiting_tenant';
  const updateFields = { status: targetStatus, resolved_at: now };
  if (ticket.due_date) updateFields.is_overdue = slaAchieved ? 0 : 1;
  updateFields.sla_achieved = slaAchieved ? 1 : 0;
  updateFields.tenant_confirmation_status = 'pending';

  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, targetStatus, user, notes || 'Marked resolved (waiting for tenant approval)', meta);

  const updated = await getTicket(user, id);
  const resolutionMinutes = dueDate
    ? Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 60000)
    : null;

  await notificationService.notifyTicketResolved(updated);
  auditService.logAction(user.id, 'resolve', 'ticket', id, meta?.ip, { targetStatus, slaAchieved, resolutionMinutes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const changePriority = async (user, id, priority, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
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
  auditService.logAction(user.id, 'change_priority', 'ticket', id, meta?.ip, { from: old, to: priority }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const changeCategory = async (user, id, category, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const old = ticket.category;
  const catInfo = await ticketRepo.getDepartmentForCategory(category).catch(() => ({ department_id: null, sla_policy_id: null, routing_type: 'general' }));
  const updateFields = { category };
  if (catInfo.department_id) updateFields.department_id = catInfo.department_id;
  updateFields.routing_type = catInfo.routing_type || 'general';

  const categoryRecord = await categoryRepo.findByName(category).catch(() => null);
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
  auditService.logAction(user.id, 'change_category', 'ticket', id, meta?.ip, { from: old, to: category }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const addInternalNote = async (user, id, message, attachmentId = null, departmentId = null, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  if (!['admin', 'manager', 'staff'].includes(user.role)) {
    throw Object.assign(new Error('Only staff can add internal notes'), { statusCode: 403 });
  }

  const replyId = uuidv4();
  await ticketRepo.addReply({ id: replyId, ticketId: id, userId: user.id, message, visibility: 'internal', attachmentId, type: 'note', isInternal: 1, departmentIds: departmentId });
  const saved = await ticketRepo.findById(id);
  await notificationService.notifyInternalNote(saved, user.id, departmentId);
  auditService.logAction(user.id, 'internal_note', 'ticket', id, meta?.ip, { message, departmentId }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return getTicket(user, id);
};

export const addAttachments = async (user, id, files = [], meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  // Enforce max 5 attachments
  if ((ticket.attachments?.length || 0) + files.length > 5) {
    throw Object.assign(new Error('Maximum 5 attachments allowed'), { statusCode: 400 });
  }
  for (const file of files) {
    await ticketRepo.addAttachment({
      id: uuidv4(), ticketId: id, fileName: file.originalname,
      originalName: file.originalname, fileSize: file.size || 0,
      filePath: `/uploads/tickets/${file.filename}`, mimeType: file.mimetype, uploadedBy: user.id,
    });
  }
  await logStatus(id, ticket.status, ticket.status, user, `Uploaded ${files.length} file(s)`, meta);
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

export const isReplyVisible = (user, reply, userDeptIds = []) => {
  const visibility = reply.visibility;
  const isInternal = visibility === 'internal' || reply.isInternal === 1 || reply.isInternal === true;
  const deptIds = splitCsv(reply.departmentIds || reply.department_ids);
  const authorDepts = splitCsv(reply.authorDepartmentIds || reply.author_department_ids);

  if (user.role === 'admin') return true;

  if (user.role === 'tenant') {
    if (visibility === 'department') return false;
    if (isInternal) return false;
    return true;
  }

  // staff / manager / ceo
  if (visibility === 'tenant') return false;
  if (visibility === 'all') return true;

  // internal | department | both => department restricted
  if (deptIds.length === 0) {
    if (visibility === 'internal') {
      return authorDepts.length === 0 ? false : authorDepts.some((d) => userDeptIds.includes(d));
    }
    return false;
  }
  return deptIds.some((d) => userDeptIds.includes(d));
};

export const addReply = async (user, ticketId, message, visibility = 'all', attachmentId = null, meta = {}, departmentIds = null) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const replyId = uuidv4();
  const isInternal = (visibility === 'internal' || visibility === 'department') ? 1 : 0;
  await ticketRepo.addReply({
    id: replyId, ticketId, userId: user.id, message, visibility, attachmentId,
    type: 'reply', isInternal, departmentIds: departmentIds || null,
  });

  // Track response SLA satisfaction when staff/manager/admin responds to user
  if (!isInternal && ['admin', 'manager', 'staff'].includes(user.role)) {
    if (ticket.response_due_date && (ticket.response_sla_breached === null || ticket.response_sla_breached === 0)) {
      const now = new Date();
      const breached = now > new Date(ticket.response_due_date) ? 1 : 0;
      await ticketRepo.update(ticketId, {
        response_sla_breached: breached,
      }).catch(() => {});
    }
  }

  const savedTicket = await ticketRepo.findById(ticketId);
  await notificationService.notifyTicketReply(savedTicket, user.id, isInternal === 1);

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

  const userDeptIds = (user.role === 'tenant' || user.role === 'admin')
    ? []
    : await ticketRepo.getUserDepartmentIds(user.id);

  const visible = replies.filter((r) => isReplyVisible(user, r, userDeptIds));

  return visible.map((r) => ({
    id: r.id, ticketId: r.ticket_id, userId: r.user_id, userName: r.user_name,
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

  const userDeptIds = (user.role === 'tenant' || user.role === 'admin')
    ? []
    : await ticketRepo.getUserDepartmentIds(user.id);

  const filtered = events.filter((e) => e.kind !== 'comment' || isReplyVisible(user, e, userDeptIds));

  return filtered.map((e) => ({
    id: e.id, kind: e.kind, type: e.type, message: e.message, notes: e.notes,
    fromStatus: e.from_status, toStatus: e.to_status, visibility: e.visibility,
    role: e.role, actorName: e.actor_name, createdAt: e.created_at,
    departmentIds: e.department_ids, authorDepartmentIds: e.author_department_ids,
  }));
};

export const getUserNotifications = (userId, options = {}) => notificationService.getUserNotifications(userId, options);
export const getUserUnreadCount = (userId) => notificationService.getUserUnreadCount(userId);
export const markNotificationAsRead = (id, userId) => notificationService.markNotificationAsRead(id, userId);
export const markAllNotificationsAsRead = (userId) => notificationService.markAllNotificationsRead(userId);
export const deleteNotification = (id, userId) => notificationService.deleteNotification(id, userId);

// Backward-compatible aliases (new behavior preserved)
export { approveResolution as approveCompletion };
export { rejectResolution as rejectCompletion };
export { markResolved as markCompleted };
