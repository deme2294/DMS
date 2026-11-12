import api from './axios';
import type { User, RoleOption, PaginationMeta } from '../types/user';
import { toShortId } from '../utils/idUtils';

export interface UserListParams {
  search?: string;
  role?: string;
  status?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const fetchUsers = (params: UserListParams) => {
  const cleanParams = { ...params };
  if (cleanParams.departmentId) {
    cleanParams.departmentId = toShortId(cleanParams.departmentId);
  }
  return api.get<{ success: boolean; data: User[]; pagination: PaginationMeta }>('/users', { params: cleanParams });
};

export const fetchUser = (id: string) =>
  api.get<{ success: boolean; data: User }>(`/users/${toShortId(id)}`);

export const fetchRoles = () =>
  api.get<{ success: boolean; data: RoleOption[] }>('/users/roles');

export const createUser = (formData: FormData) =>
  api.post('/users', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateUser = (id: string, formData: FormData) =>
  api.put(`/users/${toShortId(id)}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const deleteUser = (id: string) =>
  api.delete(`/users/${toShortId(id)}`);

export const activateUser = (id: string) =>
  api.patch(`/users/${toShortId(id)}/activate`);

export const deactivateUser = (id: string) =>
  api.patch(`/users/${toShortId(id)}/deactivate`);

export const resetUserPassword = (id: string, newPassword: string) =>
  api.patch(`/users/${toShortId(id)}/reset-password`, { newPassword });

export interface SendEmailPayload {
  to: string;
  toName?: string;
  subject: string;
  message: string;
  ticketId?: string;
}

export const sendDirectEmail = async (payload: SendEmailPayload) => {
  try {
    return await api.post<{ success: boolean; message: string; data?: any }>('/users/send-email', payload);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return await api.post<{ success: boolean; message: string; data?: any }>('/send-email', payload);
    }
    throw err;
  }
};
