import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT notices.*,
            d.name AS department_name,
            u.first_name AS creator_first_name,
            u.last_name AS creator_last_name,
            u.username AS creator_username,
            assigned_user.first_name AS assigned_first_name,
            assigned_user.last_name AS assigned_last_name
     FROM notices
     LEFT JOIN departments d ON d.id = notices.department_id
     LEFT JOIN users u ON u.id = notices.created_by
     LEFT JOIN users assigned_user ON assigned_user.id = notices.assigned_to
     WHERE notices.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const findAll = async ({ search, status, priority, targetAudience, departmentId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (notices.title LIKE ? OR notices.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    where += ' AND notices.status = ?';
    params.push(status);
  }
  if (priority) {
    where += ' AND notices.priority = ?';
    params.push(priority);
  }
  if (targetAudience) {
    where += ' AND notices.target_audience = ?';
    params.push(targetAudience);
  }
  if (departmentId) {
    where += ' AND notices.department_id = ?';
    params.push(departmentId);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM notices ${where}`, params);
  const [rows] = await pool.query(
    `SELECT notices.*,
            d.name AS department_name,
            u.first_name AS creator_first_name,
            u.last_name AS creator_last_name,
            u.username AS creator_username,
            assigned_user.first_name AS assigned_first_name,
            assigned_user.last_name AS assigned_last_name,
            (SELECT COUNT(*) FROM notice_recipients nr WHERE nr.notice_id = notices.id) AS recipient_total,
            (SELECT COUNT(*) FROM notice_recipients nr WHERE nr.notice_id = notices.id AND nr.acknowledged_at IS NOT NULL) AS recipient_acknowledged
     FROM notices
     LEFT JOIN departments d ON d.id = notices.department_id
     LEFT JOIN users u ON u.id = notices.created_by
     LEFT JOIN users assigned_user ON assigned_user.id = notices.assigned_to
     ${where} ORDER BY notices.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

export const create = async (notice) => {
  const {
    id, title, description, image, attachment, attachmentName,
    priority, status, targetAudience, departmentId, assignedTo,
    assignedBy, creatorRole, expiresAt, createdBy
  } = notice;
  await pool.query(
    `INSERT INTO notices (
      id, title, description, image, attachment, attachment_name,
      priority, status, target_audience, department_id, assigned_to,
      assigned_by, creator_role, expires_at, created_by, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id, title, description, image ?? null, attachment ?? null, attachmentName ?? null,
      priority, status, targetAudience, departmentId ?? null, assignedTo ?? null,
      assignedBy ?? null, creatorRole ?? null, expiresAt ?? null, createdBy
    ]
  );
};

export const update = async (id, fields) => {
  const sets = [];
  const params = [];
  const fieldMapping = {
    targetAudience: 'target_audience',
    departmentId: 'department_id',
    assignedTo: 'assigned_to',
    assignedBy: 'assigned_by',
    expiresAt: 'expires_at',
    createdBy: 'created_by',
    creatorRole: 'creator_role',
    attachmentName: 'attachment_name'
  };

  Object.entries(fields).forEach(([key, value]) => {
    const dbKey = fieldMapping[key] || key;
    sets.push(`${dbKey} = ?`);
    params.push(value);
  });
  sets.push('updated_at = NOW()');
  params.push(id);
  await pool.query(`UPDATE notices SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM notices WHERE id = ?', [id]);
};

export const getActiveNotices = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM notices
     WHERE status = 'published'
       AND target_audience = 'all'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`
  );
  return rows;
};

export const getDistinctCategories = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT target_audience AS category FROM notices WHERE target_audience IS NOT NULL ORDER BY target_audience ASC`
  );
  return rows.map((r) => r.category);
};

// ── Recipients / acknowledgement / expiry ────────────────────────────────────

export const addRecipients = async (noticeId, userIds = []) => {
  if (!userIds.length) return;
  const values = userIds.map((userId) => [uuidv4(), noticeId, userId]);
  await pool.query(
    `INSERT IGNORE INTO notice_recipients (id, notice_id, user_id)
     VALUES ?`,
    [values]
  );
};

export const getRecipients = async (noticeId) => {
  const [rows] = await pool.query(
    `SELECT nr.id, nr.user_id, nr.acknowledged_at,
            u.first_name, u.last_name, u.email, u.username, r.name AS role
     FROM notice_recipients nr
     JOIN users u ON u.id = nr.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE nr.notice_id = :noticeId
     ORDER BY u.first_name ASC`,
    { noticeId }
  );
  return rows;
};

export const getRecipientCounts = async (noticeId) => {
  const [rows] = await pool.query(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS acknowledged
     FROM notice_recipients
     WHERE notice_id = :noticeId`,
    { noticeId }
  );
  const row = rows[0] || { total: 0, acknowledged: 0 };
  return { total: row.total || 0, acknowledged: row.acknowledged || 0 };
};

export const getUnacknowledgedRecipients = async (noticeId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.first_name
     FROM notice_recipients nr
     JOIN users u ON u.id = nr.user_id
     WHERE nr.notice_id = :noticeId AND nr.acknowledged_at IS NULL`,
    { noticeId }
  );
  return rows;
};

export const acknowledge = async (noticeId, userId) => {
  await pool.query(
    `INSERT INTO notice_recipients (id, notice_id, user_id, acknowledged_at)
     VALUES (:id, :noticeId, :userId, NOW())
     ON DUPLICATE KEY UPDATE acknowledged_at = NOW()`,
    { id: uuidv4(), noticeId, userId }
  );
};

export const getAcknowledgedNoticeIds = async (userId, noticeIds = []) => {
  if (!noticeIds.length) return [];
  const placeholders = noticeIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT notice_id FROM notice_recipients
     WHERE user_id = ? AND notice_id IN (${placeholders}) AND acknowledged_at IS NOT NULL`,
    [userId, ...noticeIds]
  );
  return rows.map((r) => r.notice_id);
};

export const getMyAcknowledgedNoticeIds = async (userId) => {
  const [rows] = await pool.query(
    `SELECT notice_id FROM notice_recipients
     WHERE user_id = :userId AND acknowledged_at IS NOT NULL`,
    { userId }
  );
  return rows.map((r) => r.notice_id);
};

export const setExpiryWarned = async (noticeId) => {
  await pool.query(
    'UPDATE notices SET expiry_warned = 1 WHERE id = :noticeId',
    { noticeId }
  );
};

export const archiveNotice = async (noticeId) => {
  await pool.query(
    "UPDATE notices SET status = 'archived', updated_at = NOW() WHERE id = :noticeId",
    { noticeId }
  );
};

export const findExpiringNotices = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM notices
     WHERE status = 'published'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
       AND expiry_warned = 0`
  );
  return rows;
};

export const archiveExpiredNotices = async () => {
  const [res] = await pool.query(
    `UPDATE notices
     SET status = 'archived', updated_at = NOW()
     WHERE status = 'published' AND expires_at IS NOT NULL AND expires_at <= NOW()`
  );
  return res.affectedRows || 0;
};

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED & TARGETED NOTICES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Find notices targeted to a specific user based on their role and department(s)
 */
export const findNoticesForUser = async (userId, userRole, userDepartmentIds = [], { page = 1, limit = 10, status } = {}) => {
  const offset = (page - 1) * limit;
  let where = `WHERE notices.status = 'published' AND (notices.expires_at IS NULL OR notices.expires_at > NOW())`;
  const params = [];

  const audienceConditions = [
    "notices.target_audience = 'all'",
    '(notices.target_audience = ? AND notices.department_id IS NULL)',
    'notices.assigned_to = ?',
    'EXISTS (SELECT 1 FROM notice_recipients nr WHERE nr.notice_id = notices.id AND nr.user_id = ?)',
    'notices.created_by = ?'
  ];
  params.push(userRole, userId, userId, userId);

  const deptIds = Array.isArray(userDepartmentIds) ? userDepartmentIds.filter(Boolean) : (userDepartmentIds ? [userDepartmentIds] : []);
  if (deptIds.length > 0) {
    const deptPlaceholders = deptIds.map(() => '?').join(',');
    audienceConditions.push(`(notices.target_audience = ? AND notices.department_id IN (${deptPlaceholders}))`);
    params.push(userRole, ...deptIds);
    audienceConditions.push(`(notices.target_audience = 'department' AND notices.department_id IN (${deptPlaceholders}))`);
    params.push(...deptIds);
  }

  where += ` AND (${audienceConditions.join(' OR ')})`;

  if (status) {
    where += ' AND notices.status = ?';
    params.push(status);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM notices ${where}`, params);
  
  const [rows] = await pool.query(
    `SELECT notices.*,
            u.first_name AS creator_first_name,
            u.last_name AS creator_last_name,
            d.name AS department_name,
            assigned_user.first_name AS assigned_first_name,
            assigned_user.last_name AS assigned_last_name,
            nr.acknowledged_at,
            CASE WHEN nr.acknowledged_at IS NOT NULL THEN 1 ELSE 0 END AS is_acknowledged
     FROM notices
     LEFT JOIN users u ON u.id = notices.created_by
     LEFT JOIN departments d ON d.id = notices.department_id
     LEFT JOIN users assigned_user ON assigned_user.id = notices.assigned_to
     LEFT JOIN notice_recipients nr ON nr.notice_id = notices.id AND nr.user_id = ?
     ${where}
     ORDER BY notices.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, ...params, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

/**
 * Find notices created by a specific user (for managers)
 */
export const findNoticesByCreator = async (creatorId, { page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM notices WHERE created_by = ?`,
    [creatorId]
  );
  
  const [rows] = await pool.query(
    `SELECT notices.*,
            d.name AS department_name,
            assigned_user.first_name AS assigned_first_name,
            assigned_user.last_name AS assigned_last_name,
            (SELECT COUNT(*) FROM notice_recipients nr WHERE nr.notice_id = notices.id) AS recipient_total,
            (SELECT COUNT(*) FROM notice_recipients nr WHERE nr.notice_id = notices.id AND nr.acknowledged_at IS NOT NULL) AS recipient_acknowledged,
            (SELECT COUNT(*) FROM notice_replies WHERE notice_id = notices.id) AS reply_count
     FROM notices
     LEFT JOIN departments d ON d.id = notices.department_id
     LEFT JOIN users assigned_user ON assigned_user.id = notices.assigned_to
     WHERE notices.created_by = ?
     ORDER BY notices.created_at DESC
     LIMIT ? OFFSET ?`,
    [creatorId, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
};

/**
 * Create notice with role and assignment tracking
 */
export const createTargetedNotice = async (notice) => {
  const {
    id,
    title,
    description,
    image,
    attachment,
    attachmentName,
    priority,
    status,
    targetAudience,
    departmentId,
    assignedTo,
    assignedBy,
    expiresAt,
    createdBy,
    creatorRole
  } = notice;

  await pool.query(
    `INSERT INTO notices (
      id, title, description, image, attachment, attachment_name,
      priority, status, target_audience, department_id, assigned_to,
      assigned_by, expires_at, created_by, creator_role,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      title,
      description,
      image ?? null,
      attachment ?? null,
      attachmentName ?? null,
      priority,
      status,
      targetAudience,
      departmentId ?? null,
      assignedTo ?? null,
      assignedBy ?? null,
      expiresAt ?? null,
      createdBy,
      creatorRole ?? null
    ]
  );

  return id;
};

/**
 * Update notice with assignment tracking
 */
export const updateTargetedNotice = async (id, fields) => {
  const sets = [];
  const params = [];
  
  const fieldMapping = {
    targetAudience: 'target_audience',
    departmentId: 'department_id',
    assignedTo: 'assigned_to',
    assignedBy: 'assigned_by',
    expiresAt: 'expires_at',
    createdBy: 'created_by',
    creatorRole: 'creator_role',
    attachmentName: 'attachment_name'
  };

  Object.entries(fields).forEach(([key, value]) => {
    const dbKey = fieldMapping[key] || key;
    sets.push(`${dbKey} = ?`);
    params.push(value);
  });

  sets.push('updated_at = NOW()');
  params.push(id);

  await pool.query(`UPDATE notices SET ${sets.join(', ')} WHERE id = ?`, params);
};

/**
 * Get staff members in a department for manager notice creation
 */
export const getStaffInDepartment = async (departmentId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.username, r.name AS role
     FROM user_departments ud
     JOIN users u ON u.id = ud.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE ud.department_id = ? AND r.name = 'staff' AND u.status = 'active'
     ORDER BY u.first_name ASC`,
    [departmentId]
  );
  return rows;
};

/**
 * Get notice with full details including creator and assignment info
 */
export const findByIdWithDetails = async (id) => {
  const [rows] = await pool.query(
    `SELECT notices.*,
            creator.first_name AS creator_first_name,
            creator.last_name AS creator_last_name,
            creator.email AS creator_email,
            creator_role_table.name AS creator_role_name,
            d.name AS department_name,
            assigned_user.first_name AS assigned_first_name,
            assigned_user.last_name AS assigned_last_name,
            assigned_user.email AS assigned_email,
            assigner.first_name AS assigner_first_name,
            assigner.last_name AS assigner_last_name
     FROM notices
     LEFT JOIN users creator ON creator.id = notices.created_by
     LEFT JOIN roles creator_role_table ON creator_role_table.id = creator.role_id
     LEFT JOIN departments d ON d.id = notices.department_id
     LEFT JOIN users assigned_user ON assigned_user.id = notices.assigned_to
     LEFT JOIN users assigner ON assigner.id = notices.assigned_by
     WHERE notices.id = ?
     LIMIT 1`,
    [id]
  );
  
  return rows[0] || null;
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTICE REPLIES
// ══════════════════════════════════════════════════════════════════════════════

export const createNoticeReply = async (reply) => {
  const { id, noticeId, userId, message, visibility, attachmentPath, attachmentName, attachmentSize } = reply;
  await pool.query(
    `INSERT INTO notice_replies (id, notice_id, user_id, message, visibility, attachment_path, attachment_name, attachment_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, noticeId, userId, message, visibility || 'all', attachmentPath ?? null, attachmentName ?? null, attachmentSize ?? null]
  );
  return id;
};

export const findRepliesByNotice = async (noticeId) => {
  const [rows] = await pool.query(
    `SELECT nr.id, nr.notice_id, nr.user_id, nr.message, nr.visibility,
            nr.attachment_path, nr.attachment_name, nr.attachment_size,
            nr.created_at, nr.updated_at,
            u.first_name, u.last_name, u.email, r.name AS role
     FROM notice_replies nr
     JOIN users u ON u.id = nr.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE nr.notice_id = ?
     ORDER BY nr.created_at ASC`,
    [noticeId]
  );
  return rows;
};

export const findReplyById = async (id) => {
  const [rows] = await pool.query(
    `SELECT nr.*, u.first_name, u.last_name, u.email, r.name AS role
     FROM notice_replies nr
     JOIN users u ON u.id = nr.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE nr.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const updateNoticeReply = async (id, message, visibility) => {
  const sets = ['message = ?', 'updated_at = NOW()'];
  const params = [message];
  if (visibility) {
    sets.push('visibility = ?');
    params.push(visibility);
  }
  params.push(id);
  await pool.query(`UPDATE notice_replies SET ${sets.join(', ')} WHERE id = ?`, params);
  return id;
};

export const deleteNoticeReply = async (id) => {
  await pool.query('DELETE FROM notice_replies WHERE id = ?', [id]);
  return { affectedRows: 1 };
};

export const getNoticeReplyCount = async (noticeId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM notice_replies WHERE notice_id = ?',
    [noticeId]
  );
  return rows[0]?.total || 0;
};
