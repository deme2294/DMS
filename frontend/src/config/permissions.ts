export const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  staff: '/staff/dashboard',
  tenant: '/tenant/dashboard',
  ceo: '/ceo/dashboard',
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  ceo: [
    'users.read',
    'tickets.read',
    'departments.read',
    'dashboard.read', 'notices.read', 'feedback.read',
    'knowledge.read', 'office.read',
    'reports.read', 'audit.read',
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