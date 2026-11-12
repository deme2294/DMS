import api from './axios';
import type {
  Feedback,
  FeedbackFormValues,
  FeedbackReply,
  ReplyFormValues,
  AdminFeedbackResponse,
  AssignDepartmentPayload,
  AssignStaffPayload,
  FeedbackAiResponseResult,
} from '../types/feedback';

export interface FeedbackListParams {
  search?: string;
  status?: string;
  departmentId?: string;
  categoryId?: string;
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

export const assignFeedbackToDepartment = (id: string, payload: AssignDepartmentPayload) =>
  api.patch<{ success: boolean; message: string; data: Feedback }>(`/feedback/${id}/assign-department`, payload);

export const assignFeedbackToStaff = (id: string, payload: AssignStaffPayload) =>
  api.patch<{ success: boolean; message: string; data: Feedback }>(`/feedback/${id}/assign-staff`, payload);

let aiEndpointUnavailable = false;

export const generateFeedbackAiResponse = async (id: string, feedback?: Partial<Feedback>) => {
  if (aiEndpointUnavailable) {
    throw new Error('AI endpoint unavailable in current backend session');
  }
  try {
    return await api.post<{ success: boolean; data: FeedbackAiResponseResult }>(`/feedback/${id}/ai-response`, feedback ? {
      subject: feedback.subject,
      message: feedback.message,
      whatIsCorrect: feedback.whatIsCorrect,
      whatShouldChange: feedback.whatShouldChange,
      whatIsWrong: feedback.whatIsWrong,
      howItShouldGo: feedback.howItShouldGo,
      rating: feedback.rating,
      serviceName: feedback.serviceName,
      departmentName: feedback.departmentName,
      categoryName: feedback.categoryName,
      submitterName: feedback.tenantName || feedback.contactPerson,
    } : {});
  } catch (err: any) {
    if (err?.response?.status === 404) {
      aiEndpointUnavailable = true;
    }
    throw err;
  }
};
