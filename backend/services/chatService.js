import { v4 as uuidv4 } from 'uuid';
import * as chatRepo from '../repository/chatRepository.js';
import * as userRepo from '../repository/userRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import * as notificationService from '../services/notificationService.js';
import pool from '../config/db.js';

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
  return rooms.map(room => {
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

export const createTicketRoom = async (ticketId, createdBy) => {
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
  
  // Create room
  const roomId = uuidv4();
  await chatRepo.createRoom({
    id: roomId,
    roomType: 'ticket',
    ticketId,
    departmentId: null,
    name: `Ticket: ${ticket.reference_number}`,
    createdBy,
  });
  
  // Add participants
  const participants = new Set([ticket.created_by, createdBy]);
  if (ticket.assigned_to) participants.add(ticket.assigned_to);
  
  // Get department manager if exists
  if (ticket.department_id) {
    const [managers] = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       INNER JOIN user_departments ud ON ud.user_id = u.id
       WHERE r.name = 'manager' AND ud.department_id = ? AND u.status = 'active'`,
      [ticket.department_id]
    );
    managers.forEach(m => participants.add(m.id));
  }
  
  // Add participants to room
  for (const userId of participants) {
    await chatRepo.addParticipant({
      id: uuidv4(),
      roomId,
      userId,
    });
  }
  
  return chatRepo.findRoomById(roomId);
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

export const createDirectRoom = async (user1Id, user2Id) => {
  console.log(`[createDirectRoom] Creating room between ${user1Id} and ${user2Id}`);
  
  // Check if room already exists
  const existing = await chatRepo.findDirectRoom(user1Id, user2Id);
  if (existing) {
    console.log(`[createDirectRoom] Room already exists:`, existing.id);
    return existing;
  }
  
  // Get both users
  console.log(`[createDirectRoom] Fetching users...`);
  const user1 = await userRepo.findById(user1Id);
  const user2 = await userRepo.findById(user2Id);
  
  if (!user1 || !user2) {
    console.error(`[createDirectRoom] User not found: user1=${!!user1}, user2=${!!user2}`);
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  
  console.log(`[createDirectRoom] Creating room for ${user1.first_name} & ${user2.first_name}`);
  
  // Create room
  const roomId = uuidv4();
  await chatRepo.createRoom({
    id: roomId,
    roomType: 'direct',
    ticketId: null,
    departmentId: null,
    name: `${user1.first_name} & ${user2.first_name}`,
    createdBy: user1Id,
  });
  
  // Add both participants
  await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: user1Id });
  await chatRepo.addParticipant({ id: uuidv4(), roomId, userId: user2Id });
  
  console.log(`[createDirectRoom] Room created successfully: ${roomId}`);
  return chatRepo.findRoomById(roomId);
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
  
  return chatRepo.findMessagesByRoom(roomId, limit, offset);
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

export const deleteMessage = async (messageId, userId) => {
  const message = await chatRepo.findMessageById(messageId);
  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }
  
  // Only sender can delete
  if (message.sender_id !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }
  
  await chatRepo.softDeleteMessage(messageId);
  
  return { success: true };
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
  
  // Filter based on role permissions
  if (currentUserRole === 'tenant') {
    // Tenants can only see staff, managers, and admins
    return users.filter(u => ['admin', 'manager', 'staff'].includes(u.role));
  }
  
  // All other roles can see everyone
  return users;
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

