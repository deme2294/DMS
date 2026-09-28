export const KNOWLEDGE_STATUS = [
  'draft',
  'pending_approval',
  'needs_revision',
  'approved',
  'published',
  'unpublished',
  'rejected',
  'archived',
  'restored',
];

export const KNOWLEDGE_STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  needs_revision: 'Needs Revision',
  approved: 'Approved',
  published: 'Published',
  unpublished: 'Unpublished',
  rejected: 'Rejected',
  archived: 'Archived',
  restored: 'Restored',
};

export const KNOWLEDGE_VISIBILITY = [
  'tenant',
  'internal',
  'department',
  'restricted',
  'public',
];

export const KNOWLEDGE_VISIBILITY_LABELS = {
  tenant: 'Tenant',
  internal: 'Internal',
  department: 'Department',
  restricted: 'Restricted',
  public: 'Public',
};

export const ALLOWED_ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

export const ALLOWED_ATTACHMENT_EXT = [
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt',
];

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_TRANSITIONS = {
  draft: ['pending_approval', 'approved', 'published'],
  pending_approval: ['approved', 'published', 'needs_revision', 'rejected'],
  needs_revision: ['draft', 'pending_approval'],
  approved: ['published', 'draft'],
  published: ['unpublished', 'archived'],
  unpublished: ['published', 'draft'],
  archived: ['restored'],
  rejected: ['draft'],
  restored: ['draft'],
};
