import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { KNOWLEDGE_VISIBILITY } from '../models/KnowledgeArticle.js';

const SELECT_FIELDS = `
  kb.id, kb.article_reference, kb.title, kb.slug, kb.summary, kb.content,
  kb.category, kb.tags, kb.visibility, kb.version, kb.status,
  kb.author_id, kb.department_id, kb.submitted_by, kb.reviewed_by, kb.approved_by, kb.published_by, kb.updated_by,
  kb.rejection_reason, kb.revision_notes, kb.published_at, kb.unpublished_at, kb.archived_at, kb.deleted_at,
  kb.approved_at, kb.rejected_by, kb.rejected_at, kb.unpublished_by, kb.unpublish_reason, kb.archived_by,
  kb.view_count, kb.helpful_count, kb.not_helpful_count,
  kb.created_at, kb.updated_at,
  ua.first_name AS authorFirstName, ua.last_name AS authorLastName, ua.email AS authorEmail,
  us.first_name AS submittedFirstName, us.last_name AS submittedLastName,
  ur.first_name AS reviewedFirstName, ur.last_name AS reviewedLastName,
  uapp.first_name AS approvedFirstName, uapp.last_name AS approvedLastName,
  up.first_name AS publishedFirstName, up.last_name AS publishedLastName,
  urej.first_name AS rejectedFirstName, urej.last_name AS rejectedLastName,
  uunp.first_name AS unpublishedFirstName, uunp.last_name AS unpublishedLastName,
  uarch.first_name AS archivedFirstName, uarch.last_name AS archivedLastName,
  d.name AS departmentName, d.code AS departmentCode
 `;

const FROM = `
  FROM knowledge_base kb
  LEFT JOIN users ua ON ua.id = kb.author_id
  LEFT JOIN users us ON us.id = kb.submitted_by
  LEFT JOIN users ur ON ur.id = kb.reviewed_by
  LEFT JOIN users uapp ON uapp.id = kb.approved_by
  LEFT JOIN users up ON up.id = kb.published_by
  LEFT JOIN users urej ON urej.id = kb.rejected_by
  LEFT JOIN users uunp ON uunp.id = kb.unpublished_by
  LEFT JOIN users uarch ON uarch.id = kb.archived_by
  LEFT JOIN departments d ON d.id = kb.department_id
 `;

const buildWhere = ({
  search, category, status, authorId, departmentIds, ids,
  visibility, excludeDeleted = true, reference, forStaff, forManager
} = {}) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (excludeDeleted) {
    where += ' AND kb.deleted_at IS NULL';
  }
  if (search) {
    where += ' AND (kb.title LIKE ? OR kb.summary LIKE ? OR kb.content LIKE ? OR kb.tags LIKE ? OR kb.article_reference LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where += ' AND kb.category = ?';
    params.push(category);
  }
  if (status) {
    const statusArr = Array.isArray(status) ? status : (typeof status === 'string' && status.includes(',') ? status.split(',').map((s) => s.trim()) : null);
    if (statusArr) {
      const placeholders = statusArr.map(() => '?').join(',');
      where += ` AND kb.status IN (${placeholders})`;
      params.push(...statusArr);
    } else {
      where += ' AND kb.status = ?';
      params.push(status);
    }
  }
  if (authorId) {
    where += ' AND kb.author_id = ?';
    params.push(authorId);
  }

  if (forStaff) {
    const { userId, departmentIds = [] } = forStaff;
    const staffConditions = [];
    const staffParams = [];

    // 1. Staff's own created articles (drafts, pending_approval, needs_revision, etc.)
    staffConditions.push('kb.author_id = ?');
    staffParams.push(userId);

    // 2. Published articles related to staff's department only
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map(() => '?').join(',');
      staffConditions.push(`(kb.department_id IN (${deptPlaceholders}) AND kb.status = 'published')`);
      staffParams.push(...departmentIds);
    }

    where += ` AND (${staffConditions.join(' OR ')})`;
    params.push(...staffParams);
  } else if (forManager) {
    const { userId, departmentIds = [] } = forManager;
    const managerConditions = [];
    const managerParams = [];

    // 1. Manager's own created articles
    managerConditions.push('kb.author_id = ?');
    managerParams.push(userId);

    // 2. Articles related to manager's departments only (staff submissions, drafts, approved, published)
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map(() => '?').join(',');
      managerConditions.push(`kb.department_id IN (${deptPlaceholders})`);
      managerParams.push(...departmentIds);
    }

    where += ` AND (${managerConditions.join(' OR ')})`;
    params.push(...managerParams);
  } else if (Array.isArray(departmentIds) && departmentIds.length) {
    const placeholders = departmentIds.map(() => '?').join(',');
    where += ` AND kb.department_id IN (${placeholders})`;
    params.push(...departmentIds);
  }

  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    where += ` AND kb.id IN (${placeholders})`;
    params.push(...ids);
  }
  if (visibility) {
    if (Array.isArray(visibility)) {
      const placeholders = visibility.map(() => '?').join(',');
      where += ` AND kb.visibility IN (${placeholders})`;
      params.push(...visibility);
    } else {
      where += ' AND kb.visibility = ?';
      params.push(visibility);
    }
  }
  if (reference) {
    where += ' AND kb.article_reference = ?';
    params.push(reference);
  }

  return { where, params };
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} WHERE kb.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const findByReference = async (reference) => {
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} WHERE kb.article_reference = ? LIMIT 1`,
    [reference]
  );
  return rows[0] || null;
};

export const findAll = async ({
  search, category, status, authorId, departmentIds, ids,
  visibility, page = 1, limit = 10, excludeDeleted = true,
  forStaff, forManager
} = {}) => {
  const offset = (page - 1) * limit;
  const { where, params } = buildWhere({
    search, category, status, authorId, departmentIds, ids, visibility, excludeDeleted,
    forStaff, forManager
  });

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total ${FROM} ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} ${where} ORDER BY kb.updated_at DESC LIMIT ? OFFSET ?`,
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

export const findPublic = async ({ search, category, page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  let where = 'WHERE kb.status = ? AND kb.deleted_at IS NULL AND kb.visibility = ?';
  const params = ['published', 'public'];

  if (search) {
    where += ' AND (kb.title LIKE ? OR kb.summary LIKE ? OR kb.content LIKE ? OR kb.tags LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where += ' AND kb.category = ?';
    params.push(category);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total ${FROM} ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} ${where} ORDER BY kb.published_at DESC, kb.created_at DESC LIMIT ? OFFSET ?`,
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

export const findVisibleToUser = async (user, { search, category, page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  let where = 'WHERE kb.deleted_at IS NULL';
  const params = [];

  if (user.role === 'tenant') {
    where += ' AND kb.status = ? AND kb.visibility IN (?)';
    params.push('published', ['tenant', 'public']);
  } else if (user.role === 'staff') {
    where += ' AND kb.status = ? AND kb.visibility IN (?)';
    params.push('published', ['internal', 'department', 'public']);
  } else {
    where += ' AND kb.status IN (?)';
    params.push(['published', 'unpublished', 'approved', 'archived']);
  }

  if (search) {
    where += ' AND (kb.title LIKE ? OR kb.summary LIKE ? OR kb.content LIKE ? OR kb.tags LIKE ? OR kb.article_reference LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where += ' AND kb.category = ?';
    params.push(category);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total ${FROM} ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} ${where} ORDER BY kb.updated_at DESC LIMIT ? OFFSET ?`,
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

export const create = async (article) => {
  const {
    id, article_reference, title, slug, summary, content, category, tags,
    visibility, version, status, author_id, department_id, created_by, updated_by
  } = article;
  await pool.query(
    `INSERT INTO knowledge_base
      (id, article_reference, title, slug, summary, content, category, tags, visibility, version, status,
       author_id, department_id, created_by, updated_by, created_at, updated_at, view_count, helpful_count, not_helpful_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0, 0, 0)`,
    [id, article_reference, title, slug, summary, content, category, tags, visibility, version, status,
     author_id, department_id || null, created_by || author_id, updated_by || author_id]
  );
  return id;
};

export const update = async (id, fields) => {
  const sets = [];
  const params = [];
  const keyMap = {
    articleReference: 'article_reference',
    slug: 'slug',
    summary: 'summary',
    content: 'content',
    category: 'category',
    tags: 'tags',
    visibility: 'visibility',
    version: 'version',
    status: 'status',
    departmentId: 'department_id',
    authorId: 'author_id',
    updatedBy: 'updated_by',
    submittedBy: 'submitted_by',
    reviewedBy: 'reviewed_by',
    approvedBy: 'approved_by',
    approvedAt: 'approved_at',
    rejectionReason: 'rejection_reason',
    revisionNotes: 'revision_notes',
    rejectedBy: 'rejected_by',
    rejectedAt: 'rejected_at',
    publishedBy: 'published_by',
    publishedAt: 'published_at',
    unpublishedBy: 'unpublished_by',
    unpublishReason: 'unpublish_reason',
    unpublishedAt: 'unpublished_at',
    archivedBy: 'archived_by',
    archivedAt: 'archived_at',
    deletedAt: 'deleted_at',
    viewCount: 'view_count',
    helpfulCount: 'helpful_count',
    notHelpfulCount: 'not_helpful_count',
  };
  Object.entries(fields).forEach(([key, value]) => {
    const dbKey = keyMap[key] || key;
    sets.push(`${dbKey} = ?`);
    params.push(value);
  });
  if (!sets.length) return;
  sets.push('updated_at = NOW()');
  params.push(id);
  await pool.query(`UPDATE knowledge_base SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const softDelete = async (id) => {
  await pool.query('UPDATE knowledge_base SET deleted_at = NOW() WHERE id = ?', [id]);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM knowledge_base WHERE id = ?', [id]);
};

export const incrementView = async (id) => {
  await pool.query('UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ?', [id]);
};

export const incrementHelpful = async (id, isHelpful) => {
  const col = isHelpful ? 'helpful_count' : 'not_helpful_count';
  await pool.query(`UPDATE knowledge_base SET ${col} = ${col} + 1 WHERE id = ?`, [id]);
};

export const getStats = async () => {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM knowledge_base WHERE deleted_at IS NULL GROUP BY status`
  );
  const stats = {
    draft: 0, pending_approval: 0, needs_revision: 0, approved: 0,
    published: 0, unpublished: 0, rejected: 0, archived: 0, restored: 0, total: 0
  };
  let total = 0;
  rows.forEach((r) => {
    stats[r.status] = r.count;
    total += r.count;
  });
  stats.total = total;
  const [rating] = await pool.query(
    `SELECT COALESCE(SUM(helpful_count),0) AS yes, COALESCE(SUM(not_helpful_count),0) AS no FROM knowledge_base`
  );
  stats.helpfulYes = rating[0].yes;
  stats.notHelpfulNo = rating[0].no;
  const [deptRows] = await pool.query(
    `SELECT d.name, COUNT(*) AS count FROM knowledge_base kb LEFT JOIN departments d ON d.id = kb.department_id WHERE kb.deleted_at IS NULL GROUP BY d.name`
  );
  stats.byDepartment = deptRows;
  return stats;
};

export const getDistinctCategories = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT category FROM knowledge_base WHERE category IS NOT NULL AND category != '' AND deleted_at IS NULL ORDER BY category ASC`
  );
  return rows.map((r) => r.category);
};

export const getNextReference = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM knowledge_base WHERE article_reference LIKE ?`,
    [`KB-${year}-%`]
  );
  const seq = String(Number(rows[0]?.cnt || 0) + 1).padStart(6, '0');
  return `KB-${year}-${seq}`;
};

export const searchRelated = async (query, excludeId, limit = 5) => {
  const [rows] = await pool.query(
    `SELECT kb.id, kb.article_reference AS articleReference, kb.title, kb.summary, kb.category, kb.status, kb.view_count AS viewCount, kb.helpful_count AS helpfulCount, kb.visibility
     FROM knowledge_base kb
     WHERE kb.deleted_at IS NULL AND kb.status = 'published' AND kb.id != ?
     AND (kb.title LIKE ? OR kb.summary LIKE ? OR kb.content LIKE ? OR kb.tags LIKE ?)
     ORDER BY kb.view_count DESC, kb.helpful_count DESC
     LIMIT ?`,
    [excludeId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, Number(limit)]
  );
  return rows;
};

export const findByIds = async (ids) => {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM} WHERE kb.id IN (${placeholders}) AND kb.deleted_at IS NULL`,
    ids
  );
  return rows;
};
