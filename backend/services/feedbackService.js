import { v4 as uuidv4 } from 'uuid';
import * as feedbackRepo from '../repository/feedbackRepository.js';
import pool from '../config/db.js';
import { sendFeedbackAlertEmail, sendFeedbackResponseEmail } from './emailService.js';

export const listFeedback = async (filters, user) => {
  return feedbackRepo.findAll(filters, user);
};

export const getFeedbackById = async (feedbackId) => {
  return feedbackRepo.findById(feedbackId);
};

export const createFeedback = async (data, user) => {
  const tenantId = user.tenant_id ?? null;

  if (user.role === 'tenant' && !tenantId) {
    throw Object.assign(new Error('No tenant account linked to this user'), { statusCode: 400 });
  }

  const feedback = {
    id: uuidv4(),
    tenantId,
    ticketId: data.ticketId || null,
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

  // Notify created system email (demshuterefe94@gmail.com) of incoming feedback
  const submitterName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.username || 'Tenant User');
  sendFeedbackAlertEmail({
    feedback: savedFeedback || feedback,
    submitterName,
    submitterEmail: user?.email,
  }).catch(() => {});

  return savedFeedback;
};

export const updateFeedback = async (id, data) => {
  const feedback = await feedbackRepo.findById(id);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  const allowed = ['subject', 'message', 'rating', 'status', 'admin_response', 'response_at', 'response_by'];
  const updateData = {};
  Object.keys(data).forEach((key) => {
    if (allowed.includes(key) && data[key] !== undefined) {
      const mappedKey = key === 'adminResponse' ? 'admin_response' : key;
      updateData[mappedKey] = data[key];
    }
  });

  if (Object.keys(updateData).length) {
    await feedbackRepo.update(id, updateData);
  }

  const updated = await feedbackRepo.findById(id);

  // Send response notification back to tenant contact email
  if (updateData.admin_response && updated?.tenant_id) {
    try {
      const [tenantRows] = await pool.query(
        'SELECT email, contact_person FROM tenants WHERE id = :tenantId LIMIT 1',
        { tenantId: updated.tenant_id }
      );
      if (tenantRows.length && tenantRows[0].email) {
        sendFeedbackResponseEmail({
          email: tenantRows[0].email,
          recipientName: tenantRows[0].contact_person || 'Tenant Contact',
          feedback: updated,
          responseMessage: updateData.admin_response,
          responderName: 'HDMS Administration',
        }).catch(() => {});
      }
    } catch {}
  }

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

export const respondToFeedback = async (feedbackId, respondedBy, data) => {
  const feedback = await feedbackRepo.findById(feedbackId);
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

  await feedbackRepo.update(feedbackId, {
    admin_response: data.adminResponse,
    status: data.status || 'resolved',
    response_at: new Date(),
    response_by: respondedBy,
  });

  return feedbackRepo.findById(feedbackId);
};
