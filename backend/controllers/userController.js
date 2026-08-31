import * as userService from '../services/userService.js';
import * as departmentService from '../services/departmentService.js';
import { HTTP } from '../config/constants.js';

export const getUsers = async (req, res, next) => {
  try {
    let managerDepartmentIds = null;
    if (req.user.role === 'manager') {
      managerDepartmentIds = await departmentService.getMyDepartmentIds(req.user.id);
    }
    const result = await userService.listUsers({
      search: req.query.search,
      role: req.query.role,
      status: req.query.status,
      departmentId: req.query.departmentId,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      managerDepartmentIds,
    });
    res.status(HTTP.OK).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const profileImage = req.file ? `/uploads/users/${req.file.filename}` : null;
    const departmentId = req.body.departmentId || null;

    const user = await userService.createUser({
      tenantId: req.body.tenantId || null,
      roleId: Number(req.body.roleId),
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      status: req.body.status,
      profileImage,
      departmentId,
    });

    res.status(HTTP.CREATED).json({ success: true, message: 'User created', data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const profileImage = req.file ? `/uploads/users/${req.file.filename}` : undefined;
    const departmentId = req.body.departmentId !== undefined ? req.body.departmentId : undefined;

    const user = await userService.updateUser(req.params.id, {
      tenantId: req.body.tenantId,
      roleId: req.body.roleId ? Number(req.body.roleId) : undefined,
      username: req.body.username,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      status: req.body.status,
      profileImage,
      departmentId,
    });

    res.status(HTTP.OK).json({ success: true, message: 'User updated', data: user });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user.id);
    res.status(HTTP.OK).json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

export const activateUser = async (req, res, next) => {
  try {
    const user = await userService.activateUser(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'User activated', data: user });
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const user = await userService.deactivateUser(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'User deactivated', data: user });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    await userService.resetUserPassword(req.params.id, req.body.newPassword, req.user.id);
    res.status(HTTP.OK).json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

export const getRoles = async (req, res, next) => {
  try {
    const roles = await userService.getRoles();
    res.status(HTTP.OK).json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
};