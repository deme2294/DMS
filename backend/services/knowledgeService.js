import * as knowledgeRepo from '../repository/knowledgeRepository.js';
import * as matrixRepo from '../repository/matrixRepository.js';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
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

    // 2. Department articles: Visible to department staff once approved by Department Manager
    // (reviewed_by IS NOT NULL), or approved, or published, or visibility is department/public/tenant
    const deptIds = await getUserDepartments(user);
    if (article.department_id && deptIds.includes(article.department_id)) {
      if (
        article.visibility === 'department' ||
        article.visibility === 'public' ||
        article.visibility === 'tenant' ||
        article.status === 'published' ||
        article.status === 'approved' ||
        (article.status === 'pending_approval' && article.reviewed_by)
      ) {
        return;
      }
    }

    throw FORBIDDEN('This article is not available to other staff in your department yet');
  }

  if (isManager(user)) {
    // 1. Author can always view
    if (article.author_id === user.id) return;

    // 2. Staff drafts are strictly private to creator staff until routed/submitted to manager
    if (article.status === 'draft') {
      throw FORBIDDEN('This draft has not been routed to department manager yet');
    }

    // 3. Department articles (only within manager's assigned department)
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

export const parseVersionNumbers = (versionList = []) => {
  let maxMajor = 1;
  let maxMinor = 0;
  for (const v of versionList) {
    if (!v) continue;
    const clean = String(v).replace(/^v/i, '').trim();
    const parts = clean.split('.');
    const maj = parseInt(parts[0], 10);
    const min = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (!isNaN(maj)) {
      if (maj > maxMajor || (maj === maxMajor && min > maxMinor)) {
        maxMajor = maj;
        maxMinor = isNaN(min) ? 0 : min;
      }
    }
  }
  return { major: maxMajor, minor: maxMinor };
};

export const computeNextVersion = (currentVerOrList, isMajor = false) => {
  let major = 1;
  let minor = 0;
  if (Array.isArray(currentVerOrList)) {
    if (currentVerOrList.length === 0) {
      return isMajor ? '2.0' : '1.1';
    }
    const parsed = parseVersionNumbers(currentVerOrList);
    major = parsed.major;
    minor = parsed.minor;
  } else if (typeof currentVerOrList === 'string' && currentVerOrList.trim()) {
    const clean = currentVerOrList.replace(/^v/i, '').trim();
    const parts = clean.split('.');
    const maj = parseInt(parts[0], 10);
    const min = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (!isNaN(maj)) {
      major = maj;
      minor = isNaN(min) ? 0 : min;
    }
  }

  if (isMajor) {
    return `${major + 1}.0`;
  }
  return `${major}.${minor + 1}`;
};

export const parseRevisionThread = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to plain text parsing
    }
  }
  return [
    {
      id: 'legacy-directive',
      step: 'admin_revision',
      role: 'admin',
      roleLabel: 'Revision Directive',
      authorName: 'Reviewer',
      authorId: null,
      comment: trimmed,
      version: '1.0',
      createdAt: new Date().toISOString(),
    },
  ];
};

export const appendRevisionThread = (existingNotes, newEntry) => {
  const thread = parseRevisionThread(existingNotes);
  thread.push(newEntry);
  return JSON.stringify(thread);
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
  } else if (isAdmin(user)) {
    f.forAdmin = {
      userId: user.id,
      pendingReviewGate: true,
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
  return knowledgeRepo.findAll({ status: 'draft', authorId: user.id, page: 1, limit: 100 });
};

export const listPendingReview = async (user, statusFilter = null) => {
  let targetStatus;
  const isAll = !statusFilter || statusFilter === 'all' || statusFilter === 'all_queue' || statusFilter === '';

  if (!isAll) {
    targetStatus = statusFilter;
  } else {
    targetStatus = isManager(user)
      ? ['draft', 'pending_approval', 'in_review', 'approved', 'needs_revision', 'published', 'unpublished']
      : ['pending_approval', 'in_review', 'approved', 'needs_revision', 'published', 'unpublished'];
  }

  if (isAdmin(user)) {
    return knowledgeRepo.findAll({
      status: targetStatus,
      forAdmin: { userId: user.id, pendingReviewGate: true },
      page: 1,
      limit: 100,
    });
  }
  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
    }
    return knowledgeRepo.findAll({
      status: targetStatus,
      departmentIds: deptIds,
      forManager: { userId: user.id, departmentIds: deptIds },
      page: 1,
      limit: 100,
    });
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
  if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
    }
    return knowledgeRepo.findAll({
      status: 'needs_revision',
      departmentIds: deptIds,
      forManager: { userId: user.id, departmentIds: deptIds },
      page: 1,
      limit: 100,
    });
  }
  return knowledgeRepo.findAll({ status: 'needs_revision', authorId: user.id, page: 1, limit: 100 });
};

export const getArticle = async (id, user, req) => {
  let article = await knowledgeRepo.findById(id);
  if (!article) {
    article = await knowledgeRepo.findByReference(id);
  }
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);

  if (req) {
    const userIsTenant = isTenant(user);
    const isPublishedToTenants = article.status === 'published' && ['tenant', 'public'].includes(article.visibility);
    await knowledgeRepo.incrementView(article.id, userIsTenant, isPublishedToTenants);

    article.view_count = (article.view_count || 0) + 1;
    article.viewCount = article.view_count;
    if (userIsTenant && isPublishedToTenants) {
      article.tenant_view_count = (article.tenant_view_count || 0) + 1;
      article.tenantViewCount = article.tenant_view_count;
    }
    article.staffViewCount = Math.max(0, (article.viewCount || 0) - (article.tenantViewCount || 0));

    await logAction(user.id, 'ARTICLE_VIEWED', 'knowledge_article', article.id, getIp(req), {
      reference: article.article_reference,
      title: article.title,
      isTenant: userIsTenant,
      status: article.status,
      visibility: article.visibility,
    });
  }

  if (user?.id) {
    const userFeedback = await knowledgeRepo.getUserArticleFeedback(article.id, user.id);
    if (userFeedback) {
      article.userFeedback = userFeedback.is_helpful ? 'helpful' : 'not_helpful';
      article.hasVoted = true;
    } else {
      article.userFeedback = null;
      article.hasVoted = false;
    }
  }

  return article;
};

export const getArticleByReference = async (reference, user) => {
  const article = await knowledgeRepo.findByReference(reference);
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);

  if (user?.id) {
    const userFeedback = await knowledgeRepo.getUserArticleFeedback(article.id, user.id);
    if (userFeedback) {
      article.userFeedback = userFeedback.is_helpful ? 'helpful' : 'not_helpful';
      article.hasVoted = true;
    } else {
      article.userFeedback = null;
      article.hasVoted = false;
    }
  }

  return article;
};

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────
export const createArticle = async (data, user, req) => {
  let departmentId = data.departmentId || null;
  if (departmentId && typeof departmentId === 'string') {
    const [dRows] = await pool.query(
      'SELECT id FROM departments WHERE id = ? OR code = ? LIMIT 1',
      [departmentId, departmentId]
    );
    if (dRows.length) departmentId = dRows[0].id;
  }

  if (isStaff(user)) {
    const deptIds = await getUserDepartments(user);
    if (!deptIds.length) {
      throw FORBIDDEN('You must be assigned to a department before you can create knowledge articles.');
    }
    // Staff can ONLY create articles for their assigned department
    if (departmentId && !deptIds.includes(departmentId)) {
      throw FORBIDDEN('Staff members can only create knowledge articles for their assigned department.');
    }
    departmentId = deptIds[0];
  } else if (isManager(user)) {
    const deptIds = await getUserDepartments(user);
    if (!departmentId && deptIds.length > 0) departmentId = deptIds[0];
    if (departmentId && deptIds.length > 0 && !deptIds.includes(departmentId)) {
      throw FORBIDDEN('You must assign the article to one of your departments');
    }
  }

  // Validate category: Categories must only be uploaded from valid knowledge categories
  if (!data.category || !data.category.trim()) {
    throw BAD_REQUEST('Article category is required');
  }
  const validCategories = await getCategories(user, departmentId);
  if (!validCategories.includes(data.category.trim())) {
    throw BAD_REQUEST(`Invalid category "${data.category}". Please select an active knowledge base category.`);
  }

  const slug = generateSlug(data.title || uuidv4());
  const reference = await generateReference();
  const shouldSubmit = isStaff(user) ? false : Boolean(data.submitForApproval);
  const initialStatus = shouldSubmit ? 'pending_approval' : 'draft';

  // Automated lifecycle visibility:
  // - Staff drafts are strictly 'restricted' (private to the creator staff)
  // - Manager/Admin submitted at creation: 'department'
  let initialVisibility = 'restricted';
  if (initialStatus === 'draft') {
    initialVisibility = 'restricted';
  } else if (isManager(user) || isAdmin(user)) {
    initialVisibility = 'department';
  }

  const article = {
    id: uuidv4(),
    article_reference: reference,
    title: data.title,
    slug,
    summary: data.summary || null,
    content: data.content,
    category: data.category.trim(),
    tags: data.tags || null,
    visibility: initialVisibility,
    version: '1.0',
    status: initialStatus,
    author_id: user.id,
    department_id: departmentId,
    submitted_by: shouldSubmit ? user.id : null,
    reviewed_by: (shouldSubmit && isManager(user)) ? user.id : null,
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
    if (isStaff(user) && departmentId) {
      const [managers] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id = ? AND r.name = 'manager' AND u.status = 'active'`,
        [departmentId]
      );
      for (const m of managers) {
        emitToUser(m.id, 'notification', {
          title: 'New Staff Article Awaiting Dept Approval',
          message: `Staff member submitted "${created.title}" for your department review and approval.`,
          type: 'knowledge_submitted',
          articleId: created.id,
        });
      }
    }
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

  if (updateData.departmentId && typeof updateData.departmentId === 'string') {
    const [dRows] = await pool.query(
      'SELECT id FROM departments WHERE id = ? OR code = ? LIMIT 1',
      [updateData.departmentId, updateData.departmentId]
    );
    if (dRows.length) updateData.departmentId = dRows[0].id;
  }

  if (updateData.title && !updateData.slug) {
    updateData.slug = generateSlug(updateData.title);
  }
  updateData.updatedBy = user.id;

  // [ Restored ] ──(Edit / Update)──▶ [ Draft ]
  if (article.status === 'restored') {
    updateData.status = 'draft';
  }

  // Automatically accept and retain the category chosen during article creation
  if (updateData.category) {
    const trimmedCategory = updateData.category.trim();
    const isExistingArticleCategory =
      article.category && article.category.trim().toLowerCase() === trimmedCategory.toLowerCase();

    if (!isExistingArticleCategory) {
      const validCategories = await getCategories(user, updateData.departmentId || article.department_id);
      const categoryExists = validCategories.some((c) => c.toLowerCase() === trimmedCategory.toLowerCase());
      if (!categoryExists) {
        throw BAD_REQUEST(`Invalid category "${updateData.category}". Please select an active knowledge base category.`);
      }
    }
    updateData.category = trimmedCategory;
  } else if (!updateData.category && article.category) {
    // Automatically keep the category selected during creation if not provided
    updateData.category = article.category;
  }

  // For non-admin, visibility is automatically determined by the article lifecycle stage
  if (!isAdmin(user)) {
    const currentStatus = updateData.status || article.status;
    if (currentStatus === 'draft') {
      updateData.visibility = 'restricted';
    } else if (currentStatus === 'pending_approval') {
      updateData.visibility = article.reviewed_by ? 'department' : 'internal';
    } else if (currentStatus === 'approved') {
      updateData.visibility = 'department';
    } else if (currentStatus === 'published') {
      updateData.visibility = 'public';
    } else if (['needs_revision', 'rejected'].includes(currentStatus)) {
      updateData.visibility = 'internal';
    }
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
export const submitForReview = async (id, user, req, body = {}) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();

  const deptIds = await getUserDepartments(user);
  const isDeptManager = isManager(user) && article.department_id && deptIds.includes(article.department_id);
  const isAuthor = article.author_id === user.id;

  if (!isAuthor && !isDeptManager && !isAdmin(user)) {
    throw FORBIDDEN('Only the author, department manager, or admin can submit this article for review');
  }

  canTransitionTo(article.status, 'pending_approval');
  if (article.status !== 'draft' && article.status !== 'needs_revision') {
    throw BAD_REQUEST('Only drafts or articles needing revision can be submitted for review');
  }

  const resubmitNotes = body?.notes || body?.resubmitNotes || body?.changeSummary || null;
  let nextVersion = article.version || '1.0';
  if (body?.version) {
    nextVersion = String(body.version).trim();
  } else if (body?.bumpVersion || body?.changeSummary || article.status === 'needs_revision') {
    const parts = (article.version || '1.0').split('.');
    if (parts.length === 2 && !isNaN(parts[1])) {
      nextVersion = `${parts[0]}.${parseInt(parts[1], 10) + 1}`;
    } else {
      nextVersion = `${article.version || '1.0'}.1`;
    }
  }

  let newRevisionNotes = article.revision_notes;
  if (article.status === 'needs_revision') {
    const isDirectManagerAction = isDeptManager && !isAuthor;
    const submitterLabel = isDirectManagerAction ? 'Department Manager' : isAuthor ? 'Author (Staff)' : 'Admin';
    const threadEntry = {
      id: uuidv4(),
      step: isDirectManagerAction ? 'manager_resubmit' : 'author_resubmit',
      role: isAuthor ? 'staff' : (isDeptManager ? 'manager' : 'admin'),
      roleLabel: submitterLabel,
      targetRole: isDirectManagerAction ? 'admin' : 'manager',
      targetRoleLabel: isDirectManagerAction ? 'System Administrator' : 'Department Manager',
      authorName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || submitterLabel,
      authorId: user.id,
      comment: resubmitNotes
        ? resubmitNotes.trim()
        : isDirectManagerAction
        ? 'Department Manager directly updated article addressing Admin revision directive.'
        : 'Author updated article and addressed all requested revision comments.',
      version: nextVersion,
      createdAt: new Date().toISOString(),
    };
    newRevisionNotes = appendRevisionThread(article.revision_notes, threadEntry);
  }

  const deptReviewer = isDeptManager ? user.id : (isStaff(user) ? null : user.id);
  // Automated lifecycle visibility:
  // - Staff submitting to dept manager: 'internal' (creator staff & dept manager)
  // - Dept manager / admin submitting: 'department'
  const newVisibility = deptReviewer ? 'department' : 'internal';

  await knowledgeRepo.update(id, {
    status: 'pending_approval',
    visibility: newVisibility,
    submittedBy: user.id,
    reviewedBy: deptReviewer,
    version: nextVersion,
    revisionNotes: newRevisionNotes,
    rejectionReason: null,
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_SUBMITTED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, from: article.status, to: 'pending_approval', resubmitNotes, version: nextVersion
  });

  // Hierarchical notification routing:
  // - First drafted / staff resubmitted article routes strictly to Department Manager (NOT Admin!)
  // - When Department Manager submits or approves, it routes to Central Admin.
  if (isStaff(user)) {
    if (updated.department_id) {
      const [managers] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id = ? AND r.name = 'manager' AND u.status = 'active'`,
        [updated.department_id]
      );
      for (const m of managers) {
        emitToUser(m.id, 'notification', {
          title: article.status === 'needs_revision' ? 'Updated Version Submitted by Author' : 'New Staff Article Awaiting Dept Approval',
          message: `Author ${user.first_name || ''} ${user.last_name || ''} submitted "${updated.title}" (v${nextVersion}) for your department review and approval.`,
          type: 'knowledge_submitted',
          articleId: id,
          version: nextVersion,
        });
      }
    }
  } else {
    // Submitted directly by Department Manager or Admin -> Route to Admin
    await notifyKnowledgeSubmitted(updated, user);
    if (isDeptManager && !isAuthor) {
      const [admins] = await pool.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
      );
      for (const a of admins) {
        emitToUser(a.id, 'notification', {
          title: 'Article Revised & Resubmitted by Dept Manager',
          message: `Department Manager ${user.first_name || ''} directly revised "${updated.title}" (v${nextVersion}) and routed it to Admin for review & publishing.`,
          type: 'knowledge_submitted',
          articleId: id,
          version: nextVersion,
        });
      }
    }
  }

  return updated;
};

export const requestRevision = async (id, reason, user, req, options = {}) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.author_id === user.id && !isAdmin(user)) throw FORBIDDEN('You cannot request revision on your own article');
  
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

  if (!reason || !reason.trim()) {
    throw BAD_REQUEST('Please provide revision instructions and recommendations for what should be changed.');
  }

  canTransitionTo(article.status, 'needs_revision');

  // Step detection: Admin vs Manager
  const isAdminAction = isAdmin(user);
  const routeTo = options?.targetRole || options?.routeTo || (isAdminAction && article.department_id ? 'manager' : 'author');

  const threadEntry = {
    id: uuidv4(),
    step: isAdminAction ? 'admin_revision' : 'manager_revision',
    role: isAdminAction ? 'admin' : 'manager',
    roleLabel: isAdminAction ? 'Admin Revision Directive' : 'Manager Directive to Author',
    targetRole: routeTo,
    targetRoleLabel: routeTo === 'manager' ? 'Department Manager' : 'Author (Staff)',
    authorName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || (isAdminAction ? 'System Administrator' : 'Department Manager'),
    authorId: user.id,
    comment: reason.trim(),
    version: article.version || '1.0',
    createdAt: new Date().toISOString(),
  };

  const newRevisionNotes = appendRevisionThread(article.revision_notes, threadEntry);

  await knowledgeRepo.update(id, {
    status: 'needs_revision',
    visibility: 'internal',
    revisionNotes: newRevisionNotes,
    reviewedBy: null, // Clear dept review so Dept Manager re-verifies upon resubmission
  });

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, isAdminAction ? 'ARTICLE_REVISION_REQUESTED' : 'ARTICLE_MANAGER_REVISION_ASSIGNED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference, reason: reason.trim(), routeTo
  });

  await notifyKnowledgeRevisionRequested(updated, user, reason.trim());

  if (isAdminAction) {
    if (routeTo === 'manager') {
      // 1. Notify Department Manager(s) so they inspect, revise directly, or assign down to Author
      if (article.department_id) {
        const [deptManagers] = await pool.query(
          `SELECT u.id FROM users u
           JOIN user_departments ud ON ud.user_id = u.id
           JOIN roles r ON r.id = u.role_id
           WHERE ud.department_id = ? AND r.name = 'manager' AND u.status = 'active'`,
          [article.department_id]
        );
        for (const dm of deptManagers) {
          if (dm.id !== user.id && dm.id !== article.author_id) {
            emitToUser(dm.id, 'notification', {
              title: 'Admin Routed Article Revision to You',
              message: `Admin requested changes for department article "${article.title}". Instructions: "${reason.trim()}". You can update the article directly or route it to the Author with instructions.`,
              type: 'knowledge_revision',
              articleId: id,
              adminComment: reason.trim(),
            });
          }
        }
      }
      // Also notify author
      if (article.author_id !== user.id) {
        emitToUser(article.author_id, 'notification', {
          title: 'Admin Requested Article Revision (Routed to Manager)',
          message: `Admin requested changes for "${article.title}". Department Manager is reviewing instructions to update or assign directions to you.`,
          type: 'knowledge_revision',
          articleId: id,
          adminComment: reason.trim(),
        });
      }
    } else {
      // Routed directly to Author
      if (article.author_id !== user.id) {
        emitToUser(article.author_id, 'notification', {
          title: 'Article Revision Requested by Admin',
          message: `Admin requested changes for "${article.title}". Feedback: ${reason.trim()}`,
          type: 'knowledge_revision',
          articleId: id,
          adminComment: reason.trim(),
        });
      }
    }
  } else {
    // Manager assigned revision to Author:
    if (article.author_id !== user.id) {
      emitToUser(article.author_id, 'notification', {
        articleId: id,
        managerComment: reason.trim(),
      });
    }

    // Notify Admins that manager assigned revision to author
    const [admins] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
    );
    for (const adm of admins) {
      if (adm.id !== user.id) {
        emitToUser(adm.id, 'notification', {
          title: 'Manager Assigned Revision to Author',
          message: `Department Manager ${user.first_name || ''} added instructions and assigned revision for "${article.title}" to Author.`,
          type: 'knowledge_revision',
          articleId: id,
        });
      }
    }
  }

  return updated;
};

export const approveArticle = async (id, user, req, body = {}) => {
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

  // If DEPARTMENT MANAGER approves:
  if (isManager(user)) {
    const threadEntry = {
      id: uuidv4(),
      step: 'manager_approve',
      role: 'manager',
      roleLabel: 'Department Manager',
      authorName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Department Manager',
      authorId: user.id,
      comment: 'Department review verified. Approved and routed to Admin for publishing.',
      version: article.version || '1.0',
      createdAt: new Date().toISOString(),
    };
    const newRevisionNotes = appendRevisionThread(article.revision_notes, threadEntry);

    await knowledgeRepo.update(id, {
      status: 'pending_approval',
      visibility: 'department',
      reviewedBy: user.id,
      revisionNotes: newRevisionNotes,
      rejectionReason: null,
    });

    const updated = await knowledgeRepo.findById(id);
    await logAction(user.id, 'ARTICLE_DEPT_APPROVED', 'knowledge_article', id, getIp(req), {
      reference: article.article_reference
    });

    await notifyKnowledgeApproved(updated, user);
    if (article.author_id !== user.id) {
      emitToUser(article.author_id, 'notification', {
        title: 'Article Approved by Dept Manager',
        message: `Your article "${article.title}" has been approved by your department manager and is now with Admin for review & publishing.`,
        type: 'knowledge_approval',
        articleId: id,
      });
    }

    // Notify admins that article was approved by manager and reached Admin pending review queue
    const [admins] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active'`
    );
    for (const admin of admins) {
      emitToUser(admin.id, 'notification', {
        title: 'New Article Ready for Admin Review',
        message: `Article "${article.title}" (${article.article_reference}) was approved by department manager and reached your Pending Review queue.`,
        type: 'knowledge_submitted',
        articleId: id,
      });
    }

    return updated;
  }

  // If ADMIN approves:
  if (isAdmin(user)) {
    // Hierarchical check: Staff-created articles must first be approved by the Department Manager
    const [authorRows] = await pool.query(
      `SELECT r.name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [article.author_id]
    );
    const authorRole = authorRows[0]?.role;
    if (authorRole === 'staff' && !article.reviewed_by) {
      throw BAD_REQUEST('This article was drafted by a staff member and must first be reviewed and approved by the Department Manager before reaching Central Administration approval.');
    }

    canTransitionTo(article.status, 'approved');

    const conn = await pool.getConnection();
    let newVersion = article.version || '1.0';
    const isMajor = Boolean(body?.isMajor);
    const changeSummary = body?.changeSummary?.trim() || body?.notes?.trim() || null;
    const now = new Date();

    try {
      await conn.beginTransaction();

      // Lock current article and existing versions
      const [lockedArticles] = await conn.query(
        `SELECT * FROM knowledge_base WHERE id = ? FOR UPDATE`,
        [id]
      );
      const curArt = lockedArticles[0] || article;

      const [existingVersions] = await conn.query(
        `SELECT id, version_number, published_at FROM knowledge_article_versions WHERE article_id = ? FOR UPDATE`,
        [id]
      );

      const hasPublishedVersion = existingVersions.some((v) => v.published_at !== null) || Boolean(curArt.published_at);

      if (hasPublishedVersion) {
        // Automatically generate next version (1.1, 1.2, or 2.0 if isMajor)
        const versionList = existingVersions.map((v) => v.version_number);
        if (!versionList.includes(curArt.version)) {
          versionList.push(curArt.version);
        }
        newVersion = computeNextVersion(versionList, isMajor);

        // Create new version snapshot (NEVER overwrite old versions)
        const versionId = uuidv4();
        await conn.query(
          `INSERT INTO knowledge_article_versions
            (id, article_id, version_number, title, content, summary, category, category_id, tags, visibility,
             change_summary, created_by, approved_by, approved_at, published_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
          [
            versionId,
            id,
            newVersion,
            curArt.title,
            curArt.content,
            curArt.summary || null,
            curArt.category || null,
            curArt.category_id || null,
            curArt.tags || null,
            curArt.visibility || 'department',
            changeSummary || (isMajor ? 'Major release approved' : 'Approved revision update'),
            curArt.author_id || user.id,
            user.id,
            now,
          ]
        );
      } else {
        // Initial publication cycle (starts with 1.0)
        newVersion = curArt.version || '1.0';
        const v1 = existingVersions.find((v) => v.version_number === newVersion);
        if (v1) {
          await conn.query(
            `UPDATE knowledge_article_versions
             SET approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, ?)
             WHERE id = ?`,
            [user.id, now, v1.id]
          );
        } else {
          const versionId = uuidv4();
          await conn.query(
            `INSERT INTO knowledge_article_versions
              (id, article_id, version_number, title, content, summary, category, category_id, tags, visibility,
               change_summary, created_by, approved_by, approved_at, published_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
            [
              versionId,
              id,
              newVersion,
              curArt.title,
              curArt.content,
              curArt.summary || null,
              curArt.category || null,
              curArt.category_id || null,
              curArt.tags || null,
              curArt.visibility || 'department',
              changeSummary || 'Initial draft approved',
              curArt.author_id || user.id,
              user.id,
              now,
            ]
          );
        }
      }

      const threadEntry = {
        id: uuidv4(),
        step: 'admin_approve',
        role: 'admin',
        roleLabel: 'System Administrator',
        authorName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'System Administrator',
        authorId: user.id,
        comment: changeSummary ? `Admin approved: ${changeSummary}` : 'Admin verified and approved article for publishing.',
        version: newVersion,
        createdAt: now.toISOString(),
      };
      const newRevisionNotes = appendRevisionThread(curArt.revision_notes, threadEntry);

      await conn.query(
        `UPDATE knowledge_base
         SET status = 'approved', visibility = 'department', approved_by = ?, approved_at = ?,
             version = ?, revision_notes = ?, rejection_reason = NULL, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [user.id, now, newVersion, newRevisionNotes, user.id, id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const updated = await knowledgeRepo.findById(id);
    await logAction(user.id, 'ARTICLE_ADMIN_APPROVED', 'knowledge_article', id, getIp(req), {
      reference: article.article_reference,
      version: newVersion,
    });

    await notifyKnowledgeApproved(updated, user);
    if (article.author_id !== user.id) {
      emitToUser(article.author_id, 'notification', {
        title: 'Article Approved by Admin',
        message: `Your article "${article.title}" (v${newVersion}) has been approved by Admin and is ready to publish to tenants.`,
        type: 'knowledge_approval',
        articleId: id,
      });
    }

    // Also notify Department Manager
    if (article.department_id) {
      const [deptManagers] = await pool.query(
        `SELECT u.id FROM users u
         JOIN user_departments ud ON ud.user_id = u.id
         JOIN roles r ON r.id = u.role_id
         WHERE ud.department_id = ? AND r.name = 'manager' AND u.status = 'active'`,
        [article.department_id]
      );
      for (const dm of deptManagers) {
        if (dm.id !== user.id && dm.id !== article.author_id) {
          emitToUser(dm.id, 'notification', {
            title: 'Article Approved by Admin',
            message: `Department article "${article.title}" (v${newVersion}) has been approved by Admin and is ready to publish.`,
            type: 'knowledge_approval',
            articleId: id,
          });
        }
      }
    }

    return updated;
  }

  return article;
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
    visibility: 'internal',
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

export const publishArticle = async (id, user, req, body = {}) => {
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

  const now = new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [locked] = await conn.query(
      `SELECT * FROM knowledge_base WHERE id = ? FOR UPDATE`,
      [id]
    );
    const curArt = locked[0] || article;
    const curVer = curArt.version || '1.0';

    const [existingVers] = await conn.query(
      `SELECT id, version_number, published_at FROM knowledge_article_versions WHERE article_id = ? AND version_number = ? FOR UPDATE`,
      [id, curVer]
    );

    if (existingVers.length > 0) {
      await conn.query(
        `UPDATE knowledge_article_versions
         SET published_at = COALESCE(published_at, ?),
             approved_by = COALESCE(approved_by, ?),
             approved_at = COALESCE(approved_at, ?),
             visibility = 'public'
         WHERE id = ?`,
        [now, user.id, now, existingVers[0].id]
      );
    } else {
      const versionId = uuidv4();
      await conn.query(
        `INSERT INTO knowledge_article_versions
          (id, article_id, version_number, title, content, summary, category, category_id, tags, visibility,
           change_summary, created_by, approved_by, approved_at, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?, ?, ?, ?, NOW())`,
        [
          versionId,
          id,
          curVer,
          curArt.title,
          curArt.content,
          curArt.summary || null,
          curArt.category || null,
          curArt.category_id || null,
          curArt.tags || null,
          body?.changeSummary || 'Published release',
          curArt.author_id || user.id,
          curArt.approved_by || user.id,
          curArt.approved_at || now,
          now,
        ]
      );
    }

    await conn.query(
      `UPDATE knowledge_base
       SET status = 'published', visibility = 'public', published_by = ?, published_at = ?,
           approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, ?),
           updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [user.id, now, user.id, now, user.id, id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const updated = await knowledgeRepo.findById(id);
  await logAction(user.id, 'ARTICLE_PUBLISHED', 'knowledge_article', id, getIp(req), {
    reference: article.article_reference,
    version: updated.version,
  });

  await notifyKnowledgePublished(updated, user);
  emitToUser(article.author_id, 'notification', {
    title: 'Article Published',
    message: `Your article "${article.title}" (v${updated.version}) has been published.`,
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
    visibility: 'department',
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
    visibility: 'restricted',
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
    visibility: 'internal',
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
    visibility: 'restricted',
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
export const rateArticle = async (id, isHelpful, user, req, options = {}) => {
  const article = await knowledgeRepo.findById(id);
  if (!article) throw NOT_FOUND();
  if (article.status !== 'published') throw BAD_REQUEST('Only published articles can be rated');

  const reason = options?.reason || null;
  const comment = options?.comment || null;

  const result = await knowledgeRepo.rateArticleFeedback(article.id, user.id, isHelpful, reason, comment);
  const updated = await knowledgeRepo.findById(article.id);

  if (result.status !== 'already_submitted') {
    await logAction(user.id, 'ARTICLE_FEEDBACK_SUBMITTED', 'knowledge_article', article.id, getIp(req), {
      reference: article.article_reference,
      helpful: isHelpful,
      feedbackStatus: result.status,
      reason,
      comment,
    });
  }

  return {
    ...updated,
    userFeedback: isHelpful ? 'helpful' : 'not_helpful',
    hasVoted: true,
    feedbackStatus: result.status,
  };
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
export const getArticleStats = async (user) => {
  const f = {};
  if (!user) {
    return knowledgeRepo.getStats();
  }
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
  } else if (isAdmin(user)) {
    f.forAdmin = {
      userId: user.id,
      pendingReviewGate: true,
    };
    f.excludeDeleted = true;
  } else {
    f.excludeDeleted = true;
  }
  return knowledgeRepo.getStats(f);
};

export const getStats = async (user) => getArticleStats(user);

export const getCategories = async (user, departmentId) => {
  try {
    let targetDeptId = departmentId;
    if (!targetDeptId && user && isStaff(user)) {
      const depts = await getUserDepartments(user);
      if (depts.length) targetDeptId = depts[0];
    }

    // Resolve department if passed as 4-6 symbol ID or department code
    if (targetDeptId && typeof targetDeptId === 'string') {
      const [deptRows] = await pool.query(
        'SELECT id FROM departments WHERE id = ? OR code = ? LIMIT 1',
        [targetDeptId, targetDeptId]
      );
      if (deptRows.length) {
        targetDeptId = deptRows[0].id;
      }
    }

    let sql = `SELECT DISTINCT name FROM knowledge_categories WHERE is_active = 1`;
    const params = [];
    if (targetDeptId) {
      sql += ` AND (department_id = ? OR department_id IS NULL)`;
      params.push(targetDeptId);
    }
    sql += ` ORDER BY name ASC`;

    const [rows] = await pool.query(sql, params);
    const catNames = (rows || []).map((r) => r.name);
    // Also include any distinct categories already used in knowledge_base
    const fromDb = await knowledgeRepo.getDistinctCategories();
    for (const d of fromDb) {
      if (d && !catNames.some((c) => c.toLowerCase() === d.toLowerCase())) {
        catNames.push(d);
      }
    }
    if (catNames.length > 0) {
      return catNames;
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
export const getVersions = async (articleId) => {
  const [rows] = await pool.query(
    `SELECT v.id, v.article_id AS articleId, v.version_number AS versionNumber,
            v.article_id, v.version_number,
            v.title, v.content, v.summary, v.category, v.category_id AS categoryId,
            v.tags, v.visibility, v.change_summary AS changeSummary, v.change_summary,
            v.created_by AS createdBy, v.created_by, v.created_at AS createdAt, v.created_at,
            v.approved_by AS approvedBy, v.approved_by, v.approved_at AS approvedAt, v.approved_at,
            v.published_at AS publishedAt, v.published_at,
            u.first_name AS creatorFirstName, u.last_name AS creatorLastName,
            u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            a.first_name AS approverFirstName, a.last_name AS approverLastName
     FROM knowledge_article_versions v
     LEFT JOIN users u ON u.id = v.created_by
     LEFT JOIN users a ON a.id = v.approved_by
     WHERE v.article_id = ?
     ORDER BY v.created_at DESC`,
    [articleId]
  );
  return rows;
};

export const getArticleVersionById = async (articleId, versionId, user) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);

  const [rows] = await pool.query(
    `SELECT v.id, v.article_id AS articleId, v.version_number AS versionNumber,
            v.article_id, v.version_number,
            v.title, v.content, v.summary, v.category, v.category_id AS categoryId,
            v.tags, v.visibility, v.change_summary AS changeSummary, v.change_summary,
            v.created_by AS createdBy, v.created_by, v.created_at AS createdAt, v.created_at,
            v.approved_by AS approvedBy, v.approved_by, v.approved_at AS approvedAt, v.approved_at,
            v.published_at AS publishedAt, v.published_at,
            u.first_name AS creatorFirstName, u.last_name AS creatorLastName,
            u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            a.first_name AS approverFirstName, a.last_name AS approverLastName
     FROM knowledge_article_versions v
     LEFT JOIN users u ON u.id = v.created_by
     LEFT JOIN users a ON a.id = v.approved_by
     WHERE v.article_id = ? AND (v.id = ? OR v.version_number = ?)
     LIMIT 1`,
    [articleId, versionId, versionId]
  );

  if (!rows.length) {
    throw Object.assign(new Error('Article version snapshot not found'), { statusCode: 404 });
  }

  return rows[0];
};

export const restoreArticleVersion = async (articleId, versionId, user, req, options = {}) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user) && !isManager(user)) {
    throw FORBIDDEN('Only administrators or managers can restore article versions');
  }

  const conn = await pool.getConnection();
  let newVersionNumber;
  const newVersionId = uuidv4();
  const now = new Date();

  try {
    await conn.beginTransaction();

    // 1. Fetch target version snapshot to restore
    const [snapshotRows] = await conn.query(
      `SELECT * FROM knowledge_article_versions WHERE article_id = ? AND (id = ? OR version_number = ?) LIMIT 1 FOR UPDATE`,
      [articleId, versionId, versionId]
    );
    if (!snapshotRows.length) {
      throw Object.assign(new Error('Article version snapshot not found'), { statusCode: 404 });
    }
    const snapshot = snapshotRows[0];

    // 2. Lock current article
    const [lockedArtRows] = await conn.query(
      `SELECT * FROM knowledge_base WHERE id = ? FOR UPDATE`,
      [articleId]
    );
    const curArt = lockedArtRows[0] || article;

    // 3. Lock all versions of this article to calculate next version number
    const [allVersions] = await conn.query(
      `SELECT version_number FROM knowledge_article_versions WHERE article_id = ? FOR UPDATE`,
      [articleId]
    );
    const existingVersionNumbers = allVersions.map((v) => v.version_number);
    if (!existingVersionNumbers.includes(curArt.version)) {
      existingVersionNumbers.push(curArt.version);
    }

    const isMajor = Boolean(options?.isMajor);
    newVersionNumber = computeNextVersion(existingVersionNumbers, isMajor);

    const changeSummary =
      options?.changeSummary?.trim() ||
      `Restored from version ${snapshot.version_number}${options?.reason ? ` (${options.reason})` : ''}`;

    const shouldPublish = options?.publishImmediately !== false && curArt.status === 'published';

    // 4. Insert NEW version snapshot (NEVER overwrite or delete old versions)
    await conn.query(
      `INSERT INTO knowledge_article_versions
        (id, article_id, version_number, title, content, summary, category, category_id, tags, visibility,
         change_summary, created_by, approved_by, approved_at, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        newVersionId,
        articleId,
        newVersionNumber,
        snapshot.title,
        snapshot.content,
        snapshot.summary || null,
        snapshot.category || null,
        snapshot.category_id || null,
        snapshot.tags || null,
        snapshot.visibility || 'public',
        changeSummary,
        user.id,
        user.id,
        now,
        shouldPublish ? now : null,
      ]
    );

    // 5. Update knowledge_base with the restored snapshot data
    const threadEntry = {
      id: uuidv4(),
      step: 'admin_restore',
      role: user.role,
      roleLabel: user.role === 'admin' ? 'System Administrator' : 'Department Manager',
      authorName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      authorId: user.id,
      comment: `Restored article content from version ${snapshot.version_number} creating new version ${newVersionNumber}.`,
      version: newVersionNumber,
      createdAt: now.toISOString(),
    };
    const newRevisionNotes = appendRevisionThread(curArt.revision_notes, threadEntry);

    await conn.query(
      `UPDATE knowledge_base
       SET title = ?, content = ?, summary = ?, category = ?, tags = ?,
           visibility = ?, version = ?, revision_notes = ?,
           status = ?, approved_by = ?, approved_at = ?,
           published_by = ?, published_at = ?,
           updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        snapshot.title,
        snapshot.content,
        snapshot.summary || null,
        snapshot.category || curArt.category,
        snapshot.tags || null,
        shouldPublish ? 'public' : (snapshot.visibility || curArt.visibility),
        newVersionNumber,
        newRevisionNotes,
        shouldPublish ? 'published' : 'approved',
        user.id,
        now,
        shouldPublish ? user.id : curArt.published_by,
        shouldPublish ? now : curArt.published_at,
        user.id,
        articleId,
      ]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const updated = await knowledgeRepo.findById(articleId);
  await logAction(user.id, 'ARTICLE_VERSION_RESTORED', 'knowledge_article', articleId, getIp(req), {
    reference: article.article_reference,
    fromVersion: versionId,
    newVersion: newVersionNumber,
  });

  return {
    success: true,
    message: `Restored version as new version ${newVersionNumber}`,
    newVersion: newVersionNumber,
    newVersionId,
    article: updated,
  };
};

export const createVersion = async (articleId, data, user, req) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();
  if (!isAdmin(user) && !isManager(user) && article.author_id !== user.id) {
    throw FORBIDDEN('You do not have permission to create versions for this article');
  }

  const conn = await pool.getConnection();
  let nextVersion;
  const versionId = uuidv4();
  const now = new Date();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT version_number FROM knowledge_article_versions WHERE article_id = ? FOR UPDATE`,
      [articleId]
    );
    const versionList = existing.map((v) => v.version_number);
    if (!versionList.includes(article.version)) {
      versionList.push(article.version);
    }

    const isMajor = Boolean(data?.isMajor);
    nextVersion = computeNextVersion(versionList, isMajor);

    await conn.query(
      `INSERT INTO knowledge_article_versions
        (id, article_id, version_number, title, content, summary, category, category_id, tags, visibility,
         change_summary, created_by, approved_by, approved_at, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        versionId,
        articleId,
        nextVersion,
        data.title || article.title,
        data.content || article.content,
        data.summary !== undefined ? data.summary : article.summary,
        data.category || article.category,
        data.categoryId || article.category_id || null,
        data.tags !== undefined ? data.tags : article.tags,
        data.visibility || article.visibility || 'department',
        data.changeSummary || (isMajor ? 'Major version release' : 'Manual version snapshot'),
        user.id,
        user.id,
        now,
        null,
      ]
    );

    await conn.query(
      `UPDATE knowledge_base SET version = ?, updated_by = ?, updated_at = NOW() WHERE id = ?`,
      [nextVersion, user.id, articleId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await logAction(user.id, 'ARTICLE_VERSION_CREATED', 'knowledge_article_version', versionId, getIp(req), {
    articleReference: article.article_reference,
    versionNumber: nextVersion,
  });

  return { id: versionId, versionNumber: nextVersion };
};

// ─────────────────────────────────────────────
// Attachments
// ─────────────────────────────────────────────
export const addAttachment = async (articleId, fileData, user, req) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();

  // Author or Reviewer or Admin/Manager authorization check:
  const isAuthor = article.author_id === user.id || article.authorId === user.id || article.created_by === user.id;
  const isReviewer = ['admin', 'ceo', 'manager'].includes(user.role) ||
    article.reviewed_by === user.id || article.reviewedBy === user.id ||
    article.approved_by === user.id || article.approvedBy === user.id ||
    (user.permissions && (
      user.permissions.includes('knowledge.approve') ||
      user.permissions.includes('knowledge.review') ||
      user.permissions.includes('knowledge.request_revision') ||
      user.permissions.includes('knowledge.update') ||
      user.permissions.includes('knowledge.create')
    ));

  if (!isAuthor && !isReviewer && !['admin', 'ceo', 'manager'].includes(user.role)) {
    throw FORBIDDEN('Only the article author and designated reviewers can add attachments');
  }

  const attachmentId = uuidv4();
  await pool.query(
    `INSERT INTO knowledge_attachments
      (id, article_id, file_name, file_path, file_size, mime_type, file_extension, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [attachmentId, articleId, fileData.originalName, fileData.path, fileData.size, fileData.mimeType, fileData.extension, user.id]
  );

  await logAction(user.id, 'ATTACHMENT_UPLOADED', 'knowledge_attachment', attachmentId, getIp(req), {
    articleReference: article.article_reference || article.articleReference, fileName: fileData.originalName
  });

  return {
    id: attachmentId,
    articleId,
    article_id: articleId,
    fileName: fileData.originalName,
    file_name: fileData.originalName,
    filePath: fileData.path,
    file_path: fileData.path,
    fileSize: fileData.size,
    file_size: fileData.size,
    mimeType: fileData.mimeType,
    mime_type: fileData.mimeType,
    fileExtension: fileData.extension,
    file_extension: fileData.extension,
    uploadedBy: user.id,
    uploaded_by: user.id,
  };
};

export const deleteAttachment = async (articleId, attachmentId, user, req) => {
  const [rows] = await pool.query(
    `SELECT * FROM knowledge_attachments WHERE id = ? AND article_id = ? LIMIT 1`,
    [attachmentId, articleId]
  );
  if (!rows.length) throw NOT_FOUND();

  const article = await knowledgeRepo.findById(articleId);
  const isAuthor = article && (article.author_id === user.id || article.authorId === user.id || article.created_by === user.id);
  const isUploader = rows[0].uploaded_by === user.id;
  const isReviewer = ['admin', 'ceo', 'manager'].includes(user.role) ||
    (article && (article.reviewed_by === user.id || article.reviewedBy === user.id || article.approved_by === user.id || article.approvedBy === user.id));

  if (!isAuthor && !isUploader && !isReviewer) {
    throw FORBIDDEN('Only the author, uploader, or reviewer can delete this attachment');
  }

  // Remove file from disk if present
  if (rows[0].file_path) {
    try {
      const fullPath = path.join(process.cwd(), rows[0].file_path.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // ignore unlink errors
    }
  }

  await pool.query('DELETE FROM knowledge_attachments WHERE id = ?', [attachmentId]);
  await logAction(user.id, 'ATTACHMENT_DELETED', 'knowledge_attachment', attachmentId, getIp(req), {
    articleReference: article?.article_reference || article?.articleReference
  });

  return { success: true };
};

export const getAttachments = async (articleId) => {
  const [rows] = await pool.query(
    `SELECT 
       ka.id, 
       ka.article_id AS articleId, 
       ka.article_id,
       ka.file_name AS fileName, 
       ka.file_name,
       ka.file_path AS filePath, 
       ka.file_path,
       ka.file_size AS fileSize, 
       ka.file_size,
       ka.mime_type AS mimeType, 
       ka.mime_type,
       ka.file_extension AS fileExtension, 
       ka.file_extension,
       ka.uploaded_by AS uploadedBy, 
       ka.uploaded_by,
       ka.created_at AS createdAt,
       ka.created_at,
       u.first_name AS uploaderFirstName,
       u.last_name AS uploaderLastName
     FROM knowledge_attachments ka
     LEFT JOIN users u ON u.id = ka.uploaded_by
     WHERE ka.article_id = ? 
     ORDER BY ka.created_at DESC`,
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

export const getCategoryById = async (id) => {
  // Virtual categories (prefixed kb-cat-) are derived from article data, not the DB
  if (id.startsWith('kb-cat-')) {
    const slug = id.replace(/^kb-cat-/, '');
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      id,
      name,
      slug,
      description: 'Knowledge base category',
      icon: 'folder',
      isActive: true,
      isVirtual: true,
      parentId: null,
      departmentId: null,
      departmentName: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  const [rows] = await pool.query(
    `SELECT kc.id, kc.name, kc.slug, kc.description, kc.icon,
            kc.is_active AS isActive, kc.parent_id AS parentId,
            kc.department_id AS departmentId, d.name AS departmentName,
            kc.created_at, kc.updated_at
     FROM knowledge_categories kc
     LEFT JOIN departments d ON d.id = kc.department_id
     WHERE kc.id = ? OR kc.slug = ?
     LIMIT 1`,
    [id, id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    icon: r.icon,
    isActive: Boolean(r.isActive),
    isVirtual: false,
    parentId: r.parentId,
    departmentId: r.departmentId,
    departmentName: r.departmentName,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

export const listCategories = async (user, queryParams = {}) => {
  let deptFilter = queryParams?.departmentId || null;
  if (!deptFilter && user && !isAdmin(user) && (isStaff(user) || isManager(user))) {
    const depts = await getUserDepartments(user);
    if (depts.length) {
      deptFilter = depts;
    }
  }

  // Resolve department ID if passed as 4-6 symbol ID or department code
  if (deptFilter && typeof deptFilter === 'string') {
    const [deptRows] = await pool.query(
      'SELECT id FROM departments WHERE id = ? OR code = ? LIMIT 1',
      [deptFilter, deptFilter]
    );
    if (deptRows.length) {
      deptFilter = deptRows[0].id;
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
  const result = rows.map((r) => ({
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

  // Also include distinct categories that exist on knowledge base articles so they appear in category dropdowns
  try {
    const existingCategories = await knowledgeRepo.getDistinctCategories();
    const existingNames = new Set(result.map((r) => r.name.toLowerCase()));
    for (const catName of existingCategories) {
      if (catName && !existingNames.has(catName.toLowerCase())) {
        existingNames.add(catName.toLowerCase());
        result.push({
          id: `kb-cat-${catName.toLowerCase().replace(/\s+/g, '-')}`,
          name: catName,
          slug: catName.toLowerCase().replace(/\s+/g, '-'),
          description: 'Knowledge base category',
          icon: 'folder',
          isActive: true,
          isVirtual: true,
          parentId: null,
          departmentId: null,
          departmentName: null,
          createdAt: null,
          updatedAt: null,
        });
      }
    }
  } catch (e) {
    // ignore
  }

  return result;
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

export const getArticleVersions = async (articleId, user) => {
  const article = await knowledgeRepo.findById(articleId);
  if (!article) throw NOT_FOUND();
  await canViewArticle(article, user);
  return getVersions(articleId);
};

export const createArticleVersion = async (articleId, data, user, req) => {
  return createVersion(articleId, data, user, req);
};


