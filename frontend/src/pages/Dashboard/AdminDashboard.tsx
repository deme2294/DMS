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
  TagIcon,
  ExclamationCircleIcon,
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

    fetchTicketStats().then((r) => setTicketStats(r.data.data)).catch(() => { });
    fetchTicketCharts().then((r) => setCharts(r.data.data)).catch(() => { });
    fetchAdminSlaDashboard().then((r) => setSlaData(r.data.data)).catch(() => { });
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
    { label: 'Total Users', value: s.totalUsers, icon: UserGroupIcon, colorClass: styles.statBlue, link: '/admin/users', badge: `${s.activeUsers} active` },
    { label: 'Active Users', value: s.activeUsers, icon: CheckCircleIcon, colorClass: styles.statGreen, link: '/admin/users', badge: 'Operational' },
    { label: 'Total Tenants', value: s.totalTenants, icon: BuildingOffice2Icon, colorClass: styles.statPurple, link: '/admin/tenants', badge: `${s.activeTenants} active` },
    { label: 'Active Tenants', value: s.activeTenants, icon: BuildingStorefrontIcon, colorClass: styles.statTeal, link: '/admin/tenants', badge: 'Registered' },
    { label: 'Total Tickets', value: s.totalTickets, icon: TicketIcon, colorClass: styles.statIndigo, link: '/admin/tickets', badge: 'All time' },
    { label: 'Open Tickets', value: s.openTickets, icon: InboxIcon, colorClass: styles.statAmber, link: '/admin/tickets', badge: s.openTickets > 0 ? 'Requires action' : 'Zero queue' },
    { label: 'Departments', value: s.totalDepartments, icon: BuildingLibraryIcon, colorClass: styles.statCyan, link: '/admin/departments', badge: 'Active units' },
    { label: 'Pending Feedback', value: s.pendingFeedback, icon: ChatBubbleBottomCenterTextIcon, colorClass: styles.statRose, link: '/admin/feedback', badge: s.pendingFeedback > 0 ? 'To review' : 'No backlog' },
    { label: 'Inactive Users', value: s.deactiveUsers, icon: UserMinusIcon, colorClass: styles.statSlate, link: '/admin/deactiveusers', badge: 'Deactivated' },
  ];

  return (
    <div className={styles.dashboard}>
      {/* ── Print-only Command Center Banner ── */}
      <div className={styles.printOnlyHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Help Desk Management System — Dashboard Overview
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#475569' }}>
              Generated: <strong>{new Date().toLocaleString()}</strong> | Scope: Enterprise Administration
            </p>
          </div>
          <div style={{ background: '#1e293b', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            DASHBOARD REPORT
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
            className={`${styles.headerActionBtn} ${styles.headerActionSecondary}`}
            title="Print command center dashboard overview"
          >
            <PrinterIcon style={{ width: '14px', height: '10px' }} />
            <span>Print Overview</span>
          </button>

          <button
            type="button"
            onClick={handleExportOverview}
            disabled={isExporting}
            className={`${styles.headerActionBtn} ${styles.headerActionPrimary}`}
            title="Export command center overview, recent tickets, and users to professional Excel (.xlsx)"
          >
            <ArrowDownTrayIcon style={{ width: '14px', height: '10px' }} />
            <span>{isExporting ? 'Generating...' : 'Export Overview (Excel)'}</span>
          </button>

          <Link to="/admin/analytics" className={`${styles.headerActionBtn} ${styles.headerActionSecondary}`}>
            <ArrowTrendingUpIcon className={styles.headerActionIcon} />
            <span>Analytics & Trends</span>
            <ArrowRightIcon style={{ width: '13px', height: '13px' }} />
          </Link>
        </div>
      </div>


      {/* ── KPI Stats Overview Grid ── */}
      <div className={styles.statsGrid}>
        {statCards.map(({ label, value, icon: Icon, colorClass, link, badge }) => (
          <Link key={label} to={link} className={`${styles.statCard} ${colorClass}`}>
            <div className={styles.statCardTop}>
              <div className={styles.statIconBox}>
                <Icon className={styles.statIconBoxSvg} />
              </div>
              <div className={styles.statArrowBtn}>
                <ArrowRightIcon className={styles.statCardArrow} />
              </div>
            </div>
            <div className={styles.statCardBottom}>
              <div className={styles.statValue}>{value ?? 0}</div>
              <div className={styles.statLabelRow}>
                <span className={styles.statLabel}>{label}</span>
                {badge && <span className={styles.statPillBadge}>{badge}</span>}
              </div>
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
          <BarChart title="Tickets by Category" data={charts.byCategory} labelKey="category" type="category" />
          <BarChart title="Tickets by Department" data={charts.byDepartment} labelKey="name" type="department" />
          <BarChart title="Tickets by Priority" data={charts.byPriority} labelKey="priority" type="priority" />
          <BarChart title="Tickets by Status" data={charts.byStatus} labelKey="status" type="status" />
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
                      <Link to={`/admin/tickets/${t.ticketNum ? String(t.ticketNum) : (t.referenceNumber || t.id)}`} className={styles.ticketTitleLink}>
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

interface DistributionColorStyle {
  gradient: string;
  dot: string;
  glow?: string;
}

function getDistributionColorStyle(
  type: 'category' | 'department' | 'priority' | 'status',
  rawValue: string,
  index = 0
): DistributionColorStyle {
  const val = (rawValue || '').toLowerCase().trim();

  // Priority
  if (type === 'priority') {
    if (val === 'high' || val === 'urgent' || val === 'critical') {
      return {
        gradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
        dot: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.3)',
      };
    }
    if (val === 'medium') {
      return {
        gradient: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
        dot: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.3)',
      };
    }
    return {
      gradient: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
      dot: '#10b981',
      glow: 'rgba(16, 185, 129, 0.3)',
    };
  }

  // Status
  if (type === 'status') {
    switch (val) {
      case 'open':
        return {
          gradient: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
          dot: '#3b82f6',
          glow: 'rgba(59, 130, 246, 0.3)',
        };
      case 'assigned':
        return {
          gradient: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
          dot: '#06b6d4',
          glow: 'rgba(6, 182, 212, 0.3)',
        };
      case 'in_progress':
        return {
          gradient: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
          dot: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.3)',
        };
      case 'pending':
        return {
          gradient: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
          dot: '#8b5cf6',
          glow: 'rgba(139, 92, 246, 0.3)',
        };
      case 'resolved':
        return {
          gradient: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
          dot: '#10b981',
          glow: 'rgba(16, 185, 129, 0.3)',
        };
      case 'closed':
        return {
          gradient: 'linear-gradient(90deg, #14b8a6 0%, #0f766e 100%)',
          dot: '#14b8a6',
          glow: 'rgba(20, 184, 166, 0.3)',
        };
      case 'reopened':
        return {
          gradient: 'linear-gradient(90deg, #f97316 0%, #c2410c 100%)',
          dot: '#f97316',
          glow: 'rgba(249, 115, 22, 0.3)',
        };
      case 'escalated':
        return {
          gradient: 'linear-gradient(90deg, #e11d48 0%, #9f1239 100%)',
          dot: '#e11d48',
          glow: 'rgba(225, 29, 72, 0.3)',
        };
      default:
        return {
          gradient: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
          dot: '#3b82f6',
        };
    }
  }

  // Department
  if (type === 'department') {
    if (val.includes('unassigned')) {
      return {
        gradient: 'linear-gradient(90deg, #64748b 0%, #475569 100%)',
        dot: '#64748b',
        glow: 'rgba(100, 116, 139, 0.25)',
      };
    }
    if (val.includes('it') || val.includes('tech')) {
      return {
        gradient: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
        dot: '#2563eb',
        glow: 'rgba(37, 99, 235, 0.3)',
      };
    }
    if (val.includes('support') || val.includes('help')) {
      return {
        gradient: 'linear-gradient(90deg, #06b6d4 0%, #0284c7 100%)',
        dot: '#06b6d4',
        glow: 'rgba(6, 182, 212, 0.3)',
      };
    }
    if (val.includes('operation') || val.includes('facility')) {
      return {
        gradient: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
        dot: '#10b981',
        glow: 'rgba(16, 185, 129, 0.3)',
      };
    }
  }

  // Category
  if (type === 'category') {
    if (val.includes('software') || val.includes('app')) {
      return {
        gradient: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
        dot: '#8b5cf6',
        glow: 'rgba(139, 92, 246, 0.3)',
      };
    }
    if (val === 'it' || val.includes('hardware')) {
      return {
        gradient: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
        dot: '#0284c7',
        glow: 'rgba(2, 132, 199, 0.3)',
      };
    }
    if (val.includes('network') || val.includes('wifi') || val.includes('infra')) {
      return {
        gradient: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
        dot: '#10b981',
        glow: 'rgba(16, 185, 129, 0.3)',
      };
    }
    if (val.includes('bill') || val.includes('pay') || val.includes('finance')) {
      return {
        gradient: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
        dot: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.3)',
      };
    }
    if (val.includes('access') || val.includes('security') || val.includes('login')) {
      return {
        gradient: 'linear-gradient(90deg, #ec4899 0%, #e11d48 100%)',
        dot: '#ec4899',
        glow: 'rgba(236, 72, 153, 0.3)',
      };
    }
  }

  // Fallback palette
  const PALETTE: DistributionColorStyle[] = [
    { gradient: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)', dot: '#6366f1', glow: 'rgba(99, 102, 241, 0.3)' },
    { gradient: 'linear-gradient(90deg, #0284c7 0%, #3b82f6 100%)', dot: '#0284c7', glow: 'rgba(2, 132, 199, 0.3)' },
    { gradient: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)', dot: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
    { gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)', dot: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
    { gradient: 'linear-gradient(90deg, #ec4899 0%, #f43f5e 100%)', dot: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)' },
    { gradient: 'linear-gradient(90deg, #06b6d4 0%, #0d9488 100%)', dot: '#06b6d4', glow: 'rgba(6, 182, 212, 0.3)' },
    { gradient: 'linear-gradient(90deg, #a855f7 0%, #7c3aed 100%)', dot: '#a855f7', glow: 'rgba(168, 85, 247, 0.3)' },
  ];
  return PALETTE[index % PALETTE.length];
}

function BarChart({
  title,
  data,
  labelKey,
  type = 'category',
}: {
  title: string;
  data: { [k: string]: any }[];
  labelKey: string;
  type?: 'category' | 'department' | 'priority' | 'status';
}) {
  const list = data || [];
  const max = Math.max(1, ...list.map((d) => Number(d.count || 0)));
  const totalCount = list.reduce((sum, d) => sum + Number(d.count || 0), 0);

  // Pick header icon and accent based on chart type
  let HeaderIcon = TagIcon;
  let iconColor = '#8b5cf6';
  let iconBg = 'rgba(139, 92, 246, 0.12)';
  let itemTypeName = 'Items';

  if (type === 'department') {
    HeaderIcon = BuildingOffice2Icon;
    iconColor = '#3b82f6';
    iconBg = 'rgba(59, 130, 246, 0.12)';
    itemTypeName = 'Depts';
  } else if (type === 'priority') {
    HeaderIcon = ExclamationCircleIcon;
    iconColor = '#f59e0b';
    iconBg = 'rgba(245, 158, 11, 0.12)';
    itemTypeName = 'Levels';
  } else if (type === 'status') {
    HeaderIcon = ChartBarIcon;
    iconColor = '#10b981';
    iconBg = 'rgba(16, 185, 129, 0.12)';
    itemTypeName = 'Stages';
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitleRow}>
        <div className={styles.chartHeaderLeft}>
          <div className={styles.chartHeaderIconWrap} style={{ background: iconBg, color: iconColor }}>
            <HeaderIcon style={{ width: '18px', height: '18px' }} />
          </div>
          <h3 className={styles.chartTitle}>{title}</h3>
        </div>
        <span className={styles.sectionCountBadge}>
          {list.length} {list.length === 1 ? itemTypeName.replace(/s$/, '') : itemTypeName}
        </span>
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
            const sharePercent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            const colorStyle = getDistributionColorStyle(type, rawLabel, i);

            return (
              <div key={i} className={styles.chartBarRow}>
                <div className={styles.chartBarLabelWrap}>
                  <span
                    className={styles.chartBarDot}
                    style={{ background: colorStyle.dot }}
                  />
                  <span className={styles.chartBarLabel} title={formattedLabel}>
                    {formattedLabel}
                  </span>
                </div>

                <div className={styles.chartBarTrack}>
                  <div
                    className={styles.chartBarFill}
                    style={{
                      width: `${percentage}%`,
                      background: colorStyle.gradient,
                      boxShadow: colorStyle.glow ? `0 2px 8px ${colorStyle.glow}` : undefined,
                    }}
                  />
                </div>

                <div className={styles.chartBarStats}>
                  <span className={styles.chartBarPercent}>{sharePercent}%</span>
                  <span className={styles.chartBarCount}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


