import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  fetchCeoDashboard,
  fetchCeoDepartmentPerformance,
  fetchCeoStaffPerformance,
  fetchCeoTenantStats,
  fetchCeoSystemStats,
  fetchTicketCharts,
  fetchTicketStats,
  type CeoDashboardStats,
  type CeoDepartmentPerformance,
  type CeoStaffPerformance,
  type CeoTenantStat,
  type CeoSystemStats,
  type TicketStatistics,
  type TicketCharts,
} from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './CeoDashboard.module.css';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#eab308',
  high: '#f97316',
  urgent: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  assigned: '#6366f1',
  accepted: '#06b6d4',
  pending: '#eab308',
  in_progress: '#f97316',
  waiting_tenant: '#ec4899',
  waiting_vendor: '#a855f7',
  resolved: '#22c55e',
  completed: '#10b981',
  approved: '#14b8a6',
  closed: '#64748b',
  rejected: '#ef4444',
  escalated: '#dc2626',
  reopened: '#f59e0b',
};

function Pie({ data, colors }: { data: { label: string; value: number }[]; colors: Record<string, string> }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const segments = data.map((d) => {
    const start = (acc / total) * 360;
    acc += d.value;
    const end = (acc / total) * 360;
    return { ...d, start, end };
  });
  return (
    <div className={styles.pieWrap}>
      <svg viewBox="0 0 120 120" className={styles.pie}>
        {segments.map((s) => (
          <circle
            key={s.label}
            cx="60"
            cy="60"
            r="50"
            fill="transparent"
            stroke={colors[s.label] || '#94a3b8'}
            strokeWidth="22"
            strokeDasharray={`${((s.end - s.start) / 360) * 314.159} 314.159`}
            strokeDashoffset={`${-(s.start / 360) * 314.159}`}
            transform="rotate(-90 60 60)"
          />
        ))}
      </svg>
      <ul className={styles.legend}>
        {data.map((d) => (
          <li key={d.label}>
            <span className={styles.dot} style={{ background: colors[d.label] || '#94a3b8' }} />
            <span className={styles.legendLabel}>{d.label}</span>
            <span className={styles.legendValue}>{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar({ data, color = '#d4af37' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={styles.barChart}>
      {data.map((d) => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className={styles.barValue}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function LineArea({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 100;
  const h = 60;
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  });
  const area = `0,${h} ${pts.join(' ')} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.lineChart}>
      <polygon points={area} fill="rgba(212,175,55,0.18)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#d4af37" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const SUMMARY_CARDS: { key: keyof CeoDashboardStats; label: string; tone?: string }[] = [
  { key: 'totalTenants', label: 'Total Tenants', tone: 'gold' },
  { key: 'totalUsers', label: 'Total Users', tone: 'gold' },
  { key: 'totalDepartments', label: 'Total Departments', tone: 'gold' },
  { key: 'totalStaff', label: 'Total Staff', tone: 'blue' },
  { key: 'totalDepartmentManagers', label: 'Dept Managers', tone: 'blue' },
  { key: 'totalGeneralManagers', label: 'General Managers', tone: 'blue' },
  { key: 'totalAdmins', label: 'Admins', tone: 'blue' },
  { key: 'activeUsers', label: 'Active Users', tone: 'green' },
  { key: 'inactiveUsers', label: 'Inactive Users', tone: 'red' },
  { key: 'totalTickets', label: 'Total Tickets', tone: 'gold' },
  { key: 'openTickets', label: 'Open Tickets', tone: 'blue' },
  { key: 'pendingTickets', label: 'Pending Tickets', tone: 'amber' },
  { key: 'inProgressTickets', label: 'In Progress', tone: 'amber' },
  { key: 'resolvedTickets', label: 'Resolved', tone: 'green' },
  { key: 'closedTickets', label: 'Closed', tone: 'slate' },
  { key: 'overdueTickets', label: 'Overdue', tone: 'red' },
  { key: 'withinSla', label: 'Within SLA', tone: 'green' },
  { key: 'nearDeadline', label: 'Near Deadline', tone: 'amber' },
  { key: 'knowledgeArticles', label: 'KB Articles', tone: 'gold' },
  { key: 'feedbackReceived', label: 'Feedback', tone: 'blue' },
  { key: 'noticesPublished', label: 'Notices', tone: 'blue' },
];

export default function CeoDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CeoDashboardStats | null>(null);
  const [deptPerf, setDeptPerf] = useState<CeoDepartmentPerformance[]>([]);
  const [staffPerf, setStaffPerf] = useState<CeoStaffPerformance[]>([]);
  const [tenantStats, setTenantStats] = useState<CeoTenantStat[]>([]);
  const [systemStats, setSystemStats] = useState<CeoSystemStats | null>(null);
  const [charts, setCharts] = useState<TicketCharts | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCeoDashboard(),
      fetchCeoDepartmentPerformance(),
      fetchCeoStaffPerformance(),
      fetchCeoTenantStats(),
      fetchCeoSystemStats(),
      fetchTicketCharts(),
      fetchTicketStats(),
    ])
      .then(([d, dep, stf, ten, sys, ch, ts]) => {
        setStats(d.data.data.stats);
        setDeptPerf(dep.data.data);
        setStaffPerf(stf.data.data);
        setTenantStats(ten.data.data);
        setSystemStats(sys.data.data);
        setCharts(ch.data.data);
        setTicketStats(ts.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date().toLocaleString();

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Welcome, ${user?.firstName || 'CEO'}`}
        description={`Executive overview · ${now}`}
      />

      {loading && <div className={styles.loading}>Loading executive data…</div>}

      {/* Executive summary cards */}
      <div className={styles.summaryGrid}>
        {SUMMARY_CARDS.map((c) => (
          <div key={c.key} className={`${styles.summaryCard} ${styles[c.tone || 'gold']}`}>
            <div className={styles.summaryValue}>{stats ? stats[c.key] : '—'}</div>
            <div className={styles.summaryLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Ticket analytics */}
      {charts && ticketStats && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Ticket Analytics</h3>
          <div className={styles.analyticsGrid}>
            <div className={styles.panel}>
              <h4>By Department</h4>
              <Bar data={charts.byDepartment.map((d) => ({ label: d.name, value: d.count }))} />
            </div>
            <div className={styles.panel}>
              <h4>By Priority</h4>
              <Pie data={charts.byPriority.map((d) => ({ label: d.priority, value: d.count }))} colors={PRIORITY_COLORS} />
            </div>
            <div className={styles.panel}>
              <h4>By Status</h4>
              <Pie data={charts.byStatus.map((d) => ({ label: d.status, value: d.count }))} colors={STATUS_COLORS} />
            </div>
            <div className={styles.panel}>
              <h4>By Category</h4>
              <Bar data={charts.byCategory.map((d) => ({ label: d.category, value: d.count }))} color="#22c55e" />
            </div>
            <div className={styles.panel}>
              <h4>Monthly Volume (Line)</h4>
              <LineArea data={charts.monthly.map((d) => ({ month: d.month, count: d.count }))} />
            </div>
            <div className={styles.panel}>
              <h4>Resolution by Priority (Hours)</h4>
              <Bar
                data={charts.resolutionByPriority.map((d) => ({
                  label: d.priority,
                  value: Math.round(Number(d.avg_hours) || 0),
                }))}
                color="#a855f7"
              />
            </div>
          </div>
        </div>
      )}

      {/* Department performance */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Department Performance</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Open</th>
                <th>Resolved</th>
                <th>Pending</th>
                <th>Avg Res. (h)</th>
                <th>Employees</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {deptPerf.map((d) => (
                <tr key={d.id}>
                  <td>#{d.rank}</td>
                  <td className={styles.strong}>{d.department_name}</td>
                  <td>{d.manager_name || '—'}</td>
                  <td>{d.open_tickets}</td>
                  <td>{d.resolved_tickets}</td>
                  <td>{d.pending_tickets}</td>
                  <td>{d.avg_resolution_hours ? Number(d.avg_resolution_hours).toFixed(1) : '—'}</td>
                  <td>{d.employee_count}</td>
                  <td>
                    <div className={styles.perfBar}>
                      <div className={styles.perfFill} style={{ width: `${d.performance}%` }} />
                      <span>{d.performance}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!deptPerf.length && (
                <tr><td colSpan={9} className={styles.empty}>No department data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff performance */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Staff Performance</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Department</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>Pending</th>
                <th>Avg Res. (h)</th>
              </tr>
            </thead>
            <tbody>
              {staffPerf.map((s) => (
                <tr key={s.id}>
                  <td className={styles.strong}>{s.first_name} {s.last_name}</td>
                  <td>{s.department_name || '—'}</td>
                  <td>{s.assigned_tickets}</td>
                  <td>{s.completed_tickets}</td>
                  <td>{s.pending_tickets}</td>
                  <td>{s.avg_resolution_hours ? Number(s.avg_resolution_hours).toFixed(1) : '—'}</td>
                </tr>
              ))}
              {!staffPerf.length && (
                <tr><td colSpan={6} className={styles.empty}>No staff data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant statistics + System statistics */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tenant Statistics</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Closed</th>
                  <th>Avg Res. (h)</th>
                </tr>
              </thead>
              <tbody>
                {tenantStats.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.strong}>{t.organization_name}</td>
                    <td>
                      <span className={`${styles.badge} ${t.status === 'active' ? styles.ok : styles.warn}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.tickets_submitted}</td>
                    <td>{t.tickets_closed}</td>
                    <td>{t.avg_resolution_hours ? Number(t.avg_resolution_hours).toFixed(1) : '—'}</td>
                  </tr>
                ))}
                {!tenantStats.length && (
                  <tr><td colSpan={5} className={styles.empty}>No tenant data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {systemStats && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>System Statistics</h3>
            <div className={styles.sysGrid}>
              <div className={`${styles.sysCard} ${styles.blue}`}><div className={styles.sysValue}>{systemStats.daily}</div><div className={styles.sysLabel}>Daily Activities</div></div>
              <div className={`${styles.sysCard} ${styles.blue}`}><div className={styles.sysValue}>{systemStats.weekly}</div><div className={styles.sysLabel}>Weekly</div></div>
              <div className={`${styles.sysCard} ${styles.blue}`}><div className={styles.sysValue}>{systemStats.monthly}</div><div className={styles.sysLabel}>Monthly</div></div>
              <div className={`${styles.sysCard} ${styles.blue}`}><div className={styles.sysValue}>{systemStats.yearly}</div><div className={styles.sysLabel}>Yearly</div></div>
              <div className={`${styles.sysCard} ${styles.green}`}><div className={styles.sysValue}>{systemStats.newUsers}</div><div className={styles.sysLabel}>New Users</div></div>
              <div className={`${styles.sysCard} ${styles.green}`}><div className={styles.sysValue}>{systemStats.newTenants}</div><div className={styles.sysLabel}>New Tenants</div></div>
              <div className={`${styles.sysCard} ${styles.gold}`}><div className={styles.sysValue}>{systemStats.resolvedThisMonth}</div><div className={styles.sysLabel}>Resolved (mo)</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
