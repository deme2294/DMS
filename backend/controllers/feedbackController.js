import * as feedbackService from '../services/feedbackService.js';
import * as officeFeedbackService from '../services/officeFeedbackService.js';
import { HTTP } from '../config/constants.js';


export const getFeedback = async (req, res, next) => {
  try {
    const result = await feedbackService.listFeedback(req.query, req.user);
    
    // If admin/ceo, also include office inquiries
    if (req.user.role === 'admin' || req.user.role === 'ceo') {
      try {
        // Fetch all office feedback
        const officeFeedbackList = await officeFeedbackService.listAllOfficeFeedback(req.query);
        
        // Merge office feedback into regular feedback with a flag
        const mergedData = [
          ...result.data.map(f => ({ ...f, feedbackType: 'general' })),
          ...officeFeedbackList.map(of => ({
            ...of,
            feedbackType: 'office_inquiry',
            subject: `[Office Inquiry] ${of.subject}`,
            tenantName: of.tenant_name || of.tenantName,
          })),
        ];
        
        // Sort by created date
        mergedData.sort((a, b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime());
        
        result.data = mergedData;
      } catch (officeError) {
        console.error('Failed to fetch office feedback:', officeError.message);
        // Continue with regular feedback only
      }
    }
    
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getFeedbackById = async (req, res, next) => {
  try {
    const feedbackId = req.params.id;
    
    // Try to fetch from regular feedback first
    let feedback = await feedbackService.getFeedbackById(feedbackId);
    
    // If not found and user is admin/ceo, try office feedback
    if (!feedback && (req.user.role === 'admin' || req.user.role === 'ceo')) {
      feedback = await officeFeedbackService.getOfficeFeedbackById(feedbackId);
      
      if (feedback) {
        // Mark as office inquiry
        feedback.feedbackType = 'office_inquiry';
        feedback.subject = `[Office Inquiry] ${feedback.subject}`;
      }
    }
    
    if (!feedback) {
      return res.status(HTTP.NOT_FOUND).json({ 
        success: false, 
        message: 'Feedback not found' 
      });
    }
    
    res.status(HTTP.OK).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};

export const createFeedback = async (req, res, next) => {
  try {
    const feedback = await feedbackService.createFeedback(req.body, req.user);
    res.status(HTTP.CREATED).json({ success: true, message: 'Feedback submitted', data: feedback });
  } catch (err) {
    next(err);
  }
};

export const updateFeedback = async (req, res, next) => {
  try {
    const feedbackId = req.params.id;
    let feedback = null;
    
    // Try to update regular feedback first
    try {
      const regularFeedback = await feedbackService.getFeedbackById(feedbackId);
      
      if (regularFeedback) {
        feedback = await feedbackService.updateFeedback(feedbackId, req.body);
        return res.status(HTTP.OK).json({ success: true, message: 'Feedback updated', data: feedback });
      }
    } catch (regularError) {
      console.log('[updateFeedback] Not a regular feedback, trying office feedback...');
    }
    
    // Try office feedback
    if (req.user.role === 'admin' || req.user.role === 'ceo') {
      try {
        feedback = await officeFeedbackService.updateOfficeFeedback(feedbackId, req.body, req.user.id);
        return res.status(HTTP.OK).json({ success: true, message: 'Office feedback updated', data: feedback });
      } catch (officeError) {
        console.log('[updateFeedback] Office feedback update failed:', officeError.message);
      }
    }
    
    // If not found in either table
    return res.status(HTTP.NOT_FOUND).json({ 
      success: false, 
      message: 'Feedback not found' 
    });
  } catch (err) {
    next(err);
  }
};

export const deleteFeedback = async (req, res, next) => {
  try {
    const feedbackId = req.params.id;

    // Try regular feedback first
    const regularFeedback = await feedbackService.getFeedbackById(feedbackId);
    if (regularFeedback) {
      await feedbackService.deleteFeedback(feedbackId);
      return res.status(HTTP.OK).json({ success: true, message: 'Feedback deleted' });
    }

    // Fall back to office feedback (admin/ceo only — tenants never see it merged)
    if (req.user.role === 'admin' || req.user.role === 'ceo') {
      const officeFeedback = await officeFeedbackService.getOfficeFeedbackById(feedbackId);
      if (officeFeedback) {
        await officeFeedbackService.deleteOfficeFeedback(feedbackId);
        return res.status(HTTP.OK).json({ success: true, message: 'Office feedback deleted' });
      }
    }

    return res.status(HTTP.NOT_FOUND).json({ success: false, message: 'Feedback not found' });
  } catch (err) {
    next(err);
  }
};

export const getReplies = async (req, res, next) => {
  try {
    const feedbackId = req.params.id;
    let replies = [];
    
    // Try regular feedback replies first
    try {
      replies = await feedbackService.getFeedbackReplies(feedbackId);
    } catch (regularError) {
      console.log('[getReplies] Regular feedback replies not found, trying office feedback...');
    }
    
    // If no replies and user is admin/ceo, try office feedback replies
    if ((!replies || replies.length === 0) && (req.user.role === 'admin' || req.user.role === 'ceo')) {
      try {
        replies = await officeFeedbackService.getOfficeFeedbackReplies(feedbackId);
      } catch (officeError) {
        console.log('[getReplies] Office feedback replies not found');
      }
    }
    
    res.status(HTTP.OK).json({ success: true, data: replies || [] });
  } catch (err) {
    next(err);
  }
};

export const addReply = async (req, res, next) => {
  try {
    const feedbackId = req.params.id;
    const message = req.body.message;

    // Check if it's a regular feedback
    const regularFeedback = await feedbackService.getFeedbackById(feedbackId);
    if (regularFeedback) {
      const reply = await feedbackService.replyFeedback(feedbackId, req.user.id, message);
      return res.status(HTTP.CREATED).json({ success: true, message: 'Reply added', data: reply });
    }

    // Fall back to office feedback
    const reply = await officeFeedbackService.replyOfficeFeedback(feedbackId, req.user.id, message);
    return res.status(HTTP.CREATED).json({ success: true, message: 'Reply added', data: reply });
  } catch (err) {
    next(err);
  }
};

export const respondToFeedback = async (req, res, next) => {
  try {
    const feedback = await feedbackService.respondToFeedback(req.params.id, req.user.id, req.body);
    res.status(HTTP.OK).json({ success: true, message: 'Response sent', data: feedback });
  } catch (err) {
    next(err);
  }
};
