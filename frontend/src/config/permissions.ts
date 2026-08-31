export const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  staff: '/staff/dashboard',
  tenant: '/tenant/dashboard',
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  ceo: [
    'users.read', 'users.create', 'users.update',
    'tenants.manage',
    'departments.manage', 'matrix.manage',
    'tickets.create', 'tickets.read', 'tickets.assign', 'tickets.approve', 'tickets.close',
    'dashboard.read', 'notices.read', 'notices.create', 'notices.update', 'notices.delete',
    'feedback.read', 'feedback.update', 'feedback.delete',
    'knowledge.read', 'knowledge.create', 'knowledge.update', 'knowledge.approve',
    'knowledge.publish', 'knowledge.submit', 'knowledge.review', 'knowledge.request_revision',
    'knowledge.reject', 'knowledge.unpublish', 'knowledge.archive', 'knowledge.restore',
    'knowledge.delete', 'knowledge.manage_categories', 'knowledge.view_versions',
    'knowledge.manage_versions', 'knowledge.view_audit', 'knowledge.view_statistics',
    'reports.read', 'audit.read', 'office.read',
    'ceo.dashboard', 'executive.analytics', 'executive.reports', 'executive.approvals', 'executive.remarks',
  ],
  manager: [
    'tickets.read', 'tickets.assign', 'reports.read', 'dashboard.read',
    'notices.manage', 'feedback.manage',
    'notices.read', 'feedback.read', 'office.read',
    'audit.read', 'reports.read',
    'departments.read', 'departments.manage', 'matrix.manage',
    'knowledge.read', 'knowledge.create', 'knowledge.update',
    'knowledge.submit', 'knowledge.review', 'knowledge.request_revision',
    'knowledge.reject', 'knowledge.approve', 'knowledge.manage_categories',
  ],
  staff: [
    'tickets.read', 'tickets.assign', 'dashboard.read', 'notices.read',
    'knowledge.read', 'knowledge.create', 'knowledge.update', 'knowledge.submit',
  ],
  tenant: [
    'tickets.create', 'tickets.read', 'feedback.create', 'dashboard.read',
    'notices.read', 'knowledge.read', 'knowledge.rate', 'feedback.read',
  ],
};

export const ADMIN_MENU = [
  { label: 'Dashboard', path: '/admin/dashboard', permission: 'dashboard.read' },
  { label: 'Users', path: '/admin/users', permission: 'users.read' },
  { label: 'Tenants', path: '/admin/tenants', permission: 'tenants.manage' },
  { label: 'Departments', path: '/admin/departments', permission: 'departments.manage' },
];