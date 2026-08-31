import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminDashboard, fetchTicketStats, fetchTicketCharts, fetchAdminSlaDashboard } from '../../api/dashboardApi';
import type { AdminDashboardData, TicketStatistics, TicketCharts, AdminSlaDashboard } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  assigned_department: 'bg-indigo-100 text-indigo-700',
  assigned_staff: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  rejected: 'bg-red-100 text-red-700',
  accepted: 'bg-teal-100 text-teal-700',
  escalated: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  open: 'bg-blue-100 text-blue-700',
  waiting_tenant: 'bg-pink-100 text-pink-700',
  waiting_vendor: 'bg-purple-100 text-purple-700',
  reopened: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-600',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-sky-100 text-sky-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStatistics | null>(null);
  const [charts, setCharts] = useState<TicketCharts | null>(null);
  const [slaData, setSlaData] = useState<AdminSlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
    fetchTicketStats().then((r) => setTicketStats(r.data.data)).catch(() => {});
    fetchTicketCharts().then((r) => setCharts(r.data.data)).catch(() => {});
    fetchAdminSlaDashboard().then((r) => setSlaData(r.data.data)).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>
  );

  const s = data!.stats;
  const statusBreakdown = data!.statusBreakdown;

  const statCards = [
    { label: 'Total Users', value: s.totalUsers, icon: '👥', color: 'from-blue-500 to-blue-600', link: '/admin/users' },
    { label: 'Active Users', value: s.activeUsers, icon: '✅', color: 'from-green-500 to-green-600', link: '/admin/users' },
    { label: 'Total Tenants', value: s.totalTenants, icon: '🏢', color: 'from-violet-500 to-violet-600', link: '/admin/tenants' },
    { label: 'Active Tenants', value: s.activeTenants, icon: '🟢', color: 'from-emerald-500 to-emerald-600', link: '/admin/tenants' },
    { label: 'Total Tickets', value: s.totalTickets, icon: '🎫', color: 'from-indigo-500 to-indigo-600', link: '/admin/tickets' },
    { label: 'Open Tickets', value: s.openTickets, icon: '📬', color: 'from-amber-500 to-amber-600', link: '/admin/tickets' },
    { label: 'Departments', value: s.totalDepartments, icon: '🏛️', color: 'from-cyan-500 to-cyan-600', link: '/admin/departments' },
    { label: 'Pending Feedback', value: s.pendingFeedback, icon: '💬', color: 'from-rose-500 to-rose-600', link: '/admin/feedback' },
     { label: 'deactive users', value: s.deactiveUsers, icon: '💬', color: 'from-rose-500 to-rose-600', link: '/admin/deactiveusers' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Section: Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome back, <span className="font-medium text-slate-700">{user?.firstName} {user?.lastName}</span> · System overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Middle Section: Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon, color, link }) => (
          <Link key={label} to={link}
            className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg mb-3 shadow-sm`}>
              {icon}
            </div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      {/* Middle Section: Status Breakdown */}
      {statusBreakdown && statusBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">Ticket Status Breakdown</h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{statusBreakdown.length} statuses</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map((s: { status: string; count: number }) => (
              <span key={s.status}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[s.status] ?? 'bg-slate-100 text-slate-600'}`}
              >
                {s.status.replace(/_/g, ' ')} · {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Statistics */}
      {ticketStats && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Ticket Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
             {[
               { label: 'Open', value: ticketStats.open },
               { label: 'Assigned', value: ticketStats.assigned },
               { label: 'Pending', value: ticketStats.pending },
               { label: 'In Progress', value: ticketStats.inProgress },
               { label: 'Resolved', value: ticketStats.resolved },
               { label: 'Closed', value: ticketStats.closed },
               { label: 'Reopened', value: ticketStats.reopened },
               { label: 'Escalated', value: ticketStats.escalated },
             ].map((c) => (
              <div key={c.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-xl font-bold text-slate-800">{c.value}</div>
                <div className="text-xs text-slate-500">{c.label}</div>
              </div>
            ))}
            <div key="overdue" className="rounded-xl bg-red-50 border border-red-100 p-3">
              <div className="text-xl font-bold text-red-600">{ticketStats.overdue}</div>
              <div className="text-xs text-red-500">Overdue</div>
            </div>
          </div>
        </div>
      )}

      {/* SLA Dashboard */}
      {slaData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">SLA Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-100 p-3">
              <div className="text-xl font-bold text-green-600">{slaData.stats.ticketsWithinSla}</div>
              <div className="text-xs text-green-500">Within SLA</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="text-xl font-bold text-amber-600">{slaData.stats.ticketsApproachingDeadline}</div>
              <div className="text-xs text-amber-500">Approaching Deadline</div>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <div className="text-xl font-bold text-red-600">{slaData.stats.overdueTickets}</div>
              <div className="text-xs text-red-500">Overdue Tickets</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-xl font-bold text-emerald-600">{slaData.stats.completedWithinSla}</div>
              <div className="text-xs text-emerald-500">Completed Within SLA</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <div className="text-xl font-bold text-rose-600">{slaData.stats.completedAfterSla}</div>
              <div className="text-xs text-rose-500">Completed After SLA</div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div className="text-xl font-bold text-blue-600">{slaData.stats.avgResolutionHours}h</div>
              <div className="text-xs text-blue-500">Avg Resolution Time</div>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
              <div className="text-xl font-bold text-indigo-600">{slaData.stats.slaCompliancePercentage}%</div>
              <div className="text-xs text-indigo-500">SLA Compliance</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChart title="Tickets by Category" data={charts.byCategory} labelKey="category" />
          <BarChart title="Tickets by Department" data={charts.byDepartment} labelKey="name" />
          <BarChart title="Tickets by Priority" data={charts.byPriority} labelKey="priority" />
          <BarChart title="Tickets by Status" data={charts.byStatus} labelKey="status" />
        </div>
      )}

      {/* Bottom Section: Recent Tickets */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">Recent Tickets</h2>
          <Link to="/admin/tickets" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>

        {!data!.recentTickets?.length ? (
          <div className="py-10 text-center">
            <div className="text-3xl mb-2 opacity-40">🎫</div>
            <p className="text-slate-400 text-sm">No tickets yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Title</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Tenant</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data!.recentTickets.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/admin/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1">{t.title}</Link>
                      <div className="text-xs text-slate-400 mt-0.5">{t.referenceNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{t.tenantName ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BarChart({
  title,
  data,
  labelKey,
}: {
  title: string;
  data: { [k: string]: any }[];
  labelKey: string;
}) {
  const max = Math.max(1, ...data.map((d) => Number(d.count || 0)));
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">{title}</h2>
      {!data.length ? (
        <p className="text-sm text-slate-400">No data</p>
      ) : (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="w-28 capitalize text-slate-600 truncate">{String(d[labelKey]).replace(/_/g, ' ')}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${(Number(d.count || 0) / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-semibold text-slate-700">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
