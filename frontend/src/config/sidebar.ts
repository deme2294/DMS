export interface SidebarItem {
  label: string;
  path: string;
  icon?: string;
  permission?: string;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarRoleConfig {
  sections: SidebarSection[];
}

export const SIDEBAR_ITEMS: Record<string, SidebarRoleConfig> = {
  admin: {
    sections: [
      {
        title: 'Main',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: '📊', permission: 'dashboard.read' },
          { label: 'Analytics', path: '/admin/analytics', icon: '📈', permission: 'dashboard.read' },
        ],
      },
      {
        title: 'Management',
        items: [
          { label: 'Users', path: '/admin/users', icon: '👥', permission: 'users.read' },
          { label: 'Tenants', path: '/admin/tenants', icon: '🏢', permission: 'tenants.manage' },
          { label: 'Departments', path: '/admin/departments', icon: '🏛️', permission: 'departments.manage' },
          { label: 'Matrix', path: '/admin/matrix', icon: '🔗', permission: 'matrix.manage' },
        ],
      },
        {
          title: 'Operations',
          items: [
            { label: 'Tickets', path: '/admin/tickets', icon: '🎫', permission: 'tickets.read' },
            { label: 'Ticket Categories', path: '/admin/ticket-categories', icon: '🗂️', permission: 'ticket_categories.manage' },
            { label: 'SLA Policies', path: '/admin/sla', icon: '⏱️', permission: 'sla.manage' },
            { label: 'Chat', path: '/admin/chat', icon: '💬' },
            { label: 'Notifications', path: '/admin/notifications', icon: '🔔' },
            { label: 'Notices', path: '/admin/notices', icon: '📢', permission: 'notices.read' },
            { label: 'Knowledge Base', path: '/admin/knowledge', icon: '📚', permission: 'knowledge.read' },
            { label: 'KB Approval', path: '/admin/knowledge/approval', icon: '✅', permission: 'knowledge.review' },
            { label: 'KB Categories', path: '/admin/knowledge/categories', icon: '📂', permission: 'knowledge.manage_categories' },
            { label: 'KB Statistics', path: '/admin/knowledge/statistics', icon: '📊', permission: 'knowledge.view_statistics' },
            { label: 'Feedback', path: '/admin/feedback', icon: '📝', permission: 'feedback.read' },
          ],
        },
        {
          title: 'System',
          items: [
            { label: 'Reports', path: '/admin/reports', icon: '📑', permission: 'reports.read' },
            { label: 'Audit Log', path: '/admin/audit', icon: '🔍', permission: 'audit.read' },
            { label: 'My Profile', path: '/admin/profile', icon: '👤' },
          ],
        },
    ],
  },
  manager: {
    sections: [
      {
        title: 'Main',
        items: [
          { label: 'Dashboard', path: '/manager/dashboard', icon: '📊', permission: 'dashboard.read' },
          { label: 'Analytics', path: '/admin/analytics', icon: '📈', permission: 'dashboard.read' },
        ],
      },
      {
        title: 'Management',
        items: [
          { label: 'Departments', path: '/manager/departments', icon: '🏛️', permission: 'departments.manage' },
          { label: 'Matrix', path: '/manager/matrix', icon: '🔗', permission: 'matrix.manage' },
        ],
      },
        {
          title: 'Operations',
          items: [
            { label: 'Tickets', path: '/manager/tickets', icon: '🎫', permission: 'tickets.read' },
            { label: 'Ticket Categories', path: '/manager/ticket-categories', icon: '🗂️', permission: 'ticket_categories.manage' },
            { label: 'Chat', path: '/manager/chat', icon: '💬' },
            { label: 'Notifications', path: '/manager/notifications', icon: '🔔' },
            { label: 'Notices', path: '/manager/notices', icon: '📢', permission: 'notices.read' },
            { label: 'Knowledge Base', path: '/manager/knowledge', icon: '📚', permission: 'knowledge.read' },
            { label: 'My Articles', path: '/manager/knowledge/my-articles', icon: '📝', permission: 'knowledge.read' },
          ],
        },
      {
        title: 'System',
        items: [
          { label: 'Reports', path: '/manager/reports', icon: '📈', permission: 'reports.read' },
          { label: 'My Profile', path: '/manager/profile', icon: '👤' },
        ],
      },
    ],
  },
  staff: {
    sections: [
      {
        title: 'Main',
        items: [
          { label: 'Dashboard', path: '/staff/dashboard', icon: '📊', permission: 'dashboard.read' },
        ],
      },
      {
        title: 'Work',
        items: [
          { label: 'Tickets', path: '/staff/tickets', icon: '🎫', permission: 'tickets.read' },
            { label: 'Chat', path: '/staff/chat', icon: '💬' },
            { label: 'Notifications', path: '/staff/notifications', icon: '🔔' },
            { label: 'Notices', path: '/staff/notices', icon: '📢', permission: 'notices.read' },
          { label: 'Knowledge Base', path: '/staff/knowledge', icon: '📚', permission: 'knowledge.read' },
          { label: 'My Articles', path: '/staff/knowledge/my-articles', icon: '📝', permission: 'knowledge.read' },
          { label: 'My Profile', path: '/staff/profile', icon: '👤' },
        ],
      },
    ],
  },
  tenant: {
    sections: [
      {
        title: 'Main',
        items: [
          { label: 'Dashboard', path: '/tenant/dashboard', icon: '📊', permission: 'dashboard.read' },
        ],
      },
        {
          title: 'Services',
          items: [
            { label: 'My Tickets', path: '/tenant/tickets', icon: '🎫', permission: 'tickets.read' },
            { label: 'New Ticket', path: '/tenant/tickets/create', icon: '➕', permission: 'tickets.create' },
            { label: 'Chat', path: '/tenant/chat', icon: '💬' },
            { label: 'Notifications', path: '/tenant/notifications', icon: '🔔' },
          ],
        },
      {
        title: 'Information',
        items: [
          { label: 'Notices', path: '/tenant/notices', icon: '📢', permission: 'notices.read' },
          { label: 'Knowledge Base', path: '/tenant/knowledge', icon: '📚', permission: 'knowledge.read' },
          { label: 'Feedback', path: '/tenant/feedback', icon: '💬', permission: 'feedback.read' },
          { label: 'My Profile', path: '/tenant/profile', icon: '👤' },
        ],
      },
    ],
  },
  ceo: {
    sections: [
      {
        title: 'Executive',
        items: [
          { label: 'Dashboard', path: '/ceo/dashboard', icon: '👑', permission: 'ceo.dashboard' },
          { label: 'Executive Analytics', path: '/ceo/analytics', icon: '📈', permission: 'executive.analytics' },
          { label: 'Executive Approvals', path: '/ceo/approvals', icon: '✅', permission: 'executive.approvals' },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'Tickets', path: '/ceo/tickets', icon: '🎫', permission: 'tickets.read' },
          { label: 'Reports', path: '/ceo/reports', icon: '📑', permission: 'reports.read' },
          { label: 'Knowledge Base', path: '/ceo/knowledge', icon: '📚', permission: 'knowledge.read' },
          { label: 'Notices', path: '/ceo/notices', icon: '📢', permission: 'notices.read' },
          { label: 'Chat', path: '/ceo/chat', icon: '💬' },
          { label: 'Notifications', path: '/ceo/notifications', icon: '🔔' },
        ],
      },
      {
        title: 'System',
        items: [
          { label: 'Audit Log', path: '/ceo/audit', icon: '🔍', permission: 'audit.read' },
          { label: 'My Profile', path: '/ceo/profile', icon: '👤' },
        ],
      },
    ],
  },
};
