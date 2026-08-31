import api from './axios';
import type { MatrixAssignment, MatrixGridData, PaginationMeta } from '../types/matrix';

export interface MatrixListParams {
  search?: string;
  userId?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const fetchMatrixGrid = () =>
  api.get<{ success: boolean; data: MatrixGridData }>('/matrix/grid');

export const fetchAssignments = (params: MatrixListParams) =>
  api.get<{ success: boolean; data: MatrixAssignment[]; pagination: PaginationMeta }>(
    '/matrix',
    { params }
  );

export const toggleAssignment = (payload: {
  userId: string;
  departmentId: string;
  assigned: boolean;
}) => api.patch('/matrix/toggle', payload);

export const assignUserToDepartment = (userId: string, departmentId: string | null) =>
  api.post('/matrix/user-departments', { userId, departmentId });

export const assignDepartmentToUser = (departmentId: string | null, userId: string | null) =>
  api.post('/matrix/department-users', { departmentId, userId });

export const deleteAssignment = (id: string) =>
  api.delete(`/matrix/${id}`);

export const deleteAssignmentByPair = (userId: string, departmentId: string) =>
  api.delete(`/matrix/pair/${userId}/${departmentId}`);
