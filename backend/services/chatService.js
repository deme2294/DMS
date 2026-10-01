import { v4 as uuidv4 } from 'uuid';
import * as chatRepo from '../repository/chatRepository.js';
import * as userRepo from '../repository/userRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import * as notificationRepo from '../repository/notificationRepository.js';
import * as notificationService from '../services/notificationService.js';
import { canContact } from '../config/contactMatrix.js';
import pool from '../config/db.js';
import { sendMeetingInvitationEmail } from './emailService.js';
import { emitToRoom, emitToUser, getIo } from './socketService.js';

// ===================== CHAT ROOMS =====================

export const getRoomById = async (roomId, userId) => {
  const room = await chatRepo.findRoomById(roomId);
  if (!room) {
    throw Object.assign(new Error('Chat room not found'), { statusCode: 404 });
  }
  
  // Check if user is participant
  const participant = await chatRepo.findParticipant(roomId, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  return room;
};

export const getUserRooms = async (userId) => {
  const rooms = await chatRepo.findRoomsByUser(userId);
  const seen = new Set();
  const uniqueRooms = [];
  for (const room of rooms) {
    if (!seen.has(room.id)) {
      seen.add(room.id);
      uniqueRooms.push(room);
    }
  }
  return uniqueRooms.map(room => {
    if (room.room_type === 'direct' && room.other_user_first_name) {
      const roleStr = room.other_user_role ? ` (${room.other_user_role})` : '';
      return {
        ...room,
        name: `${room.other_user_first_name} ${room.other_user_last_name || ''}${roleStr}`.trim(),
      };
    }
    return room;
  });
};

export const resolveDepartmentForTicket = async (ticket) => {
  if (ticket.department_id) {
    const [dept] = await pool.query(`SELECT * FROM departments WHERE id = ? LIMIT 1`, [ticket.department_id]);
    if (dept.length > 0) return dept[0];
  }
  
  if (ticket.category) {
    const [catRows] = await pool.query(
      `SELECT tc.department_id, d.id, d.name, d.code 
       FROM ticket_categories tc
       LEFT JOIN departments d ON d.id = tc.department_id
       WHERE (tc.name = ? OR tc.id = ?) AND tc.department_id IS NOT NULL
       LIMIT 1`,
      [ticket.category, ticket.category]
    );
    if (catRows.length > 0 && catRows[0].id) {
      return { id: catRows[0].id, name: catRows[0].name, code: catRows[0].code };
    }
  }

  // Fallback by category keyword
  const catLower = (ticket.category || '').toLowerCase();
  if (
    catLower.includes('hr') ||
    catLower.includes('human') ||
    catLower.includes('payroll') ||
    catLower.includes('leave') ||
    catLower.includes('benefit') ||
    catLower.includes('employee')
  ) {
    const [hrDepts] = await pool.query(`SELECT * FROM departments WHERE code = 'HR' OR name LIKE '%Human Resources%' LIMIT 1`);
    if (hrDepts.length > 0) return hrDepts[0];
  }

  // Default to IT Support
  const [itDepts] = await pool.query(`SELECT * FROM departments WHERE code = 'IT' OR name LIKE '%IT%' LIMIT 1`);
  if (itDepts.length > 0) return itDepts[0];

  const [anyDepts] = await pool.query(`SELECT * FROM departments WHERE status = 'active' LIMIT 1`);
  return anyDepts[0] || null;
};

export const createTicketRoom = async (ticketId, createdBy, timing = 'now', io = null) => {
  // Check if room already exists
  const existing = await chatRepo.findRoomByTicket(ticketId);
  if (existing) {
    return existing;
  }
  
  // Get ticket details
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) {
    throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  }

  // Resolve department based on ticket category / ticket department
  const resolvedDept = await resolveDepartmentForTicket(ticket);
  const departmentId = resolvedDept ? resolvedDept.id : null;

  // If ticket didn't have department_id, update ticket in database for consistency
  if (!ticket.department_id && departmentId) {
    try {
      await pool.query(
        `UPDATE tickets SET department_id = ?, auto_department_id = ? WHERE id = ?`,
        [departmentId, departmentId, ticketId]
      );
    } catch (updateErr) {
      console.warn('[createTicketRoom] Could not update ticket department_id:', updateErr.message);
    }
  }
  
  // Create room
  const roomId = uuidv4();
  await chatRepo.createRoom({
    id: roomId,
    roomType: 'ticket',
    ticketId,
    departmentId,
    name: `Ticket: ${ticket.reference_number || ticket.id.substring(0, 8)}`,
    createdBy,
  });
  
  // Add participants: creator, ticket creator, assigned agent
  const participants = new Set([ticket.created_by, createdBy]);
  if (ticket.assigned_to) participants.add(ticket.assigned_to);
  
  // If department exists, add all department staff and department managers to participants
  if (departmentId) {
    const [deptUsers] = await pool.query(
      `SELECT DISTINCT u.id, r.name AS role_name FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       INNER JOIN user_departments ud ON ud.user_id = u.id
       WHERE ud.department_id = ? AND u.status = 'active'`,
      [departmentId]
    );
    deptUsers.forEach((u) => participants.add(u.id));
  }

  // Also include system admins so they can oversee or assist
  const [admins] = await pool.query(
    `SELECT u.id FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  admins.forEach((a) => participants.add(a.id));
  
  // Add participants to room
  for (const userId of participants) {
    await chatRepo.addParticipant({
      id: uuidv4(),
      roomId,
      userId,
    });
  }

  // If timing is 'now', post initial routing system announcement
  if (timing === 'now') {
    const deptName = resolvedDept ? resolvedDept.name : 'Technical Support';
    const categoryName = ticket.category || 'General';
    const routingAnnouncement =
      `📢 [TICKET CHAT ROUTED TO ${deptName.toUpperCase()}]\n` +
      `Ticket #${ticket.reference_number || ticket.id.substring(0, 8)}: "${ticket.title}"\n` +
      `Category: ${categoryName} ➔ Department: ${deptName}\n` +
      `Department staff and managers are automatically connected for immediate support.`;

    try {
      const systemMsg = await chatRepo.createMessage({
        id: uuidv4(),
        roomId,
        senderId: createdBy,
        message: routingAnnouncement,
        messageType: 'system',
      });
      if (io && systemMsg) {
        io.to(`room:${roomId}`).emit('new-message', systemMsg);
      }
    } catch (msgErr) {
      console.warn('[createTicketRoom] Could not create initial routing message:', msgErr.message);
    }
  }

  const enrichedRoom = await getEnrichedRoomForUser(roomId, createdBy);

  // Broadcast to all participants via socket
  if (io) {
    for (const userId of participants) {
      io.to(`user:${userId}`).emit('ticket-room-created', enrichedRoom);
    }
  }

  return enrichedRoom;
};

export const createDepartmentRoom = async (departmentId, createdBy) => {
  // Check if room already exists
  const existing = await chatRepo.findRoomByDepartment(departmentId);
  if (existing) {
    return existing;
  }
  
  // Get department details
  const [dept] = await pool.query(
    `SELECT * FROM departments WHERE id = ? LIMIT 1`,
    [departmentId]
  );
  if (!dept || dept.length === 0) {
    throw Object.assign(new Error('Department not found'), { statusCode: 404 });
  }
  
  // Create room
  const roomId = uuidv4();
  await chatRepo.createRoom({
    id: roomId,
    roomType: 'department',
    ticketId: null,
    departmentId,
    name: `${dept[0].name} Department`,
    createdBy,
  });
  
  // Add all department members
  const [members] = await pool.query(
    `SELECT DISTINCT u.id FROM users u
     INNER JOIN user_departments ud ON ud.user_id = u.id
     WHERE ud.department_id = ? AND u.status = 'active'`,
    [departmentId]
  );
  
  for (const member of members) {
    await chatRepo.addParticipant({
      id: uuidv4(),
      roomId,
      userId: member.id,
    });
  }
  
  await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: createdBy });
  
  return chatRepo.findRoomById(roomId);
};

export const getEnrichedRoomForUser = async (roomId, userId) => {
  const rooms = await getUserRooms(userId);
  const found = rooms.find((r) => r.id === roomId);
  if (found) return found;
  return await chatRepo.findRoomById(roomId);
};

export const createDirectRoom = async (user1Id, user2Id, initiatorRole, initialMode = 'chat', io = null) => {
  let targetUser2Id = user2Id;
  // If target user is unspecified or 'admin', find the active registered admin
  if (!targetUser2Id || targetUser2Id === 'admin') {
    const [adminRows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.email, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'admin' AND u.status = 'active'
       ORDER BY u.created_at ASC
       LIMIT 1`
    );
    if (!adminRows || adminRows.length === 0) {
      throw Object.assign(new Error('Registered Admin user not found in system'), { statusCode: 404 });
    }
    targetUser2Id = adminRows[0].id;
  }

  console.log(`[createDirectRoom] Creating/opening room between ${user1Id} and ${targetUser2Id} (mode: ${initialMode})`);
  
  // Get both users
  const user1 = await userRepo.findById(user1Id);
  const user2 = await userRepo.findById(targetUser2Id);
  
  if (!user1 || !user2) {
    console.error(`[createDirectRoom] User not found: user1=${!!user1}, user2=${!!user2}`);
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  
  // Enforce role-based contact hierarchy
  if (!canContact(initiatorRole, user2.role)) {
    throw Object.assign(
      new Error(`You (${initiatorRole}) cannot start a direct conversation with a ${user2.role}`),
      { statusCode: 403 }
    );
  }

  let roomId;
  // If a direct room already exists, reuse it and ensure both users are active participants
  const existing = await chatRepo.findDirectRoom(user1Id, targetUser2Id);
  if (existing) {
    console.log(`[createDirectRoom] Existing direct room found:`, existing.id);
    roomId = existing.id;
    // Auto-accept & reactivate both registered users as active participants
    await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: user1Id });
    await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: targetUser2Id });
  } else {
    // Create new direct room
    roomId = uuidv4();
    await chatRepo.createRoom({
      id: roomId,
      roomType: 'direct',
      ticketId: null,
      departmentId: null,
      name: `${user1.first_name} & ${user2.first_name}`,
      createdBy: user1Id,
    });
    
    // Auto-accept both registered participants
    await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: user1Id });
    await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: targetUser2Id });
    console.log(`[createDirectRoom] Created new direct room: ${roomId}`);
  }

  const enrichedRoom = await getEnrichedRoomForUser(roomId, user1Id);

  // If initialMode is 'video', create conference message and alert recipient in real-time
  if (initialMode === 'video') {
    const meetingTitle = `Direct Video Call with ${user1.first_name} ${user1.last_name}`.trim();
    const meetingUrl = `https://meet.jit.si/dms-conf-${roomId.substring(0, 8)}`;
    const messageText = `🎥 [VIDEO_CONFERENCE]\nTitle: ${meetingTitle}\nLink: ${meetingUrl}\nInvited: ${user2.first_name} ${user2.last_name} (${user2.role})\nMode: Direct In-App Video Conference\nScreen Share: Enabled`;
    
    try {
      const createdMsg = await sendMessage(
        { roomId, message: messageText, messageType: 'text' },
        user1Id
      );
      if (io && createdMsg) {
        io.to(`room:${roomId}`).emit('new-message', createdMsg);
      }
    } catch (msgErr) {
      console.warn('[createDirectRoom] Could not save call invite message:', msgErr);
    }

    if (io) {
      io.to(`user:${targetUser2Id}`).emit('meeting-invite-received', {
        id: uuidv4(),
        senderId: user1Id,
        senderName: `${user1.first_name} ${user1.last_name}`.trim(),
        senderRole: user1.role,
        meetingTitle,
        meetingUrl,
        meetingType: 'dms_conference',
        roomId,
        customSettings: { screenShareEnabled: true },
        notes: 'Direct 1-on-1 In-App Video Conference',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Real-time update for recipient sidebar
  if (io) {
    try {
      const recipientRoom = await getEnrichedRoomForUser(roomId, targetUser2Id);
      if (recipientRoom) {
        io.to(`user:${targetUser2Id}`).emit('direct-room-created', recipientRoom);
      }
    } catch (socketErr) {
      console.warn('[createDirectRoom] Error notifying recipient socket:', socketErr);
    }
  }

  return enrichedRoom;
};

export const addParticipantToRoom = async (roomId, userId, addedBy) => {
  const room = await chatRepo.findRoomById(roomId);
  if (!room) {
    throw Object.assign(new Error('Chat room not found'), { statusCode: 404 });
  }
  
  // Check if already participant
  const existing = await chatRepo.findParticipant(roomId, userId);
  if (existing && existing.is_active) {
    return existing;
  }
  
  // Add participant
  await chatRepo.addParticipant({
    id: uuidv4(),
    roomId,
    userId,
  });
  
  return chatRepo.findParticipant(roomId, userId);
};

export const getRoomParticipants = async (roomId, userId) => {
  // Verify user is participant
  const participant = await chatRepo.findParticipant(roomId, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  return chatRepo.findParticipantsByRoom(roomId);
};

// ===================== MESSAGES =====================

export const getRoomMessages = async (roomId, userId, limit = 50, offset = 0) => {
  // Verify user is participant
  const participant = await chatRepo.findParticipant(roomId, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  // Update last seen
  await chatRepo.updateParticipantLastSeen(roomId, userId);
  
  return chatRepo.findMessagesByRoom(roomId, userId, limit, offset);
};

export const sendMessage = async (data, userId) => {
  const { roomId, message, messageType = 'text', attachmentPath, attachmentName, attachmentSize } = data;
  
  // Verify user is participant
  const participant = await chatRepo.findParticipant(roomId, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  // Create message
  const messageId = uuidv4();
  await chatRepo.createMessage({
    id: messageId,
    roomId,
    senderId: userId,
    messageType,
    message,
    attachmentPath,
    attachmentName,
    attachmentSize,
  });
  
  // Create read status for all participants except sender
  const participants = await chatRepo.findParticipantsByRoom(roomId);
  for (const p of participants) {
    if (p.user_id !== userId) {
      await chatRepo.createReadStatus({
        id: uuidv4(),
        messageId,
        userId: p.user_id,
      });
    }
  }
  
  // Update room timestamp
  await chatRepo.updateRoom(roomId, { updated_at: new Date() });
  
  // Notify other participants
  const [room] = await pool.query(`SELECT name FROM chat_rooms WHERE id = ? LIMIT 1`, [roomId]);
  const [sender] = await pool.query(`SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (room.length && sender.length) {
    const senderName = `${sender[0].first_name} ${sender[0].last_name}`;
    notificationService.notifyNewChatMessage({ room_id: roomId, sender_id: userId }, { name: room[0].name }, senderName).catch(() => {});
  }
  
  return chatRepo.findMessageById(messageId);
};

export const editMessage = async (messageId, newMessage, userId) => {
  const message = await chatRepo.findMessageById(messageId);
  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }
  
  // Only sender can edit
  if (message.sender_id !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  await chatRepo.updateMessage(messageId, {
    message: newMessage,
    is_edited: true,
    edited_at: new Date(),
  });
  
  return chatRepo.findMessageById(messageId);
};

export const deleteMessage = async (messageId, userId, deleteType = 'everyone') => {
  const message = await chatRepo.findMessageById(messageId);
  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }

  // Check if participant in room
  const participant = await chatRepo.findParticipant(message.room_id, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  // 1. Delete Only for Current User ("Delete for Me")
  if (deleteType === 'for_me') {
    await chatRepo.deleteMessageForUser(messageId, userId);
    return { success: true, messageId, roomId: message.room_id, deleteType: 'for_me' };
  }

  // 2. Delete for Everyone (Only the creator can delete for everyone)
  if (message.sender_id !== userId) {
    throw Object.assign(
      new Error('Access denied. Only the message creator can delete this message for everyone.'),
      { statusCode: 403 }
    );
  }

  await chatRepo.softDeleteMessage(messageId);

  // Real-time broadcast deletion to all participants in the room
  emitToRoom(message.room_id, 'message-deleted', {
    messageId,
    roomId: message.room_id,
    deletedBy: userId,
    deleteType: 'everyone',
  });

  return { success: true, messageId, roomId: message.room_id, deleteType: 'everyone' };
};

export const markMessagesAsRead = async (roomId, userId, messageIds = []) => {
  // Verify user is participant
  const participant = await chatRepo.findParticipant(roomId, userId);
  if (!participant) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  // If specific message IDs provided, mark those
  if (messageIds.length > 0) {
    for (const messageId of messageIds) {
      await chatRepo.markAsRead(messageId, userId);
    }
  } else {
    // Mark all unread messages in room (unread = no record in message_read_status)
    const [messages] = await pool.query(
      `SELECT cm.id FROM chat_messages cm
       LEFT JOIN message_read_status mrs ON mrs.message_id = cm.id AND mrs.user_id = ?
       WHERE cm.room_id = ? AND cm.sender_id != ? AND cm.is_deleted = FALSE
       AND mrs.id IS NULL`,
      [userId, roomId, userId]
    );
    
    for (const msg of messages) {
      await chatRepo.markAsRead(msg.id, userId);
    }
  }
  
  return { success: true };
};

export const getUnreadCount = async (userId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total_unread
     FROM chat_messages cm
     INNER JOIN chat_participants cp ON cp.room_id = cm.room_id AND cp.user_id = ?
     LEFT JOIN message_read_status mrs ON mrs.message_id = cm.id AND mrs.user_id = ?
     WHERE cm.sender_id != ? AND cm.is_deleted = FALSE
     AND mrs.id IS NULL`,
    [userId, userId, userId]
  );
  return rows[0].total_unread || 0;
};

// ===================== TYPING & ONLINE STATUS =====================

export const setTyping = async (roomId, userId, isTyping) => {
  if (isTyping) {
    await chatRepo.setTypingIndicator({
      id: uuidv4(),
      roomId,
      userId,
      isTyping: true,
    });
  } else {
    await chatRepo.removeTypingIndicator(roomId, userId);
  }
  
  return chatRepo.getTypingUsers(roomId);
};

export const setOnlineStatus = async (userId, isOnline, socketId = null) => {
  await chatRepo.setUserOnlineStatus(userId, isOnline, socketId);
  return chatRepo.getUserOnlineStatus(userId);
};

// ===================== SEARCH =====================

export const searchMessages = async (userId, searchTerm) => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }
  
  return chatRepo.searchMessages(userId, searchTerm.trim());
};

// ===================== ONLINE STATUS =====================

export const getUserOnlineStatus = async (userId) => {
  const status = await chatRepo.getUserOnlineStatus(userId);
  return status || { is_online: false, last_seen: null };
};

export const getOnlineUsers = async () => {
  return await chatRepo.getOnlineUsers();
};

export const getChatUsers = async (currentUserId, currentUserRole) => {
  // Get all users with online status
  const [users] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.tenant_id, 
            r.name as role, uos.is_online, uos.last_seen
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     WHERE u.id != ? AND u.status = 'active'
     ORDER BY u.first_name, u.last_name`,
    [currentUserId]
  );
  
  // All roles are filtered by the role-based contact hierarchy so that, e.g.,
  // the CEO never sees staff to contact directly, and staff/admin/tenant cannot
  // start a direct conversation with the CEO (they reach the CEO via a manager).
  // Staff are contactable only by their department manager; the only exception
  // is Admin, who may contact staff directly.
  return users.filter(u => canContact(currentUserRole, u.role));
};

export const getChatDepartments = async (currentUserId, currentUserRole) => {
  // Get all active departments
  const [departments] = await pool.query(
    `SELECT d.id, d.name, d.description, d.created_at,
            COUNT(DISTINCT ud.user_id) as member_count
     FROM departments d
     LEFT JOIN user_departments ud ON ud.department_id = d.id
     GROUP BY d.id, d.name, d.description, d.created_at
     ORDER BY d.name`
  );
  
  // All authenticated users can see all departments for chat purposes
  // (They can create department chat rooms to communicate with department members)
  return departments;
};

export const getDepartmentChatMembers = async (departmentId) => {
  return await chatRepo.getDepartmentMembersWithStatus(departmentId);
};

export const getTicketChatMembers = async (ticketId) => {
  return await chatRepo.getTicketMembersWithStatus(ticketId);
};

// ===================== VIDEO CALL & MEETING INVITATIONS =====================

/**
 * Get all active registered users across roles for Google Meet invitation selection
 */
export const getRegisteredContactsForMeeting = async (currentUserId) => {
  const [users] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.tenant_id,
            r.name as role, COALESCE(uos.is_online, 0) as is_online, uos.last_seen
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     WHERE u.id != ? AND u.status = 'active'
     ORDER BY u.first_name, u.last_name`,
    [currentUserId]
  );
  return users;
};

/**
 * Dispatch a Google Meet invitation:
 * - Validates recipient email exists as a registered user
 * - Stores meeting message in room
 * - Sends official email with direct join button to the registered user
 * - Broadcasts message via Socket.IO
 */
/**
 * Dispatch a customizable Video Conference / Google Meet invitation:
 * - Validates all recipients exist as active registered users in the DMS database
 * - Supports inviting individual users, multiple users, or entire user roles
 * - Stores meeting message in room
 * - Sends official email with direct join button to each registered user
 * - Broadcasts message via Socket.IO and emits direct real-time notification
 */
export const sendMeetingInvite = async (data, senderId, io = null) => {
  const {
    recipientEmail,
    recipientEmails,
    roles,
    meetingUrl,
    roomId,
    title,
    notes,
    meetingType = 'dms_conference',
    customSettings = {},
    scheduledTime,
    durationMinutes = 30,
  } = data;

  if (!meetingUrl || !meetingUrl.startsWith('http')) {
    throw Object.assign(new Error('A valid meeting URL is required (e.g. https://meet.jit.si/... or https://meet.google.com/...)'), { statusCode: 400 });
  }

  // 1. Gather all requested emails and roles
  const targetEmails = new Set();
  if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.trim()) {
    targetEmails.add(recipientEmail.trim().toLowerCase());
  }
  if (Array.isArray(recipientEmails)) {
    recipientEmails.forEach((em) => {
      if (em && typeof em === 'string' && em.trim()) {
        targetEmails.add(em.trim().toLowerCase());
      }
    });
  }

  // 2. If roles array provided, find all registered users in those roles
  if (Array.isArray(roles) && roles.length > 0) {
    const [roleUsers] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN (?) AND u.status = 'active' AND u.id != ?`,
      [roles, senderId]
    );
    roleUsers.forEach((u) => targetEmails.add(u.email.toLowerCase()));
  }

  if (targetEmails.size === 0) {
    throw Object.assign(new Error('Please select or specify at least one registered recipient or user role to invite'), { statusCode: 400 });
  }

  // 3. Get sender info
  const [senders] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [senderId]
  );
  if (!senders.length) {
    throw Object.assign(new Error('Sender not found'), { statusCode: 404 });
  }
  const sender = senders[0];

  // 4. Validate that all target recipients are active registered users in DMS
  const emailList = Array.from(targetEmails);
  const [recipients] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) IN (?) AND u.status = 'active'`,
    [emailList]
  );

  const foundEmailSet = new Set(recipients.map((r) => r.email.toLowerCase()));
  const unregistered = emailList.filter((em) => !foundEmailSet.has(em));
  if (unregistered.length > 0) {
    throw Object.assign(
      new Error(`The following emails are not active registered users in the system: ${unregistered.join(', ')}. Only registered users can be invited.`),
      { statusCode: 404 }
    );
  }

  // 5. Resolve target room
  let targetRoomId = roomId;
  let roomName = 'DMS Video Conference';

  if (targetRoomId) {
    const room = await chatRepo.findRoomById(targetRoomId);
    if (room) {
      roomName = room.name || 'Chat Room';
      // Ensure all invited recipients are added as participants
      for (const rec of recipients) {
        const isParticipant = await chatRepo.findParticipant(targetRoomId, rec.id);
        if (!isParticipant) {
          await chatRepo.addParticipant({ id: uuidv4(), roomId: targetRoomId, userId: rec.id }).catch(() => {});
        }
      }
    } else {
      targetRoomId = null;
    }
  }

  if (!targetRoomId) {
    if (recipients.length === 1) {
      const rec = recipients[0];
      const existing = await chatRepo.findDirectRoom(senderId, rec.id);
      if (existing) {
        targetRoomId = existing.id;
        roomName = existing.name || `${sender.first_name} & ${rec.first_name}`;
      } else {
        targetRoomId = uuidv4();
        roomName = `${sender.first_name} & ${rec.first_name}`;
        await chatRepo.createRoom({
          id: targetRoomId,
          roomType: 'direct',
          ticketId: null,
          departmentId: null,
          name: roomName,
          createdBy: senderId,
        });
        await chatRepo.addParticipant({ id: uuidv4(), roomId: targetRoomId, userId: senderId });
        await chatRepo.addParticipant({ id: uuidv4(), roomId: targetRoomId, userId: rec.id });
      }
    } else {
      // Create a dedicated group conference room for the invited registered participants
      targetRoomId = uuidv4();
      const rolesSummary = Array.from(new Set(recipients.map((r) => r.role))).join(', ');
      roomName = title?.trim() || `Conference (${rolesSummary})`;
      await chatRepo.createRoom({
        id: targetRoomId,
        roomType: 'direct',
        ticketId: null,
        departmentId: null,
        name: roomName,
        createdBy: senderId,
      });
      await chatRepo.addParticipant({ id: uuidv4(), roomId: targetRoomId, userId: senderId });
      for (const rec of recipients) {
        await chatRepo.addParticipant({ id: uuidv4(), roomId: targetRoomId, userId: rec.id }).catch(() => {});
      }
    }
  }

  // 6. Create formatted meeting message with rich metadata
  const meetingTitle = title?.trim() || 'DMS Video Conference & Screen Sharing';
  const isDmsConf = meetingType === 'dms_conference' || meetingUrl.includes('meet.jit.si') || meetingUrl.includes('8x8.vc');
  const tag = isDmsConf ? '[VIDEO_CONFERENCE]' : '[GOOGLE_MEET_CALL]';
  const recipientSummary = recipients.map((r) => `${r.first_name} ${r.last_name} (${r.role})`).join(', ');
  const rolesSummary = Array.from(new Set(recipients.map((r) => r.role))).join(', ');
  const isScreenShare = Boolean(
    customSettings?.screenShareEnabled ||
    meetingTitle.toLowerCase().includes('screen') ||
    notes?.toLowerCase().includes('screen')
  );

  const effectiveScheduledTime = scheduledTime || new Date().toISOString();
  let sessionDate = new Date(effectiveScheduledTime);
  if (isNaN(sessionDate.getTime())) {
    sessionDate = new Date();
  }

  const isTodaySession = new Date().toDateString() === sessionDate.toDateString();
  let formattedScheduledTime = '';
  try {
    formattedScheduledTime = sessionDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    formattedScheduledTime = String(sessionDate);
  }

  const dateDisplay = isTodaySession ? `Today (${formattedScheduledTime})` : formattedScheduledTime;
  const isScheduledForFuture = Boolean(sessionDate.getTime() - Date.now() > 5 * 60 * 1000);

  const createdTimeStr = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let meetingMessageText = `🎥 ${tag}\nTitle: ${meetingTitle}\nLink: ${meetingUrl}`;
  meetingMessageText += `\nEvent Time: ${sessionDate.toISOString()}`;
  meetingMessageText += `\nScheduled For: ${dateDisplay}`;
  meetingMessageText += `\nDuration: ${durationMinutes || 30} mins`;
  meetingMessageText += `\nStatus: ${isScheduledForFuture ? 'Scheduled' : 'Live / Ready'}`;
  meetingMessageText += `\nCreated: ${new Date().toISOString()}`;
  meetingMessageText += `\nInvited: ${recipientSummary}\nRoles: ${rolesSummary}`;
  if (isScreenShare) {
    meetingMessageText += '\nScreen Share: Enabled';
  }
  if (customSettings?.passcode) {
    meetingMessageText += `\nPasscode: ${customSettings.passcode}`;
  }
  if (notes) {
    meetingMessageText += `\nNotes: ${notes}`;
  }

  const message = await sendMessage(
    {
      roomId: targetRoomId,
      message: meetingMessageText,
      messageType: 'text',
    },
    senderId
  );

  // 7. Send personalized invitation email and create in-app web notifications for each registered recipient
  for (const rec of recipients) {
    // 7a. Web Application Notification
    const notifTitle = isScreenShare
      ? `🖥️ Screen Share & Video Event: ${meetingTitle}`
      : `📹 Video Conference: ${meetingTitle}`;
    const timeDisplay = dateDisplay;
    const notifMsg = `${sender.first_name} ${sender.last_name} (${sender.role}) invited you to a video & screen share session scheduled for ${timeDisplay}.`;

    await notificationRepo.createNotification(
      rec.id,
      notifTitle,
      notifMsg,
      'chat',
      null,
      null,
      targetRoomId
    ).catch((err) => console.error(`[sendMeetingInvite] In-app notification error for ${rec.email}:`, err));

    emitToUser(rec.id, 'notification', {
      title: notifTitle,
      message: notifMsg,
      type: 'chat',
      roomId: targetRoomId,
      scheduledTime: sessionDate.toISOString(),
      formattedScheduledTime: dateDisplay,
      isToday: isTodaySession,
      createdAt: new Date().toISOString(),
    });

    // 7b. Registered Email Dispatch
    sendMeetingInvitationEmail({
      recipientEmail: rec.email,
      recipientName: `${rec.first_name} ${rec.last_name || ''}`.trim(),
      senderName: `${sender.first_name} ${sender.last_name || ''}`.trim(),
      senderRole: sender.role,
      meetingUrl,
      meetingTitle,
      roomName,
      notes,
      webAppUrl: data.origin || '',
      scheduledTime: sessionDate.toISOString(),
      formattedScheduledTime: dateDisplay,
      createdTime: createdTimeStr,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
      isScreenShare,
    }).catch((err) => console.error(`[sendMeetingInvite] Email dispatch error to ${rec.email}:`, err));
  }

  // 8. Broadcast via Socket.IO: message to room and direct alert to recipients
  if (io) {
    io.to(`room:${targetRoomId}`).emit('new-message', message);

    // Direct real-time invitation notification to each online recipient
    for (const rec of recipients) {
      io.to(`user:${rec.id}`).emit('meeting-invite-received', {
        id: uuidv4(),
        senderId,
        senderName: `${sender.first_name} ${sender.last_name}`.trim(),
        senderRole: sender.role,
        meetingTitle,
        meetingUrl,
        meetingType,
        roomId: targetRoomId,
        customSettings,
        notes,
        scheduledTime: sessionDate.toISOString(),
        formattedScheduledTime: dateDisplay,
        isToday: isTodaySession,
        durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    success: true,
    message,
    roomId: targetRoomId,
    recipients,
    recipientCount: recipients.length,
    meetingUrl,
    meetingTitle,
    meetingType,
    scheduledTime: sessionDate.toISOString(),
    formattedScheduledTime: dateDisplay,
    isToday: isTodaySession,
  };
};

/**
 * Verify if current authenticated user is registered and authorized to access a meeting
 */
export const verifyMeetingAccess = async ({ meetingUrl, roomId, passcode, userId, userRole }) => {
  const [users] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.status = 'active' LIMIT 1`,
    [userId]
  );
  if (!users.length) {
    throw Object.assign(new Error('Unauthorized: User is not an active registered account in DMS'), { statusCode: 403 });
  }
  const user = users[0];

  return {
    authorized: true,
    user: {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      role: user.role,
    },
    meetingUrl,
  };
};

