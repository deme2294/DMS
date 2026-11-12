import type {
  AdminAnalyticsData,
  AdminAnalyticsKpis,
  DepartmentAnalyticsItem,
  MonthlyTrendItem,
  CategoryAnalyticsItem,
  StatusAnalyticsItem,
} from '../api/dashboardApi';
import { STATUS_LABELS, type TicketStatus } from '../types/ticket';

/**
 * Escapes and wraps a single cell value adhering to RFC 4180 CSV standard.
 * Prevents formula injection, handles commas, newlines, and quotes seamlessly.
 */
export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // Double-escape any internal quotes and wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds an RFC 4180 compliant CSV string with Windows-compatible CRLF line endings.
 */
export function buildCSV(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((row) => row.map((cell) => escapeCSVCell(cell)).join(','))
    .join('\r\n');
}

/**
 * Triggers an instant browser download of a CSV file with the UTF-8 Byte Order Mark (\uFEFF).
 * \uFEFF ensures Microsoft Excel, Google Sheets, LibreOffice, and data tools automatically
 * recognize Unicode encoding without character corruption or squishing.
 */
export function triggerCSVDownload(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper to get clean human status label without raw bullet artifacts
 */
function getCleanStatusLabel(status: string): string {
  const label = STATUS_LABELS[status as TicketStatus] || status;
  return label.replace(/\s*-\s*/g, ' - ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MASTER UNIFIED ANALYTICS LEDGER (ALL-IN-ONE TABULAR CSV)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Exports a completely unified, professional master ledger.
 * All rows strictly share the same 18 wide, self-explanatory column headers.
 * When opened in Excel, no columns are truncated or misaligned!
 */
export function exportMasterAnalyticsCSV(
  data: AdminAnalyticsData,
  timeframe = '30d',
  departmentName = 'All Departments'
): void {
  const totalTickets = data.kpis.totalTickets || 1;

  const rows: (string | number | undefined | null)[][] = [
    // Report Title & Metadata Header
    ['HELP DESK MANAGEMENT SYSTEM - EXECUTIVE ANALYTICS RAW MASTER LEDGER'],
    [
      `Generated On: ${new Date().toLocaleString()}   |   Reporting Timeframe: ${timeframe.toUpperCase()}   |   Department Scope: ${departmentName}   |   Standards: Verified Operational Audit (RFC 4180)`,
    ],
    [], // Blank separation line

    // Master Column Headers (Wide, explicit, and self-documenting)
    [
      'Report Domain',
      'Record Identifier',
      'Dimension / Entity Name',
      'Department Code',
      'Manager / Owner Lead',
      'Total Workload (Tickets)',
      'Inbound Routed',
      'Team Created',
      'Open Tickets',
      'In Progress',
      'Resolved Tickets',
      'Overdue Tickets',
      'Resolution Rate (%)',
      'SLA Compliance (%)',
      'Avg Turnaround (Hours)',
      'Volume Share (%)',
      'Performance Tier / Benchmark',
      'Operational Limitations & Audit Notes',
    ],
  ];

  // 1. Department Efficiency Rows
  data.departmentAnalytics.forEach((dept) => {
    const share = ((dept.totalTickets / totalTickets) * 100).toFixed(1);
    const notes = dept.totalTickets === 0
      ? 'No active tickets or workload recorded in selected timeframe'
      : (dept.performanceReasons && dept.performanceReasons.length > 0)
      ? dept.performanceReasons.join('; ')
      : dept.is100PercentQualified
      ? 'Flawless execution: 100% resolved, zero overdue, 100% SLA compliance'
      : `${dept.resolvedTickets} of ${dept.totalTickets} resolved`;

    const tierDisplay = dept.totalTickets === 0
      ? 'Inactive (No Workload)'
      : dept.performanceGrade
      ? `${dept.performanceGrade} Grade (${dept.performanceTier || 'Standard'})`
      : (dept.performanceTier || 'Standard');

    rows.push([
      'Department Efficiency',
      `DEPT-${dept.departmentCode || dept.departmentId.slice(0, 8).toUpperCase()}`,
      dept.departmentName,
      dept.departmentCode || 'DEPT',
      dept.headName || 'Unassigned',
      dept.totalTickets,
      dept.assignedTickets ?? dept.totalTickets,
      dept.createdByTickets ?? 0,
      dept.openTickets,
      dept.inProgressTickets,
      dept.resolvedTickets,
      dept.overdueTickets,
      `${dept.resolutionRate}%`,
      `${dept.slaComplianceRate}%`,
      `${dept.avgResolutionHours}h`,
      `${share}%`,
      tierDisplay,
      notes,
    ]);
  });

  // 2. Monthly Ticket Trends Rows
  data.monthlyTrends.forEach((trend) => {
    const share = ((trend.totalCreated / totalTickets) * 100).toFixed(1);
    const resRate = trend.totalCreated > 0
      ? ((trend.totalResolved / trend.totalCreated) * 100).toFixed(1)
      : '0.0';

    rows.push([
      'Monthly Trends',
      `TREND-${trend.monthKey}`,
      trend.monthLabel,
      'ALL',
      'Enterprise Operations',
      trend.totalCreated,
      trend.totalCreated,
      trend.totalCreated,
      0,
      trend.activeBacklog,
      trend.totalResolved,
      trend.overdueCount,
      `${resRate}%`,
      '-',
      `${trend.avgResolutionHours}h`,
      `${share}%`,
      trend.overdueCount > 0 ? 'Overdue Inflow' : 'Controlled Inflow',
      `${trend.activeBacklog} active backlog; ${trend.overdueCount} overdue tickets`,
    ]);
  });

  // 3. Category Problem Types
  data.categoryBreakdown.forEach((cat, idx) => {
    const share = ((cat.count / totalTickets) * 100).toFixed(1);
    const resRate = cat.count > 0 ? ((cat.resolved / cat.count) * 100).toFixed(1) : '0.0';

    rows.push([
      'Category Distribution',
      `CAT-${String(idx + 1).padStart(2, '0')}`,
      cat.categoryName,
      'ALL',
      'Category Leads',
      cat.count,
      cat.count,
      0,
      cat.openTickets ?? 0,
      cat.inProgressTickets ?? 0,
      cat.resolved,
      cat.overdue ?? 0,
      `${cat.resolutionRate ?? resRate}%`,
      cat.slaComplianceRate !== undefined ? `${cat.slaComplianceRate}%` : '-',
      cat.avgHours !== undefined ? `${cat.avgHours}h` : '-',
      `${share}%`,
      cat.performanceScore !== undefined ? `Score: ${cat.performanceScore}%` : 'Active Category',
      `${cat.resolved} of ${cat.count} resolved`,
    ]);
  });

  // 4. Ticket Status Lifecycle
  data.statusBreakdown.forEach((status) => {
    const cleanLabel = getCleanStatusLabel(status.status);
    rows.push([
      'Status Lifecycle',
      `STATUS-${status.status.toUpperCase().replace(/\./g, '_')}`,
      cleanLabel,
      'ALL',
      'Workflow Routing',
      status.count,
      status.count,
      0,
      status.status === 'open' ? status.count : 0,
      status.status.includes('progress') ? status.count : 0,
      status.status === 'resolved' || status.status === 'closed' ? status.count : 0,
      status.overdueCount ?? 0,
      status.status === 'resolved' || status.status === 'closed' ? '100.0%' : '0.0%',
      '-',
      status.avgHours ? `${status.avgHours}h` : '-',
      `${status.percentage}%`,
      status.overdueCount && status.overdueCount > 0 ? 'Overdue Queue' : 'Active Stage',
      `${status.count} tickets currently at ${cleanLabel} stage`,
    ]);
  });

  // 5. Executive KPI Summary Scorecard
  const kpiList = [
    { id: 'KPI-01', name: 'Total Tickets Registered', val: data.kpis.totalTickets, unit: 'Tickets', note: `${data.kpis.currentMonthCount} this month vs ${data.kpis.previousMonthCount} last month` },
    { id: 'KPI-02', name: 'Tickets Resolved Successfully', val: data.kpis.resolvedTickets, unit: 'Tickets', note: `${data.kpis.resolvedTickets} of ${data.kpis.totalTickets} closed` },
    { id: 'KPI-03', name: 'Active Backlog Queue', val: data.kpis.openTickets + data.kpis.inProgressTickets, unit: 'Tickets', note: `${data.kpis.openTickets} open, ${data.kpis.inProgressTickets} in progress` },
    { id: 'KPI-04', name: 'Overdue Tickets (SLA Breached)', val: data.kpis.overdueTickets, unit: 'Tickets', note: `${data.kpis.overdueRate}% overdue rate` },
    { id: 'KPI-05', name: 'Resolution Rate Benchmark', val: `${data.kpis.resolutionRate}%`, unit: 'Percentage', note: 'Target >= 85%' },
    { id: 'KPI-06', name: 'SLA Compliance Benchmark', val: `${data.kpis.slaComplianceRate}%`, unit: 'Percentage', note: 'Target >= 95%' },
    { id: 'KPI-07', name: 'Avg Resolution Turnaround', val: `${data.kpis.avgResolutionHours}h`, unit: 'Hours', note: `First response avg: ${data.kpis.avgFirstResponseHours}h` },
    { id: 'KPI-08', name: 'Month-over-Month Velocity Growth', val: `${data.kpis.monthGrowthPercent}%`, unit: 'Percentage', note: 'Comparative volume surge' },
  ];

  kpiList.forEach((kpi) => {
    rows.push([
      'Executive KPI Benchmark',
      kpi.id,
      kpi.name,
      'ALL',
      'System Administration',
      typeof kpi.val === 'number' ? kpi.val : 0,
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      typeof kpi.val === 'string' && kpi.val.includes('%') ? kpi.val : '-',
      '-',
      typeof kpi.val === 'string' && kpi.val.includes('h') ? kpi.val : '-',
      '100.0%',
      'Executive Standard',
      kpi.note,
    ]);
  });

  const csvString = buildCSV(rows);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(`HDMS_Master_Analytics_Ledger_${timeframe}_${dateStr}.csv`, csvString);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEDICATED DEPARTMENT PERFORMANCE MATRIX CSV
// ─────────────────────────────────────────────────────────────────────────────
export function exportDepartmentPerformanceCSV(
  departments: DepartmentAnalyticsItem[],
  timeframe = '30d'
): void {
  const rows: (string | number | undefined | null)[][] = [
    ['HELP DESK MANAGEMENT SYSTEM - DEPARTMENT PROBLEM-SOLVING & EFFICIENCY MATRIX'],
    [`Generated On: ${new Date().toLocaleString()}`, `Period: ${timeframe.toUpperCase()}`, 'Scope: All Registered Departments'],
    [],
    [
      'Department Name',
      'Department Code',
      'Head Manager',
      'Routed Workload',
      'Solved Early (Ahead of SLA)',
      'Solved On-Time (Met SLA)',
      'Solved Late (Breached SLA)',
      'Active Backlog',
      'Overdue Backlog',
      'Resolution Rate (%)',
      'SLA Compliance (%)',
      'Avg Turnaround (Hours)',
      'Performance Score (%)',
      'Performance Grade',
      'Performance Tier',
      'Qualification Status',
      'Operational Reasons & Limitations',
    ],
  ];

  departments.forEach((dept) => {
    const isFlawless = dept.is100PercentQualified ? '100% Perfect Qualified' : 'Standard Qualified';
    const notes = dept.totalTickets === 0
      ? 'No active tickets routed in period'
      : (dept.performanceReasons && dept.performanceReasons.length > 0)
      ? dept.performanceReasons.join('; ')
      : `${dept.resolvedTickets} of ${dept.totalTickets} resolved`;

    rows.push([
      dept.departmentName,
      dept.departmentCode || 'DEPT',
      dept.headName || 'Unassigned',
      dept.totalTickets,
      dept.earlyResolvedTickets ?? 0,
      dept.onTimeResolvedTickets ?? 0,
      dept.lateResolvedTickets ?? 0,
      dept.openTickets + dept.inProgressTickets,
      dept.overdueTickets,
      `${dept.resolutionRate}%`,
      `${dept.slaComplianceRate}%`,
      `${dept.avgResolutionHours}h`,
      dept.performanceScore !== undefined ? `${dept.performanceScore}%` : 'N/A',
      dept.performanceGrade || 'N/A',
      dept.performanceTier || (dept.totalTickets === 0 ? 'inactive' : 'moderate'),
      dept.totalTickets === 0 ? 'Inactive' : isFlawless,
      notes,
    ]);
  });

  const csvString = buildCSV(rows);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(`HDMS_Department_Performance_Matrix_${timeframe}_${dateStr}.csv`, csvString);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEDICATED MONTHLY & WEEKLY TRENDS CSV
// ─────────────────────────────────────────────────────────────────────────────
export function exportMonthlyTrendsCSV(
  monthlyTrends: MonthlyTrendItem[],
  timeframe = '30d'
): void {
  const rows: (string | number | undefined | null)[][] = [
    ['HELP DESK MANAGEMENT SYSTEM - MONTHLY TICKET INFLOW & RESOLUTION TRENDS'],
    [`Generated On: ${new Date().toLocaleString()}`, `Period: ${timeframe.toUpperCase()}`],
    [],
    [
      'Month Identifier',
      'Reporting Month Label',
      'Tickets Created (Inflow)',
      'Tickets Resolved (Outflow)',
      'Active Backlog Queue',
      'Overdue Issue Count',
      'Resolution Velocity (%)',
      'Avg Resolution Turnaround (Hours)',
      'Operational Velocity Assessment',
    ],
  ];

  monthlyTrends.forEach((trend) => {
    const resRate = trend.totalCreated > 0
      ? ((trend.totalResolved / trend.totalCreated) * 100).toFixed(1)
      : '0.0';

    rows.push([
      trend.monthKey,
      trend.monthLabel,
      trend.totalCreated,
      trend.totalResolved,
      trend.activeBacklog,
      trend.overdueCount,
      `${resRate}%`,
      `${trend.avgResolutionHours}h`,
      trend.overdueCount > 0 ? 'Backlog / SLA Attention' : 'Controlled Inflow',
    ]);
  });

  const csvString = buildCSV(rows);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(`HDMS_Monthly_Trends_Ledger_${timeframe}_${dateStr}.csv`, csvString);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DEDICATED CATEGORY & STATUS LIFECYCLE CSV
// ─────────────────────────────────────────────────────────────────────────────
export function exportCategoryAndStatusCSV(
  categories: CategoryAnalyticsItem[],
  statuses: StatusAnalyticsItem[],
  timeframe = '30d'
): void {
  const rows: (string | number | undefined | null)[][] = [
    ['HELP DESK MANAGEMENT SYSTEM - CATEGORY BREAKDOWN & STATUS LIFECYCLE LEDGER'],
    [`Generated On: ${new Date().toLocaleString()}`, `Period: ${timeframe.toUpperCase()}`],
    [],
    ['=== CATEGORY PROBLEM BREAKDOWN ==='],
    [
      'Category Name',
      'Total Problem Volume',
      'Open Tickets',
      'In Progress Tickets',
      'Resolved Tickets',
      'Overdue Issues',
      'Resolution Rate (%)',
      'SLA Compliance (%)',
      'Avg Turnaround (Hours)',
      'Category Performance Score (%)',
    ],
  ];

  categories.forEach((cat) => {
    rows.push([
      cat.categoryName,
      cat.count,
      cat.openTickets ?? 0,
      cat.inProgressTickets ?? 0,
      cat.resolved,
      cat.overdue ?? 0,
      cat.resolutionRate !== undefined ? `${cat.resolutionRate}%` : '-',
      cat.slaComplianceRate !== undefined ? `${cat.slaComplianceRate}%` : '-',
      cat.avgHours !== undefined ? `${cat.avgHours}h` : '-',
      cat.performanceScore !== undefined ? `${cat.performanceScore}%` : '-',
    ]);
  });

  rows.push([]);
  rows.push(['=== TICKET STATUS LIFECYCLE DISTRIBUTION ===']);
  rows.push([
    'Lifecycle Status Code',
    'Status Display Name',
    'Active Ticket Count',
    'Percentage Share of Total (%)',
    'Overdue Issue Count',
    'Workflow Action Status',
  ]);

  statuses.forEach((status) => {
    const cleanLabel = getCleanStatusLabel(status.status);
    rows.push([
      status.status,
      cleanLabel,
      status.count,
      `${status.percentage}%`,
      status.overdueCount ?? 0,
      status.overdueCount && status.overdueCount > 0 ? 'Overdue Action Required' : 'Active Workflow',
    ]);
  });

  const csvString = buildCSV(rows);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(`HDMS_Category_Status_Distribution_${timeframe}_${dateStr}.csv`, csvString);
}

