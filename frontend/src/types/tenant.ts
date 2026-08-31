export type TenantStatus = 'active' | 'inactive' | 'pending';

export interface TenantUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  lastLoginAt?: string | null;
}

export interface Tenant {
  id: string;
  tenantId?: number;
  organizationName: string;
  registrationNumber?: string | null;
  contactPerson: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: TenantStatus;
  username?: string | null;
  userCount?: number;
  ticketCount?: number;
  createdAt?: string;
  updatedAt?: string;
  users?: TenantUser[];
}

export interface TenantFormValues {
  organizationName: string;
  registrationNumber?: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  status?: TenantStatus;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

export interface TenantRegisterValues {
  organizationName: string;
  registrationNumber?: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTenantResponse {
  success: boolean;
  message: string;
  data: {
    tenant_id: number;
  };
}
