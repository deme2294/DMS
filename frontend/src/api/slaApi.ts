import api from './axios';

export interface SLAPolicy {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  categoryId?: string | null;
  categoryName?: string | null;
  responseHours: number;
  resolutionHours: number;
  escalationHours: number;
  workingHours?: any;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SLAPreview {
  policyId: string | null;
  policyName: string;
  priority: string;
  category: string;
  categoryId: string | null;
  responseHours: number;
  resolutionHours: number;
  escalationHours: number;
  responseDueDate: string;
  resolutionDueDate: string;
  escalationDueDate: string | null;
}

export const fetchSLAPolicies = (params?: { includeInactive?: boolean; categoryId?: string }) =>
  api.get<{ success: boolean; data: SLAPolicy[] }>('/sla', { params });

export const fetchSLAPolicy = (id: string) =>
  api.get<{ success: boolean; data: SLAPolicy }>(`/sla/${id}`);

export const fetchSLAPolicyByCategoryAndPriority = (categoryId: string, priority: string) =>
  api.get<{ success: boolean; data: SLAPolicy }>(`/sla/find`, { params: { categoryId, priority } });

export const previewSLA = (params: { categoryId?: string; priority: string; createdAt?: string }) =>
  api.get<{ success: boolean; data: SLAPreview }>('/sla/preview', { params });

export const createSLAPolicy = (payload: {
  name: string;
  priority: string;
  categoryId?: string;
  responseHours?: number;
  resolutionHours?: number;
  escalationHours?: number;
  workingHours?: any;
  description?: string;
}) => api.post<{ success: boolean; data: SLAPolicy }>('/sla', payload);

export const updateSLAPolicy = (
  id: string,
  payload: { name?: string; priority?: string; categoryId?: string; responseHours?: number; resolutionHours?: number; escalationHours?: number; workingHours?: any; description?: string; isActive?: boolean }
) => api.put<{ success: boolean; data: SLAPolicy }>(`/sla/${id}`, payload);

export const deleteSLAPolicy = (id: string) => api.delete(`/sla/${id}`);
