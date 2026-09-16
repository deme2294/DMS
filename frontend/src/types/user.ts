export type UserRole = 'admin' | 'manager' | 'staff' | 'tenant' | 'ceo';
export type UserStatus = 'active' | 'inactive' | 'locked';

export interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface User {
  id: string;
  tenantId?: string | null;
  roleId?: number;
  role: UserRole;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profileImage?: string | null;
  status: UserStatus;
  userCode?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  departments?: DepartmentRef[];
}

export interface RoleOption {
  id: number;
  name: UserRole;
  description?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserFormValues {
  username: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: number;
  tenantId?: string;
  status: UserStatus;
  departmentId: string | null;
  profileImage?: FileList;
}