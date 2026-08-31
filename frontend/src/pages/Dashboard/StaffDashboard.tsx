import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStaffDashboard, fetchStaffSlaDashboard } from '../../api/dashboardApi';
import type { StaffDashboardData, StaffSlaDashboard, StaffSlaTicketItem } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  assigned_staff: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  open: 'bg-sky-100 text-sky-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-teal-100 text-teal-700',
  pending: 'bg-yellow-100 text-yellow-700',
  waiting_tenant: 'bg-gray-100 text-gray-700',
  waiting_vendor: 'bg-gray-100 text-gray-700',
  escalated: 'bg-red-100 text-red-700',
  reopened: 'bg-purple-100 text-purple-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-sky-100 text-sky-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
};

const SLA_STATUS_COLORS: Record<string, string> = {
  on_track: 'bg-green-100 text-green-700',
  approaching: 'bg-amber-100 text-amber-700',
  response_breached: 'bg-red-100 text-red-700',
  escalation_breached: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [slaData, setSlaData] = useState<StaffSlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStaffDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
    fetchStaffSlaDashboard().then((r) => setSlaData(r.data.data)).catch(() => { });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>;

  const s = data!.stats;

  const statCards = [
    { label: 'Total Assigned', value: s.assignedTickets, icon: '🎫', color: 'from-blue-500 to-blue-600' },
    { label: 'New / Open', value: s.openTickets, icon: '📬', color: 'from-amber-500 to-amber-600' },
    { label: 'In Progress', value: s.inProgressTickets, icon: '⚙️', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Resolved Today', value: s.resolvedToday, icon: '✅', color: 'from-green-500 to-green-600' },
  ];

  const slaTickets = slaData?.assignedTickets || [];
  const slaStats = slaData?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Staff Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, <span className="font-medium text-slate-700">{user?.firstName} {user?.lastName}</span> · Your assigned work
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg mb-3`}>{icon}</div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {slaStats && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">SLA Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div className="text-xl font-bold text-blue-600">{slaStats.assignedTickets}</div>
              <div className="text-xs text-blue-500">Assigned Tickets</div>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <div className="text-xl font-bold text-red-600">{slaStats.overdueTickets}</div>
              <div className="text-xs text-red-500">Overdue</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="text-xl font-bold text-amber-600">{slaStats.upcomingDeadlines}</div>
              <div className="text-xs text-amber-500">Upcoming Deadlines</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">My Assigned Tickets</h2>
          <Link to="/staff/tickets" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {slaTickets.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-3xl mb-2 opacity-40">📭</div>
            <p className="text-slate-400 text-sm">No tickets assigned to you</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Reference</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Title</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Assigned</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Response Due</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Resolution Due</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Remaining</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">SLA Status</th>
                </tr>
              </thead>
              <tbody>
                {slaTickets.map((t: StaffSlaTicketItem) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{t.referenceNumber}</td>
                    <td className="py-3 px-4">
                      <Link to={`/staff/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1">{t.title}</Link>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{t.category}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{new Date(t.assignedDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{t.responseDue ? new Date(t.responseDue).toLocaleString() : '—'}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{t.resolutionDue ? new Date(t.resolutionDue).toLocaleString() : '—'}</td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{t.remainingTime || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${SLA_STATUS_COLORS[t.slaStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t.slaStatus.replace(/_/g, ' ')}
                      </span>
                      {t.slaStatus === 'approaching' && (
                        <div className="text-xs text-amber-600 mt-1 font-medium">⚠ Deadline approaching</div>
                      )}
                      {(t.slaStatus === 'overdue' || t.slaStatus === 'response_breached' || t.slaStatus === 'escalation_breached') && (
                        <div className="text-xs text-red-600 mt-1 font-medium">🔴 SLA Overdue</div>
                      )}
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
