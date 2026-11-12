import api from './axios';
import type {
  Department,
  DepartmentHeadOption,
  DepartmentMember,
  PaginationMeta,
} from '../types/department';
import { toShortId } from '../utils/idUtils';

export interface DepartmentListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const fetchDepartments = (params: DepartmentListParams) =>
  api.get<{ success: boolean; data: Department[]; pagination: PaginationMeta }>(
    '/departments',
    { params }
  );

export const fetchDepartment = (id: string) =>
  api.get<{ success: boolean; data: Department }>(`/departments/${toShortId(id)}`);

export const fetchDepartmentMembers = (id: string) =>
  api.get<{ success: boolean; data: DepartmentMember[] }>(`/departments/${toShortId(id)}/members`);

export const assignDepartmentUsers = (id: string, userIds: string[]) =>
  api.post(`/departments/${toShortId(id)}/members`, { userIds: userIds.map((u) => toShortId(u)) });

export const fetchActiveDepartments = () =>
  api.get<{ success: boolean; data: Pick<Department, 'id' | 'name' | 'code'>[] }>(
    '/departments/active'
  );

export const fetchEligibleHeads = () =>
  api.get<{ success: boolean; data: DepartmentHeadOption[] }>('/departments/heads');

export const createDepartment = (payload: Record<string, unknown>) =>
  api.post('/departments', payload);

export const updateDepartment = (id: string, payload: Record<string, unknown>) =>
  api.put(`/departments/${toShortId(id)}`, payload);

export const deleteDepartment = (id: string) =>
  api.delete(`/departments/${toShortId(id)}`);

export const activateDepartment = (id: string) =>
  api.patch(`/departments/${toShortId(id)}/activate`);

export const deactivateDepartment = (id: string) =>
  api.patch(`/departments/${toShortId(id)}/deactivate`);
