import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const createNotification = async (userId, title, message, type = 'ticket', ticketId = null, noticeId = null, roomId = null, articleId = null) => {
  await pool.query(
    `INSERT INTO notifications (id, user_id, title, message, type, ticket_id, notice_id, room_id, article_id)
     VALUES (:id, :userId, :title, :message, :type, :ticketId, :noticeId, :roomId, :articleId)`,
    { id: uuidv4(), userId, title, message, type, ticketId: ticketId || null, noticeId: noticeId || null, roomId: roomId || null, articleId: articleId || null }
  );
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

export const getNotifications = async (userId, { limit = 20, offset = 0 } = {}) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.message, n.type, 
              n.ticket_id AS ticketId, 
              n.notice_id AS noticeId, 
              n.room_id AS roomId, 
              CASE WHEN kb.id IS NOT NULL AND kb.deleted_at IS NULL THEN n.article_id ELSE NULL END AS articleId,
              n.read_at AS readAt, 
              n.created_at AS createdAt
       FROM notifications n
       LEFT JOIN knowledge_base kb ON kb.id = n.article_id
       WHERE n.user_id = :userId
       ORDER BY n.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { userId, limit: Number(limit), offset: Number(offset) }
    );
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
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
