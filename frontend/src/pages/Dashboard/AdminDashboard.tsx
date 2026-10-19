import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminDashboard,
  fetchTicketStats,
  fetchTicketCharts,
  fetchAdminSlaDashboard,
} from '../../api/dashboardApi';
import type {
  AdminDashboardData,
  TicketStatistics,
  TicketCharts,
  AdminSlaDashboard,
} from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './AdminDashboard.module.css';

import {
  UserGroupIcon,
  CheckCircleIcon,
  UserMinusIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  TicketIcon,
  InboxIcon,
  BuildingLibraryIcon,
  ChatBubbleBottomCenterTextIcon,
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  SparklesIcon,
  DocumentChartBarIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { exportDashboardOverviewToExcel } from '../../utils/excelExportUtils';

const getStatusBadgeClass = (status: string) => {
  const normalized = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const key = `badge_${normalized}` as keyof typeof styles;
  return styles[key] || styles.badge_submitted;
};

const getPriorityBadgeClass = (priority: string) => {
  const normalized = (priority || '').toLowerCase();
  const key = `priority_${normalized}` as keyof typeof styles;
  return styles[key] || styles.priority_low;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStatistics | null>(null);
  const [charts, setCharts] = useState<TicketCharts | null>(null);
  const [slaData, setSlaData] = useState<AdminSlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportOverview = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportDashboardOverviewToExcel(data, slaData);
    } catch (err) {
      console.error('[AdminDashboard] Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintOverview = () => {
    window.print();
  };

  useEffect(() => {
    if (!user) return;
    fetchAdminDashboard()
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));

    fetchTicketStats().then((r) => setTicketStats(r.data.data)).catch(() => {});
    fetchTicketCharts().then((r) => setCharts(r.data.data)).catch(() => {});
    fetchAdminSlaDashboard().then((r) => setSlaData(r.data.data)).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>Loading Admin Command Center...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.errorBanner}>
        {error || 'Unable to retrieve dashboard information'}
      </div>
    );
  }

  const s = data.stats;
  const statusBreakdown = data.statusBreakdown || [];

  const statCards = [
    { label: 'Total Users', value: s.totalUsers, icon: UserGroupIcon, colorClass: styles.statBlue, link: '/admin/users' },
    { label: 'Active Users', value: s.activeUsers, icon: CheckCircleIcon, colorClass: styles.statGreen, link: '/admin/users' },
    { label: 'Total Tenants', value: s.totalTenants, icon: BuildingOffice2Icon, colorClass: styles.statPurple, link: '/admin/tenants' },
    { label: 'Active Tenants', value: s.activeTenants, icon: BuildingStorefrontIcon, colorClass: styles.statGreen, link: '/admin/tenants' },
    { label: 'Total Tickets', value: s.totalTickets, icon: TicketIcon, colorClass: styles.statPurple, link: '/admin/tickets' },
    { label: 'Open Tickets', value: s.openTickets, icon: InboxIcon, colorClass: styles.statAmber, link: '/admin/tickets' },
    { label: 'Departments', value: s.totalDepartments, icon: BuildingLibraryIcon, colorClass: styles.statCyan, link: '/admin/departments' },
    { label: 'Pending Feedback', value: s.pendingFeedback, icon: ChatBubbleBottomCenterTextIcon, colorClass: styles.statRose, link: '/admin/feedback' },
    { label: 'Inactive Users', value: s.deactiveUsers, icon: UserMinusIcon, colorClass: styles.statSlate, link: '/admin/deactiveusers' },
  ];

  return (
    <div className={styles.dashboard}>
      {/* ── Print-only Command Center Banner ── */}
      <div className={styles.printOnlyHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Help Desk Management System — Command Center Overview
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#475569' }}>
              Generated: <strong>{new Date().toLocaleString()}</strong> | Scope: Enterprise Administration
            </p>
          </div>
          <div style={{ background: '#1e293b', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            COMMAND CENTER REPORT
          </div>
        </div>
      </div>

      {/* ── Top Header Bar ── */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.headingBadgeRow}>
            <span className={styles.headingBadge}>
              <SparklesIcon style={{ width: '13px', height: '13px' }} />
              Admin Command Center
            </span>
          </div>
          <h1 className={styles.heading}>Admin Dashboard</h1>
          <p className={styles.subheading}>
            Welcome back, <span className={styles.highlightName}>{user?.firstName} {user?.lastName}</span>
            <span>·</span>
            <span>Real-time operations, analytics & SLA health</span>
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.datePill}>
            <CalendarDaysIcon className={styles.datePillIcon} />
            <span>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrintOverview}
            className={styles.headerActionBtn}
            title="Print command center dashboard overview"
          >
            <PrinterIcon style={{ width: '16px', height: '16px' }} />
            <span>Print Overview</span>
          </button>

          <button
            type="button"
            onClick={handleExportOverview}
            disabled={isExporting}
            className={`${styles.headerActionBtn} ${styles.headerActionPrimary}`}
            title="Export command center overview, recent tickets, and users to professional Excel (.xlsx)"
          >
            <ArrowDownTrayIcon style={{ width: '16px', height: '16px' }} />
            <span>{isExporting ? 'Generating...' : 'Export Overview (Excel)'}</span>
          </button>

          <Link to="/admin/analytics" className={styles.headerActionBtn}>
            <ArrowTrendingUpIcon className={styles.headerActionIcon} />
            <span>Analytics & Trends</span>
            <ArrowRightIcon style={{ width: '14px', height: '14px' }} />
          </Link>
        </div>
      </div>

      {/* ── KPI Stats Overview Grid ── */}
      <div className={styles.statsGrid}>
        {statCards.map(({ label, value, icon: Icon, colorClass, link }) => (
          <Link key={label} to={link} className={`${styles.statCard} ${colorClass}`}>
            <div className={styles.statCardTop}>
              <div className={styles.statIconBox}>
                <Icon className={styles.statIconBoxSvg} />
              </div>
              <ArrowRightIcon className={styles.statCardArrow} />
            </div>
            <div>
              <div className={styles.statValue}>{value ?? 0}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Ticket Status Breakdown ── */}
      {statusBreakdown.length > 0 && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <ChartBarIcon className={styles.sectionTitleIcon} style={{ color: '#3b82f6' }} />
              <div>
                <h2 className={styles.sectionHeading}>Ticket Status Breakdown</h2>
                <span className={styles.sectionSub}>Active volume categorized by lifecycle phase</span>
              </div>
            </div>
            <span className={styles.sectionCountBadge}>{statusBreakdown.length} Stages</span>
          </div>

          <div className={styles.statusPillsWrap}>
            {statusBreakdown.map((item: { status: string; count: number }) => (
              <span
                key={item.status}
                className={`${styles.statusPill} ${getStatusBadgeClass(item.status)}`}
              >
                <span>{item.status.replace(/_/g, ' ')}</span>
                <span className={styles.statusPillCount}>{item.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Ticket Statistics Mini-Grid ── */}
      {ticketStats && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <DocumentChartBarIcon className={styles.sectionTitleIcon} style={{ color: '#8b5cf6' }} />
              <div>
                <h2 className={styles.sectionHeading}>Ticket Lifecycle Metrics</h2>
                <span className={styles.sectionSub}>Real-time status tallies across all registered tenants</span>
              </div>
            </div>
            <span className={styles.sectionCountBadge}>Live Count</span>
          </div>

          <div className={styles.ticketStatsGrid}>
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
              <div key={c.label} className={styles.ticketStatBox}>
                <div className={styles.ticketStatValue}>{c.value ?? 0}</div>
                <div className={styles.ticketStatLabel}>{c.label}</div>
              </div>
            ))}
            <div className={`${styles.ticketStatBox} ${styles.statOverdue}`}>
              <div className={styles.ticketStatValue}>{ticketStats.overdue ?? 0}</div>
              <div className={styles.ticketStatLabel} style={{ color: '#ef4444' }}>Overdue</div>
            </div>
          </div>
        </section>
      )}

      {/* ── SLA Performance Hub ── */}
      {slaData && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <ShieldCheckIcon className={styles.sectionTitleIcon} style={{ color: '#10b981' }} />
              <div>
                <h2 className={styles.sectionHeading}>SLA Performance & Health</h2>
                <span className={styles.sectionSub}>Compliance tracking, deadlines, and turnaround metrics</span>
              </div>
            </div>
            <span className={styles.sectionCountBadge}>Service Agreements</span>
          </div>

          <div className={styles.slaStatsGrid}>
            <div className={`${styles.slaBox} ${styles.slaWithin}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.ticketsWithinSla ?? 0}</div>
              <div className={styles.slaBoxLabel}>Within SLA</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaApproaching}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.ticketsApproachingDeadline ?? 0}</div>
              <div className={styles.slaBoxLabel}>Approaching Deadline</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaOverdue}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.overdueTickets ?? 0}</div>
              <div className={styles.slaBoxLabel}>Overdue Tickets</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaCompleted}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.completedWithinSla ?? 0}</div>
              <div className={styles.slaBoxLabel}>Completed Within SLA</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaCompletedLate}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.completedAfterSla ?? 0}</div>
              <div className={styles.slaBoxLabel}>Completed After SLA</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaTurnaround}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.avgResolutionHours ?? 0}h</div>
              <div className={styles.slaBoxLabel}>Avg Resolution Time</div>
            </div>
            <div className={`${styles.slaBox} ${styles.slaCompliance}`}>
              <div className={styles.slaBoxValue}>{slaData.stats.slaCompliancePercentage ?? 0}%</div>
              <div className={styles.slaBoxLabel}>SLA Compliance Rate</div>
            </div>
          </div>
        </section>
      )}

      {/* ── Visual Analytics & Distribution Charts ── */}
      {charts && (
        <div className={styles.chartsGrid}>
          <BarChart title="Tickets by Category" data={charts.byCategory} labelKey="category" />
          <BarChart title="Tickets by Department" data={charts.byDepartment} labelKey="name" />
          <BarChart title="Tickets by Priority" data={charts.byPriority} labelKey="priority" />
          <BarChart title="Tickets by Status" data={charts.byStatus} labelKey="status" />
        </div>
      )}

      {/* ── Recent Tickets Stream ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <ClockIcon className={styles.sectionTitleIcon} style={{ color: '#06b6d4' }} />
            <div>
              <h2 className={styles.sectionHeading}>Recent Tickets Stream</h2>
              <span className={styles.sectionSub}>Latest requests submitted to the system</span>
            </div>
          </div>
          <Link to="/admin/tickets" className={styles.viewAllLink}>
            <span>View All Tickets</span>
            <ArrowRightIcon style={{ width: '15px', height: '15px' }} />
          </Link>
        </div>

        {!data.recentTickets?.length ? (
          <div className={styles.emptyDataNotice}>
            <TicketIcon style={{ width: '36px', height: '36px', margin: '0 auto 8px', opacity: 0.4 }} />
            <p>No recent tickets found</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.recentTable}>
              <thead>
                <tr>
                  <th>Ticket Details</th>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTickets.map((t) => (
                  <tr key={t.id} className={styles.recentTableRow}>
                    <td>
                      <Link to={`/admin/tickets/${t.id}`} className={styles.ticketTitleLink}>
                        {t.title}
                      </Link>
                      <div className={styles.ticketRefTag}>{t.referenceNumber}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.tenantName ?? '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${getStatusBadgeClass(t.status)}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getPriorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
  const list = data || [];
  const max = Math.max(1, ...list.map((d) => Number(d.count || 0)));

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitleRow}>
        <h3 className={styles.chartTitle}>{title}</h3>
        <span className={styles.sectionCountBadge}>{list.length} Items</span>
      </div>

      {!list.length ? (
        <div className={styles.emptyDataNotice}>No data available for this chart</div>
      ) : (
        <div className={styles.chartBarsList}>
          {list.map((d, i) => {
            const rawLabel = String(d[labelKey] || 'Unassigned');
            const formattedLabel = rawLabel.replace(/_/g, ' ');
            const count = Number(d.count || 0);
            const percentage = Math.round((count / max) * 100);

            return (
              <div key={i} className={styles.chartBarRow}>
                <span className={styles.chartBarLabel} title={formattedLabel}>
                  {formattedLabel}
                </span>
                <div className={styles.chartBarTrack}>
                  <div
                    className={styles.chartBarFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className={styles.chartBarCount}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
