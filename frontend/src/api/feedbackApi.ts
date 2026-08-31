import api from './axios';
import type { Feedback, FeedbackFormValues, FeedbackReply, ReplyFormValues, AdminFeedbackResponse } from '../types/feedback';

export interface FeedbackListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const fetchFeedback = (params?: FeedbackListParams) =>
  api.get<{ success: boolean; data: Feedback[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
    '/feedback',
    { params }
  );

export const fetchFeedbackItem = (id: string) =>
  api.get<{ success: boolean; data: Feedback }>(`/feedback/${id}`);

export const fetchReplies = (id: string) =>
  api.get<{ success: boolean; data: FeedbackReply[] }>(`/feedback/${id}/replies`);

export const createFeedback = (payload: FeedbackFormValues) =>
  api.post('/feedback', payload);

export const replyToFeedback = (id: string, message: string) =>
  api.post(`/feedback/${id}/replies`, { message });

export const updateFeedback = (id: string, payload: Record<string, unknown>) =>
  api.put(`/feedback/${id}`, payload);

export const deleteFeedback = (id: string) => api.delete(`/feedback/${id}`);

export const respondToFeedback = (id: string, payload: AdminFeedbackResponse) =>
  api.patch(`/feedback/${id}/respond`, payload);
