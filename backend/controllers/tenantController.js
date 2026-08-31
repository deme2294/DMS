import * as tenantService from '../services/tenantService.js';
import { HTTP } from '../config/constants.js';

export const getTenants = async (req, res, next) => {
  try {
    const result = await tenantService.listTenants({
      search: req.query.search,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });

    res.status(HTTP.OK).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getTenantById = async (req, res, next) => {
  try {
    const data = await tenantService.getTenantWithUsers(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createTenant = async (req, res, next) => {
  try {
    const result = await tenantService.createTenant(req.body, { createdBy: req.user?.id });
    res.status(HTTP.CREATED).json(result);
  } catch (err) {
    next(err);
  }
};

export const registerTenant = async (req, res, next) => {
  try {
    const result = await tenantService.registerTenant(req.body);
    res.status(HTTP.CREATED).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateTenant = async (req, res, next) => {
  try {
    const data = await tenantService.updateTenant(req.params.id, req.body);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Tenant updated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteTenant = async (req, res, next) => {
  try {
    await tenantService.deleteTenant(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Tenant deleted' });
  } catch (err) {
    next(err);
  }
};

export const activateTenant = async (req, res, next) => {
  try {
    const data = await tenantService.activateTenant(req.params.id);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Tenant activated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deactivateTenant = async (req, res, next) => {
  try {
    const data = await tenantService.deactivateTenant(req.params.id);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Tenant deactivated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const approveTenant = async (req, res, next) => {
  try {
    const data = await tenantService.approveTenant(req.params.id);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Tenant approved',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyProfile = async (req, res, next) => {
  try {
    const data = await tenantService.getMyTenantProfile(req.user);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const data = await tenantService.updateMyTenantProfile(req.user, req.body);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Profile updated',
      data,
    });
  } catch (err) {
    next(err);
  }
};
