import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const createNotification = async (userId, title, message, type = 'ticket', ticketId = null, noticeId = null, roomId = null, articleId = null) => {
  const id = uuidv4();
  const now = new Date();
  try {
    await pool.query(
      `INSERT INTO notifications (id, user_id, title, message, type, ticket_id, notice_id, room_id, article_id, created_at)
       VALUES (:id, :userId, :title, :message, :type, :ticketId, :noticeId, :roomId, :articleId, :now)`,
      { id, userId, title, message, type, ticketId: ticketId || null, noticeId: noticeId || null, roomId: roomId || null, articleId: articleId || null, now }
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054) {
      try {
        await pool.query(
          `INSERT INTO notifications (id, user_id, title, message, type, ticket_id, notice_id, room_id, created_at)
           VALUES (:id, :userId, :title, :message, :type, :ticketId, :noticeId, :roomId, :now)`,
          { id, userId, title, message, type, ticketId: ticketId || null, noticeId: noticeId || null, roomId: roomId || null, now }
        );
      } catch (innerErr) {
        if (innerErr.code === 'ER_BAD_FIELD_ERROR' || innerErr.errno === 1054) {
          await pool.query(
            `INSERT INTO notifications (id, user_id, title, message, type, ticket_id, created_at)
             VALUES (:id, :userId, :title, :message, :type, :ticketId, :now)`,
            { id, userId, title, message, type, ticketId: ticketId || null, now }
          );
        } else {
          throw innerErr;
        }
      }
    } else {
      throw err;
    }
  }

  return {
    id,
    user_id: userId,
    title,
    message,
    type,
    ticket_id: ticketId || null,
    notice_id: noticeId || null,
    room_id: roomId || null,
    article_id: articleId || null,
    read_at: null,
    created_at: now.toISOString(),
  };
};

export const getUnreadCount = async (userId) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       LEFT JOIN tickets t ON t.id = n.ticket_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE n.user_id = :userId 
         AND n.read_at IS NULL
         AND n.created_at >= u.created_at
         AND (
           n.ticket_id IS NULL
           OR n.type = 'chat'
           OR r.name IN ('admin', 'ceo')
           OR (r.name = 'tenant' AND (t.created_by = u.id OR (t.tenant_id IS NOT NULL AND t.tenant_id = u.tenant_id)))
           OR (r.name = 'staff' AND (t.assigned_to = u.id OR EXISTS (SELECT 1 FROM ticket_collaborators tc WHERE tc.ticket_id = t.id AND tc.user_id = u.id)))
           OR (r.name = 'manager' AND (
                t.department_id IN (SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = u.id)
                OR t.department_id IN (SELECT d.id FROM departments d WHERE d.head_user_id = u.id)
           ))
         )
         AND NOT (r.name = 'tenant' AND n.type IN ('sla', 'internal'))`,
      { userId }
    );
    return rows[0]?.total || 0;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return 0;
    try {
      const [fallbackRows] = await pool.query(
        `SELECT COUNT(*) AS total 
         FROM notifications n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE n.user_id = :userId 
           AND n.read_at IS NULL 
           AND n.created_at >= u.created_at
           AND NOT (r.name = 'tenant' AND n.type IN ('sla', 'internal'))`,
        { userId }
      );
      return fallbackRows[0]?.total || 0;
    } catch (_) {
      return 0;
    }
  }
};

export const getNotifications = async (userId, { limit = 20, offset = 0, unreadOnly = false } = {}) => {
  const safeLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
  const unreadClause = unreadOnly ? ' AND n.read_at IS NULL' : '';

  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.message, n.type, 
              n.ticket_id AS ticketId, 
              t.reference_number AS ticketReferenceNumber,
              n.notice_id AS noticeId, 
              n.room_id AS roomId, 
              n.article_id AS articleId,
              n.read_at AS readAt, 
              n.created_at AS createdAt
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       LEFT JOIN tickets t ON t.id = n.ticket_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE n.user_id = :userId ${unreadClause}
         AND n.created_at >= u.created_at
         AND (
           n.ticket_id IS NULL
           OR n.type = 'chat'
           OR r.name IN ('admin', 'ceo')
           OR (r.name = 'tenant' AND (t.created_by = u.id OR (t.tenant_id IS NOT NULL AND t.tenant_id = u.tenant_id)))
           OR (r.name = 'staff' AND (t.assigned_to = u.id OR EXISTS (SELECT 1 FROM ticket_collaborators tc WHERE tc.ticket_id = t.id AND tc.user_id = u.id)))
           OR (r.name = 'manager' AND (
                t.department_id IN (SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = u.id)
                OR t.department_id IN (SELECT d.id FROM departments d WHERE d.head_user_id = u.id)
           ))
         )
         AND NOT (r.name = 'tenant' AND n.type IN ('sla', 'internal'))
       ORDER BY n.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      { userId }
    );
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    try {
      const [rows] = await pool.query(
        `SELECT n.id, n.title, n.message, n.type, 
                n.ticket_id AS ticketId, 
                t.reference_number AS ticketReferenceNumber,
                n.read_at AS readAt, 
                n.created_at AS createdAt
         FROM notifications n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN tickets t ON t.id = n.ticket_id
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE n.user_id = :userId ${unreadClause}
           AND n.created_at >= u.created_at
           AND NOT (r.name = 'tenant' AND n.type IN ('sla', 'internal'))
         ORDER BY n.created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        { userId }
      );
      return rows;
    } catch (_) {
      return [];
    }
  }
};

export const markAsRead = async (id, userId) => {
  try {
    await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = :id AND user_id = :userId',
      { id, userId }
    );
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
};

export const markAllAsRead = async (userId) => {
  try {
    await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = :userId AND read_at IS NULL',
      { userId }
    );
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
};

export const deleteNotification = async (id, userId) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = :id AND user_id = :userId',
      { id, userId }
    );
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
};
