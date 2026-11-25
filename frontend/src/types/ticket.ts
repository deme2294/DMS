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

export type SLAStatus =
  | 'within_target'
  | 'approaching_deadline'
  | 'response_breached'
  | 'escalation_triggered'
  | 'resolution_breached'
  | 'completed_successfully';

export type OperationalEscalationStatus =
  | 'none'
  | 'pending_manager'
  | 'pending_admin'
  | 'guidance_provided'
  | 'reassigned'
  | 'collaborative'
  | 'in_person_resolution'
  | 'resolved';

export interface OperationalEscalation {
  id: string;
  ticket_id: string;
  requesting_user_id: string;
  requesting_user_name?: string;
  requesting_user_email?: string;
  department_id?: string | null;
  department_name?: string | null;
  escalation_reason: string;
  problem_description: string;
  actions_attempted: string;
  assistance_required: string;
  destination: 'manager' | 'admin';
  manager_id?: string | null;
  manager_name?: string | null;
  manager_decision?: 'guidance' | 'reassign' | 'collaborate' | 'investigate' | 'escalate_to_admin' | 'pending';
  manager_notes?: string | null;
  manager_decided_at?: string | null;
  admin_id?: string | null;
  admin_name?: string | null;
  admin_decision?: 'approved' | 'guidance' | 'reassign' | 'resource_allocated' | 'rejected' | 'pending';
  admin_notes?: string | null;
  admin_decided_at?: string | null;
  status: OperationalEscalationStatus;
  created_at: string;
  updated_at?: string;
}

export interface TicketCollaborator {
  id: string;
  ticket_id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  user_role?: string;
  department_name?: string;
  assigned_by: string;
  assigned_by_name?: string;
  role: string;
  notes?: string | null;
  contribution_notes?: string | null;
  in_person_notes?: string | null;
  status: 'active' | 'completed' | 'removed';
  created_at: string;
  updated_at?: string;
}

export interface TicketSLAEscalation {
  id: string;
  ticket_id: string;
  sla_policy_id?: string | null;
  policy_name?: string | null;
  policy_priority?: string | null;
  sla_threshold: string;
  trigger_time: string;
  escalation_level: string;
  responsible_recipient_id?: string | null;
  recipient_name?: string | null;
  notification_status: string;
  resolution_deadline?: string | null;
  breach_status: string;
  notes?: string | null;
  created_at: string;
}

export interface PreviousDepartment {
  departmentId: string;
  departmentName: string;
  assignedAt?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  isCurrent?: boolean;
}

export interface PreviousStaff {
  staffId: string;
  staffName?: string | null;
  userId?: string;
  userName?: string | null;
  assignedAt?: string | null;
  isCurrent?: boolean;
}

export interface AssignmentLockInfo {
  isLocked: boolean;
  remainingMinutes: number;
  lockDurationMinutes: number;
  cooldownMinutes?: number;
  isCustomTime?: boolean;
  lockUntil?: string | null;
  assignedAt?: string | null;
  assignedToName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
}

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
  departmentId?: string | null;
  departmentName?: string | null;
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
  targetUserId?: string | null;
  targetUserName?: string | null;
  targetUserRole?: string | null;
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
  ticketNum?: number | null;
  referenceNumber: string;
  trackNumber: string;
  tenantId: string;
  tenantName?: string | null;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  tenantContactPerson?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByPhone?: string | null;
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
  reopened_at?: string | null;
  reopenedBy?: string | null;
  reopened_by?: string | null;
  reopenedByName?: string | null;
  reopened_by_name?: string | null;
  reopenReason?: string | null;
  reopen_reason?: string | null;
  reopenRequestedAt?: string | null;
  reopen_requested_at?: string | null;
  reopenRequestedBy?: string | null;
  reopen_requested_by?: string | null;
  reopenRequestedByName?: string | null;
  reopen_requested_by_name?: string | null;
  reopenRequestReason?: string | null;
  reopen_request_reason?: string | null;
  reopenStatus?: 'none' | 'requested' | 'approved' | 'rejected' | string | null;
  reopen_status?: 'none' | 'requested' | 'approved' | 'rejected' | string | null;
  firstResponseAt?: string | null;
  cancelledAt?: string | null;
   mergedInto?: string | null;
   routingType?: 'general' | 'direct';
  slaStatus?: SLAStatus;
  sla_status?: SLAStatus;
  operationalEscalationStatus?: OperationalEscalationStatus;
  operational_escalation_status?: OperationalEscalationStatus;
  operationalEscalationReason?: string | null;
  operational_escalation_reason?: string | null;
  operationalEscalations?: OperationalEscalation[];
  slaEscalations?: TicketSLAEscalation[];
  collaborators?: TicketCollaborator[];
  previousDepartments?: PreviousDepartment[];
  previousStaff?: PreviousStaff[];
  deptAssignmentLock?: AssignmentLockInfo | null;
  staffAssignmentLock?: AssignmentLockInfo | null;
  reassignTimeMinutes?: number | null;
  staffReassignTimeMinutes?: number | null;
  mergedAt?: string | null;
  mergedBy?: string | null;
  mergeReason?: string | null;
  linkedTickets?: LinkedTicket[];
  primaryTicketInfo?: PrimaryTicketInfo | null;
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
  'open',
  'assigned',
  'in_progress',
  'pending',
  'waiting_tenant',
  'resolved',
  'reopened',
  'closed',
  'escalated',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_LABELS: Record<string, string> = {
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
  'escalated.open': 'Escalated • Open',
  'escalated.assigned': 'Escalated • Assigned',
  'escalated.in_progress': 'Escalated • In Progress',
  'escalated.pending': 'Escalated • Pending',
  'escalated.under_review': 'Escalated • Under Review',
  'escalated.pending_approval': 'Escalated • Pending Approval',
  'escalated.waiting_tenant': 'Escalated • Waiting Tenant',
  'escalated.resolved': 'Escalated • Resolved',
  'escalated.completed': 'Escalated • Completed',
  'escalated.closed': 'Escalated • Closed',
  'escalated.reopened': 'Escalated • Reopened',
};

export const getStatusLabel = (status?: string | null): string => {
  if (!status) return 'Unknown';
  if (STATUS_LABELS[status]) {
    return STATUS_LABELS[status];
  }
  if (status.startsWith('escalated.')) {
    const sub = status.replace(/^escalated\./, '');
    const subLabel = STATUS_LABELS[sub] || sub.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `Escalated • ${subLabel}`;
  }
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getStatusClassName = (status?: string | null): string => {
  if (!status) return 'open';
  return status.replace(/\./g, '_');
};

export const TENANT_CONFIRMATION_LABELS: Record<TenantConfirmationStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ACTIVE_STATUSES: TicketStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'pending',
  'waiting_tenant',
  'escalated',
  'reopened',
];

export const DEFAULT_CATEGORIES = [
  'Hardware', 'Software', 'Network', 'Printer', 'Email',
  'Internet', 'ERP', 'Attendance', 'Leave', 'Access Request',
  'Payroll', 'Maintenance', 'Other',
];

export interface LinkedTicket {
  id: string;
  referenceNumber: string;
  trackNumber?: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  departmentId?: string | null;
  departmentName?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  tenantName?: string | null;
  tenantEmail?: string | null;
  mergedAt: string;
  mergedBy: string;
  mergedByName?: string | null;
  mergeReason: string;
  similarityScore?: number | null;
  originalStatus?: string | null;
  originalSlaStatus?: string | null;
  originalDueDate?: string | null;
  originalResponseDueDate?: string | null;
}

export interface PrimaryTicketInfo {
  primaryId: string;
  primaryReference: string;
  primaryTrackNumber?: string | null;
  primaryTitle: string;
  primaryStatus: TicketStatus;
  primaryPriority?: TicketPriority;
  primaryCategory?: string;
  primaryDepartmentId?: string | null;
  primaryDepartmentName?: string | null;
  primaryAssignedTo?: string | null;
  primaryAssignedToName?: string | null;
  primaryResolutionNotes?: string | null;
  primaryResolvedAt?: string | null;
  primaryClosedAt?: string | null;
  primaryCreatedAt?: string;
  mergedAt: string;
  mergedByName?: string | null;
  mergeReason: string;
  similarityScore?: number | null;
}

export interface MergeCandidateWithSimilarity extends Ticket {
  similarityScore?: number;
  similarityConfidence?: 'high' | 'medium' | 'low';
  similarityReasons?: string[];
  isSuggestedDuplicate?: boolean;
}

export interface GlobalDuplicateSuggestion {
  ticketA: Ticket;
  ticketB: Ticket;
  primaryCandidate?: Ticket;
  duplicateCandidate?: Ticket;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  pattern?: 'cross_tenant' | 'time_shifted' | 'cross_tenant_time_shifted' | 'same_tenant' | 'same_tenant_repeated' | 'general_similarity';
  patternLabel?: string;
  isCrossTenant?: boolean;
  isTimeShifted?: boolean;
  isSameTenant?: boolean;
  isSameTenantRepeated?: boolean;
  isSameCategory?: boolean;
  daysDiff?: number | null;
  hoursDiff?: number | null;
}

export interface MergedTicketRecord {
  id: string;
  referenceNumber: string;
  trackNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  departmentId?: string | null;
  departmentName?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  createdAt: string;
  mergedAt: string;
  mergeReason: string;
  primaryId: string;
  primaryReference: string;
  primaryTitle: string;
  primaryStatus: string;
  mergedByName?: string | null;
}
