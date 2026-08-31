import pool from '../config/db.js';

export const findByFeedback = async (officeFeedbackId) => {
  const [rows] = await pool.query(
    `SELECT ofr.*, u.first_name, u.last_name, u.email, u.username
     FROM office_feedback_replies ofr
     LEFT JOIN users u ON u.id = ofr.replied_by
     WHERE ofr.office_feedback_id = ?
     ORDER BY ofr.created_at ASC`,
    [officeFeedbackId]
  );
  return rows;
};

export const create = async (reply) => {
  const { id, officeFeedbackId, repliedBy, message } = reply;
  await pool.query(
    `INSERT INTO office_feedback_replies (id, office_feedback_id, replied_by, message, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [id, officeFeedbackId, repliedBy, message]
  );
  return id;
};

export const remove = async (id) => {
  await pool.query('DELETE FROM office_feedback_replies WHERE id = ?', [id]);
};
