import * as notificationRepo from '../repository/notificationRepository.js';
import pool from '../config/db.js';
import {
  sendTicketCreatedEmail,
  sendTicketReplyEmail,
  sendTicketResolvedEmail,
  sendTicketClosedEmail,
  sendTicketAssignedEmail,
  sendTicketReminderEmail,
  sendTicketStatusEmail,
  sendTicketEscalatedEmail,
  sendTicketCompletedEmail,
  sendTicketAcceptedEmail,
  sendTicketRejectedEmail,
  sendTicketApprovedEmail,
  sendTicketReopenedEmail,
  sendTicketMergedEmail,
  sendNoticePublishedEmail,
  sendNoticeExpiryWarningEmail,
  sendSLABreachedEmail,
  sendSLANearDeadlineEmail,
  sendNewTicketAdminAlert,
  sendChatMessageEmail,
  sendKnowledgeSubmittedEmail,
  sendKnowledgeApprovedEmail,
  sendKnowledgePublishedEmail,
  sendKnowledgeStatusEmail,
  sendFeedbackAlertEmail,
  sendFeedbackResponseEmail,
  sendFeedbackDepartmentAssignedEmail,
  sendFeedbackStaffAssignedEmail,
} from './emailService.js';
import { emitToUser, emitToTicket, broadcastTicketEvent } from './socketService.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import { resolveDepartmentId } from '../repository/departmentRepository.js';
import { resolveUserId } from '../repository/userRepository.js';

export const getUserUnreadCount = async (userId) => {
  return notificationRepo.getUnreadCount(userId);
};

export const getUserNotifications = async (userId, { limit = 20, offset = 0, unreadOnly = false } = {}) => {
  return notificationRepo.getNotifications(userId, { limit, offset, unreadOnly });
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

/**
 * getTargetedUser(userId)
 * Fetches targeted user profile and resolves active registered email (users.email or tenants.email).
 */
export const getTargetedUser = async (userId) => {
  if (!userId) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role,
            u.tenant_id, t.organization_name AS tenant_name, t.email AS tenant_email
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = :id AND u.status = 'active' LIMIT 1`,
    { id: userId }
  );
  if (!rows.length) return null;
  const r = rows[0];
  const email = (r.email && r.email.trim()) || (r.tenant_email && r.tenant_email.trim()) || null;
  const firstName = r.first_name || 'User';
  const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || firstName;
  return {
    id: r.id,
    email,
    firstName,
    fullName,
    role: r.role,
    tenantId: r.tenant_id,
  };
};

/**
 * getTargetedUsers(userIds)
 * Batch resolves active registered user profiles and emails.
 */
export const getTargetedUsers = async (userIds) => {
  const ids = Array.from(new Set(Array.from(userIds || []).filter(Boolean)));
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `:id${i}`).join(',');
  const params = {};
  ids.forEach((id, i) => { params[`id${i}`] = id; });

  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role,
            u.tenant_id, t.organization_name AS tenant_name, t.email AS tenant_email
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id IN (${placeholders}) AND u.status = 'active'`,
    params
  );

  return rows.map((r) => ({
    id: r.id,
    email: (r.email && r.email.trim()) || (r.tenant_email && r.tenant_email.trim()) || null,
    firstName: r.first_name || 'User',
    fullName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.first_name || 'User',
    role: r.role,
    tenantId: r.tenant_id,
  }));
};

/**
 * dispatchNotification({ userId, title, message, type, ticketId, noticeId, roomId, articleId, extraPayload, sendEmailFn })
 * Guarantees delivery to targeted audience via:
 * 1. Web application in-app database record (notificationRepo.createNotification)
 * 2. Web application live real-time notification alert via socket (emitToUser)
 * 3. Registered email account in their account profile (users.email / tenants.email)
 */
export const dispatchNotification = async ({
  userId,
  title,
  message,
  type = 'ticket',
  ticketId = null,
  noticeId = null,
  roomId = null,
  articleId = null,
  extraPayload = {},
  sendEmailFn = null,
}) => {
  if (!userId) return;
  const user = await getTargetedUser(userId);
  if (!user) return;

  // 1. In-app database record
  const notifRecord = await notificationRepo.createNotification(
    user.id,
    title,
    message,
    type,
    ticketId,
    noticeId,
    roomId,
    articleId
  ).catch((err) => {
    console.error('[Notification] DB record error:', err.message);
    return null;
  });

  // 2. Web application live alert (socket event with persistent DB ID)
  emitToUser(user.id, 'notification', {
    id: notifRecord?.id || undefined,
    title,
    message,
    type,
    ticketId,
    noticeId,
    roomId,
    articleId,
    createdAt: notifRecord?.created_at || new Date().toISOString(),
    ...extraPayload,
  });

  // 3. Registered account profile email notification
  if (user.email && typeof sendEmailFn === 'function') {
    sendEmailFn(user).catch((err) => console.error('[Notification] Email error:', err.message));
  }
};

export const notifyNewChatMessage = async (message, room, senderName) => {
  const [participants] = await pool.query(
    `SELECT cp.user_id, u.email, u.first_name, u.last_name, r.name AS role, t.email AS tenant_email
     FROM chat_participants cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE cp.room_id = :roomId AND cp.user_id != :senderId AND cp.is_active = TRUE AND u.status = 'active'`,
    { roomId: message.room_id, senderId: message.sender_id }
  );

  const snippet = message.message || (message.attachmentName ? `Attachment: ${message.attachmentName}` : 'New message');
  const roomTitle = room?.name || 'Chat';

  for (const p of participants) {
    const recipientName = p.first_name || 'Colleague';
    const email = (p.email && p.email.trim()) || (p.tenant_email && p.tenant_email.trim());

    // 1. In-app database record
    const notif = await notificationRepo.createNotification(
      p.user_id,
      'New Chat Message',
      `${senderName}: "${truncate(snippet, 80)}" in "${roomTitle}"`,
      'chat',
      null,
      null,
      message.room_id
    ).catch(() => null);

    // 2. Real-time socket event
    emitToUser(p.user_id, 'notification', {
      id: notif?.id,
      title: 'New Chat Message',
      message: `${senderName}: "${truncate(snippet, 80)}" in "${roomTitle}"`,
      type: 'chat',
      roomId: message.room_id,
      createdAt: notif?.created_at || new Date().toISOString(),
    });

    // 3. Email notification with secure login redirect
    if (email) {
      sendChatMessageEmail({
        email,
        recipientName,
        senderName,
        senderRole: p.role || 'User',
        roomName: roomTitle,
        messageSnippet: snippet,
        roomId: message.room_id,
      }).catch((err) => console.error('[Chat Notification] Email error:', err.message));
    }
  }
};

export const notifyTicketCreated = async (ticket, createdByUserId) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'New Ticket';
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    if (admin.id === createdByUserId) continue;
    const notif = await notificationRepo.createNotification(
      admin.id,
      'New Ticket Created',
      `Ticket ${ref} "${truncate(ticket.title, 60)}" has been submitted.`,
      'ticket',
      ticket.id
    );
    emitToUser(admin.id, 'notification', {
      id: notif?.id,
      title: 'New Ticket Created',
      message: `Ticket ${ref} has been submitted.`,
      type: 'ticket',
      ticketId: ticket.id,
      createdAt: notif?.created_at || new Date().toISOString(),
    });
  }

  // Ensure external ticket notification reaches the created system email (demshuterefe94@gmail.com)
  sendNewTicketAdminAlert({
    ticket,
    submitterName: 'External Submitter',
    submitterEmail: '',
  }).catch(() => {});

  broadcastTicketEvent(ticket.id, 'ticket:created', { ticketId: ticket.id, referenceNumber: ref, title: ticket.title });
};

export const notifyTenantTicketCreated = async (ticket, tenantUserId) => {
  if (!tenantUserId) return;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Your ticket';
  const title = 'Ticket Submitted Successfully';
  const message = `Your ticket ${ref} "${truncate(ticket.title, 60)}" has been submitted and is being processed.`;
  await dispatchNotification({
    userId: tenantUserId,
    title,
    message,
    type: 'ticket',
    ticketId: ticket.id,
    extraPayload: { referenceNumber: ref },
    sendEmailFn: async (u) => {
      sendTicketCreatedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket: {
          referenceNumber: ref,
          trackNumber: ticket.track_number || ticket.trackNumber || '',
          title: ticket.title,
          priority: ticket.priority,
          response_due_date: ticket.response_due_date || ticket.responseDueDate,
          due_date: ticket.due_date || ticket.dueDate,
        },
      }).catch(() => {});
    },
  });
};

export const notifyTicketAssigned = async (ticket, assignedUserId, assignedByUserId) => {
  if (assignedUserId === assignedByUserId) return;
  const actualUserId = (await resolveUserId(assignedUserId)) || assignedUserId;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const notif = await notificationRepo.createNotification(
    actualUserId,
    'Ticket Assigned to You',
    `You have been assigned ticket ${ref} "${truncate(ticket.title, 60)}".`,
    'assignment',
    ticket.id
  );
  emitToUser(actualUserId, 'notification', {
    id: notif?.id,
    title: 'Ticket Assigned to You',
    message: `Ticket ${ref} has been assigned to you.`,
    type: 'assignment',
    ticketId: ticket.id,
    ticketReferenceNumber: ref,
    ticketNum: ticket.ticket_num || ticket.ticketNum,
    createdAt: notif?.created_at || new Date().toISOString(),
  });

  const [userRows] = await pool.query(
    'SELECT email, first_name FROM users WHERE id = :id LIMIT 1',
    { id: actualUserId }
  );
  if (userRows.length) {
    sendTicketAssignedEmail({
      email: userRows[0].email,
      firstName: userRows[0].first_name,
      ticket: {
        reference_number: ref,
        title: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
      },
    }).catch(() => { });
  }
};

export const notifyTicketAssignedToDepartment = async (ticket, departmentId) => {
  const actualDeptId = (await resolveDepartmentId(departmentId)) || departmentId;
  const [managers] = await pool.query(
    `SELECT DISTINCT u.id, u.email, u.first_name FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = :actualDeptId
     WHERE (ud.department_id = :actualDeptId OR d.head_user_id = u.id)
       AND r.name = 'manager' AND u.status = 'active'`,
    { actualDeptId }
  );
  for (const mgr of managers) {
    const notif = await notificationRepo.createNotification(
      mgr.id,
      'Ticket Assigned to Department',
      `Ticket ${ticket.reference_number || ticket.referenceNumber} "${truncate(ticket.title, 60)}" has been assigned to your department.`,
      'assignment',
      ticket.id
    );
    emitToUser(mgr.id, 'notification', {
      id: notif?.id,
      title: 'Ticket Assigned to Department',
      message: `Ticket ${ticket.reference_number || ticket.referenceNumber} has been assigned to your department.`,
      type: 'assignment',
      ticketId: ticket.id,
      ticketReferenceNumber: ticket.reference_number || ticket.referenceNumber,
      ticketNum: ticket.ticket_num || ticket.ticketNum,
      createdAt: notif?.created_at || new Date().toISOString(),
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
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const recipients = new Set();
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;

  if (creatorId && creatorId !== changedByUserId) recipients.add(creatorId);
  if (assignedToId && assignedToId !== changedByUserId) recipients.add(assignedToId);

  const users = await getTargetedUsers(Array.from(recipients));
  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Status Updated',
      message: `Ticket ${ref} status changed to ${toStatus}.`,
      type: 'status',
      ticketId: ticket.id,
      extraPayload: { toStatus, referenceNumber: ref },
      sendEmailFn: async (u) => {
        sendTicketStatusEmail({
          email: u.email,
          firstName: u.firstName,
          ticket,
          fromStatus: ticket.status,
          toStatus,
          notes: ticket.notes,
        });
      },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:status', { ticketId: ticket.id, status: toStatus });
};

export const notifyTicketResolved = async (ticket) => {
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  await dispatchNotification({
    userId: creatorId,
    title: 'Ticket Resolved',
    message: `Ticket ${ref} "${truncate(ticket.title, 60)}" has been marked as resolved.`,
    type: 'status',
    ticketId: ticket.id,
    sendEmailFn: async (u) => {
      sendTicketResolvedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
      });
    },
  });
  broadcastTicketEvent(ticket.id, 'ticket:resolved', { ticketId: ticket.id, status: 'resolved' });
};

export const notifyTicketApproved = async (ticket, adminResolutionNote = '') => {
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const message = adminResolutionNote
    ? `Your ticket ${ref} has been approved and resolved. Note: ${truncate(adminResolutionNote, 120)}`
    : `Your ticket ${ref} "${truncate(ticket.title, 60)}" has been approved and resolved.`;

  await dispatchNotification({
    userId: creatorId,
    title: 'Ticket Approved & Resolved',
    message,
    type: 'status',
    ticketId: ticket.id,
    sendEmailFn: async (u) => {
      sendTicketApprovedEmail(ticket, adminResolutionNote);
      sendTicketResolvedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket: {
          ...ticket,
          reference_number: ref,
          title: ticket.title,
          notes: adminResolutionNote,
        },
      });
    },
  });
};

export const notifyTicketClosed = async (ticket) => {
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  await dispatchNotification({
    userId: creatorId,
    title: 'Ticket Closed',
    message: `Ticket ${ref} "${truncate(ticket.title, 60)}" has been closed.`,
    type: 'status',
    ticketId: ticket.id,
    sendEmailFn: async (u) => {
      sendTicketClosedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
      });
    },
  });
  broadcastTicketEvent(ticket.id, 'ticket:closed', { ticketId: ticket.id, status: 'closed' });
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
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  const recipients = new Set(accessibleUserIds);
  if (creatorId) recipients.add(creatorId);
  recipients.delete(escalatedBy);

  const users = await getTargetedUsers(Array.from(recipients));
  for (const user of users) {
    const isCreator = user.id === creatorId;
    const message = isCreator
      ? `Ticket ${ref} has been escalated for urgent attention.${notes ? ` Reason: ${notes}` : ''}`
      : `Ticket ${ref} "${truncate(ticket.title, 50)}" was escalated.${notes ? ` Reason: ${notes}` : ''}`;

    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Escalated',
      message,
      type: 'escalation',
      ticketId: ticket.id,
      sendEmailFn: async (u) => {
        sendTicketEscalatedEmail(ticket, notes);
      },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:escalated', { ticketId: ticket.id, status: 'escalated', isEscalated: true });
};

export const notifyTicketCompleted = async (ticket, completedBy, slaAchieved = false, resolutionMinutes = null) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const slaText = slaAchieved
    ? 'The ticket was completed within the SLA deadline.'
    : 'The ticket was completed after the SLA deadline.';
  const durationText = resolutionMinutes
    ? ` Total resolution time: ${Math.floor(resolutionMinutes / 60)}h ${resolutionMinutes % 60}m.`
    : '';

  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  const recipients = new Set(accessibleUserIds);
  if (creatorId) recipients.add(creatorId);
  recipients.delete(completedBy);

  const users = await getTargetedUsers(Array.from(recipients));
  for (const user of users) {
    const isCreator = user.id === creatorId;
    const message = isCreator
      ? `Ticket ${ref} has been marked completed. ${slaText}${durationText}`
      : `Ticket ${ref} has been marked completed by a team member. ${slaText}${durationText}`;

    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Completed',
      message,
      type: 'completion',
      ticketId: ticket.id,
      sendEmailFn: async (u) => {
        sendTicketCompletedEmail(ticket);
      },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:completed', { ticketId: ticket.id, status: 'completed' });
};

export const notifyTicketAccepted = async (ticket, acceptedBy) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const accessibleUserIds = await getTicketAccessibleUserIds(ticket);
  const recipients = new Set(accessibleUserIds);
  if (creatorId) recipients.add(creatorId);
  if (assignedToId) recipients.add(assignedToId);
  recipients.delete(acceptedBy);

  const users = await getTargetedUsers(Array.from(recipients));
  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Assignment Accepted',
      message: `Ticket ${ref} assignment has been accepted.`,
      type: 'assignment',
      ticketId: ticket.id,
      sendEmailFn: async (u) => {
        sendTicketAcceptedEmail(ticket, acceptedBy);
      },
    });
  }
};

export const notifyTicketRejected = async (ticket, rejectedBy, reason) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  const recipients = new Set([...admins.map((a) => a.id)]);
  if (creatorId) recipients.add(creatorId);
  recipients.delete(rejectedBy);

  const reasonText = reason ? ` Reason: ${truncate(reason, 120)}.` : '';
  const users = await getTargetedUsers(Array.from(recipients));
  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Assignment Rejected',
      message: `Ticket ${ref} assignment was rejected.${reasonText}`,
      type: 'assignment',
      ticketId: ticket.id,
      sendEmailFn: async (u) => {
        sendTicketRejectedEmail(ticket, rejectedBy, reason);
      },
    });
  }
};

export const notifyTicketReopened = async (ticket, reopenedBy, notes) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  const recipients = new Set();
  if (creatorId && creatorId !== reopenedBy) recipients.add(creatorId);
  if (assignedToId && assignedToId !== reopenedBy) recipients.add(assignedToId);

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
  const message = `Ticket ${ref} has been reopened.${reasonText}`;
  const users = await getTargetedUsers(Array.from(recipients));

  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Reopened',
      message,
      type: 'reopen',
      ticketId: ticket.id,
      sendEmailFn: async (u) => {
        sendTicketReopenedEmail(ticket);
      },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:reopened', { ticketId: ticket.id, status: 'reopened' });
};

export const notifyTicketReopenRequested = async (ticket, requestedBy, reason) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const departmentId = ticket.department_id || ticket.departmentId || ticket.auto_department_id || ticket.autoDepartmentId;
  const recipients = new Set();

  // 1. All Active Admins
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  ).catch(() => [[]]);
  for (const a of (admins || [])) {
    if (a.id !== requestedBy) recipients.add(a.id);
  }

  // 2. Department Managers of ticket's department
  if (departmentId) {
    const [managers] = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    ).catch(() => [[]]);
    for (const m of (managers || [])) {
      if (m.id !== requestedBy) recipients.add(m.id);
    }
  }

  const reasonPreview = reason ? ` Reason: ${truncate(reason, 120)}` : '';
  const message = `Tenant requested reopening for closed ticket ${ref}.${reasonPreview}`;
  const users = await getTargetedUsers(Array.from(recipients));

  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Reopening Requested',
      message,
      type: 'reopen_request',
      ticketId: ticket.id,
      extraPayload: { referenceNumber: ref, reason },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:reopen_requested', { ticketId: ticket.id, referenceNumber: ref, reason });
};

export const notifyTicketReopenRejected = async (ticket, rejectedBy, notes) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;

  const notesPreview = notes ? ` Reason: ${truncate(notes, 120)}` : '';
  const message = `Your request to reopen ticket ${ref} was declined.${notesPreview}`;
  const users = await getTargetedUsers([creatorId]);

  for (const user of users) {
    await dispatchNotification({
      userId: user.id,
      title: 'Ticket Reopening Declined',
      message,
      type: 'reopen_declined',
      ticketId: ticket.id,
      extraPayload: { referenceNumber: ref, notes },
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:reopen_declined', { ticketId: ticket.id, referenceNumber: ref, notes });
};

export const notifyTicketMerged = async (ticket, count, notes) => {
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  await dispatchNotification({
    userId: creatorId,
    title: 'Tickets Merged',
    message: `${count} duplicate ticket(s) were merged into ${ref}.`,
    type: 'merge',
    ticketId: ticket.id,
    sendEmailFn: async (u) => {
      sendTicketMergedEmail(ticket, count);
    },
  });
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


/**
 * notifyStaffReminder(ticket, staffUser, managerUser, notes)
 * Sends an assignment reminder to the assigned staff member via:
 * 1. In-app notification alert
 * 2. Real-time web socket event
 * 3. Registered profile email
 */
export const notifyStaffReminder = async (ticket, staffUser, managerUser, notes = '') => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const managerName = [managerUser?.first_name || managerUser?.firstName, managerUser?.last_name || managerUser?.lastName]
    .filter(Boolean)
    .join(' ') || 'Department Manager';
  const title = `Task Reminder: Ticket ${ref}`;
  const notesText = notes ? ` Note: "${truncate(notes, 100)}"` : '';
  const message = `Department Manager ${managerName} sent a reminder regarding ticket ${ref} "${truncate(ticket.title, 50)}". Please review and proceed with resolution.${notesText}`;

  await dispatchNotification({
    userId: staffUser.id,
    title,
    message,
    type: 'assignment',
    ticketId: ticket.id,
    extraPayload: { isReminder: true, notes },
    sendEmailFn: (u) => sendTicketReminderEmail({
      email: u.email,
      firstName: u.firstName,
      ticket,
      senderName: managerName,
      notes,
    }),
  });

  emitToTicket(ticket.id, 'ticket:reminder', {
    ticketId: ticket.id,
    staffId: staffUser.id,
    managerName,
    notes,
  });
};

export const notifyTicketReassigned = async (ticket, toRole, reason) => {
  const creatorId = ticket.created_by || ticket.createdBy;
  if (!creatorId) return;
  const ref = ticket.referenceNumber || ticket.reference_number || 'Ticket';
  const title = 'Ticket Reassigned';
  const message = `Ticket ${ref} was returned to ${toRole}.`;
  await dispatchNotification({
    userId: creatorId,
    title,
    message,
    type: 'assignment',
    ticketId: ticket.id,
    extraPayload: { toRole, reason },
    sendEmailFn: (u) => sendTicketStatusEmail({
      email: u.email,
      firstName: u.firstName,
      ticket,
      oldStatus: ticket.status,
      newStatus: `Returned to ${toRole}`,
    }),
  });
};

export const notifySLABreached = async (ticket, breachType) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const titleMap = {
    response: 'Response SLA Breached',
    escalation: 'Escalation SLA Triggered',
    resolution: 'Resolution SLA Overdue',
  };
  const messageMap = {
    response: `Response SLA for ticket ${ref} "${truncate(ticket.title, 60)}" has been breached.`,
    escalation: `Escalation SLA triggered for ticket ${ref} "${truncate(ticket.title, 60)}". Ticket escalated.`,
    resolution: `Resolution SLA for ticket ${ref} "${truncate(ticket.title, 60)}" is overdue.`,
  };
  const title = titleMap[breachType] || 'SLA Breached';
  const message = messageMap[breachType] || 'SLA deadline breached.';

  const userIds = new Set();
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  if (breachType === 'escalation') {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
    );
    for (const a of admins) userIds.add(a.id);
    if (creatorId) userIds.add(creatorId);
  } else {
    if (assignedToId) userIds.add(assignedToId);
    if (creatorId) userIds.add(creatorId);
  }

  if (departmentId) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    for (const mgr of managers) userIds.add(mgr.id);
  }

  const targetedUsers = await getTargetedUsers(Array.from(userIds));
  for (const user of targetedUsers) {
    await dispatchNotification({
      userId: user.id,
      title,
      message,
      type: 'sla',
      ticketId: ticket.id,
      extraPayload: { breachType },
      sendEmailFn: (u) => sendSLABreachedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
        breachType,
      }),
    });
  }

  emitToTicket(ticket.id, 'sla:breached', { ticketId: ticket.id, breachType, title, message });
};

export const notifySLANearDeadline = async (ticket, breachType, remainingHours) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const titleMap = {
    response: 'Response SLA Approaching',
    escalation: 'Escalation SLA Approaching',
    resolution: 'Resolution SLA Approaching',
  };
  const messageMap = {
    response: `Response SLA for ticket ${ref} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
    escalation: `Escalation SLA for ticket ${ref} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
    resolution: `Resolution SLA for ticket ${ref} "${truncate(ticket.title, 60)}" will breach in approximately ${remainingHours} hour(s).`,
  };
  const title = titleMap[breachType] || 'SLA Approaching';
  const message = messageMap[breachType] || 'SLA deadline approaching.';

  const userIds = new Set();
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  if (assignedToId) userIds.add(assignedToId);
  if (creatorId) userIds.add(creatorId);

  if (departmentId) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    for (const mgr of managers) userIds.add(mgr.id);
  }

  const targetedUsers = await getTargetedUsers(Array.from(userIds));
  for (const user of targetedUsers) {
    await dispatchNotification({
      userId: user.id,
      title,
      message,
      type: 'sla',
      ticketId: ticket.id,
      extraPayload: { remainingHours, breachType },
      sendEmailFn: (u) => sendSLANearDeadlineEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
        breachType,
        remainingHours,
      }),
    });
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
  let query = `SELECT DISTINCT u.id, u.email, u.first_name, t.email AS tenant_email
               FROM users u 
               JOIN roles r ON r.id = u.role_id 
               LEFT JOIN tenants t ON t.id = u.tenant_id
               WHERE r.name = 'manager' AND u.status = 'active' AND u.id != :submittedBy`;
  let params = { submittedBy: submittedByUser.id };

  if (article.department_id) {
    query = `SELECT DISTINCT u.id, u.email, u.first_name, t.email AS tenant_email
             FROM users u 
             JOIN roles r ON r.id = u.role_id 
             JOIN user_departments ud ON ud.user_id = u.id
             LEFT JOIN tenants t ON t.id = u.tenant_id
             WHERE r.name = 'manager' AND ud.department_id = :deptId AND u.status = 'active' AND u.id != :submittedBy`;
    params = { submittedBy: submittedByUser.id, deptId: article.department_id };
  }

  const [managers] = await pool.query(query, params);
  const submitterName = [submittedByUser.first_name, submittedByUser.last_name].filter(Boolean).join(' ') || submittedByUser.first_name || 'Staff Member';

  for (const mgr of managers) {
    await notificationRepo.createNotification(
      mgr.id,
      'Staff Article Submitted for Approval',
      `Staff member ${submitterName} submitted article "${truncate(article.title, 80)}" (${article.article_reference || ''}) for your department review.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    ).catch(() => {});

    emitToUser(mgr.id, 'notification', {
      title: 'Staff Article Submitted for Approval',
      message: `"${truncate(article.title, 60)}" requires your department review and approval.`,
      type: 'knowledge',
      articleId: article.id,
    });

    const email = (mgr.email && mgr.email.trim()) || (mgr.tenant_email && mgr.tenant_email.trim());
    if (email) {
      sendKnowledgeSubmittedEmail({
        email,
        firstName: mgr.first_name || 'Manager',
        article,
        submittedByName: submitterName,
      }).catch(() => {});
    }
  }
};

export const notifyKnowledgeApproved = async (article, approvedByUser) => {
  const approverName = [approvedByUser.first_name, approvedByUser.last_name].filter(Boolean).join(' ') || approvedByUser.first_name || 'Department Manager';

  // 1. Notify Staff author
  if (article.author_id && article.author_id !== approvedByUser.id) {
    const author = await getTargetedUser(article.author_id);
    if (author) {
      await notificationRepo.createNotification(
        author.id,
        'Article Approved by Department Manager',
        `Your article "${truncate(article.title, 80)}" (${article.article_reference || ''}) has been approved by ${approverName} and is pending Admin publishment.`,
        'knowledge',
        null,
        null,
        null,
        article.id
      ).catch(() => {});

      emitToUser(author.id, 'notification', {
        title: 'Article Approved by Department Manager',
        message: `"${truncate(article.title, 60)}" was approved by your department manager and is pending Admin publishment.`,
        type: 'knowledge',
        articleId: article.id,
      });

      if (author.email) {
        sendKnowledgeApprovedEmail({
          email: author.email,
          firstName: author.firstName,
          article,
          approvedByName: approverName,
          targetRole: 'staff',
        }).catch(() => {});
      }
    }
  }

  // 2. Notify all Admins to publish the article
  const [admins] = await pool.query(
    `SELECT u.id, u.email, u.first_name, t.email AS tenant_email
     FROM users u 
     JOIN roles r ON r.id = u.role_id 
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE r.name = 'admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    await notificationRepo.createNotification(
      admin.id,
      'Article Approved — Ready to Publish',
      `Article "${truncate(article.title, 80)}" (${article.article_reference || ''}) was approved by ${approverName} and is ready for Admin to publish.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    ).catch(() => {});

    emitToUser(admin.id, 'notification', {
      title: 'Article Approved — Ready to Publish',
      message: `"${truncate(article.title, 60)}" was approved by department manager and is ready to publish.`,
      type: 'knowledge_approved',
      articleId: article.id,
    });

    const email = (admin.email && admin.email.trim()) || (admin.tenant_email && admin.tenant_email.trim());
    if (email) {
      sendKnowledgeApprovedEmail({
        email,
        firstName: admin.first_name || 'Admin',
        article,
        approvedByName: approverName,
        targetRole: 'admin',
      }).catch(() => {});
    }
  }
};

export const notifyKnowledgeRejected = async (article, rejectedByUser, reason) => {
  if (article.author_id && article.author_id !== rejectedByUser.id) {
    const author = await getTargetedUser(article.author_id);
    const reviewerName = [rejectedByUser.first_name, rejectedByUser.last_name].filter(Boolean).join(' ') || rejectedByUser.first_name || 'Reviewer';

    await notificationRepo.createNotification(
      article.author_id,
      'Article Rejected',
      `Your article "${truncate(article.title, 80)}" was rejected. Reason: ${truncate(reason || 'No reason provided', 120)}`,
      'knowledge',
      null,
      null,
      null,
      article.id
    ).catch(() => {});

    emitToUser(article.author_id, 'notification', {
      title: 'Article Rejected',
      message: `"${truncate(article.title, 60)}" was rejected.`,
      type: 'knowledge',
      articleId: article.id,
    });

    if (author?.email) {
      sendKnowledgeStatusEmail({
        email: author.email,
        firstName: author.firstName,
        article,
        status: 'rejected',
        reason,
        reviewerName,
      }).catch(() => {});
    }
  }
};

export const notifyKnowledgeRevisionRequested = async (article, requestedByUser, reason) => {
  if (article.author_id && article.author_id !== requestedByUser.id) {
    const author = await getTargetedUser(article.author_id);
    const reviewerName = [requestedByUser.first_name, requestedByUser.last_name].filter(Boolean).join(' ') || requestedByUser.first_name || 'Reviewer';

    await notificationRepo.createNotification(
      article.author_id,
      'Article Revision Requested',
      `Your article "${truncate(article.title, 80)}" needs revision. ${truncate(reason || '', 120)}`,
      'knowledge',
      null,
      null,
      null,
      article.id
    ).catch(() => {});

    emitToUser(article.author_id, 'notification', {
      title: 'Article Revision Requested',
      message: `"${truncate(article.title, 60)}" needs revision.`,
      type: 'knowledge',
      articleId: article.id,
    });

    if (author?.email) {
      sendKnowledgeStatusEmail({
        email: author.email,
        firstName: author.firstName,
        article,
        status: 'revision_requested',
        reason,
        reviewerName,
      }).catch(() => {});
    }
  }
};

export const notifyKnowledgePublished = async (article, publishedByUser) => {
  const publisherName = [publishedByUser.first_name, publishedByUser.last_name].filter(Boolean).join(' ') || publishedByUser.first_name || 'Administrator';

  const [users] = await pool.query(
    `SELECT u.id, u.email, u.first_name, t.email AS tenant_email
     FROM users u 
     JOIN roles r ON r.id = u.role_id 
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE r.name IN ('admin','manager','staff','tenant','ceo') AND u.status = 'active' AND u.id != :publishedBy`,
    { publishedBy: publishedByUser.id }
  );

  for (const u of users) {
    await notificationRepo.createNotification(
      u.id,
      'New Knowledge Article Published',
      `Article "${truncate(article.title, 80)}" (${article.article_reference || ''}) has been published.`,
      'knowledge',
      null,
      null,
      null,
      article.id
    ).catch(() => {});

    emitToUser(u.id, 'notification', {
      title: 'New Knowledge Article Published',
      message: `"${truncate(article.title, 60)}" is now live.`,
      type: 'knowledge',
      articleId: article.id,
    });

    const email = (u.email && u.email.trim()) || (u.tenant_email && u.tenant_email.trim());
    if (email) {
      sendKnowledgePublishedEmail({
        email,
        firstName: u.first_name || 'User',
        article,
        publishedByName: publisherName,
      }).catch(() => {});
    }
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
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const departmentId = ticket.department_id || ticket.departmentId;
  if (departmentId) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    const targetedMgrs = await getTargetedUsers(managers.map((m) => m.id));
    const title = 'Staff Resolution Pending Manager Approval';
    const message = `Ticket ${ref} "${truncate(ticket.title, 50)}" was resolved by staff and requires your review/approval.`;
    for (const mgr of targetedMgrs) {
      await dispatchNotification({
        userId: mgr.id,
        title,
        message,
        type: 'status',
        ticketId: ticket.id,
        sendEmailFn: (u) => sendTicketStatusEmail({
          email: u.email,
          firstName: u.firstName,
          ticket,
          oldStatus: ticket.status,
          newStatus: 'under_review',
        }),
      });
    }
  }
  broadcastTicketEvent(ticket.id, 'ticket:under_review', { ticketId: ticket.id, status: 'under_review' });
};

export const notifyManagerApprovedResolution = async (ticket, managerUserId, notes = '') => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const [admins] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  );
  const targetedAdmins = await getTargetedUsers(admins.map((a) => a.id));
  const title = 'Resolution Pending Admin Verification';
  const message = `Department manager approved resolution for ticket ${ref}. Awaiting admin verification.`;
  for (const adm of targetedAdmins) {
    await dispatchNotification({
      userId: adm.id,
      title,
      message,
      type: 'status',
      ticketId: ticket.id,
      sendEmailFn: (u) => sendTicketStatusEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
        oldStatus: ticket.status,
        newStatus: 'pending_approval',
      }),
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:pending_approval', { ticketId: ticket.id, status: 'pending_approval' });
};

export const notifyAdminVerifiedResolution = async (ticket, adminUserId, notes = '') => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const creatorId = ticket.created_by || ticket.createdBy;
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  // 1. Notify Tenant that ticket is resolved and waiting for tenant's verification
  if (creatorId) {
    const title = 'Ticket Resolved - Your Confirmation Needed';
    const message = `Your ticket ${ref} "${truncate(ticket.title, 50)}" has been resolved. Please confirm whether your issue is solved.`;
    await dispatchNotification({
      userId: creatorId,
      title,
      message,
      type: 'status',
      ticketId: ticket.id,
      sendEmailFn: (u) => sendTicketResolvedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket: {
          reference_number: ref,
          title: ticket.title,
          notes,
        },
      }),
    });
  }

  // 2. Notify assigned staff and department manager
  const recipients = new Set();
  if (assignedToId && assignedToId !== adminUserId) recipients.add(assignedToId);
  if (departmentId) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    for (const m of mgrs) {
      if (m.id !== adminUserId) recipients.add(m.id);
    }
  }
  const targetedStaff = await getTargetedUsers(Array.from(recipients));
  const staffTitle = 'Ticket Resolution Verified by Admin';
  const staffMsg = `Admin verified resolution for ticket ${ref}. Routed to tenant for confirmation.`;
  for (const staff of targetedStaff) {
    await dispatchNotification({
      userId: staff.id,
      title: staffTitle,
      message: staffMsg,
      type: 'status',
      ticketId: ticket.id,
      sendEmailFn: (u) => sendTicketStatusEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
        oldStatus: ticket.status,
        newStatus: 'waiting_tenant',
      }),
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:waiting_tenant', { ticketId: ticket.id, status: 'waiting_tenant' });
};

export const notifyTenantConfirmedResolution = async (ticket, tenantUserId, rating, feedback) => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  const recipients = new Set();
  if (assignedToId) recipients.add(assignedToId);
  if (departmentId) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    for (const m of mgrs) recipients.add(m.id);
  }
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  );
  for (const a of admins) recipients.add(a.id);
  recipients.delete(tenantUserId);

  const targetedUsers = await getTargetedUsers(Array.from(recipients));
  const title = 'Ticket Confirmed Solved by Tenant';
  const message = `Tenant confirmed ticket ${ref} is solved! Rated: ${rating || 5}/5. Status marked as Completed.`;
  for (const user of targetedUsers) {
    await dispatchNotification({
      userId: user.id,
      title,
      message,
      type: 'completion',
      ticketId: ticket.id,
      sendEmailFn: (u) => sendTicketCompletedEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
      }),
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:completed', { ticketId: ticket.id, status: 'completed' });
};

export const notifyReworkRequested = async (ticket, requestedByUserId, reason, targetAudience = 'all') => {
  const ref = ticket.reference_number || ticket.referenceNumber || 'Ticket';
  const assignedToId = ticket.assigned_to || ticket.assignedTo;
  const departmentId = ticket.department_id || ticket.departmentId;

  const recipients = new Set();
  if (assignedToId && assignedToId !== requestedByUserId) recipients.add(assignedToId);
  if (departmentId) {
    const [mgrs] = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_departments ud ON ud.user_id = u.id
       JOIN roles r ON r.id = u.role_id
       WHERE ud.department_id = :departmentId AND r.name = 'manager' AND u.status = 'active'`,
      { departmentId }
    );
    for (const m of mgrs) {
      if (m.id !== requestedByUserId) recipients.add(m.id);
    }
  }

  const targetedUsers = await getTargetedUsers(Array.from(recipients));
  const title = 'Ticket Rework Requested';
  const message = `Ticket ${ref} returned to In Progress for rework. Reason: ${truncate(reason || 'Rework requested', 100)}`;
  for (const user of targetedUsers) {
    await dispatchNotification({
      userId: user.id,
      title,
      message,
      type: 'status',
      ticketId: ticket.id,
      sendEmailFn: (u) => sendTicketStatusEmail({
        email: u.email,
        firstName: u.firstName,
        ticket,
        oldStatus: ticket.status,
        newStatus: 'in_progress',
      }),
    });
  }
  broadcastTicketEvent(ticket.id, 'ticket:in_progress', { ticketId: ticket.id, status: 'in_progress' });
};



/**
 * Notify admins when a tenant or user submits feedback.
 */
export const notifyFeedbackSubmitted = async (feedback, submitterUser) => {
  const submitterName = submitterUser?.first_name ? `${submitterUser.first_name} ${submitterUser.last_name || ''}`.trim() : (submitterUser?.username || 'User');
  const [admins] = await pool.query(
    `SELECT u.id, u.email, u.first_name, t.email AS tenant_email
     FROM users u 
     JOIN roles r ON r.id = u.role_id 
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE r.name IN ('admin', 'ceo') AND u.status = 'active'`
  );

  for (const admin of admins) {
    await notificationRepo.createNotification(
      admin.id,
      'New Feedback Received',
      `Feedback from ${submitterName}: "${truncate(feedback.subject, 60)}" (Rating: ${feedback.rating || 'N/A'}/5)`,
      'feedback',
      feedback.ticket_id || null
    ).catch(() => {});

    emitToUser(admin.id, 'notification', {
      title: 'New Feedback Received',
      message: `Feedback from ${submitterName}: "${truncate(feedback.subject, 50)}"`,
      type: 'feedback',
      feedbackId: feedback.id,
    });

    const email = (admin.email && admin.email.trim()) || (admin.tenant_email && admin.tenant_email.trim());
    if (email) {
      sendFeedbackAlertEmail({
        adminEmail: email,
        feedback,
        submitterName,
        submitterEmail: submitterUser?.email || '',
      }).catch(() => {});
    }
  }
};

/**
 * Notify tenant/user when admin responds to their feedback.
 */
export const notifyFeedbackResponded = async (feedback, responseMessage, responderUser) => {
  if (!feedback.tenant_id) return;
  const responderName = responderUser?.first_name ? `${responderUser.first_name} ${responderUser.last_name || ''}`.trim() : 'HDMS Administration';

  const [tenantUsers] = await pool.query(
    `SELECT u.id, u.email, u.first_name, t.email AS tenant_email, t.contact_person
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.tenant_id = :tenantId AND u.status = 'active'`,
    { tenantId: feedback.tenant_id }
  );

  for (const tu of tenantUsers) {
    await notificationRepo.createNotification(
      tu.id,
      'Feedback Response from Administration',
      `Administration responded to your feedback regarding "${truncate(feedback.subject, 60)}".`,
      'feedback',
      feedback.ticket_id || null
    ).catch(() => {});

    emitToUser(tu.id, 'notification', {
      title: 'Feedback Response from Administration',
      message: `Administration responded to your feedback regarding "${truncate(feedback.subject, 50)}".`,
      type: 'feedback',
      feedbackId: feedback.id,
    });

    const email = (tu.email && tu.email.trim()) || (tu.tenant_email && tu.tenant_email.trim());
    if (email) {
      sendFeedbackResponseEmail({
        email,
        recipientName: tu.contact_person || tu.first_name || 'Valued User',
        feedback,
        responseMessage,
        responderName,
      }).catch(() => {});
    }
  }
};


/**
 * Notify Department Manager when Admin assigns feedback to their department.
 */
export const notifyFeedbackAssignedToDepartment = async (feedback, departmentId, adminDirective, adminUser, departmentHeadId = null) => {
  const adminName = adminUser?.first_name ? `${adminUser.first_name} ${adminUser.last_name || ''}`.trim() : (adminUser?.username || 'System Administrator');
  
  // Find department name
  const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [departmentId]);
  const departmentName = deptRows[0]?.name || 'Department';

  // Find targeted department head/manager or all managers of department
  let managers = [];
  if (departmentHeadId) {
    const [headRows] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.status = 'active'`,
      [departmentHeadId]
    );
    if (headRows.length) {
      managers = headRows;
    }
  }

  if (!managers.length) {
    const [deptManagers] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN user_departments ud ON ud.user_id = u.id
       WHERE ud.department_id = ? AND r.name = 'manager' AND u.status = 'active'`,
      [departmentId]
    );
    managers = deptManagers;
  }

  const feedbackRef = feedback.feedbackNum || feedback.feedback_num || feedback.id;

  for (const mgr of managers) {
    const mgrName = `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim() || 'Department Head';
    await notificationRepo.createNotification(
      mgr.id,
      'Feedback Assigned to Department',
      `Feedback #${feedbackRef} "${truncate(feedback.subject, 50)}" was assigned to you as Department Head for action.`,
      'feedback',
      feedback.ticket_id || null
    ).catch(() => {});

    emitToUser(mgr.id, 'notification', {
      title: 'Feedback Assigned to Department',
      message: `Feedback #${feedbackRef} "${truncate(feedback.subject, 50)}" was assigned to your department.`,
      type: 'feedback',
      feedbackId: feedback.id,
    });

    if (mgr.email) {
      sendFeedbackDepartmentAssignedEmail({
        email: mgr.email,
        managerName: mgrName,
        departmentName,
        feedback,
        adminDirective,
        adminName,
      }).catch((e) => console.error('Failed to send manager feedback email:', e.message));
    }
  }
};

/**
 * Notify Staff member(s) when Department Manager (or Admin) shares feedback with them (one by one or general department-wide).
 */
export const notifyFeedbackAssignedToStaff = async (feedback, staffUserIds, departmentNotes, managerUser, options = {}) => {
  const managerName = managerUser?.first_name ? `${managerUser.first_name} ${managerUser.last_name || ''}`.trim() : (managerUser?.username || 'Department Manager');
  const { assignmentScope = 'specific_staff', departmentId = null } = options;

  let staffRows = [];
  if (assignmentScope === 'department_general' && departmentId) {
    const [deptStaff] = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, d.name AS department_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN user_departments ud ON ud.user_id = u.id
       LEFT JOIN departments d ON d.id = ud.department_id
       WHERE ud.department_id = ? AND u.status = 'active' AND r.name IN ('staff', 'manager')`,
      [departmentId]
    );
    staffRows = deptStaff;
  } else {
    const ids = (Array.isArray(staffUserIds) ? staffUserIds : [staffUserIds]).filter(Boolean);
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    const [selectedStaff] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name,
              (SELECT d2.name FROM user_departments ud2 JOIN departments d2 ON d2.id = ud2.department_id WHERE ud2.user_id = u.id LIMIT 1) AS department_name
       FROM users u
       WHERE u.id IN (${placeholders}) AND u.status = 'active'`,
      ids
    );
    staffRows = selectedStaff;
  }

  if (!staffRows.length) return;
  const feedbackRef = feedback.feedbackNum || feedback.feedback_num || feedback.id;
  const scopeLabel = assignmentScope === 'department_general' ? 'shared with your department team' : 'shared with you';

  for (const staff of staffRows) {
    const staffName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Team Member';
    const departmentName = staff.department_name || feedback.departmentName || 'Department';

    await notificationRepo.createNotification(
      staff.id,
      'Tenant Feedback Shared with You',
      `Feedback #${feedbackRef} "${truncate(feedback.subject, 50)}" was ${scopeLabel} by ${managerName}.`,
      'feedback',
      feedback.ticket_id || feedback.ticketId || null
    ).catch(() => {});

    emitToUser(staff.id, 'notification', {
      title: 'Tenant Feedback Shared with You',
      message: `Feedback #${feedbackRef} "${truncate(feedback.subject, 50)}" was ${scopeLabel}.`,
      type: 'feedback',
      feedbackId: feedback.id,
    });

    if (staff.email) {
      sendFeedbackStaffAssignedEmail({
        email: staff.email,
        staffName,
        departmentName,
        feedback,
        departmentNotes,
        managerName,
      }).catch((e) => console.error('Failed to send staff feedback email:', e.message));
    }
  }
};
