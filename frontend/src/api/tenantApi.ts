import api from './axios';
import type { Tenant, PaginationMeta, CreateTenantResponse } from '../types/tenant';

export interface TenantListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const fetchTenants = (params: TenantListParams) =>
  api.get<{ success: boolean; data: Tenant[]; pagination: PaginationMeta }>(
    '/tenants',
    { params }
  );

export const fetchTenant = (id: string) =>
  api.get<{ success: boolean; data: Tenant }>(`/tenants/${id}`);

export const createTenant = (payload: Record<string, unknown>) =>
  api.post<CreateTenantResponse>('/tenants', payload);

export const updateTenant = (id: string, payload: Record<string, unknown>) =>
  api.put(`/tenants/${id}`, payload);

export const deleteTenant = (id: string) =>
  api.delete(`/tenants/${id}`);

export const activateTenant = (id: string) =>
  api.patch(`/tenants/${id}/activate`);

export const deactivateTenant = (id: string) =>
  api.patch(`/tenants/${id}/deactivate`);

export const approveTenant = (id: string) =>
  api.patch(`/tenants/${id}/approve`);

export const registerTenant = (payload: Record<string, unknown>) =>
  api.post('/tenants/register', payload);

export const fetchMyTenantProfile = () =>
  api.get<{ success: boolean; data: Tenant }>('/tenants/profile/me');

export const updateMyTenantProfile = (payload: Record<string, unknown>) =>
  api.put('/tenants/profile/me', payload);
