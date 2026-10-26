import * as notificationRepo from '../repository/notificationRepository.js';
import pool from '../config/db.js';
import {
  sendTicketReplyEmail,
  sendTicketResolvedEmail,
  sendTicketClosedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusEmail,
  sendNoticePublishedEmail,
  sendNoticeExpiryWarningEmail,
  sendNewTicketAdminAlert,
} from './emailService.js';
import { emitToUser, emitToTicket, broadcastTicketEvent } from './socketService.js';
import * as ticketRepo from '../repository/ticketRepository.js';

export const getUserUnreadCount = async (userId) => {
  return notificationRepo.getUnreadCount(userId);
};

export const getUserNotifications = async (userId, { limit = 20, offset = 0 } = {}) => {
  return notificationRepo.getNotifications(userId, { limit, offset });
};

export const markNotificationAsRead = async (id, userId) => {
  await notificationRepo.markAsRead(id, userId);
};

export const markAllNotificationsRead = async (userId) => {
  await notificationRepo.markAllAsRead(userId);
};

export const deleteNotification = async (id, userId) => {
  await notificationRepo.deleteNotification(id, userId);
};

export const notifyNewChatMessage = async (message, room, senderName) => {
  const [participants] = await pool.query(
    `SELECT user_id FROM chat_participants WHERE room_id = :roomId AND user_id != :senderId AND is_active = TRUE`,
    { roomId: message.room_id, senderId: message.sender_id }
  );
  for (const p of participants) {
    await notificationRepo.createNotification(
      p.user_id,
      'New Chat Message',
      `${senderName} sent you a message in "${room.name}".`,
      'chat',
      null,
      null,
      message.room_id
    );
    emitToUser(p.user_id, 'notification', {
      title: 'New Chat Message',
      message: `${senderName} sent you a message in "${room.name}".`,
      type: 'chat',
      roomId: message.room_id,
    });
  }
};

export const notifyTicketCreated = async (ticket, createdByUserId) => {
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    if (admin.id === createdByUserId) continue;
    await notificationRepo.createNotification(
      admin.id,
      'New Ticket Created',
      `Ticket ${ticket.reference_number} "${truncate(ticket.title, 60)}" has been submitted.`,
      'ticket',
      ticket.id
    );
    emitToUser(admin.id, 'notification', { title: 'New Ticket Created', message: `Ticket ${ticket.reference_number || ticket.referenceNumber} has been submitted.`, type: 'ticket', ticketId: ticket.id });
  }

  // Ensure external ticket notification reaches the created system email (demshuterefe94@gmail.com)
  sendNewTicketAdminAlert({
    ticket,
    submitterName: 'External Submitter',
    submitterEmail: '',
  }).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:created', { ticketId: ticket.id, referenceNumber: ticket.reference_number || ticket.referenceNumber, title: ticket.title });
};

export const notifyTicketAssigned = async (ticket, assignedUserId, assignedByUserId) => {
  if (assignedUserId === assignedByUserId) return;
  await notificationRepo.createNotification(
    assignedUserId,
    'Ticket Assigned to You',
    `You have been assigned ticket ${ticket.reference_number} "${truncate(ticket.title, 60)}".`,
    'assignment',
    ticket.id
  );
  emitToUser(assignedUserId, 'notification', {
    title: 'Ticket Assigned to You',
    message: `Ticket ${ticket.reference_number} has been assigned to you.`,
    type: 'assignment',
    ticketId: ticket.id,
  });

  const [userRows] = await pool.query(
    'SELECT email, first_name FROM users WHERE id = :id LIMIT 1',
    { id: assignedUserId }
  );
  if (userRows.length) {
    sendTicketAssignedEmail({
      email: userRows[0].email,
      firstName: userRows[0].first_name,
      ticket: {
        reference_number: ticket.reference_number || ticket.referenceNumber,
        title: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
      },
    }).catch(() => { });
  }
};

export const notifyTicketAssignedToDepartment = async (ticket, departmentId) => {
  const [managers] = await pool.query(
    `SELECT u.id, u.email, u.first_name FROM users u
     JOIN user_departments ud ON ud.user_id = u.id
     JOIN roles r ON r.id = u.role_id
     WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
    { departmentId }
  );
  for (const mgr of managers) {
    await notificationRepo.createNotification(
      mgr.id,
      'Ticket Assigned to Department',
      `Ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" has been assigned to your department.`,
      'assignment',
      ticket.id
    );
    emitToUser(mgr.id, 'notification', {
      title: 'Ticket Assigned to Department',
      message: `Ticket ${ticket.reference_number || ticket.referenceNumber} has been assigned to your department.`,
      type: 'assignment',
      ticketId: ticket.id,
    });
    sendTicketAssignedEmail({
      email: mgr.email,
      firstName: mgr.first_name,
      ticket: {
        reference_number: ticket.reference_number || ticket.referenceNumber,
        title: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
      },
    }).catch(() => { });
  }
};

export const notifyTicketReply = async (ticket, replyUserId, isInternal = false, visibility = 'all', targetUserId = null, replyMessage = '') => {
  const recipients = new Set();
  const [creator] = await pool.query('SELECT id FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });

  const [authorUser] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id LIMIT 1`,
    { id: replyUserId }
  );
  const authorName = authorUser.length ? `${authorUser[0].first_name || ''} ${authorUser[0].last_name || ''}`.trim() : 'User';
  const authorRole = authorUser[0]?.role_name || '';
  const isTenantAuthor = authorRole === 'tenant' || replyUserId === ticket.created_by;

  let routingType = ticket.routing_type;
  let ticketDeptId = ticket.department_id || ticket.auto_department_id;
  if (!routingType || !ticketDeptId) {
    const [catRows] = await pool.query(
      `SELECT department_id, routing_type FROM ticket_categories WHERE name = :name LIMIT 1`,
      { name: ticket.category }
    );
    if (catRows.length) {
      if (!routingType) routingType = catRows[0].routing_type;
      if (!ticketDeptId) ticketDeptId = catRows[0].department_id;
    }
  }
  routingType = routingType || 'general';

  if (targetUserId && targetUserId !== replyUserId) {
    recipients.add(targetUserId);
  }

  if (visibility === 'admin') {
    // Only notify active admins
    const [admins] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
    );
    admins.forEach((a) => {
      if (a.id !== replyUserId) recipients.add(a.id);
    });
  } else if (isTenantAuthor) {
    // Tenant replies routing:
    if (routingType === 'direct') {
      // Direct category routing: routed to the Department Manager role of that department and Admin.
      // Staff is NOT notified directly; the manager assigns comments/tasks to staff.
      if (ticketDeptId) {
        const [deptManagers] = await pool.query(
          `SELECT u.id FROM users u
           JOIN user_departments ud ON ud.user_id = u.id
           JOIN roles r ON r.id = u.role_id
           WHERE ud.department_id = :deptId AND r.name = 'manager' AND u.status = 'active'`,
          { deptId: ticketDeptId }
        );
        deptManagers.forEach((m) => {
          if (m.id !== replyUserId) recipients.add(m.id);
        });
      }
      // Also notify Admins
      const [admins] = await pool.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
      );
      admins.forEach((a) => {
        if (a.id !== replyUserId) recipients.add(a.id);
      });
    } else {
      // General category routing: strictly routed to Admin
      const [admins] = await pool.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
      );
      admins.forEach((a) => {
        if (a.id !== replyUserId) recipients.add(a.id);
      });
    }
  } else {
    // Staff / Manager / Admin replies:
    if (creator.length && creator[0].id !== replyUserId && !isInternal && visibility !== 'department') {
      recipients.add(creator[0].id);
    }

    if (ticket.assigned_to && ticket.assigned_to !== replyUserId && visibility !== 'tenant') {
      recipients.add(ticket.assigned_to);
    }

    const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
    for (const userId of accessibleUserIds) {
      if (userId !== replyUserId) recipients.add(userId);
    }
  }

  for (const userId of recipients) {
    let title = isInternal ? 'New Internal Ticket Note' : 'New Reply on Ticket';
    let message = `${authorName} replied on ticket ${ticket.reference_number}.`;

    if (userId === targetUserId) {
      title = 'Comment Assigned by Department Manager';
      message = `${authorName} assigned a comment/task to you on ticket ${ticket.reference_number}${replyMessage ? `: "${replyMessage.slice(0, 80)}"` : '.'}`;
    } else if (visibility === 'admin') {
      title = 'New Admin Note on Ticket';
      message = `${authorName} sent a private manager reply to Admin on ticket ${ticket.reference_number}.`;
    } else if (isTenantAuthor) {
      if (routingType === 'direct') {
        title = 'New Tenant Reply (Direct to Department)';
        message = `${authorName} (Tenant) replied on ticket ${ticket.reference_number} routed directly to your department manager.`;
      } else {
        title = 'New Tenant Reply (Routed to Admin)';
        message = `${authorName} (Tenant) replied on ticket ${ticket.reference_number}.`;
      }
    }

    await notificationRepo.createNotification(
      userId,
      title,
      message,
      'reply',
      ticket.id
    );
    emitToUser(userId, 'notification', {
      title,
      message,
      type: 'reply',
      ticketId: ticket.id,
      visibility,
    });
  }

  // Dispatch email notifications to relevant parties
  for (const userId of recipients) {
    try {
      const [uRows] = await pool.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role_name 
         FROM users u 
         LEFT JOIN roles r ON r.id = u.role_id 
         WHERE u.id = :id AND u.status = "active" LIMIT 1`,
        { id: userId }
      );
      if (uRows.length && uRows[0].email) {
        const recipientRole = uRows[0].role_name || 'tenant';
        const isAnnouncement = !isInternal && ['admin', 'manager', 'staff'].includes(authorRole) && (visibility === 'all' || visibility === 'tenant');
        sendTicketReplyEmail({
          email: uRows[0].email,
          firstName: uRows[0].first_name || 'User',
          recipientRole,
          ticket: {
            id: ticket.id,
            ticket_num: ticket.ticket_num || ticket.ticketNum,
            reference_number: ticket.reference_number || ticket.referenceNumber,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
          },
          replyPreview: (replyMessage || '').slice(0, 800),
          isAnnouncement,
          authorName,
          authorRole,
        }).catch(() => {});
      }
    } catch {}
  }

  // If reply was sent by external tenant, ensure HDMS system email (demshuterefe94@gmail.com) receives it
  if (isTenantAuthor) {
    const adminEmail = process.env.EMAIL_USER || 'demshuterefe94@gmail.com';
    sendTicketReplyEmail({
      email: adminEmail,
      firstName: 'Admin',
      recipientRole: 'admin',
      ticket: {
        id: ticket.id,
        ticket_num: ticket.ticket_num || ticket.ticketNum,
        reference_number: ticket.reference_number || ticket.referenceNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
      },
      replyPreview: `[Tenant Reply from: ${authorName}] ${(replyMessage || '').slice(0, 800)}`,
      authorName,
      authorRole,
    }).catch(() => {});
  }

  broadcastTicketEvent(ticket.id, 'ticket:reply', {
    ticketId: ticket.id,
    referenceNumber: ticket.reference_number,
    replyUserId,
    visibility,
  });
};

export const notifyTicketStatusChanged = async (ticket, toStatus, changedByUserId) => {
  const recipients = new Set();
  if (ticket.created_by && ticket.created_by !== changedByUserId) recipients.add(ticket.created_by);
  if (ticket.assigned_to && ticket.assigned_to !== changedByUserId) recipients.add(ticket.assigned_to);

  for (const userId of recipients) {
    await notificationRepo.createNotification(
      userId,
      'Ticket Status Updated',
      `Ticket ${ticket.reference_number} status changed to ${toStatus}.`,
      'status',
      ticket.id
    );
  }

  const creatorName = await getUserName(ticket.created_by);
  sendTicketStatusEmail({
    email: (await pool.query('SELECT email FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by }))[0][0]?.email,
    firstName: creatorName,
    ticket,
    fromStatus: ticket.status,
    toStatus,
  }).catch(() => { });
};

export const notifyTicketResolved = async (ticket) => {
  if (!ticket.created_by) return;
  const creatorName = await getUserName(ticket.created_by);
  sendTicketResolvedEmail({
    email: (await pool.query('SELECT email FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by }))[0][0]?.email,
    firstName: creatorName,
    ticket,
  }).catch(() => { });
};

export const notifyTicketApproved = async (ticket, adminResolutionNote = '') => {
  if (!ticket.created_by) return;

  const [tenantRows] = await pool.query(
    'SELECT email, first_name FROM users WHERE id = :id LIMIT 1',
    { id: ticket.created_by }
  );
  if (!tenantRows.length) return;

  const message = adminResolutionNote
    ? `Your ticket ${ticket.reference_number || ticket.referenceNumber} has been approved and resolved. Note: ${truncate(adminResolutionNote, 120)}`
    : `Your ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" has been approved and resolved.`;

  await notificationRepo.createNotification(
    ticket.created_by,
    'Ticket Approved & Resolved',
    message,
    'status',
    ticket.id
  );

  emitToUser(ticket.created_by, 'notification', {
    title: 'Ticket Approved & Resolved',
    message,
    type: 'status',
    ticketId: ticket.id,
  });

  sendTicketResolvedEmail({
    email: tenantRows[0].email,
    firstName: tenantRows[0].first_name,
    ticket: {
      reference_number: ticket.reference_number || ticket.referenceNumber,
      title: ticket.title,
      notes: adminResolutionNote,
    },
  }).catch(() => { });
};

export const notifyTicketClosed = async (ticket) => {
  if (!ticket.created_by) return;
  const creatorName = await getUserName(ticket.created_by);
  sendTicketClosedEmail({
    email: (await pool.query('SELECT email FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by }))[0][0]?.email,
    firstName: creatorName,
    ticket,
  }).catch(() => { });
};

export const notifyNoticePublished = async (notice, recipients = []) => {
  for (const user of recipients) {
    const message = `${truncate(notice.title, 80)} — ${truncate(notice.description, 120)}`;
    await notificationRepo.createNotification(
      user.id,
      'New Notice Published',
      message,
      'notice',
      null,
      notice.id
    );
    emitToUser(user.id, 'notification', {
      title: 'New Notice Published',
      message,
      type: 'notice',
      noticeId: notice.id,
    });
    sendNoticePublishedEmail({
      email: user.email,
      firstName: user.first_name,
      notice,
    }).catch(() => { });
  }
};

export const notifyNoticeExpiryWarning = async (notice, recipients = []) => {
  for (const user of recipients) {
    const message = `Notice "${truncate(notice.title, 80)}" has expired without acknowledgement.`;
    await notificationRepo.createNotification(
      user.id,
      'Notice Expired – Action Required',
      message,
      'notice',
      null,
      notice.id
    );
    emitToUser(user.id, 'notification', {
      title: 'Notice Expired – Action Required',
      message,
      type: 'notice',
      noticeId: notice.id,
    });
    sendNoticeExpiryWarningEmail({
      email: user.email,
      firstName: user.first_name,
      notice,
    }).catch(() => { });
  }
};

export const notifyTicketEscalated = async (ticket, escalatedBy, notes) => {
  if (!ticket.created_by) return;
  await notificationRepo.createNotification(
    ticket.created_by, 'Ticket Escalated', `Ticket ${ticket.referenceNumber || ticket.reference_number} has been escalated.`, 'escalation', ticket.id
  );

  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  for (const userId of accessibleUserIds) {
    if (userId === escalatedBy) continue;
    await notificationRepo.createNotification(
      userId, 'Ticket Escalated', `Ticket ${ticket.referenceNumber || ticket.reference_number} was escalated by a ${ticket.role || 'user'}.`, 'escalation', ticket.id
    );
  }
};

export const notifyTicketCompleted = async (ticket, completedBy, slaAchieved = false, resolutionMinutes = null) => {
  if (!ticket.created_by) return;

  const slaText = slaAchieved
    ? 'The ticket was completed within the SLA deadline.'
    : 'The ticket was completed after the SLA deadline.';
  const durationText = resolutionMinutes
    ? ` Total resolution time: ${Math.floor(resolutionMinutes / 60)}h ${resolutionMinutes % 60}m.`
    : '';

  await notificationRepo.createNotification(
    ticket.created_by, 'Ticket Completed',
    `Ticket ${ticket.referenceNumber || ticket.reference_number} has been marked completed and is awaiting approval. ${slaText}${durationText}`,
    'completion', ticket.id
  );

  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  for (const userId of accessibleUserIds) {
    if (userId === completedBy) continue;
    const isManager = userId !== ticket.created_by && ticket.department_id;
    await notificationRepo.createNotification(
      userId,
      isManager ? 'Ticket Completed' : 'Completion Awaiting Approval',
      isManager
        ? `Ticket ${ticket.referenceNumber || ticket.reference_number} has been marked completed. ${slaText}${durationText}`
        : `Ticket ${ticket.referenceNumber || ticket.reference_number} is awaiting your approval. ${slaText}${durationText}`,
      'completion',
      ticket.id
    );
  }
};

export const notifyTicketAccepted = async (ticket, acceptedBy) => {
  const recipients = new Set([ticket.created_by, ticket.assigned_to]);
  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  for (const userId of accessibleUserIds) {
    if (userId !== acceptedBy) recipients.add(userId);
  }
  for (const userId of recipients) {
    if (!userId || userId === acceptedBy) continue;
    await notificationRepo.createNotification(
      userId, 'Assignment Accepted',
      `Ticket ${ticket.referenceNumber || ticket.reference_number} assignment has been accepted.`,
      'assignment', ticket.id
    );
  }
};

export const notifyTicketRejected = async (ticket, rejectedBy, reason) => {
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  const recipients = new Set([ticket.created_by, ...admins.map(a => a.id)]);
  const reasonText = reason ? ` Reason: ${truncate(reason, 120)}.` : '';
  for (const userId of recipients) {
    if (!userId || userId === rejectedBy) continue;
    await notificationRepo.createNotification(
      userId, 'Assignment Rejected',
      `Ticket ${ticket.referenceNumber || ticket.reference_number} assignment was rejected.${reasonText}`,
      'assignment', ticket.id
    );
  }
};

export const notifyTicketReopened = async (ticket, reopenedBy, notes) => {
  const recipients = new Set();
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  if (creatorId && creatorId !== reopenedBy) {
    recipients.add(creatorId);
  }

  if (assignedToId && assignedToId !== reopenedBy) {
    recipients.add(assignedToId);
  }

  if (departmentId) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    ).catch(() => [[]]);
    for (const m of (managers || [])) {
      if (m.id !== reopenedBy) recipients.add(m.id);
    }
  }

  const reasonText = notes ? ` Reason: ${notes}` : '';
  const message = `Ticket ${ticket.referenceNumber || ticket.reference_number} has been reopened.${reasonText}`;

  for (const userId of recipients) {
    await notificationRepo.createNotification(
      userId,
      'Ticket Reopened',
      message,
      'reopen',
      ticket.id
    ).catch(() => {});
  }
};

export const notifyTicketMerged = async (ticket, count, notes) => {
  if (!ticket.created_by) return;
  await notificationRepo.createNotification(
    ticket.created_by, 'Tickets Merged', `${count} duplicate ticket(s) were merged into ${ticket.referenceNumber || ticket.reference_number}.`, 'merge', ticket.id
  );
};

export const notifyInternalNote = async (ticket, authorId) => {
  const recipients = new Set();
  const [creator] = await pool.query('SELECT id FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (creator.length && creator[0].id !== authorId) recipients.add(creator[0].id);

  if (ticket.assigned_to && ticket.assigned_to !== authorId) {
    recipients.add(ticket.assigned_to);
  }

  const authorUser = await pool.query('SELECT role FROM users WHERE id = :id LIMIT 1', { id: authorId });
  const authorRole = authorUser[0]?.role;

  if (authorRole === 'admin' || authorRole === 'ceo') {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name IN ('manager', 'staff') AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const m of managers) recipients.add(m.id);

    const [allStaff] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('manager', 'staff') AND u.status = 'active' AND u.id != :authorId`,
      { authorId }
    );
    for (const s of allStaff) recipients.add(s.id);
  } else if (authorRole === 'manager') {
    const authorDeptIds = await ticketRepo.getUserDepartmentIds(authorId);
    if (authorDeptIds.length > 0) {
      const placeholders = authorDeptIds.map(() => '?').join(',');
      const [staff] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id IN (${placeholders}) AND r.name = 'staff' AND u.status = 'active' AND u.id != ?`,
        [...authorDeptIds, authorId]
      );
      for (const s of staff) recipients.add(s.id);

      const [managers] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id IN (${placeholders}) AND r.name = 'manager' AND u.status = 'active' AND u.id != ?`,
        [...authorDeptIds, authorId]
      );
      for (const m of managers) recipients.add(m.id);
    }
  } else if (authorRole === 'staff') {
    const staffDeptIds = await ticketRepo.getUserDepartmentIds(authorId);
    if (staffDeptIds.length > 0) {
      const placeholders = staffDeptIds.map(() => '?').join(',');
      const [staff] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id IN (${placeholders}) AND r.name = 'staff' AND u.status = 'active' AND u.id != ?`,
        [...staffDeptIds, authorId]
      );
      for (const s of staff) recipients.add(s.id);

      const [managers] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id IN (${placeholders}) AND r.name = 'manager' AND u.status = 'active' AND u.id != ?`,
        [...staffDeptIds, authorId]
      );
      for (const m of managers) recipients.add(m.id);
    }
  }

  for (const userId of recipients) {
    await notificationRepo.createNotification(
      userId, 'New Internal Note', `An internal note was added to ticket ${ticket.referenceNumber || ticket.reference_number}.`, 'internal', ticket.id
    );
  }
};

export const notifyTicketReassigned = async (ticket, toRole, reason) => {
  if (!ticket.created_by) return;
  await notificationRepo.createNotification(
    ticket.created_by, 'Ticket Reassigned', `Ticket ${ticket.referenceNumber || ticket.reference_number} was returned to ${toRole}.`, 'assignment', ticket.id
  );
};

export const notifySLABreached = async (ticket, breachType) => {
  const titleMap = {
    response: 'Response SLA Breached',
    escalation: 'Escalation SLA Triggered',
    resolution: 'Resolution SLA Overdue',
  };
  const messageMap = {
    response: `Response SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" has been breached.`,
    escalation: `Escalation SLA triggered for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}". Ticket escalated.`,
    resolution: `Resolution SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" is overdue.`,
  };
  const title = titleMap[breachType] || 'SLA Breached';
  const message = messageMap[breachType] || 'SLA deadline breached.';

  const userIds = new Set();

  if (breachType === 'escalation') {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
    );
    for (const a of admins) userIds.add(a.id);
    if (ticket.created_by) userIds.add(ticket.created_by);
  } else {
    if (ticket.assigned_to) userIds.add(ticket.assigned_to);
    if (ticket.created_by) userIds.add(ticket.created_by);
  }

  if (ticket.department_id) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const mgr of managers) userIds.add(mgr.id);
  }

  for (const userId of userIds) {
    await notificationRepo.createNotification(userId, title, message, 'sla', ticket.id);
    emitToUser(userId, 'notification', { title, message, type: 'sla', ticketId: ticket.id });
  }

  emitToTicket(ticket.id, 'sla:breached', { ticketId: ticket.id, breachType, title, message });
};

export const notifySLANearDeadline = async (ticket, breachType, remainingHours) => {
  const titleMap = {
    response: 'Response SLA Approaching',
    escalation: 'Escalation SLA Approaching',
    resolution: 'Resolution SLA Approaching',
  };
  const messageMap = {
    response: `Response SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
    escalation: `Escalation SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
    resolution: `Resolution SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
  };
  const title = titleMap[breachType] || 'SLA Approaching';
  const message = messageMap[breachType] || 'SLA deadline approaching.';

  const userIds = new Set();
  if (ticket.assigned_to) userIds.add(ticket.assigned_to);
  if (ticket.created_by) userIds.add(ticket.created_by);

  if (ticket.department_id) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const mgr of managers) userIds.add(mgr.id);
  }

  for (const userId of userIds) {
    await notificationRepo.createNotification(userId, title, message, 'sla', ticket.id);
    emitToUser(userId, 'notification', { title, message, type: 'sla', ticketId: ticket.id, remainingHours });
  }

  emitToTicket(ticket.id, 'sla:near-deadline', { ticketId: ticket.id, breachType, remainingHours, title, message });
};

async function getUserName(userId) {
  if (!userId) return 'User';
  const [rows] = await pool.query('SELECT first_name FROM users WHERE id = :id LIMIT 1', { id: userId });
  return rows[0]?.first_name || 'User';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

const getTicketAccessibleUserIds = async (ticket) => {
  const userIds = new Set();

  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  admins.forEach((a) => userIds.add(a.id));

  if (ticket.tenant_id) {
    const [tenantUsers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.tenant_id = :tenantId AND r.name = 'tenant' AND u.status = 'active'`,
      { tenantId: ticket.tenant_id }
    );
    tenantUsers.forEach((u) => userIds.add(u.id));
  }

  if (ticket.assigned_to) {
    userIds.add(ticket.assigned_to);
  }

  if (ticket.department_id) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    managers.forEach((m) => userIds.add(m.id));
  }

  return userIds;
};

export const notifyKnowledgeSubmitted = async (article, submittedByUser) => {
  // Find department managers for this article's department
  let query = `SELECT DISTINCT u.id, u.email, u.first_name 
               FROM users u 
               JOIN roles r ON r.id = u.role_id 
               WHERE r.name = 'manager' AND u.status = 'active' AND u.id != :submittedBy`;
  let params = { submittedBy: submittedByUser.id };

  if (article.department_id) {
    query = `SELECT DISTINCT u.id, u.email, u.first_name 
             FROM users u 
             JOIN roles r ON r.id = u.role_id 
             JOIN user_departments ud ON ud.user_id = u.id
             WHERE r.name = 'manager' AND ud.department_id = :deptId AND u.status = 'active' AND u.id != :submittedBy`;
    params = { submittedBy: submittedByUser.id, deptId: article.department_id };
  }

  const [managers] = await pool.query(query, params);
  for (const mgr of managers) {
    await notificationRepo.createNotification(
      mgr.id,
      'Staff Article Submitted for Approval',
      `Staff member ${submittedByUser.first_name || 'Staff'} submitted article "${truncate(article.title, 80)}" (${article.article_reference}) for your department review.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(mgr.id, 'notification', {
      title: 'Staff Article Submitted for Approval',
      message: `"${truncate(article.title, 60)}" requires your department review and approval.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }
};

export const notifyKnowledgeApproved = async (article, approvedByUser) => {
  // 1. Notify Staff author
  if (article.author_id && article.author_id !== approvedByUser.id) {
    await notificationRepo.createNotification(
      article.author_id,
      'Article Approved by Department Manager',
      `Your article "${truncate(article.title, 80)}" (${article.article_reference}) has been approved by your department manager and is pending Admin publishment.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(article.author_id, 'notification', {
      title: 'Article Approved by Department Manager',
      message: `"${truncate(article.title, 60)}" was approved by your department manager and is pending Admin publishment.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }

  // 2. Notify all Admins to publish the article
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    await notificationRepo.createNotification(
      admin.id,
      'Article Approved — Ready to Publish',
      `Article "${truncate(article.title, 80)}" (${article.article_reference}) was approved by department manager and is ready for Admin to publish.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(admin.id, 'notification', {
      title: 'Article Approved — Ready to Publish',
      message: `"${truncate(article.title, 60)}" was approved by department manager and is ready to publish.`,
      type: 'knowledge_approved',
      articleId: article.id,
    });
  }
};

export const notifyKnowledgeRejected = async (article, rejectedByUser, reason) => {
  if (article.author_id && article.author_id !== rejectedByUser.id) {
    await notificationRepo.createNotification(
      article.author_id,
      'Article Rejected',
      `Your article "${truncate(article.title, 80)}" was rejected. Reason: ${truncate(reason || 'No reason provided', 120)}`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(article.author_id, 'notification', {
      title: 'Article Rejected',
      message: `"${truncate(article.title, 60)}" was rejected.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }
};

export const notifyKnowledgeRevisionRequested = async (article, requestedByUser, reason) => {
  if (article.author_id && article.author_id !== requestedByUser.id) {
    await notificationRepo.createNotification(
      article.author_id,
      'Article Revision Requested',
      `Your article "${truncate(article.title, 80)}" needs revision. ${truncate(reason || '', 120)}`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(article.author_id, 'notification', {
      title: 'Article Revision Requested',
      message: `"${truncate(article.title, 60)}" needs revision.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }
};

export const notifyKnowledgePublished = async (article, publishedByUser) => {
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('admin','manager','staff') AND u.status = 'active' AND u.id != :publishedBy`,
    { publishedBy: publishedByUser.id }
  );
  for (const admin of admins) {
    await notificationRepo.createNotification(
      admin.id,
      'New Knowledge Article Published',
      `Article "${truncate(article.title, 80)}" (${article.article_reference}) has been published.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(admin.id, 'notification', {
      title: 'New Knowledge Article Published',
      message: `"${truncate(article.title, 60)}" is now live.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }
};

export const notifyKnowledgeUnpublished = async (article, unpublishedByUser) => {
  if (article.author_id && article.author_id !== unpublishedByUser.id) {
    await notificationRepo.createNotification(
      article.author_id,
      'Article Unpublished',
      `Your article "${truncate(article.title, 80)}" has been unpublished.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    );
    emitToUser(article.author_id, 'notification', {
      title: 'Article Unpublished',
      message: `"${truncate(article.title, 60)}" was unpublished.`,
      type: 'knowledge',
      articleId: article.id,
    });
  }
};

// ── Multi-Tier Ticket Resolution Lifecycle Notifications ──

export const notifyStaffSubmittedResolution = async (ticket, staffUserId, notes = '') => {
  if (ticket.department_id) {
    const [managers] = await pool.query(
      `SELECT u.id, u.email, u.first_name FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const mgr of managers) {
      await notificationRepo.createNotification(
        mgr.id,
        'Staff Resolution Pending Manager Approval',
        `Ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 50)}" was resolved by staff and requires your review/approval.`,
        'status',
        ticket.id
      );
      emitToUser(mgr.id, 'notification', {
        title: 'Staff Resolution Pending Manager Approval',
        message: `Ticket ${ticket.reference_number || ticket.referenceNumber} was resolved by staff and requires your review/approval.`,
        type: 'status',
        ticketId: ticket.id,
      });
    }
  }
  broadcastTicketEvent(ticket.id, 'ticket:under_review', { ticketId: ticket.id, status: 'under_review' });
};

export const notifyManagerApprovedResolution = async (ticket, managerUserId, notes = '') => {
  const [admins] = await pool.query(
    `SELECT u.id, u.email, u.first_name FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  );
  for (const adm of admins) {
    await notificationRepo.createNotification(
      adm.id,
      'Resolution Pending Admin Verification',
      `Department manager approved resolution for ticket ${ticket.reference_number || ticket.referenceNumber}. Awaiting admin verification.`,
      'status',
      ticket.id
    );
    emitToUser(adm.id, 'notification', {
      title: 'Resolution Pending Admin Verification',
      message: `Department manager approved resolution for ticket ${ticket.reference_number || ticket.referenceNumber}. Awaiting admin verification.`,
      type: 'status',
      ticketId: ticket.id,
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:pending_approval', { ticketId: ticket.id, status: 'pending_approval' });
};

export const notifyAdminVerifiedResolution = async (ticket, adminUserId, notes = '') => {
  // 1. Notify Tenant that ticket is resolved and waiting for tenant's verification
  if (ticket.created_by) {
    const [tenantRows] = await pool.query(
      'SELECT email, first_name FROM users WHERE id = :id LIMIT 1',
      { id: ticket.created_by }
    );
    await notificationRepo.createNotification(
      ticket.created_by,
      'Ticket Resolved - Your Confirmation Needed',
      `Your ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 50)}" has been resolved. Please confirm whether your issue is solved.`,
      'status',
      ticket.id
    );
    emitToUser(ticket.created_by, 'notification', {
      title: 'Ticket Resolved - Your Confirmation Needed',
      message: `Your ticket ${ticket.reference_number || ticket.referenceNumber} has been resolved. Please verify if your issue is solved.`,
      type: 'status',
      ticketId: ticket.id,
    });
    if (tenantRows.length) {
      sendTicketResolvedEmail({
        email: tenantRows[0].email,
        firstName: tenantRows[0].first_name,
        ticket: {
          reference_number: ticket.reference_number || ticket.referenceNumber,
          title: ticket.title,
          notes,
        },
      }).catch(() => {});
    }
  }

  // 2. Notify assigned staff and department manager
  const recipients = new Set();
  if (ticket.assigned_to && ticket.assigned_to !== adminUserId) recipients.add(ticket.assigned_to);
  if (ticket.department_id) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const m of mgrs) {
      if (m.id !== adminUserId) recipients.add(m.id);
    }
  }
  for (const uid of recipients) {
    await notificationRepo.createNotification(
      uid,
      'Ticket Resolution Verified by Admin',
      `Admin verified resolution for ticket ${ticket.reference_number || ticket.referenceNumber}. Routed to tenant for confirmation.`,
      'status',
      ticket.id
    );
    emitToUser(uid, 'notification', {
      title: 'Ticket Resolution Verified by Admin',
      message: `Admin verified resolution for ticket ${ticket.reference_number || ticket.referenceNumber}.`,
      type: 'status',
      ticketId: ticket.id,
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:waiting_tenant', { ticketId: ticket.id, status: 'waiting_tenant' });
};

export const notifyTenantConfirmedResolution = async (ticket, tenantUserId, rating, feedback) => {
  const recipients = new Set();
  if (ticket.assigned_to) recipients.add(ticket.assigned_to);
  if (ticket.department_id) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const m of mgrs) recipients.add(m.id);
  }
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  );
  for (const a of admins) recipients.add(a.id);
  recipients.delete(tenantUserId);

  for (const uid of recipients) {
    await notificationRepo.createNotification(
      uid,
      'Ticket Confirmed Solved by Tenant',
      `Tenant confirmed ticket ${ticket.reference_number || ticket.referenceNumber} is solved! Rated: ${rating || 5}/5. Status marked as Completed.`,
      'status',
      ticket.id
    );
    emitToUser(uid, 'notification', {
      title: 'Ticket Confirmed Solved by Tenant',
      message: `Tenant confirmed ticket ${ticket.reference_number || ticket.referenceNumber} is solved! Rated: ${rating || 5}/5.`,
      type: 'status',
      ticketId: ticket.id,
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:completed', { ticketId: ticket.id, status: 'completed' });
};

export const notifyReworkRequested = async (ticket, requestedByUserId, reason, targetAudience = 'all') => {
  const recipients = new Set();
  if (ticket.assigned_to && ticket.assigned_to !== requestedByUserId) recipients.add(ticket.assigned_to);
  if (ticket.department_id) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId: ticket.department_id }
    );
    for (const m of mgrs) {
      if (m.id !== requestedByUserId) recipients.add(m.id);
    }
  }

  for (const uid of recipients) {
    await notificationRepo.createNotification(
      uid,
      'Ticket Rework Requested',
      `Ticket ${ticket.reference_number || ticket.referenceNumber} returned to In Progress for rework. Reason: ${truncate(reason || 'Rework requested', 100)}`,
      'status',
      ticket.id
    );
    emitToUser(uid, 'notification', {
      title: 'Ticket Rework Requested',
      message: `Ticket ${ticket.reference_number || ticket.referenceNumber} returned to In Progress for rework.`,
      type: 'status',
      ticketId: ticket.id,
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:in_progress', { ticketId: ticket.id, status: 'in_progress' });
};

