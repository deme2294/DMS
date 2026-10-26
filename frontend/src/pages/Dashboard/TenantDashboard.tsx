import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTenantDashboard } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './TenantDashboard.module.css';

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>My Dashboard</h1>
          <p className={styles.headerSubtitle}>
            Welcome back, <span className={styles.userName}>{user?.firstName} {user?.lastName}</span>
          </p>
        </div>
        <Link to="/tenant/tickets/create" className={styles.newTicketBtn}>
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
          <div key={label} className={styles.statCard}>
            <div className={`${styles.statIcon} bg-gradient-to-br ${color} text-white`}>{icon}</div>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Info row */}
      <div className={styles.infoRow}>
        <div className={styles.infoCard}>
          <div className={`${styles.infoIconWrapper} ${styles.feedbackIconBg}`}>💬</div>
          <div>
            <div className={styles.infoValue}>{(data?.pendingFeedback as { count: number })?.count ?? 0}</div>
            <div className={styles.infoLabel}>Pending Feedback</div>
          </div>
          <Link to="/tenant/feedback" className={styles.infoLink}>View →</Link>
        </div>
        <div className={styles.infoCard}>
          <div className={`${styles.infoIconWrapper} ${styles.noticesIconBg}`}>📢</div>
          <div>
            <div className={styles.infoValue}>{(data?.activeNotices as { count: number })?.count ?? 0}</div>
            <div className={styles.infoLabel}>Active Notices</div>
          </div>
          <Link to="/tenant/notices" className={styles.infoLink}>View →</Link>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>
          <h2 className={styles.recentTitle}>My Recent Tickets</h2>
          <Link to="/tenant/tickets" className={styles.viewAllLink}>View all →</Link>
        </div>
        {!data?.recentTickets?.length ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <p className={styles.emptyText}>You haven't submitted any tickets yet</p>
            <Link to="/tenant/tickets/create" className={styles.emptyLink}>
              Submit your first ticket →
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.desktopTableWrap}>
              <div className={styles.tableContainer}>
                <table className={styles.ticketsTable}>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Response Due</th>
                      <th>Resolution Due</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.recentTickets.map((t: any) => {
                      const statusKey = `status_${t.status}`;
                      const statusClass = styles[statusKey] || styles.status_submitted;
                      const priorityKey = `priority_${t.priority}`;
                      const priorityClass = styles[priorityKey] || styles.priority_medium;
                      return (
                        <tr key={t.id} className={styles.ticketRow}>
                          <td className={styles.ticketRef}>{t.referenceNumber ?? '—'}</td>
                          <td>
                            <Link to={`/tenant/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`} className={styles.ticketTitleLink} title={t.title}>
                              {t.title}
                            </Link>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${statusClass}`}>
                              {t.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${priorityClass}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className={styles.ticketDate}>{formatDate((t as any).responseDueDate)}</td>
                          <td className={styles.ticketDate}>{formatDate((t as any).dueDate)}</td>
                          <td className={styles.ticketDateCreated}>
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Touch-Friendly Card View */}
            <div className={styles.mobileCardsList}>
              {data!.recentTickets.map((t: any) => {
                const statusKey = `status_${t.status}`;
                const statusClass = styles[statusKey] || styles.status_submitted;
                const priorityKey = `priority_${t.priority}`;
                const priorityClass = styles[priorityKey] || styles.priority_medium;
                return (
                  <Link key={t.id} to={`/tenant/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`} className={styles.mobileCard}>
                    <div className={styles.mobileCardHeader}>
                      <span className={styles.ticketRef}>{t.referenceNumber ?? '—'}</span>
                      <span className={`${styles.badge} ${priorityClass}`}>{t.priority}</span>
                    </div>

                    <div className={styles.mobileCardTitle}>{t.title}</div>

                    <div className={styles.mobileCardMetaRow}>
                      <span>Created: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</span>
                      <span className={`${styles.badge} ${statusClass}`}>{t.status.replace(/_/g, ' ')}</span>
                    </div>

                    <div className={styles.mobileCardFooter}>
                      <span className={styles.ticketDate}>Due: {formatDate((t as any).dueDate)}</span>
                      <span className={styles.mobileCardArrow}>View Ticket →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}