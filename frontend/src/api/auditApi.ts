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

export const exportAuditLogs = (params?: AuditFilter & { format?: 'xlsx' | 'csv' }) =>
  api.get<Blob>('/audit/export', { params, responseType: 'blob' }).then((res) => {
    let filename = 'audit-logs.xlsx';
    const headers = res.headers || {};
    const disposition = String(headers['content-disposition'] || headers['Content-Disposition'] || '');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    const contentType = String(headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const blob = new Blob([res.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });