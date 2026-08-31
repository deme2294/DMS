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
    if (!['published', 'unpublished', 'approved', 'archived', 'restored'].includes(article.status)) {
      throw FORBIDDEN('This article is not available');
    }
    return;
  }

  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (article.department_id && !deptIds.includes(article.department_id)) {
      throw FORBIDDEN('This article is outside your department');
    }
    return;
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
    if (article.author_id === user.id && ['draft', 'needs_revision'].includes(article.status)) {
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
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200) || uuidv4().slice(0, 8);
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
  } else if (isStaff(user)) {
    f.status = ['published', 'unpublished', 'approved', 'archived', 'restored'];
  } else {
    f.excludeDeleted = true;
  }

  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      return { data: [], pagination: { total: 0, page: Number(f.page) || 1, limit: Number(f.limit) || 10, totalPages: 0 } };
    }
    f.departmentIds = deptIds;
  }

  return knowledgeRepo.findAll(f);
};

export const listPublicArticles = async (filters) => knowledgeRepo.findPublic(filters);

export const listMyDrafts = async (user) => {
  if (isAdmin(user)) {
    return knowledgeRepo.findAll({ status: 'draft', page: 1, limit: 100 });
  }
  return knowledgeRepo.findAll({ status: 'draft', authorId: user.id, page: 1, limit: 100 });
};

export const listPendingReview = async (user) => {
  if (isAdmin(user)) {
    return knowledgeRepo.findAll({ status: 'pending_approval', page: 1, limit: 100 });
  }
  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
    }
    return knowledgeRepo.findAll({ status: 'pending_approval', departmentIds: deptIds, page: 1, limit: 100 });
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

  if (isStaff(user) || isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!departmentId && deptIds.length === 1) departmentId = deptIds[0];
    if (!departmentId || !deptIds.includes(departmentId)) {
      throw FORBIDDEN('You must assign the article to one of your departments');
    }
  }

  const slug = generateSlug(data.title || uuidv4());
  const reference = await generateReference();
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
    status: 'draft',
    author_id: user.id,
    department_id: departmentId,
    created_by: user.id,
    updated_by: user.id,
  };

  await knowledgeRepo.create(article);
  const created = await knowledgeRepo.findById(article.id);

  await logAction(user.id, 'ARTICLE_CREATED', 'knowledge_article', article.id, getIp(req), {
    reference, title: article.title, status: 'draft'
  });

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

  if (Object.keys(updateData).length) {
    await knowledgeRepo.update(id, updateData);
    await logAction(user.id, 'ARTICLE_EDITED', 'knowledge_article', id, getIp(req), {
      reference: article.article_reference, fields: Object.keys(updateData)
    }, { oldValue: { status: oldStatus }, newValue: { status: oldStatus } });
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
  if (article.author_id === user.id) throw FORBIDDEN('You cannot approve your own article');
  if (!isAdmin(user) && !isManager(user)) throw FORBIDDEN('Only admin or manager can approve articles');
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
      message: `Your article "${article.title}" has been approved.`,
      type: 'knowledge_approval',
      articleId: id,
    });
  }

  return updated;
};

export const rejectArticle = async (id, reason, user, req) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id === user.id) throw FORBIDDEN('You cannot reject your own article');
  if (!isAdmin(user) && !isManager(user)) throw FORBIDDEN('Only admin or manager can reject articles');
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
  canTransitionTo(article.status, 'published');

  await knowledgeRepo.update(id, {
    status: 'published',
    publishedBy: user.id,
    publishedAt: new Date(),
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

export const getCategories = async () => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT name FROM knowledge_categories WHERE is_active = 1 ORDER BY name ASC`
    );
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
  await pool.query(
    `INSERT INTO knowledge_categories (id, name, slug, description, icon, is_active, parent_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, data.name, slug, data.description || null, data.icon || null, data.isActive !== false ? 1 : 0, data.parentId || null, user.id]
  );
  await logAction(user.id, 'CATEGORY_CREATED', 'knowledge_category', id, getIp(req), { name: data.name });
  return { id, name: data.name, slug };
};

export const updateCategory = async (id, data, user, req) => {
  const [existing] = await pool.query('SELECT * FROM knowledge_categories WHERE id = ? LIMIT 1', [id]);
  if (!existing.length) throw NOT_FOUND();

  const slug = data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : existing[0].slug;
  await pool.query(
    `UPDATE knowledge_categories SET name = ?, slug = ?, description = ?, icon = ?, is_active = ?, parent_id = ?, updated_at = NOW() WHERE id = ?`,
    [data.name || existing[0].name, slug, data.description ?? existing[0].description, data.icon ?? existing[0].icon, data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing[0].is_active, data.parentId ?? existing[0].parent_id, id]
  );
  await logAction(user.id, 'CATEGORY_UPDATED', 'knowledge_category', id, getIp(req), { name: data.name });
  return { id };
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

export const listCategories = async () => {
  const [rows] = await pool.query(
    `SELECT id, name, slug, description, icon, is_active, parent_id, created_at, updated_at
     FROM knowledge_categories ORDER BY name ASC`
  );
  return rows;
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
