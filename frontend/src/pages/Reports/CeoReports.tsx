import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchTicketReport,
  fetchDepartmentReport,
  fetchStaffReport,
  fetchTenantReport,
  exportReport,
} from '../../api/reportApi';
import { fetchDepartments } from '../../api/departmentApi';
import type {
  TicketReport,
  DepartmentReport,
  StaffReport,
  TenantReport,
  ReportFilter,
} from '../../api/reportApi';
import type { Department } from '../../types/department';
import styles from './CeoReports.module.css';

export default function CeoReports() {
  const [ticketReport, setTicketReport] = useState<TicketReport | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [tenantReport, setTenantReport] = useState<TenantReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Pick<Department, 'id' | 'name'>[]>([]);
  const [filter, setFilter] = useState<ReportFilter>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [tickets, depts, staff, tenants] = await Promise.all([
        fetchTicketReport(filter),
        fetchDepartmentReport(filter),
        fetchStaffReport(filter),
        fetchTenantReport(filter),
      ]);
      setTicketReport(tickets.data.data);
      setDepartmentReport(depts.data.data);
      setStaffReport(staff.data.data);
      setTenantReport(tenants.data.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    fetchDepartments({ limit: 100 })
      .then((res) => setDepartments(res.data.data))
      .catch(() => { });
  }, []);

  const StatCard = ({ label, value }: { label: string; value: number | string }) => (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive Reports"
        description="Organization-wide performance and operational insights."
        backTo="/ceo/dashboard"
      />

      <div className={styles.filters}>
        <input
          type="date"
          value={filter.startDate ?? ''}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
        />
        <input
          type="date"
          value={filter.endDate ?? ''}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
        />
        <select
          value={filter.departmentId ?? ''}
          onChange={(e) => setFilter({ ...filter, departmentId: e.target.value || undefined })}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Total Tickets" value={ticketReport?.totalTickets ?? 0} />
        <StatCard label="Active Departments" value={departmentReport?.activeDepartments ?? 0} />
        <StatCard label="Total Staff" value={staffReport?.totalStaff ?? 0} />
        <StatCard label="Active Tenants" value={tenantReport?.activeTenants ?? 0} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Ticket Report</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('tickets', filter)}>Export CSV</button>
        </div>
        <DataTable<{ id: string; status: string; count: number }>
          loading={loading}
          data={Object.entries(ticketReport?.statusCounts ?? {}).map(([status, count]) => ({ id: status, status, count }))}
          emptyMessage="No ticket data"
          columns={[
            {
              key: 'status', label: 'Status', render: (row) => (
                <span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span>
              )
            },
            { key: 'count', label: 'Count' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Department Performance</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('departments', filter)}>Export CSV</button>
        </div>
        <DataTable<any>
          loading={loading}
          data={departmentReport?.departmentPerformance ?? []}
          emptyMessage="No department data"
          columns={[
            { key: 'name', label: 'Department' },
            { key: 'totalTickets', label: 'Tickets', render: (row) => row.totalTickets ?? (row as any).ticketCount ?? 0 },
            { key: 'avgResolutionTime', label: 'Avg Resolution (hrs)', render: (row) => row.avgResolutionTime?.toFixed(1) ?? '—' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Staff Performance</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('staff', filter)}>Export CSV</button>
        </div>
        <DataTable<{ id: string; name: string; ticketCount: number; resolvedCount: number; avgRating?: number }>
          loading={loading}
          data={staffReport?.staffPerformance ?? []}
          emptyMessage="No staff data"
          columns={[
            { key: 'name', label: 'Staff' },
            { key: 'ticketCount', label: 'Total Tickets' },
            { key: 'resolvedCount', label: 'Resolved' },
            { key: 'avgRating', label: 'Avg Rating', render: (row) => row.avgRating?.toFixed(1) ?? '—' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Tenant Activity</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('tenants', filter)}>Export CSV</button>
        </div>
        <DataTable<{ id: string; organizationName: string; ticketCount: number; userCount: number }>
          loading={loading}
          data={tenantReport?.tenantActivity ?? []}
          emptyMessage="No tenant data"
          columns={[
            { key: 'organizationName', label: 'Organization' },
            { key: 'ticketCount', label: 'Tickets' },
            { key: 'userCount', label: 'Users' },
          ]}
        />
      </div>
    </div>
  );
}
