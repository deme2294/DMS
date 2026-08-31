import * as officeFeedbackService from '../services/officeFeedbackService.js';
import { HTTP } from '../config/constants.js';

export const getOfficeFeedback = async (req, res, next) => {
  try {
    const feedback = await officeFeedbackService.listOfficeFeedback(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};

export const createOfficeFeedback = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      officeLocationId: req.params.id, // Add office location ID from route parameter
    };
    const feedback = await officeFeedbackService.createOfficeFeedback(payload, req.user);
    res.status(HTTP.CREATED).json({ success: true, message: 'Feedback submitted', data: feedback });
  } catch (err) {
    next(err);
  }
};

export const updateOfficeFeedback = async (req, res, next) => {
  try {
    const feedback = await officeFeedbackService.updateOfficeFeedback(req.params.id, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Feedback updated', data: feedback });
  } catch (err) {
    next(err);
  }
};

export const deleteOfficeFeedback = async (req, res, next) => {
  try {
    await officeFeedbackService.deleteOfficeFeedback(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Feedback deleted' });
  } catch (err) {
    next(err);
  }
};

export const getOfficeFeedbackReplies = async (req, res, next) => {
  try {
    const replies = await officeFeedbackService.getOfficeFeedbackReplies(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: replies });
  } catch (err) {
    next(err);
  }
};

export const addOfficeFeedbackReply = async (req, res, next) => {
  try {
    const reply = await officeFeedbackService.replyOfficeFeedback(
      req.params.id,
      req.user.id,
      req.body.message
    );
    res.status(HTTP.CREATED).json({ success: true, message: 'Reply added', data: reply });
  } catch (err) {
    next(err);
  }
};

export const getTenantOfficeFeedback = async (req, res, next) => {
  try {
    const feedback = await officeFeedbackService.getTenantOfficeFeedback(
      req.user.tenant_id,
      req.query
    );
    res.status(HTTP.OK).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};
