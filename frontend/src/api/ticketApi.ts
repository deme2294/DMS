import api from './axios';
import type { Ticket, TicketTrackInfo, TicketReply, NotificationItem, PaginationMeta, TimelineEvent } from '../types/ticket';

export interface TicketListParams {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  departmentId?: string;
  assignedTo?: string;
  createdBy?: string;
  tenantId?: string;
  fromDate?: string;
  toDate?: string;
  keyword?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const fetchTickets = (params: TicketListParams) =>
  api.get<{ success: boolean; data: Ticket[]; pagination: PaginationMeta }>('/tickets', { params });

export const fetchTicket = (id: string) =>
  api.get<{ success: boolean; data: Ticket }>(`/tickets/${id}`);

export const trackTicket = (trackNumber: string) =>
  api.get<{ success: boolean; data: TicketTrackInfo }>(`/tickets/track/${trackNumber}`);

export const fetchTicketCategories = () =>
  api.get<{ success: boolean; data: string[] }>('/ticket-categories').then((res) => ({
    ...res,
    data: { ...res.data, data: res.data.data.map((c: any) => (typeof c === 'string' ? c : c.name)) },
  }));

export const createTicket = (formData: FormData) =>
  api.post('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateTicket = (id: string, payload: Record<string, unknown>) =>
  api.put(`/tickets/${id}`, payload);

export const changeTicketStatus = (
  id: string,
  payload: { status: string; notes?: string; departmentId?: string; assignedTo?: string }
) => api.patch(`/tickets/${id}/status`, payload);

export const assignDepartment = (id: string, payload: { departmentId: string; notes?: string }) =>
  api.post(`/tickets/${id}/assign-department`, payload);

export const assignStaff = (id: string, payload: { staffId: string; notes?: string }) =>
  api.post(`/tickets/${id}/assign-staff`, payload);

export const reassignStaff = (id: string, payload: { staffId: string; notes?: string }) =>
  api.post(`/tickets/${id}/reassign`, payload);

export const overrideAssignment = (
  id: string,
  payload: { assignedTo?: string | null; assignedBy?: string | null; notes?: string }
) => api.patch<{ success: boolean; data: Ticket }>(`/tickets/${id}/assignment`, payload);

export const acceptAssignment = (id: string) => api.post(`/tickets/${id}/accept`);

export const rejectAssignment = (id: string, reason?: string) =>
  api.post(`/tickets/${id}/reject`, { reason });

export const escalateTicket = (id: string, notes?: string) =>
  api.post(`/tickets/${id}/escalate`, { notes });

export const mergeTickets = (id: string, sourceIds: string[], notes?: string) =>
  api.post(`/tickets/${id}/merge`, { sourceIds, notes });

export const closeTicket = (id: string, notes?: string) => api.post(`/tickets/${id}/close`, { notes });

export const reopenTicket = (id: string, notes?: string) => api.post(`/tickets/${id}/reopen`, { notes });

export const approveResolution = (id: string, notes?: string) => api.post(`/tickets/${id}/approve`, { notes });

export const rejectResolution = (id: string, notes?: string) => api.post(`/tickets/${id}/reject-completion`, { notes });

export const markResolved = (id: string, notes?: string) => api.post(`/tickets/${id}/complete`, { notes });

export const changePriority = (id: string, priority: string) => api.patch(`/tickets/${id}/priority`, { priority });

export const changeCategory = (id: string, category: string) => api.patch(`/tickets/${id}/category`, { category });

export const addInternalNote = (id: string, message: string, attachmentId?: string, departmentId?: string) =>
  api.post(`/tickets/${id}/internal-note`, { message, attachmentId, departmentId });

export const deleteTicket = (id: string) => api.delete(`/tickets/${id}`);

export const uploadTicketAttachments = (id: string, formData: FormData) =>
  api.post(`/tickets/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const fetchTicketReplies = (id: string) =>
  api.get<{ success: boolean; data: TicketReply[] }>(`/tickets/${id}/replies`);

export const addTicketReply = (id: string, payload: { message: string; visibility?: string; attachmentId?: string; departmentIds?: string | null }) =>
  api.post(`/tickets/${id}/replies`, payload);

export const fetchTicketTimeline = (id: string) =>
  api.get<{ success: boolean; data: TimelineEvent[] }>(`/tickets/${id}/timeline`);

export const fetchNotifications = (params?: { limit?: number; offset?: number }) =>
  api.get<{ success: boolean; data: NotificationItem[] }>('/tickets/notifications', { params });

export const fetchUnreadCount = () =>
  api.get<{ success: boolean; data: { unreadCount: number } }>('/tickets/notifications/unread-count');

export const markNotificationRead = (id: string) =>
  api.patch(`/tickets/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.patch('/tickets/notifications/read-all');

export const deleteNotification = (id: string) =>
  api.delete(`/tickets/notifications/${id}`);
