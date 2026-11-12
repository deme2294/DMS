import { v4 as uuidv4 } from 'uuid';
import * as feedbackRepo from '../repository/feedbackRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import pool from '../config/db.js';
import { sendFeedbackAlertEmail, sendFeedbackResponseEmail } from './emailService.js';
import {
  notifyFeedbackSubmitted,
  notifyFeedbackResponded,
  notifyFeedbackAssignedToDepartment,
  notifyFeedbackAssignedToStaff,
} from './notificationService.js';

export const getNextFeedbackId = async () => {
  const [rows] = await pool.query(
    "SELECT GREATEST(COALESCE(MAX(CAST(id AS UNSIGNED)), 0), COALESCE(MAX(feedback_num), 0)) AS max_val FROM feedback WHERE id REGEXP '^[0-9]{4}$' OR feedback_num IS NOT NULL"
  );
  let nextNum = 8001;
  const maxVal = Number(rows[0]?.max_val || 0);
  if (maxVal >= 8000) {
    nextNum = maxVal + 1;
  }
  while (nextNum <= 9999) {
    const idStr = String(nextNum);
    const [exists] = await pool.query('SELECT id FROM feedback WHERE id = ? OR feedback_num = ? LIMIT 1', [idStr, nextNum]);
    if (!exists.length) return idStr;
    nextNum++;
  }
  return String(nextNum);
};

export const listFeedback = async (filters, user) => {
  return feedbackRepo.findAll(filters, user);
};

export const getFeedbackById = async (feedbackId) => {
  return feedbackRepo.findById(feedbackId);
};

export const createFeedback = async (data, user) => {
  const tenantId = user.tenant_id ?? user.tenantId ?? null;

  if (user.role === 'tenant' && !tenantId) {
    throw Object.assign(new Error('No tenant account linked to this user'), { statusCode: 400 });
  }

  let departmentId = data.departmentId || null;
  let categoryId = data.categoryId || null;
  let serviceName = data.serviceName || null;

  if (categoryId) {
    const [catRows] = await pool.query(
      'SELECT id, name, department_id FROM ticket_categories WHERE id = ? LIMIT 1',
      [categoryId]
    );
    if (catRows.length) {
      if (!departmentId && catRows[0].department_id) {
        departmentId = catRows[0].department_id;
      }
      if (!serviceName) {
        serviceName = catRows[0].name;
      }
    }
  } else if (data.ticketId) {
    const [tRows] = await pool.query(
      'SELECT id, category, department_id, current_department_id FROM tickets WHERE id = ? LIMIT 1',
      [data.ticketId]
    );
    if (tRows.length) {
      if (!departmentId) {
        departmentId = tRows[0].current_department_id || tRows[0].department_id;
      }
      if (!serviceName && tRows[0].category) {
        serviceName = tRows[0].category;
      }
    }
  }

  const nextId = await getNextFeedbackId();
  const feedback = {
    id: nextId,
    feedbackNum: Number(nextId),
    tenantId,
    ticketId: data.ticketId || null,
    categoryId,
    serviceName,
    departmentId,
    departmentHeadId: null,
    assignedToUserId: null,
    subject: data.subject,
    message: data.message,
    rating: data.rating ? Number(data.rating) : null,
    feedbackType: data.feedbackType || 'suggestion',
    whatShouldChange: data.whatShouldChange || null,
    whatIsCorrect: data.whatIsCorrect || null,
    whatIsWrong: data.whatIsWrong || null,
    howItShouldGo: data.howItShouldGo || null,
    status: 'pending',
  };
  await feedbackRepo.create(feedback);
  const savedFeedback = await feedbackRepo.findById(feedback.id);

  // Dispatch in-app notification, socket event, and email alert to administration
  notifyFeedbackSubmitted(savedFeedback || feedback, user).catch(() => {});

  return savedFeedback;
};

export const updateFeedback = async (id, data) => {
  const feedback = await feedbackRepo.findById(id);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  const allowedMap = {
    subject: 'subject',
    message: 'message',
    rating: 'rating',
    status: 'status',
    feedbackType: 'feedback_type',
    feedback_type: 'feedback_type',
    categoryId: 'category_id',
    category_id: 'category_id',
    serviceName: 'service_name',
    service_name: 'service_name',
    departmentHeadId: 'department_head_id',
    department_head_id: 'department_head_id',
    whatShouldChange: 'what_should_change',
    what_should_change: 'what_should_change',
    whatIsCorrect: 'what_is_correct',
    what_is_correct: 'what_is_correct',
    whatIsWrong: 'what_is_wrong',
    what_is_wrong: 'what_is_wrong',
    howItShouldGo: 'how_it_should_go',
    how_it_should_go: 'how_it_should_go',
    adminDirective: 'admin_directive',
    admin_directive: 'admin_directive',
    departmentNotes: 'department_notes',
    department_notes: 'department_notes',
    departmentId: 'department_id',
    department_id: 'department_id',
    assignedToUserId: 'assigned_to_user_id',
    assigned_to_user_id: 'assigned_to_user_id',
    adminResponse: 'admin_response',
    admin_response: 'admin_response',
    responseAt: 'response_at',
    response_at: 'response_at',
    responseBy: 'response_by',
    response_by: 'response_by',
  };

  const updateData = {};
  Object.keys(data).forEach((key) => {
    if (allowedMap[key] && data[key] !== undefined) {
      updateData[allowedMap[key]] = data[key];
    }
  });

  if (Object.keys(updateData).length) {
    await feedbackRepo.update(id, updateData);
  }

  const updated = await feedbackRepo.findById(id);

  // Dispatch notification and email back to tenant if admin response provided
  if (updateData.admin_response && (updated?.tenant_id || updated?.tenantId)) {
    notifyFeedbackResponded(updated, updateData.admin_response, { first_name: 'HDMS Administration' }).catch(() => {});
  }

  return updated;
};

export const assignToDepartment = async (id, payloadOrDeptId, departmentHeadIdArg, adminDirectiveArg, adminUserArg) => {
  const feedback = await feedbackRepo.findById(id);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  const isObj = payloadOrDeptId && typeof payloadOrDeptId === 'object';
  const departmentId = isObj ? (payloadOrDeptId.departmentId || null) : (payloadOrDeptId || null);
  const departmentHeadId = isObj ? (payloadOrDeptId.departmentHeadId || null) : (departmentHeadIdArg || null);
  const assignedToUserId = isObj ? (payloadOrDeptId.assignedToUserId || null) : null;
  const adminDirective = isObj ? (payloadOrDeptId.adminDirective || null) : (adminDirectiveArg || null);
  const targetType = isObj ? (payloadOrDeptId.targetType || (assignedToUserId && !departmentId ? 'user' : 'department')) : 'department';
  const whatIsCorrect = isObj && payloadOrDeptId.whatIsCorrect !== undefined ? payloadOrDeptId.whatIsCorrect : undefined;
  const whatShouldChange = isObj && payloadOrDeptId.whatShouldChange !== undefined ? payloadOrDeptId.whatShouldChange : undefined;
  const adminUser = isObj ? departmentHeadIdArg : adminUserArg;

  const updateFields = {
    admin_directive: adminDirective || null,
  };
  if (whatIsCorrect !== undefined) updateFields.what_is_correct = whatIsCorrect || null;
  if (whatShouldChange !== undefined) updateFields.what_should_change = whatShouldChange || null;

  if (targetType === 'user' && assignedToUserId) {
    updateFields.department_id = departmentId || null;
    updateFields.department_head_id = null;
    updateFields.assigned_to_user_id = assignedToUserId;
    updateFields.assigned_user_ids = JSON.stringify([assignedToUserId]);
    updateFields.assignment_scope = 'direct_user';
    updateFields.status = 'assigned_to_staff';

    await feedbackRepo.update(id, updateFields);
    const updated = await feedbackRepo.findById(id);
    notifyFeedbackAssignedToStaff(updated, [assignedToUserId], adminDirective, adminUser, { assignmentScope: 'specific_staff' }).catch((e) =>
      console.error('Failed to dispatch direct user feedback notification:', e.message)
    );
    return updated;
  }

  if (!departmentId) {
    throw Object.assign(new Error('Department or target user is required for feedback assignment'), { statusCode: 400 });
  }

  updateFields.department_id = departmentId;
  updateFields.department_head_id = departmentHeadId || null;
  updateFields.assignment_scope = 'department_only';
  updateFields.status = 'assigned_to_dept';

  await feedbackRepo.update(id, updateFields);

  const updated = await feedbackRepo.findById(id);
  notifyFeedbackAssignedToDepartment(updated, departmentId, adminDirective, adminUser, departmentHeadId).catch((e) =>
    console.error('Failed to dispatch dept assignment notification:', e.message)
  );

  return updated;
};

export const assignToStaff = async (id, payloadOrUserId, departmentNotesArg, managerUserArg) => {
  const feedback = await feedbackRepo.findById(id);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  const isObj = payloadOrUserId && typeof payloadOrUserId === 'object';
  const assignmentScope = isObj ? (payloadOrUserId.assignmentScope || 'specific_staff') : 'specific_staff';
  const assignedToUserId = isObj ? (payloadOrUserId.assignedToUserId || null) : (payloadOrUserId || null);
  const rawUserIds = isObj && Array.isArray(payloadOrUserId.assignedUserIds)
    ? payloadOrUserId.assignedUserIds.filter(Boolean)
    : (assignedToUserId ? [assignedToUserId] : []);
  const departmentNotes = isObj ? (payloadOrUserId.departmentNotes || null) : (departmentNotesArg || null);
  const whatIsCorrect = isObj && payloadOrUserId.whatIsCorrect !== undefined ? payloadOrUserId.whatIsCorrect : undefined;
  const whatShouldChange = isObj && payloadOrUserId.whatShouldChange !== undefined ? payloadOrUserId.whatShouldChange : undefined;
  const managerUser = isObj ? departmentNotesArg : managerUserArg;

  const updateFields = {
    department_notes: departmentNotes || null,
    status: 'assigned_to_staff',
  };
  if (whatIsCorrect !== undefined) updateFields.what_is_correct = whatIsCorrect || null;
  if (whatShouldChange !== undefined) updateFields.what_should_change = whatShouldChange || null;

  let deptId = feedback.departmentId || feedback.department_id || feedback.resolvedDepartmentId || null;
  if (managerUser?.role === 'manager') {
    const managerDeptIds = await ticketRepo.getUserDepartmentIds(managerUser.id);
    if (!deptId && managerDeptIds.length > 0) {
      deptId = managerDeptIds[0];
    }
    const isDeptMatch =
      (feedback.departmentHeadId && feedback.departmentHeadId === managerUser.id) ||
      (deptId && managerDeptIds.includes(deptId));
    if (!isDeptMatch) {
      throw Object.assign(
        new Error('Department Heads can only share feedback assigned to their own department.'),
        { statusCode: 403 }
      );
    }
  }
  if (deptId && !feedback.departmentId && !feedback.department_id) {
    updateFields.department_id = deptId;
  }

  if (assignmentScope === 'department_general') {
    if (!deptId) {
      throw Object.assign(new Error('A department must be assigned before sharing feedback with all department staff'), { statusCode: 400 });
    }
    updateFields.assignment_scope = 'department_general';
    updateFields.assigned_to_user_id = null;
    updateFields.assigned_user_ids = null;

    await feedbackRepo.update(id, updateFields);
    const updated = await feedbackRepo.findById(id);
    notifyFeedbackAssignedToStaff(updated, null, departmentNotes, managerUser, {
      assignmentScope: 'department_general',
      departmentId: deptId,
    }).catch((e) => console.error('Failed to dispatch general department staff feedback notification:', e.message));
    return updated;
  }

  if (!rawUserIds.length) {
    throw Object.assign(new Error('Select at least one staff member or choose General (All Staff in Department)'), { statusCode: 400 });
  }

  updateFields.assignment_scope = 'specific_staff';
  updateFields.assigned_to_user_id = rawUserIds[0];
  updateFields.assigned_user_ids = JSON.stringify(rawUserIds);

  await feedbackRepo.update(id, updateFields);

  const updated = await feedbackRepo.findById(id);
  notifyFeedbackAssignedToStaff(updated, rawUserIds, departmentNotes, managerUser, {
    assignmentScope: 'specific_staff',
  }).catch((e) => console.error('Failed to dispatch staff assignment notification:', e.message));

  return updated;
};

export const deleteFeedback = async (id) => {
  const feedback = await feedbackRepo.findById(id);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });
  await feedbackRepo.remove(id);
};

export const replyFeedback = async (feedbackId, repliedBy, message) => {
  const feedback = await feedbackRepo.findById(feedbackId);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });
  if (!message?.trim()) throw Object.assign(new Error('Reply message is required'), { statusCode: 400 });
  await feedbackRepo.addReply(feedbackId, repliedBy, message.trim());
  return feedbackRepo.getReplies(feedbackId);
};

export const getFeedbackReplies = async (feedbackId) => {
  return feedbackRepo.getReplies(feedbackId);
};

export const respondToFeedback = async (feedbackId, responderUser, data) => {
  const feedback = await feedbackRepo.findById(feedbackId);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  const routingType = feedback.routingType || 'general';
  if (routingType === 'direct') {
    if (responderUser?.role !== 'manager') {
      throw Object.assign(
        new Error('For direct-routing feedback, only the Head of the assigned department can respond to the tenant.'),
        { statusCode: 403 }
      );
    }
    const targetDeptId = feedback.resolvedDepartmentId || feedback.departmentId;
    const userDeptIds = await ticketRepo.getUserDepartmentIds(responderUser.id);
    const isAssignedDeptHead =
      (feedback.departmentHeadId && feedback.departmentHeadId === responderUser.id) ||
      (targetDeptId && userDeptIds.includes(targetDeptId));
    if (!isAssignedDeptHead) {
      throw Object.assign(
        new Error('Only the Department Head of the assigned department can respond to the tenant for this direct-routing feedback.'),
        { statusCode: 403 }
      );
    }
  } else if (responderUser?.role !== 'admin') {
    throw Object.assign(
      new Error('For general-routing feedback, only Admin can respond to the tenant.'),
      { statusCode: 403 }
    );
  }

  const responseText = typeof data.adminResponse === 'string' ? data.adminResponse.trim() : '';
  const wordCount = responseText
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9\u00C0-\u024F\u1200-\u137F]/.test(w)).length;

  if (wordCount <= 10) {
    throw Object.assign(
      new Error('Feedback response must contain more than 10 words (at least 11 words) so it is clear and helpful for the tenant.'),
      { statusCode: 400 }
    );
  }

  const responderId = responderUser?.id || responderUser;
  await feedbackRepo.update(feedbackId, {
    admin_response: responseText,
    status: data.status || 'resolved',
    response_at: new Date(),
    response_by: responderId,
  });

  const updatedFeedback = await feedbackRepo.findById(feedbackId);
  if (data.adminResponse && (updatedFeedback?.tenant_id || updatedFeedback?.tenantId)) {
    notifyFeedbackResponded(updatedFeedback, data.adminResponse, responderUser).catch(() => {});
  }

  return updatedFeedback;
};
