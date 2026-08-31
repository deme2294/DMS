import api from './axios';
import type { User, RoleOption, PaginationMeta } from '../types/user';

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

export const fetchUsers = (params: UserListParams) =>
  api.get<{ success: boolean; data: User[]; pagination: PaginationMeta }>('/users', { params });

export const fetchUser = (id: string) =>
  api.get<{ success: boolean; data: User }>(`/users/${id}`);

export const fetchRoles = () =>
  api.get<{ success: boolean; data: RoleOption[] }>('/users/roles');

export const createUser = (formData: FormData) =>
  api.post('/users', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateUser = (id: string, formData: FormData) =>
  api.put(`/users/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const deleteUser = (id: string) =>
  api.delete(`/users/${id}`);

export const activateUser = (id: string) =>
  api.patch(`/users/${id}/activate`);

export const deactivateUser = (id: string) =>
  api.patch(`/users/${id}/deactivate`);

export const resetUserPassword = (id: string, newPassword: string) =>
  api.patch(`/users/${id}/reset-password`, { newPassword });