import { v4 as uuidv4 } from 'uuid';
import * as noticeRepo from '../repository/noticeRepository.js';
import * as userRepo from '../repository/userRepository.js';
import * as notificationService from './notificationService.js';
import * as departmentService from './departmentService.js';
import pool from '../config/db.js';

const isPublished = (status) => status === 'published';

/**
 * Resolve the audience for a notice and persist recipient rows, then notify
 * every recipient via in-app notification + email.
 */
export const publishNotice = async (notice) => {
  const audience = notice.targetAudience || notice.target_audience || 'all';
  const departmentId = notice.departmentId || notice.department_id || null;
  const assignedTo = notice.assignedTo || notice.assigned_to || null;

  let recipients = [];

  if (assignedTo) {
    const assignedUser = await userRepo.findById(assignedTo);
    if (assignedUser) {
      recipients = [assignedUser];
    }
  } else if (audience === 'department' && departmentId) {
    const [deptUsers] = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.username, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN user_departments ud ON ud.user_id = u.id
       LEFT JOIN departments d ON d.head_user_id = u.id
       WHERE (ud.department_id = ? OR d.id = ?) AND u.status = 'active'
       ORDER BY u.first_name ASC`,
      [departmentId, departmentId]
    );
    recipients = deptUsers;
  } else if (audience === 'staff') {
    if (departmentId) {
      recipients = await noticeRepo.getStaffInDepartment(departmentId);
    } else {
      recipients = await userRepo.getAudienceUsers('staff');
    }
  } else if (audience === 'manager') {
    if (departmentId) {
      const [mgrUsers] = await pool.query(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.username, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN user_departments ud ON ud.user_id = u.id
         LEFT JOIN departments d ON d.head_user_id = u.id
         WHERE (ud.department_id = ? OR d.id = ?) AND r.name = 'manager' AND u.status = 'active'`,
        [departmentId, departmentId]
      );
      recipients = mgrUsers;
    } else {
      recipients = await userRepo.getAudienceUsers('manager');
    }
  } else if (audience === 'all') {
    recipients = await userRepo.getAudienceUsers('all');
  } else {
    recipients = await userRepo.getAudienceUsers(audience);
  }

  const userIds = recipients.map((r) => r.id);

  await pool.query(
    `UPDATE notices SET published_at = COALESCE(published_at, NOW()) WHERE id = ?`,
    [notice.id]
  );

  if (userIds.length > 0) {
    await noticeRepo.addRecipients(notice.id, userIds);
    await notificationService.notifyNoticePublished(notice, recipients);
  }
  return userIds.length;
};

export const listNotices = async (filters) => {
  await noticeRepo.archiveExpiredNotices();
  const result = await noticeRepo.findAll(filters);
  const data = result.data.map((n) => ({
    ...n,
    recipientCounts: {
      total: Number(n.recipient_total) || 0,
      acknowledged: Number(n.recipient_acknowledged) || 0,
    },
  }));
  return { ...result, data };
};

export const getNotice = async (id) => {
  const notice = await noticeRepo.findById(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });
  if (notice.created_by) {
    const creatorDeptIds = await departmentService.getMyDepartmentIds(notice.created_by);
    if (creatorDeptIds.length) {
      const placeholders = creatorDeptIds.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT d.id, d.name, d.code FROM departments d WHERE d.id IN (${placeholders}) AND d.status = 'active'`,
        creatorDeptIds
      );
      notice.creatorDepartments = rows;
    } else {
      notice.creatorDepartments = [];
    }
  } else {
    notice.creatorDepartments = [];
  }
  return notice;
};

export const createNotice = async (data, userId, userRole = 'admin') => {
  let departmentId = data.departmentId || null;

  if (data.targetAudience === 'department') {
    const creatorDeptIds = await departmentService.getMyDepartmentIds(userId);
    if (!creatorDeptIds || creatorDeptIds.length === 0) {
      throw Object.assign(
        new Error('You must be assigned to a department to create department-targeted notices'),
        { statusCode: 400 }
      );
    }
    if (departmentId) {
      if (!creatorDeptIds.includes(departmentId)) {
        throw Object.assign(
          new Error("Department notices can only target the creator's own department"),
          { statusCode: 403 }
        );
      }
    } else {
      if (creatorDeptIds.length === 1) {
        departmentId = creatorDeptIds[0];
      } else {
        throw Object.assign(
          new Error("Please select one of your assigned departments"),
          { statusCode: 400 }
        );
      }
    }
  }

  const isPub = isPublished(data.status || 'draft');
  const notice = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    image: data.image || null,
    attachment: data.attachment || null,
    attachmentName: data.attachmentName || null,
    priority: data.priority || 'medium',
    status: data.status || 'draft',
    targetAudience: data.targetAudience || 'all',
    departmentId,
    assignedTo: data.assignedTo || null,
    assignedBy: data.assignedTo ? userId : null,
    creatorRole: userRole,
    expiresAt: data.expiresAt || null,
    publishedAt: isPub ? new Date() : null,
    createdBy: userId,
  };
  await noticeRepo.create(notice);

  if (isPublished(notice.status)) {
    await publishNotice(notice);
  }
  return await noticeRepo.findById(notice.id);
};

export const updateNotice = async (id, data, updaterId = null, updaterRole = null) => {
  const existing = await noticeRepo.findById(id);
  if (!existing) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  // Authorization check - creator, admin, or ceo can update
  if (updaterRole && updaterRole !== 'admin' && updaterRole !== 'ceo' && existing.created_by !== updaterId) {
    throw Object.assign(
      new Error('You can only update notices you created'),
      { statusCode: 403 }
    );
  }

  const effectiveAudience = data.targetAudience !== undefined ? data.targetAudience : existing.target_audience;
  if (effectiveAudience === 'department') {
    const creatorId = existing.created_by || updaterId;
    const creatorDeptIds = await departmentService.getMyDepartmentIds(creatorId);
    if (!creatorDeptIds || creatorDeptIds.length === 0) {
      throw Object.assign(
        new Error('The notice creator is not assigned to any department'),
        { statusCode: 400 }
      );
    }
    const targetDeptId = data.departmentId !== undefined ? data.departmentId : existing.department_id;
    if (targetDeptId) {
      if (!creatorDeptIds.includes(targetDeptId)) {
        throw Object.assign(
          new Error("Department notices can only target the creator's own department"),
          { statusCode: 403 }
        );
      }
    } else {
      if (creatorDeptIds.length === 1) {
        data.departmentId = creatorDeptIds[0];
      } else {
        throw Object.assign(
          new Error("Please select one of the creator's assigned departments"),
          { statusCode: 400 }
        );
      }
    }
  }

  const allowed = [
    'title', 'description', 'image', 'attachment', 'attachmentName',
    'priority', 'status', 'targetAudience', 'departmentId',
    'assignedTo', 'assignedBy', 'creatorRole', 'expiresAt',
    'publishedAt', 'published_at'
  ];
  const updateData = {};
  Object.keys(data).forEach((key) => {
    if (allowed.includes(key)) updateData[key] = data[key];
  });

  if (data.assignedTo && data.assignedTo !== existing.assigned_to && updaterId) {
    updateData.assignedBy = updaterId;
  }

  const wasPublished = isPublished(existing.status);
  const willBePublished = isPublished(updateData.status || existing.status);
  if (!wasPublished && willBePublished && !updateData.published_at && !updateData.publishedAt) {
    updateData.published_at = new Date();
  }
  const audienceOrDeptChanged = (
    (updateData.targetAudience && updateData.targetAudience !== existing.target_audience) ||
    (updateData.departmentId !== undefined && updateData.departmentId !== existing.department_id) ||
    (updateData.assignedTo !== undefined && updateData.assignedTo !== existing.assigned_to)
  );

  if (Object.keys(updateData).length) {
    await noticeRepo.update(id, updateData);
  }

  const updated = await noticeRepo.findById(id);

  // Notify recipients if newly published or if audience/department updated on a published notice
  if ((!wasPublished && willBePublished) || (willBePublished && audienceOrDeptChanged)) {
    await publishNotice(updated);
  }
  return updated;
};

export const deleteNotice = async (id, userId = null, userRole = null) => {
  const notice = await noticeRepo.findById(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  // Authorization check - creator, admin, or ceo can delete
  if (userRole && userRole !== 'admin' && userRole !== 'ceo' && notice.created_by !== userId) {
    throw Object.assign(
      new Error('You can only delete notices you created'),
      { statusCode: 403 }
    );
  }

  await noticeRepo.remove(id);
};

export const acknowledgeNotice = async (id, userId) => {
  const notice = await noticeRepo.findById(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });
  if (!isPublished(notice.status)) {
    throw Object.assign(new Error('Only published notices can be acknowledged'), { statusCode: 400 });
  }
  await noticeRepo.acknowledge(id, userId);
  return { acknowledged: true };
};

export const getNoticeRecipients = async (id) => {
  const notice = await noticeRepo.findById(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });
  return noticeRepo.getRecipients(id);
};

export const getNoticeRecipientCounts = async (id) => {
  const notice = await noticeRepo.findById(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });
  return noticeRepo.getRecipientCounts(id);
};

export const getMyAcknowledgedNoticeIds = async (userId) => {
  return noticeRepo.getMyAcknowledgedNoticeIds(userId);
};

export const getActiveNotices = async () => {
  return noticeRepo.getActiveNotices();
};

export const getNoticeCategories = async () => {
  return noticeRepo.getDistinctCategories();
};

/**
 * Scheduled job: for every published notice whose expiry has passed and that
 * has not yet been warned, send an "action required" warning to every
 * recipient who has NOT acknowledged it (in-app + email), then archive the
 * notice so it is automatically removed from the active view.
 *
 * Returns the number of notices processed.
 */
export const processExpirations = async () => {
  const expiring = await noticeRepo.findExpiringNotices();
  let processed = 0;

  for (const notice of expiring) {
    try {
      const unacknowledged = await noticeRepo.getUnacknowledgedRecipients(notice.id);
      if (unacknowledged.length) {
        await notificationService.notifyNoticeExpiryWarning(notice, unacknowledged);
      }
    } catch (notifyErr) {
      console.error(`[NOTICES] Expiry warning notification error for "${notice.title}":`, notifyErr.message);
    }
    await noticeRepo.setExpiryWarned(notice.id);
    await noticeRepo.archiveNotice(notice.id);
    processed += 1;
    console.log(`[NOTICES] Expired notice "${notice.title}" — archived.`);
  }

  // Also clean up any lingering expired published notices
  await noticeRepo.archiveExpiredNotices();

  return processed;
};

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED & TARGETED NOTICES FOR STAFF & MANAGER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get notices for a specific user based on their role and department
 * Used by staff/manager to see notices targeted to them
 */
export const getNoticesForUser = async (userId, userRole, userDepartmentId, filters = {}) => {
  await noticeRepo.archiveExpiredNotices();
  const result = await noticeRepo.findNoticesForUser(userId, userRole, userDepartmentId, filters);
  
  return {
    data: result.data.map((n) => ({
      ...n,
      creatorName: n.creator_first_name && n.creator_last_name 
        ? `${n.creator_first_name} ${n.creator_last_name}`
        : 'Unknown',
      assignedToName: n.assigned_first_name && n.assigned_last_name
        ? `${n.assigned_first_name} ${n.assigned_last_name}`
        : null,
      isAcknowledged: Boolean(n.is_acknowledged),
      acknowledgedAt: n.acknowledged_at
    })),
    pagination: result.pagination
  };
};

/**
 * Create targeted notice (used by admin, manager, or staff)
 * - Admin can target anyone
 * - Manager can target staff in their department, all department members, or Admin
 * - Staff can target their Department Head (manager)
 */
export const createTargetedNotice = async (data, creatorId, creatorRole) => {
  if (creatorRole === 'manager') {
    if (data.targetAudience !== 'staff' && data.targetAudience !== 'department' && data.targetAudience !== 'admin') {
      throw Object.assign(
        new Error('Managers can only create notices for staff, their department, or System Admin'),
        { statusCode: 403 }
      );
    }
  } else if (creatorRole === 'staff') {
    if (data.targetAudience && data.targetAudience !== 'manager') {
      throw Object.assign(
        new Error('Staff members can only create notices for their Department Head'),
        { statusCode: 403 }
      );
    }
    data.targetAudience = 'manager';
  } else if (creatorRole !== 'admin') {
    throw Object.assign(
      new Error('Unauthorized to create notices'),
      { statusCode: 403 }
    );
  }

  let departmentId = data.departmentId || null;
  let assignedTo = data.assignedTo || null;

  if (creatorRole === 'staff') {
    const staffDeptIds = await departmentService.getMyDepartmentIds(creatorId);
    if (!staffDeptIds || staffDeptIds.length === 0) {
      throw Object.assign(
        new Error('You must be assigned to a department to send notices to your Department Head'),
        { statusCode: 400 }
      );
    }
    departmentId = staffDeptIds[0];
  } else if (creatorRole === 'manager' && data.targetAudience === 'admin') {
    const managerDepartmentIds = await departmentService.getMyDepartmentIds(creatorId);
    if (managerDepartmentIds.length > 0) {
      departmentId = data.departmentId || managerDepartmentIds[0];
    }
  } else if (data.targetAudience === 'department') {
    const creatorDeptIds = await departmentService.getMyDepartmentIds(creatorId);
    if (!creatorDeptIds || creatorDeptIds.length === 0) {
      throw Object.assign(
        new Error('You must be assigned to a department to create department-targeted notices'),
        { statusCode: 400 }
      );
    }
    if (departmentId) {
      if (!creatorDeptIds.includes(departmentId)) {
        throw Object.assign(
          new Error("Department notices can only target your own assigned department"),
          { statusCode: 403 }
        );
      }
    } else {
      if (creatorDeptIds.length === 1) {
        departmentId = creatorDeptIds[0];
      } else {
        throw Object.assign(
          new Error("Please select one of your assigned departments"),
          { statusCode: 400 }
        );
      }
    }
  } else if (creatorRole === 'manager' && data.targetAudience === 'staff') {
    const managerDepartmentIds = await departmentService.getMyDepartmentIds(creatorId);
    if (assignedTo) {
      const staffUser = await userRepo.findById(assignedTo);
      if (!staffUser) {
        throw Object.assign(new Error('Staff user not found'), { statusCode: 404 });
      }
      const staffDeptIds = (staffUser.departments || []).map((d) => d.id);
      const hasAccess = staffDeptIds.some((id) => managerDepartmentIds.includes(id));
      if (!hasAccess) {
        throw Object.assign(
          new Error('You can only assign notices to staff in your department'),
          { statusCode: 403 }
        );
      }
    } else {
      if (managerDepartmentIds.length === 0) {
        throw Object.assign(
          new Error('You do not manage any departments'),
          { statusCode: 403 }
        );
      }
      if (managerDepartmentIds.length === 1) {
        departmentId = managerDepartmentIds[0];
      } else if (!departmentId || !managerDepartmentIds.includes(departmentId)) {
        throw Object.assign(
          new Error('Please select a specific department for staff targeting'),
          { statusCode: 400 }
        );
      }
    }
  }

  const notice = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    image: data.image || null,
    attachment: data.attachment || null,
    attachmentName: data.attachmentName || null,
    priority: data.priority || 'medium',
    status: data.status || 'published',
    targetAudience: data.targetAudience || 'staff',
    departmentId,
    assignedTo,
    assignedBy: assignedTo ? creatorId : null,
    expiresAt: data.expiresAt || null,
    publishedAt: isPublished(data.status || 'published') ? new Date() : null,
    createdBy: creatorId,
    creatorRole: creatorRole
  };

  await noticeRepo.createTargetedNotice(notice);

  if (isPublished(notice.status)) {
    await publishTargetedNotice(notice);
  }

  return await noticeRepo.findByIdWithDetails(notice.id);
};

/**
 * Publish a targeted notice - resolve recipients based on target audience
 */
const publishTargetedNotice = async (notice) => {
  let recipients = [];

  if (notice.assignedTo) {
    // Specific assignment - only notify that user
    const assignedUser = await userRepo.findById(notice.assignedTo);
    if (assignedUser) {
      recipients = [assignedUser];
    }
  } else if (notice.targetAudience === 'department' && notice.departmentId) {
    // Department-specific - get all users in that department
    const [deptUsers] = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.username, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN user_departments ud ON ud.user_id = u.id
       LEFT JOIN departments d ON d.head_user_id = u.id
       WHERE (ud.department_id = ? OR d.id = ?) AND u.status = 'active'
       ORDER BY u.first_name ASC`,
      [notice.departmentId, notice.departmentId]
    );
    recipients = deptUsers;
  } else if (notice.targetAudience === 'staff') {
    if (notice.departmentId) {
      recipients = await noticeRepo.getStaffInDepartment(notice.departmentId);
    } else {
      recipients = await userRepo.getAudienceUsers('staff');
    }
  } else if (notice.targetAudience === 'manager') {
    if (notice.departmentId) {
      const [mgrUsers] = await pool.query(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.username, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN user_departments ud ON ud.user_id = u.id
         LEFT JOIN departments d ON d.head_user_id = u.id
         WHERE (ud.department_id = ? OR d.id = ?) AND r.name = 'manager' AND u.status = 'active'`,
        [notice.departmentId, notice.departmentId]
      );
      recipients = mgrUsers;
    } else {
      recipients = await userRepo.getAudienceUsers('manager');
    }
  } else if (notice.targetAudience === 'admin') {
    recipients = await userRepo.getAudienceUsers('admin');
  } else if (notice.targetAudience === 'all') {
    // All users
    recipients = await userRepo.getAudienceUsers('all');
  } else {
    // Specific role
    recipients = await userRepo.getAudienceUsers(notice.targetAudience);
  }

  const userIds = recipients.map((r) => r.id);
  
  await pool.query(
    `UPDATE notices SET published_at = COALESCE(published_at, NOW()) WHERE id = ?`,
    [notice.id]
  );

  if (userIds.length > 0) {
    await noticeRepo.addRecipients(notice.id, userIds);
    await notificationService.notifyNoticePublished(notice, recipients);
  }

  return userIds.length;
};

/**
 * Route / forward a notice to System Admin (by department manager)
 */
export const routeNoticeToAdmin = async (noticeId, managerId, remarks = '') => {
  const notice = await noticeRepo.findByIdWithDetails(noticeId);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  const manager = await userRepo.findById(managerId);
  const managerName = manager ? `${manager.first_name} ${manager.last_name}` : 'Department Head';

  const adminUsers = await userRepo.getAudienceUsers('admin');
  const adminIds = adminUsers.map((a) => a.id);

  if (adminIds.length > 0) {
    await noticeRepo.addRecipients(noticeId, adminIds);
  }

  const remarkMessage = remarks?.trim()
    ? `[Routed to System Admin] Department Head (${managerName}): ${remarks.trim()}`
    : `[Routed to System Admin] Notice routed to System Administrator by Department Head (${managerName}).`;

  await noticeRepo.createNoticeReply({
    id: uuidv4(),
    noticeId,
    userId: managerId,
    message: remarkMessage,
    visibility: 'all',
    attachmentPath: null,
    attachmentName: null,
    attachmentSize: null,
  });

  if (adminUsers.length > 0) {
    await notificationService.notifyNoticePublished(
      { ...notice, title: `[Department Notice Routed] ${notice.title}` },
      adminUsers
    );
  }

  return await noticeRepo.findByIdWithDetails(noticeId);
};

/**
 * Update targeted notice
 */
export const updateTargetedNotice = async (id, data, updaterId, updaterRole) => {
  const existing = await noticeRepo.findByIdWithDetails(id);
  if (!existing) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  // Authorization check - only creator or admin can update
  if (updaterRole !== 'admin' && updaterRole !== 'ceo' && existing.created_by !== updaterId) {
    throw Object.assign(
      new Error('You can only update notices you created'),
      { statusCode: 403 }
    );
  }

  const effectiveAudience = data.targetAudience !== undefined ? data.targetAudience : existing.target_audience;
  if (effectiveAudience === 'department') {
    const creatorId = existing.created_by || updaterId;
    const creatorDeptIds = await departmentService.getMyDepartmentIds(creatorId);
    if (!creatorDeptIds || creatorDeptIds.length === 0) {
      throw Object.assign(
        new Error('The notice creator is not assigned to any department'),
        { statusCode: 400 }
      );
    }
    const targetDeptId = data.departmentId !== undefined ? data.departmentId : existing.department_id;
    if (targetDeptId) {
      if (!creatorDeptIds.includes(targetDeptId)) {
        throw Object.assign(
          new Error("Department notices can only target the creator's own department"),
          { statusCode: 403 }
        );
      }
    } else {
      if (creatorDeptIds.length === 1) {
        data.departmentId = creatorDeptIds[0];
      } else {
        throw Object.assign(
          new Error("Please select one of the creator's assigned departments"),
          { statusCode: 400 }
        );
      }
    }
  }

  const allowed = [
    'title', 'description', 'image', 'attachment', 'attachmentName',
    'priority', 'status', 'targetAudience', 'departmentId',
    'assignedTo', 'assignedBy', 'expiresAt',
    'publishedAt', 'published_at'
  ];
  
  const updateData = {};
  Object.keys(data).forEach((key) => {
    if (allowed.includes(key)) updateData[key] = data[key];
  });

  // Track assignment changes
  if (data.assignedTo && data.assignedTo !== existing.assigned_to) {
    updateData.assignedBy = updaterId;
  }

  const wasPublished = isPublished(existing.status);
  const willBePublished = isPublished(updateData.status);
  if (!wasPublished && willBePublished && !updateData.published_at && !updateData.publishedAt) {
    updateData.published_at = new Date();
  }

  if (Object.keys(updateData).length) {
    await noticeRepo.updateTargetedNotice(id, updateData);
  }

  const updated = await noticeRepo.findByIdWithDetails(id);

  // Notify recipients if newly published
  if (!wasPublished && willBePublished) {
    await publishTargetedNotice(updated);
  }

  return updated;
};

/**
 * Get notices created by a specific user (for managers to see their notices)
 */
export const getNoticesByCreator = async (creatorId, filters = {}) => {
  await noticeRepo.archiveExpiredNotices();
  const result = await noticeRepo.findNoticesByCreator(creatorId, filters);
  
  return {
    data: result.data.map((n) => ({
      ...n,
      assignedToName: n.assigned_first_name && n.assigned_last_name
        ? `${n.assigned_first_name} ${n.assigned_last_name}`
        : null,
      recipientCounts: {
        total: Number(n.recipient_total) || 0,
        acknowledged: Number(n.recipient_acknowledged) || 0
      },
      replyCount: Number(n.reply_count) || 0
    })),
    pagination: result.pagination
  };
};

/**
 * Update expiration date for an existing notice (manager, admin, or creator)
 * If the entered expiration date is already in the past, automatically archive it immediately.
 */
export const updateNoticeExpiry = async (noticeId, expiresAt, userId, userRole) => {
  const notice = await noticeRepo.findByIdWithDetails(noticeId);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  if (userRole !== 'admin' && userRole !== 'ceo' && notice.created_by !== userId) {
    if (userRole === 'manager') {
      const managerDeptIds = await departmentService.getMyDepartmentIds(userId);
      const isDeptNotice = notice.department_id && managerDeptIds.includes(notice.department_id);
      const isAssigned = notice.assigned_to === userId || notice.assigned_by === userId;
      if (!isDeptNotice && !isAssigned) {
        throw Object.assign(new Error('You can only update expiration for notices in your department'), { statusCode: 403 });
      }
    } else {
      throw Object.assign(new Error('Unauthorized to update notice expiration'), { statusCode: 403 });
    }
  }

  let formattedExpiry = null;
  let isPast = false;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!isNaN(d.getTime())) {
      formattedExpiry = d.toISOString().slice(0, 19).replace('T', ' ');
      isPast = d.getTime() <= Date.now();
    }
  }

  const newStatus = isPast ? 'archived' : notice.status;

  await noticeRepo.updateTargetedNotice(noticeId, {
    expiresAt: formattedExpiry,
    status: newStatus,
  });

  return await noticeRepo.findByIdWithDetails(noticeId);
};

/**
 * Get staff members in manager's department
 */
export const getStaffInDepartment = async (departmentId) => {
  return await noticeRepo.getStaffInDepartment(departmentId);
};

/**
 * Get departments managed by the current user
 */
export const getMyDepartments = async (userId) => {
  const departmentIds = await departmentService.getMyDepartmentIds(userId);
  if (!departmentIds.length) return [];
  const placeholders = departmentIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT d.id, d.name, d.code FROM departments d WHERE d.id IN (${placeholders}) AND d.status = 'active'`,
    departmentIds
  );
  return rows;
};

/**
 * Get notice with full details (creator, assignment info, etc.)
 */
export const getNoticeWithDetails = async (id) => {
  const notice = await noticeRepo.findByIdWithDetails(id);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });
  
  return {
    ...notice,
    creatorName: notice.creator_first_name && notice.creator_last_name
      ? `${notice.creator_first_name} ${notice.creator_last_name}`
      : 'Unknown',
    assignedToName: notice.assigned_first_name && notice.assigned_last_name
      ? `${notice.assigned_first_name} ${notice.assigned_last_name}`
      : null,
    assignedByName: notice.assigner_first_name && notice.assigner_last_name
      ? `${notice.assigner_first_name} ${notice.assigner_last_name}`
      : null
  };
};

/**
 * Assign notice to specific staff member (manager action)
 */
export const assignNoticeToStaff = async (noticeId, staffUserId, managerId) => {
  const notice = await noticeRepo.findByIdWithDetails(noticeId);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  // Verify staff user exists and is in the same department
  const staffUser = await userRepo.findById(staffUserId);
  if (!staffUser) {
    throw Object.assign(new Error('Staff user not found'), { statusCode: 404 });
  }

  await noticeRepo.updateTargetedNotice(noticeId, {
    assignedTo: staffUserId,
    assignedBy: managerId
  });

  // Add recipient and send notification
  await noticeRepo.addRecipients(noticeId, [staffUserId]);
  await notificationService.notifyNoticePublished(notice, [staffUser]);

  return await noticeRepo.findByIdWithDetails(noticeId);
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTICE REPLIES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a reply to a notice
 */
export const createNoticeReply = async (noticeId, userId, userRole, data) => {
  const notice = await noticeRepo.findById(noticeId);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  const replyId = uuidv4();
  const reply = {
    id: replyId,
    noticeId,
    userId,
    message: data.message,
    visibility: data.visibility || 'all',
    attachmentPath: data.attachmentPath || null,
    attachmentName: data.attachmentName || null,
    attachmentSize: data.attachmentSize || null,
  };

  await noticeRepo.createNoticeReply(reply);

  const savedReply = await noticeRepo.findReplyById(replyId);
  return {
    ...savedReply,
    visibility: savedReply.visibility,
    isInternal: savedReply.visibility === 'internal',
  };
};

/**
 * Get replies for a notice with visibility filtering
 */
export const getNoticeReplies = async (noticeId, userRole) => {
  const notice = await noticeRepo.findById(noticeId);
  if (!notice) throw Object.assign(new Error('Notice not found'), { statusCode: 404 });

  const replies = await noticeRepo.findRepliesByNotice(noticeId);
  const isTenant = userRole === 'tenant';

  return replies
    .filter((r) => !(isTenant && r.visibility === 'internal'))
    .map((r) => ({
      id: r.id,
      noticeId: r.notice_id,
      userId: r.user_id,
      userName: `${r.first_name} ${r.last_name}`,
      userRole: r.role,
      message: r.message,
      visibility: r.visibility,
      isInternal: r.visibility === 'internal',
      attachmentPath: r.attachment_path,
      attachmentName: r.attachment_name,
      attachmentSize: r.attachment_size,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
};

/**
 * Update a notice reply
 */
export const updateNoticeReply = async (replyId, userId, userRole, data) => {
  const reply = await noticeRepo.findReplyById(replyId);
  if (!reply) throw Object.assign(new Error('Reply not found'), { statusCode: 404 });

  if (reply.user_id !== userId && !['admin', 'ceo'].includes(userRole)) {
    throw Object.assign(new Error('You can only edit your own replies'), { statusCode: 403 });
  }

  await noticeRepo.updateNoticeReply(replyId, data.message, data.visibility);
  const updated = await noticeRepo.findReplyById(replyId);
  return {
    ...updated,
    visibility: updated.visibility,
    isInternal: updated.visibility === 'internal',
  };
};

/**
 * Delete a notice reply
 */
export const deleteNoticeReply = async (replyId, userId, userRole) => {
  const reply = await noticeRepo.findReplyById(replyId);
  if (!reply) throw Object.assign(new Error('Reply not found'), { statusCode: 404 });

  if (reply.user_id !== userId && !['admin', 'ceo'].includes(userRole)) {
    throw Object.assign(new Error('You can only delete your own replies'), { statusCode: 403 });
  }

  await noticeRepo.deleteNoticeReply(replyId);
  return { success: true };
};
