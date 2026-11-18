import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import * as collaboratorRepo from '../repository/collaboratorRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import * as auditService from './auditService.js';
import * as notificationService from './notificationService.js';
import { canAccessTicket } from './ticketService.js';
import { broadcastTicketEvent } from './socketService.js';

export const addCollaborators = async (
  user,
  ticketId,
  { userIds = [], role = 'collaborator', notes = null, inPersonNotes = null },
  meta = {}
) => {
  if (user.role === 'tenant') {
    throw Object.assign(new Error('Tenants are not permitted to manage ticket collaborators'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  // Only manager of the department, assigned staff, or admin can assign collaborators
  const isAssignedStaff = ticket.assigned_to === user.id;
  const isAdmin = user.role === 'admin';
  let isDeptManager = false;

  if (user.role === 'manager' && ticket.department_id) {
    const [rows] = await pool.query(
      'SELECT 1 FROM user_departments WHERE user_id = :userId AND department_id = :deptId LIMIT 1',
      { userId: user.id, deptId: ticket.department_id }
    );
    isDeptManager = rows.length > 0;
  }

  if (!isAdmin && !isDeptManager && !isAssignedStaff) {
    throw Object.assign(new Error('Not authorized to add collaborators to this ticket'), { statusCode: 403 });
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw Object.assign(new Error('At least one collaborator user ID is required'), { statusCode: 400 });
  }

  const added = [];
  for (const uid of userIds) {
    if (!uid || uid === ticket.assigned_to) continue;
    const collaborator = await collaboratorRepo.add({
      ticketId: ticket.id,
      userId: uid,
      assignedBy: user.id,
      role: role || 'collaborator',
      notes,
      inPersonNotes,
    });
    added.push(collaborator);
    await notificationService.notifyCollaboratorAdded(ticket, uid, user, role, notes).catch(() => {});
  }

  // Update ticket operational status to collaborative if not already under admin review
  if (ticket.operational_escalation_status === 'none' || ticket.operational_escalation_status === 'guidance_provided') {
    await pool.query(
      `UPDATE tickets SET operational_escalation_status = 'collaborative', updated_at = NOW() WHERE id = :id`,
      { id: ticket.id }
    );
  }

  await ticketRepo.logStatusHistory({
    id: uuidv4(),
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: ticket.status,
    changedBy: user.id,
    notes: `Team collaboration initialized: ${added.length} staff member(s) added as ${role || 'collaborator'}.`,
    role: user.role,
  }).catch(() => {});

  await auditService.logAction(
    user.id,
    'add_collaborators',
    'ticket',
    ticket.id,
    meta?.ip,
    { userIds, role, count: added.length },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id, collaboratorsCount: added.length });

  return collaboratorRepo.findByTicketId(ticket.id);
};

export const recordContribution = async (
  user,
  ticketId,
  { contributionNotes, inPersonNotes },
  meta = {}
) => {
  if (user.role === 'tenant') {
    throw Object.assign(new Error('Tenants cannot record internal staff contributions'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  if (!contributionNotes && !inPersonNotes) {
    throw Object.assign(new Error('Either contribution notes or in-person collaboration notes must be provided'), { statusCode: 400 });
  }

  const updatedCollaborator = await collaboratorRepo.recordContribution(ticket.id, user.id, {
    contributionNotes,
    inPersonNotes,
  });

  // Also post an internal note into ticket replies so all authorized team members can read the technical findings
  const noteContent = [
    `**Staff Contribution Update (${user.first_name || 'Staff'})**`,
    contributionNotes ? `Technical Progress / Findings:\n${contributionNotes}` : null,
    inPersonNotes ? `In-Person / Offline Collaboration:\n${inPersonNotes}` : null,
  ].filter(Boolean).join('\n\n');

  await pool.query(
    `INSERT INTO ticket_replies (id, ticket_id, user_id, message, visibility, type, is_internal, created_at)
     VALUES (:id, :ticketId, :userId, :message, 'internal', 'note', 1, NOW())`,
    {
      id: uuidv4(),
      ticketId: ticket.id,
      userId: user.id,
      message: noteContent,
    }
  );

  await auditService.logAction(
    user.id,
    'record_ticket_contribution',
    'ticket',
    ticket.id,
    meta?.ip,
    { hasContributionNotes: !!contributionNotes, hasInPersonNotes: !!inPersonNotes },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id });

  return updatedCollaborator;
};

export const removeCollaborator = async (user, ticketId, targetUserId, meta = {}) => {
  if (user.role === 'tenant') {
    throw Object.assign(new Error('Tenants are not permitted to manage collaborators'), { statusCode: 403 });
  }

  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  const isAdmin = user.role === 'admin';
  const isAssignedStaff = ticket.assigned_to === user.id;
  let isDeptManager = false;

  if (user.role === 'manager' && ticket.department_id) {
    const [rows] = await pool.query(
      'SELECT 1 FROM user_departments WHERE user_id = :userId AND department_id = :deptId LIMIT 1',
      { userId: user.id, deptId: ticket.department_id }
    );
    isDeptManager = rows.length > 0;
  }

  if (!isAdmin && !isDeptManager && !isAssignedStaff) {
    throw Object.assign(new Error('Not authorized to remove collaborators from this ticket'), { statusCode: 403 });
  }

  await collaboratorRepo.remove(ticket.id, targetUserId);

  await auditService.logAction(
    user.id,
    'remove_collaborator',
    'ticket',
    ticket.id,
    meta?.ip,
    { targetUserId },
    { role: user.role, browser: meta?.browser }
  ).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id });

  return { success: true };
};

export const getCollaborators = async (user, ticketId) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (!(await canAccessTicket(user, ticket))) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  return collaboratorRepo.findByTicketId(ticket.id);
};
