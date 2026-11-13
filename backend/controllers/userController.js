import * as userService from '../services/userService.js';
import * as departmentService from '../services/departmentService.js';
import { sendDirectEmail as sendDirectEmailService } from '../services/emailService.js';
import pool from '../config/db.js';
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
    let profileImage = req.file ? `/uploads/users/${req.file.filename}` : undefined;
    if (req.body.removeProfileImage === 'true' || req.body.removeProfileImage === true || req.body.profileImage === '') {
      profileImage = null;
    }
    const rawDeptId = req.body.departmentId;
    const departmentId = rawDeptId !== undefined
      ? (typeof rawDeptId === 'string' && rawDeptId.trim() ? rawDeptId.trim() : null)
      : undefined;

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
    }, req.user?.id);

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
    const user = await userService.deactivateUser(req.params.id, req.user?.id);
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

export const sendDirectEmail = async (req, res, next) => {
  try {
    const { to, toName, subject, message, ticketId } = req.body;
    const userRole = req.user?.role;

    // Authorization:
    // - Admin and CEO can notify / send email to any tenant or user.
    // - Department Manager can notify the tenant ONLY IF:
    //   1) ticketId is provided
    //   2) The ticket was created by / belongs to a tenant
    //   3) The ticket belongs to one of the manager's assigned departments (or direct routing)
    //   4) Recipient matches the tenant or creator on that ticket
    // - All other roles (tenant, staff, etc.) are strictly forbidden.
    if (userRole !== 'admin' && userRole !== 'ceo') {
      if (userRole === 'manager') {
        if (!ticketId) {
          return res.status(HTTP.FORBIDDEN).json({
            success: false,
            message: 'Department Managers can only dispatch notifications for specific tickets in their assigned department.',
          });
        }

        const [ticketRows] = await pool.query(
          `SELECT t.id, t.tenant_id, t.department_id, t.routing_type, t.category,
                  tn.email AS tenant_email, u.email AS creator_email
           FROM tickets t
           LEFT JOIN tenants tn ON tn.id = t.tenant_id
           LEFT JOIN users u ON u.id = t.created_by
           WHERE t.id = :ticketId LIMIT 1`,
          { ticketId }
        );

        if (!ticketRows.length) {
          return res.status(HTTP.NOT_FOUND).json({
            success: false,
            message: 'Ticket not found.',
          });
        }

        const tkt = ticketRows[0];
        const isTenantTicket = Boolean(tkt.tenant_id || tkt.tenant_email);
        if (!isTenantTicket) {
          return res.status(HTTP.FORBIDDEN).json({
            success: false,
            message: 'Access denied. This ticket was not created by a tenant.',
          });
        }

        const managerDeptIds = (req.user.departments || []).map((d) => d.id);
        const matchesDept = Boolean(tkt.department_id && managerDeptIds.includes(tkt.department_id));
        const isDirect = tkt.routing_type === 'direct';

        if (!matchesDept && !isDirect) {
          return res.status(HTTP.FORBIDDEN).json({
            success: false,
            message: 'Access denied. You can only notify tenants for tickets assigned to your department.',
          });
        }

        const allowedEmails = [tkt.tenant_email, tkt.creator_email].filter(Boolean).map((e) => e.toLowerCase());
        if (allowedEmails.length > 0 && !allowedEmails.includes(to.toLowerCase())) {
          return res.status(HTTP.FORBIDDEN).json({
            success: false,
            message: 'Access denied. The specified recipient does not match the ticket tenant.',
          });
        }
      } else {
        return res.status(HTTP.FORBIDDEN).json({
          success: false,
          message: 'Access denied. Only Administrators and authorized Department Managers can send official notifications to tenants.',
        });
      }
    }

    const senderName = req.user
      ? `${req.user.first_name || req.user.firstName || ''} ${req.user.last_name || req.user.lastName || ''}`.trim() || req.user.username
      : 'Help Desk Admin';
    const senderEmail = req.user?.email || process.env.EMAIL_USER;

    const result = await sendDirectEmailService({
      to,
      toName,
      subject,
      message,
      senderName,
      senderEmail,
    });

    // Record an in-app notification if the recipient has a registered user account
    try {
      const [userMatch] = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER(:to) LIMIT 1`,
        { to }
      );
      if (userMatch.length > 0) {
        const recipientUserId = userMatch[0].id;
        if (recipientUserId !== req.user?.id) {
          const notificationRepo = await import('../repository/notificationRepository.js');
          await notificationRepo.createNotification(
            recipientUserId,
            subject,
            message,
            'message',
            ticketId || null
          );
        }
      }
    } catch (notifErr) {
      console.warn('[sendDirectEmail] In-app notification creation skipped:', notifErr.message);
    }

    res.status(HTTP.OK).json({
      success: true,
      message: result?.simulated
        ? (result.warning || 'Email recorded successfully in development environment.')
        : 'Email sent successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};