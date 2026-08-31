import * as noticeService from '../services/noticeService.js';
import * as departmentService from '../services/departmentService.js';
import { HTTP } from '../config/constants.js';
import { authorize } from '../middleware/roleMiddleware.js';

export const getNotices = async (req, res, next) => {
  try {
    const result = await noticeService.listNotices(req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getNoticeById = async (req, res, next) => {
  try {
    const notice = await noticeService.getNotice(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: notice });
  } catch (err) {
    next(err);
  }
};

export const createNotice = async (req, res, next) => {
  try {
    const notice = await noticeService.createNotice(req.body, req.user.id, req.user.role);
    res.status(HTTP.CREATED).json({ success: true, message: 'Notice created', data: notice });
  } catch (err) {
    next(err);
  }
};

export const updateNotice = async (req, res, next) => {
  try {
    const notice = await noticeService.updateNotice(req.params.id, req.body, req.user.id);
    res.status(HTTP.OK).json({ success: true, message: 'Notice updated', data: notice });
  } catch (err) {
    next(err);
  }
};

export const deleteNotice = async (req, res, next) => {
  try {
    await noticeService.deleteNotice(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    next(err);
  }
};

export const getPublicNotices = async (req, res, next) => {
  try {
    const notices = await noticeService.getActiveNotices();
    res.status(HTTP.OK).json({ success: true, data: notices });
  } catch (err) {
    next(err);
  }
};

export const getNoticeCategories = async (_req, res, next) => {
  try {
    const data = await noticeService.getNoticeCategories();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const acknowledgeNotice = async (req, res, next) => {
  try {
    const result = await noticeService.acknowledgeNotice(req.params.id, req.user.id);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getNoticeRecipients = async (req, res, next) => {
  try {
    const data = await noticeService.getNoticeRecipients(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNoticeRecipientCounts = async (req, res, next) => {
  try {
    const data = await noticeService.getNoticeRecipientCounts(req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMyAcknowledged = async (req, res, next) => {
  try {
    const ids = await noticeService.getMyAcknowledgedNoticeIds(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: ids });
  } catch (err) {
    next(err);
  }
};

export const processExpirations = async (_req, res, next) => {
  try {
    const processed = await noticeService.processExpirations();
    res.status(HTTP.OK).json({ success: true, message: 'Expirations processed', processed });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED & TARGETED NOTICES FOR STAFF & MANAGER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get notices for the current user based on their role and department
 * Used by staff and managers to see notices targeted to them
 */
export const getMyNotices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDepartmentIds = await departmentService.getMyDepartmentIds(userId);
    
    const result = await noticeService.getNoticesForUser(userId, userRole, userDepartmentIds, req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * Create targeted notice (admin or manager)
 * Admin can target any role, manager can only target staff in their department
 */
export const createTargetedNotice = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const creatorRole = req.user.role;
    
    const notice = await noticeService.createTargetedNotice(req.body, creatorId, creatorRole);
    res.status(HTTP.CREATED).json({ 
      success: true, 
      message: 'Notice created successfully', 
      data: notice 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update targeted notice
 * Only creator or admin can update
 */
export const updateTargetedNotice = async (req, res, next) => {
  try {
    const updaterId = req.user.id;
    const updaterRole = req.user.role;
    
    const notice = await noticeService.updateTargetedNotice(
      req.params.id, 
      req.body, 
      updaterId, 
      updaterRole
    );
    res.status(HTTP.OK).json({ 
      success: true, 
      message: 'Notice updated successfully', 
      data: notice 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get notices created by the current user
 * Used by managers to see notices they've created
 */
export const getMyCreatedNotices = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const result = await noticeService.getNoticesByCreator(creatorId, req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * Get notice with full details (creator, assignment info)
 */
export const getNoticeWithDetails = async (req, res, next) => {
  try {
    const notice = await noticeService.getNoticeWithDetails(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: notice });
  } catch (err) {
    next(err);
  }
};

/**
 * Get staff members in manager's department
 * Used when manager wants to assign notice to specific staff
 */
export const getDepartmentStaff = async (req, res, next) => {
  try {
    let departmentId = req.params.departmentId;
    if (!departmentId && req.user.role === 'manager') {
      const myDeptIds = await departmentService.getMyDepartmentIds(req.user.id);
      departmentId = myDeptIds.length === 1 ? myDeptIds[0] : null;
    }

    if (!departmentId) {
      return res.status(HTTP.BAD_REQUEST).json({
        success: false,
        message: 'Department ID is required'
      });
    }

    const staff = await noticeService.getStaffInDepartment(departmentId);
    res.status(HTTP.OK).json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
};

/**
 * Get departments managed by the current user
 */
export const getMyDepartments = async (req, res, next) => {
  try {
    const departments = await noticeService.getMyDepartments(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
};

/**
 * Assign notice to specific staff member
 * Used by manager to assign admin notice to their staff
 */
export const assignNoticeToStaff = async (req, res, next) => {
  try {
    const noticeId = req.params.id;
    const staffUserId = req.body.staffUserId;
    const managerId = req.user.id;
    
    if (!staffUserId) {
      return res.status(HTTP.BAD_REQUEST).json({ 
        success: false, 
        message: 'Staff user ID is required' 
      });
    }
    
    const notice = await noticeService.assignNoticeToStaff(noticeId, staffUserId, managerId);
    res.status(HTTP.OK).json({ 
      success: true, 
      message: 'Notice assigned successfully', 
      data: notice 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get notices that can be assigned by manager
 * Shows admin notices that managers can forward to their staff
 */
export const getAssignableNotices = async (req, res, next) => {
  try {
    // Get published notices from admin targeted to manager
    const filters = {
      ...req.query,
      status: 'published',
      targetAudience: 'manager'
    };
    
    const result = await noticeService.listNotices(filters);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTICE REPLIES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a reply to a notice
 */
export const createNoticeReply = async (req, res, next) => {
  try {
    const { id: noticeId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { message, visibility, attachmentPath, attachmentName, attachmentSize } = req.body;

    const reply = await noticeService.createNoticeReply(noticeId, userId, userRole, {
      message,
      visibility,
      attachmentPath,
      attachmentName,
      attachmentSize,
    });

    res.status(HTTP.CREATED).json({ success: true, data: reply });
  } catch (err) {
    next(err);
  }
};

/**
 * Get replies for a notice
 */
export const getNoticeReplies = async (req, res, next) => {
  try {
    const { id: noticeId } = req.params;
    const userRole = req.user.role;

    const replies = await noticeService.getNoticeReplies(noticeId, userRole);
    res.status(HTTP.OK).json({ success: true, data: replies });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a notice reply
 */
export const updateNoticeReply = async (req, res, next) => {
  try {
    const { id: replyId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { message, visibility } = req.body;

    const reply = await noticeService.updateNoticeReply(replyId, userId, userRole, {
      message,
      visibility,
    });

    res.status(HTTP.OK).json({ success: true, data: reply });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a notice reply
 */
export const deleteNoticeReply = async (req, res, next) => {
  try {
    const { id: replyId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    await noticeService.deleteNoticeReply(replyId, userId, userRole);
    res.status(HTTP.OK).json({ success: true, message: 'Reply deleted' });
  } catch (err) {
    next(err);
  }
};
