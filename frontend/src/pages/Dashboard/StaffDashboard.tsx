import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchStaffDashboard, fetchStaffSlaDashboard } from '../../api/dashboardApi';
import type { StaffDashboardData, StaffSlaDashboard, StaffSlaTicketItem } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './StaffDashboard.module.css';

import {
  TicketIcon,
  InboxIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const getPriorityClass = (priority: string) => {
  const p = (priority || '').toLowerCase();
  if (p === 'critical' || p === 'urgent') return styles.priority_critical;
  if (p === 'high') return styles.priority_high;
  if (p === 'medium') return styles.priority_medium;
  return styles.priority_low;
};

const getSlaPillClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'overdue' || s === 'response_breached' || s === 'escalation_breached') {
    return styles.slaBreached;
  }
  if (s === 'approaching') {
    return styles.slaApproaching;
  }
  return styles.slaOnTrack;
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [slaData, setSlaData] = useState<StaffSlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'approaching' | 'breached'>('all');

  useEffect(() => {
    fetchStaffDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));

    fetchStaffSlaDashboard()
      .then((r) => setSlaData(r.data.data))
      .catch(() => { });
  }, []);

  const slaTickets = useMemo(() => {
    const list = slaData?.assignedTickets || [];
    if (filterMode === 'high') {
      return list.filter((t) => ['high', 'urgent', 'critical'].includes((t.priority || '').toLowerCase()));
    }
    if (filterMode === 'approaching') {
      return list.filter((t) => (t.slaStatus || '').toLowerCase() === 'approaching');
    }
    if (filterMode === 'breached') {
      return list.filter((t) =>
        ['overdue', 'response_breached', 'escalation_breached'].includes((t.slaStatus || '').toLowerCase())
      );
    }
    return list;
  }, [slaData, filterMode]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>Loading Staff Operations Desk...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.dashboard}>
        <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error || 'Unable to load dashboard information'}
        </div>
      </div>
    );
  }

  const s = data.stats;
  const slaStats = slaData?.stats;

  const statCards = [
    {
      label: 'Assigned to Me',
      value: s.assignedTickets || 0,
      icon: <TicketIcon style={{ width: 22, height: 22, color: '#2563eb' }} />,
      bg: 'rgba(37, 99, 235, 0.12)',
      hint: 'Current queue',
    },
    {
      label: 'Active / Open',
      value: s.openTickets || 0,
      icon: <InboxIcon style={{ width: 22, height: 22, color: '#d97706' }} />,
      bg: 'rgba(245, 158, 11, 0.12)',
      hint: 'Awaiting first response',
    },
    {
      label: 'In Progress',
      value: s.inProgressTickets || 0,
      icon: <WrenchScrewdriverIcon style={{ width: 22, height: 22, color: '#7c3aed' }} />,
      bg: 'rgba(124, 58, 237, 0.12)',
      hint: 'Under active resolution',
    },
    {
      label: 'Resolved Today',
      value: s.resolvedToday || 0,
      icon: <CheckCircleIcon style={{ width: 22, height: 22, color: '#059669' }} />,
      bg: 'rgba(16, 185, 129, 0.12)',
      hint: 'Closed / completed',
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* ── Top Header Section ── */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.headingBadgeRow}>
            <span className={styles.headingBadge}>
              <SparklesIcon style={{ width: 14, height: 14 }} /> Staff Operations Desk
            </span>
            <span className={styles.headingBadge} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
              Live Sync
            </span>
          </div>
          <h1 className={styles.heading}>Staff Command Center</h1>
          <p className={styles.subheading}>
            Welcome back, <span className={styles.highlightName}>{user?.firstName} {user?.lastName}</span> · Track and resolve assigned incident tickets.
          </p>
        </div>

        <div className={styles.headerRight}>
          <Link to="/staff/tickets" className={`${styles.actionBtn} ${styles.primaryBtn}`}>
            <span>View All Tickets</span>
            <ArrowRightIcon style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </div>

      {/* ── Primary KPI Metrics ── */}
      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <div key={card.label} className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIconWrap} style={{ background: card.bg }}>
                {card.icon}
              </div>
            </div>
            <div className={styles.statValue}>{card.value}</div>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={styles.statFooter}>
              <span>{card.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── SLA Health Metric Strip ── */}
      {slaStats && (
        <div className={styles.slaSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ShieldCheckIcon style={{ width: 22, height: 22, color: '#2563eb' }} />
              <span>SLA Compliance Overview</span>
            </h2>
          </div>

          <div className={styles.slaGrid}>
            <div className={`${styles.slaCard} ${styles.slaBlue}`}>
              <span className={styles.slaVal}>{slaStats.assignedTickets}</span>
              <span className={styles.slaLbl}>Assigned Under SLA</span>
            </div>
            <div className={`${styles.slaCard} ${styles.slaGreen}`}>
              <span className={styles.slaVal}>
                {Math.max(0, slaStats.assignedTickets - (slaStats.overdueTickets || 0))}
              </span>
              <span className={styles.slaLbl}>Within SLA Target</span>
            </div>
            <div className={`${styles.slaCard} ${styles.slaAmber}`}>
              <span className={styles.slaVal}>{slaStats.upcomingDeadlines || 0}</span>
              <span className={styles.slaLbl}>Upcoming Deadlines (&lt;4h)</span>
            </div>
            <div className={`${styles.slaCard} ${styles.slaRed}`}>
              <span className={styles.slaVal}>{slaStats.overdueTickets || 0}</span>
              <span className={styles.slaLbl}>Overdue Breaches</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Assigned Tickets Workspace ── */}
      <div className={styles.tableCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <TicketIcon style={{ width: 22, height: 22, color: '#2563eb' }} />
            <span>My Assigned Action Queue</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--staff-text-muted)', marginLeft: 6 }}>
              ({slaTickets.length})
            </span>
          </h2>

          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterActive : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All ({slaData?.assignedTickets?.length || 0})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${filterMode === 'high' ? styles.filterActive : ''}`}
              onClick={() => setFilterMode('high')}
            >
              High Priority
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${filterMode === 'approaching' ? styles.filterActive : ''}`}
              onClick={() => setFilterMode('approaching')}
            >
              Approaching
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${filterMode === 'breached' ? styles.filterActive : ''}`}
              onClick={() => setFilterMode('breached')}
            >
              Overdue
            </button>
          </div>
        </div>

        {slaTickets.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyTitle}>Queue Clean & Up to Date</div>
            <p className={styles.emptySubtitle}>
              {filterMode === 'all'
                ? 'No tickets are currently assigned to your staff queue.'
                : 'No tickets match the selected filter criteria.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Ticket Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Assigned Date</th>
                    <th>Response Due</th>
                    <th>Resolution Due</th>
                    <th>Remaining Time</th>
                    <th>SLA Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slaTickets.map((t: StaffSlaTicketItem) => (
                    <tr key={t.id}>
                      <td className={styles.refCell}>{t.referenceNumber}</td>
                      <td>
                        <Link to={`/staff/tickets/${t.id}`} className={styles.ticketTitleLink}>
                          {t.title}
                        </Link>
                      </td>
                      <td>{t.category || 'General'}</td>
                      <td>
                        <span className={`${styles.badge} ${getPriorityClass(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {t.assignedDate ? new Date(t.assignedDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {t.responseDue ? new Date(t.responseDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {t.resolutionDue ? new Date(t.resolutionDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {t.remainingTime || '—'}
                      </td>
                      <td>
                        <div className={styles.slaBadge}>
                          <span className={`${styles.slaPill} ${getSlaPillClass(t.slaStatus)}`}>
                            {t.slaStatus.replace(/_/g, ' ')}
                          </span>
                          {t.slaStatus === 'approaching' && (
                            <span className={styles.slaWarningText} style={{ color: '#d97706' }}>
                              ⚠️ Approaching
                            </span>
                          )}
                          {(t.slaStatus === 'overdue' || t.slaStatus === 'response_breached' || t.slaStatus === 'escalation_breached') && (
                            <span className={styles.slaWarningText}>
                              🔴 SLA Breached
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Card View */}
            <div className={styles.mobileCardsList}>
              {slaTickets.map((t: StaffSlaTicketItem) => (
                <Link key={t.id} to={`/staff/tickets/${t.id}`} className={styles.mobileCard}>
                  <div className={styles.mobileCardHeader}>
                    <span className={styles.refCell}>{t.referenceNumber}</span>
                    <span className={`${styles.badge} ${getPriorityClass(t.priority)}`}>
                      {t.priority}
                    </span>
                  </div>

                  <div className={styles.mobileCardTitle}>{t.title}</div>

                  <div className={styles.mobileCardMetaRow}>
                    <span>Category: <strong>{t.category || 'General'}</strong></span>
                    <span>Remaining: <strong>{t.remainingTime || '—'}</strong></span>
                  </div>

                  <div className={styles.mobileCardFooter}>
                    <span className={`${styles.slaPill} ${getSlaPillClass(t.slaStatus)}`}>
                      {t.slaStatus.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Open Ticket →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
