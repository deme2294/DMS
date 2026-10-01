import * as knowledgeRepo from '../repository/knowledgeRepository.js';
import * as matrixRepo from '../repository/matrixRepository.js';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from '../services/auditService.js';
import {
  notifyKnowledgeSubmitted,
  notifyKnowledgeApproved,
  notifyKnowledgeRejected,
  notifyKnowledgeRevisionRequested,
  notifyKnowledgePublished,
  notifyKnowledgeUnpublished,
} from '../services/notificationService.js';
import { emitToUser } from '../services/socketService.js';
import { ALLOWED_TRANSITIONS } from '../models/KnowledgeArticle.js';

const FORBIDDEN = (message = 'You are not allowed to perform this action') =>
  Object.assign(new Error(message), { statusCode: 403 });

const NOT_FOUND = () => Object.assign(new Error('Article not found'), { statusCode: 404 });

const BAD_REQUEST = (message) => Object.assign(new Error(message), { statusCode: 400 });

const getUserDepartments = async (user) => {
  if (!user || !['manager', 'staff'].includes(user.role)) return [];
  return matrixRepo.findDepartmentIdsByUser(user.id);
};

const getUserById = async (userId) => {
  const [rows] = await pool.query('SELECT id, first_name, last_name, email, role FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
};

const getIp = (req) => req.ip || req.connection?.remoteAddress || 'unknown';

const isAdmin = (user) => user.role === 'admin';
const isManager = (user) => user.role === 'manager';
const isStaff = (user) => user.role === 'staff';
const isTenant = (user) => user.role === 'tenant';
const isCeo = (user) => user.role === 'ceo';

const canViewArticle = async (article, user) => {
  if (!article) throw NOT_FOUND();
  if (article.deleted_at) throw NOT_FOUND();

  if (isTenant(user)) {
    if (article.status !== 'published') throw FORBIDDEN('This article is not available');
    if (!['tenant', 'public'].includes(article.visibility)) throw FORBIDDEN('This article is not available');
    return;
  }

  if (isStaff(user)) {
    // 1. Author can always view their own created article (draft, submitted, needs_revision, approved, published)
    if (article.author_id === user.id) return;

    // 2. Department articles: ONLY if PUBLISHED and related to staff's department
    const deptIds = await getUserDepartments(user);
    if (article.department_id && deptIds.includes(article.department_id)) {
      if (article.status === 'published') {
        return;
      }
    }

    throw FORBIDDEN('This article is not available to your department');
  }

  if (isManager(user)) {
    // 1. Author can always view
    if (article.author_id === user.id) return;

    // 2. Department articles (only within manager's assigned department)
    const deptIds = await getUserDepartments(user);
    if (article.department_id && deptIds.includes(article.department_id)) {
      return;
    }

    throw FORBIDDEN('This article is outside your department');
  }

  if (isAdmin(user) || isCeo(user)) {
    return;
  }
};

const canEditArticle = (article, user) => {
  if (!article) throw NOT_FOUND();
  if (article.deleted_at) throw NOT_FOUND();

  if (isAdmin(user)) return true;
  if (isManager(user)) return true;
  if (isStaff(user)) {
    if (article.author_id === user.id && ['draft', 'needs_revision', 'restored'].includes(article.status)) {
      return true;
    }
  }
  throw FORBIDDEN('You do not have permission to edit this article');
};

const canTransitionTo = (currentStatus, newStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw BAD_REQUEST(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }
};

const generateSlug = (title) => {
  const base = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180) || 'article';
  return `${base}-${uuidv4().slice(0, 6)}`;
};

const generateReference = async () => {
  let ref = await knowledgeRepo.getNextReference();
  let exists = await knowledgeRepo.findByReference(ref);
  let counter = 1;
  while (exists && counter < 1000) {
    counter++;
    const seq = String(counter).padStart(6, '0');
    ref = `KB-${new Date().getFullYear()}-${seq}`;
    exists = await knowledgeRepo.findByReference(ref);
  }
  return ref;
};

// ─────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────
export const listArticles = async (filters, user, req) => {
  const f = { ...filters };

  if (isTenant(user)) {
    f.status = 'published';
    f.visibility = ['tenant', 'public'];
    f.excludeDeleted = true;
  } else if (isStaff(user)) {
    const deptIds = await getUserDepartments(user);
    f.forStaff = {
      userId: user.id,
      departmentIds: deptIds,
    };
    f.excludeDeleted = true;
  } else if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    f.forManager = {
      userId: user.id,
      departmentIds: deptIds,
    };
    f.excludeDeleted = true;
  } else {
    f.excludeDeleted = true;
  }

  return knowledgeRepo.findAll(f);
};

export const listPublicArticles = async (filters) => knowledgeRepo.findPublic(filters);

export const listMyArticles = async (user, query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  return knowledgeRepo.findAll({
    authorId: user.id,
    status: query.status || undefined,
    search: query.search || undefined,
    category: query.category || undefined,
    page,
    limit,
  });
};

export const listMyDrafts = async (user) => {
  if (isAdmin(user)) {
    return knowledgeRepo.findAll({ status: 'draft', page: 1, limit: 100 });
  }
  return knowledgeRepo.findAll({ status: 'draft', authorId: user.id, page: 1, limit: 100 });
};

export const listPendingReview = async (user, statusFilter = null) => {
  let targetStatus;
  if (statusFilter && statusFilter !== 'all') {
    targetStatus = statusFilter;
  } else if (statusFilter === 'all') {
    targetStatus = isAdmin(user)
      ? ['pending_approval', 'approved', 'needs_revision']
      : ['pending_approval', 'needs_revision'];
  } else {
    targetStatus = 'pending_approval';
  }

  if (isAdmin(user)) {
    return knowledgeRepo.findAll({ status: targetStatus, page: 1, limit: 100 });
  }
  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
    }
    return knowledgeRepo.findAll({ status: targetStatus, departmentIds: deptIds, page: 1, limit: 100 });
  }
  if (isStaff(user)) {
    return knowledgeRepo.findAll({ status: targetStatus, authorId: user.id, page: 1, limit: 100 });
  }
  return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
};

export const listNeedsRevision = async (user) => {
  if (isAdmin(user)) {
    return knowledgeRepo.findAll({ status: 'needs_revision', page: 1, limit: 100 });
  }
  return knowledgeRepo.findAll({ status: 'needs_revision', authorId: user.id, page: 1, limit: 100 });
};

export const getArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);

  if (req) {
    await knowledgeRepo.incrementView(id);
    await logAction(user.id, 'ARTICLE_VIEWED', 'knowledge_article', id, getIp(req), { reference: article.article_reference, title: article.title });
  }

  return article;
};

export const getArticleByReference = async (reference, user) => {
  const article = await knowledgeRepo.findByReference(reference);
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);
  return article;
};

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────
export const createArticle = async (data, user, req) => {
  let departmentId = data.departmentId || null;

  if (isStaff(user)) {
    const deptIds = await getUserDepartments(user);
    if (deptIds.length > 0) {
      if (!departmentId || !deptIds.includes(departmentId)) {
        departmentId = deptIds[0];
      }
    }
  } else if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!departmentId && deptIds.length > 0) departmentId = deptIds[0];
    if (departmentId && deptIds.length > 0 && !deptIds.includes(departmentId)) {
      throw FORBIDDEN('You must assign the article to one of your departments');
    }
  }

  const slug = generateSlug(data.title || uuidv4());
  const reference = await generateReference();
  const shouldSubmit = Boolean(data.submitForApproval);
  const initialStatus = shouldSubmit ? 'pending_approval' : 'draft';

  const article = {
    id: uuidv4(),
    article_reference: reference,
    title: data.title,
    slug,
    summary: data.summary || null,
    content: data.content,
    category: data.category,
    tags: data.tags || null,
    visibility: data.visibility || 'internal',
    version: '1.0',
    status: initialStatus,
    author_id: user.id,
    department_id: departmentId,
    submitted_by: shouldSubmit ? user.id : null,
    created_by: user.id,
    updated_by: user.id,
  };

  await knowledgeRepo.create(article);
  const created = await knowledgeRepo.findById(article.id);

  await logAction(user.id, shouldSubmit ? 'ARTICLE_SUBMITTED' : 'ARTICLE_CREATED', 'knowledge_article', article.id, getIp(req), {
    reference, title: article.title, status: initialStatus
  });

  if (shouldSubmit) {
    await notifyKnowledgeSubmitted(created, user);
  }

  return created;
};

// ─────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────
export const updateArticle = async (id, data, user, req) => {
  const article = await knowledgeRepo.findById(id);
  await canEditArticle(article, user);

  const oldStatus = article.status;
  const allowed = [
    'title', 'summary', 'content', 'category', 'tags', 'visibility', 'departmentId', 'updatedBy'
  ];
  const updateData = {};
  Object.keys(data).forEach((key) => {
    if (allowed.includes(key)) updateData[key] = data[key];
  });

  if (updateData.title && !updateData.slug) {
    updateData.slug = generateSlug(updateData.title);
  }
  updateData.updatedBy = user.id;

  // [ Restored ] ──(Edit / Update)──▶ [ Draft ]
  if (article.status === 'restored') {
    updateData.status = 'draft';
  }

  if (Object.keys(updateData).length) {
    await knowledgeRepo.update(id, updateData);
    await logAction(user.id, 'ARTICLE_EDITED', 'knowledge_article', id, getIp(req), {
      reference: article.article_reference, fields: Object.keys(updateData)
    }, { oldValue: { status: oldStatus }, newValue: { status: updateData.status || oldStatus } });
  }

  return knowledgeRepo.findById(id);
};

// ─────────────────────────────────────────────
// Workflow transitions
// ─────────────────────────────────────────────
export const submitForReview = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id !== user.id) throw FORBIDDEN('Only the author can submit this article');
  canTransitionTo(article.status, 'pending_approval');
  if (article.status !== 'draft' && article.status !== 'needs_revision') {
    throw BAD_REQUEST('Only drafts or articles needing revision can be submitted for review');
  }

  await knowledgeRepo.update(id, {
    status: 'pending_approval',
    submittedBy: user.id,
    revisionNotes: null,
    rejectionReason: null,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_SUBMITTED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, from: article.status, to: 'pending_approval'
  });

  // Notify admins
  await notifyKnowledgeSubmitted(updated, user);

  return updated;
};

export const requestRevision = async (id, reason, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id === user.id) throw FORBIDDEN('You cannot request revision on your own article');
  
  if (!isAdmin(user)) {
    if (isManager(user)) {
      const deptIds = await getUserDepartments(user);
      if (!article.department_id || !deptIds.includes(article.department_id)) {
        throw FORBIDDEN('You can only request revision for articles belonging to your department');
      }
    } else {
      throw FORBIDDEN('Only department managers or admin can request revision for articles');
    }
  }

  canTransitionTo(article.status, 'needs_revision');

  await knowledgeRepo.update(id, {
    status: 'needs_revision',
    revisionNotes: reason,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_REVISION_REQUESTED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, reason
  });

  await notifyKnowledgeRevisionRequested(updated, user, reason);
  if (article.author_id !== user.id) {
    emitToUser(article.author_id, 'notification', {
      title: 'Article Revision Requested',
      message: `Your article "${article.title}" needs revision. Reason: ${reason || 'Please review and update.'}`,
      type: 'knowledge_revision',
      articleId: id,
    });
  }

  return updated;
};

export const approveArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id === user.id && !isAdmin(user)) throw FORBIDDEN('You cannot approve your own article');
  
  if (!isAdmin(user)) {
    if (isManager(user)) {
      const deptIds = await getUserDepartments(user);
      if (!article.department_id || !deptIds.includes(article.department_id)) {
        throw FORBIDDEN('You can only approve articles belonging to your department');
      }
    } else {
      throw FORBIDDEN('Only department managers or admin can approve articles');
    }
  }

  canTransitionTo(article.status, 'approved');

  await knowledgeRepo.update(id, {
    status: 'approved',
    approvedBy: user.id,
    approvedAt: new Date(),
    rejectionReason: null,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_APPROVED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference
  });

  await notifyKnowledgeApproved(updated, user);
  if (article.author_id !== user.id) {
    emitToUser(article.author_id, 'notification', {
      title: 'Article Approved',
      message: `Your article "${article.title}" has been approved by your department manager and is ready for Admin to publish.`,
      type: 'knowledge_approval',
      articleId: id,
    });
  }

  // Notify admins that article was approved by manager and is ready to publish to tenants
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    emitToUser(admin.id, 'notification', {
      title: 'Article Ready to Publish',
      message: `Article "${article.title}" (${article.article_reference}) was approved by department manager and is ready to publish.`,
      type: 'knowledge_approved',
      articleId: id,
    });
  }

  return updated;
};

export const rejectArticle = async (id, reason, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id === user.id) throw FORBIDDEN('You cannot reject your own article');
  
  if (!isAdmin(user)) {
    if (isManager(user)) {
      const deptIds = await getUserDepartments(user);
      if (!article.department_id || !deptIds.includes(article.department_id)) {
        throw FORBIDDEN('You can only reject articles belonging to your department');
      }
    } else {
      throw FORBIDDEN('Only department managers or admin can reject articles');
    }
  }

  canTransitionTo(article.status, 'rejected');
  if (!reason || !reason.trim()) throw BAD_REQUEST('Rejection reason is required');

  await knowledgeRepo.update(id, {
    status: 'rejected',
    rejectionReason: reason.trim(),
    reviewedBy: user.id,
    rejectedBy: user.id,
    rejectedAt: new Date(),
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_REJECTED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, reason
  });

  await notifyKnowledgeRejected(updated, user, reason);
  if (article.author_id !== user.id) {
    emitToUser(article.author_id, 'notification', {
      title: 'Article Rejected',
      message: `Your article "${article.title}" was rejected. Reason: ${reason}`,
      type: 'knowledge_rejection',
      articleId: id,
    });
  }

  return updated;
};

export const publishArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can publish articles');

  // If article was created by staff, it must be approved by the Department Manager before publish
  const [authorRows] = await pool.query(
    `SELECT u.id, r.name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
    [article.author_id]
  );
  const authorRole = authorRows[0]?.role;
  if (authorRole === 'staff' && article.status !== 'approved' && article.status !== 'unpublished' && article.status !== 'restored') {
    throw BAD_REQUEST('This article was created by staff and must be approved by the Department Manager before it can be published by Admin.');
  }

  canTransitionTo(article.status, 'published');

  await knowledgeRepo.update(id, {
    status: 'published',
    publishedBy: user.id,
    publishedAt: new Date(),
    approvedBy: article.approved_by || user.id,
    approvedAt: article.approved_at || new Date(),
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_PUBLISHED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference
  });

  await notifyKnowledgePublished(updated, user);
  emitToUser(article.author_id, 'notification', {
    title: 'Article Published',
    message: `Your article "${article.title}" has been published.`,
    type: 'knowledge_publish',
    articleId: id,
  });

  return updated;
};

export const unpublishArticle = async (id, reason, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can unpublish articles');
  canTransitionTo(article.status, 'unpublished');

  await knowledgeRepo.update(id, {
    status: 'unpublished',
    unpublishedBy: user.id,
    unpublishedAt: new Date(),
    unpublishReason: reason || null,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_UNPUBLISHED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, reason
  });

  await notifyKnowledgeUnpublished(updated, user);
  if (article.author_id !== user.id) {
    emitToUser(article.author_id, 'notification', {
      title: 'Article Unpublished',
      message: `Your article "${article.title}" has been unpublished.`,
      type: 'knowledge_unpublish',
      articleId: id,
    });
  }

  return updated;
};

export const archiveArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can archive articles');
  canTransitionTo(article.status, 'archived');

  await knowledgeRepo.update(id, {
    status: 'archived',
    archivedBy: user.id,
    archivedAt: new Date(),
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_ARCHIVED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference
  });

  return updated;
};

export const restoreArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can restore articles');
  canTransitionTo(article.status, 'restored');

  await knowledgeRepo.update(id, {
    status: 'restored',
    archivedAt: null,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_RESTORED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference
  });

  return updated;
};

export const moveToDraft = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user) && !isManager(user) && article.author_id !== user.id) {
    throw FORBIDDEN('You do not have permission to move this article to draft');
  }
  canTransitionTo(article.status, 'draft');

  await knowledgeRepo.update(id, {
    status: 'draft',
    updatedBy: user.id,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_MOVED_TO_DRAFT', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, from: article.status, to: 'draft'
  });

  return updated;
};

export const deleteArticle = async (id, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can delete articles');

  await knowledgeRepo.softDelete(id);
  await logAction(user.id, 'ARTICLE_DELETED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, title: article.title
  });

  return { success: true };
};

// ─────────────────────────────────────────────
// Rating
// ─────────────────────────────────────────────
export const rateArticle = async (id, isHelpful, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.status !== 'published') throw BAD_REQUEST('Only published articles can be rated');

  await knowledgeRepo.incrementHelpful(id, isHelpful);
  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_FEEDBACK_SUBMITTED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, helpful: isHelpful
  });

  return updated;
};

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
export const searchArticles = async (query, user, limit = 10, excludeId = '') => {
  if (isTenant(user)) {
    const results = await knowledgeRepo.searchRelated(query, excludeId, limit);
    return results.filter(r => r.status === 'published' && ['tenant', 'public'].includes(r.visibility));
  }
  const results = await knowledgeRepo.searchRelated(query, excludeId, limit);
  return results;
};

export const searchRelatedToTicket = async (query, excludeId, user, limit = 5) => {
  return knowledgeRepo.searchRelated(query, excludeId || '', limit);
};

// ─────────────────────────────────────────────
// Stats & categories
// ─────────────────────────────────────────────
export const getStats = async () => knowledgeRepo.getStats();

export const getCategories = async (user, departmentId) => {
  try {
    let targetDeptId = departmentId;
    if (!targetDeptId && user && isStaff(user)) {
      const depts = await getUserDepartments(user);
      if (depts.length) targetDeptId = depts[0];
    }

    let sql = `SELECT DISTINCT name FROM knowledge_categories WHERE is_active = 1`;
    const params = [];
    if (targetDeptId) {
      sql += ` AND (department_id = ? OR department_id IS NULL)`;
      params.push(targetDeptId);
    }
    sql += ` ORDER BY name ASC`;

    const [rows] = await pool.query(sql, params);
    if (rows && rows.length > 0) {
      return rows.map((r) => r.name);
    }
  } catch (err) {
    // Fall back if knowledge_categories table isn't populated or available
  }
  const fromDb = await knowledgeRepo.getDistinctCategories();
  return fromDb.length ? fromDb : ['ICT', 'Network', 'Email', 'Hardware', 'Software', 'Printer', 'Internet', 'HR', 'Finance', 'Administration', 'General Help Desk'];
};

// ─────────────────────────────────────────────
// Versions
// ─────────────────────────────────────────────
export const createVersion = async (articleId, data, user, req) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user)) throw FORBIDDEN('Only admin can create versions');

  const versionId = uuidv4();
  await pool.query(
    `INSERT INTO knowledge_article_versions
      (id, article_id, version_number, title, content, category_id, change_summary, created_by, approved_by, approved_at, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [versionId, articleId, data.versionNumber || '1.0', data.title || article.title, data.content || article.content, data.categoryId || null, data.changeSummary || null, user.id, article.approved_by || null, article.approved_at || null, article.published_at || null]
  );

  await logAction(user.id, 'ARTICLE_VERSION_CREATED', 'knowledge_article_version', versionId, getIp(req), {
    articleReference: article.article_reference, versionNumber: data.versionNumber
  });

  return { id: versionId };
};

export const getVersions = async (articleId) => {
  const [rows] = await pool.query(
    `SELECT v.id, v.article_id, v.version_number, v.title, v.content, v.category_id, v.change_summary,
            v.created_by, v.created_at, v.approved_by, v.approved_at, v.published_at,
            u.first_name AS creator_first_name, u.last_name AS creator_last_name
     FROM knowledge_article_versions v
     LEFT JOIN users u ON u.id = v.created_by
     WHERE v.article_id = ?
     ORDER BY v.created_at DESC`,
    [articleId]
  );
  return rows;
};

// ─────────────────────────────────────────────
// Attachments
// ─────────────────────────────────────────────
export const addAttachment = async (articleId, fileData, user, req) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();

  const attachmentId = uuidv4();
  await pool.query(
    `INSERT INTO knowledge_attachments
      (id, article_id, file_name, file_path, file_size, mime_type, file_extension, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [attachmentId, articleId, fileData.originalName, fileData.path, fileData.size, fileData.mimeType, fileData.extension, user.id]
  );

  await logAction(user.id, 'ATTACHMENT_UPLOADED', 'knowledge_attachment', attachmentId, getIp(req), {
    articleReference: article.article_reference, fileName: fileData.originalName
  });

  return { id: attachmentId };
};

export const deleteAttachment = async (articleId, attachmentId, user, req) => {
  const [rows] = await pool.query(
    `SELECT * FROM knowledge_attachments WHERE id = ? AND article_id = ? LIMIT 1`,
    [attachmentId, articleId]
  );
  if (!rows.length) throw NOT_FOUND();

  await pool.query('DELETE FROM knowledge_attachments WHERE id = ?', [attachmentId]);
  await logAction(user.id, 'ATTACHMENT_DELETED', 'knowledge_attachment', attachmentId, getIp(req), {
    articleReference: (await knowledgeRepo.findById(articleId))?.article_reference
  });

  return { success: true };
};

export const getAttachments = async (articleId) => {
  const [rows] = await pool.query(
    `SELECT id, article_id, file_name, file_path, file_size, mime_type, file_extension, uploaded_by, created_at
     FROM knowledge_attachments WHERE article_id = ? ORDER BY created_at DESC`,
    [articleId]
  );
  return rows;
};

// ─────────────────────────────────────────────
// Categories CRUD
// ─────────────────────────────────────────────
export const createCategory = async (data, user, req) => {
  const id = uuidv4();
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const activeVal = data.isActive !== undefined ? (data.isActive ? 1 : 0) : (data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1);
  const departmentId = data.departmentId || data.department_id || null;

  await pool.query(
    `INSERT INTO knowledge_categories (id, name, slug, description, icon, is_active, parent_id, department_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, data.name, slug, data.description || null, data.icon || null, activeVal, data.parentId || null, departmentId, user.id]
  );
  await logAction(user.id, 'CATEGORY_CREATED', 'knowledge_category', id, getIp(req), { name: data.name, departmentId });
  return { id, name: data.name, slug, isActive: Boolean(activeVal), departmentId };
};

export const updateCategory = async (id, data, user, req) => {
  const [existing] = await pool.query('SELECT * FROM knowledge_categories WHERE id = ? LIMIT 1', [id]);
  if (!existing.length) throw NOT_FOUND();

  const slug = data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : existing[0].slug;
  const activeVal = data.isActive !== undefined
    ? (data.isActive ? 1 : 0)
    : (data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing[0].is_active);
  const departmentId = data.departmentId !== undefined ? (data.departmentId || null) : existing[0].department_id;

  await pool.query(
    `UPDATE knowledge_categories SET name = ?, slug = ?, description = ?, icon = ?, is_active = ?, parent_id = ?, department_id = ?, updated_at = NOW() WHERE id = ?`,
    [
      data.name || existing[0].name,
      slug,
      data.description ?? existing[0].description,
      data.icon ?? existing[0].icon,
      activeVal,
      data.parentId ?? existing[0].parent_id,
      departmentId,
      id
    ]
  );
  await logAction(user.id, 'CATEGORY_UPDATED', 'knowledge_category', id, getIp(req), { name: data.name, departmentId });
  return { id, isActive: Boolean(activeVal), departmentId };
};

export const deleteCategory = async (id, user, req) => {
  const [existing] = await pool.query('SELECT * FROM knowledge_categories WHERE id = ? LIMIT 1', [id]);
  if (!existing.length) throw NOT_FOUND();

  const [articleCount] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM knowledge_base WHERE category = ? AND deleted_at IS NULL',
    [existing[0].name]
  );
  if (articleCount[0].cnt > 0) {
    throw BAD_REQUEST('Cannot delete category that has active articles. Reassign articles first.');
  }

  await pool.query('DELETE FROM knowledge_categories WHERE id = ?', [id]);
  await logAction(user.id, 'CATEGORY_DELETED', 'knowledge_category', id, getIp(req), { name: existing[0].name });
  return { success: true };
};

export const listCategories = async (user, queryParams = {}) => {
  let deptFilter = queryParams?.departmentId || null;
  if (!deptFilter && user && !isAdmin(user) && (isStaff(user) || isManager(user))) {
    const depts = await getUserDepartments(user);
    if (depts.length) {
      deptFilter = depts;
    }
  }

  let sql = `
    SELECT kc.id, kc.name, kc.slug, kc.description, kc.icon, kc.is_active AS isActive,
           kc.is_active, kc.parent_id AS parentId, kc.department_id AS departmentId,
           d.name AS departmentName, kc.created_at, kc.updated_at
    FROM knowledge_categories kc
    LEFT JOIN departments d ON d.id = kc.department_id
  `;
  const whereClauses = [];
  const params = [];

  if (Array.isArray(deptFilter)) {
    if (deptFilter.length > 0) {
      whereClauses.push(`(kc.department_id IN (?) OR kc.department_id IS NULL)`);
      params.push(deptFilter);
    }
  } else if (deptFilter) {
    whereClauses.push(`(kc.department_id = ? OR kc.department_id IS NULL)`);
    params.push(deptFilter);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(' AND ');
  }

  sql += ` ORDER BY kc.name ASC`;

  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    icon: r.icon,
    isActive: Boolean(r.isActive ?? r.is_active),
    parentId: r.parentId,
    departmentId: r.departmentId,
    departmentName: r.departmentName,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};



export const getPopularArticles = async (limit = 10) => {
  const [rows] = await pool.query(
    `SELECT kb.id, kb.article_reference AS articleReference, kb.title, kb.summary, kb.category, kb.visibility, kb.view_count AS viewCount, kb.helpful_count AS helpfulCount
     FROM knowledge_base kb
     WHERE kb.deleted_at IS NULL AND kb.status = 'published'
     ORDER BY kb.view_count DESC, kb.helpful_count DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
};

export const getRecentArticles = async (limit = 10) => {
  const [rows] = await pool.query(
    `SELECT kb.id, kb.article_reference AS articleReference, kb.title, kb.summary, kb.category, kb.visibility, kb.published_at AS publishedAt
     FROM knowledge_base kb
     WHERE kb.deleted_at IS NULL AND kb.status = 'published'
     ORDER BY kb.published_at DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
};

export const getArticleStats = async (user) => {
  let whereScope = 'kb.deleted_at IS NULL';
  let scopeParams = [];

  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (deptIds.length > 0) {
      whereScope += ` AND (kb.department_id IN (?) OR kb.author_id = ?)`;
      scopeParams = [deptIds, user.id];
    } else {
      whereScope += ` AND kb.author_id = ?`;
      scopeParams = [user.id];
    }
  } else if (isStaff(user)) {
    const deptIds = await getUserDepartments(user);
    if (deptIds.length > 0) {
      whereScope += ` AND (kb.author_id = ? OR (kb.department_id IN (?) AND kb.status = 'published'))`;
      scopeParams = [user.id, deptIds];
    } else {
      whereScope += ` AND kb.author_id = ?`;
      scopeParams = [user.id];
    }
  }

  const [statusCounts] = await pool.query(
    `SELECT kb.status, COUNT(*) as cnt
     FROM knowledge_base kb
     WHERE ${whereScope}
     GROUP BY kb.status`,
    scopeParams
  );

  const [feedbackCounts] = await pool.query(
    `SELECT 
       COALESCE(SUM(kb.helpful_count), 0) AS helpfulYes,
       COALESCE(SUM(kb.not_helpful_count), 0) AS notHelpfulNo,
       COUNT(*) AS total
     FROM knowledge_base kb
     WHERE ${whereScope}`,
    scopeParams
  );

  const [deptCounts] = await pool.query(
    `SELECT COALESCE(d.name, 'General') AS name, COUNT(kb.id) AS count
     FROM knowledge_base kb
     LEFT JOIN departments d ON kb.department_id = d.id
     WHERE ${whereScope}
     GROUP BY kb.department_id, d.name
     ORDER BY count DESC
     LIMIT 10`,
    scopeParams
  );

  const stats = {
    draft: 0,
    pending_approval: 0,
    needs_revision: 0,
    approved: 0,
    published: 0,
    unpublished: 0,
    rejected: 0,
    archived: 0,
    restored: 0,
    total: Number(feedbackCounts[0]?.total || 0),
    helpfulYes: Number(feedbackCounts[0]?.helpfulYes || 0),
    notHelpfulNo: Number(feedbackCounts[0]?.notHelpfulNo || 0),
    byDepartment: deptCounts.map((d) => ({ name: d.name, count: Number(d.count) }))
  };

  statusCounts.forEach((row) => {
    if (stats.hasOwnProperty(row.status)) {
      stats[row.status] = Number(row.cnt);
    }
  });

  return stats;
};

