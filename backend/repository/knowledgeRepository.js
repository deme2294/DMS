import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { KNOWLEDGE_VISIBILITY } from '../models/KnowledgeArticle.js';

const SELECT_FIELDS = `
  kb.id,
  kb.article_reference, kb.article_reference AS articleReference,
  kb.title, kb.slug, kb.summary, kb.content,
  kb.category, kb.tags,
  CASE 
    WHEN kb.status = 'draft' THEN 'restricted'
    WHEN kb.status = 'pending_approval' AND kb.reviewed_by IS NULL THEN 'internal'
    WHEN kb.status = 'pending_approval' AND kb.reviewed_by IS NOT NULL THEN 'department'
    WHEN kb.status = 'approved' THEN 'department'
    WHEN kb.status = 'published' THEN (CASE WHEN kb.visibility IN ('tenant', 'public') THEN kb.visibility ELSE 'public' END)
    WHEN kb.status IN ('needs_revision', 'rejected') THEN 'internal'
    WHEN kb.status = 'unpublished' THEN 'department'
    WHEN kb.status = 'archived' THEN 'restricted'
    WHEN kb.status = 'restored' THEN 'internal'
    ELSE COALESCE(kb.visibility, 'internal')
  END AS visibility,
  kb.version, kb.status,
  kb.author_id, kb.author_id AS authorId,
  kb.department_id, kb.department_id AS departmentId,
  kb.submitted_by, kb.submitted_by AS submittedBy,
  kb.reviewed_by, kb.reviewed_by AS reviewedBy,
  kb.approved_by, kb.approved_by AS approvedBy,
  kb.published_by, kb.published_by AS publishedBy,
  kb.updated_by, kb.updated_by AS updatedBy,
  kb.rejection_reason, kb.rejection_reason AS rejectionReason,
  kb.revision_notes, kb.revision_notes AS revisionNotes,
  kb.published_at, kb.published_at AS publishedAt,
  kb.unpublished_at, kb.unpublished_at AS unpublishedAt,
  kb.archived_at, kb.archived_at AS archivedAt,
  kb.deleted_at, kb.deleted_at AS deletedAt,
  kb.approved_at, kb.approved_at AS approvedAt,
  kb.rejected_by, kb.rejected_by AS rejectedBy,
  kb.rejected_at, kb.rejected_at AS rejectedAt,
  kb.unpublished_by, kb.unpublished_by AS unpublishedBy,
  kb.unpublish_reason, kb.unpublish_reason AS unpublishReason,
  kb.archived_by, kb.archived_by AS archivedBy,
  kb.view_count, kb.view_count AS viewCount,
  COALESCE(kb.tenant_view_count, 0) AS tenant_view_count,
  COALESCE(kb.tenant_view_count, 0) AS tenantViewCount,
  GREATEST(0, kb.view_count - COALESCE(kb.tenant_view_count, 0)) AS staffViewCount,
  kb.helpful_count, kb.helpful_count AS helpfulCount,
  kb.not_helpful_count, kb.not_helpful_count AS notHelpfulCount,
  kb.created_at, kb.created_at AS createdAt,
  kb.updated_at, kb.updated_at AS updatedAt,
  ua.first_name AS authorFirstName, ua.last_name AS authorLastName, ua.email AS authorEmail,
  us.first_name AS submittedFirstName, us.last_name AS submittedLastName,
  ur.first_name AS reviewedFirstName, ur.last_name AS reviewedLastName,
  uapp.first_name AS approvedFirstName, uapp.last_name AS approvedLastName,
  up.first_name AS publishedFirstName, up.last_name AS publishedLastName,
  urej.first_name AS rejectedFirstName, urej.last_name AS rejectedLastName,
  uunp.first_name AS unpublishedFirstName, uunp.last_name AS unpublishedLastName,
  uarch.first_name AS archivedFirstName, uarch.last_name AS archivedLastName,
  ra.name AS authorRole,
  d.name AS departmentName, d.code AS departmentCode
 `;

const FROM = `
  FROM knowledge_base kb
  LEFT JOIN users ua ON ua.id = kb.author_id
  LEFT JOIN roles ra ON ra.id = ua.role_id
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
  visibility, excludeDeleted = true, reference, forStaff, forManager, forAdmin
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

    // 2. Department articles visible to department staff:
    // Whole department staff can see once approved by manager (reviewed_by IS NOT NULL),
    // or status is approved / published, or visibility is department / public / tenant.
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map(() => '?').join(',');
      staffConditions.push(`(
        kb.department_id IN (${deptPlaceholders}) AND (
          kb.status = 'published' OR
          kb.status = 'approved' OR
          (kb.status = 'pending_approval' AND kb.reviewed_by IS NOT NULL) OR
          kb.visibility IN ('department', 'public', 'tenant')
        )
      )`);
      staffParams.push(...departmentIds);
    }

    where += ` AND (${staffConditions.join(' OR ')})`;
    params.push(...staffParams);
  } else if (forManager) {
    const { userId, departmentIds = [] } = forManager;
    const managerConditions = [];
    const managerParams = [];

    // 1. Manager's own created articles (drafts, pending_approval, approved, etc.)
    managerConditions.push('kb.author_id = ?');
    managerParams.push(userId);

    // 2. Department articles (staff drafts before routing are strictly private to creator staff)
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map(() => '?').join(',');
      managerConditions.push(`(
        kb.department_id IN (${deptPlaceholders}) AND (
          kb.status != 'draft' OR kb.author_id = ?
        )
      )`);
      managerParams.push(...departmentIds, userId);
    }

    where += ` AND (${managerConditions.join(' OR ')})`;
    params.push(...managerParams);
  } else if (forAdmin) {
    const { userId, pendingReviewGate } = forAdmin;
    // 1. Staff and manager drafts are NEVER displayed in admin knowledge base.
    // Admin only sees drafts authored by Admin (or changed back to draft by Admin).
    where += ` AND (kb.status != 'draft' OR kb.author_id = ?)`;
    params.push(userId);

    // 2. Staff articles must first be approved by the Department Manager (reviewed_by IS NOT NULL)
    // before reaching Admin's pending review queue.
    if (pendingReviewGate) {
      where += ` AND (
        kb.status != 'pending_approval' OR
        kb.reviewed_by IS NOT NULL OR
        ra.name IN ('admin', 'manager')
      )`;
    }
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
  forStaff, forManager, forAdmin
} = {}) => {
  const offset = (page - 1) * limit;
  const { where, params } = buildWhere({
    search, category, status, authorId, departmentIds, ids, visibility, excludeDeleted,
    forStaff, forManager, forAdmin
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

export const incrementView = async (id, isTenant = false, isPublished = false) => {
  if (isTenant && isPublished) {
    await pool.query(
      'UPDATE knowledge_base SET view_count = view_count + 1, tenant_view_count = COALESCE(tenant_view_count, 0) + 1 WHERE id = ?',
      [id]
    );
  } else {
    await pool.query('UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ?', [id]);
  }
};

export const incrementHelpful = async (id, isHelpful) => {
  const col = isHelpful ? 'helpful_count' : 'not_helpful_count';
  await pool.query(`UPDATE knowledge_base SET ${col} = ${col} + 1 WHERE id = ?`, [id]);
};

export const getUserArticleFeedback = async (articleId, userId) => {
  if (!articleId || !userId) return null;
  const [rows] = await pool.query(
    'SELECT id, article_id, user_id, is_helpful, created_at, updated_at FROM knowledge_article_feedback WHERE article_id = :articleId AND user_id = :userId LIMIT 1',
    { articleId, userId }
  );
  return rows[0] || null;
};

export const rateArticleFeedback = async (articleId, userId, isHelpful, reason = null, comment = null) => {
  const helpfulVal = isHelpful ? 1 : 0;
  const [existing] = await pool.query(
    'SELECT id, is_helpful FROM knowledge_article_feedback WHERE article_id = :articleId AND user_id = :userId LIMIT 1',
    { articleId, userId }
  );

  if (existing.length > 0) {
    const prevHelpful = Boolean(existing[0].is_helpful);
    if (prevHelpful === Boolean(isHelpful) && !reason && !comment) {
      // User clicked the exact same feedback again: DO NOT increment count!
      return { status: 'already_submitted', isHelpful: Boolean(isHelpful) };
    }

    // User changed their feedback or supplied comments: update row
    await pool.query(
      'UPDATE knowledge_article_feedback SET is_helpful = :helpfulVal, reason = COALESCE(:reason, reason), comment = COALESCE(:comment, comment), updated_at = CURRENT_TIMESTAMP WHERE id = :id',
      { helpfulVal, reason: reason || null, comment: comment || null, id: existing[0].id }
    );

    // Adjust counts: decrement previous, increment new
    if (prevHelpful && !isHelpful) {
      await pool.query(
        'UPDATE knowledge_base SET helpful_count = GREATEST(0, helpful_count - 1), not_helpful_count = not_helpful_count + 1 WHERE id = :articleId',
        { articleId }
      );
    } else if (!prevHelpful && isHelpful) {
      await pool.query(
        'UPDATE knowledge_base SET not_helpful_count = GREATEST(0, not_helpful_count - 1), helpful_count = helpful_count + 1 WHERE id = :articleId',
        { articleId }
      );
    }

    return { status: 'updated', isHelpful: Boolean(isHelpful) };
  }

  // First time submitting feedback
  const feedbackId = uuidv4();
  await pool.query(
    'INSERT INTO knowledge_article_feedback (id, article_id, user_id, is_helpful, reason, comment) VALUES (:feedbackId, :articleId, :userId, :helpfulVal, :reason, :comment)',
    { feedbackId, articleId, userId, helpfulVal, reason: reason || null, comment: comment || null }
  );

  const col = isHelpful ? 'helpful_count' : 'not_helpful_count';
  await pool.query(`UPDATE knowledge_base SET ${col} = ${col} + 1 WHERE id = :articleId`, { articleId });

  return { status: 'created', isHelpful: Boolean(isHelpful) };
};

export const recalculateArticleFeedback = async (articleId) => {
  const [rows] = await pool.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END), 0) AS helpfulCount,
       COALESCE(SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END), 0) AS notHelpfulCount
     FROM knowledge_article_feedback
     WHERE article_id = :articleId`,
    { articleId }
  );
  const helpful = Number(rows[0]?.helpfulCount || 0);
  const notHelpful = Number(rows[0]?.notHelpfulCount || 0);
  await pool.query(
    'UPDATE knowledge_base SET helpful_count = :helpful, not_helpful_count = :notHelpful WHERE id = :articleId',
    { helpful, notHelpful, articleId }
  );
  return { helpful, notHelpful };
};

export const getStats = async (filter = {}) => {
  const { where, params } = buildWhere({ ...filter, excludeDeleted: true });
  const [rows] = await pool.query(
    `SELECT kb.status, COUNT(*) AS count ${FROM} ${where} GROUP BY kb.status`,
    params
  );
  const stats = {
    draft: 0, pending_approval: 0, needs_revision: 0, approved: 0,
    published: 0, unpublished: 0, rejected: 0, archived: 0, restored: 0, total: 0
  };
  let total = 0;
  rows.forEach((r) => {
    stats[r.status] = Number(r.count);
    total += Number(r.count);
  });
  stats.total = total;
  const [rating] = await pool.query(
    `SELECT COALESCE(SUM(helpful_count),0) AS yes, COALESCE(SUM(not_helpful_count),0) AS no FROM knowledge_base kb WHERE kb.deleted_at IS NULL`
  );
  stats.helpfulYes = rating[0]?.yes || 0;
  stats.notHelpfulNo = rating[0]?.no || 0;

  const [viewsRow] = await pool.query(
    `SELECT COALESCE(SUM(view_count), 0) AS total_views, COALESCE(SUM(tenant_view_count), 0) AS tenant_views FROM knowledge_base kb WHERE kb.deleted_at IS NULL`
  );
  stats.totalViews = Number(viewsRow[0]?.total_views || 0);
  stats.tenantViews = Number(viewsRow[0]?.tenant_views || 0);
  stats.staffViews = Math.max(0, stats.totalViews - stats.tenantViews);

  const [deptRows] = await pool.query(
    `SELECT d.name, COUNT(*) AS count FROM knowledge_base kb LEFT JOIN departments d ON d.id = kb.department_id WHERE kb.deleted_at IS NULL GROUP BY d.name`
  );
  stats.byDepartment = deptRows;

  // Retrieve all rated articles with their feedback breakdown and feedback entries
  const [ratedArticles] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM}
     WHERE kb.deleted_at IS NULL AND (kb.helpful_count > 0 OR kb.not_helpful_count > 0)
     ORDER BY kb.not_helpful_count DESC, kb.helpful_count DESC`
  );

  const feedbackMap = {};
  if (ratedArticles.length > 0) {
    try {
      const [feedbackRows] = await pool.query(
        `SELECT kaf.id, kaf.article_id AS articleId, kaf.user_id AS userId, kaf.is_helpful AS isHelpful,
                kaf.reason, kaf.comment, kaf.created_at AS createdAt, kaf.updated_at AS updatedAt,
                u.first_name AS userFirstName, u.last_name AS userLastName, u.email AS userEmail,
                r.name AS userRole
         FROM knowledge_article_feedback kaf
         LEFT JOIN users u ON u.id = kaf.user_id
         LEFT JOIN roles r ON r.id = u.role_id
         ORDER BY kaf.updated_at DESC`
      );
      feedbackRows.forEach((fb) => {
        if (!feedbackMap[fb.articleId]) feedbackMap[fb.articleId] = [];
        feedbackMap[fb.articleId].push(fb);
      });
    } catch (e) {
      console.error('[KNOWLEDGE] Error retrieving feedback rows:', e.message);
    }
  }

  stats.ratedArticles = ratedArticles.map((art) => ({
    ...art,
    feedbackEntries: feedbackMap[art.id] || [],
  }));

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
