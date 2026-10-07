import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import * as knowledgeService from '../services/knowledgeService.js';
import { HTTP } from '../config/constants.js';
import { uploadKnowledgeAttachment } from '../config/multer.js';

const getIp = (req) => req.ip || req.connection?.remoteAddress || 'unknown';

export const listArticles = async (req, res, next) => {
  try {
    const result = await knowledgeService.listArticles(req.query, req.user, req);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const listPublicArticles = async (req, res, next) => {
  try {
    const result = await knowledgeService.listPublicArticles(req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getArticleById = async (req, res, next) => {
  try {
    const article = await knowledgeService.getArticle(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
};

export const getArticleByReference = async (req, res, next) => {
  try {
    const article = await knowledgeService.getArticleByReference(req.params.reference, req.user);
    res.status(HTTP.OK).json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
};

export const getMyArticles = async (req, res, next) => {
  try {
    const result = await knowledgeService.listMyArticles(req.user, req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getMyDrafts = async (req, res, next) => {
  try {
    const result = await knowledgeService.listMyDrafts(req.user);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getPendingReview = async (req, res, next) => {
  try {
    const result = await knowledgeService.listPendingReview(req.user, req.query?.status);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getNeedsRevision = async (req, res, next) => {
  try {
    const result = await knowledgeService.listNeedsRevision(req.user);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const createArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.createArticle(req.body, req.user, req);
    res.status(HTTP.CREATED).json({ success: true, message: 'Article created', data: article });
  } catch (err) {
    next(err);
  }
};

export const updateArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.updateArticle(req.params.id, req.body, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article updated', data: article });
  } catch (err) {
    next(err);
  }
};

export const submitForReview = async (req, res, next) => {
  try {
    const article = await knowledgeService.submitForReview(req.params.id, req.user, req, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Article submitted for review', data: article });
  } catch (err) {
    next(err);
  }
};

export const requestRevision = async (req, res, next) => {
  try {
    const reason = typeof req.body === 'object' && req.body.reason !== undefined ? req.body.reason : (typeof req.body === 'string' ? req.body : req.body?.comment || '');
    const targetRole = req.body?.targetRole || req.body?.routeTo || null;
    const article = await knowledgeService.requestRevision(req.params.id, reason, req.user, req, { targetRole });
    res.status(HTTP.OK).json({ success: true, message: 'Revision requested', data: article });
  } catch (err) {
    next(err);
  }
};

export const approveArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.approveArticle(req.params.id, req.user, req, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Article approved', data: article });
  } catch (err) {
    next(err);
  }
};

export const rejectArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.rejectArticle(req.params.id, req.body.reason, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article rejected', data: article });
  } catch (err) {
    next(err);
  }
};

export const publishArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.publishArticle(req.params.id, req.user, req, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Article published', data: article });
  } catch (err) {
    next(err);
  }
};

export const unpublishArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.unpublishArticle(req.params.id, req.body.reason, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article unpublished', data: article });
  } catch (err) {
    next(err);
  }
};

export const archiveArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.archiveArticle(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article archived', data: article });
  } catch (err) {
    next(err);
  }
};

export const restoreArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.restoreArticle(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article restored', data: article });
  } catch (err) {
    next(err);
  }
};

export const moveToDraft = async (req, res, next) => {
  try {
    const article = await knowledgeService.moveToDraft(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article moved to draft', data: article });
  } catch (err) {
    next(err);
  }
};

export const deleteArticle = async (req, res, next) => {
  try {
    const result = await knowledgeService.deleteArticle(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article deleted', data: result });
  } catch (err) {
    next(err);
  }
};

export const rateArticle = async (req, res, next) => {
  try {
    const isHelpful = req.body.helpful === true || req.body.helpful === 'yes' || req.body.helpful === 'true' || req.body.helpful === 1;
    const article = await knowledgeService.rateArticle(req.params.id, isHelpful, req.user, req, {
      reason: req.body.reason,
      comment: req.body.comment,
    });
    let message = 'Thanks for your feedback';
    if (article.feedbackStatus === 'already_submitted') {
      message = 'You have already submitted this feedback for this article';
    } else if (article.feedbackStatus === 'updated') {
      message = 'Your feedback has been updated';
    }
    res.status(HTTP.OK).json({
      success: true,
      message,
      data: article,
      alreadySubmitted: article.feedbackStatus === 'already_submitted',
    });
  } catch (err) {
    next(err);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const data = await knowledgeService.getArticleStats(req.user);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const data = await knowledgeService.getCategories(req.user, req.query?.departmentId);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const listCategories = async (req, res, next) => {
  try {
    const data = await knowledgeService.listCategories(req.user, req.query);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPopularArticles = async (_req, res, next) => {
  try {
    const data = await knowledgeService.getPopularArticles();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRecentArticles = async (_req, res, next) => {
  try {
    const data = await knowledgeService.getRecentArticles();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const data = await knowledgeService.createCategory(req.body, req.user, req);
    res.status(HTTP.CREATED).json({ success: true, message: 'Category created', data });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const data = await knowledgeService.updateCategory(req.params.id, req.body, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Category updated', data });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const data = await knowledgeService.deleteCategory(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Category deleted', data });
  } catch (err) {
    next(err);
  }
};

export const getVersions = async (req, res, next) => {
  try {
    const data = await knowledgeService.getVersions(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getVersionById = async (req, res, next) => {
  try {
    const data = await knowledgeService.getArticleVersionById(req.params.id, req.params.versionId, req.user);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createVersion = async (req, res, next) => {
  try {
    const data = await knowledgeService.createVersion(req.params.id, req.body, req.user, req);
    res.status(HTTP.CREATED).json({ success: true, message: 'Version created', data });
  } catch (err) {
    next(err);
  }
};

export const restoreVersion = async (req, res, next) => {
  try {
    const data = await knowledgeService.restoreArticleVersion(req.params.id, req.params.versionId, req.user, req, req.body);
    res.status(HTTP.OK).json({ success: true, message: data.message || 'Version restored successfully', data });
  } catch (err) {
    next(err);
  }
};

export const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'No file uploaded' });
    }
    const fileData = {
      originalName: req.file.originalname,
      path: `/uploads/knowledge-base/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      extension: req.file.originalname.split('.').pop(),
    };
    const attachment = await knowledgeService.addAttachment(req.params.id, fileData, req.user, req);
    res.status(HTTP.CREATED).json({ success: true, message: 'Attachment uploaded', data: attachment });
  } catch (err) {
    next(err);
  }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const articleId = req.query.articleId;
    if (!articleId) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'articleId is required' });
    }
    const data = await knowledgeService.deleteAttachment(articleId, req.params.attachmentId, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Attachment deleted', data });
  } catch (err) {
    next(err);
  }
};

export const getAttachments = async (req, res, next) => {
  try {
    const data = await knowledgeService.getAttachments(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const streamAttachment = async (req, res, next) => {
  try {
    const { attachmentId } = req.params;
    const [rows] = await pool.query('SELECT * FROM knowledge_attachments WHERE id = ? LIMIT 1', [attachmentId]);
    if (!rows.length) {
      return res.status(HTTP.NOT_FOUND).json({ success: false, message: 'Attachment not found' });
    }
    const att = rows[0];
    const fullPath = path.join(process.cwd(), att.file_path.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(HTTP.NOT_FOUND).json({ success: false, message: 'File not found on server' });
    }

    if (att.mime_type) {
      res.setHeader('Content-Type', att.mime_type);
    }
    const safeName = encodeURIComponent(att.file_name);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"; filename*=UTF-8''${safeName}`);
    return res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
};

export const searchArticles = async (req, res, next) => {
  try {
    const result = await knowledgeService.searchArticles(req.query.q || req.query.search || '', req.user, Number(req.query.limit) || 10, req.query.excludeId || '');
    res.status(HTTP.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

