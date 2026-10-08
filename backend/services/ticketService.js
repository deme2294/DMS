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
import * as feedbackRepo from '../repository/feedbackRepository.js';
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
  auditService.logAction(null, 'auto_route_direct', 'ticket', ticketId, meta?.ip, { departmentId, managerId, routingType: 'direct' }, { role: 'system', browser: meta?.browser }).catch(() => {});
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
  auditService.logAction(user.id, 'update', 'ticket', id, meta?.ip, { referenceNumber: updated.referenceNumber }, { role: user.role, oldValue: old, newValue: sanitizeTicket(ticket), browser: meta?.browser }).catch(() => {});
  return updated;
};

export const changeStatus = async (user, id, { status, notes }, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
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

// ── Admin: assign department manager (considering BOTH department and role) ──
export const assignDepartment = async (user, id, departmentId, notes, managerId = null, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  // Direct-route tickets are already routed to their owning department at creation,
  // so the admin must not (re)assign a department here. They are notified instead.
  if (ticket.routing_type === 'direct') {
    throw Object.assign(new Error('Direct-route tickets are already routed to a department and cannot be assigned by admin'), { statusCode: 400 });
  }

  // Resolve manager considering BOTH department and role
  let targetManagerId = null;
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

  // Close previous active assignments if reassigned
  const activeDept = await ticketRepo.findActiveAssignment(id, 'department_manager');
  if (activeDept) {
    await ticketRepo.reassignAssignment(activeDept.id);
  }
  const activeStaff = await ticketRepo.findActiveAssignment(id, 'staff');
  if (activeStaff) {
    await ticketRepo.reassignAssignment(activeStaff.id);
  }

  await ticketRepo.update(id, {
    department_id: departmentId,
    assigned_to: targetManagerId,
    status: 'assigned',
  });
  await logStatus(id, ticket.status, 'assigned', user, notes || 'Assigned to department manager', meta);
  await ticketRepo.createAssignment({
    ticketId: id,
    assignedBy: user.id,
    assignedTo: targetManagerId,
    role: 'department_manager',
    notes,
    priority: ticket.priority,
    category: ticket.category,
    fromAssignmentId: activeDept?.id || null,
    status: 'accepted',
    acceptedAt: new Date(),
  });

  const updated = await getTicket(user, id);
  await notificationService.notifyTicketAssignedToDepartment(updated, departmentId);
  if (targetManagerId) {
    await notificationService.notifyTicketAssigned(updated, targetManagerId, user.id);
  }
  auditService.logAction(user.id, 'assign_department', 'ticket', id, meta?.ip, { departmentId, managerId: targetManagerId, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

// ── Manager: assign / reassign staff (validating BOTH department and role) ──
export const assignStaff = async (user, id, staffId, notes, meta = {}) => {
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

  const active = await ticketRepo.findActiveAssignment(id, 'staff');
  if (active) {
    await ticketRepo.reassignAssignment(active.id);
  }

  // Automatically accept the assigned staff member in their department
  await ticketRepo.update(id, { assigned_to: staffId, status: 'in_progress' });
  await logStatus(id, ticket.status, 'in_progress', user, notes || `Assigned to ${staff.first_name || 'staff'} ${staff.last_name || ''} and accepted by department manager`, meta);
  await ticketRepo.createAssignment({
    ticketId: id,
    assignedBy: user.id,
    assignedTo: staffId,
    role: 'staff',
    notes,
    priority: ticket.priority,
    category: ticket.category,
    fromAssignmentId: active?.id || null,
    status: 'accepted',
    acceptedAt: new Date(),
  });

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
  if (!active.assigned_to) {
    await ticketRepo.updateAssignment(active.id, { assigned_to: user.id });
  }

  const updateFields = {};
  if (ticket.status === 'assigned') {
    updateFields.status = 'in_progress';
  }
  if (!ticket.assigned_to && user.role === 'manager') {
    updateFields.assigned_to = user.id;
  }
  if (Object.keys(updateFields).length > 0) {
    await ticketRepo.update(id, updateFields);
    if (updateFields.status) {
      await logStatus(id, 'assigned', 'in_progress', user, 'Assignment accepted', meta);
    }
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

export const getMergeCandidates = async (user, targetId, search) => {
  const target = (await ticketRepo.findById(targetId)) || (await ticketRepo.findByIdOrRef(targetId));
  if (!target) throw Object.assign(new Error('Target ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, target))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const rows = await ticketRepo.findMergeCandidates(target.id, target.tenant_id, search);
  return rows.map(sanitizeTicket);
};

export const mergeTickets = async (user, targetId, sourceIds, notes, meta = {}) => {
  const target = (await ticketRepo.findById(targetId)) || (await ticketRepo.findByIdOrRef(targetId));
  if (!target) throw Object.assign(new Error('Target ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, target))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

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
    if (src && src.id !== target.id && !seenIds.has(src.id)) {
      seenIds.add(src.id);
      resolvedSources.push(src);
    }
  }

  if (!resolvedSources.length) {
    throw Object.assign(new Error('No valid source tickets to merge. Please select or provide active tickets.'), { statusCode: 400 });
  }

  const validIds = resolvedSources.map((s) => s.id);
  const sourceRefs = resolvedSources.map((s) => s.reference_number || s.id);

  await ticketRepo.mergeInto(validIds, target.id);

  for (const src of resolvedSources) {
    const srcRef = src.reference_number || src.id;
    const targetRef = target.reference_number || target.id;
    await logStatus(
      src.id,
      src.status,
      'cancelled',
      user,
      `Merged into ${targetRef}.${notes ? ` Reason: ${notes}` : ''}`,
      meta
    );
  }

  // Record an internal timeline event on the target ticket documenting what was merged
  await logStatus(
    target.id,
    target.status,
    target.status,
    user,
    `Merged ticket(s) ${sourceRefs.join(', ')} into this ticket.${notes ? ` Note: ${notes}` : ''}`,
    meta
  );

  // Add an internal reply note on target ticket so staff and manager see the merged history
  await ticketRepo.addReply({
    id: uuidv4(),
    ticketId: target.id,
    userId: user.id,
    message: `📎 Ticket Merged: The following ticket(s) were merged into this ticket by ${user.first_name || ''} ${user.last_name || ''}: ${sourceRefs.join(', ')}.${notes ? `\nReason / Notes: ${notes}` : ''}`,
    visibility: 'internal',
    attachmentId: null,
    type: 'note',
    isInternal: 1,
    departmentIds: target.department_id || null,
  }).catch(() => {});

  const updated = await getTicket(user, target.id);
  await notificationService.notifyTicketMerged(updated, validIds.length, notes);
  sendTicketMergedEmail(updated, validIds.length).catch(() => {});
  auditService.logAction(
    user.id,
    'merge',
    'ticket',
    target.id,
    meta?.ip,
    { sourceIds: validIds, sourceRefs, notes },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  return updated;
};

export const closeTicket = async (user, id, notes, meta = {}) => {
  return changeStatus(user, id, { status: 'closed', notes }, meta);
};

export const reopenTicket = async (user, id, notes, meta = {}) => {
  return changeStatus(user, id, { status: 'reopened', notes }, meta);
};

export const approveResolution = async (user, id, notes, meta = {}, feedbackData = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

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
    auditService.logAction(user.id, 'manager_approve_resolution', 'ticket', id, meta?.ip, { notes, targetStatus }, { role: user.role, browser: meta?.browser }).catch(() => {});
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

      await ticketRepo.update(id, updateFields);
      await logStatus(id, ticket.status, targetStatus, user, notes || 'Admin verified and approved resolution; routed to tenant for confirmation', meta);

      const updated = await getTicket(user, id);
      await notificationService.notifyAdminVerifiedResolution(updated, user.id, notes);
      auditService.logAction(user.id, 'admin_verify_resolution', 'ticket', id, meta?.ip, { targetStatus, slaAchieved }, { role: user.role, browser: meta?.browser }).catch(() => {});
      return updated;
    }
  }

  // Tier 4: Tenant confirms resolution as solved (waiting_tenant or resolved -> completed)
  if (user.role === 'tenant' || user.role === 'admin' || user.role === 'ceo') {
    if (!['waiting_tenant', 'resolved', 'pending_approval', 'completed', 'escalated'].includes(ticket.status)) {
      throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be confirmed as completed'), { statusCode: 400 });
    }

    const updateFields = {
      status: 'completed',
      closed_at: now,
      completed_at: now,
      tenant_confirmation_status: 'approved',
      approved_by: user.id,
      approved_at: now,
    };
    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, 'completed', user, notes || 'Tenant confirmed issue resolved (completed)', meta);

    // Save Tenant satisfaction feedback if rating or feedback text is provided
    const ratingVal = feedbackData?.rating ? Number(feedbackData.rating) : null;
    const feedbackText = feedbackData?.feedback || feedbackData?.message || notes;
    if (ratingVal || feedbackText) {
      await feedbackRepo.create({
        id: uuidv4(),
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
    sendTicketCompletedEmail(updated).catch(() => {});
    auditService.logAction(user.id, 'tenant_confirm_resolution', 'ticket', id, meta?.ip, { notes, rating: ratingVal, newStatus: 'completed' }, { role: user.role, browser: meta?.browser }).catch(() => {});
    return updated;
  }

  throw Object.assign(new Error('Unauthorized to approve resolution'), { statusCode: 403 });
};

export const rejectResolution = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

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
    auditService.logAction(user.id, 'manager_request_rework', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => {});
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
    auditService.logAction(user.id, 'admin_return_revision', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => {});
    return updated;
  }

  // Tier 4: Tenant rejects resolution (issue NOT solved) (waiting_tenant or resolved -> in_progress)
  if (!['waiting_tenant', 'resolved', 'pending_approval', 'escalated'].includes(ticket.status)) {
    throw Object.assign(new Error('Only resolved or waiting-for-tenant tickets can be rejected'), { statusCode: 400 });
  }

  const updateFields = {
    status: 'in_progress',
    tenant_confirmation_status: 'rejected',
    reopened_by: user.id,
    reopened_at: now,
    reopen_reason: notes || 'Tenant reported issue is not resolved',
  };
  await ticketRepo.update(id, updateFields);
  await logStatus(id, ticket.status, 'in_progress', user, notes || 'Tenant rejected resolution (issue not fixed)', meta);

  const updated = await getTicket(user, id);
  await notificationService.notifyReworkRequested(updated, user.id, notes || 'Tenant rejected resolution (issue not fixed)', 'all');
  sendTicketReopenedEmail(updated).catch(() => {});
  auditService.logAction(user.id, 'tenant_reject_resolution', 'ticket', id, meta?.ip, { notes, newStatus: 'in_progress' }, { role: user.role, browser: meta?.browser }).catch(() => {});
  return updated;
};

export const markResolved = async (user, id, notes, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
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
    auditService.logAction(user.id, 'staff_resolve_submitted', 'ticket', id, meta?.ip, { targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
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
    auditService.logAction(user.id, 'manager_resolve_approved', 'ticket', id, meta?.ip, { targetStatus, notes }, { role: user.role, browser: meta?.browser }).catch(() => {});
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

    await ticketRepo.update(id, updateFields);
    await logStatus(id, ticket.status, targetStatus, user, notes || 'Admin verified and marked resolved; awaiting tenant confirmation', meta);

    const updated = await getTicket(user, id);
    const resolutionMinutes = dueDate
      ? Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 60000)
      : null;

    await notificationService.notifyAdminVerifiedResolution(updated, user.id, notes);
    auditService.logAction(user.id, 'admin_verified_resolution', 'ticket', id, meta?.ip, { targetStatus, slaAchieved, resolutionMinutes }, { role: user.role, browser: meta?.browser }).catch(() => {});
    return updated;
  }

  throw Object.assign(new Error('Unauthorized to mark ticket resolved'), { statusCode: 403 });
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

export const addAttachments = async (user, id, files = [], comment = null, meta = {}) => {
  const ticket = await ticketRepo.findById(id);
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

  // Author of the reply can always see their own reply
  const isAuthor = (reply.userId && reply.userId === user.id) || (reply.user_id && reply.user_id === user.id);
  if (isAuthor) return true;

  // Admin and CEO can always see everything
  if (user.role === 'admin' || user.role === 'ceo') return true;

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
      // Direct category: routed to the department of the ticket category
      if (isInTicketDept) return true;
      if (isAssignedUser) return true;
      if (isInReplyDepts) return true;
      return false;
    } else {
      // General category: routed to Admin; visible to assigned user and department manager once assigned
      if (isAssignedUser) return true;
      if (isInTicketDept) return true;
      if (isInReplyDepts) return true;
      return false;
    }
  }

  // Staff / Manager / Admin author replies:
  if (visibility === 'all') return true;
  if (visibility === 'tenant') {
    // If a reply was marked tenant, assigned user and department managers can also view it
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

export const addReply = async (user, ticketId, message, visibility = 'all', attachmentId = null, meta = {}, departmentIds = null) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  let effectiveVisibility = visibility;
  let effectiveDeptIds = departmentIds;

  // When a comment or reply is created by a tenant:
  // - Direct ticket categories: routed to the department of the ticket category
  // - General ticket categories: routed to Admin (and visible to assigned user / manager if assigned)
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
      if (ticket.department_id) {
        effectiveVisibility = 'both';
        effectiveDeptIds = ticket.department_id;
      } else {
        effectiveVisibility = 'all';
        effectiveDeptIds = null;
      }
    }
  }

  const replyId = uuidv4();
  const isInternal = (effectiveVisibility === 'internal' || effectiveVisibility === 'department' || effectiveVisibility === 'admin') ? 1 : 0;
  await ticketRepo.addReply({
    id: replyId, ticketId, userId: user.id, message, visibility: effectiveVisibility, attachmentId,
    type: 'reply', isInternal, departmentIds: effectiveDeptIds || null,
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
  await notificationService.notifyTicketReply(savedTicket, user.id, isInternal === 1, effectiveVisibility);

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

  const visible = replies.filter((r) => isReplyVisible(user, r, userDeptIds, ticket));

  return visible.map((r) => ({
    id: r.id, ticketId: r.ticket_id, userId: r.user_id, userName: r.user_name,
    userRole: r.user_role,
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

