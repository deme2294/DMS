export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  TENANT: 'tenant',
  CEO: 'ceo',
};

export const HTTP = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOCKED: 423,
  SERVER_ERROR: 500,
};

// Primary ticket lifecycle statuses
export const TICKET_STATUS = [
  'open',
  'assigned',
  'in_progress',
  'pending',
  'waiting_tenant',
  'waiting_vendor',
  'resolved',
  'reopened',
  'closed',
  // legacy / secondary (kept for history compatibility, not primary workflow)
  'accepted',
  'completed',
  'approved',
  'rejected',
  'cancelled',
  'escalated',
  'submitted',
  'under_review',
  'assigned_department',
  'assigned_staff',
  'pending_approval',
];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const TICKET_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_COMMENT_TYPES = ['comment', 'note', 'reply'];
export const TICKET_VISIBILITY = ['all', 'internal'];

export const TENANT_CONFIRMATION_STATUS = [
  'not_required',
  'pending',
  'approved',
  'rejected',
];

// Human readable labels
export const TICKET_STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  waiting_tenant: 'Waiting for Tenant',
  waiting_vendor: 'Waiting for Vendor',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
  // legacy labels kept for history rendering
  accepted: 'Accepted',
  completed: 'Completed',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  escalated: 'Escalated',
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned_department: 'Assigned to Department',
  assigned_staff: 'Assigned to Staff',
  pending_approval: 'Pending Approval',
};

// Statuses considered "open / active" for statistics
export const ACTIVE_STATUSES = [
  'open', 'assigned', 'in_progress', 'pending',
  'waiting_tenant', 'waiting_vendor', 'escalated', 'reopened',
];

// Statuses considered "resolved / finished" for statistics
export const RESOLVED_STATUSES = ['resolved', 'closed', 'completed'];

export const ESCALATED_STATUSES = ['escalated'];

export const TENANT_CONFIRMATION_LABELS = {
  not_required: 'Not Required',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

// SLA resolution hours fallback (also stored in sla_policies table)
export const SLA_RESOLUTION_HOURS = {
  urgent: 4,
  high: 8,
  medium: 24,
  low: 72,
};

export const SLA_RESPONSE_HOURS = {
  urgent: 1,
  high: 2,
  medium: 4,
  low: 8,
};

// Allowed status transitions per role (workflow validation).
// 'overdue' is computed at read time, never a stored transition.
export const TICKET_STATUS_TRANSITIONS = {
  admin: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'closed', 'escalated'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'completed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'completed', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    under_review: ['assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
    pending_approval: ['resolved', 'in_progress'],
  },
  ceo: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'closed', 'escalated'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'completed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'completed', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    under_review: ['assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
    pending_approval: ['resolved', 'in_progress'],
  },
  manager: {
    assigned: ['in_progress', 'rejected'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed', 'escalated'],
    pending: ['in_progress', 'escalated'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'escalated'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress'],
    completed: ['reopened', 'closed'],
    reopened: ['in_progress', 'escalated'],
    // legacy
    accepted: ['in_progress', 'escalated'],
    escalated: ['in_progress', 'resolved', 'waiting_tenant', 'completed'],
    assigned_department: ['assigned_staff'],
    assigned_staff: ['in_progress'],
    pending_approval: ['resolved', 'in_progress'],
  },
  staff: {
    assigned: ['in_progress'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed'],
    pending: ['in_progress'],
    waiting_tenant: ['in_progress', 'resolved', 'completed'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'completed', 'in_progress'],
    completed: ['reopened'],
    reopened: ['in_progress'],
    escalated: ['in_progress', 'waiting_tenant', 'resolved'],
    // legacy
    assigned_staff: ['in_progress'],
  },
  tenant: {
    open: ['cancelled'],
    waiting_tenant: ['completed', 'closed', 'in_progress', 'reopened'],
    resolved: ['completed', 'closed', 'in_progress', 'reopened'],
    completed: ['reopened'],
    reopened: [],
    escalated: ['completed', 'in_progress', 'reopened'],
    // legacy
    approved: ['closed', 'completed'],
    submitted: ['cancelled'],
  },
};

// Attachments
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
];
export const ALLOWED_ATTACHMENT_EXT = [
  'jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip',
];
