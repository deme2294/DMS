import * as categoryService from '../services/categoryService.js';
import { HTTP } from '../config/constants.js';

const normalizeCategory = (category) => {
  if (!category) return null;
  const { is_active, ...rest } = category;
  return { ...rest, isActive: Boolean(is_active) };
};

const normalizeCategories = (categories) => categories.map(normalizeCategory);

export const getCategories = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && ['admin', 'manager'].includes(req.user?.role);
    const data = await categoryService.listCategories(includeInactive);
    res.status(HTTP.OK).json({ success: true, data: normalizeCategories(data) });
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const data = await categoryService.getCategory(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const data = req.user.role === 'manager'
      ? await categoryService.requestCategory(req.user, req.body)
      : await categoryService.createCategory(req.user, req.body);
    res.status(HTTP.CREATED).json({ success: true, message: 'Category created', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const data = await categoryService.updateCategory(req.user, req.params.id, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Category updated', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const approveCategory = async (req, res, next) => {
  try {
    const data = await categoryService.approveCategory(req.user, req.params.id, req.body.reviewNotes);
    res.status(HTTP.OK).json({ success: true, message: 'Category approved', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const rejectCategory = async (req, res, next) => {
  try {
    const data = await categoryService.rejectCategory(req.user, req.params.id, req.body.reviewNotes);
    res.status(HTTP.OK).json({ success: true, message: 'Category rejected', data: normalizeCategory(data) });
  } catch (err) {
    next(err);
  }
};

export const listRequests = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || null;
    const data = await categoryService.listRequests(statusFilter);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
