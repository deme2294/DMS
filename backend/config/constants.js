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
  'waiting_tenant', 'escalated', 'reopened',
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
// Multi-tier lifecycle:
// Staff resolves -> under_review (Dept Manager approval)
// Dept Manager approves -> pending_approval (Admin verification)
// Admin verifies & resolves -> waiting_tenant (Tenant notification)
// Tenant confirms solved -> completed (or reopens to in_progress if not solved)
export const TICKET_STATUS_TRANSITIONS = {
  admin: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['under_review', 'pending_approval', 'waiting_tenant', 'resolved', 'pending', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    under_review: ['pending_approval', 'waiting_tenant', 'resolved', 'in_progress', 'rejected', 'assigned'],
    pending_approval: ['waiting_tenant', 'resolved', 'in_progress', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'closed', 'escalated', 'reopened'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled', 'reopened'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'assigned', 'under_review', 'resolved', 'waiting_tenant', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'open', 'reopened'],
    submitted: ['under_review', 'assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
  },
  ceo: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['under_review', 'pending_approval', 'waiting_tenant', 'resolved', 'pending', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    under_review: ['pending_approval', 'waiting_tenant', 'resolved', 'in_progress', 'rejected', 'assigned'],
    pending_approval: ['waiting_tenant', 'resolved', 'in_progress', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'closed', 'escalated', 'reopened'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled', 'reopened'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'assigned', 'under_review', 'resolved', 'waiting_tenant', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'open', 'reopened'],
    submitted: ['under_review', 'assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
  },
  manager: {
    assigned: ['in_progress', 'rejected'],
    in_progress: ['under_review', 'pending_approval', 'pending', 'escalated'],
    pending: ['in_progress', 'escalated'],
    under_review: ['pending_approval', 'in_progress', 'rejected'],
    pending_approval: ['in_progress'],
    waiting_tenant: ['in_progress', 'resolved', 'escalated', 'reopened'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'closed', 'in_progress', 'reopened'],
    completed: ['reopened', 'closed'],
    closed: ['reopened'],
    reopened: ['in_progress', 'assigned', 'under_review', 'resolved', 'waiting_tenant', 'escalated'],
    accepted: ['in_progress', 'escalated'],
    escalated: ['in_progress', 'resolved', 'waiting_tenant', 'reopened'],
    assigned_department: ['assigned_staff'],
    assigned_staff: ['in_progress'],
  },
  staff: {
    assigned: ['in_progress'],
    in_progress: ['under_review', 'pending'],
    under_review: [],
    pending: ['in_progress'],
    waiting_tenant: [],
    waiting_vendor: ['in_progress'],
    resolved: [],
    completed: [],
    closed: [],
    reopened: ['in_progress'],
    escalated: ['in_progress'],
    assigned_staff: ['in_progress'],
  },
  tenant: {
    open: ['cancelled'],
    waiting_tenant: ['closed', 'in_progress', 'reopened'],
    resolved: ['closed', 'in_progress', 'reopened'],
    completed: ['reopened'],
    closed: ['reopened'],
    reopened: [],
    escalated: ['in_progress', 'reopened'],
    approved: ['closed'],
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
