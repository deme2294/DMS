import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import * as operationalRepo from '../repository/operationalEscalationRepository.js';
import * as collaboratorRepo from '../repository/collaboratorRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import * as auditService from './auditService.js';
import * as notificationService from './notificationService.js';
import { broadcastTicketEvent } from './socketService.js';
import { canAccessTicket } from './ticketService.js';

export const requestOperationalEscalation = async (
  user,
  ticketId,
  { escalationReason, problemDescription, actionsAttempted, assistanceRequired, destination = 'manager' },
  meta = {}
) => {
  // 1. RBAC: Tenants cannot initiate internal operational escalation
  if (user.role === 'tenant') {
    throw Object.assign(new Error('Tenants are not permitted to initiate internal operational escalations'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) {
    throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  }

  // 2. Staff can only escalate tickets assigned to them
  if (user.role === 'staff' && ticket.assigned_to !== user.id) {
    throw Object.assign(new Error('Staff can only request operational escalation on tickets assigned to them'), { statusCode: 403 });
  }

  // 3. Department managers cannot initiate escalations to higher authority.
  // Managers review staff escalations and either assign collaborators to resolve internally or approve the escalation to Admin.
  if (user.role === 'manager') {
    throw Object.assign(
      new Error('Department managers cannot initiate direct escalations to higher authority. Managers review escalations submitted by department staff and either assign collaborators to resolve within their level or approve the escalation to Admin.'),
      { statusCode: 403 }
    );
  }

  // 4. Validate mandatory information
  if (!escalationReason || !escalationReason.trim()) {
    throw Object.assign(new Error('Escalation reason is required'), { statusCode: 400 });
  }
  if (!problemDescription || !problemDescription.trim()) {
    throw Object.assign(new Error('Description of unresolved problem is required'), { statusCode: 400 });
  }
  if (!actionsAttempted || !actionsAttempted.trim()) {
    throw Object.assign(new Error('Actions already attempted must be detailed'), { statusCode: 400 });
  }
  if (!assistanceRequired || !assistanceRequired.trim()) {
    throw Object.assign(new Error('Assistance or decision required must be specified'), { statusCode: 400 });
  }

  // Determine target destination: staff escalations route strictly to department manager; manager can request to admin
  const targetDestination = (user.role === 'staff') ? 'manager' : ((user.role === 'manager' || destination === 'admin') ? 'admin' : 'manager');
  const newOpStatus = targetDestination === 'admin' ? 'pending_admin' : 'pending_manager';

  // 5. Create operational escalation record
  const escalation = await operationalRepo.create({
    ticketId: ticket.id,
    requestingUserId: user.id,
    departmentId: ticket.department_id || null,
    escalationReason: escalationReason.trim(),
    problemDescription: problemDescription.trim(),
    actionsAttempted: actionsAttempted.trim(),
    assistanceRequired: assistanceRequired.trim(),
    destination: targetDestination,
    status: newOpStatus,
  });

  // 6. Update ticket's operational escalation columns and set escalated status
  await pool.query(
    `UPDATE tickets
     SET status = 'escalated',
         is_escalated = 1,
         escalated_at = COALESCE(escalated_at, NOW()),
         operational_escalation_status = :opStatus,
         operational_escalation_reason = :reason,
         updated_at = NOW()
     WHERE id = :id`,
    {
      id: ticket.id,
      opStatus: newOpStatus,
      reason: escalationReason.trim(),
    }
  );

  // 7. Log status history (internal audit note)
  await ticketRepo.logStatusHistory({
    id: uuidv4(),
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: ticket.status,
    changedBy: user.id,
    notes: `Operational Escalation requested by ${user.first_name || 'Staff'}: ${escalationReason.trim()}. Destination: ${targetDestination}.`,
    role: user.role,
  }).catch(() => {});

  // 8. Audit logging
  await auditService.logAction(
    user.id,
    'request_operational_escalation',
    'ticket',
    ticket.id,
    meta?.ip,
    {
      escalationId: escalation.id,
      reason: escalationReason,
      destination: targetDestination,
    },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  // 9. Dispatch notification
  await notificationService.notifyOperationalEscalationRequested(ticket, user, escalation).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', {
    ticketId: ticket.id,
    operationalEscalationStatus: newOpStatus,
  });

  return escalation;
};

export const reviewByManager = async (
  user,
  ticketId,
  escalationId,
  { decision, notes, newAssigneeId, collaboratorIds = [], role = 'collaborator' },
  meta = {}
) => {
  // 1. RBAC: Only manager or admin
  if (user.role !== 'manager' && user.role !== 'admin') {
    throw Object.assign(new Error('Only Department Managers or Admins can review operational escalations'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  // If manager, check department authority
  if (user.role === 'manager' && ticket.department_id) {
    const [userDept] = await pool.query(
      'SELECT 1 FROM user_departments WHERE user_id = :userId AND department_id = :deptId LIMIT 1',
      { userId: user.id, deptId: ticket.department_id }
    );
    if (!userDept.length) {
      throw Object.assign(new Error('You can only review escalations for your own department'), { statusCode: 403 });
    }
  }

  const escalation = await operationalRepo.findById(escalationId);
  if (!escalation || escalation.ticket_id !== ticket.id) {
    throw Object.assign(new Error('Operational escalation record not found'), { statusCode: 404 });
  }

  const validDecisions = ['guidance', 'reassign', 'collaborate', 'investigate', 'solve_in_person', 'escalate_to_admin'];
  if (!validDecisions.includes(decision)) {
    throw Object.assign(new Error(`Invalid manager decision. Must be one of: ${validDecisions.join(', ')}`), { statusCode: 400 });
  }

  let newOpStatus = 'guidance_provided';
  const updateFields = {
    manager_id: user.id,
    manager_decision: decision,
    manager_notes: notes || null,
    manager_decided_at: new Date(),
  };

  if (decision === 'escalate_to_admin') {
    updateFields.destination = 'admin';
    updateFields.status = 'pending_admin';
    newOpStatus = 'pending_admin';

    await operationalRepo.update(escalationId, updateFields);
    await pool.query(
      `UPDATE tickets
       SET status = 'escalated',
           is_escalated = 1,
           escalated_at = COALESCE(escalated_at, NOW()),
           operational_escalation_status = 'pending_admin',
           operational_escalation_reason = :reason,
           updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id, reason: notes || ticket.operational_escalation_reason || 'Department Manager approved escalation to Admin' }
    );
    await notificationService.notifyOperationalEscalationToAdmin(ticket, user, escalation).catch(() => {});
  } else if (decision === 'solve_in_person') {
    updateFields.status = 'in_person_resolution';
    newOpStatus = 'in_person_resolution';
    await operationalRepo.update(escalationId, updateFields);

    // Department manager takes personal assignment and ownership to solve in person
    await pool.query(
      `UPDATE tickets
       SET assigned_to = :managerId,
           current_assigned_user_id = :managerId,
           status = 'in_progress',
           updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id, managerId: user.id }
    );

    await ticketRepo.createAssignment({
      ticketId: ticket.id,
      assignedBy: user.id,
      assignedTo: user.id,
      role: 'manager',
      notes: notes || 'Department Manager took personal ownership to solve in person',
      priority: ticket.priority,
      category: ticket.category,
    });
  } else if (decision === 'reassign') {
    if (!newAssigneeId) {
      throw Object.assign(new Error('New assignee ID is required for reassignment'), { statusCode: 400 });
    }
    updateFields.status = 'reassigned';
    newOpStatus = 'reassigned';

    await operationalRepo.update(escalationId, updateFields);

    // Reassign ticket to the new staff member
    await pool.query(
      `UPDATE tickets
       SET assigned_to = :newAssigneeId,
           current_assigned_user_id = :newAssigneeId,
           status = 'assigned',
           updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id, newAssigneeId }
    );

    await ticketRepo.createAssignment({
      ticketId: ticket.id,
      assignedBy: user.id,
      assignedTo: newAssigneeId,
      role: 'staff',
      notes: notes || 'Reassigned following operational escalation review',
      priority: ticket.priority,
      category: ticket.category,
    });
  } else if (decision === 'collaborate') {
    updateFields.status = 'collaborative';
    newOpStatus = 'collaborative';
    await operationalRepo.update(escalationId, updateFields);

    // If ticket was in escalated state, resume in_progress now that other staff are collaborating
    if (ticket.status === 'escalated') {
      await pool.query(
        `UPDATE tickets
         SET status = 'in_progress',
             updated_at = NOW()
         WHERE id = :id`,
        { id: ticket.id }
      );
    }

    // Add collaborators if provided
    for (const cUserId of (collaboratorIds || [])) {
      if (cUserId && cUserId !== ticket.assigned_to) {
        await collaboratorRepo.add({
          ticketId: ticket.id,
          userId: cUserId,
          assignedBy: user.id,
          role: 'collaborator',
          notes: notes || 'Department Manager added collaborator to solve ticket',
        });
        await notificationService.notifyCollaboratorAdded(ticket, cUserId, user, 'collaborator', notes).catch(() => {});
      }
    }
  } else {
    // guidance or investigate: ticket stays at department level under in_progress
    updateFields.status = 'guidance_provided';
    newOpStatus = 'guidance_provided';
    await operationalRepo.update(escalationId, updateFields);

    if (ticket.status === 'escalated') {
      await pool.query(
        `UPDATE tickets
         SET status = 'in_progress',
             updated_at = NOW()
         WHERE id = :id`,
        { id: ticket.id }
      );
    }
  }

  // Update tickets operational_escalation_status
  await pool.query(
    `UPDATE tickets
     SET operational_escalation_status = :opStatus,
         updated_at = NOW()
     WHERE id = :id`,
    { id: ticket.id, opStatus: newOpStatus }
  );

  // Status history note
  const toStatus = decision === 'solve_in_person' ? 'in_progress'
    : (decision === 'reassign' ? 'assigned'
    : (decision === 'collaborate' && ticket.status === 'escalated' ? 'in_progress'
    : (decision === 'escalate_to_admin' ? 'escalated' : ticket.status)));

  await ticketRepo.logStatusHistory({
    id: uuidv4(),
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus,
    changedBy: user.id,
    notes: `Department Manager review: ${decision}. Notes: ${notes || 'None provided'}`,
    role: user.role,
  }).catch(() => {});

  // Audit
  await auditService.logAction(
    user.id,
    'review_operational_escalation_manager',
    'ticket',
    ticket.id,
    meta?.ip,
    { escalationId, decision, notes },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  await notificationService.notifyOperationalEscalationReviewed(ticket, user, decision, notes).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', {
    ticketId: ticket.id,
    operationalEscalationStatus: newOpStatus,
  });

  return operationalRepo.findById(escalationId);
};

export const reviewByAdmin = async (
  user,
  ticketId,
  escalationId,
  { decision, notes, newAssigneeId, departmentId, finalIdea, tenantDecisionNote },
  meta = {}
) => {
  // 1. RBAC: Admin / CEO
  if (user.role !== 'admin' && user.role !== 'ceo') {
    throw Object.assign(new Error('Only Admins or Executive can issue administrative decisions on operational escalations'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  const escalation = await operationalRepo.findById(escalationId);
  if (!escalation || escalation.ticket_id !== ticket.id) {
    throw Object.assign(new Error('Operational escalation record not found'), { statusCode: 404 });
  }

  // 2. Workflow separation: Admin only reviews escalations approved by the Department Manager
  if (escalation.status !== 'pending_admin' && escalation.destination !== 'admin') {
    throw Object.assign(new Error('Admin can only review operational escalations that have been approved by the Department Manager'), { statusCode: 400 });
  }

  const validDecisions = ['approved', 'guidance', 'reassign', 'resource_allocated', 'reforward_to_manager', 'rejected'];
  if (!validDecisions.includes(decision)) {
    throw Object.assign(new Error(`Invalid admin decision. Must be one of: ${validDecisions.join(', ')}`), { statusCode: 400 });
  }

  const adminDirectiveNotes = finalIdea || notes || '';
  const formattedAdminNotes = [
    adminDirectiveNotes ? `[Final Idea & Directives for Department Manager]: ${adminDirectiveNotes}` : '',
    tenantDecisionNote ? `[Final Decision for Tenant]: ${tenantDecisionNote}` : ''
  ].filter(Boolean).join('\n\n') || notes || null;

  const updateFields = {
    admin_id: user.id,
    admin_decision: decision,
    admin_notes: formattedAdminNotes,
    admin_decided_at: new Date(),
    status: 'resolved',
  };

  await operationalRepo.update(escalationId, updateFields);

  // Post public update for Tenant if a tenant decision note was provided
  if (tenantDecisionNote && tenantDecisionNote.trim()) {
    await pool.query(
      `INSERT INTO ticket_replies (id, ticket_id, user_id, message, visibility, created_at, updated_at)
       VALUES (:replyId, :ticketId, :userId, :message, 'public', NOW(), NOW())`,
      {
        replyId: uuidv4(),
        ticketId: ticket.id,
        userId: user.id,
        message: `🏛️ **Official Administration Final Decision & Directives**:\n\n${tenantDecisionNote.trim()}${adminDirectiveNotes ? `\n\n*Directives and action plan have been re-forwarded to the Department Manager for immediate execution.*` : ''}`,
      }
    ).catch(() => {});
  }

  // If Admin changes department or reassigns staff
  if (departmentId || newAssigneeId) {
    if (departmentId) {
      const activeDept = await ticketRepo.findActiveAssignment(ticket.id, 'department_manager');
      if (activeDept) await ticketRepo.reassignAssignment(activeDept.id);
      await ticketRepo.createAssignment({
        ticketId: ticket.id,
        departmentId,
        assignedBy: user.id,
        assignedTo: null,
        role: 'department_manager',
        notes: notes || 'Reassigned by Admin following operational escalation',
        priority: ticket.priority,
        category: ticket.category,
        fromAssignmentId: activeDept?.id || null,
        status: 'accepted',
        acceptedAt: new Date(),
      });
    }
    if (newAssigneeId) {
      const activeStaff = await ticketRepo.findActiveAssignment(ticket.id, 'staff');
      if (activeStaff) await ticketRepo.reassignAssignment(activeStaff.id);
      await ticketRepo.createAssignment({
        ticketId: ticket.id,
        departmentId: departmentId || ticket.department_id,
        assignedBy: user.id,
        assignedTo: newAssigneeId,
        role: 'staff',
        notes: notes || 'Staff reassigned by Admin following operational escalation',
        priority: ticket.priority,
        category: ticket.category,
        fromAssignmentId: activeStaff?.id || null,
        status: 'accepted',
        acceptedAt: new Date(),
      });
    }
    await pool.query(
      `UPDATE tickets
       SET ${departmentId ? 'department_id = :departmentId, current_department_id = :departmentId,' : ''}
           ${newAssigneeId ? 'assigned_to = :newAssigneeId, current_assigned_user_id = :newAssigneeId,' : ''}
           operational_escalation_status = 'resolved',
           status = 'in_progress',
           updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id, departmentId, newAssigneeId }
    );
  } else {
    await pool.query(
      `UPDATE tickets
       SET operational_escalation_status = 'resolved',
           updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id }
    );
  }

  // Note: Ticket remains open for actual issue resolution and tenant confirmation!
  await ticketRepo.logStatusHistory({
    id: uuidv4(),
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: ticket.status,
    changedBy: user.id,
    notes: `Admin operational decision: ${decision}. Escalation returned to working team. Notes: ${notes || 'None'}`,
    role: user.role,
  }).catch(() => {});

  await auditService.logAction(
    user.id,
    'review_operational_escalation_admin',
    'ticket',
    ticket.id,
    meta?.ip,
    { escalationId, decision, notes },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  await notificationService.notifyOperationalEscalationAdminDecision(ticket, user, decision, adminDirectiveNotes, { finalIdea: adminDirectiveNotes, tenantDecisionNote }).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', {
    ticketId: ticket.id,
    operationalEscalationStatus: 'resolved',
  });

  return operationalRepo.findById(escalationId);
};

export const getOperationalEscalations = async (user, ticketId) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  return operationalRepo.findByTicketId(ticket.id);
};
