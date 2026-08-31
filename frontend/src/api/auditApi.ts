import api from './axios';

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

export interface AuditFilter {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const fetchAuditLogs = (params: AuditFilter) =>
  api.get<{ success: boolean; data: AuditLog[]; pagination: AuditLogResponse['pagination'] }>(
    '/audit/logs',
    { params }
  );

export const fetchAuditActions = () =>
  api.get<{ success: boolean; data: string[] }>('/audit/actions');

export const exportAuditLogs = (params?: AuditFilter) =>
  api.get<Blob>('/audit/export', { params, responseType: 'blob' }).then((res) => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });