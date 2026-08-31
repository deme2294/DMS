import * as departmentService from '../services/departmentService.js';
import { HTTP } from '../config/constants.js';

export const getDepartments = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    let isManager = false;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
      isManager = true;
    }
    const result = await departmentService.listDepartments({
      search: req.query.search,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    }, managerDepartmentIds, isManager);
    res.status(HTTP.OK).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentById = async (req, res, next) => {
  try {
    if (req.user.role === 'manager') {
      const myDeptIds = await departmentService.getMyDepartmentIds(req.user.id);
      if (!myDeptIds.includes(req.params.id)) {
        return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Access denied to this department' });
      }
    }
    const dept = await departmentService.getDepartment(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: dept });
  } catch (err) {
    next(err);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const dept = await departmentService.createDepartment(req.body);
    res.status(HTTP.CREATED).json({
      success: true,
      message: 'Department created',
      data: dept,
    });
  } catch (err) {
    next(err);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const dept = await departmentService.updateDepartment(req.params.id, req.body);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Department updated',
      data: dept,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    await departmentService.deleteDepartment(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Department deleted' });
  } catch (err) {
    next(err);
  }
};

export const activateDepartment = async (req, res, next) => {
  try {
    const dept = await departmentService.activateDepartment(req.params.id);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Department activated',
      data: dept,
    });
  } catch (err) {
    next(err);
  }
};

export const deactivateDepartment = async (req, res, next) => {
  try {
    const dept = await departmentService.deactivateDepartment(req.params.id);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Department deactivated',
      data: dept,
    });
  } catch (err) {
    next(err);
  }
};

/** For dropdowns in Users / Matrix modules */
export const getActiveDepartments = async (req, res, next) => {
  try {
    const data = await departmentService.getActiveDepartments();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getEligibleHeads = async (req, res, next) => {
  try {
    const data = await departmentService.getEligibleHeads();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentMembers = async (req, res, next) => {
  try {
    if (req.user.role === 'manager') {
      const myDeptIds = await departmentService.getMyDepartmentIds(req.user.id);
      if (!myDeptIds.includes(req.params.id)) {
        return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Access denied to this department' });
      }
    }
    const data = await departmentService.getDepartmentMembers(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const assignDepartmentUsers = async (req, res, next) => {
  try {
    if (req.user.role === 'manager') {
      const myDeptIds = await departmentService.getMyDepartmentIds(req.user.id);
      if (!myDeptIds.includes(req.params.id)) {
        return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Access denied to this department' });
      }
    }
    const data = await departmentService.assignUsers(req.params.id, req.body.userIds || []);
    res.status(HTTP.OK).json({ success: true, message: 'Department members updated', data });
  } catch (err) {
    next(err);
  }
};
