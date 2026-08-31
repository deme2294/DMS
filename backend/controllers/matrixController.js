import * as matrixService from '../services/matrixService.js';
import * as departmentService from '../services/departmentService.js';
import { HTTP } from '../config/constants.js';

export const getAssignments = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    let isManager = false;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
      isManager = true;
    }
    const result = await matrixService.listAssignments({
      search: req.query.search,
      userId: req.query.userId,
      departmentId: req.query.departmentId,
      departmentIds: managerDepartmentIds,
      isManager,
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

export const getAssignmentById = async (req, res, next) => {
  try {
    const data = await matrixService.getAssignment(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMatrixGrid = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.getMatrixGrid(managerDepartmentIds);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const assignUserToDepartment = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.assignUserToDepartment(
      req.body.userId,
      req.body.departmentId || null,
      managerDepartmentIds
    );
    res.status(HTTP.OK).json({
      success: true,
      message: 'User department updated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const assignDepartmentToUser = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.assignDepartmentToUser(
      req.body.departmentId || null,
      req.body.userId,
      managerDepartmentIds
    );
    res.status(HTTP.OK).json({
      success: true,
      message: 'Department user updated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const createAssignment = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.createAssignment(req.body, managerDepartmentIds);
    res.status(HTTP.CREATED).json({
      success: true,
      message: 'Assignment created',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const toggleAssignment = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.toggleAssignment(req.body, managerDepartmentIds);
    res.status(HTTP.OK).json({
      success: true,
      message: req.body.assigned ? 'Assignment added' : 'Assignment removed',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateAssignment = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const data = await matrixService.updateAssignment(req.params.id, req.body, managerDepartmentIds);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Assignment updated',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteAssignment = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    await matrixService.deleteAssignment(req.params.id, managerDepartmentIds);
    res.status(HTTP.OK).json({ success: true, message: 'Assignment deleted' });
  } catch (err) {
    next(err);
  }
};

export const deleteAssignmentByPair = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    await matrixService.deleteAssignmentByPair(
      req.params.userId,
      req.params.departmentId,
      managerDepartmentIds
    );
    res.status(HTTP.OK).json({ success: true, message: 'Assignment deleted' });
  } catch (err) {
    next(err);
  }
};