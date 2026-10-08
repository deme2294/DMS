export type TicketStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending'
  | 'waiting_tenant'
  | 'waiting_vendor'
  | 'resolved'
  | 'reopened'
  | 'closed'
  | 'accepted'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'escalated'
  | 'submitted'
  | 'under_review'
  | 'assigned_department'
  | 'assigned_staff'
  | 'pending_approval';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TenantConfirmationStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  originalName?: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedByRole?: string;
  comment?: string | null;
  createdAt?: string;
}

export interface StatusHistoryItem {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  changedBy: string;
  changedByName?: string;
  notes?: string | null;
  role?: string | null;
  createdAt?: string;
}

export interface AssignmentItem {
  id: string;
  role: 'department_manager' | 'staff';
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  notes?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedBy?: string | null;
  assignedByName?: string | null;
  createdAt?: string;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  message: string;
  visibility: 'all' | 'internal' | 'tenant' | 'department' | 'both' | 'admin';
  type?: string;
  isInternal?: boolean;
  attachmentId?: string | null;
  departmentIds?: string | null;
  createdAt?: string;
}

export interface TimelineEvent {
  id: string;
  kind: 'status' | 'comment' | 'attachment' | 'assignment';
  type?: string;
  message?: string;
  notes?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  visibility?: string;
  status?: string | null;
  role?: string | null;
  actorName?: string | null;
  departmentIds?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  createdAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'ticket' | 'reply' | 'status' | 'assignment' | 'notice' | 'category' | 'sla' | 'escalation' | 'completion' | 'approval' | 'rejection' | 'reopen' | 'merge' | 'note' | 'internal' | 'chat' | 'message' | 'knowledge' | string;
  ticketId?: string | null;
  noticeId?: string | null;
  roomId?: string | null;
  articleId?: string | null;
  readAt?: string | null;
  createdAt?: string;
}

export interface Ticket {
  id: string;
  referenceNumber: string;
  trackNumber: string;
  tenantId: string;
  tenantName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  title: string;
  description: string;
  priority: TicketPriority;
  category: string;
  status: TicketStatus;
  tenantConfirmationStatus: TenantConfirmationStatus;
  isEscalated: boolean;
  dueDate?: string | null;
  responseDueDate?: string | null;
  escalationDueDate?: string | null;
  isOverdue?: boolean;
  remainingMs?: number | null;
  slaPolicyId?: string | null;
  responseSlaBreached?: boolean;
  escalationSlaBreached?: boolean;
  lastSlaWarningAt?: string | null;
  slaAgreementAccepted?: boolean;
  slaAgreementAcceptedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  completedAt?: string | null;
  approvedAt?: string | null;
  escalatedAt?: string | null;
  reopenedAt?: string | null;
  cancelledAt?: string | null;
   mergedInto?: string | null;
   routingType?: 'general' | 'direct';
   attachments?: TicketAttachment[];
  statusHistory?: StatusHistoryItem[];
  assignments?: AssignmentItem[];
  replies?: TicketReply[];
}

export interface TicketTrackInfo {
  referenceNumber: string;
  trackNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  departmentName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketFormValues {
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  departmentId?: string;
  attachments?: FileList;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const TICKET_STATUSES: TicketStatus[] = [
  'open', 'assigned', 'in_progress', 'pending',
  'waiting_tenant', 'waiting_vendor', 'resolved', 'completed',
  'reopened', 'closed', 'escalated',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  waiting_tenant: 'Waiting for Tenant Confirmation',
  waiting_vendor: 'Waiting for Vendor',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
  accepted: 'Accepted',
  completed: 'Completed',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  escalated: 'Escalated',
  submitted: 'Submitted',
  under_review: 'Under Review (Manager Approval)',
  assigned_department: 'Assigned to Department',
  assigned_staff: 'Assigned to Staff',
  pending_approval: 'Pending Admin Verification',
};

export const TENANT_CONFIRMATION_LABELS: Record<TenantConfirmationStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ACTIVE_STATUSES: TicketStatus[] = [
  'open', 'assigned', 'in_progress', 'pending',
  'waiting_tenant', 'waiting_vendor', 'escalated', 'reopened',
];

export const DEFAULT_CATEGORIES = [
  'Hardware', 'Software', 'Network', 'Printer', 'Email',
  'Internet', 'ERP', 'Attendance', 'Leave', 'Access Request',
  'Payroll', 'Maintenance', 'Other',
];
