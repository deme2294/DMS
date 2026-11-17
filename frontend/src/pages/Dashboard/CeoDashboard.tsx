import { useEffect, useState, useMemo } from 'react';
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
import {
  TicketIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  MegaphoneIcon,
  ChartBarIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  SparklesIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  assigned: '#6366f1',
  accepted: '#06b6d4',
  in_progress: '#0284c7',
  pending: '#eab308',
  waiting_tenant: '#ec4899',
  waiting_vendor: '#a855f7',
  resolved: '#10b981',
  completed: '#059669',
  approved: '#14b8a6',
  closed: '#64748b',
  rejected: '#ef4444',
  escalated: '#dc2626',
  'escalated.open': '#b91c1c',
  'escalated.assigned': '#e11d48',
  'escalated.in_progress': '#f43f5e',
  'escalated.waiting_tenant': '#be123c',
  reopened: '#f59e0b',
};

const formatStatusLabel = (status: string): string => {
  if (!status) return '—';
  const clean = status.replace(/_/g, ' ');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' (') + ')';
  }
  return clean
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

function Pie({
  data,
  colors,
  totalLabel = 'Total',
  formatLabel,
}: {
  data: { label: string; value: number }[];
  colors: Record<string, string>;
  totalLabel?: string;
  formatLabel?: (label: string) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const safeTotal = total || 1;
  let acc = 0;
  const segments = data.map((d) => {
    const start = (acc / safeTotal) * 360;
    acc += d.value;
    const end = (acc / safeTotal) * 360;
    return { ...d, start, end };
  });

  return (
    <div className={styles.pieWrap}>
      <div className={styles.pieContainer}>
        <svg viewBox="0 0 120 120" className={styles.pie}>
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="transparent"
            stroke="var(--ceo-track-bg)"
            strokeWidth="18"
          />
          {segments.map((s) => {
            const sweep = s.end - s.start;
            if (sweep <= 0) return null;
            const strokeColor =
              colors[s.label] ||
              colors[s.label.toLowerCase()] ||
              colors[s.label.toLowerCase().replace(/\s+/g, '_')] ||
              '#6366f1';
            return (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r="48"
                fill="transparent"
                stroke={strokeColor}
                strokeWidth="18"
                strokeDasharray={`${(sweep / 360) * 301.59} 301.59`}
                strokeDashoffset={`${-(s.start / 360) * 301.59}`}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div className={styles.pieCenterInfo}>
          <span className={styles.pieCenterTotal}>{total}</span>
          <span className={styles.pieCenterLabel}>{totalLabel}</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {data.map((d) => {
          const displayLabel = formatLabel ? formatLabel(d.label) : d.label;
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const strokeColor =
            colors[d.label] ||
            colors[d.label.toLowerCase()] ||
            colors[d.label.toLowerCase().replace(/\s+/g, '_')] ||
            '#6366f1';
          return (
            <li key={d.label}>
              <span className={styles.dot} style={{ background: strokeColor }} />
              <span className={styles.legendLabel} title={displayLabel}>
                {displayLabel}
              </span>
              <span className={styles.legendCount}>
                <span className={styles.legendValue}>{d.value}</span>
                <span className={styles.legendPct}>({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Bar({
  data,
  gradient = 'linear-gradient(90deg, #3b82f6, #6366f1)',
  unit = '',
}: {
  data: { label: string; value: number }[];
  gradient?: string;
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (!data.length) {
    return <div className={styles.emptyChart}>No records available</div>;
  }

  return (
    <div className={styles.barChart}>
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const fillWidth = Math.max(4, Math.min(100, (d.value / max) * 100));
        return (
          <div key={d.label} className={styles.barRow}>
            <span className={styles.barLabel} title={d.label}>
              {d.label}
            </span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${fillWidth}%`, background: gradient }}
              />
            </div>
            <div className={styles.barStats}>
              <span className={styles.barValue}>
                {d.value}
                {unit ? ` ${unit}` : ''}
              </span>
              {!unit && <span className={styles.barPct}>({pct}%)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineArea({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) {
    return <div className={styles.emptyChart}>No monthly trend data available</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 340;
  const h = 130;
  const padX = 24;
  const padY = 22;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const pts = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - (d.count / max) * chartH;
    return { x, y, ...d };
  });

  const pathD = pts.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${h - padY} L ${pts[0].x} ${h - padY} Z`;

  return (
    <div className={styles.lineChartWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.lineChart}>
        <defs>
          <linearGradient id="ceoAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={padY} x2={w - padX} y2={padY} stroke="var(--ceo-subtle-border)" strokeDasharray="3 3" opacity="0.6" />
        <line x1={padX} y1={padY + chartH / 2} x2={w - padX} y2={padY + chartH / 2} stroke="var(--ceo-subtle-border)" strokeDasharray="3 3" opacity="0.6" />
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--ceo-subtle-border)" opacity="0.8" />
        <path d={areaD} fill="url(#ceoAreaGrad)" />
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4.5" fill="#2563eb" stroke="var(--ceo-card-bg)" strokeWidth="2" />
            <text x={pt.x} y={pt.y - 7} textAnchor="middle" className={styles.lineChartPointLabel}>
              {pt.count}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.lineChartLabels}>
        {data.map((d, i) => (
          <span key={i} className={styles.lineChartMonthLabel}>
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}

interface MetricItem {
  key: keyof CeoDashboardStats;
  label: string;
  category: 'tickets' | 'org' | 'engagement';
  icon: any;
  tone: 'gold' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  tooltip?: string;
  hint?: string;
}

const ALL_METRIC_CARDS: MetricItem[] = [
  // Tickets & SLA Pulse
  { key: 'totalTickets', label: 'Total Tickets', category: 'tickets', icon: TicketIcon, tone: 'blue', hint: '100% of pipeline', tooltip: 'All tickets submitted across all tenants' },
  { key: 'openTickets', label: 'Open Tickets', category: 'tickets', icon: ArrowTrendingUpIcon, tone: 'blue', hint: 'Needs triage & dispatch', tooltip: 'Tickets awaiting assignment or review' },
  { key: 'pendingTickets', label: 'Pending Action', category: 'tickets', icon: ClockIcon, tone: 'amber', hint: 'Awaiting feedback / approval', tooltip: 'Tickets pending response or approval' },
  { key: 'inProgressTickets', label: 'In Progress', category: 'tickets', icon: ClockIcon, tone: 'amber', hint: 'Active technician work', tooltip: 'Tickets actively being worked on by staff' },
  { key: 'resolvedTickets', label: 'Resolved Tickets', category: 'tickets', icon: CheckCircleIcon, tone: 'green', hint: 'Target achieved', tooltip: 'Tickets successfully solved' },
  { key: 'closedTickets', label: 'Closed Tickets', category: 'tickets', icon: CheckCircleIcon, tone: 'slate', hint: 'Archived & verified', tooltip: 'Completed and archived tickets' },
  { key: 'overdueTickets', label: 'Overdue Tickets', category: 'tickets', icon: ExclamationTriangleIcon, tone: 'red', hint: '⚠️ SLA Breached', tooltip: 'Tickets that breached resolution SLA' },
  { key: 'withinSla', label: 'Within SLA', category: 'tickets', icon: ShieldCheckIcon, tone: 'green', hint: '✓ Compliant with target', tooltip: 'Tickets complying with SLA targets' },
  { key: 'nearDeadline', label: 'Near Deadline', category: 'tickets', icon: ClockIcon, tone: 'amber', hint: 'Approaching breach window', tooltip: 'Tickets within 24h of SLA breach' },
  { key: 'escalatedTickets', label: 'Escalated', category: 'tickets', icon: ArrowTrendingUpIcon, tone: 'red', hint: 'Executive attention', tooltip: 'Tickets escalated for higher review' },

  // Organization & Workforce
  { key: 'totalTenants', label: 'Active Tenants', category: 'org', icon: BuildingOfficeIcon, tone: 'blue', hint: 'Registered client orgs', tooltip: 'Registered client organizations' },
  { key: 'totalUsers', label: 'Total Accounts', category: 'org', icon: UserGroupIcon, tone: 'blue', hint: 'System-wide user base', tooltip: 'Total user profiles across all roles' },
  { key: 'activeUsers', label: 'Active Users', category: 'org', icon: UserGroupIcon, tone: 'green', hint: 'Enabled & authorized', tooltip: 'Active accounts currently enabled' },
  { key: 'inactiveUsers', label: 'Inactive Users', category: 'org', icon: UserGroupIcon, tone: 'slate', hint: 'Suspended profiles', tooltip: 'Disabled or suspended accounts' },
  { key: 'totalDepartments', label: 'Departments', category: 'org', icon: BuildingOffice2Icon, tone: 'purple', hint: 'ITPC service units', tooltip: 'ITPC service departments' },
  { key: 'totalDepartmentManagers', label: 'Dept Managers', category: 'org', icon: UserIcon, tone: 'purple', hint: 'Department supervisors', tooltip: 'Active department head managers' },
  { key: 'totalGeneralManagers', label: 'General Managers', category: 'org', icon: UserIcon, tone: 'purple', hint: 'Executive leadership', tooltip: 'General operations managers' },
  { key: 'totalStaff', label: 'Technical Staff', category: 'org', icon: UserIcon, tone: 'blue', hint: 'Support & field engineers', tooltip: 'Field technicians and support staff' },
  { key: 'totalAdmins', label: 'System Admins', category: 'org', icon: ShieldCheckIcon, tone: 'gold', hint: 'Full security access', tooltip: 'Full administrative access users' },

  // Knowledge & Engagement
  { key: 'knowledgeArticles', label: 'KB Articles', category: 'engagement', icon: BookOpenIcon, tone: 'gold', hint: 'Self-service repository', tooltip: 'Published self-service help articles' },
  { key: 'feedbackReceived', label: 'Tenant Feedback', category: 'engagement', icon: ChatBubbleLeftRightIcon, tone: 'blue', hint: 'Reviews & satisfaction', tooltip: 'Feedback reviews submitted by tenants' },
  { key: 'noticesPublished', label: 'System Notices', category: 'engagement', icon: MegaphoneIcon, tone: 'gold', hint: 'Official broadcasts', tooltip: 'Official announcements and notices' },
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
  const [refreshing, setRefreshing] = useState(false);
  const [metricTab, setMetricTab] = useState<'all' | 'tickets' | 'org' | 'engagement'>('all');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [d, dep, stf, ten, sys, ch, ts] = await Promise.all([
        fetchCeoDashboard(),
        fetchCeoDepartmentPerformance(),
        fetchCeoStaffPerformance(),
        fetchCeoTenantStats(),
        fetchCeoSystemStats(),
        fetchTicketCharts(),
        fetchTicketStats(),
      ]);
      setStats(d.data.data.stats);
      setDeptPerf(dep.data.data);
      setStaffPerf(stf.data.data);
      setTenantStats(ten.data.data);
      setSystemStats(sys.data.data);
      setCharts(ch.data.data);
      setTicketStats(ts.data.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load CEO executive dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleCards = useMemo(() => {
    if (metricTab === 'all') return ALL_METRIC_CARDS;
    return ALL_METRIC_CARDS.filter((c) => c.category === metricTab);
  }, [metricTab]);

  // Executive Hero KPIs calculations
  const totalTicketsCount = stats?.totalTickets || 0;
  const overdueCount = stats?.overdueTickets || 0;
  const withinSlaCount = stats?.withinSla || 0;
  const totalSlaEvaluated = withinSlaCount + overdueCount;
  const slaCompliancePct = totalSlaEvaluated > 0 ? Math.round((withinSlaCount / totalSlaEvaluated) * 100) : 100;
  const feedbackCount = stats?.feedbackReceived || 0;

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Welcome, ${user?.firstName || 'CEO'}`}
        description={`Executive Overview & Operational Intelligence · ${lastUpdated ? `Updated at ${lastUpdated}` : 'Live System Feed'}`}
        actionLabel={refreshing ? 'Refreshing…' : 'Refresh Data'}
        onAction={() => loadData(true)}
        actionLoading={refreshing}
      />

      {loading && (
        <div className={styles.loading}>
          <ArrowPathIcon className={styles.spinIcon} />
          <span>Loading executive intelligence…</span>
        </div>
      )}

      {/* ── Executive Hero Highlights ── */}
      <div className={styles.heroRow}>
        {/* Total Operations Volume */}
        <div className={`${styles.heroCard} ${styles.heroBlue}`}>
          <div className={styles.heroCardHeader}>
            <div className={styles.heroIconBox}>
              <TicketIcon className={styles.heroIcon} />
            </div>
            <span className={styles.heroBadge}>Operations Volume</span>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.heroMainValue}>{stats ? totalTicketsCount : '—'}</div>
            <div className={styles.heroSubLabel}>Total Tickets Submitted</div>
          </div>
          <div className={styles.heroFooter}>
            <span className={styles.heroPill}>
              <strong>{stats?.openTickets || 0}</strong> Open
            </span>
            <span className={styles.heroPill}>
              <strong>{stats?.inProgressTickets || 0}</strong> In Progress
            </span>
            <span className={styles.heroPill}>
              <strong>{stats?.resolvedTickets || 0}</strong> Resolved
            </span>
          </div>
        </div>

        {/* SLA Compliance Health */}
        <div className={`${styles.heroCard} ${styles.heroGreen}`}>
          <div className={styles.heroCardHeader}>
            <div className={styles.heroIconBox}>
              <ShieldCheckIcon className={styles.heroIcon} />
            </div>
            <span className={`${styles.heroBadge} ${styles.badgeGreen}`}>SLA Compliance</span>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.heroMainValue}>
              {stats ? `${slaCompliancePct}%` : '—'}
            </div>
            <div className={styles.heroSubLabel}>Service Level Health Score</div>
          </div>
          <div className={styles.heroFooter}>
            <span className={styles.heroPill}>
              <strong>{withinSlaCount}</strong> Within Target
            </span>
            <span className={styles.heroPill}>
              <strong>{stats?.nearDeadline || 0}</strong> Near Deadline
            </span>
          </div>
        </div>

        {/* Overdue Urgency Callout */}
        <div className={`${styles.heroCard} ${styles.heroRed}`}>
          <div className={styles.heroCardHeader}>
            <div className={styles.heroIconBox}>
              <ExclamationTriangleIcon className={styles.heroIcon} />
            </div>
            <span className={`${styles.heroBadge} ${styles.badgeRed}`}>Urgent Attention</span>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.heroMainValue}>{stats ? overdueCount : '—'}</div>
            <div className={styles.heroSubLabel}>Overdue Breached Tickets</div>
          </div>
          <div className={styles.heroFooter}>
            <span className={styles.heroPillAlert}>
              {overdueCount > 0 ? '⚠️ Resolution SLA breached' : '✓ All tickets within SLA'}
            </span>
          </div>
        </div>

        {/* Tenant Feedback & Satisfaction */}
        <div className={`${styles.heroCard} ${styles.heroGold}`}>
          <div className={styles.heroCardHeader}>
            <div className={styles.heroIconBox}>
              <ChatBubbleLeftRightIcon className={styles.heroIcon} />
            </div>
            <span className={`${styles.heroBadge} ${styles.badgeGold}`}>Tenant Voice</span>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.heroMainValue}>{stats ? feedbackCount : '—'}</div>
            <div className={styles.heroSubLabel}>Tenant Reviews & Feedback</div>
          </div>
          <div className={styles.heroFooter}>
            <span className={styles.heroPill}>
              <strong>{stats?.totalTenants || 0}</strong> Active Tenants
            </span>
            <span className={styles.heroPill}>
              <strong>{stats?.noticesPublished || 0}</strong> Notices
            </span>
          </div>
        </div>
      </div>

      {/* ── Operational Metric Grid with Category Tabs ── */}
      <div className={styles.metricsSection}>
        <div className={styles.metricsHeaderRow}>
          <div className={styles.metricsTitleGroup}>
            <div className={styles.sectionBadge}>
              <SparklesIcon className={styles.sectionBadgeIcon} />
              <span>TELEMETRY & OPERATIONS</span>
            </div>
            <h3 className={styles.sectionTitle}>
              Operational Key Performance Indicators
            </h3>
            <span className={styles.sectionSubtitle}>
              Live telemetric tracking across ticket lifecycles, workforce capacity, and engagement
            </span>
          </div>
          <div className={styles.tabCluster}>
            <button
              type="button"
              className={`${styles.tabBtn} ${metricTab === 'all' ? styles.tabActive : ''}`}
              onClick={() => setMetricTab('all')}
            >
              <SparklesIcon className={styles.tabBtnIcon} />
              <span>All ({ALL_METRIC_CARDS.length})</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${metricTab === 'tickets' ? styles.tabActive : ''}`}
              onClick={() => setMetricTab('tickets')}
            >
              <TicketIcon className={styles.tabBtnIcon} />
              <span>Ticket & SLA</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${metricTab === 'org' ? styles.tabActive : ''}`}
              onClick={() => setMetricTab('org')}
            >
              <BuildingOffice2Icon className={styles.tabBtnIcon} />
              <span>Workforce & Org</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${metricTab === 'engagement' ? styles.tabActive : ''}`}
              onClick={() => setMetricTab('engagement')}
            >
              <ChatBubbleLeftRightIcon className={styles.tabBtnIcon} />
              <span>Engagement</span>
            </button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          {visibleCards.map((c) => {
            const Icon = c.icon;
            const val = stats ? stats[c.key] : '—';
            const catLabel =
              c.category === 'tickets' ? 'Tickets' : c.category === 'org' ? 'Workforce' : 'Engagement';
            return (
              <div
                key={c.key}
                className={`${styles.summaryCard} ${styles[c.tone]}`}
                title={c.tooltip || c.label}
              >
                <div className={styles.summaryCardTop}>
                  <div className={styles.summaryIconWrapper}>
                    <Icon className={styles.summaryCardIcon} />
                  </div>
                  <span className={styles.summaryCategoryBadge}>{catLabel}</span>
                </div>
                <div className={styles.summaryValue}>{val}</div>
                <div className={styles.summaryLabel}>{c.label}</div>
                {c.hint && <div className={styles.summaryHint}>{c.hint}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ticket Analytics Section ── */}
      {charts && ticketStats && (
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <div className={styles.sectionBadge}>
                <ChartBarIcon className={styles.sectionBadgeIcon} />
                <span>VISUAL INTELLIGENCE</span>
              </div>
              <h3 className={styles.sectionTitle}>
                Ticket Analytics & Visual Intelligence
              </h3>
              <span className={styles.sectionSubtitle}>
                Distribution across departments, priority queues, lifecycle statuses, and categories
              </span>
            </div>
          </div>

          <div className={styles.analyticsGrid}>
            {/* Panel 1: By Department */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <BuildingOffice2Icon className={styles.panelIcon} />
                <h4>By Department</h4>
              </div>
              <Bar
                data={charts.byDepartment.map((d) => ({ label: d.name, value: d.count }))}
                gradient="linear-gradient(90deg, #3b82f6, #6366f1)"
              />
            </div>

            {/* Panel 2: By Priority */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <ChartPieIcon className={styles.panelIcon} />
                <h4>By Priority</h4>
              </div>
              <Pie
                data={charts.byPriority.map((d) => ({
                  label: d.priority.charAt(0).toUpperCase() + d.priority.slice(1),
                  value: d.count,
                }))}
                colors={PRIORITY_COLORS}
                totalLabel="Tickets"
              />
            </div>

            {/* Panel 3: By Status */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <ChartPieIcon className={styles.panelIcon} />
                <h4>By Status</h4>
              </div>
              <Pie
                data={charts.byStatus.map((d) => ({
                  label: d.status,
                  value: d.count,
                }))}
                colors={STATUS_COLORS}
                formatLabel={formatStatusLabel}
                totalLabel="Tickets"
              />
            </div>

            {/* Panel 4: By Category */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <ChartBarIcon className={styles.panelIcon} />
                <h4>By Category</h4>
              </div>
              <Bar
                data={charts.byCategory.map((d) => ({ label: d.category, value: d.count }))}
                gradient="linear-gradient(90deg, #10b981, #059669)"
              />
            </div>

            {/* Panel 5: Monthly Volume Trend */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <CalendarDaysIcon className={styles.panelIcon} />
                <h4>Monthly Volume Trend</h4>
              </div>
              <LineArea data={charts.monthly.map((d) => ({ month: d.month, count: d.count }))} />
            </div>

            {/* Panel 6: Resolution Time by Priority */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <ClockIcon className={styles.panelIcon} />
                <h4>Resolution Time by Priority (Hours)</h4>
              </div>
              <Bar
                data={charts.resolutionByPriority.map((d) => ({
                  label: d.priority.charAt(0).toUpperCase() + d.priority.slice(1),
                  value: Math.round(Number(d.avg_hours) || 0),
                }))}
                gradient="linear-gradient(90deg, #8b5cf6, #7c3aed)"
                unit="hrs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Department Performance Table ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <div className={styles.sectionBadge}>
              <BuildingOffice2Icon className={styles.sectionBadgeIcon} />
              <span>DEPARTMENT RANKINGS</span>
            </div>
            <h3 className={styles.sectionTitle}>
              Department Operational Performance
            </h3>
            <span className={styles.sectionSubtitle}>
              Resolution throughput, managerial oversight, and service quality ratings
            </span>
          </div>
        </div>
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
                <th>Staff Count</th>
                <th>Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {deptPerf.map((d) => {
                const perfNum = Number(d.performance) || 0;
                let fillGrad = 'linear-gradient(90deg, #ef4444, #dc2626)';
                if (perfNum >= 80) fillGrad = 'linear-gradient(90deg, #10b981, #059669)';
                else if (perfNum >= 60) fillGrad = 'linear-gradient(90deg, #3b82f6, #2563eb)';
                else if (perfNum >= 40) fillGrad = 'linear-gradient(90deg, #f59e0b, #d97706)';

                return (
                  <tr key={d.id}>
                    <td>
                      <span
                        className={`${styles.rankBadge} ${
                          d.rank === 1
                            ? styles.rankGold
                            : d.rank === 2
                            ? styles.rankSilver
                            : d.rank === 3
                            ? styles.rankBronze
                            : ''
                        }`}
                      >
                        {d.rank === 1 ? '🥇 #1' : d.rank === 2 ? '🥈 #2' : d.rank === 3 ? '🥉 #3' : `#${d.rank}`}
                      </span>
                    </td>
                    <td className={styles.strong}>{d.department_name}</td>
                    <td>{d.manager_name || '—'}</td>
                    <td>
                      <span className={styles.ticketCountBadge}>{d.open_tickets}</span>
                    </td>
                    <td>
                      <span className={`${styles.ticketCountBadge} ${styles.badgeGreen}`}>
                        {d.resolved_tickets}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.ticketCountBadge} ${styles.badgeAmber}`}>
                        {d.pending_tickets}
                      </span>
                    </td>
                    <td className={styles.monospace}>
                      {d.avg_resolution_hours ? `${Number(d.avg_resolution_hours).toFixed(1)}h` : '—'}
                    </td>
                    <td>{d.employee_count}</td>
                    <td>
                      <div className={styles.perfBar}>
                        <div className={styles.perfFill} style={{ width: `${perfNum}%`, background: fillGrad }} />
                        <span className={styles.perfText}>{perfNum}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!deptPerf.length && (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    No department data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Staff Performance Table ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <div className={styles.sectionBadge}>
              <UserIcon className={styles.sectionBadgeIcon} />
              <span>STAFF EFFICIENCY</span>
            </div>
            <h3 className={styles.sectionTitle}>
              Technical Staff Efficiency & Output
            </h3>
            <span className={styles.sectionSubtitle}>
              Individual ticket throughput, completion rates, and turnaround speeds
            </span>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Department</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>Pending</th>
                <th>Avg Resolution (h)</th>
              </tr>
            </thead>
            <tbody>
              {staffPerf.map((s) => (
                <tr key={s.id}>
                  <td className={styles.strong}>
                    <div className={styles.userCell}>
                      <span className={styles.userInitial}>
                        {(s.first_name || 'S')[0].toUpperCase()}
                      </span>
                      <span>
                        {s.first_name} {s.last_name}
                      </span>
                    </div>
                  </td>
                  <td>{s.department_name || '—'}</td>
                  <td>
                    <span className={styles.ticketCountBadge}>{s.assigned_tickets}</span>
                  </td>
                  <td>
                    <span className={`${styles.ticketCountBadge} ${styles.badgeGreen}`}>
                      {s.completed_tickets}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.ticketCountBadge} ${styles.badgeAmber}`}>
                      {s.pending_tickets}
                    </span>
                  </td>
                  <td className={styles.monospace}>
                    {s.avg_resolution_hours ? `${Number(s.avg_resolution_hours).toFixed(1)}h` : '—'}
                  </td>
                </tr>
              ))}
              {!staffPerf.length && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    No staff performance data recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tenant Statistics + System Activity Grid ── */}
      <div className={styles.twoCol}>
        {/* Tenant Statistics */}
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <div className={styles.sectionBadge}>
                <BuildingOfficeIcon className={styles.sectionBadgeIcon} />
                <span>TENANT METRICS</span>
              </div>
              <h3 className={styles.sectionTitle}>
                Client Tenant Statistics
              </h3>
              <span className={styles.sectionSubtitle}>Account status and volume</span>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Closed</th>
                  <th>Avg Res.</th>
                </tr>
              </thead>
              <tbody>
                {tenantStats.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.strong}>{t.organization_name}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          t.status === 'active' ? styles.ok : styles.warn
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td>{t.tickets_submitted}</td>
                    <td>{t.tickets_closed}</td>
                    <td className={styles.monospace}>
                      {t.avg_resolution_hours ? `${Number(t.avg_resolution_hours).toFixed(1)}h` : '—'}
                    </td>
                  </tr>
                ))}
                {!tenantStats.length && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      No tenant records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Statistics */}
        {systemStats && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <div>
                <div className={styles.sectionBadge}>
                  <SparklesIcon className={styles.sectionBadgeIcon} />
                  <span>ACTIVITY TRENDS</span>
                </div>
                <h3 className={styles.sectionTitle}>
                  System Activity & Cadence
                </h3>
                <span className={styles.sectionSubtitle}>Audit logging and cadence trends</span>
              </div>
            </div>
            <div className={styles.sysGrid}>
              <div className={`${styles.sysCard} ${styles.blue}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>Daily Activities</span>
                  <span className={styles.sysBadge}>24H</span>
                </div>
                <div className={styles.sysValue}>{systemStats.daily}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.blue}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>Weekly Cadence</span>
                  <span className={styles.sysBadge}>7D</span>
                </div>
                <div className={styles.sysValue}>{systemStats.weekly}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.blue}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>Monthly Cadence</span>
                  <span className={styles.sysBadge}>30D</span>
                </div>
                <div className={styles.sysValue}>{systemStats.monthly}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.blue}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>Yearly Cadence</span>
                  <span className={styles.sysBadge}>1Y</span>
                </div>
                <div className={styles.sysValue}>{systemStats.yearly}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.green}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>New Users</span>
                  <span className={`${styles.sysBadge} ${styles.badgeGreen}`}>+New</span>
                </div>
                <div className={styles.sysValue}>{systemStats.newUsers}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.green}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>New Tenants</span>
                  <span className={`${styles.sysBadge} ${styles.badgeGreen}`}>+New</span>
                </div>
                <div className={styles.sysValue}>{systemStats.newTenants}</div>
              </div>
              <div className={`${styles.sysCard} ${styles.gold}`}>
                <div className={styles.sysHeader}>
                  <span className={styles.sysLabel}>Resolved (Mo)</span>
                  <span className={`${styles.sysBadge} ${styles.badgeGold}`}>MTD</span>
                </div>
                <div className={styles.sysValue}>{systemStats.resolvedThisMonth}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
