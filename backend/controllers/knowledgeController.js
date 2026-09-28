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
    const result = await knowledgeService.listPendingReview(req.user);
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
    const article = await knowledgeService.submitForReview(req.params.id, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Article submitted for review', data: article });
  } catch (err) {
    next(err);
  }
};

export const requestRevision = async (req, res, next) => {
  try {
    const article = await knowledgeService.requestRevision(req.params.id, req.body.reason, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Revision requested', data: article });
  } catch (err) {
    next(err);
  }
};

export const approveArticle = async (req, res, next) => {
  try {
    const article = await knowledgeService.approveArticle(req.params.id, req.user, req);
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
    const article = await knowledgeService.publishArticle(req.params.id, req.user, req);
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
    const isHelpful = req.body.helpful === true || req.body.helpful === 'yes';
    const article = await knowledgeService.rateArticle(req.params.id, isHelpful, req.user, req);
    res.status(HTTP.OK).json({ success: true, message: 'Thanks for your feedback', data: article });
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

export const getCategories = async (_req, res, next) => {
  try {
    const data = await knowledgeService.getCategories();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const listCategories = async (_req, res, next) => {
  try {
    const data = await knowledgeService.listCategories();
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

export const createVersion = async (req, res, next) => {
  try {
    const data = await knowledgeService.createVersion(req.params.id, req.body, req.user, req);
    res.status(HTTP.CREATED).json({ success: true, message: 'Version created', data });
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

export const searchArticles = async (req, res, next) => {
  try {
    const result = await knowledgeService.searchArticles(req.query.q || req.query.search || '', req.user, Number(req.query.limit) || 10, req.query.excludeId || '');
    res.status(HTTP.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

