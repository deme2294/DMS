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
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId AND read_at IS NULL',
      { userId }
    );
    return rows[0]?.total || 0;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return 0;
    throw err;
  }
};

export const getNotifications = async (userId, { limit = 20, offset = 0, unreadOnly = false } = {}) => {
  try {
    const unreadClause = unreadOnly ? ' AND n.read_at IS NULL' : '';
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.message, n.type, 
              n.ticket_id AS ticketId, 
              t.reference_number AS ticketReferenceNumber,
              t.ticket_num AS ticketNum,
              n.notice_id AS noticeId, 
              n.room_id AS roomId, 
              CASE WHEN kb.id IS NOT NULL AND kb.deleted_at IS NULL THEN n.article_id ELSE NULL END AS articleId,
              n.read_at AS readAt, 
              n.created_at AS createdAt
       FROM notifications n
       LEFT JOIN tickets t ON t.id = n.ticket_id
       LEFT JOIN knowledge_base kb ON kb.id = n.article_id
       WHERE n.user_id = :userId ${unreadClause}
       ORDER BY n.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { userId, limit: Number(limit), offset: Number(offset) }
    );
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      try {
        const unreadClause = unreadOnly ? ' AND n.read_at IS NULL' : '';
        const [rows] = await pool.query(
          `SELECT n.id, n.title, n.message, n.type, 
                  n.ticket_id AS ticketId, 
                  n.notice_id AS noticeId, 
                  n.room_id AS roomId, 
                  NULL AS articleId,
                  n.read_at AS readAt, 
                  n.created_at AS createdAt
           FROM notifications n
           WHERE n.user_id = :userId ${unreadClause}
           ORDER BY n.created_at DESC
           LIMIT :limit OFFSET :offset`,
          { userId, limit: Number(limit), offset: Number(offset) }
        );
        return rows;
      } catch (fallbackErr) {
        if (fallbackErr.code === 'ER_NO_SUCH_TABLE') return [];
        throw fallbackErr;
      }
    }
    throw err;
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
