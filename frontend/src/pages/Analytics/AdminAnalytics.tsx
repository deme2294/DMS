import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchAdminAnalytics, fetchManagerAnalytics } from '../../api/dashboardApi';
import type { AdminAnalyticsData } from '../../api/dashboardApi';
import { STATUS_LABELS, type TicketStatus } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import { exportAnalyticsToExcel } from '../../utils/excelExportUtils';
import {
  exportMasterAnalyticsCSV,
  exportDepartmentPerformanceCSV,
  exportMonthlyTrendsCSV,
  exportCategoryAndStatusCSV,
} from '../../utils/csvExportUtils';
import styles from './AdminAnalytics.module.css';
import {
  ArrowPathIcon,
  PrinterIcon,
  TableCellsIcon,
  ArrowDownTrayIcon,
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingOffice2Icon,
  TrophyIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  TagIcon,
  ChartBarIcon,
  ChartPieIcon,
  InboxArrowDownIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  BoltIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

// ---- Color Palettes ------------------------------------------------------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  submitted: '#0284c7', // Sky Blue
  open: '#2563eb', // Royal Blue
  assigned: '#06b6d4', // Cyan
  assigned_department: '#818cf8', // Soft Indigo
  assigned_staff: '#0ea5e9', // Vivid Sky
  under_review: '#a855f7', // Violet
  in_progress: '#f59e0b', // Amber
  pending: '#d97706', // Deep Amber
  pending_approval: '#ea580c', // Bright Orange
  waiting_tenant: '#ec4899', // Hot Pink
  waiting_vendor: '#8b5cf6', // Purple
  resolved: '#10b981', // Emerald Green
  completed: '#059669', // Deep Emerald
  accepted: '#0d9488', // Teal
  approved: '#10b981', // Green
  closed: '#475569', // Cool Slate Navy
  reopened: '#f97316', // Orange
  escalated: '#ef4444', // Vibrant Red
  'escalated.open': '#f43f5e', // Rose
  'escalated.assigned': '#8b5cf6', // Violet
  'escalated.in_progress': '#f97316', // Vivid Orange
  'escalated.pending': '#ea580c', // Deep Orange
  'escalated.waiting_tenant': '#ec4899', // Hot Pink
  'escalated.waiting_vendor': '#6366f1', // Indigo
  'escalated.under_review': '#a855f7', // Purple
  rejected: '#dc2626', // Crimson
  cancelled: '#94a3b8', // Muted Slate
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444', // Red
  high: '#f97316', // Orange
  medium: '#eab308', // Amber / Gold
  low: '#3b82f6', // Blue
};

// Rich, high-contrast distinct palette ensuring every slice in pie/donut charts has a unique color
const DISTINCT_PIE_COLORS = [
  '#ef4444', // Vibrant Red (Escalated)
  '#2563eb', // Royal Blue (Open / Closed)
  '#10b981', // Emerald Green (Resolved)
  '#f59e0b', // Amber / Gold (In Progress)
  '#8b5cf6', // Purple / Violet (Assigned)
  '#ec4899', // Hot Pink (Waiting Tenant)
  '#06b6d4', // Cyan (Assigned Staff)
  '#f97316', // Bright Orange (Reopened / Escalated In Progress)
  '#6366f1', // Indigo (Under Review)
  '#14b8a6', // Teal (Accepted)
  '#d946ef', // Fuchsia / Orchid
  '#84cc16', // Lime Green
  '#0284c7', // Sky Blue
  '#e11d48', // Rose Red
  '#475569', // Cool Slate
];

const PALETTE = DISTINCT_PIE_COLORS;

const GRADIENTS = [
  ['#3b82f6', '#1d4ed8'],
  ['#10b981', '#047857'],
  ['#f59e0b', '#b45309'],
  ['#8b5cf6', '#6d28d9'],
  ['#ec4899', '#be185d'],
  ['#06b6d4', '#0e7490'],
  ['#f97316', '#c2410c'],
  ['#6366f1', '#4338ca'],
];

// ---- Pie & Donut Chart Component ----------------------------------------------------------------------------------------------
export interface ChartSliceItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface InteractivePieChartProps {
  title: string;
  subtitle?: string;
  items: ChartSliceItem[];
  totalLabel?: string;
  defaultMode?: 'donut' | 'pie';
}

function InteractivePieChart({
  title,
  subtitle,
  items,
  totalLabel = 'Total Tickets',
  defaultMode = 'donut',
}: InteractivePieChartProps) {
  const [chartMode, setChartMode] = useState<'donut' | 'pie'>(defaultMode);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  // Center coordinates and dimensions
  const cx = 100;
  const cy = 100;
  const outerR = 82;
  const innerR = chartMode === 'donut' ? 52 : 0;

  // Compute SVG slice paths accurately
  const slices = useMemo(() => {
    if (!items.length || total === 0) return [];
    let startAngle = -Math.PI / 2; // 12 o'clock

    return items.map((item, idx) => {
      const fraction = total > 0 ? item.value / total : 0;
      const angle = fraction * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;

      // Coordinate calculations
      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      let path = '';
      if (fraction >= 0.9999) {
        // Full 360 circle
        if (innerR > 0) {
          path = `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`;
        } else {
          path = `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} Z`;
        }
      } else if (innerR > 0) {
        // Donut slice path
        const ix1 = cx + innerR * Math.cos(startAngle);
        const iy1 = cy + innerR * Math.sin(startAngle);
        const ix2 = cx + innerR * Math.cos(endAngle);
        const iy2 = cy + innerR * Math.sin(endAngle);
        path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      } else {
        // Solid Pie slice path
        path = `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }

      startAngle = endAngle;

      return {
        ...item,
        path,
        fraction,
        percent: (fraction * 100).toFixed(1),
        midAngle,
        index: idx,
      };
    });
  }, [items, total, outerR, innerR, chartMode]);

  const activeItem = focusedIndex !== null ? items[focusedIndex] : null;

  return (
    <div className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>
            <ChartPieIcon style={{ width: 18, height: 18, color: '#3b82f6', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> {title}
          </h3>
          {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
        </div>

        <div className={styles.headerActions}>
          <span className={styles.badgePill}>{items.length} Slices</span>
          {/* Chart Mode Toggle */}
          <div className={styles.chartModeToggle}>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${chartMode === 'donut' ? styles.active : ''}`}
              onClick={() => setChartMode('donut')}
              title="Switch to Donut Ring view"
            >
              <ChartPieIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} /> Donut
            </button>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${chartMode === 'pie' ? styles.active : ''}`}
              onClick={() => setChartMode('pie')}
              title="Switch to Solid Pie view"
            >
              <ChartPieIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} /> Pie
            </button>
          </div>
        </div>
      </div>

      {/* Focus / Isolation Banner */}
      {activeItem && (
        <div className={styles.focusBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className="inline-block"
              style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeItem.color }}
            />
            <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', textTransform: 'capitalize' }}>{activeItem.label}:</span>
            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{activeItem.value.toLocaleString()} tickets</strong>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>
              ({total > 0 ? ((activeItem.value / total) * 100).toFixed(1) : 0}% of all tickets)
            </span>
          </div>
          <button
            type="button"
            className={styles.focusClearBtn}
            onClick={() => setFocusedIndex(null)}
          >
            <XMarkIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} /> Reset Focus
          </button>
        </div>
      )}


      <div className={styles.pieChartCardBody}>
        {!items.length || total === 0 ? (
          <div style={{ width: '100%', padding: '32px 16px', textAlign: 'center' }}>
            <p className={styles.emptyState}>No distribution records found</p>
          </div>
        ) : (
        <>
        {/* SVG Pie / Donut Circle */}
        <div className={styles.pieSvgWrapper}>
          <svg viewBox="0 0 200 200" className={styles.pieSvg}>
            {/* Background base circle */}
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
              fill="var(--bg-surface, #f8fafc)"
              stroke="var(--border-color, #e2e8f0)"
              strokeWidth="1.5"
            />

            {total > 0 &&
              slices.map((s) => {
                const isFocused = focusedIndex === s.index;
                const isDimmed = focusedIndex !== null && !isFocused;

                // Radial offset vector when slice is focused
                const offsetX = isFocused ? Math.cos(s.midAngle) * 6 : 0;
                const offsetY = isFocused ? Math.sin(s.midAngle) * 6 : 0;

                return (
                  <path
                    key={s.id}
                    d={s.path}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{
                      transform: isFocused ? `translate(${offsetX}px, ${offsetY}px)` : 'none',
                      opacity: isDimmed ? 0.3 : 1,
                    }}
                    className={styles.pieSlicePath}
                    onMouseEnter={() => setFocusedIndex(s.index)}
                    onMouseLeave={() => setFocusedIndex(null)}
                    onClick={() =>
                      setFocusedIndex((prev) => (prev === s.index ? null : s.index))
                    }
                  >
                    <title>{`${s.label}: ${s.value} (${s.percent}%)`}</title>
                  </path>
                );
              })}
          </svg>

          {/* Centered Dynamic Details for Donut Mode */}
          {chartMode === 'donut' && (
            <div className={styles.donutCenterInfo}>
              <div className={styles.donutCenterVal}>
                {activeItem ? activeItem.value.toLocaleString() : total.toLocaleString()}
              </div>
              <div className={styles.donutCenterLabel}>
                {activeItem ? activeItem.label : totalLabel}
              </div>
              {activeItem && total > 0 && (
                <div className={styles.donutCenterSub}>
                  {((activeItem.value / total) * 100).toFixed(1)}% of total
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend List */}
        <div className={styles.donutLegendList}>
          {items.map((item, idx) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              const isFocused = focusedIndex === idx;
              const isDimmed = focusedIndex !== null && !isFocused;

              return (
                <div
                  key={item.id}
                  className={`${styles.donutLegendItem} ${isFocused ? styles.active : ''} ${
                    isDimmed ? styles.dimmed : ''
                  }`}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  onMouseLeave={() => setFocusedIndex(null)}
                  onClick={() =>
                    setFocusedIndex((prev) => (prev === idx ? null : idx))
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.legendLeft}>
                    <span className={styles.legendDot} style={{ background: item.color }} />
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className={styles.legendRight}>
                    <span className={styles.legendCount}>{item.value.toLocaleString()}</span>
                    <span className={styles.legendPct}>{pct}%</span>
                  </div>
                </div>
              );
            })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ---- Professional Monthly & Weekly Trends Graph Component (Curve + Bar Chart) --
function MonthlyTrendGraph({
  monthlyData,
  weeklyData,
  dailyData,
  activeTab,
  onTabChange,
}: {
  monthlyData: AdminAnalyticsData['monthlyTrends'];
  weeklyData: AdminAnalyticsData['weeklyTrends'];
  dailyData: AdminAnalyticsData['dailyTrends'];
  activeTab: 'monthly' | 'weekly' | 'daily';
  onTabChange: (tab: 'monthly' | 'weekly' | 'daily') => void;
}) {
  const [graphType, setGraphType] = useState<'curve' | 'bar'>('bar');
  const [showCreated, setShowCreated] = useState<boolean>(true);
  const [showResolved, setShowResolved] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    created: number;
    resolved: number;
    x: number;
  } | null>(null);

  // Pick dataset based on tab
  const activeDataset = useMemo(() => {
    if (activeTab === 'monthly') {
      return monthlyData.map((m) => ({
        label: m.monthLabel,
        created: m.totalCreated,
        resolved: m.totalResolved,
        backlog: m.activeBacklog,
      }));
    }
    if (activeTab === 'weekly') {
      return weeklyData.map((w) => ({
        label: w.weekLabel,
        created: w.totalCreated,
        resolved: w.totalResolved,
        backlog: w.inProgress,
      }));
    }
    return dailyData.map((d) => ({
      label: d.dateLabel,
      created: d.totalCreated,
      resolved: d.totalResolved,
      backlog: 0,
    }));
  }, [activeTab, monthlyData, weeklyData, dailyData]);

  // Totals for header
  const totalCreated = useMemo(
    () => activeDataset.reduce((sum, d) => sum + d.created, 0),
    [activeDataset]
  );
  const totalResolved = useMemo(
    () => activeDataset.reduce((sum, d) => sum + d.resolved, 0),
    [activeDataset]
  );

  // SVG dimensions
  const svgWidth = 720;
  const svgHeight = 285;
  const padLeft = 48;
  const padRight = 44;
  const padTop = 34;
  const padBottom = 40;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  const { maxVal, yTicks } = useMemo(() => {
    const activeVals: number[] = [];
    activeDataset.forEach((d) => {
      if (showCreated) activeVals.push(d.created);
      if (showResolved) activeVals.push(d.resolved);
    });

    const rawMax = activeVals.length ? Math.max(...activeVals) : 0;
    const scaleMax = rawMax > 0 ? rawMax : 5;

    // Collect exact counted values from both active series so dotted gridlines & Y-axis numbers touch every plotted point
    const tickSet = new Set<number>([0, scaleMax]);
    activeVals.forEach((v) => {
      if (v >= 0 && v <= scaleMax) tickSet.add(v);
    });

    // Add clean intermediate scale ticks only where there is comfortable vertical room
    const step = scaleMax <= 5 ? 1 : Math.ceil(scaleMax / 5);
    const minLabelGapPx = 14;
    for (let n = step; n < scaleMax; n += step) {
      const yCand = padTop + graphH * (1 - n / scaleMax);
      const tooClose = Array.from(tickSet).some((existing) => {
        const yEx = padTop + graphH * (1 - existing / scaleMax);
        return Math.abs(yCand - yEx) < minLabelGapPx;
      });
      if (!tooClose) tickSet.add(n);
    }

    const sortedTicks = Array.from(tickSet).sort((a, b) => a - b);
    // Track which ticks should render text labels without overlapping when values are very dense
    let lastLabelY = Infinity;
    const ticksWithMeta = sortedTicks.map((val) => {
      const y = padTop + graphH * (1 - val / scaleMax);
      const isExactDataVal = activeVals.includes(val) || val === 0 || val === scaleMax;
      const showLabel = val === 0 || val === scaleMax || Math.abs(lastLabelY - y) >= 12;
      if (showLabel) lastLabelY = y;
      return { val, y, showLabel, isExactDataVal };
    });

    return { maxVal: scaleMax, yTicks: ticksWithMeta };
  }, [activeDataset, showCreated, showResolved, padTop, graphH]);

  // Compute points
  const points = useMemo(() => {
    if (!activeDataset.length) return [];
    const step = activeDataset.length > 1 ? graphW / (activeDataset.length - 1) : graphW / 2;

    return activeDataset.map((d, i) => {
      const x = padLeft + (activeDataset.length > 1 ? i * step : graphW / 2);
      const yCreated = padTop + graphH - (d.created / maxVal) * graphH;
      const yResolved = padTop + graphH - (d.resolved / maxVal) * graphH;
      return { ...d, x, yCreated, yResolved, index: i };
    });
  }, [activeDataset, maxVal, graphW, graphH, padLeft, padTop]);

  // Smooth Bezier Curve Path generator
  const createSmoothCurve = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
      const cx1 = current.x + (next.x - current.x) * 0.45;
      const cy1 = current.y;
      const cx2 = current.x + (next.x - current.x) * 0.55;
      const cy2 = next.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const createdCurvePath = useMemo(() => {
    if (!points.length) return '';
    return createSmoothCurve(points.map((p) => ({ x: p.x, y: p.yCreated })));
  }, [points]);

  const resolvedCurvePath = useMemo(() => {
    if (!points.length) return '';
    return createSmoothCurve(points.map((p) => ({ x: p.x, y: p.yResolved })));
  }, [points]);

  // Area fill under created curve
  const createdAreaPath = useMemo(() => {
    if (!points.length || !createdCurvePath) return '';
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const baseY = padTop + graphH;
    return `${createdCurvePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [points, createdCurvePath, padTop, graphH]);

  // Bar chart layout calculations
  const slotWidth = activeDataset.length > 0 ? graphW / activeDataset.length : graphW;
  const singleBarWidth = Math.min(Math.max(slotWidth * 0.35, 10), 28);

  return (
    <div className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>
            <ChartBarIcon style={{ width: 18, height: 18, color: '#2563eb', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Monthly & Weekly Ticket Trends
          </h3>
          <div className={styles.cardSubtitle}>
            Continuous submission velocity vs resolution throughput with multi-color bars and curves
          </div>
        </div>

        <div className={styles.headerActions}>
          {/* Graph Type Switcher: Bar vs Curve */}
          <div className={styles.chartModeToggle}>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${graphType === 'bar' ? styles.active : ''}`}
              onClick={() => setGraphType('bar')}
              title="Grouped Multi-Color Bar Chart"
            >
              <ChartBarIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} /> Bar Chart
            </button>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${graphType === 'curve' ? styles.active : ''}`}
              onClick={() => setGraphType('curve')}
              title="Smooth Curve Area Graph"
            >
              <ArrowTrendingUpIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} /> Curve Graph
            </button>
          </div>

          {/* View Toggle Tabs */}
          <div className={styles.timeframeSelector}>
            <button
              type="button"
              className={`${styles.timeframeBtn} ${activeTab === 'monthly' ? styles.active : ''}`}
              onClick={() => onTabChange('monthly')}
            >
              Monthly (12M)
            </button>
            <button
              type="button"
              className={`${styles.timeframeBtn} ${activeTab === 'weekly' ? styles.active : ''}`}
              onClick={() => onTabChange('weekly')}
            >
              Weekly (12W)
            </button>
            <button
              type="button"
              className={`${styles.timeframeBtn} ${activeTab === 'daily' ? styles.active : ''}`}
              onClick={() => onTabChange('daily')}
            >
              Daily (14D)
            </button>
          </div>
        </div>
      </div>

      <div className={styles.trendGraphWrapper}>
        {/* Summary Stat Strip */}
        <div className={styles.trendHeaderStats}>
          <div className={styles.trendStatItem}>
            <span className={styles.trendStatLabel}>Period Created</span>
            <span className={styles.trendStatVal} style={{ color: '#2563eb' }}>
              {totalCreated.toLocaleString()} Tickets
            </span>
          </div>
          <div className={styles.trendStatItem}>
            <span className={styles.trendStatLabel}>Period Resolved</span>
            <span className={styles.trendStatVal} style={{ color: '#10b981' }}>
              {totalResolved.toLocaleString()} Tickets
            </span>
          </div>
          <div className={styles.trendStatItem}>
            <span className={styles.trendStatLabel}>Throughput Rate</span>
            <span className={styles.trendStatVal} style={{ color: 'var(--text-primary, #0f172a)' }}>
              {totalCreated > 0 ? ((totalResolved / totalCreated) * 100).toFixed(1) : '100'}%
            </span>
          </div>
          <div className={styles.trendStatItem}>
            <span className={styles.trendStatLabel}>Data Points</span>
            <span className={styles.trendStatVal} style={{ color: 'var(--text-secondary, #64748b)' }}>
              {activeDataset.length} {activeTab === 'monthly' ? 'Months' : activeTab === 'weekly' ? 'Weeks' : 'Days'}
            </span>
          </div>
        </div>

        {/* Interactive Filter / Metric Isolation Bar */}
        <div className={styles.trendFilterBar}>
          <span className="analytics-filter-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
            Toggle series to isolate without seeing other information:
          </span>
          <div className={styles.metricToggles}>
            <button
              type="button"
              className={`${styles.metricChip} ${showCreated ? styles.activeCreated : ''}`}
              onClick={() => setShowCreated((prev) => !prev || !showResolved)}
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
              <span>Tickets Created {showCreated ? '(Active)' : ''}</span>
            </button>

            <button
              type="button"
              className={`${styles.metricChip} ${showResolved ? styles.activeResolved : ''}`}
              onClick={() => setShowResolved((prev) => !prev || !showCreated)}
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>Tickets Resolved {showResolved ? '(Active)' : ''}</span>
            </button>
          </div>
        </div>

        {/* SVG Curve / Bar Graph */}
        <div className={styles.svgGraphContainer}>
          {hoveredPoint && (
            <div className={styles.graphTooltip}>
              <strong style={{ color: 'var(--analytics-tooltip-color, #fff)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', display: 'block', marginBottom: '4px' }}>
                {hoveredPoint.label}
              </strong>
              {showCreated && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', color: '#93c5fd' }}>
                  <span>Created:</span>
                  <strong>{hoveredPoint.created.toLocaleString()} / {totalCreated.toLocaleString()}</strong>
                </div>
              )}
              {showResolved && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', color: '#6ee7b7' }}>
                  <span>Resolved:</span>
                  <strong>{hoveredPoint.resolved.toLocaleString()} / {totalResolved.toLocaleString()}</strong>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', color: '#94a3b8', fontSize: '0.75rem', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
                <span>Output Rate:</span>
                <strong>
                  {hoveredPoint.created > 0
                    ? ((hoveredPoint.resolved / hoveredPoint.created) * 100).toFixed(1)
                    : '100'}
                  %
                </strong>
              </div>
            </div>
          )}

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.svgGraph}>
            <defs>
              <linearGradient id="barGradCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="barGradResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal Reference Lines */}
            {yTicks.map(({ val, y, showLabel, isExactDataVal }) => (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  className={styles.gridLine}
                  style={isExactDataVal && val > 0 ? { strokeOpacity: 0.9 } : undefined}
                />
                {showLabel && (
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className={styles.axisText}
                    style={isExactDataVal && val > 0 ? { fontWeight: 700, fill: 'var(--text-primary, #334155)' } : undefined}
                  >
                    {val}
                  </text>
                )}
              </g>
            ))}

            {/* X Axis Base Line */}
            <line
              x1={padLeft}
              y1={padTop + graphH}
              x2={svgWidth - padRight}
              y2={padTop + graphH}
              className={styles.axisLine}
            />

            {/* ---- BAR CHART MODE ---- */}
            {graphType === 'bar' &&
              activeDataset.map((d, i) => {
                const slotCenterX = padLeft + i * slotWidth + slotWidth / 2;
                const hCreated = maxVal > 0 ? (d.created / maxVal) * graphH : 0;
                const hResolved = maxVal > 0 ? (d.resolved / maxVal) * graphH : 0;
                const baseY = padTop + graphH;

                const isHovered = hoveredPoint?.label === d.label;

                return (
                  <g
                    key={d.label}
                    onMouseEnter={() =>
                      setHoveredPoint({
                        label: d.label,
                        created: d.created,
                        resolved: d.resolved,
                        x: slotCenterX,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Background Slot Hover highlight */}
                    <rect
                      x={padLeft + i * slotWidth + 2}
                      y={padTop}
                      width={slotWidth - 4}
                      height={graphH}
                      fill={isHovered ? 'rgba(59, 130, 246, 0.06)' : 'transparent'}
                      rx="6"
                    />

                    {/* Created Bar */}
                    {showCreated && d.created > 0 && (
                      <rect
                        x={
                          showResolved
                            ? slotCenterX - singleBarWidth - 2
                            : slotCenterX - singleBarWidth / 2
                        }
                        y={baseY - Math.max(hCreated, 2)}
                        width={singleBarWidth}
                        height={Math.max(hCreated, 2)}
                        rx="4"
                        fill="url(#barGradCreated)"
                        className={styles.barRect}
                        style={{
                          opacity: hoveredPoint && !isHovered ? 0.4 : 1,
                        }}
                      />
                    )}

                    {/* Resolved Bar */}
                    {showResolved && d.resolved > 0 && (
                      <rect
                        x={
                          showCreated
                            ? slotCenterX + 2
                            : slotCenterX - singleBarWidth / 2
                        }
                        y={baseY - Math.max(hResolved, 2)}
                        width={singleBarWidth}
                        height={Math.max(hResolved, 2)}
                        rx="4"
                        fill="url(#barGradResolved)"
                        className={styles.barRect}
                        style={{
                          opacity: hoveredPoint && !isHovered ? 0.4 : 1,
                        }}
                      />
                    )}

                    {/* Value Labels on top of bars for both Created and Solved counts */}
                    {showCreated && (d.created > 0 || isHovered) && (
                      <text
                        x={showResolved ? slotCenterX - singleBarWidth / 2 - 2 : slotCenterX}
                        y={Math.max(12, baseY - hCreated - 6)}
                        textAnchor="middle"
                        className={styles.barValueText}
                        style={{ fill: '#2563eb' }}
                      >
                        {slotWidth >= 85 ? `${d.created}/${totalCreated}` : d.created}
                      </text>
                    )}
                    {showResolved && (d.resolved > 0 || isHovered) && (
                      <text
                        x={showCreated ? slotCenterX + singleBarWidth / 2 + 2 : slotCenterX}
                        y={Math.max(12, baseY - hResolved - 6)}
                        textAnchor="middle"
                        className={styles.barValueText}
                        style={{ fill: '#059669' }}
                      >
                        {slotWidth >= 85 ? `${d.resolved}/${totalResolved}` : d.resolved}
                      </text>
                    )}

                    {/* X Axis Label */}
                    <text
                      x={slotCenterX}
                      y={padTop + graphH + 20}
                      textAnchor="middle"
                      className={styles.axisText}
                      style={{
                        fontWeight: isHovered ? 800 : 600,
                        fill: isHovered ? '#0f172a' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}

            {/* ---- CURVE GRAPH MODE ---- */}
            {graphType === 'curve' && (
              <>
                {/* Vertical crosshair guide on hovered point */}
                {hoveredPoint && (
                  <line
                    x1={hoveredPoint.x}
                    y1={padTop}
                    x2={hoveredPoint.x}
                    y2={padTop + graphH}
                    className={styles.crosshairLine}
                  />
                )}

                {/* Shaded Area Fill for Created */}
                {showCreated && createdAreaPath && (
                  <path d={createdAreaPath} fill="url(#createdGrad)" />
                )}

                {/* Created Smooth Curve */}
                {showCreated && createdCurvePath && (
                  <path
                    d={createdCurvePath}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Resolved Smooth Curve */}
                {showResolved && resolvedCurvePath && (
                  <path
                    d={resolvedCurvePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 4"
                  />
                )}

                {/* Interactive Data Dots & X Axis Labels */}
                {points.map((p) => (
                  <g key={p.index}>
                    {/* Invisible hover capture strip */}
                    <rect
                      x={p.x - graphW / (points.length * 2)}
                      y={padTop}
                      width={graphW / points.length}
                      height={graphH}
                      fill="transparent"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          label: p.label,
                          created: p.created,
                          resolved: p.resolved,
                          x: p.x,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />

                    {/* Created Dot & Count Label */}
                    {showCreated && (
                      <>
                        <circle
                          cx={p.x}
                          cy={p.yCreated}
                          r={hoveredPoint?.label === p.label ? '6' : '4.5'}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={hoveredPoint?.label === p.label ? '3.5' : '2.5'}
                          className={styles.chartDot}
                        />
                        {(p.created > 0 || points.length <= 6 || hoveredPoint?.label === p.label) && (
                          <text
                            x={p.x}
                            y={Math.max(12, p.yCreated - 10)}
                            textAnchor="middle"
                            className={styles.barValueText}
                            style={{ fill: '#2563eb' }}
                          >
                            {`${p.created}/${totalCreated}`}
                          </text>
                        )}
                      </>
                    )}

                    {/* Resolved Dot & Count Label */}
                    {showResolved && (
                      <>
                        <circle
                          cx={p.x}
                          cy={p.yResolved}
                          r={hoveredPoint?.label === p.label ? '6' : '4'}
                          fill="#ffffff"
                          stroke="#10b981"
                          strokeWidth={hoveredPoint?.label === p.label ? '3.5' : '2.5'}
                          className={styles.chartDot}
                        />
                        {(p.resolved > 0 || points.length <= 6 || hoveredPoint?.label === p.label) && (
                          <text
                            x={p.x}
                            y={
                              showCreated && Math.abs(p.yResolved - p.yCreated) < 22
                                ? Math.min(padTop + graphH - 4, p.yResolved + 16)
                                : p.resolved === 0
                                  ? padTop + graphH - 8
                                  : Math.min(padTop + graphH - 4, p.yResolved + 16)
                            }
                            textAnchor="middle"
                            className={styles.barValueText}
                            style={{ fill: '#059669' }}
                          >
                            {`${p.resolved}/${totalResolved}`}
                          </text>
                        )}
                      </>
                    )}

                    {/* X Axis Label */}
                    <text
                      x={p.x}
                      y={padTop + graphH + 20}
                      textAnchor="middle"
                      className={styles.axisText}
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </>
            )}
          </svg>
        </div>

        {/* Legend Indicator */}
        <div className="analytics-legend-strip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', paddingTop: '8px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
          <div className="analytics-legend-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#2563eb', display: 'inline-block' }} />
            <span>Tickets Created ({graphType === 'bar' ? 'Blue Gradient Bar' : 'Velocity Curve'} — {totalCreated.toLocaleString()} Total)</span>
          </div>
          <div className="analytics-legend-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#10b981', display: 'inline-block' }} />
            <span>Tickets Resolved ({graphType === 'bar' ? 'Emerald Gradient Bar' : 'Output Throughput'} — {totalResolved.toLocaleString()} Total)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Professional Department Problem Solving & Resolution Performance Component --------------
// ---- Department Performance Leaderboard & Which Department is Performing Well ----
function DepartmentPerformanceLeaderboard({
  departments,
  isManager = false,
}: {
  departments: AdminAnalyticsData['departmentAnalytics'];
  isManager?: boolean;
}) {
  const rankedDepts = useMemo(() => {
    return [...departments]
      .filter((d) => d.totalTickets > 0)
      .sort((a, b) => {
        const scoreA = a.performanceScore ?? a.resolutionRate;
        const scoreB = b.performanceScore ?? b.resolutionRate;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.resolvedTickets - a.resolvedTickets;
      });
  }, [departments]);

  const topPerformer = (isManager && departments[0]) ? departments[0] : (rankedDepts[0] || null);
  const runnerUps = isManager ? [] : rankedDepts.slice(1, 4);

  if (!topPerformer && !rankedDepts.length) return null;

  return (
    <div className={styles.deptSectionCard}>
      <div className={styles.deptSectionHeader}>
        <div>
          <h3 className={styles.deptSectionTitle}>
            {isManager ? (
              <>
                <ShieldCheckIcon style={{ width: 22, height: 22, color: '#2563eb', display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                Department Performance & SLA Health Overview
              </>
            ) : (
              <>
                <TrophyIcon className="w-6 h-6 text-amber-500 inline mr-2" />
                Department Performance Ranking & Leaderboard
              </>
            )}
          </h3>
          <div className={styles.deptSectionSubtitle}>
            {isManager
              ? `Strict performance evaluation of tickets routed to ${topPerformer.departmentName}, measuring Early, On-Time, and Late SLA resolutions`
              : 'Identifies which departments are performing best based on strict composite metrics (Resolution Rate, SLA Compliance, Overdue Backlog)'}
          </div>
        </div>
        <span className={styles.badgePill}>
          {isManager ? 'Department Scope' : `${rankedDepts.length} Active Teams`}
        </span>
      </div>

      {/* Strict SLA & Performance Governance Banner */}
      <div className={styles.strictRuleNotice}>
        <div className={styles.strictRuleLeft}>
          <ShieldCheckIcon className={styles.strictRuleIcon} />
          <div>
            <strong className={styles.strictRuleStrong}>Strict Performance Rule:</strong> A department performance score cannot reach <strong className={styles.strictRuleTarget}>100%</strong> unless 100% of tickets are resolved, zero tickets are overdue, and all SLA deadlines are honored.
          </div>
        </div>
        <a
          href="/Department_Performance_And_SLA_Qualification_Formula.pdf"
          download="Department_Performance_And_SLA_Qualification_Formula.pdf"
          className={styles.downloadFormulaBtn}
          title="Download the official mathematical formula and SLA qualification specification PDF"
        >
          <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> Download Formula PDF
        </a>
      </div>

      {/* Spotlight Cards Grid */}
      <div className={styles.topSpotlightGrid} style={{ marginTop: '16px' }}>
        {topPerformer && (
          <div className={`${styles.spotlightCard} ${topPerformer.is100PercentQualified ? styles.spotlightCardWinner : ''}`}>
            <div className={styles.spotlightHeader}>
              <span className={isManager ? styles.deptManagerBadge : `${styles.rankBadgeSpotlight} ${styles.rank1}`}>
                {isManager ? (
                  <><BuildingOffice2Icon style={{ width: 16, height: 16, color: '#2563eb', display: 'inline', marginRight: 4 }} /> {topPerformer.departmentName} ({topPerformer.departmentCode || 'DEPT'})</>
                ) : (
                  <><TrophyIcon className="w-4 h-4 text-amber-600" /> #1 Top Performing Department</>
                )}
              </span>
              {topPerformer.is100PercentQualified ? (
                <span className={`${styles.complianceCheckPill} ${styles.pillFlawless}`}>
                  <TrophyIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3 }} /> 100% SLA Qualified
                </span>
              ) : (
                <span className={`${styles.complianceCheckPill} ${styles.pillCapped}`}>
                  <ExclamationTriangleIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3 }} /> Capped: {topPerformer.performanceReasons?.[0] || 'Pending backlog'}
                </span>
              )}
            </div>

            <div className={styles.spotlightNameRow}>
              <div>
                <h4 className={styles.spotlightTitle}>
                  {topPerformer.departmentName}
                </h4>
                <div className={styles.spotlightMeta}>
                  Head: <strong>{topPerformer.headName}</strong> - {isManager ? 'Department Scope' : (topPerformer.departmentCode || 'DEPT')}
                </div>
              </div>
              <div className={`${styles.spotlightScore} ${topPerformer.is100PercentQualified ? styles.scoreQualified : styles.scoreStandard}`}>
                {topPerformer.performanceScore ?? topPerformer.resolutionRate}<span className={styles.scoreUnit}>%</span>
              </div>
            </div>

            <div className={styles.spotlightMetricsGrid}>
              <div className={styles.spotlightMetricItem}>
                <span className={styles.spotlightMetricVal}>{topPerformer.resolvedTickets}/{topPerformer.totalTickets}</span>
                <span className={styles.spotlightMetricLbl}>Routed Solved ({topPerformer.resolutionRate}%)</span>
              </div>
              <div className={styles.spotlightMetricItem}>
                <span className={`${styles.spotlightMetricVal} ${styles.metricValSuccess}`}>
                  {topPerformer.earlyResolvedTickets ?? 0} Early <span className={styles.metricValSub}>- {topPerformer.onTimeResolvedTickets ?? 0} On-Time</span>
                </span>
                <span className={styles.spotlightMetricLbl}>SLA Delivery</span>
              </div>
              <div className={styles.spotlightMetricItem}>
                <span className={`${styles.spotlightMetricVal} ${topPerformer.slaComplianceRate >= 80 ? styles.metricValSuccess : styles.metricValDanger}`}>
                  {topPerformer.slaComplianceRate}%
                </span>
                <span className={styles.spotlightMetricLbl}>
                  {topPerformer.lateResolvedTickets ? `${topPerformer.lateResolvedTickets} Late Breached` : 'Zero Late'}
                </span>
              </div>
              <div className={styles.spotlightMetricItem}>
                <span className={`${styles.spotlightMetricVal} ${topPerformer.overdueTickets > 0 ? styles.metricValDanger : styles.metricValSuccess}`}>
                  {topPerformer.overdueTickets > 0 ? `${topPerformer.overdueTickets} Overdue` : 'Zero Overdue'}
                </span>
                <span className={styles.spotlightMetricLbl}>Active Backlog: {topPerformer.openTickets + topPerformer.inProgressTickets}</span>
              </div>
            </div>
          </div>
        )}

        {runnerUps.map((dept, idx) => {
          const rankNum = idx + 2;
          const rankClass = rankNum === 2 ? styles.rank2 : styles.rank3;
          return (
            <div key={dept.departmentId} className={styles.spotlightCard}>
              <div className={styles.spotlightHeader}>
                <span className={`${styles.rankBadgeSpotlight} ${rankClass}`}>
                  #{rankNum} Department
                </span>
                {dept.is100PercentQualified ? (
                  <span className={`${styles.complianceCheckPill} ${styles.pillFlawless}`}>
                    <TrophyIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> 100% SLA Qualified
                  </span>
                ) : (
                  <span className={`${styles.complianceCheckPill} ${styles.pillCapped}`}>
                    Score: {dept.performanceScore ?? dept.resolutionRate}%
                  </span>
                )}
              </div>

              <div className={styles.spotlightNameRow}>
                <div>
                  <h4 className={styles.spotlightTitle} style={{ fontSize: '1.1rem' }}>
                    {dept.departmentName}
                  </h4>
                  <div className={styles.spotlightMeta} style={{ fontSize: '0.78rem' }}>
                    Head: <strong>{dept.headName}</strong>
                  </div>
                </div>
                <div className={`${styles.spotlightScore} ${styles.scoreRunnerUp}`} style={{ fontSize: '1.6rem' }}>
                  {dept.performanceScore ?? dept.resolutionRate}<span className={styles.scoreUnit}>%</span>
                </div>
              </div>

              <div className={styles.spotlightMetricsGrid}>
                <div className={styles.spotlightMetricItem}>
                  <span className={styles.spotlightMetricVal}>{dept.resolvedTickets}/{dept.totalTickets}</span>
                  <span className={styles.spotlightMetricLbl}>Routed ({dept.resolutionRate}%)</span>
                </div>
                <div className={styles.spotlightMetricItem}>
                  <span className={`${styles.spotlightMetricVal} ${styles.metricValSuccess}`}>
                    {dept.earlyResolvedTickets ?? 0} Early
                  </span>
                  <span className={styles.spotlightMetricLbl}>
                    {dept.lateResolvedTickets ? `${dept.lateResolvedTickets} Late` : `${dept.onTimeResolvedTickets ?? 0} On-Time`}
                  </span>
                </div>
                <div className={styles.spotlightMetricItem}>
                  <span className={`${styles.spotlightMetricVal} ${dept.slaComplianceRate >= 80 ? styles.metricValSuccess : styles.metricValWarning}`}>
                    {dept.slaComplianceRate}%
                  </span>
                  <span className={styles.spotlightMetricLbl}>SLA Met</span>
                </div>
                <div className={styles.spotlightMetricItem}>
                  <span className={`${styles.spotlightMetricVal} ${dept.overdueTickets > 0 ? styles.metricValDanger : styles.metricValSuccess}`}>
                    {dept.overdueTickets > 0 ? `${dept.overdueTickets} Overdue` : '0 Overdue'}
                  </span>
                  <span className={styles.spotlightMetricLbl}>Backlog: {dept.openTickets + dept.inProgressTickets}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- 1. Department Problem-Solving Efficiency Component ----------------------------------
function DepartmentEfficiencyChart({
  departments,
  isManager = false,
}: {
  departments: AdminAnalyticsData['departmentAnalytics'];
  isManager?: boolean;
}) {
  const [sortBy, setSortBy] = useState<'score' | 'early' | 'rate_desc' | 'rate_asc' | 'time' | 'name'>('score');

  // Key KPI summary
  const totalRelated = useMemo(() => departments.reduce((acc, d) => acc + d.totalTickets, 0), [departments]);
  const totalResolved = useMemo(() => departments.reduce((acc, d) => acc + d.resolvedTickets, 0), [departments]);
  const overallRate = totalRelated > 0 ? Number(((totalResolved / totalRelated) * 100).toFixed(1)) : 0;

  const activeDepts = useMemo(() => departments.filter((d) => d.totalTickets > 0), [departments]);

  const topPerformer = useMemo(() => {
    if (!activeDepts.length) return null;
    return [...activeDepts].sort((a, b) => (b.performanceScore ?? b.resolutionRate) - (a.performanceScore ?? a.resolutionRate) || b.resolvedTickets - a.resolvedTickets)[0];
  }, [activeDepts]);

  const fastestDept = useMemo(() => {
    const list = departments.filter((d) => d.totalTickets > 0 && d.avgResolutionHours > 0);
    if (!list.length) return null;
    return [...list].sort((a, b) => a.avgResolutionHours - b.avgResolutionHours)[0];
  }, [departments]);

  const eliteCount = useMemo(() => departments.filter((d) => d.totalTickets > 0 && d.resolutionRate >= 80).length, [departments]);

  // Sorted department list
  const sortedDepts = useMemo(() => {
    const list = [...departments];
    if (sortBy === 'score') return list.sort((a, b) => (b.performanceScore ?? b.resolutionRate) - (a.performanceScore ?? a.resolutionRate) || b.resolvedTickets - a.resolvedTickets);
    if (sortBy === 'early') return list.sort((a, b) => (b.earlyResolvedTickets ?? 0) - (a.earlyResolvedTickets ?? 0) || b.resolvedTickets - a.resolvedTickets);
    if (sortBy === 'rate_desc') return list.sort((a, b) => b.resolutionRate - a.resolutionRate || b.resolvedTickets - a.resolvedTickets);
    if (sortBy === 'rate_asc') return list.sort((a, b) => a.resolutionRate - b.resolutionRate || a.resolvedTickets - b.resolvedTickets);
    if (sortBy === 'time') return list.sort((a, b) => a.avgResolutionHours - b.avgResolutionHours);
    if (sortBy === 'name') return list.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
    return list;
  }, [departments, sortBy]);

  return (
    <div className={styles.deptSectionCard}>
      {/* Header */}
      <div className={styles.deptSectionHeader}>
        <div>
          <h3 className={styles.deptSectionTitle}>
            <TrophyIcon style={{ width: 22, height: 22, color: '#f59e0b', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Department Problem-Solving & SLA Delivery Performance
          </h3>
          <div className={styles.deptSectionSubtitle}>
            {isManager && departments[0]
              ? `Strict performance evaluation of tickets routed to ${departments[0].departmentName}, measuring Early, On-Time, and Late SLA resolutions`
              : 'Strict performance evaluation of tickets routed to each department, measuring Early, On-Time, and Late SLA resolutions'}
          </div>
        </div>

        {/* Sort Controls (hidden for single department manager) */}
        {(!isManager || departments.length > 1) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-surface, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer',
              }}
            >
              <option value="score">Highest Performance Score (Strict SLA)</option>
              <option value="early">Most Early Resolutions (Ahead of SLA)</option>
              <option value="rate_desc">Highest Solving Efficiency (%)</option>
              <option value="rate_asc">Lowest Solving Efficiency (%)</option>
              <option value="time">Fastest Turnaround Speed</option>
              <option value="name">Department Name (A-Z)</option>
            </select>
          </div>
        )}
      </div>

      {/* KPI Highlight Strip */}
      <div className={styles.deptKpiGrid}>
        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <TrophyIcon style={{ width: 16, height: 16, color: '#f59e0b', display: 'inline', marginRight: 4 }} /> {isManager ? 'Department Score' : 'Top-Performing Team'}
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#15803d' }}>
            {isManager && departments[0]
              ? (departments[0].is100PercentQualified ? '100%' : `${departments[0].performanceScore ?? departments[0].resolutionRate}%`)
              : (topPerformer ? `${topPerformer.performanceScore ?? topPerformer.resolutionRate}%` : 'N/A')}
          </div>
          <div className={styles.deptKpiSub}>
            {isManager && departments[0]
              ? (departments[0].is100PercentQualified ? '100% SLA Qualified' : (departments[0].performanceReasons?.[0] || 'Strict SLA evaluation'))
              : (topPerformer ? `${topPerformer.departmentName} (${topPerformer.resolvedTickets}/${topPerformer.totalTickets} solved)` : 'No active records')}
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <ChartBarIcon style={{ width: 16, height: 16, color: '#10b981', display: 'inline', marginRight: 4 }} /> {isManager ? 'Solving Efficiency' : 'Overall Solving Rate'}
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#2563eb' }}>
            {overallRate}%
          </div>
          <div className={styles.deptKpiSub}>
            {totalResolved} of {totalRelated} total routed problems solved
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <BoltIcon style={{ width: 16, height: 16, color: '#3b82f6', display: 'inline', marginRight: 4 }} /> {isManager ? 'Average Turnaround' : 'Fastest Turnaround'}
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#0284c7' }}>
            {isManager && departments[0]
              ? `${departments[0].avgResolutionHours}h`
              : (fastestDept ? `${fastestDept.avgResolutionHours}h` : '0h')}
          </div>
          <div className={styles.deptKpiSub}>
            {isManager && departments[0]
              ? `${departments[0].departmentName} resolution speed`
              : (fastestDept ? `${fastestDept.departmentName} avg turnaround` : 'No data')}
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            {isManager ? (
              <><ShieldCheckIcon style={{ width: 16, height: 16, color: '#10b981', display: 'inline', marginRight: 4 }} /> SLA Compliance</>
            ) : (
              <><CheckCircleIcon style={{ width: 16, height: 16, color: '#10b981', display: 'inline', marginRight: 4 }} /> Elite Departments</>
            )}
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#7c3aed' }}>
            {isManager && departments[0] ? (
              `${departments[0].slaComplianceRate}%`
            ) : (
              <>{eliteCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>/ {activeDepts.length} active</span></>
            )}
          </div>
          <div className={styles.deptKpiSub}>
            {isManager ? 'Tickets met before deadline target' : 'Teams achieving 80% or higher resolution efficiency'}
          </div>
        </div>
      </div>

      {/* Structured Department Cards with Dedicated Zones (Zero Overflow) */}
      <div className={styles.deptRowList}>
        {!sortedDepts.length ? (
          <p className={styles.emptyState}>No department problem resolution records found</p>
        ) : (
          sortedDepts.map((dept) => {
            const isNoActivity = dept.totalTickets === 0;
            const isElite = !isNoActivity && dept.resolutionRate >= 80;
            const isHigh = !isNoActivity && dept.resolutionRate >= 65 && dept.resolutionRate < 80;
            const isModerate = !isNoActivity && dept.resolutionRate >= 50 && dept.resolutionRate < 65;

            const badgeColor =
              isNoActivity ? '#64748b' :
              isElite ? '#15803d' :
              isHigh ? '#1d4ed8' :
              isModerate ? '#b45309' :
              '#b91c1c';

            const barGradient =
              isNoActivity ? '#e2e8f0' :
              isElite ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' :
              isHigh ? 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)' :
              isModerate ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' :
              'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';

            return (
              <div key={dept.departmentId} className={styles.deptCardContainer}>
                {/* -- Zone 1: Card Header (Identity on left, clean badges on right) -- */}
                <div className={styles.deptCardHeader}>
                  <div className={styles.deptCardIdentity}>
                    <div className={styles.deptCardIconBox}>
                      <BuildingOffice2Icon style={{ width: 20, height: 20, color: isNoActivity ? '#94a3b8' : '#2563eb' }} />
                    </div>
                    <div>
                      <h4 className={styles.deptCardName}>{dept.departmentName}</h4>
                      <div className={styles.deptCardSub}>
                        {dept.departmentCode ? <span className={styles.deptCodeTag}>{dept.departmentCode}</span> : null}
                        <span>Head: <strong>{dept.headName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.deptCardHeaderBadges}>
                    {isNoActivity ? (
                      <span className={`${styles.tierBadge} ${styles.tierIdle}`}><span className={styles.tierDot} style={{ background: '#94a3b8' }} /> Inactive</span>
                    ) : dept.is100PercentQualified ? (
                      <span className={`${styles.tierBadge} ${styles.tierElite}`}><TrophyIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3 }} /> 100% SLA Qualified</span>
                    ) : isElite ? (
                      <span className={`${styles.tierBadge} ${styles.tierElite}`}><span className={styles.tierDot} style={{ background: '#10b981' }} /> Elite</span>
                    ) : isHigh ? (
                      <span className={`${styles.tierBadge} ${styles.tierGood}`}><span className={styles.tierDot} style={{ background: '#3b82f6' }} /> High</span>
                    ) : isModerate ? (
                      <span className={`${styles.tierBadge} ${styles.tierModerate}`}><span className={styles.tierDot} style={{ background: '#f59e0b' }} /> Moderate</span>
                    ) : (
                      <span className={`${styles.tierBadge} ${styles.tierWarn}`}><span className={styles.tierDot} style={{ background: '#ef4444' }} /> Needs Attention</span>
                    )}

                    {!isNoActivity ? (
                      <span className={styles.deptScorePill}>
                        <BoltIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3 }} /> Score: <strong>{dept.performanceScore ?? dept.resolutionRate}%</strong>
                      </span>
                    ) : (
                      <span className={styles.deptScorePillMuted}>Score: N/A</span>
                    )}
                  </div>
                </div>

                {/* -- Zone 2: Progress & Solving Rate (Dedicated Full-Width Strip) -- */}
                <div className={styles.deptProgressSection}>
                  <div className={styles.deptProgressMeta}>
                    <div className={styles.deptProgressStats}>
                      <span className={styles.deptSolvedCount}>
                        <strong>{dept.resolvedTickets}</strong> of <strong>{dept.totalTickets}</strong> routed tickets resolved
                      </span>
                      {dept.openTickets + dept.inProgressTickets > 0 ? (
                        <span className={styles.deptBacklogTag}>
                          <ClockIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> {dept.openTickets + dept.inProgressTickets} in backlog ({dept.overdueTickets > 0 ? `${dept.overdueTickets} overdue` : '0 overdue'})
                        </span>
                      ) : dept.totalTickets > 0 ? (
                        <span className={styles.deptBacklogClean}><CheckCircleIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> Backlog fully cleared</span>
                      ) : null}
                      {dept.totalTickets > 0 && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: dept.slaComplianceRate >= 80 ? '#15803d' : '#b45309' }}>
                          <ShieldCheckIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> SLA: {dept.slaComplianceRate}% - {dept.avgResolutionHours}h turnaround
                        </span>
                      )}
                    </div>

                    <div className={styles.deptRateDisplay} style={{ color: badgeColor }}>
                      {dept.totalTickets > 0 ? `${dept.resolutionRate}%` : '0%'}
                      <span className={styles.deptRateUnit}>Resolution Rate</span>
                    </div>
                  </div>

                  <div className={styles.deptProgressBarTrack}>
                    <div
                      className={styles.deptProgressBarFill}
                      style={{
                        width: `${Math.min(Math.max(dept.resolutionRate, 0), 100)}%`,
                        background: barGradient,
                      }}
                    />
                  </div>
                </div>

                {/* -- Zone 3: Detailed SLA Timing Grid (4 Equal-width clean boxes) -- */}
                <div className={styles.deptBreakdownGrid}>
                  {/* Box 1: Routed Workload */}
                  <div className={styles.breakdownBox}>
                    <div className={styles.breakdownBoxHeader}>
                      <span className={styles.breakdownIcon}><InboxArrowDownIcon style={{ width: 15, height: 15, color: '#2563eb' }} /></span>
                      <span className={styles.breakdownBoxTitle}>Routed Workload</span>
                    </div>
                    <div className={styles.breakdownBoxValue}>
                      {dept.resolvedTickets} / {dept.totalTickets}
                    </div>
                    <div className={styles.breakdownBoxSub}>
                      {dept.totalTickets > 0 ? `${dept.resolutionRate}% solved (${dept.openTickets + dept.inProgressTickets} in backlog)` : '0 tickets routed'}
                    </div>
                  </div>

                  {/* Box 2: Solved Early */}
                  <div className={styles.breakdownBox}>
                    <div className={styles.breakdownBoxHeader}>
                      <span className={styles.breakdownIcon}><ArrowUpTrayIcon style={{ width: 15, height: 15, color: '#6366f1' }} /></span>
                      <span className={styles.breakdownBoxTitle}>Solved Early</span>
                    </div>
                    <div className={styles.breakdownBoxValue} style={{ color: (dept.earlyResolvedTickets ?? 0) > 0 ? '#15803d' : 'inherit' }}>
                      {dept.earlyResolvedTickets ?? 0}
                    </div>
                    <div className={styles.breakdownBoxSub}>
                      {(dept.earlyResolvedTickets ?? 0) > 0 ? `${dept.earlyResolutionRate}% ahead of SLA schedule` : '0 early resolutions'}
                    </div>
                  </div>

                  {/* Box 3: Solved On-Time */}
                  <div className={styles.breakdownBox}>
                    <div className={styles.breakdownBoxHeader}>
                      <span className={styles.breakdownIcon}><ClockIcon style={{ width: 15, height: 15, color: '#f59e0b' }} /></span>
                      <span className={styles.breakdownBoxTitle}>Solved On-Time</span>
                    </div>
                    <div className={styles.breakdownBoxValue} style={{ color: (dept.onTimeResolvedTickets ?? 0) > 0 ? '#2563eb' : 'inherit' }}>
                      {dept.onTimeResolvedTickets ?? 0}
                    </div>
                    <div className={styles.breakdownBoxSub}>
                      {(dept.onTimeResolvedTickets ?? 0) > 0 ? `${dept.onTimeResolutionRate}% met deadline window` : '0 standard on-time'}
                    </div>
                  </div>

                  {/* Box 4: Solved Late / Overdue */}
                  <div className={styles.breakdownBox}>
                    <div className={styles.breakdownBoxHeader}>
                      <span className={styles.breakdownIcon}><ShieldCheckIcon style={{ width: 15, height: 15, color: dept.overdueTickets > 0 ? '#ef4444' : '#10b981' }} /></span>
                      <span className={styles.breakdownBoxTitle}>Solved Late / Overdue</span>
                    </div>
                    <div
                      className={styles.breakdownBoxValue}
                      style={{ color: ((dept.lateResolvedTickets ?? 0) > 0 || dept.overdueTickets > 0) ? '#dc2626' : '#15803d' }}
                    >
                      {(dept.lateResolvedTickets ?? 0) + dept.overdueTickets}
                    </div>
                    <div className={styles.breakdownBoxSub}>
                      {dept.lateResolvedTickets ? `${dept.lateResolvedTickets} solved late` : '0 late'} - {dept.overdueTickets > 0 ? `${dept.overdueTickets} overdue` : '0 overdue'}
                    </div>
                  </div>
                </div>

                {/* -- Zone 4: Contextual Performance Note & SLA Governance -- */}
                {isNoActivity ? (
                  <div className={styles.deptNoticeNeutral}>
                    <span className={styles.tierDot} style={{ background: '#94a3b8' }} /> No tickets routed to this department in the selected period.
                  </div>
                ) : dept.is100PercentQualified ? (
                  <div className={styles.deptNoticeSuccess}>
                    <CheckCircleIcon style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} /> 100% SLA Qualified: All {dept.totalTickets} routed tickets solved on-time/early with zero overdue, zero late resolutions, and backlog fully cleared.
                  </div>
                ) : dept.performanceReasons?.length ? (
                  <div className={styles.deptNoticeWarning}>
                    <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0 }} /> Performance Limitations: {dept.performanceReasons.join(' - ')}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// -- 2. Department Solved Tickets vs Total Workload Volume Component ----------------------
function DepartmentSolvedVolumeChart({
  departments,
  isManager = false,
}: {
  departments: AdminAnalyticsData['departmentAnalytics'];
  isManager?: boolean;
}) {
  const [sortBy, setSortBy] = useState<'solved' | 'total' | 'backlog'>('solved');

  // Summary Metrics
  const totalSolved = useMemo(() => departments.reduce((acc, d) => acc + d.resolvedTickets, 0), [departments]);
  const totalWorkload = useMemo(() => departments.reduce((acc, d) => acc + d.totalTickets, 0), [departments]);
  const totalActiveBacklog = useMemo(() => departments.reduce((acc, d) => acc + (d.openTickets + d.inProgressTickets), 0), [departments]);
  const totalOverdue = useMemo(() => departments.reduce((acc, d) => acc + d.overdueTickets, 0), [departments]);

  // Max workload across all departments for proportional meter scaling
  const maxVolume = useMemo(() => {
    if (!departments.length) return 10;
    const maxVal = Math.max(...departments.map((d) => d.totalTickets));
    return Math.max(maxVal, 5);
  }, [departments]);

  // Sorted list
  const sortedDepts = useMemo(() => {
    const list = [...departments];
    if (sortBy === 'solved') return list.sort((a, b) => b.resolvedTickets - a.resolvedTickets || b.totalTickets - a.totalTickets);
    if (sortBy === 'total') return list.sort((a, b) => b.totalTickets - a.totalTickets);
    if (sortBy === 'backlog') return list.sort((a, b) => (b.openTickets + b.inProgressTickets) - (a.openTickets + a.inProgressTickets));
    return list;
  }, [departments, sortBy]);

  return (
    <div className={styles.deptSectionCard}>
      {/* Header */}
      <div className={styles.deptSectionHeader}>
        <div>
          <h3 className={styles.deptSectionTitle}>
            <ChartBarIcon style={{ width: 20, height: 20, color: '#2563eb', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Department Solved Tickets vs. Total Workload
          </h3>
          <div className={styles.deptSectionSubtitle}>
            {isManager && departments[0]
              ? `Volume of tickets routed to ${departments[0].departmentName}, categorized by Early, On-Time, and Late SLA delivery`
              : 'Volume of tickets routed to each department, categorized by Early, On-Time, and Late SLA delivery'}
          </div>
        </div>

        {/* Sort Controls (hidden for single department manager) */}
        {(!isManager || departments.length > 1) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-surface, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer',
              }}
            >
              <option value="solved">Most Solved Tickets</option>
              <option value="total">Highest Routed Workload</option>
              <option value="backlog">Largest Active Backlog</option>
            </select>
          </div>
        )}
      </div>

      {/* KPI Ribbon */}
      <div className={styles.deptKpiGrid}>
        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <CheckCircleIcon style={{ width: 16, height: 16, color: '#16a34a', display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Total Solved Tickets
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#16a34a' }}>
            {totalSolved}
          </div>
          <div className={styles.deptKpiSub}>
            Tickets fully resolved or closed by departments
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <InboxArrowDownIcon style={{ width: 16, height: 16, color: '#4338ca', display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Total Routed Workload
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#4338ca' }}>
            {totalWorkload}
          </div>
          <div className={styles.deptKpiSub}>
            All tickets routed directly to departments
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <ClockIcon style={{ width: 16, height: 16, color: '#ea580c', display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Active Workload Backlog
          </div>
          <div className={styles.deptKpiValue} style={{ color: '#ea580c' }}>
            {totalActiveBacklog}
          </div>
          <div className={styles.deptKpiSub}>
            Tickets currently open, pending, or in progress
          </div>
        </div>

        <div className={styles.deptKpiCard}>
          <div className={styles.deptKpiLabel}>
            <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#dc2626', display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Overdue Issues
          </div>
          <div className={styles.deptKpiValue} style={{ color: totalOverdue > 0 ? '#dc2626' : '#64748b' }}>
            {totalOverdue}
          </div>
          <div className={styles.deptKpiSub}>
            Tickets exceeding SLA due dates
          </div>
        </div>
      </div>

      {/* SLA Delivery Legend */}
      <div className={styles.volumeLegendStrip}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--analytics-trend-pos-color, #15803d)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#10b981' }} /> Solved Early (Ahead of SLA)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--analytics-badge-color, #1d4ed8)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#3b82f6' }} /> Solved On-Time
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
          <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#f59e0b' }} /> Solved Late (SLA Breached)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--analytics-trend-neg-color, #b91c1c)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#ef4444' }} /> Overdue Backlog
        </span>
      </div>

      {/* Comparative Dual Volume Rows (Never Overlaps) */}
      <div className={styles.deptRowList}>
        {!sortedDepts.length ? (
          <p className={styles.emptyState}>No workload records recorded</p>
        ) : (
          sortedDepts.map((dept) => {
            const activeBacklog = dept.openTickets + dept.inProgressTickets;
            const earlyWidth = maxVolume > 0 ? ((dept.earlyResolvedTickets ?? 0) / maxVolume) * 100 : 0;
            const onTimeWidth = maxVolume > 0 ? ((dept.onTimeResolvedTickets ?? 0) / maxVolume) * 100 : 0;
            const lateWidth = maxVolume > 0 ? ((dept.lateResolvedTickets ?? 0) / maxVolume) * 100 : 0;
            const totalPctOfMax = maxVolume > 0 ? (dept.totalTickets / maxVolume) * 100 : 0;

            return (
              <div key={dept.departmentId} className={styles.deptEfficiencyRow}>
                {/* Row Header */}
                <div className={styles.deptRowHeader}>
                  <div className={styles.deptRowNameGroup}>
                    <BuildingOffice2Icon style={{ width: 22, height: 22, color: '#2563eb', flexShrink: 0 }} />
                    <div>
                      <div className={styles.deptRowName}>{dept.departmentName}</div>
                      <div className={styles.deptRowMeta}>
                        Head: {dept.headName} - Code: {dept.departmentCode || 'DEPT'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.deptRowMetrics}>
                    {dept.totalTickets === 0 ? (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <span className={styles.tierDot} style={{ background: '#94a3b8' }} /> Inactive (No Workload)
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: activeBacklog > 0 ? '#fff7ed' : '#f1f5f9',
                          color: activeBacklog > 0 ? '#c2410c' : '#64748b',
                          border: '1px solid',
                          borderColor: activeBacklog > 0 ? '#ffedd5' : '#e2e8f0',
                        }}
                      >
                        {activeBacklog} Active Backlog ({dept.openTickets} open, {dept.inProgressTickets} in progress)
                      </span>
                    )}

                    {dept.overdueTickets > 0 && (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                        }}
                      >
                        <ExclamationTriangleIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {dept.overdueTickets} Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Dual Horizontal Volume Comparison Bars */}
                <div className={styles.volumeBarsContainer}>
                  {/* Bar 1: Stacked SLA Resolved Problems */}
                  <div className={styles.volumeBarRow}>
                    <span className={styles.volumeBarLabel} style={{ color: '#16a34a' }}>
                      Solved Delivery
                    </span>
                    <div className={styles.volumeBarMeter} style={{ display: 'flex', overflow: 'hidden', background: '#f1f5f9' }}>
                      {earlyWidth > 0 && (
                        <div
                          style={{
                            width: `${earlyWidth}%`,
                            height: '100%',
                            background: '#10b981',
                            transition: 'width 0.4s ease',
                          }}
                          title={`${dept.earlyResolvedTickets} Solved Early (Ahead of SLA)`}
                        />
                      )}
                      {onTimeWidth > 0 && (
                        <div
                          style={{
                            width: `${onTimeWidth}%`,
                            height: '100%',
                            background: '#3b82f6',
                            transition: 'width 0.4s ease',
                          }}
                          title={`${dept.onTimeResolvedTickets} Solved On-Time`}
                        />
                      )}
                      {lateWidth > 0 && (
                        <div
                          style={{
                            width: `${lateWidth}%`,
                            height: '100%',
                            background: '#f59e0b',
                            transition: 'width 0.4s ease',
                          }}
                          title={`${dept.lateResolvedTickets} Solved Late (SLA Breached)`}
                        />
                      )}
                    </div>
                    <span className={styles.volumeBarCount} style={{ color: '#15803d' }}>
                      {dept.resolvedTickets} Solved ({dept.earlyResolvedTickets ?? 0} early, {dept.onTimeResolvedTickets ?? 0} on-time, {dept.lateResolvedTickets ?? 0} late)
                    </span>
                  </div>

                  {/* Bar 2: Total Workload */}
                  <div className={styles.volumeBarRow}>
                    <span className={styles.volumeBarLabel} style={{ color: '#4338ca' }}>
                      Routed Workload
                    </span>
                    <div className={styles.volumeBarMeter}>
                      <div
                        style={{
                          width: `${Math.min(Math.max(totalPctOfMax, 0), 100)}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: 'linear-gradient(90deg, #6366f1 0%, #4338ca 100%)',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <span className={styles.volumeBarCount} style={{ color: '#3730a3' }}>
                      {dept.totalTickets} Routed ({activeBacklog} pending)
                    </span>
                  </div>
                </div>

                {/* Source volume breakdown */}
                <div className={styles.deptSubBreakdown}>
                  <span className={styles.deptSubPill}>
                    <strong>Routed to Department:</strong> {dept.assignedTickets ?? dept.totalTickets} tickets
                  </span>
                  <span className={styles.deptSubPill}>
                    <strong>Created by Department Staff:</strong> {dept.createdByTickets ?? 0} tickets
                  </span>
                  <span className={styles.deptSubPill}>
                    <strong>Overall Resolution Rate:</strong> {dept.resolutionRate}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CategoryRankedBarChart({
  categories,
  deptName,
}: {
  categories: AdminAnalyticsData['categoryBreakdown'];
  deptName?: string;
}) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const maxVal = useMemo(() => {
    if (!categories.length) return 10;
    return Math.max(...categories.map((c) => c.count), 5);
  }, [categories]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>
            <TagIcon style={{ width: 18, height: 18, color: '#3b82f6', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> {deptName ? `Category Issue Volume (${deptName})` : 'Category Issue Volume (Ranked Multi-Color Bars)'}
          </h3>
          <div className={styles.cardSubtitle}>
            {deptName ? `Tickets routed to ${deptName} completed within each category` : 'Top issue categories ranked with progressive rainbow gradient fills'}
          </div>
        </div>
        <span className={styles.badgePill}>{categories.length} Categories</span>
      </div>

      <div className={styles.horizontalBarList}>
        {!categories.length ? (
          <p className={styles.emptyState}>No category data found</p>
        ) : (
          categories.map((cat, i) => {
            const pct = maxVal > 0 ? (cat.count / maxVal) * 100 : 0;
            const grad = GRADIENTS[i % GRADIENTS.length];
            const isHovered = hoveredCategory === cat.categoryName;

            return (
              <div
                key={cat.categoryName}
                className={styles.horizontalBarItem}
                onMouseEnter={() => setHoveredCategory(cat.categoryName)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div className={styles.hBarMeta}>
                  <div className={styles.hBarTitle}>
                    <span
                      className={styles.hBarDot}
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span style={{ fontWeight: 700 }}>{cat.categoryName}</span>
                  </div>
                  <div className={styles.hBarStats}>
                    <span className={styles.hBarCount}>{cat.count} tickets</span>
                    <span className={styles.hBarPct}>({cat.resolved} solved - {cat.resolutionRate ?? (cat.count > 0 ? Math.round((cat.resolved / cat.count) * 100) : 0)}%)</span>
                  </div>
                </div>

                <div className={styles.hBarTrack}>
                  <div
                    className={styles.hBarFill}
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${grad[0]}, ${grad[1]})`,
                      filter: isHovered ? 'brightness(1.15)' : 'none',
                    }}
                  />
                </div>

                <div className={styles.categoryMetricsRow}>
                  <span className={styles.catMetricTag}>
                    <ShieldCheckIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3 }} /> SLA: {cat.slaComplianceRate ?? 100}%
                  </span>
                  {cat.overdue !== undefined && cat.overdue > 0 && (
                    <span className={styles.catMetricTag} style={{ background: '#fee2e2', color: '#b91c1c' }}>
                      <ExclamationTriangleIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3 }} /> {cat.overdue} Overdue
                    </span>
                  )}
                  {cat.avgHours !== undefined && cat.avgHours > 0 && (
                    <span className={styles.catMetricTag}>
                      <ClockIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3 }} /> {cat.avgHours}h Turnaround
                    </span>
                  )}
                  {cat.performanceScore !== undefined && (
                    <span
                      className={styles.catMetricTag}
                      style={{
                        background: cat.is100PercentQualified ? '#dcfce7' : '#eff6ff',
                        color: cat.is100PercentQualified ? '#15803d' : '#1d4ed8',
                        fontWeight: 700,
                      }}
                    >
                      {cat.is100PercentQualified ? '100% SLA Qualified' : `Perf: ${cat.performanceScore}%`}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export interface ProfessionalAnalyticsProps {
  title?: string;
  description?: string;
  badgeText?: string;
  isCeoView?: boolean;
  isManagerView?: boolean;
}

// ---- Main Admin / Executive Analytics Page ----------------------------------------------------------------------
export default function AdminAnalytics({
  title,
  description,
  badgeText,
  isCeoView = false,
  isManagerView = false,
}: ProfessionalAnalyticsProps = {}) {
  const { user } = useAuth();
  const isManager = isManagerView || user?.role === 'manager';
  const [timeframe, setTimeframe] = useState<string>('6m');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [trendTab, setTrendTab] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [distributionTab, setDistributionTab] = useState<'priority' | 'department' | 'category'>('priority');
  const [deptTableSort, setDeptTableSort] = useState<'score' | 'name' | 'assigned' | 'created' | 'total' | 'resolved' | 'rate' | 'sla' | 'time'>('score');
  const [deptTableSortAsc, setDeptTableSortAsc] = useState<boolean>(false);

  const managerDept = data?.departmentAnalytics?.[0];
  const pageTitle = title || (isManager && managerDept ? `${managerDept.departmentName} Performance Analytics` : isManager ? 'Department Performance Analytics' : 'Ticket Analytics & Intelligence');
  const pageDescription = description || (isManager ? 'Department-scoped ticket solving performance, SLA compliance, turnaround speed, and category breakdown.' : 'Interactive multi-color bar charts, pie/donut charts, monthly trends, and department workloads.');
  const pageBadge = badgeText || (isManager ? (managerDept?.departmentCode ? `${managerDept.departmentCode} Department` : 'Department Head Scope') : undefined);

  const sortedTableDepts = useMemo(() => {
    if (!data?.departmentAnalytics) return [];
    const list = [...data.departmentAnalytics];
    return list.sort((a, b) => {
      let diff = 0;
      if (deptTableSort === 'score') diff = (a.performanceScore ?? a.resolutionRate) - (b.performanceScore ?? b.resolutionRate);
      else if (deptTableSort === 'name') diff = a.departmentName.localeCompare(b.departmentName);
      else if (deptTableSort === 'assigned') diff = (a.assignedTickets ?? a.totalTickets) - (b.assignedTickets ?? b.totalTickets);
      else if (deptTableSort === 'created') diff = (a.createdByTickets ?? 0) - (b.createdByTickets ?? 0);
      else if (deptTableSort === 'total') diff = a.totalTickets - b.totalTickets;
      else if (deptTableSort === 'resolved') diff = a.resolvedTickets - b.resolvedTickets;
      else if (deptTableSort === 'rate') diff = a.resolutionRate - b.resolutionRate;
      else if (deptTableSort === 'sla') diff = a.slaComplianceRate - b.slaComplianceRate;
      else if (deptTableSort === 'time') diff = a.avgResolutionHours - b.avgResolutionHours;
      return deptTableSortAsc ? diff : -diff;
    });
  }, [data?.departmentAnalytics, deptTableSort, deptTableSortAsc]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchFn = isManager ? fetchManagerAnalytics : fetchAdminAnalytics;
      const res = await fetchFn({
        timeframe,
        departmentId: departmentId === 'all' ? undefined : departmentId,
      });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError('Failed to fetch analytics data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error connecting to analytics server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [timeframe, departmentId, user]);

  // Formatted data items for Pie & Donut Charts
  const statusChartItems = useMemo<ChartSliceItem[]>(() => {
    if (!data?.statusBreakdown) return [];
    const usedColors = new Set<string>();

    return data.statusBreakdown.map((sb, idx) => {
      // 1. Direct status color lookup
      let color = STATUS_COLORS[sb.status];

      // 2. Dotted sub-status lookup
      if (!color && sb.status.startsWith('escalated.')) {
        const sub = sb.status.replace('escalated.', '');
        const SUB_COLORS: Record<string, string> = {
          waiting_tenant: '#ec4899', // Hot Pink
          assigned: '#8b5cf6',       // Purple / Violet
          in_progress: '#f97316',    // Bright Orange
          open: '#f43f5e',           // Rose Red
          pending: '#ea580c',        // Deep Amber
          under_review: '#a855f7',   // Deep Purple
          waiting_vendor: '#6366f1', // Indigo
        };
        color = SUB_COLORS[sub];
      }

      // 3. Fallback or conflict resolution: ensure every slice receives a UNIQUE vibrant color!
      if (!color || usedColors.has(color)) {
        const nextAvailable = DISTINCT_PIE_COLORS.find((c) => !usedColors.has(c));
        color = nextAvailable || DISTINCT_PIE_COLORS[idx % DISTINCT_PIE_COLORS.length];
      }

      usedColors.add(color);

      return {
        id: sb.status,
        label: STATUS_LABELS[sb.status as TicketStatus] || sb.status.replace(/_/g, ' '),
        value: sb.count,
        color,
      };
    });
  }, [data?.statusBreakdown]);

  const priorityChartItems = useMemo<ChartSliceItem[]>(() => {
    if (!data?.priorityDistribution) return [];
    return data.priorityDistribution.map((p) => ({
      id: p.priority,
      label: `${p.priority} priority`,
      value: p.count,
      color: PRIORITY_COLORS[p.priority] || '#3b82f6',
    }));
  }, [data?.priorityDistribution]);

  const departmentChartItems = useMemo<ChartSliceItem[]>(() => {
    if (!data?.departmentAnalytics) return [];
    return data.departmentAnalytics.map((dept, i) => ({
      id: dept.departmentId,
      label: dept.departmentName,
      value: dept.totalTickets,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [data?.departmentAnalytics]);

  const categoryChartItems = useMemo<ChartSliceItem[]>(() => {
    if (!data?.categoryBreakdown) return [];
    return data.categoryBreakdown
      .filter((c) => Number(c.count || 0) > 0)
      .map((c, i) => ({
        id: c.categoryName,
        label: c.categoryName,
        value: c.count,
        color: PALETTE[(i + 3) % PALETTE.length],
      }));
  }, [data?.categoryBreakdown]);

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (!data) return;
    setIsExportingExcel(true);
    try {
      const selectedDeptObj = data.departmentAnalytics?.find((d) => d.departmentId === departmentId);
      const deptName = isManager
        ? (managerDept?.departmentName || 'Department')
        : (selectedDeptObj ? selectedDeptObj.departmentName : 'All Departments');
      await exportAnalyticsToExcel(data, timeframe, deptName);
    } catch (err) {
      console.error('[AdminAnalytics] Professional Excel export error:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const [isCsvMenuOpen, setIsCsvMenuOpen] = useState(false);
  const csvMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (csvMenuRef.current && !csvMenuRef.current.contains(event.target as Node)) {
        setIsCsvMenuOpen(false);
      }
    };
    if (isCsvMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCsvMenuOpen]);

  const exportCSV = (type: 'master' | 'department' | 'trends' | 'categories' = 'master') => {
    if (!data) return;
    const selectedDeptObj = data.departmentAnalytics?.find((d) => d.departmentId === departmentId);
    const deptName = isManager
      ? (managerDept?.departmentName || 'Department')
      : (departmentId === 'all' ? 'All Departments' : selectedDeptObj?.departmentName || departmentId);

    switch (type) {
      case 'department':
        exportDepartmentPerformanceCSV(data.departmentAnalytics, timeframe);
        break;
      case 'trends':
        exportMonthlyTrendsCSV(data.monthlyTrends, timeframe);
        break;
      case 'categories':
        exportCategoryAndStatusCSV(data.categoryBreakdown, data.statusBreakdown, timeframe);
        break;
      case 'master':
      default:
        exportMasterAnalyticsCSV(data, timeframe, deptName);
        break;
    }
  };

  return (
    <div className={styles.page}>
      {/* ---- Printable Header (Only rendered when printing / saving as PDF) ---- */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div>
            <h1 className={styles.printTitle}>
              {isManager && managerDept
                ? `${managerDept.departmentName} - Department Performance Analytics`
                : 'Help Desk Management System - Executive Analytics'}
            </h1>
            <p className={styles.printSubtitle}>
              Generated On: <strong>{new Date().toLocaleString()}</strong> | Scope: <strong>{isManager ? `${managerDept?.departmentName || 'Department'} Performance Scope` : isCeoView ? 'Executive CEO Suite' : 'Enterprise Administration'}</strong>
            </p>
          </div>
          <div className={styles.printBadge}>
            {isManager ? 'CONFIDENTIAL DEPARTMENT METRICS' : 'CONFIDENTIAL & EXECUTIVE METRICS'}
          </div>
        </div>
        {data && (
          <div className={styles.printFilterBar}>
            <span>Period: <strong>{timeframe.toUpperCase()}</strong></span>
            <span>Department Scope: <strong>{isManager && managerDept ? managerDept.departmentName : (departmentId === 'all' ? 'All Departments' : data.departmentAnalytics.find(d => d.departmentId === departmentId)?.departmentName || departmentId)}</strong></span>
            <span>Total Tickets: <strong>{data.kpis.totalTickets}</strong></span>
            <span>Resolution Rate: <strong>{data.kpis.resolutionRate}%</strong></span>
            <span>SLA Compliance: <strong>{data.kpis.slaComplianceRate}%</strong></span>
          </div>
        )}
      </div>

      {/* ---- Top Header & Controls -------------------------------------------------------------------------------------- */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>
              <ChartBarIcon style={{ width: 28, height: 28, color: '#2563eb', display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> {pageTitle}
            </h1>
            {pageBadge && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  color: '#ffffff',
                  boxShadow: '0 2px 6px rgba(180, 83, 9, 0.25)',
                }}
              >
                {pageBadge}
              </span>
            )}
          </div>
          <p>{pageDescription}</p>
        </div>

        <div className={styles.controlsGroup}>
          {/* Timeframe Presets */}
          <div className={styles.timeframeSelector}>
            {[
              { label: '7 Days', val: '7d' },
              { label: '30 Days', val: '30d' },
              { label: '90 Days', val: '90d' },
              { label: '6 Months', val: '6m' },
              { label: '12 Months', val: '12m' },
              { label: 'All', val: 'all' },
            ].map((t) => (
              <button
                key={t.val}
                type="button"
                className={`${styles.timeframeBtn} ${timeframe === t.val ? styles.active : ''}`}
                onClick={() => setTimeframe(t.val)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Department Filter / Manager Locked Scope */}
          {isManager && data?.departmentAnalytics && data.departmentAnalytics.length <= 1 ? (
            <div className={styles.deptScopeBadge} title="Your analytics are scoped strictly to your managed department">
              <BuildingOffice2Icon className={styles.deptScopeIcon} />
              <span>Department: <strong>{data.departmentAnalytics[0]?.departmentName || 'My Department'}</strong></span>
              {data.departmentAnalytics[0]?.departmentCode && (
                <span className={styles.deptCodeTag} style={{ marginLeft: 6 }}>{data.departmentAnalytics[0].departmentCode}</span>
              )}
            </div>
          ) : data?.departmentAnalytics && data.departmentAnalytics.length > 0 ? (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={styles.selectInput}
              aria-label="Filter by department"
            >
              {!isManager && <option value="all">All Departments</option>}
              {data.departmentAnalytics.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
          ) : null}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={loadAnalytics}
            className={styles.actionBtn}
            title="Refresh analytics data"
          >
            <ArrowPathIcon className={styles.btnIcon} /> Refresh
          </button>

          {/* Print / PDF Visual Report Action */}
          <button
            type="button"
            onClick={handlePrint}
            className={styles.actionBtn}
            title="Print interactive report or save as PDF"
            disabled={!data}
          >
            <PrinterIcon className={styles.btnIcon} /> Print / PDF
          </button>

          {/* Professional Excel (.xlsx) Export Action */}
          <button
            type="button"
            onClick={handleExportExcel}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            title="Export executive Excel spreadsheet (.xlsx) with auto-enlarged columns and formatted sheets"
            disabled={!data || isExportingExcel}
          >
            <TableCellsIcon className={styles.btnIcon} /> {isExportingExcel ? 'Generating...' : 'Export Excel (.xlsx)'}
          </button>

          {/* Professional CSV Export Action (Split Button with Menu) */}
          <div className={styles.csvDropdownContainer} ref={csvMenuRef}>
            <div className={styles.csvSplitBtn}>
              <button
                type="button"
                onClick={() => exportCSV('master')}
                className={styles.csvMainBtn}
                title="Export complete unified master CSV ledger with auto-aligned columns"
                disabled={!data}
              >
                <ArrowDownTrayIcon className={styles.btnIcon} /> CSV
              </button>
              <button
                type="button"
                onClick={() => setIsCsvMenuOpen((prev) => !prev)}
                className={styles.csvChevronBtn}
                title="Choose specific CSV dataset to export"
                disabled={!data}
                aria-label="CSV export options"
              >
                <ChevronDownIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {isCsvMenuOpen && data && (
              <div className={styles.csvDropdownMenu}>
                <div className={styles.csvDropdownHeader}>Executive Excel (.xlsx)</div>
                <button
                  type="button"
                  className={styles.csvDropdownItem}
                  onClick={() => {
                    handleExportExcel();
                    setIsCsvMenuOpen(false);
                  }}
                  disabled={isExportingExcel}
                >
                  <div style={{ fontWeight: 600, color: '#1e40af' }}><TableCellsIcon style={{ width: 16, height: 16, color: '#1e40af', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Executive Master Ledger (.xlsx)</div>
                  <div className={styles.csvDropdownSub}>Professional 5-tab workbook with auto-enlarged columns & styled headers</div>
                </button>

                <div className={styles.csvDropdownHeader} style={{ marginTop: 6 }}>Raw CSV Data Exports (.csv)</div>

                <button
                  type="button"
                  className={styles.csvDropdownItem}
                  onClick={() => {
                    exportCSV('master');
                    setIsCsvMenuOpen(false);
                  }}
                >
                  <div><ArrowDownTrayIcon style={{ width: 16, height: 16, color: '#2563eb', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Complete Master Analytics Ledger (.csv)</div>
                  <div className={styles.csvDropdownSub}>All 18 columns unified with single-cell title banner</div>
                </button>

                <button
                  type="button"
                  className={styles.csvDropdownItem}
                  onClick={() => {
                    exportCSV('department');
                    setIsCsvMenuOpen(false);
                  }}
                >
                  <div><BuildingOffice2Icon style={{ width: 16, height: 16, color: '#16a34a', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Department Performance Matrix (.csv)</div>
                  <div className={styles.csvDropdownSub}>Detailed workload, solving rates & SLA stats</div>
                </button>

                <button
                  type="button"
                  className={styles.csvDropdownItem}
                  onClick={() => {
                    exportCSV('trends');
                    setIsCsvMenuOpen(false);
                  }}
                >
                  <div><ChartBarIcon style={{ width: 16, height: 16, color: '#ea580c', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Monthly Ticket Inflow & Trends (.csv)</div>
                  <div className={styles.csvDropdownSub}>Historical velocity, created vs. resolved</div>
                </button>

                <button
                  type="button"
                  className={styles.csvDropdownItem}
                  onClick={() => {
                    exportCSV('categories');
                    setIsCsvMenuOpen(false);
                  }}
                >
                  <div><TagIcon style={{ width: 16, height: 16, color: '#8b5cf6', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Category & Status Lifecycle (.csv)</div>
                  <div className={styles.csvDropdownSub}>Problem category share and status workflow</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--analytics-trend-neg-bg, #fee2e2)', color: 'var(--analytics-trend-neg-color, #991b1b)', border: '1px solid', borderColor: 'var(--analytics-trend-neg-bg, #fecaca)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#dc2626', flexShrink: 0 }} /> {error}
        </div>
      )}

      {loading && !data ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Compiling analytics charts and metrics...</p>
        </div>
      ) : data ? (
        <>
          {/* ---- KPI Metric Scorecards -------------------------------------------------------------------------------- */}
          <div className={styles.kpiGrid}>
            {/* Total Tickets Created */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={`${styles.kpiIconBox} ${styles.kpiIconBlue}`}>
                  <TicketIcon style={{ width: 22, height: 22 }} />
                </div>
                <div
                  className={`${styles.kpiTrendBadge} ${
                    data.kpis.monthGrowthPercent > 0
                      ? styles.trendPositive
                      : data.kpis.monthGrowthPercent < 0
                      ? styles.trendNegative
                      : styles.trendNeutral
                  }`}
                >
                  {data.kpis.monthGrowthPercent >= 0 ? (
                    <ArrowTrendingUpIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                  ) : (
                    <ArrowTrendingDownIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                  )}
                  {Math.abs(data.kpis.monthGrowthPercent)}% MoM
                </div>
              </div>
              <div>
                <div className={styles.kpiValue}>{data.kpis.totalTickets.toLocaleString()}</div>
                <div className={styles.kpiLabel}>Total Tickets Created</div>
                <div className={styles.kpiSubtext}>
                  {data.kpis.currentMonthCount} this month vs {data.kpis.previousMonthCount} last month
                </div>
              </div>
            </div>

            {/* Resolution Rate */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={`${styles.kpiIconBox} ${styles.kpiIconGreen}`}>
                  <CheckCircleIcon style={{ width: 22, height: 22 }} />
                </div>
                <div className={`${styles.kpiTrendBadge} ${styles.trendPositive}`}>
                  {data.kpis.resolvedTickets} Resolved
                </div>
              </div>
              <div>
                <div className={styles.kpiValue}>{data.kpis.resolutionRate}%</div>
                <div className={styles.kpiLabel}>Resolution Rate</div>
                <div className={styles.kpiSubtext}>
                  {data.kpis.resolvedTickets} of {data.kpis.totalTickets} total closed
                </div>
              </div>
            </div>

            {/* Active Backlog */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={`${styles.kpiIconBox} ${styles.kpiIconAmber}`}>
                  <ClockIcon style={{ width: 22, height: 22 }} />
                </div>
                <div className={`${styles.kpiTrendBadge} ${styles.trendNeutral}`}>
                  {data.kpis.inProgressTickets} In Progress
                </div>
              </div>
              <div>
                <div className={styles.kpiValue}>
                  {(data.kpis.openTickets + data.kpis.inProgressTickets).toLocaleString()}
                </div>
                <div className={styles.kpiLabel}>Active Ticket Backlog</div>
                <div className={styles.kpiSubtext}>
                  {data.kpis.openTickets} pending assignment / review
                </div>
              </div>
            </div>

            {/* SLA Compliance */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={`${styles.kpiIconBox} ${styles.kpiIconPurple}`}>
                  <ShieldCheckIcon style={{ width: 22, height: 22 }} />
                </div>
                <div
                  className={`${styles.kpiTrendBadge} ${
                    data.kpis.overdueTickets > 0 ? styles.trendNegative : styles.trendPositive
                  }`}
                >
                  {data.kpis.overdueTickets} Overdue
                </div>
              </div>
              <div>
                <div className={styles.kpiValue}>{data.kpis.slaComplianceRate}%</div>
                <div className={styles.kpiLabel}>SLA Compliance Rate</div>
                <div className={styles.kpiSubtext}>
                  {data.kpis.overdueRate}% overdue tickets in period
                </div>
              </div>
            </div>

            {/* Average Resolution Time */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={`${styles.kpiIconBox} ${styles.kpiIconRose}`}>
                  <BoltIcon style={{ width: 22, height: 22 }} />
                </div>
                <div className={`${styles.kpiTrendBadge} ${styles.trendNeutral}`}>
                  Avg Response: {data.kpis.avgFirstResponseHours}h
                </div>
              </div>
              <div>
                <div className={styles.kpiValue}>{data.kpis.avgResolutionHours} hrs</div>
                <div className={styles.kpiLabel}>Avg Resolution Time</div>
                <div className={styles.kpiSubtext}>From ticket submission to final resolve</div>
              </div>
            </div>
          </div>

          {/* ---- Monthly & Weekly Trends Graph (With Bar Chart + Curve Toggle) ---- */}
          <MonthlyTrendGraph
            monthlyData={data.monthlyTrends}
            weeklyData={data.weeklyTrends}
            dailyData={data.dailyTrends}
            activeTab={trendTab}
            onTabChange={setTrendTab}
          />

          {/* -- Professional Department Problem Solving & Resolution Performance Suite --─ */}
          {/* -- Top Performing Departments Leaderboard & Which Department is Performing Well --─ */}
          <DepartmentPerformanceLeaderboard departments={data.departmentAnalytics} isManager={isManager} />

          {/* -- 1. Department Problem-Solving Efficiency (Percentage) --─ */}
          <DepartmentEfficiencyChart departments={data.departmentAnalytics} isManager={isManager} />

          {/* -- 2. Department Solved Tickets vs Total Workload (Volume) --─ */}
          <DepartmentSolvedVolumeChart departments={data.departmentAnalytics} isManager={isManager} />

          {/* -- Ranked Category Bar Chart & Status Lifecycle Breakdown --─ */}
          <div className={styles.twoColGrid}>
            <CategoryRankedBarChart
              categories={data.categoryBreakdown}
              deptName={isManager && managerDept ? managerDept.departmentName : undefined}
            />
            <InteractivePieChart
              title={isManager && managerDept ? `Ticket Status Breakdown (${managerDept.departmentName})` : "Ticket Status Breakdown"}
              subtitle={isManager && managerDept ? `Lifecycle distribution of tickets routed to ${managerDept.departmentName}` : "Distribution of tickets across all lifecycle stages"}
              items={statusChartItems}
              totalLabel="Total Statuses"
              defaultMode="donut"
            />
          </div>

            {/* Priority & Department Distribution Chart */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className={distributionTab === 'priority' ? 'analytics-dist-tab-active' : 'analytics-dist-tab-inactive'}
                    style={{
                      padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                      transition: 'all 0.15s', cursor: 'pointer',
                      border: distributionTab === 'priority' ? 'none' : '1px solid',
                      background: distributionTab === 'priority' ? '#2563eb' : undefined,
                      color: distributionTab === 'priority' ? '#ffffff' : undefined,
                      boxShadow: distributionTab === 'priority' ? '0 2px 8px rgba(37,99,235,0.3)' : undefined,
                    }}
                    onClick={() => setDistributionTab('priority')}
                  >
                    <BoltIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> By Priority
                  </button>
                  {!isManager && (
                    <button
                      type="button"
                      className={distributionTab === 'department' ? 'analytics-dist-tab-active' : 'analytics-dist-tab-inactive'}
                      style={{
                        padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        transition: 'all 0.15s', cursor: 'pointer',
                        border: distributionTab === 'department' ? 'none' : '1px solid',
                        background: distributionTab === 'department' ? '#2563eb' : undefined,
                        color: distributionTab === 'department' ? '#ffffff' : undefined,
                        boxShadow: distributionTab === 'department' ? '0 2px 8px rgba(37,99,235,0.3)' : undefined,
                      }}
                      onClick={() => setDistributionTab('department')}
                    >
                      <BuildingOffice2Icon style={{ width: 13, height: 13, display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> By Department Share
                    </button>
                  )}
                  <button
                    type="button"
                    className={distributionTab === 'category' ? 'analytics-dist-tab-active' : 'analytics-dist-tab-inactive'}
                    style={{
                      padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                      transition: 'all 0.15s', cursor: 'pointer',
                      border: distributionTab === 'category' ? 'none' : '1px solid',
                      background: distributionTab === 'category' ? '#2563eb' : undefined,
                      color: distributionTab === 'category' ? '#ffffff' : undefined,
                      boxShadow: distributionTab === 'category' ? '0 2px 8px rgba(37,99,235,0.3)' : undefined,
                    }}
                    onClick={() => setDistributionTab('category')}
                  >
                    <TagIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> By Category
                  </button>
                </div>
              </div>

              {distributionTab === 'priority' ? (
                <InteractivePieChart
                  title="Priority Distribution"
                  subtitle="Volume and urgency allocation across priorities"
                  items={priorityChartItems}
                  totalLabel="Priority Total"
                  defaultMode="pie"
                />
              ) : distributionTab === 'department' && !isManager ? (
                <InteractivePieChart
                  title="Department Ticket Share"
                  subtitle="Proportion of tickets submitted per department"
                  items={departmentChartItems}
                  totalLabel="Dept Share"
                  defaultMode="donut"
                />
              ) : (
                <InteractivePieChart
                  title="Category Distribution"
                  subtitle="Ticket volume across created ticket categories"
                  items={categoryChartItems}
                  totalLabel="Category Total"
                  defaultMode="pie"
                />
              )}
            </div>

          {/* ---- Department Performance Matrix ---------------------------------------------------------------- */}
          <div className={styles.chartCard}>
            <div className={styles.cardHeader} style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className={styles.cardTitle}>
                  <BuildingOffice2Icon style={{ width: 20, height: 20, color: '#2563eb', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  {isManager ? 'Department Performance Audit Ledger' : 'Department Performance & Problem Solving Matrix'}
                </h3>
                <div className={styles.cardSubtitle}>
                  {isManager && managerDept
                    ? `Audit records and strict SLA compliance metrics for ${managerDept.departmentName} (${managerDept.departmentCode || 'DEPT'})`
                    : 'Detailed breakdown of tickets routed/assigned to each department vs created by their team, with resolution percentage rankings'}
                </div>
              </div>
              <span className={styles.badgePill}>
                {isManager ? '1 Department Scoped' : `${data.departmentAnalytics.length} Departments`}
              </span>
            </div>

            <div className={styles.tableScrollContainer}>
              <table className={styles.deptTable}>
                <thead>
                  <tr>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('name'); setDeptTableSortAsc(deptTableSort === 'name' ? !deptTableSortAsc : true); }}>
                      Department <span className={styles.sortIcon}>{deptTableSort === 'name' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('score'); setDeptTableSortAsc(deptTableSort === 'score' ? !deptTableSortAsc : false); }}>
                      Performance Score <span className={styles.sortIcon}>{deptTableSort === 'score' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('assigned'); setDeptTableSortAsc(deptTableSort === 'assigned' ? !deptTableSortAsc : false); }}>
                      Routed / Assigned <span className={styles.sortIcon}>{deptTableSort === 'assigned' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('created'); setDeptTableSortAsc(deptTableSort === 'created' ? !deptTableSortAsc : false); }}>
                      Created by Team <span className={styles.sortIcon}>{deptTableSort === 'created' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('total'); setDeptTableSortAsc(deptTableSort === 'total' ? !deptTableSortAsc : false); }}>
                      Total Problems <span className={styles.sortIcon}>{deptTableSort === 'total' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('resolved'); setDeptTableSortAsc(deptTableSort === 'resolved' ? !deptTableSortAsc : false); }}>
                      Solved <span className={styles.sortIcon}>{deptTableSort === 'resolved' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('rate'); setDeptTableSortAsc(deptTableSort === 'rate' ? !deptTableSortAsc : false); }}>
                      Solving Rate (%) <span className={styles.sortIcon}>{deptTableSort === 'rate' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th>Open</th>
                    <th>In Progress</th>
                    <th>Overdue</th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('sla'); setDeptTableSortAsc(deptTableSort === 'sla' ? !deptTableSortAsc : false); }}>
                      SLA % <span className={styles.sortIcon}>{deptTableSort === 'sla' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                    <th className={styles.thSortable} onClick={() => { setDeptTableSort('time'); setDeptTableSortAsc(deptTableSort === 'time' ? !deptTableSortAsc : true); }}>
                      Turnaround <span className={styles.sortIcon}>{deptTableSort === 'time' ? (deptTableSortAsc ? '▲' : '▼') : '↕'}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!sortedTableDepts.length ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyState}>
                        No department problem resolution records found
                      </td>
                    </tr>
                  ) : (
                    sortedTableDepts.map((dept) => {
                      const assignedTot = dept.assignedTickets ?? dept.totalTickets;
                      const assignedRes = dept.assignedResolvedTickets ?? dept.resolvedTickets;
                      const assignedPct = dept.assignedResolutionRate ?? dept.resolutionRate;

                      const createdTot = dept.createdByTickets ?? 0;
                      const createdRes = dept.createdByResolvedTickets ?? 0;
                      const createdPct = dept.createdByResolutionRate ?? 0;

                      return (
                        <tr key={dept.departmentId}>
                          {/* Department Name & Head */}
                          <td>
                            <div className={styles.deptNameCell}>{dept.departmentName}</div>
                            <div className={styles.deptHead}>
                              {dept.departmentCode ? `${dept.departmentCode} - ` : ''}Head: {dept.headName}
                            </div>
                          </td>

                          {/* Composite Performance Score (Strict SLA) */}
                          <td>
                            {dept.is100PercentQualified ? (
                              <span className={`${styles.complianceCheckPill} ${styles.pillFlawless}`}>
                                <TrophyIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> 100% SLA Qualified
                              </span>
                            ) : (
                              <span
                                className={`${styles.complianceCheckPill} ${styles.pillCapped}`}
                                title={dept.performanceReasons?.join(', ')}
                              >
                                {dept.performanceScore ?? dept.resolutionRate}%
                              </span>
                            )}
                          </td>

                          {/* Routed / Assigned */}
                          <td>
                            <div className={styles.deptTableDetailCell}>
                              <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{assignedTot}</strong>
                              <span className={styles.deptTableSubText}>
                                {assignedRes} solved ({assignedPct}%)
                              </span>
                            </div>
                          </td>

                          {/* Created by Team */}
                          <td>
                            <div className={styles.deptTableDetailCell}>
                              <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{createdTot}</strong>
                              <span className={styles.deptTableSubText}>
                                {createdRes} solved ({createdPct}%)
                              </span>
                            </div>
                          </td>

                          {/* Total Problems */}
                          <td>
                            <strong className="analytics-table-strong" style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 700, fontSize: '0.9rem' }}>
                              {dept.totalTickets}
                            </strong>
                          </td>

                          {/* Solved Problems */}
                          <td>
                            <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', background: 'var(--analytics-trend-pos-bg, #dcfce7)', color: 'var(--analytics-trend-pos-color, #166534)', fontWeight: 700 }}>
                              {dept.resolvedTickets}
                            </span>
                          </td>

                          {/* Solving Percentage Progress Bar + Tier Badge */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                              <div className={styles.progressBarBox}>
                                <div className={styles.progressTrack}>
                                  <div
                                    className={styles.progressFill}
                                    style={{
                                      width: `${dept.resolutionRate}%`,
                                      background:
                                        dept.resolutionRate >= 80
                                          ? 'linear-gradient(90deg, #10b981, #059669)'
                                          : dept.resolutionRate >= 65
                                          ? 'linear-gradient(90deg, #3b82f6, #1d4ed8)'
                                          : dept.resolutionRate >= 50
                                          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                          : 'linear-gradient(90deg, #ef4444, #dc2626)',
                                    }}
                                  />
                                </div>
                                <span className="analytics-table-strong" style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '42px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                                  {dept.resolutionRate}%
                                </span>
                              </div>
                              <span
                                className={`${styles.tierBadge} ${
                                  dept.resolutionRate >= 80
                                    ? styles.tierElite
                                    : dept.resolutionRate >= 65
                                    ? styles.tierGood
                                    : dept.resolutionRate >= 50
                                    ? styles.tierModerate
                                    : styles.tierWarn
                                }`}
                                style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '1px 6px' }}
                              >
                                {dept.resolutionRate >= 80 ? 'Elite' : dept.resolutionRate >= 65 ? 'High' : dept.resolutionRate >= 50 ? 'Moderate' : 'Attention'}
                              </span>
                            </div>
                          </td>

                          {/* Open / Pending */}
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', background: 'var(--analytics-trend-neutral-bg, #fef3c7)', color: '#b45309', fontWeight: 600 }}>
                              {dept.openTickets}
                            </span>
                          </td>

                          {/* In Progress */}
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', background: 'var(--analytics-badge-bg, #eff6ff)', color: '#1d4ed8', fontWeight: 600 }}>
                              {dept.inProgressTickets}
                            </span>
                          </td>

                          {/* Overdue */}
                          <td>
                            <span
                              style={{
                                padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: dept.overdueTickets > 0 ? 700 : 500,
                                background: dept.overdueTickets > 0 ? 'var(--analytics-trend-neg-bg, #fee2e2)' : 'var(--bg-surface, #f1f5f9)',
                                color: dept.overdueTickets > 0 ? 'var(--analytics-trend-neg-color, #991b1b)' : 'var(--text-muted, #64748b)',
                              }}
                            >
                              {dept.overdueTickets}
                            </span>
                          </td>

                          {/* SLA Compliance */}
                          <td>
                            <div className={styles.progressBarBox} style={{ minWidth: '90px' }}>
                              <div className={styles.progressTrack} style={{ minWidth: '40px' }}>
                                <div
                                  className={styles.progressFill}
                                  style={{
                                    width: `${dept.slaComplianceRate}%`,
                                    background:
                                      dept.slaComplianceRate >= 90
                                        ? '#10b981'
                                        : dept.slaComplianceRate >= 75
                                        ? '#f59e0b'
                                        : '#ef4444',
                                  }}
                                />
                              </div>
                              <span className="analytics-table-strong" style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '38px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                                {dept.slaComplianceRate}%
                              </span>
                            </div>
                          </td>

                          {/* Avg Resolution Hours */}
                          <td>
                            <span className="analytics-table-strong" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>
                              {dept.avgResolutionHours}h
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
