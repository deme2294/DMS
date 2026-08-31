export type DepartmentStatus = 'active' | 'inactive';

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  headUserId?: string | null;
  headName?: string | null;
  headEmail?: string | null;
  status: DepartmentStatus;
  userCount?: number;
  memberIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentHeadOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  fullName: string;
}

export interface DepartmentMember {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: string;
}

export interface DepartmentFormValues {
  name: string;
  code: string;
  description?: string;
  headUserId?: string;
  status: DepartmentStatus;
  memberIds?: string[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}