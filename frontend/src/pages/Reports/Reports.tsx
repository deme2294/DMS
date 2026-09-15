import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchTicketReport,
  fetchDepartmentReport,
  fetchStaffReport,
  fetchTenantReport,
  fetchMyDepartments,
  exportReport,
} from '../../api/reportApi';
import type { MyDepartment } from '../../api/reportApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type {
  TicketReport,
  DepartmentReport,
  StaffReport,
  TenantReport,
  ReportFilter,
} from '../../api/reportApi';
import { useAuth } from '../../context/AuthContext';
import styles from './Reports.module.css';

export default function Reports() {
  const { user } = useAuth();
  const [ticketReport, setTicketReport] = useState<TicketReport | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [tenantReport, setTenantReport] = useState<TenantReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [myDepts, setMyDepts] = useState<MyDepartment[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [filter, setFilter] = useState<ReportFilter>({});

  const isManager = user?.role === 'manager';

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
    const loadDepts = async () => {
      if (isManager) {
        try {
          const res = await fetchMyDepartments();
          setMyDepts(res.data.data);
        } catch { /* ignore */ }
      } else {
        try {
          const res = await fetchActiveDepartments();
          setAllDepartments(res.data.data);
        } catch { /* ignore */ }
      }
    };
    loadDepts();
  }, [isManager]);

  const StatCard = ({ label, value }: { label: string; value: number | string }) => (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{isManager ? 'Department Reports' : 'Reports'}</h1>
        <p>
          {isManager
            ? 'View ticket, staff, and operational performance metrics for your assigned department(s).'
            : 'View ticket, department, staff, and tenant reports.'}
        </p>
      </div>

      {isManager && myDepts.length > 0 && (
        <div className={styles.deptBadgeRow}>
          <span className={styles.deptBadgeLabel}>Showing data for your department(s):</span>
          {myDepts.map((d) => (
            <span key={d.id} className={styles.deptBadge}>{d.name}</span>
          ))}
        </div>
      )}

      <div className={styles.filters}>
        <input
          type="date"
          value={filter.startDate ?? ''}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
          placeholder="Start Date"
        />
        <input
          type="date"
          value={filter.endDate ?? ''}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
          placeholder="End Date"
        />
        {!isManager && (
          <select
            value={filter.departmentId ?? ''}
            onChange={(e) => setFilter({ ...filter, departmentId: e.target.value || undefined })}
          >
            <option value="">All Departments</option>
            {allDepartments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <button
          className={styles.refreshBtn}
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Total Tickets" value={ticketReport?.totalTickets ?? 0} />
        <StatCard label={isManager ? 'Dept. Sections' : 'Active Departments'} value={departmentReport?.activeDepartments ?? 0} />
        <StatCard label="Total Staff" value={staffReport?.totalStaff ?? 0} />
        {!isManager && <StatCard label="Active Tenants" value={tenantReport?.activeTenants ?? 0} />}
        {isManager && <StatCard label="Resolved Tickets" value={ticketReport?.resolved ?? 0} />}
        <StatCard label="Avg Resolution (hrs)" value={ticketReport?.avgResolutionHours ? Number(ticketReport.avgResolutionHours).toFixed(1) : '0.0'} />
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
          <h2>Priority Report</h2>
        </div>
        <DataTable<{ id: string; priority: string; count: number }>
          loading={loading}
          data={Object.entries(ticketReport?.priorityCounts ?? {}).map(([priority, count]) => ({ id: priority, priority, count }))}
          emptyMessage="No priority data"
          columns={[
            { key: 'priority', label: 'Priority' },
            { key: 'count', label: 'Count' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Ticket Categories Report</h2>
        </div>
        <DataTable<{ id: string; category: string; count: number }>
          loading={loading}
          data={Object.entries(ticketReport?.categoryCounts ?? {}).map(([category, count]) => ({ id: category, category, count }))}
          emptyMessage="No category data"
          columns={[
            { key: 'category', label: 'Category' },
            { key: 'count', label: 'Count' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Resolution Time Report</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>By Priority</h3>
            <DataTable<{ id: string; priority: string; avgHours: number; count: number }>
              loading={loading}
              data={(ticketReport?.resolutionTimeByPriority ?? []).map((r, i) => ({ ...r, id: r.priority || String(i) }))}
              emptyMessage="No resolution data"
              columns={[
                { key: 'priority', label: 'Priority' },
                { key: 'avgHours', label: 'Avg Hours', render: (row) => row.avgHours ? Number(row.avgHours).toFixed(1) : '—' },
                { key: 'count', label: 'Resolved Count' },
              ]}
            />
          </div>
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>By Status</h3>
            <DataTable<{ id: string; status: string; avgHours: number; count: number }>
              loading={loading}
              data={(ticketReport?.resolutionTimeByStatus ?? []).map((r, i) => ({ ...r, id: r.status || String(i) }))}
              emptyMessage="No resolution data"
              columns={[
                { key: 'status', label: 'Status' },
                { key: 'avgHours', label: 'Avg Hours', render: (row) => row.avgHours ? Number(row.avgHours).toFixed(1) : '—' },
                { key: 'count', label: 'Resolved Count' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Department Performance</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('departments', filter)}>Export CSV</button>
        </div>
        <DataTable<{ id: string; name: string; totalTickets: number; openTickets: number; resolvedTickets: number; closedTickets: number; inProgressTickets: number; avgResolutionTime: number }>
          loading={loading}
          data={departmentReport?.departmentPerformance ?? []}
          emptyMessage="No department data"
          columns={[
            { key: 'name', label: 'Department' },
            { key: 'totalTickets', label: 'Total Tickets' },
            { key: 'openTickets', label: 'Open Tickets' },
            { key: 'resolvedTickets', label: 'Resolved' },
            { key: 'closedTickets', label: 'Closed' },
            { key: 'inProgressTickets', label: 'In Progress' },
            { key: 'avgResolutionTime', label: 'Avg Resolution (hrs)', render: (row) => row.avgResolutionTime ? Number(row.avgResolutionTime).toFixed(1) : '—' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Staff Performance</h2>
          <button className={styles.exportBtn} onClick={() => exportReport('staff', filter)}>Export CSV</button>
        </div>
        <DataTable<{ id: string; name: string; ticketCount: number; resolvedCount: number; inProgressCount: number; avgRating?: number }>
          loading={loading}
          data={staffReport?.staffPerformance ?? []}
          emptyMessage="No staff data"
          columns={[
            { key: 'name', label: 'Staff' },
            { key: 'ticketCount', label: 'Total Tickets' },
            { key: 'resolvedCount', label: 'Resolved' },
            { key: 'inProgressCount', label: 'In Progress' },
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
