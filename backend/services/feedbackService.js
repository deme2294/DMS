import { v4 as uuidv4 } from 'uuid';
import * as feedbackRepo from '../repository/feedbackRepository.js';

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
  return feedbackRepo.findById(feedback.id);
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
  return feedbackRepo.findById(id);
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
