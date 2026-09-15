import { useEffect, useState, useMemo } from 'react';
import { fetchAdminAnalytics } from '../../api/dashboardApi';
import type { AdminAnalyticsData } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import styles from './AdminAnalytics.module.css';

// ── Color Palettes ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  submitted: '#3b82f6',
  open: '#2563eb',
  assigned: '#6366f1',
  assigned_department: '#818cf8',
  assigned_staff: '#06b6d4',
  under_review: '#a855f7',
  in_progress: '#f59e0b',
  pending: '#d97706',
  pending_approval: '#ea580c',
  waiting_tenant: '#ec4899',
  waiting_vendor: '#8b5cf6',
  resolved: '#10b981',
  closed: '#64748b',
  reopened: '#f97316',
  escalated: '#ef4444',
  rejected: '#dc2626',
  cancelled: '#94a3b8',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
  '#84cc16', '#0284c7', '#d946ef', '#f43f5e', '#64748b'
];

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

// ── Pie & Donut Chart Component ───────────────────────────────────────────────
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
            <span>{chartMode === 'pie' ? '🥧' : '🍩'}</span> {title}
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
              🍩 Donut
            </button>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${chartMode === 'pie' ? styles.active : ''}`}
              onClick={() => setChartMode('pie')}
              title="Switch to Solid Pie view"
            >
              🥧 Pie
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
            ✕ Reset Focus
          </button>
        </div>
      )}


      <div className={styles.pieChartCardBody}>
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
          {!items.length || total === 0 ? (
            <p className={styles.emptyState}>No distribution records found</p>
          ) : (
            items.map((item, idx) => {
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
                    <span className="truncate max-w-[130px]">{item.label}</span>
                  </div>
                  <div className={styles.legendRight}>
                    <span className={styles.legendCount}>{item.value.toLocaleString()}</span>
                    <span className={styles.legendPct}>{pct}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Professional Monthly & Weekly Trends Graph Component (Curve + Bar Chart) ─
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
  const svgHeight = 280;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 30;
  const padBottom = 40;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  const maxVal = useMemo(() => {
    const vals = activeDataset.map((d) => Math.max(d.created, d.resolved));
    return Math.max(...vals, 5);
  }, [activeDataset]);

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
            <span>{graphType === 'bar' ? '📊' : '📈'}</span> Monthly & Weekly Ticket Trends
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
              📊 Bar Chart
            </button>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${graphType === 'curve' ? styles.active : ''}`}
              onClick={() => setGraphType('curve')}
              title="Smooth Curve Area Graph"
            >
              📈 Curve Graph
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
            <span className={styles.trendStatVal} style={{ color: '#0f172a' }}>
              {totalCreated > 0 ? ((totalResolved / totalCreated) * 100).toFixed(1) : '100'}%
            </span>
          </div>
          <div className={styles.trendStatItem}>
            <span className={styles.trendStatLabel}>Data Points</span>
            <span className={styles.trendStatVal} style={{ color: '#64748b' }}>
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
              <span>Tickets Created {showCreated ? '✓' : ''}</span>
            </button>

            <button
              type="button"
              className={`${styles.metricChip} ${showResolved ? styles.activeResolved : ''}`}
              onClick={() => setShowResolved((prev) => !prev || !showCreated)}
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>Tickets Resolved {showResolved ? '✓' : ''}</span>
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
                  <strong>{hoveredPoint.created.toLocaleString()}</strong>
                </div>
              )}
              {showResolved && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', color: '#6ee7b7' }}>
                  <span>Resolved:</span>
                  <strong>{hoveredPoint.resolved.toLocaleString()}</strong>
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
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + graphH * (1 - ratio);
              const val = Math.round(maxVal * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    className={styles.gridLine}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className={styles.axisText}
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* X Axis Base Line */}
            <line
              x1={padLeft}
              y1={padTop + graphH}
              x2={svgWidth - padRight}
              y2={padTop + graphH}
              className={styles.axisLine}
            />

            {/* ── BAR CHART MODE ── */}
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
                    {showCreated && (
                      <rect
                        x={
                          showResolved
                            ? slotCenterX - singleBarWidth - 2
                            : slotCenterX - singleBarWidth / 2
                        }
                        y={baseY - hCreated}
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
                    {showResolved && (
                      <rect
                        x={
                          showCreated
                            ? slotCenterX + 2
                            : slotCenterX - singleBarWidth / 2
                        }
                        y={baseY - hResolved}
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

                    {/* Value Labels on top of bars when hovered or active */}
                    {isHovered && showCreated && d.created > 0 && (
                      <text
                        x={showResolved ? slotCenterX - singleBarWidth / 2 - 2 : slotCenterX}
                        y={baseY - hCreated - 5}
                        textAnchor="middle"
                        className={styles.barValueText}
                      >
                        {d.created}
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

            {/* ── CURVE GRAPH MODE ── */}
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

                    {/* Created Dot */}
                    {showCreated && (
                      <circle
                        cx={p.x}
                        cy={p.yCreated}
                        r={hoveredPoint?.label === p.label ? '6' : '4.5'}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={hoveredPoint?.label === p.label ? '3.5' : '2.5'}
                        className={styles.chartDot}
                      />
                    )}

                    {/* Resolved Dot */}
                    {showResolved && (
                      <circle
                        cx={p.x}
                        cy={p.yResolved}
                        r={hoveredPoint?.label === p.label ? '6' : '4'}
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth={hoveredPoint?.label === p.label ? '3.5' : '2.5'}
                        className={styles.chartDot}
                      />
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
            <span>Tickets Created ({graphType === 'bar' ? 'Blue Gradient Bar' : 'Velocity Curve'})</span>
          </div>
          <div className="analytics-legend-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#10b981', display: 'inline-block' }} />
            <span>Tickets Resolved ({graphType === 'bar' ? 'Emerald Gradient Bar' : 'Output Throughput'})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-Colored Department Workload Bar Chart Component ─────────────────────
function DepartmentVolumeBarChart({
  departments,
}: {
  departments: AdminAnalyticsData['departmentAnalytics'];
}) {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);

  const maxTickets = useMemo(() => {
    if (!departments.length) return 10;
    const max = Math.max(...departments.map((d) => d.totalTickets));
    return Math.max(max, 5);
  }, [departments]);

  const svgWidth = 720;
  const svgHeight = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 45;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  const slotW = departments.length > 0 ? graphW / departments.length : graphW;
  const barW = Math.min(Math.max(slotW * 0.45, 14), 42);

  return (
    <div className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>
            <span>📊</span> Department Workload & Resolution Bar Chart
          </h3>
          <div className={styles.cardSubtitle}>
            Comparative ticket volume and output per department with vibrant color branding
          </div>
        </div>
        <span className={styles.badgePill}>{departments.length} Departments</span>
      </div>

      <div className={styles.svgGraphContainer}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.svgGraph}>
          <defs>
            {departments.map((_, i) => {
              const grad = GRADIENTS[i % GRADIENTS.length];
              return (
                <linearGradient key={i} id={`deptGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={grad[0]} />
                  <stop offset="100%" stopColor={grad[1]} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Reference Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + graphH * (1 - ratio);
            const val = Math.round(maxTickets * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  className={styles.gridLine}
                />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" className={styles.axisText}>
                  {val}
                </text>
              </g>
            );
          })}

          <line
            x1={padLeft}
            y1={padTop + graphH}
            x2={svgWidth - padRight}
            y2={padTop + graphH}
            className={styles.axisLine}
          />

          {!departments.length ? (
            <text
              x={svgWidth / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              className={styles.axisText}
            >
              No department data available
            </text>
          ) : (
            departments.map((dept, i) => {
              const centerX = padLeft + i * slotW + slotW / 2;
              const hTotal = maxTickets > 0 ? (dept.totalTickets / maxTickets) * graphH : 0;
              const hResolved = maxTickets > 0 ? (dept.resolvedTickets / maxTickets) * graphH : 0;
              const baseY = padTop + graphH;

              const isHovered = hoveredDept === dept.departmentId;
              const isDimmed = hoveredDept !== null && !isHovered;

              return (
                <g
                  key={dept.departmentId}
                  onMouseEnter={() => setHoveredDept(dept.departmentId)}
                  onMouseLeave={() => setHoveredDept(null)}
                >
                  {/* Slot hover bg */}
                  <rect
                    x={padLeft + i * slotW + 2}
                    y={padTop}
                    width={slotW - 4}
                    height={graphH}
                    fill={isHovered ? 'rgba(0,0,0,0.03)' : 'transparent'}
                    rx="8"
                  />

                  {/* Total Tickets Multi-Color Bar */}
                  <rect
                    x={centerX - barW / 2}
                    y={baseY - hTotal}
                    width={barW}
                    height={Math.max(hTotal, 2)}
                    rx="6"
                    fill={`url(#deptGrad_${i})`}
                    className={styles.barRect}
                    style={{
                      opacity: isDimmed ? 0.35 : 1,
                      transform: isHovered ? 'scaleY(1.02)' : 'none',
                    }}
                  />

                  {/* Resolved Portion overlay strip */}
                  {hResolved > 0 && (
                    <rect
                      x={centerX - barW / 2 + 2}
                      y={baseY - hResolved}
                      width={barW - 4}
                      height={Math.max(hResolved - 2, 2)}
                      rx="4"
                      fill="rgba(255, 255, 255, 0.3)"
                      pointerEvents="none"
                    />
                  )}

                  {/* Top Value Tag */}
                  <text
                    x={centerX}
                    y={baseY - hTotal - 6}
                    textAnchor="middle"
                    className={styles.barValueText}
                    style={{
                      fill: isHovered ? PALETTE[i % PALETTE.length] : 'var(--text-primary, #0f172a)',
                    }}
                  >
                    {dept.totalTickets}
                  </text>

                  {/* X Axis Department Code/Name */}
                  <text
                    x={centerX}
                    y={padTop + graphH + 20}
                    textAnchor="middle"
                    className={styles.axisText}
                    style={{
                      fontWeight: isHovered ? 800 : 600,
                      fill: isHovered ? PALETTE[i % PALETTE.length] : 'var(--text-secondary, #64748b)',
                    }}
                  >
                    {dept.departmentCode || dept.departmentName.slice(0, 10)}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Interactive Legend Strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
        {departments.map((dept, i) => (
          <div
            key={dept.departmentId}
            className="analytics-legend-label"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600,
              padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
              background: hoveredDept === dept.departmentId ? 'var(--bg-surface, #f1f5f9)' : 'transparent',
              transform: hoveredDept === dept.departmentId ? 'scale(1.05)' : 'none',
            }}
            onMouseEnter={() => setHoveredDept(dept.departmentId)}
            onMouseLeave={() => setHoveredDept(null)}
          >
            <span
              style={{ width: '12px', height: '12px', borderRadius: '50%', background: PALETTE[i % PALETTE.length], display: 'inline-block' }}
            />
            <span>{dept.departmentName}</span>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}>({dept.totalTickets})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Ranked Category Bar Chart Component ───────────────────────────
function CategoryRankedBarChart({
  categories,
}: {
  categories: AdminAnalyticsData['categoryBreakdown'];
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
            <span>🏷️</span> Category Issue Volume (Ranked Multi-Color Bars)
          </h3>
          <div className={styles.cardSubtitle}>
            Top issue categories ranked with progressive rainbow gradient fills
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
                    <span>{cat.categoryName}</span>
                  </div>
                  <div className={styles.hBarStats}>
                    <span className={styles.hBarCount}>{cat.count} tickets</span>
                    <span className={styles.hBarPct}>({cat.resolved} resolved)</span>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Admin Analytics Page ────────────────────────────────────────────────
export default function AdminAnalytics() {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<string>('6m');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [trendTab, setTrendTab] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [distributionTab, setDistributionTab] = useState<'priority' | 'department' | 'category'>('priority');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminAnalytics({
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
    loadAnalytics();
  }, [timeframe, departmentId]);

  // Formatted data items for Pie & Donut Charts
  const statusChartItems = useMemo<ChartSliceItem[]>(() => {
    if (!data?.statusBreakdown) return [];
    return data.statusBreakdown.map((sb) => ({
      id: sb.status,
      label: sb.status.replace(/_/g, ' '),
      value: sb.count,
      color: STATUS_COLORS[sb.status] || '#64748b',
    }));
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
    return data.categoryBreakdown.map((c, i) => ({
      id: c.categoryName,
      label: c.categoryName,
      value: c.count,
      color: PALETTE[(i + 3) % PALETTE.length],
    }));
  }, [data?.categoryBreakdown]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Help Desk Management System - Analytics Export'],
      ['Generated On', new Date().toLocaleString()],
      ['Timeframe', timeframe],
      ['Department Filter', departmentId],
      [],
      ['=== KEY PERFORMANCE INDICATORS ==='],
      ['Metric', 'Value'],
      ['Total Tickets', data.kpis.totalTickets],
      ['Resolved Tickets', data.kpis.resolvedTickets],
      ['Open Tickets', data.kpis.openTickets],
      ['In Progress Tickets', data.kpis.inProgressTickets],
      ['Overdue Tickets', data.kpis.overdueTickets],
      ['Resolution Rate (%)', `${data.kpis.resolutionRate}%`],
      ['SLA Compliance Rate (%)', `${data.kpis.slaComplianceRate}%`],
      ['Avg Resolution Time (hrs)', `${data.kpis.avgResolutionHours}h`],
      ['Month Growth (%)', `${data.kpis.monthGrowthPercent}%`],
      [],
      ['=== MONTHLY TICKET TRENDS ==='],
      ['Month', 'Created', 'Resolved', 'Active Backlog', 'Overdue Count', 'Avg Resolution (h)'],
      ...data.monthlyTrends.map((m) => [
        m.monthLabel,
        m.totalCreated,
        m.totalResolved,
        m.activeBacklog,
        m.overdueCount,
        m.avgResolutionHours,
      ]),
      [],
      ['=== DEPARTMENT PERFORMANCE MATRIX ==='],
      ['Department Name', 'Head Manager', 'Total Tickets', 'Open', 'In Progress', 'Resolved', 'Overdue', 'Resolution Rate (%)', 'SLA Compliance (%)'],
      ...data.departmentAnalytics.map((d) => [
        d.departmentName,
        d.headName,
        d.totalTickets,
        d.openTickets,
        d.inProgressTickets,
        d.resolvedTickets,
        d.overdueTickets,
        `${d.resolutionRate}%`,
        `${d.slaComplianceRate}%`,
      ]),
      [],
      ['=== STATUS BREAKDOWN ==='],
      ['Status', 'Count', 'Percentage'],
      ...data.statusBreakdown.map((s) => [s.status, s.count, `${s.percentage}%`]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HDMS_Analytics_Report_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.page}>
      {/* ── Top Header & Controls ─────────────────────────────────────────── */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <h1>
            <span>📈</span> Ticket Analytics & Intelligence
          </h1>
          <p>
            Interactive multi-color bar charts, pie/donut charts, monthly trends, and department workloads.
          </p>
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

          {/* Department Filter */}
          {data?.departmentAnalytics && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={styles.selectInput}
              aria-label="Filter by department"
            >
              <option value="all">🏛️ All Departments</option>
              {data.departmentAnalytics.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={loadAnalytics}
            className={styles.actionBtn}
            title="Refresh analytics data"
          >
            🔄 Refresh
          </button>

          {/* Export CSV Action */}
          <button
            type="button"
            onClick={exportCSV}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            title="Export CSV report"
            disabled={!data}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--analytics-trend-neg-bg, #fee2e2)', color: 'var(--analytics-trend-neg-color, #991b1b)', border: '1px solid', borderColor: 'var(--analytics-trend-neg-bg, #fecaca)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && !data ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Compiling analytics charts and metrics...</p>
        </div>
      ) : data ? (
        <>
          {/* ── KPI Metric Scorecards ──────────────────────────────────────── */}
          <div className={styles.kpiGrid}>
            {/* Total Tickets */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <div className={styles.kpiIconBox} style={{ background: '#eff6ff', color: '#2563eb' }}>
                  🎫
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
                  {data.kpis.monthGrowthPercent >= 0 ? '▲' : '▼'} {Math.abs(data.kpis.monthGrowthPercent)}% MoM
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
                <div className={styles.kpiIconBox} style={{ background: '#dcfce7', color: '#15803d' }}>
                  ✅
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
                <div className={styles.kpiIconBox} style={{ background: '#fef3c7', color: '#b45309' }}>
                  ⏳
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
                <div className={styles.kpiIconBox} style={{ background: '#ede9fe', color: '#6d28d9' }}>
                  ⏱️
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
                <div className={styles.kpiIconBox} style={{ background: '#fce7f3', color: '#be185d' }}>
                  ⚡
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

          {/* ── Monthly & Weekly Trends Graph (With Bar Chart + Curve Toggle) ── */}
          <MonthlyTrendGraph
            monthlyData={data.monthlyTrends}
            weeklyData={data.weeklyTrends}
            dailyData={data.dailyTrends}
            activeTab={trendTab}
            onTabChange={setTrendTab}
          />

          {/* ── Multi-Color Department Bar Chart & Ranked Category Bar Chart ─── */}
          <div className={styles.twoColGrid}>
            <DepartmentVolumeBarChart departments={data.departmentAnalytics} />
            <CategoryRankedBarChart categories={data.categoryBreakdown} />
          </div>

          {/* ── Interactive Pie / Donut Charts Section ───────────────────────── */}
          <div className={styles.twoColGrid}>
            {/* Status Lifecycle Pie/Donut Chart */}
            <InteractivePieChart
              title="Ticket Status Breakdown"
              subtitle="Distribution of tickets across all lifecycle stages"
              items={statusChartItems}
              totalLabel="Total Statuses"
              defaultMode="donut"
            />

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
                    ⚡ By Priority
                  </button>
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
                    🏛️ By Department Share
                  </button>
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
                    🏷️ By Category
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
              ) : distributionTab === 'department' ? (
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
                  subtitle="Ticket volume categorized by issue domain"
                  items={categoryChartItems}
                  totalLabel="Category Total"
                  defaultMode="pie"
                />
              )}
            </div>
          </div>

          {/* ── Department Performance Matrix ──────────────────────────────── */}
          <div className={styles.chartCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>🏛️</span> Department Performance & Resolution Matrix
                </h3>
                <div className={styles.cardSubtitle}>
                  Detailed workload, turnaround time, and SLA fulfillment per department
                </div>
              </div>
              <span className={styles.badgePill}>
                {data.departmentAnalytics.length} Departments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className={styles.deptTable}>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Tickets</th>
                    <th>Open / Pending</th>
                    <th>In Progress</th>
                    <th>Resolved</th>
                    <th>Overdue</th>
                    <th>Resolution Rate</th>
                    <th>SLA Compliance</th>
                    <th>Avg Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.departmentAnalytics.length ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyState}>
                        No department activity recorded
                      </td>
                    </tr>
                  ) : (
                    data.departmentAnalytics.map((dept) => (
                      <tr key={dept.departmentId}>
                        <td>
                          <div className={styles.deptNameCell}>{dept.departmentName}</div>
                          <div className={styles.deptHead}>Head: {dept.headName}</div>
                        </td>
                        <td>
                          <strong className="analytics-table-strong" style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 700 }}>{dept.totalTickets}</strong>
                        </td>
                        <td>
                          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', background: 'var(--analytics-trend-neutral-bg, #fef3c7)', color: '#b45309', fontWeight: 500 }}>
                            {dept.openTickets}
                          </span>
                        </td>
                        <td>
                          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', background: 'var(--analytics-badge-bg, #eff6ff)', color: '#1d4ed8', fontWeight: 500 }}>
                            {dept.inProgressTickets}
                          </span>
                        </td>
                        <td>
                          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', background: 'var(--analytics-trend-pos-bg, #dcfce7)', color: 'var(--analytics-trend-pos-color, #166534)', fontWeight: 700 }}>
                            {dept.resolvedTickets}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: dept.overdueTickets > 0 ? 700 : 500,
                              background: dept.overdueTickets > 0 ? 'var(--analytics-trend-neg-bg, #fee2e2)' : 'var(--bg-surface, #f1f5f9)',
                              color: dept.overdueTickets > 0 ? 'var(--analytics-trend-neg-color, #991b1b)' : 'var(--text-muted, #64748b)',
                            }}
                          >
                            {dept.overdueTickets}
                          </span>
                        </td>
                        <td>
                          <div className={styles.progressBarBox}>
                            <div className={styles.progressTrack}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${dept.resolutionRate}%`,
                                  background:
                                    dept.resolutionRate >= 80
                                      ? '#10b981'
                                      : dept.resolutionRate >= 50
                                      ? '#3b82f6'
                                      : '#f59e0b',
                                }}
                              />
                            </div>
                            <span className="analytics-table-strong" style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '42px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                              {dept.resolutionRate}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.progressBarBox}>
                            <div className={styles.progressTrack}>
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
                            <span className="analytics-table-strong" style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '42px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                              {dept.slaComplianceRate}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="analytics-table-strong" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                            {dept.avgResolutionHours}h
                          </span>
                        </td>
                      </tr>
                    ))
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
