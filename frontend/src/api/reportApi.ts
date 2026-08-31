import api from './axios';

export interface TicketReport {
  totalTickets: number;
  resolved: number;
  closed: number;
  inProgress: number;
  pending: number;
  avgResolutionHours: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  monthlyTrend: { month: string; count: number }[];
  resolutionTimeByPriority: { priority: string; avgHours: number; count: number }[];
  resolutionTimeByStatus: { status: string; avgHours: number; count: number }[];
}

export interface DepartmentReport {
  totalDepartments: number;
  activeDepartments: number;
  departmentPerformance: {
    id: string;
    name: string;
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    inProgressTickets: number;
    avgResolutionTime: number;
  }[];
}

export interface StaffReport {
  totalStaff: number;
  activeStaff: number;
  staffPerformance: {
    id: string;
    name: string;
    ticketCount: number;
    resolvedCount: number;
    inProgressCount: number;
    avgRating?: number;
  }[];
}

export interface TenantReport {
  totalTenants: number;
  activeTenants: number;
  tenantActivity: {
    id: string;
    organizationName: string;
    ticketCount: number;
    userCount: number;
  }[];
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  staffId?: string;
  tenantId?: string;
}

export interface MyDepartment {
  id: string;
  name: string;
  code: string;
}

export const fetchMyDepartments = () =>
  api.get<{ success: boolean; data: MyDepartment[] }>('/reports/my-departments');

export const fetchTicketReport = (params?: ReportFilter) =>
  api.get<{ success: boolean; data: TicketReport }>('/reports/tickets', { params });

export const fetchDepartmentReport = (params?: ReportFilter) =>
  api.get<{ success: boolean; data: DepartmentReport }>('/reports/departments', { params });

export const fetchStaffReport = (params?: ReportFilter) =>
  api.get<{ success: boolean; data: StaffReport }>('/reports/staff', { params });

export const fetchTenantReport = (params?: ReportFilter) =>
  api.get<{ success: boolean; data: TenantReport }>('/reports/tenants', { params });

export const exportReport = (type: 'tickets' | 'departments' | 'staff' | 'tenants', params?: ReportFilter) =>
  api.get<Blob>(`/reports/${type}/export`, { params, responseType: 'blob' }).then((res) => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${type}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });