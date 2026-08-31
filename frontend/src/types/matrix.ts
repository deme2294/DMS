export interface MatrixAssignment {
  id: string;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  userRole: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  assignedAt?: string;
}

export interface MatrixUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string | null;
}

export interface MatrixDepartment {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
}

export interface MatrixGridData {
  users: MatrixUser[];
  departments: MatrixDepartment[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}