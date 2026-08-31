import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTenantDashboard } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './TenantDashboard.module.css';

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
  open: 'bg-sky-100 text-sky-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-teal-100 text-teal-700',
  escalated: 'bg-red-100 text-red-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-sky-100 text-sky-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTenantDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>;

  const s = data?.stats;
  const myBookings: any[] = data?.myBookings || [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>My Dashboard</h1>
          <p>Welcome back, <span className="font-medium text-slate-700">{user?.firstName} {user?.lastName}</span></p>
        </div>
        <Link to="/tenant/tickets/create" className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all shadow-sm hover:shadow-md self-start">
          <span>+</span> New Ticket
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {[
          { label: 'My Tickets', value: s?.totalTickets || 0, icon: '🎫', color: 'from-blue-500 to-blue-600' },
          { label: 'Open', value: s?.openTickets || 0, icon: '📬', color: 'from-amber-500 to-amber-600' },
          { label: 'In Progress', value: s?.inProgressTickets || 0, icon: '⚙️', color: 'from-indigo-500 to-indigo-600' },
          { label: 'Resolved', value: s?.resolvedTickets || 0, icon: '✅', color: 'from-green-500 to-green-600' },
          { label: 'Overdue', value: s?.overdueTickets || 0, icon: '🔴', color: 'from-red-500 to-red-600' },
          { label: 'Upcoming Deadlines', value: s?.upcomingDeadlines || 0, icon: '⏰', color: 'from-amber-500 to-amber-600' },
          { label: 'Office Bookings', value: s?.myActiveBookings || 0, icon: '🏢', color: 'from-purple-500 to-purple-600' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg mb-3`}>{icon}</div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Info row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">💬</div>
          <div>
            <div className="text-xl font-bold text-slate-800">{(data?.pendingFeedback as { count: number })?.count ?? 0}</div>
            <div className="text-sm text-slate-500">Pending Feedback</div>
          </div>
          <Link to="/tenant/feedback" className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium">View →</Link>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl">📢</div>
          <div>
            <div className="text-xl font-bold text-slate-800">{(data?.activeNotices as { count: number })?.count ?? 0}</div>
            <div className="text-sm text-slate-500">Active Notices</div>
          </div>
          <Link to="/tenant/notices" className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium">View →</Link>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">My Recent Tickets</h2>
          <Link to="/tenant/tickets" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {!data?.recentTickets?.length ? (
          <div className="py-10 text-center">
            <div className="text-3xl mb-2 opacity-40">📭</div>
            <p className="text-slate-400 text-sm mb-3">You haven't submitted any tickets yet</p>
            <Link to="/tenant/tickets/create" className="text-sm text-blue-600 font-medium hover:underline">
              Submit your first ticket →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Reference</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Title</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Response Due</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Resolution Due</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data!.recentTickets.map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{t.referenceNumber ?? '—'}</td>
                    <td className="py-3 px-4">
                      <Link to={`/tenant/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1">{t.title}</Link>
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
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate((t as any).responseDueDate)}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate((t as any).dueDate)}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
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