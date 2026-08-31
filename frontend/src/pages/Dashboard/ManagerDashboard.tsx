import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchManagerDashboard, fetchManagerSlaDashboard } from '../../api/dashboardApi';
import type { ManagerDashboardData, ManagerSlaDashboard } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-sky-100 text-sky-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [slaData, setSlaData] = useState<ManagerSlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchManagerDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
    fetchManagerSlaDashboard().then((r) => setSlaData(r.data.data)).catch(() => { });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>;

  const s = data!.stats;

  const statCards = [
    { label: 'Department Tickets', value: s.departmentTickets, icon: '🎫', color: 'from-blue-500 to-blue-600' },
    { label: 'Open Tickets', value: s.openTickets, icon: '📬', color: 'from-amber-500 to-amber-600' },
    { label: 'In Progress', value: s.inProgressTickets, icon: '⚡', color: 'from-orange-500 to-orange-600' },
    { label: 'Resolved', value: s.resolvedTickets, icon: '✅', color: 'from-green-500 to-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manager Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome back, <span className="font-medium text-slate-700">{user?.firstName} {user?.lastName}</span> · Department overview
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 self-start">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {data?.department && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-md">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">Your Department</div>
          <div className="text-xl font-bold">{data.department.name}</div>
          <div className="text-sm opacity-80 mt-1">{data.department.userCount} team members</div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg mb-3`}>{icon}</div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {slaData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">SLA Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <div className="text-xl font-bold text-red-600">{slaData.stats.overdueTickets}</div>
              <div className="text-xs text-red-500">Overdue Tickets</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="text-xl font-bold text-amber-600">{slaData.stats.ticketsNearDeadline}</div>
              <div className="text-xs text-amber-500">Tickets Near Deadline</div>
            </div>
            {slaData.stats.departmentSlaPerformance && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <div className="text-xl font-bold text-blue-600">{Number(slaData.stats.departmentSlaPerformance.avg_hours || 0).toFixed(1)}h</div>
                <div className="text-xs text-blue-500">Avg Resolution Time</div>
              </div>
            )}
            {slaData.stats.teamSlaPerformance && slaData.stats.teamSlaPerformance.length > 0 && (
              <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                <div className="text-xl font-bold text-green-600">{slaData.stats.teamSlaPerformance.length}</div>
                <div className="text-xs text-green-500">Team Members Tracked</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">Recent Department Tickets</h2>
          <Link to="/manager/tickets" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {!data?.recentTickets?.length ? (
          <div className="py-10 text-center">
            <div className="text-3xl mb-2 opacity-40">📭</div>
            <p className="text-slate-400 text-sm">No recent tickets</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Title</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data!.recentTickets.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/manager/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1">{t.title}</Link>
                    </td>
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
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
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
