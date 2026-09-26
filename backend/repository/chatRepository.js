import pool from '../config/db.js';

// ===================== CHAT ROOMS =====================

export const findRoomById = async (roomId) => {
  const [rows] = await pool.query(
    `SELECT cr.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name
     FROM chat_rooms cr
     LEFT JOIN users u ON u.id = cr.created_by
     WHERE cr.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

export const findRoomsByUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT cr.*, 
       u.first_name AS creator_first_name, 
       u.last_name AS creator_last_name,
       d.name AS department_name,
       t.reference_number AS ticket_reference,
       t.title AS ticket_title,
       other_u.first_name AS other_user_first_name,
       other_u.last_name AS other_user_last_name,
       other_u.username AS other_user_username,
       other_u.id AS other_user_id,
       other_r.name AS other_user_role,
       COALESCE(other_uos.is_online, FALSE) AS other_user_online,
       other_uos.last_seen AS other_user_last_seen,
       (SELECT COUNT(DISTINCT cp_sub.user_id) 
        FROM chat_participants cp_sub 
        INNER JOIN user_online_status uos_sub ON uos_sub.user_id = cp_sub.user_id 
        WHERE cp_sub.room_id = cr.id AND cp_sub.is_active = TRUE AND uos_sub.is_online = TRUE) AS online_members_count,
       (SELECT COUNT(DISTINCT cp_sub2.user_id) 
        FROM chat_participants cp_sub2 
        WHERE cp_sub2.room_id = cr.id AND cp_sub2.is_active = TRUE) AS total_members_count,
       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room_id = cr.id AND cm.is_deleted = FALSE) AS message_count,
       (SELECT cm2.message FROM chat_messages cm2 WHERE cm2.room_id = cr.id AND cm2.is_deleted = FALSE ORDER BY cm2.created_at DESC LIMIT 1) AS last_message,
       (SELECT cm2.created_at FROM chat_messages cm2 WHERE cm2.room_id = cr.id AND cm2.is_deleted = FALSE ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_at,
       (SELECT COUNT(*) FROM chat_messages cm3 
        LEFT JOIN message_read_status mrs ON mrs.message_id = cm3.id AND mrs.user_id = ?
        WHERE cm3.room_id = cr.id AND cm3.sender_id != ? AND cm3.is_deleted = FALSE 
        AND mrs.id IS NULL) AS unread_count
     FROM chat_rooms cr
     INNER JOIN chat_participants cp ON cp.room_id = cr.id
     LEFT JOIN chat_participants cp_other ON cp_other.room_id = cr.id AND cp_other.user_id != ? AND cr.room_type = 'direct'
     LEFT JOIN users other_u ON other_u.id = cp_other.user_id
     LEFT JOIN roles other_r ON other_r.id = other_u.role_id
     LEFT JOIN user_online_status other_uos ON other_uos.user_id = other_u.id
     LEFT JOIN users u ON u.id = cr.created_by
     LEFT JOIN departments d ON d.id = cr.department_id
     LEFT JOIN tickets t ON t.id = cr.ticket_id
     WHERE cp.user_id = ? AND cp.is_active = TRUE
     GROUP BY cr.id
     ORDER BY CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END, last_message_at DESC, cr.created_at DESC`,
    [userId, userId, userId, userId]
  );
  return rows;
};

export const getDepartmentMembersWithStatus = async (departmentId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.email,
            r.name AS role, 
            COALESCE(uos.is_online, FALSE) AS is_online, 
            uos.last_seen
     FROM users u
     INNER JOIN user_departments ud ON ud.user_id = u.id
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     WHERE ud.department_id = ? AND u.status = 'active'
     ORDER BY is_online DESC, u.first_name, u.last_name`,
    [departmentId]
  );
  return rows;
};

export const getTicketMembersWithStatus = async (ticketId) => {
  const [ticketRows] = await pool.query(`SELECT created_by, assigned_to, department_id FROM tickets WHERE id = ? LIMIT 1`, [ticketId]);
  if (!ticketRows || ticketRows.length === 0) return [];
  const ticket = ticketRows[0];

  const [rows] = await pool.query(
    `SELECT DISTINCT u.id, u.first_name, u.last_name, u.username, u.email,
            r.name AS role, 
            COALESCE(uos.is_online, FALSE) AS is_online, 
            uos.last_seen,
            CASE 
              WHEN u.id = ? THEN 'Creator'
              WHEN u.id = ? THEN 'Assigned Agent'
              ELSE 'Department Staff'
            END AS ticket_role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     WHERE (u.id = ? OR (u.id = ? AND ? IS NOT NULL) OR (ud.department_id = ? AND ? IS NOT NULL))
       AND u.status = 'active'
     ORDER BY is_online DESC, u.first_name, u.last_name`,
    [
      ticket.created_by, ticket.assigned_to,
      ticket.created_by, ticket.assigned_to, ticket.assigned_to,
      ticket.department_id, ticket.department_id
    ]
  );
  return rows;
};

export const findRoomByTicket = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT * FROM chat_rooms WHERE room_type = 'ticket' AND ticket_id = ? LIMIT 1`,
    [ticketId]
  );
  return rows[0] || null;
};

export const findRoomByDepartment = async (departmentId) => {
  const [rows] = await pool.query(
    `SELECT * FROM chat_rooms WHERE room_type = 'department' AND department_id = ? LIMIT 1`,
    [departmentId]
  );
  return rows[0] || null;
};

export const findDirectRoom = async (user1Id, user2Id) => {
  const [rows] = await pool.query(
    `SELECT cr.* FROM chat_rooms cr
     INNER JOIN chat_participants cp1 ON cp1.room_id = cr.id AND cp1.user_id = ?
     INNER JOIN chat_participants cp2 ON cp2.room_id = cr.id AND cp2.user_id = ?
     WHERE cr.room_type = 'direct'
     LIMIT 1`,
    [user1Id, user2Id]
  );
  return rows[0] || null;
};

export const createRoom = async (room) => {
  const { id, roomType, ticketId, departmentId, name, createdBy } = room;
  await pool.query(
    `INSERT INTO chat_rooms (id, room_type, ticket_id, department_id, name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, roomType, ticketId, departmentId, name, createdBy]
  );
  return id;
};

export const updateRoom = async (roomId, fields) => {
  const updates = [];
  const values = [];
  
  Object.keys(fields).forEach(key => {
    updates.push(`${key} = ?`);
    values.push(fields[key]);
  });
  
  if (updates.length > 0) {
    values.push(roomId);
    await pool.query(
      `UPDATE chat_rooms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
  }
};

// ===================== PARTICIPANTS =====================

export const findParticipantsByRoom = async (roomId) => {
  const [rows] = await pool.query(
    `SELECT cp.*, u.first_name, u.last_name, u.email, u.username,
       r.name AS role_name,
       uos.is_online, uos.last_seen
     FROM chat_participants cp
     INNER JOIN users u ON u.id = cp.user_id
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_online_status uos ON uos.user_id = cp.user_id
     WHERE cp.room_id = ? AND cp.is_active = TRUE
     ORDER BY u.first_name, u.last_name`,
    [roomId]
  );
  return rows;
};

export const findParticipant = async (roomId, userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [roomId, userId]
  );
  return rows[0] || null;
};

export const addParticipant = async (participant) => {
  const { id, roomId, userId } = participant;
  const existing = await findParticipant(roomId, userId);
  if (existing) {
    if (!existing.is_active) {
      await pool.query(
        `UPDATE chat_participants SET is_active = TRUE, joined_at = NOW() WHERE id = ?`,
        [existing.id]
      );
    }
    return existing.id;
  }
  await pool.query(
    `INSERT INTO chat_participants (id, room_id, user_id, joined_at, is_active)
     VALUES (?, ?, ?, NOW(), TRUE)`,
    [id, roomId, userId]
  );
  return id;
};

export const updateParticipantLastSeen = async (roomId, userId) => {
  await pool.query(
    `UPDATE chat_participants SET last_seen = NOW() WHERE room_id = ? AND user_id = ?`,
    [roomId, userId]
  );
};

export const removeParticipant = async (roomId, userId) => {
  await pool.query(
    `UPDATE chat_participants SET is_active = FALSE WHERE room_id = ? AND user_id = ?`,
    [roomId, userId]
  );
};

// ===================== MESSAGES =====================

export const findMessagesByRoom = async (roomId, userId = null, limit = 50, offset = 0) => {
  const [rows] = await pool.query(
    `SELECT cm.*, 
       u.first_name, u.last_name, u.username,
       r.name AS role_name
     FROM chat_messages cm
     INNER JOIN users u ON u.id = cm.sender_id
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN chat_message_deletions cmd ON cmd.message_id = cm.id AND cmd.user_id = ?
     WHERE cm.room_id = ? AND cm.is_deleted = FALSE AND cmd.id IS NULL
     ORDER BY cm.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, roomId, limit, offset]
  );
  return rows.reverse(); // Return chronological order
};

export const findMessageById = async (messageId) => {
  const [rows] = await pool.query(
    `SELECT cm.*, u.first_name, u.last_name, u.username
     FROM chat_messages cm
     INNER JOIN users u ON u.id = cm.sender_id
     WHERE cm.id = ?
     LIMIT 1`,
    [messageId]
  );
  return rows[0] || null;
};

export const createMessage = async (message) => {
  const {
    id,
    roomId,
    senderId,
    messageType,
    message: text,
    attachmentPath,
    attachmentName,
    attachmentSize
  } = message;
  
  await pool.query(
    `INSERT INTO chat_messages (id, room_id, sender_id, message_type, message, attachment_path, attachment_name, attachment_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, roomId, senderId, messageType, text, attachmentPath, attachmentName, attachmentSize]
  );
  
  return id;
};

export const updateMessage = async (messageId, fields) => {
  const updates = [];
  const values = [];
  
  Object.keys(fields).forEach(key => {
    updates.push(`${key} = ?`);
    values.push(fields[key]);
  });
  
  if (updates.length > 0) {
    values.push(messageId);
    await pool.query(
      `UPDATE chat_messages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const softDeleteMessage = async (messageId) => {
  await pool.query(
    `UPDATE chat_messages SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?`,
    [messageId]
  );
};

export const deleteMessageForUser = async (messageId, userId) => {
  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  await pool.query(
    `INSERT IGNORE INTO chat_message_deletions (id, message_id, user_id, created_at)
     VALUES (?, ?, ?, NOW())`,
    [id, messageId, userId]
  );
  return { success: true };
};

// ===================== READ STATUS =====================

export const findReadStatusByMessage = async (messageId) => {
  const [rows] = await pool.query(
    `SELECT mrs.*, u.first_name, u.last_name
     FROM message_read_status mrs
     INNER JOIN users u ON u.id = mrs.user_id
     WHERE mrs.message_id = ?`,
    [messageId]
  );
  return rows;
};

export const createReadStatus = async (status) => {
  const { id, messageId, userId } = status;
  await pool.query(
    `INSERT IGNORE INTO message_read_status (id, message_id, user_id, read_at)
     VALUES (?, ?, ?, NULL)`,
    [id, messageId, userId]
  );
};

export const markAsRead = async (messageId, userId) => {
  // Insert a record to mark as read (presence of record = read)
  await pool.query(
    `INSERT IGNORE INTO message_read_status (id, message_id, user_id, read_at)
     VALUES (UUID(), ?, ?, NOW())`,
    [messageId, userId]
  );
};

export const getUnreadCount = async (roomId, userId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS unread_count
     FROM chat_messages cm
     LEFT JOIN message_read_status mrs ON mrs.message_id = cm.id AND mrs.user_id = ?
     WHERE cm.room_id = ? AND cm.sender_id != ? AND cm.is_deleted = FALSE
     AND mrs.id IS NULL`,
    [userId, roomId, userId]
  );
  return rows[0].unread_count || 0;
};

// ===================== TYPING INDICATORS =====================

export const setTypingIndicator = async (indicator) => {
  const { id, roomId, userId, isTyping } = indicator;
  await pool.query(
    `INSERT INTO typing_indicators (id, room_id, user_id, is_typing, started_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE is_typing = ?, started_at = NOW()`,
    [id, roomId, userId, isTyping, isTyping]
  );
};

export const removeTypingIndicator = async (roomId, userId) => {
  await pool.query(
    `DELETE FROM typing_indicators WHERE room_id = ? AND user_id = ?`,
    [roomId, userId]
  );
};

export const getTypingUsers = async (roomId) => {
  const [rows] = await pool.query(
    `SELECT ti.*, u.first_name, u.last_name
     FROM typing_indicators ti
     INNER JOIN users u ON u.id = ti.user_id
     WHERE ti.room_id = ? AND ti.is_typing = TRUE
     AND ti.started_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)`,
    [roomId]
  );
  return rows;
};

// ===================== ONLINE STATUS =====================

export const setUserOnlineStatus = async (userId, isOnline, socketId = null) => {
  const [existing] = await pool.query(
    `SELECT id FROM user_online_status WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  
  if (existing.length > 0) {
    await pool.query(
      `UPDATE user_online_status SET is_online = ?, last_seen = NOW(), socket_id = ?
       WHERE user_id = ?`,
      [isOnline, socketId, userId]
    );
  } else {
    const { v4: uuidv4 } = await import('uuid');
    await pool.query(
      `INSERT INTO user_online_status (id, user_id, is_online, last_seen, socket_id)
       VALUES (?, ?, ?, NOW(), ?)`,
      [uuidv4(), userId, isOnline, socketId]
    );
  }
};

export const getUserOnlineStatus = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM user_online_status WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

export const getOnlineUsers = async () => {
  const [rows] = await pool.query(
    `SELECT uos.*, u.first_name, u.last_name, u.username
     FROM user_online_status uos
     INNER JOIN users u ON u.id = uos.user_id
     WHERE uos.is_online = TRUE`
  );
  return rows;
};

// ===================== SEARCH =====================

export const searchMessages = async (userId, searchTerm, limit = 50) => {
  const [rows] = await pool.query(
    `SELECT cm.*, cr.name AS room_name, cr.room_type,
       u.first_name, u.last_name
     FROM chat_messages cm
     INNER JOIN chat_rooms cr ON cr.id = cm.room_id
     INNER JOIN chat_participants cp ON cp.room_id = cr.id AND cp.user_id = ?
     INNER JOIN users u ON u.id = cm.sender_id
     WHERE cm.message LIKE ? AND cm.is_deleted = FALSE
     ORDER BY cm.created_at DESC
     LIMIT ?`,
    [userId, `%${searchTerm}%`, limit]
  );
  return rows;
};
