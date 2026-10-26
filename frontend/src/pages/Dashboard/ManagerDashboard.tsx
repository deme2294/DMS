import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TicketIcon,
  InboxIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/solid';
import { fetchManagerDashboard, fetchManagerSlaDashboard } from '../../api/dashboardApi';
import type { ManagerDashboardData, ManagerSlaDashboard } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './ManagerDashboard.module.css';

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  submitted: { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.3)' },
  in_progress: { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: 'rgba(245, 158, 11, 0.3)' },
  pending_approval: { bg: 'rgba(249, 115, 22, 0.12)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.3)' },
  resolved: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: 'rgba(16, 185, 129, 0.3)' },
  closed: { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: 'rgba(100, 116, 139, 0.3)' },
};

const PRIORITY_STYLE: Record<string, { color: string; dot: string; bg: string }> = {
  low: { color: '#0284c7', dot: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
  medium: { color: '#ca8a04', dot: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
  high: { color: '#ea580c', dot: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  urgent: { color: '#dc2626', dot: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  critical: { color: '#b91c1c', dot: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
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
      .catch(() => setError('Failed to load department dashboard data.'))
      .finally(() => setLoading(false));

    fetchManagerSlaDashboard()
      .then((r) => setSlaData(r.data.data))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '4px solid rgba(14, 165, 233, 0.2)',
            borderTopColor: '#0ea5e9',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', color: '#b91c1c', borderRadius: '14px', border: '1px solid #fecaca' }}>
        {error || 'Unable to load department dashboard'}
      </div>
    );
  }

  const s = data.stats;

  const statCards = [
    {
      label: 'Department Tickets',
      value: s.departmentTickets ?? 0,
      sub: 'Total department workload',
      Icon: TicketIcon,
      gradient: 'linear-gradient(135deg, #0284c7, #2563eb)',
    },
    {
      label: 'Open Tickets',
      value: s.openTickets ?? 0,
      sub: 'Awaiting triage or assignment',
      Icon: InboxIcon,
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    },
    {
      label: 'In Progress',
      value: s.inProgressTickets ?? 0,
      sub: 'Active staff resolution',
      Icon: BoltIcon,
      gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
    },
    {
      label: 'Resolved Tickets',
      value: s.resolvedTickets ?? 0,
      sub: 'Successfully resolved',
      Icon: CheckCircleIcon,
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* ── Top Header Row ── */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.heading}>
            Manager Dashboard
            <span className={styles.headingBadge}>ITPC Ops</span>
          </h1>
          <p className={styles.subheading}>
            Welcome back, <span className={styles.highlightName}>{user?.firstName} {user?.lastName}</span> · Real-time department command & metrics overview
          </p>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.datePill}>
            📅 {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Executive Department Command Hub Banner ── */}
      {data?.department && (
        <div className={styles.deptBanner}>
          <div className={styles.deptContent}>
            <div className={styles.deptIconCard}>
              <BuildingOffice2Icon style={{ width: 28, height: 28, color: '#ffffff' }} />
            </div>
            <div>
              <div className={styles.deptLabel}>Assigned Department · Ethiopian IT Park</div>
              <h2 className={styles.deptName}>{data.department.name}</h2>
              <div className={styles.deptMeta}>
                <span>👥 {data.department.userCount ?? 0} Team Members</span>
                <span className={styles.deptDot}>•</span>
                <span className={styles.deptStatusLive}>
                  <span className={styles.liveDot} />
                  Operational Gateway
                </span>
              </div>
            </div>
          </div>

          <div className={styles.deptShortcuts}>
            <Link to="/manager/knowledge" className={styles.shortcutLink}>
              📚 Knowledge Base
            </Link>
            <Link to="/manager/knowledge/approval" className={styles.shortcutLink}>
              ✅ Dept Approval Desk
            </Link>
            <Link to="/manager/matrix" className={styles.shortcutLink}>
              👥 Department Roster
            </Link>
          </div>
        </div>
      )}

      {/* ── 4 Primary Metric Stat Cards ── */}
      <div className={styles.statsGrid}>
        {statCards.map(({ label, value, sub, Icon, gradient }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <div className={styles.statIconCapsule} style={{ background: gradient }}>
                <Icon className={styles.statIconSvg} />
              </div>
            </div>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statSubtitle}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── SLA Performance Monitor ── */}
      {slaData && (
        <div className={styles.slaSection}>
          <div className={styles.slaHeader}>
            <div className={styles.slaTitleBlock}>
              <ShieldCheckIcon style={{ width: 20, height: 20, color: '#0ea5e9' }} />
              <h2 className={styles.slaTitle}>SLA Performance & Team Benchmarks</h2>
            </div>
            <span className={styles.slaBadgeOk}>
              ✓ Live Compliance Guard Active
            </span>
          </div>

          <div className={styles.slaGrid}>
            <div className={`${styles.slaCard} ${styles.slaCardDanger}`}>
              <div className={styles.slaIconBox} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                <ExclamationTriangleIcon style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.slaValue} style={{ color: '#dc2626' }}>
                  {slaData.stats.overdueTickets ?? 0}
                </div>
                <div className={styles.slaLabel} style={{ color: '#b91c1c' }}>Overdue Tickets</div>
              </div>
            </div>

            <div className={`${styles.slaCard} ${styles.slaCardWarning}`}>
              <div className={styles.slaIconBox} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                <ClockIcon style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.slaValue} style={{ color: '#d97706' }}>
                  {slaData.stats.ticketsNearDeadline ?? 0}
                </div>
                <div className={styles.slaLabel} style={{ color: '#b45309' }}>Near Deadline</div>
              </div>
            </div>

            <div className={`${styles.slaCard} ${styles.slaCardInfo}`}>
              <div className={styles.slaIconBox} style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7' }}>
                <BoltIcon style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.slaValue} style={{ color: '#0284c7' }}>
                  {slaData.stats.departmentSlaPerformance?.avg_hours
                    ? `${Number(slaData.stats.departmentSlaPerformance.avg_hours).toFixed(1)}h`
                    : '0.0h'}
                </div>
                <div className={styles.slaLabel} style={{ color: '#0369a1' }}>Avg Resolution Time</div>
              </div>
            </div>

            <div className={`${styles.slaCard} ${styles.slaCardSuccess}`}>
              <div className={styles.slaIconBox} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                <UserGroupIcon style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.slaValue} style={{ color: '#059669' }}>
                  {slaData.stats.teamSlaPerformance?.length ?? (data.department?.userCount ?? 1)}
                </div>
                <div className={styles.slaLabel} style={{ color: '#047857' }}>Team Members Tracked</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Department Tickets Table Card ── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeaderRow}>
          <h2 className={styles.tableTitle}>Recent Department Tickets</h2>
          <Link to="/manager/tickets" className={styles.viewAllLink}>
            View all department tickets
            <ArrowRightIcon style={{ width: 14, height: 14 }} />
          </Link>
        </div>

        {!data?.recentTickets?.length ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <p className={styles.emptyText}>No recent department tickets found.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.desktopTableWrap}>
              <div className={styles.tableWrapper}>
                <table className={styles.ticketTable}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Ticket Title & Reference</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Priority</th>
                      <th className={styles.th}>Created Date</th>
                      <th className={styles.th} style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTickets.map((t) => {
                      const sStyle = STATUS_STYLE[t.status] || {
                        bg: 'rgba(148, 163, 184, 0.15)',
                        color: '#475569',
                        border: 'rgba(148, 163, 184, 0.3)',
                      };
                      const pStyle = PRIORITY_STYLE[t.priority?.toLowerCase()] || {
                        color: '#64748b',
                        dot: '#94a3b8',
                        bg: 'rgba(148, 163, 184, 0.1)',
                      };

                      return (
                        <tr key={t.id} className={styles.tr}>
                          <td className={styles.td}>
                            <Link to={`/manager/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`} className={styles.ticketTitleLink}>
                              {t.title}
                            </Link>
                            {t.referenceNumber && (
                              <div className={styles.ticketMetaText}>
                                Ref: <strong>{t.referenceNumber}</strong>
                              </div>
                            )}
                          </td>
                          <td className={styles.td}>
                            <span
                              className={styles.statusPill}
                              style={{
                                background: sStyle.bg,
                                color: sStyle.color,
                                border: `1px solid ${sStyle.border}`,
                              }}
                            >
                              {t.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span
                              className={styles.priorityPill}
                              style={{
                                color: pStyle.color,
                                background: pStyle.bg,
                              }}
                            >
                              <span
                                className={styles.priorityDot}
                                style={{ background: pStyle.dot }}
                              />
                              {t.priority}
                            </span>
                          </td>
                          <td className={styles.td} style={{ color: 'var(--mgr-text-muted)', whiteSpace: 'nowrap' }}>
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className={styles.td} style={{ textAlign: 'right' }}>
                            <Link
                              to={`/manager/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`}
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#0284c7',
                                textDecoration: 'none',
                              }}
                            >
                              Manage →
                            </Link>
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
              {data.recentTickets.map((t) => {
                const sStyle = STATUS_STYLE[t.status] || {
                  bg: 'rgba(148, 163, 184, 0.15)',
                  color: '#475569',
                  border: 'rgba(148, 163, 184, 0.3)',
                };
                const pStyle = PRIORITY_STYLE[t.priority?.toLowerCase()] || {
                  color: '#64748b',
                  dot: '#94a3b8',
                  bg: 'rgba(148, 163, 184, 0.1)',
                };

                return (
                  <Link key={t.id} to={`/manager/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`} className={styles.mobileCard}>
                    <div className={styles.mobileCardHeader}>
                      <span className={styles.refText}>{t.referenceNumber ?? '—'}</span>
                      <span
                        className={styles.priorityPill}
                        style={{ color: pStyle.color, background: pStyle.bg }}
                      >
                        <span className={styles.priorityDot} style={{ background: pStyle.dot }} />
                        {t.priority}
                      </span>
                    </div>

                    <div className={styles.mobileCardTitle}>{t.title}</div>

                    <div className={styles.mobileCardMetaRow}>
                      <span
                        className={styles.statusPill}
                        style={{ background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}` }}
                      >
                        {t.status?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--mgr-text-muted)' }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    <div className={styles.mobileCardFooter}>
                      <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '0.8rem' }}>Manage Ticket →</span>
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


