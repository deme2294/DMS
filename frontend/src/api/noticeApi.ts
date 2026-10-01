import api from './axios';
import type { Notice, NoticeFormValues, NoticeListParams } from '../types/notice';

export const fetchNotices = (params: NoticeListParams) =>
  api.get<{ success: boolean; data: Notice[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
    '/notices',
    { params }
  );

export const fetchNotice = (id: string) =>
  api.get<{ success: boolean; data: Notice }>(`/notices/${id}`);

export const createNotice = (payload: Record<string, unknown>) =>
  api.post('/notices', payload);

export const updateNotice = (id: string, payload: Record<string, unknown>) =>
  api.put(`/notices/${id}`, payload);

export const deleteNotice = (id: string) => api.delete(`/notices/${id}`);

export const acknowledgeNotice = (id: string) =>
  api.post<{ success: boolean; acknowledged: boolean }>(`/notices/${id}/acknowledge`);

export const fetchMyAcknowledgements = () =>
  api.get<{ success: boolean; data: string[] }>('/notices/me/acknowledgements');

export const fetchNoticeRecipients = (id: string) =>
  api.get<{ success: boolean; data: import('../types/notice').NoticeRecipient[] }>(`/notices/${id}/recipients`);

export const fetchNoticeRecipientCounts = (id: string) =>
  api.get<{ success: boolean; data: { total: number; acknowledged: number } }>(`/notices/${id}/recipients/counts`);

export const fetchPublicNotices = () =>
  api.get<{ success: boolean; data: Notice[] }>('/notices/public');

export const fetchNoticeCategories = () =>
  api.get<{ success: boolean; data: string[] }>('/notices/categories');

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED & TARGETED NOTICES FOR STAFF & MANAGER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get notices for the current user (staff/manager)
 * Filtered by role and department
 */
export const getMyNotices = (params?: NoticeListParams) =>
  api.get<{ success: boolean; data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
    '/notices/my/inbox',
    { params }
  );

/**
 * Get notices created by the current user (manager)
 */
export const getMyCreatedNotices = (params?: NoticeListParams) =>
  api.get<{ success: boolean; data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
    '/notices/my/created',
    { params }
  );

/**
 * Create targeted notice (manager/admin)
 */
export const createTargetedNotice = (payload: {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  targetAudience?: string;
  departmentId?: string;
  assignedTo?: string;
  expiresAt?: string;
  status?: string;
}) => api.post('/notices/targeted', payload);

/**
 * Update targeted notice
 */
export const updateTargetedNotice = (id: string, payload: Record<string, unknown>) =>
  api.put(`/notices/targeted/${id}`, payload);

/**
 * Get staff members in department (for assignment)
 */
export const getDepartmentStaff = (departmentId?: string) => {
  const url = departmentId 
    ? `/notices/department/${departmentId}/staff` 
    : '/notices/department/staff';
  return api.get<{ success: boolean; data: any[] }>(url);
};

/**
 * Get departments managed by the current user
 */
export const getMyDepartments = () =>
  api.get<{ success: boolean; data: { id: string; name: string; code: string }[] }>('/notices/my/departments');

/**
 * Assign notice to specific staff member
 */
export const assignNoticeToStaff = (noticeId: string, staffUserId: string) =>
  api.post(`/notices/${noticeId}/assign`, { staffUserId });

/**
 * Route / escalate notice to System Admin (by Department Head)
 */
export const routeNoticeToAdmin = (noticeId: string, remarks?: string) =>
  api.post<{ success: boolean; message: string; data: any }>(`/notices/${noticeId}/route-to-admin`, { remarks });

/**
 * Update notice expiration date (by Manager, Admin, or Creator)
 */
export const updateNoticeExpiry = (noticeId: string, expiresAt: string | null) =>
  api.patch<{ success: boolean; message: string; data: any }>(`/notices/${noticeId}/expiry`, { expiresAt });


/**
 * Get notices that can be assigned by manager
 * Admin notices targeted to managers
 */
export const getAssignableNotices = (params?: NoticeListParams) =>
  api.get<{ success: boolean; data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
    '/notices/assignable',
    { params }
  );

/**
 * Get notice with full details (creator, assignment info)
 */
export const getNoticeWithDetails = (id: string) =>
  api.get<{ success: boolean; data: any }>(`/notices/${id}/details`);

/**
 * Get replies for a notice
 */
export const getNoticeReplies = (noticeId: string) =>
  api.get<{ success: boolean; data: any[] }>(`/notices/${noticeId}/replies`);

/**
 * Create a reply to a notice
 */
export const createNoticeReply = (noticeId: string, payload: {
  message: string;
  visibility?: 'all' | 'internal';
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
}) =>
  api.post<{ success: boolean; data: any }>(`/notices/${noticeId}/replies`, payload);

/**
 * Update a notice reply
 */
export const updateNoticeReply = (replyId: string, payload: { message?: string; visibility?: 'all' | 'internal' }) =>
  api.put<{ success: boolean; data: any }>(`/notices/replies/${replyId}`, payload);

/**
 * Delete a notice reply
 */
export const deleteNoticeReply = (replyId: string) =>
  api.delete<{ success: boolean }>(`/notices/replies/${replyId}`);
