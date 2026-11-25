import * as ticketService from '../services/ticketService.js';
import { HTTP, TICKET_PRIORITIES } from '../config/constants.js';
import { clientMeta } from '../services/requestContext.js';

const q = (v) => (v === '' || v === null || v === undefined ? undefined : v);

export const getTickets = async (req, res, next) => {
  try {
    const result = await ticketService.listTickets(req.user, {
      search: q(req.query.search),
      status: q(req.query.status),
      priority: q(req.query.priority),
      category: q(req.query.category),
      departmentId: q(req.query.departmentId),
      assignedTo: q(req.query.assignedTo),
      createdBy: q(req.query.createdBy),
      fromDate: q(req.query.fromDate),
      toDate: q(req.query.toDate),
      keyword: q(req.query.keyword),
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: q(req.query.sortBy),
      sortOrder: q(req.query.sortOrder),
    });
    res.status(HTTP.OK).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
};

export const getTicketById = async (req, res, next) => {
  try {
    const data = await ticketService.getTicket(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const trackTicket = async (req, res, next) => {
  try {
    const data = await ticketService.trackTicket(req.params.trackNumber);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createTicket = async (req, res, next) => {
  try {
    const files = req.files || [];
    const data = await ticketService.createTicket(req.user, req.body, files, clientMeta(req));
    res.status(HTTP.CREATED).json({ success: true, message: 'Ticket created', data });
  } catch (err) {
    next(err);
  }
};

export const updateTicket = async (req, res, next) => {
  try {
    const data = await ticketService.updateTicket(req.user, req.params.id || null, req.body, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Ticket updated', data });
  } catch (err) {
    next(err);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    const data = await ticketService.changeStatus(req.user, req.params.id || null, req.body, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Status updated', data });
  } catch (err) {
    next(err);
  }
};

export const assignDepartment = async (req, res, next) => {
  try {
    const managerId = req.body.managerId || req.body.assignedTo || null;
    const data = await ticketService.assignDepartment(
      req.user,
      req.params.id || null,
      req.body.departmentId,
      req.body.notes,
      managerId,
      clientMeta(req),
      req.body.reassignTimeMinutes,
      req.body.overrideLock
    );
    res.status(HTTP.OK).json({ success: true, message: 'Department assigned', data });
  } catch (err) {
    next(err);
  }
};

export const assignStaff = async (req, res, next) => {
  try {
    const data = await ticketService.assignStaff(
      req.user,
      req.params.id || null,
      req.body.staffId,
      req.body.notes,
      clientMeta(req),
      req.body.reassignTimeMinutes,
      req.body.overrideLock
    );
    res.status(HTTP.OK).json({ success: true, message: 'Staff assigned', data });
  } catch (err) {
    next(err);
  }
};

export const updateReassignTime = async (req, res, next) => {
  try {
    const data = await ticketService.updateReassignTime(
      req.user,
      req.params.id || null,
      req.body.reassignTimeMinutes,
      req.body.target || 'department',
      clientMeta(req)
    );
    res.status(HTTP.OK).json({ success: true, message: 'Reassign needed time updated', data });
  } catch (err) {
    next(err);
  }
};

export const acceptAssignment = async (req, res, next) => {
  try {
    const data = await ticketService.acceptAssignment(req.user, req.params.id || null, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Assignment accepted', data });
  } catch (err) {
    next(err);
  }
};

export const rejectAssignment = async (req, res, next) => {
  try {
    const data = await ticketService.rejectAssignment(req.user, req.params.id || null, req.body.reason, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Assignment rejected', data });
  } catch (err) {
    next(err);
  }
};

export const reassignStaff = async (req, res, next) => {
  try {
    const data = await ticketService.reassignStaff(req.user, req.params.id || null, req.body.staffId, req.body.notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Staff reassigned', data });
  } catch (err) {
    next(err);
  }
};

export const remindStaff = async (req, res, next) => {
  try {
    const payload = (req.body && typeof req.body === 'object') ? req.body : { notes: req.body };
    const data = await ticketService.remindStaff(req.user, req.params.id || null, payload, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: data.message, data });
  } catch (err) {
    next(err);
  }
};

export const overrideAssignment = async (req, res, next) => {
  try {
    const data = await ticketService.overrideAssignment(req.user, req.params.id || null, req.body, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Assignment attribution overridden', data });
  } catch (err) {
    next(err);
  }
};

export const escalateTicket = async (req, res, next) => {
  try {
    const data = await ticketService.escalateTicket(req.user, req.params.id || null, req.body.notes || req.body.reason, clientMeta(req), req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Ticket escalated', data });
  } catch (err) {
    next(err);
  }
};

export const getGlobalDuplicateSuggestions = async (req, res, next) => {
  try {
    const data = await ticketService.getGlobalDuplicateSuggestions(req.user, req.query.departmentId || null);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMergedTicketsLedger = async (req, res, next) => {
  try {
    const data = await ticketService.getMergedTicketsLedger(req.user, req.query.departmentId || null);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMergeCandidates = async (req, res, next) => {
  try {
    const data = await ticketService.getMergeCandidates(req.user, req.params.id || null, req.query.search);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const mergeTickets = async (req, res, next) => {
  try {
    const data = await ticketService.mergeTickets(req.user, req.params.id || null, req.body.sourceIds || [], req.body.notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Tickets merged', data });
  } catch (err) {
    next(err);
  }
};

export const closeTicket = async (req, res, next) => {
  try {
    const data = await ticketService.closeTicket(req.user, req.params.id || null, req.body.notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Ticket closed', data });
  } catch (err) {
    next(err);
  }
};

export const reopenTicket = async (req, res, next) => {
  try {
    const reason = req.body.reason || req.body.notes;
    const data = await ticketService.reopenTicket(req.user, req.params.id || null, reason, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Ticket processed successfully', data });
  } catch (err) {
    next(err);
  }
};

export const requestReopenTicket = async (req, res, next) => {
  try {
    const reason = req.body.reason || req.body.notes;
    const data = await ticketService.requestReopenTicket(req.user, req.params.id || null, reason, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Reopening request submitted for administrative approval', data });
  } catch (err) {
    next(err);
  }
};

export const approveReopenTicket = async (req, res, next) => {
  try {
    const notes = req.body.notes || req.body.reason;
    const data = await ticketService.approveReopenTicket(req.user, req.params.id || null, notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Ticket reopened successfully', data });
  } catch (err) {
    next(err);
  }
};

export const rejectReopenTicket = async (req, res, next) => {
  try {
    const notes = req.body.notes || req.body.reason;
    const data = await ticketService.rejectReopenTicket(req.user, req.params.id || null, notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Reopening request declined', data });
  } catch (err) {
    next(err);
  }
};

export const approveCompletion = async (req, res, next) => {
  try {
    const data = await ticketService.approveCompletion(
      req.user,
      req.params.id || null,
      req.body.notes,
      clientMeta(req),
      {
        rating: req.body.rating,
        feedback: req.body.feedback || req.body.message,
      }
    );
    res.status(HTTP.OK).json({ success: true, message: 'Resolution approved', data });
  } catch (err) {
    next(err);
  }
};

export const rejectCompletion = async (req, res, next) => {
  try {
    const data = await ticketService.rejectCompletion(req.user, req.params.id || null, req.body.notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Completion rejected', data });
  } catch (err) {
    next(err);
  }
};

export const markCompleted = async (req, res, next) => {
  try {
    const data = await ticketService.markCompleted(req.user, req.params.id || null, req.body.notes, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Ticket marked completed', data });
  } catch (err) {
    next(err);
  }
};

export const changePriority = async (req, res, next) => {
  try {
    const data = await ticketService.changePriority(req.user, req.params.id || null, req.body.priority, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Priority updated', data });
  } catch (err) {
    next(err);
  }
};

export const changeCategory = async (req, res, next) => {
  try {
    const data = await ticketService.changeCategory(req.user, req.params.id || null, req.body.category, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Category updated', data });
  } catch (err) {
    next(err);
  }
};

export const addInternalNote = async (req, res, next) => {
  try {
    const data = await ticketService.addInternalNote(req.user, req.params.id || null, req.body.message, req.body.attachmentId || null, req.body.departmentId || null, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Internal note added', data });
  } catch (err) {
    next(err);
  }
};

export const uploadAttachments = async (req, res, next) => {
  try {
    const comment = req.body.comment || req.body.notes || req.body.reason || null;
    const data = await ticketService.addAttachments(req.user, req.params.id || null, req.files || [], comment, clientMeta(req));
    res.status(HTTP.OK).json({ success: true, message: 'Attachments uploaded', data });
  } catch (err) {
    next(err);
  }
};

export const updateAttachment = async (req, res, next) => {
  try {
    const data = await ticketService.updateAttachment(
      req.user,
      req.params.id || null,
      req.params.attachmentId,
      req.body.comment,
      clientMeta(req)
    );
    res.status(HTTP.OK).json({ success: true, message: 'Attachment updated', data });
  } catch (err) {
    next(err);
  }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const data = await ticketService.removeAttachment(
      req.user,
      req.params.id || null,
      req.params.attachmentId,
      clientMeta(req)
    );
    res.status(HTTP.OK).json({ success: true, message: 'Attachment deleted', data });
  } catch (err) {
    next(err);
  }
};

export const addReply = async (req, res, next) => {
  try {
    const data = await ticketService.addReply(
      req.user,
      req.params.id || null,
      req.body.message,
      req.body.visibility || 'all',
      req.body.attachmentId || null,
      clientMeta(req),
      req.body.departmentIds || null,
      req.body.targetUserId || null
    );
    res.status(HTTP.CREATED).json({ success: true, message: 'Reply added', data });
  } catch (err) {
    next(err);
  }
};

export const getReplies = async (req, res, next) => {
  try {
    const data = await ticketService.getReplies(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTimeline = async (req, res, next) => {
  try {
    const data = await ticketService.getTimeline(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteTicket = async (req, res, next) => {
  try {
    await ticketService.deleteTicket(req.user, req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Ticket deleted' });
  } catch (err) {
    next(err);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === true || req.query.unread === 'true';
    const data = await ticketService.getUserNotifications(req.user.id, {
      limit: Number(req.query.limit || 20),
      offset: Number(req.query.offset || 0),
      unreadOnly,
    });
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await ticketService.getUserUnreadCount(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    await ticketService.markNotificationAsRead(req.params.id || null, req.user.id);
    res.status(HTTP.OK).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await ticketService.markAllNotificationsAsRead(req.user.id);
    res.status(HTTP.OK).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    await ticketService.deleteNotification(req.params.id || null, req.user.id);
    res.status(HTTP.OK).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (_req, res, next) => {
  try {
    const data = await ticketService.getCategories();
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentManagers = async (req, res, next) => {
  try {
    const data = await ticketService.getDepartmentManagers(req.params.departmentId);
    res.status(HTTP.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export { TICKET_PRIORITIES };

