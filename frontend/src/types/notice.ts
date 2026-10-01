export interface Notice {
  id: string;
  title: string;
  description: string;
  image?: string | null;
  attachment?: string | null;
  attachmentName?: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'published' | 'archived';
  targetAudience: 'all' | 'admin' | 'manager' | 'staff' | 'tenant' | 'department';
  target_audience?: string;
  departmentId?: string | null;
  department_id?: string | null;
  departmentName?: string | null;
  department_name?: string | null;
  assignedTo?: string | null;
  assigned_to?: string | null;
  assignedToName?: string | null;
  creator_role?: string;
  expiresAt?: string | null;
  createdBy: string;
  created_by?: string;
  createdByName?: string;
  creator_first_name?: string;
  creator_last_name?: string;
  creator_username?: string;
  createdAt?: string;
  updatedAt?: string;
  expiryWarned?: boolean;
  acknowledged?: boolean;
  recipientCounts?: { total: number; acknowledged: number };
}

export interface NoticeRecipient {
  id: string;
  userId: string;
  acknowledgedAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
}

export interface NoticeFormValues {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'published' | 'archived';
  targetAudience: 'all' | 'admin' | 'manager' | 'staff' | 'tenant' | 'department';
  departmentId?: string;
  assignedTo?: string;
  expiresAt?: string;
}

export interface NoticeListParams {
  search?: string;
  status?: string;
  priority?: string;
  targetAudience?: string;
  category?: string;
  page?: number;
  limit?: number;
}
