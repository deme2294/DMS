import api from './axios';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTenants: number;
  activeTenants: number;
  totalTickets: number;
  openTickets: number;
  totalDepartments: number;
  totalFeedback: number;
  pendingFeedback: number;
  deactiveUsers:number;
  deactiveTenants:number;

}

export interface ManagerStats {
  departmentUsers: number;
  departmentTickets: number;
  openTickets: number;
  resolvedTickets: number;
  inProgressTickets: number;
}

export interface StaffStats {
  assignedTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
}

export interface TenantStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  overdueTickets: number;
  upcomingDeadlines: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface RecentTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  referenceNumber?: string;
  tenantName?: string;
  departmentName?: string;
}

export interface RecentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  userCount: number;
}

export interface AdminDashboardData {
  stats: AdminStats;
  recentTickets: RecentTicket[];
  recentUsers: RecentUser[];
  statusBreakdown?: StatusBreakdownItem[];
}

export interface ManagerDashboardData {
  stats: ManagerStats;
  recentTickets: RecentTicket[];
  department: DepartmentInfo;
}

export interface StaffDashboardData {
  stats: StaffStats;
  assignedTickets: RecentTicket[];
}

export interface TenantDashboardData {
  stats: TenantStats;
  recentTickets: RecentTicket[];
  pendingFeedback?: { count: number };
  activeNotices?: { count: number };
}

export interface AdminSlaStats {
  ticketsWithinSla: number;
  ticketsApproachingDeadline: number;
  overdueTickets: number;
  completedWithinSla: number;
  completedAfterSla: number;
  avgResolutionHours: number;
  slaCompliancePercentage: number;
}

export interface AdminSlaDashboard {
  stats: AdminSlaStats;
  recentBreaches: any[];
}

export interface ManagerSlaStats {
  departmentSlaPerformance: any;
  teamSlaPerformance: any[];
  overdueTickets: number;
  ticketsNearDeadline: number;
}

export interface ManagerSlaDashboard {
  stats: ManagerSlaStats;
}

export interface StaffSlaStats {
  assignedTickets: number;
  overdueTickets: number;
  upcomingDeadlines: number;
}

export interface StaffSlaTicketItem {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  assignedDate: string;
  responseDue?: string | null;
  resolutionDue?: string | null;
  remainingTime?: string | null;
  slaStatus: string;
}

export interface StaffSlaDashboard {
  stats: StaffSlaStats;
  assignedTickets: StaffSlaTicketItem[];
}

export const fetchAdminDashboard = () =>
  api.get<{ success: boolean; data: AdminDashboardData }>('/dashboard/admin');

export const fetchManagerDashboard = () =>
  api.get<{ success: boolean; data: ManagerDashboardData }>('/dashboard/manager');

export const fetchStaffDashboard = () =>
  api.get<{ success: boolean; data: StaffDashboardData }>('/dashboard/staff');

export const fetchTenantDashboard = () =>
  api.get<{ success: boolean; data: TenantDashboardData }>('/dashboard/tenant');

export const fetchAdminSlaDashboard = () =>
  api.get<{ success: boolean; data: AdminSlaDashboard }>('/dashboard/admin/sla');

export const fetchManagerSlaDashboard = () =>
  api.get<{ success: boolean; data: ManagerSlaDashboard }>('/dashboard/manager/sla');

export const fetchStaffSlaDashboard = () =>
  api.get<{ success: boolean; data: StaffSlaDashboard }>('/dashboard/staff/sla');

// ── Ticket statistics + charts + overdue ──
export interface TicketStatistics {
  total: number;
  open: number;
  assigned: number;
  pending: number;
  inProgress: number;
  waitingTenant: number;
  waitingVendor: number;
  resolved: number;
  reopened: number;
  closed: number;
  escalated: number;
  cancelled: number;
  overdue: number;
  avgResolutionHours: string;
}

export interface TicketCharts {
  byCategory: { category: string; count: number }[];
  byDepartment: { name: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
  monthly: { month: string; count: number }[];
  resolutionByPriority: { priority: string; avg_hours: number | null }[];
}

export const fetchTicketStats = () =>
  api.get<{ success: boolean; data: TicketStatistics }>('/dashboard/tickets/stats');

export const fetchTicketCharts = () =>
  api.get<{ success: boolean; data: TicketCharts }>('/dashboard/tickets/charts');

export const fetchOverdueTickets = (limit = 50) =>
  api.get<{ success: boolean; data: any[] }>('/dashboard/tickets/overdue', { params: { limit } });

// ── CEO Executive Dashboard ──
export interface CeoDashboardStats {
  totalTenants: number;
  totalUsers: number;
  totalDepartments: number;
  totalStaff: number;
  totalDepartmentManagers: number;
  totalGeneralManagers: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  overdueTickets: number;
  knowledgeArticles: number;
  feedbackReceived: number;
  noticesPublished: number;
  escalatedTickets: number;
  withinSla: number;
  nearDeadline: number;
}

export interface CeoDepartmentPerformance {
  id: string;
  department_name: string;
  manager_name: string | null;
  employee_count: number;
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  pending_tickets: number;
  avg_resolution_hours: string | null;
  rank: number;
  performance: number;
}

export interface CeoStaffPerformance {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  department_name: string | null;
  assigned_tickets: number;
  completed_tickets: number;
  pending_tickets: number;
  avg_resolution_hours: string | null;
}

export interface CeoTenantStat {
  id: string;
  organization_name: string;
  status: string;
  tickets_submitted: number;
  tickets_closed: number;
  avg_resolution_hours: string | null;
}

export interface CeoSystemStats {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  newUsers: number;
  newTenants: number;
  resolvedThisMonth: number;
}

export const fetchCeoDashboard = () =>
  api.get<{ success: boolean; data: { stats: CeoDashboardStats } }>('/dashboard/ceo');

export const fetchCeoDepartmentPerformance = () =>
  api.get<{ success: boolean; data: CeoDepartmentPerformance[] }>('/dashboard/ceo/departments');

export const fetchCeoStaffPerformance = () =>
  api.get<{ success: boolean; data: CeoStaffPerformance[] }>('/dashboard/ceo/staff');

export const fetchCeoTenantStats = () =>
  api.get<{ success: boolean; data: CeoTenantStat[] }>('/dashboard/ceo/tenants');

export const fetchCeoSystemStats = () =>
  api.get<{ success: boolean; data: CeoSystemStats }>('/dashboard/ceo/system');


