import ExcelJS from 'exceljs';
import type {
  AdminAnalyticsData,
  AdminDashboardData,
  TicketStatistics,
  AdminSlaDashboard,
} from '../api/dashboardApi';
import { STATUS_LABELS, type TicketStatus } from '../types/ticket';

// ── Color Palette for Professional Excel Reports ─────────────────────────────
const EXCEL_PALETTE = {
  NAVY_HEADER: 'FF1E293B',    // Dark Slate #1E293B
  BLUE_BANNER: 'FF2563EB',    // Primary Brand Blue #2563EB
  TEAL_ACCENT: 'FF0D9488',    // Teal #0D9488
  LIGHT_ROW_ALT: 'FFF8FAFC',  // Zebra alternate row #F8FAFC
  BORDER_COLOR: 'FFCBD5E1',   // Slate border #CBD5E1
  WHITE: 'FFFFFFFF',
  DARK_TEXT: 'FF0F172A',      // Near black for data #0F172A
  MUTED_TEXT: 'FF64748B',     // Slate muted #64748B
  GREEN_TEXT: 'FF15803D',     // Dark green
  GREEN_BG: 'FFDCFCE7',       // Soft green pill
  AMBER_TEXT: 'FFB45309',     // Amber text
  AMBER_BG: 'FFFEF3C7',       // Soft amber pill
  RED_TEXT: 'FFB91C1C',       // Soft red text
  RED_BG: 'FFFEE2E2',         // Soft red pill
};

/**
 * Apply thin borders to a cell
 */
function applyCellBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: EXCEL_PALETTE.BORDER_COLOR } },
    left: { style: 'thin', color: { argb: EXCEL_PALETTE.BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: EXCEL_PALETTE.BORDER_COLOR } },
    right: { style: 'thin', color: { argb: EXCEL_PALETTE.BORDER_COLOR } },
  };
}

/**
 * Style table header cells
 */
function styleHeaderCell(cell: ExcelJS.Cell, bgColor = EXCEL_PALETTE.NAVY_HEADER) {
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  applyCellBorders(cell);
}

/**
 * Style regular data row cells
 */
function styleDataCell(cell: ExcelJS.Cell, isAlt = false, align: 'left' | 'center' | 'right' = 'left') {
  cell.font = { name: 'Calibri', size: 10, color: { argb: EXCEL_PALETTE.DARK_TEXT } };
  if (isAlt) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.LIGHT_ROW_ALT } };
  }
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: false };
  applyCellBorders(cell);
}

/**
 * Accurately determines if a cell is part of a title banner, merged section banner, or subtitle
 */
function isMergedOrBannerCell(sheet: ExcelJS.Worksheet, cell: ExcelJS.Cell): boolean {
  if (cell.isMerged) return true;

  const merges = (sheet as any)._merges;
  if (merges) {
    for (const key of Object.keys(merges)) {
      const m = merges[key];
      if (m && m.model) {
        const { top, bottom, left, right } = m.model;
        if (left !== right && cell.row >= top && cell.row <= bottom && cell.col >= left && cell.col <= right) {
          return true;
        }
      } else if (typeof key === 'string' && key.includes(':')) {
        const [p1, p2] = key.split(':');
        const c1 = p1.replace(/[0-9]/g, '');
        const c2 = p2.replace(/[0-9]/g, '');
        const r1 = parseInt(p1.replace(/\D/g, ''), 10);
        const r2 = parseInt(p2.replace(/\D/g, ''), 10);
        if (c1 !== c2 && Number(cell.row) >= r1 && Number(cell.row) <= r2) {
          return true;
        }
      }
    }
  }

  // Rows 1 to 3 are always top-level report title and metadata banners
  if (Number(cell.row) <= 3) return true;

  if (cell.value) {
    const val = String(cell.value).trim();
    if (
      val.startsWith('===') ||
      /^\d+\.\s+[A-Z]/.test(val) ||
      val.includes('REPORT') ||
      val.includes('SUMMARY') ||
      val.includes('MATRIX') ||
      val.includes('LEDGER') ||
      val.includes('BREAKDOWN') ||
      val.includes('TRENDS') ||
      val.includes('COMMAND CENTER')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamically adjusts column widths precisely based on actual data & header content length.
 * Prevents truncation, expands to accommodate strings, and wraps long text cleanly.
 */
function autoEnlargeColumns(sheet: ExcelJS.Worksheet, defaultMinWidth = 14, defaultMaxWidth = 85) {
  if (!sheet.columns) return;

  sheet.columns.forEach((column) => {
    if (!column || !column.eachCell) return;
    let maxContentLen = 0;
    let hasLongText = false;

    column.eachCell({ includeEmpty: false }, (cell) => {
      // Skip title/section banners so they don't artificially blow up column width
      if (isMergedOrBannerCell(sheet, cell)) return;

      const raw = cell.value !== undefined && cell.value !== null ? String(cell.value) : '';
      const lines = raw.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        const len = trimmed.length;

        if (len > 35) {
          hasLongText = true;
        }

        // Bold headers visually need ~15% more horizontal width in Calibri font
        const isBold = Boolean(cell.font && cell.font.bold);
        const effectiveLen = isBold ? Math.ceil(len * 1.15) : len;

        if (effectiveLen > maxContentLen) {
          maxContentLen = Math.min(effectiveLen, defaultMaxWidth);
        }
      }
    });

    // Provide comfortable cell padding (+4) and ensure minimum width
    const dynamicWidth = Math.max(maxContentLen + 4, defaultMinWidth);
    column.width = dynamicWidth;

    // For columns with long descriptions, remarks, or audit details, enable wrapText
    if (hasLongText) {
      column.eachCell((cell) => {
        if (!isMergedOrBannerCell(sheet, cell)) {
          cell.alignment = {
            ...cell.alignment,
            wrapText: true,
            vertical: 'middle',
          };
        }
      });
    }
  });
}

/**
 * Adds an executive section banner merged across columns
 */
function addSectionHeader(sheet: ExcelJS.Worksheet, title: string, startCol = 1, endCol = 6, bgColor = EXCEL_PALETTE.BLUE_BANNER) {
  const row = sheet.addRow([title]);
  sheet.mergeCells(row.number, startCol, row.number, endCol);
  const cell = row.getCell(startCol);
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  row.height = 28;
  return row;
}

/**
 * Download workbook as .xlsx file directly in the browser
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Professional Excel Exporter for Admin & CEO Analytics
 * Generates an executive-level multi-tab workbook with auto-enlarged columns and styled components.
 */
export async function exportAnalyticsToExcel(
  data: AdminAnalyticsData,
  timeframe = '30d',
  departmentName = 'All Departments'
) {
  if (!data) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Help Desk Management System';
  workbook.created = new Date();

  // ── TAB 1: EXECUTIVE MASTER DASHBOARD ─────────────────────────────────────────
  const masterSheet = workbook.addWorksheet('Executive Analytics', {
    views: [{ showGridLines: true }],
  });

  // Top Title Banner
  const titleRow = masterSheet.addRow(['HELP DESK MANAGEMENT SYSTEM — EXECUTIVE ANALYTICS REPORT']);
  masterSheet.mergeCells('A1:I1');
  titleRow.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.NAVY_HEADER } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 36;

  // Metadata Subtitle
  const subRow = masterSheet.addRow([
    `Generated On: ${new Date().toLocaleString()}   |   Reporting Period: ${timeframe.toUpperCase()}   |   Department Scope: ${departmentName}`,
  ]);
  masterSheet.mergeCells('A2:I2');
  subRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: EXCEL_PALETTE.MUTED_TEXT } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.height = 22;
  masterSheet.addRow([]); // Blank spacer row

  // ── 1. KPI Scorecard Table ──────────────────────────────────────────────────
  addSectionHeader(masterSheet, '1. KEY PERFORMANCE INDICATORS (OPERATIONAL VELOCITY)', 1, 4, EXCEL_PALETTE.BLUE_BANNER);
  const kpiHeader = masterSheet.addRow(['Operational Metric', 'Recorded Value', 'Target Standard', 'Status / Benchmark']);
  kpiHeader.height = 24;
  kpiHeader.eachCell((c) => styleHeaderCell(c));

  const kpiRows = [
    ['Total Registered Tickets', data.kpis.totalTickets, '—', 'Enterprise Inflow'],
    ['Resolved Tickets', data.kpis.resolvedTickets, '—', 'Successfully Solved'],
    ['Open Tickets (Awaiting Staff)', data.kpis.openTickets, '< 10%', data.kpis.openTickets > 20 ? 'Action Needed' : 'Normal'],
    ['In Progress Tickets', data.kpis.inProgressTickets, '—', 'Currently Under Investigation'],
    ['Overdue Tickets (Breached SLA)', data.kpis.overdueTickets, '0 Target', data.kpis.overdueTickets > 0 ? 'CRITICAL ESCALATION' : 'TARGET MET'],
    ['Overall Resolution Rate (%)', `${data.kpis.resolutionRate}%`, '≥ 85%', Number(data.kpis.resolutionRate) >= 85 ? 'TARGET MET' : 'BELOW BENCHMARK'],
    ['SLA Compliance Rate (%)', `${data.kpis.slaComplianceRate}%`, '≥ 95%', Number(data.kpis.slaComplianceRate) >= 95 ? 'OPTIMAL' : 'ATTENTION REQUIRED'],
    ['Avg Resolution Turnaround (Hours)', `${data.kpis.avgResolutionHours}h`, '≤ 24h SLA', Number(data.kpis.avgResolutionHours) <= 24 ? 'Within Target' : 'Exceeding SLA'],
    ['Month-over-Month Growth (%)', `${data.kpis.monthGrowthPercent}%`, 'Stable', Number(data.kpis.monthGrowthPercent) > 0 ? 'Increasing Volume' : 'Decreasing Volume'],
  ];

  kpiRows.forEach((rowValues, idx) => {
    const row = masterSheet.addRow(rowValues);
    row.height = 22;
    styleDataCell(row.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(row.getCell(2), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(4), idx % 2 === 1, 'center');

    // Bold the value
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_PALETTE.DARK_TEXT } };
  });

  masterSheet.addRow([]); // Blank spacer

  // ── 2. Monthly Ticket Trends ────────────────────────────────────────────────
  addSectionHeader(masterSheet, '2. MONTHLY TICKET INFLOW & RESOLUTION VELOCITY', 1, 6, EXCEL_PALETTE.TEAL_ACCENT);
  const trendHeader = masterSheet.addRow([
    'Reporting Period',
    'Tickets Created',
    'Tickets Resolved',
    'Active Backlog',
    'Overdue Volume',
    'Avg Resolution Time (hrs)',
  ]);
  trendHeader.height = 24;
  trendHeader.eachCell((c) => styleHeaderCell(c));

  data.monthlyTrends.forEach((trend, idx) => {
    const row = masterSheet.addRow([
      trend.monthLabel,
      trend.totalCreated,
      trend.totalResolved,
      trend.activeBacklog,
      trend.overdueCount,
      `${trend.avgResolutionHours}h`,
    ]);
    row.height = 21;
    styleDataCell(row.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(row.getCell(2), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(4), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(5), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(6), idx % 2 === 1, 'center');
  });

  masterSheet.addRow([]); // Blank spacer

  // ── 3. Department Performance Matrix ────────────────────────────────────────
  addSectionHeader(masterSheet, '3. DEPARTMENT PERFORMANCE & SLA MATRIX', 1, 9, EXCEL_PALETTE.NAVY_HEADER);
  const deptHeader = masterSheet.addRow([
    'Department Name',
    'Department Head / Manager',
    'Total Volume',
    'Open / Pending',
    'In Progress',
    'Resolved',
    'Overdue Tickets',
    'Resolution Rate (%)',
    'SLA Compliance (%)',
  ]);
  deptHeader.height = 26;
  deptHeader.eachCell((c) => styleHeaderCell(c));

  data.departmentAnalytics.forEach((dept, idx) => {
    const row = masterSheet.addRow([
      dept.departmentName,
      dept.headName || 'Unassigned',
      dept.totalTickets,
      dept.openTickets,
      dept.inProgressTickets,
      dept.resolvedTickets,
      dept.overdueTickets,
      `${dept.resolutionRate}%`,
      `${dept.slaComplianceRate}%`,
    ]);
    row.height = 22;
    styleDataCell(row.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(row.getCell(2), idx % 2 === 1, 'left');
    styleDataCell(row.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(4), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(5), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(6), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(7), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(8), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(9), idx % 2 === 1, 'center');

    // Highlight overdue if > 0
    if (dept.overdueTickets > 0) {
      row.getCell(7).font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_PALETTE.RED_TEXT } };
    }
  });

  masterSheet.addRow([]); // Blank spacer

  // ── 4. Status Breakdown ─────────────────────────────────────────────────────
  addSectionHeader(masterSheet, '4. TICKET LIFECYCLE & STATUS DISTRIBUTION', 1, 3, EXCEL_PALETTE.BLUE_BANNER);
  const statusHeader = masterSheet.addRow(['Ticket Lifecycle Status', 'Ticket Volume', 'Percentage Share (%)']);
  statusHeader.height = 24;
  statusHeader.eachCell((c) => styleHeaderCell(c));

  data.statusBreakdown.forEach((statusItem, idx) => {
    const label = STATUS_LABELS[statusItem.status as TicketStatus] || statusItem.status;
    const row = masterSheet.addRow([label, statusItem.count, `${statusItem.percentage}%`]);
    row.height = 21;
    styleDataCell(row.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(row.getCell(2), idx % 2 === 1, 'center');
    styleDataCell(row.getCell(3), idx % 2 === 1, 'center');
  });

  // Apply auto-enlargement to master sheet
  autoEnlargeColumns(masterSheet, 20);

  // ── TAB 2: DEDICATED DEPARTMENT MATRIX ──────────────────────────────────────
  const deptSheet = workbook.addWorksheet('Department Matrix', {
    views: [{ showGridLines: true }],
  });
  const dTitle = deptSheet.addRow(['DEPARTMENT OPERATIONAL PERFORMANCE & SLA COMPLIANCE']);
  deptSheet.mergeCells('A1:I1');
  dTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  dTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.NAVY_HEADER } };
  dTitle.height = 32;

  const dHead = deptSheet.addRow([
    'Department Name',
    'Department Head',
    'Total Volume',
    'Open / Triage',
    'Active In-Progress',
    'Resolved Tickets',
    'Overdue Tickets',
    'Resolution Rate (%)',
    'SLA Compliance (%)',
  ]);
  dHead.height = 26;
  dHead.eachCell((c) => styleHeaderCell(c));

  data.departmentAnalytics.forEach((d, idx) => {
    const r = deptSheet.addRow([
      d.departmentName,
      d.headName || 'Unassigned',
      d.totalTickets,
      d.openTickets,
      d.inProgressTickets,
      d.resolvedTickets,
      d.overdueTickets,
      `${d.resolutionRate}%`,
      `${d.slaComplianceRate}%`,
    ]);
    r.height = 22;
    styleDataCell(r.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(r.getCell(2), idx % 2 === 1, 'left');
    styleDataCell(r.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(4), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(5), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(6), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(7), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(8), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(9), idx % 2 === 1, 'center');
  });
  autoEnlargeColumns(deptSheet, 20);

  // ── TAB 3: DEDICATED MONTHLY TRENDS ─────────────────────────────────────────
  const trendSheet = workbook.addWorksheet('Monthly Trends', {
    views: [{ showGridLines: true }],
  });
  const tTitle = trendSheet.addRow(['MONTHLY TICKET VOLUME & RESOLUTION TRENDS']);
  trendSheet.mergeCells('A1:F1');
  tTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  tTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.BLUE_BANNER } };
  tTitle.height = 32;

  const tHead = trendSheet.addRow([
    'Reporting Period',
    'Total Inflow (Created)',
    'Total Resolved',
    'Active Backlog',
    'Overdue Volume',
    'Avg Resolution Time (hrs)',
  ]);
  tHead.height = 26;
  tHead.eachCell((c) => styleHeaderCell(c));

  data.monthlyTrends.forEach((m, idx) => {
    const r = trendSheet.addRow([
      m.monthLabel,
      m.totalCreated,
      m.totalResolved,
      m.activeBacklog,
      m.overdueCount,
      `${m.avgResolutionHours}h`,
    ]);
    r.height = 22;
    styleDataCell(r.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(r.getCell(2), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(4), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(5), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(6), idx % 2 === 1, 'center');
  });
  autoEnlargeColumns(trendSheet, 20);

  // ── File Download ────────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanFilename = `HDMS_Executive_Analytics_${timeframe}_${dateStr}.xlsx`;
  await downloadWorkbook(workbook, cleanFilename);
}

/**
 * Reusable generic table export to professional Excel (.xlsx) with enlarged columns.
 * Can export any dataset (Audit logs, Tickets, Users, Tenants, Departments) with executive styling.
 */
export interface TableColumnDef<T> {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any, item: T) => string | number;
}

export interface GenericTableExportOptions<T> {
  title: string;
  subtitle?: string;
  filename: string;
  sheetName?: string;
  columns: TableColumnDef<T>[];
  data: T[];
}

export async function exportTableToExcel<T>({
  title,
  subtitle,
  filename,
  sheetName = 'Report Data',
  columns,
  data,
}: GenericTableExportOptions<T>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Help Desk Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  const totalCols = Math.max(columns.length, 2);

  // Title Row
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.NAVY_HEADER } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 34;

  // Subtitle Row
  const subText = subtitle || `Exported on: ${new Date().toLocaleString()} | Help Desk Management System`;
  const subRow = sheet.addRow([subText]);
  sheet.mergeCells(2, 1, 2, totalCols);
  subRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: EXCEL_PALETTE.MUTED_TEXT } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.height = 20;

  sheet.addRow([]); // Blank spacer row

  // Table Headers
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.height = 26;
  headerRow.eachCell((c) => styleHeaderCell(c));

  // Data Rows
  data.forEach((item, idx) => {
    const rowValues = columns.map((col) => {
      const rawVal = (item as any)[col.key];
      if (col.formatter) {
        return col.formatter(rawVal, item);
      }
      return rawVal !== undefined && rawVal !== null ? rawVal : '—';
    });

    const row = sheet.addRow(rowValues);
    row.height = 22;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      styleDataCell(cell, idx % 2 === 1, col.align || 'left');
    });
  });

  // Auto-enlarge all columns generously
  autoEnlargeColumns(sheet, 14, 85);

  // Trigger download
  await downloadWorkbook(workbook, filename);
}

/**
 * Professional Excel Exporter for the Main Overview / Dashboard Command Center
 * Exports KPIs, SLA stats, Recent Tickets, and Recent Users with auto-enlarged columns.
 */
export async function exportDashboardOverviewToExcel(
  dashboardData: AdminDashboardData,
  slaData?: AdminSlaDashboard | null
) {
  if (!dashboardData) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Help Desk Management System';
  workbook.created = new Date();

  // ── TAB 1: EXECUTIVE COMMAND CENTER OVERVIEW ─────────────────────────────
  const masterSheet = workbook.addWorksheet('Command Center Overview', {
    views: [{ showGridLines: true }],
  });

  const titleRow = masterSheet.addRow(['HELP DESK MANAGEMENT SYSTEM — COMMAND CENTER OVERVIEW']);
  masterSheet.mergeCells('A1:E1');
  titleRow.getCell(1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.NAVY_HEADER } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 36;

  const subRow = masterSheet.addRow([
    `Generated On: ${new Date().toLocaleString()}   |   System Scope: Enterprise Operations Command Center`,
  ]);
  masterSheet.mergeCells('A2:E2');
  subRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: EXCEL_PALETTE.MUTED_TEXT } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.height = 20;
  masterSheet.addRow([]);

  // Section 1: Core Operational KPIs
  addSectionHeader(masterSheet, '1. CORE OPERATIONAL METRICS & SYSTEM INVENTORY', 1, 4, EXCEL_PALETTE.BLUE_BANNER);
  const kpiHead = masterSheet.addRow(['Metric Name', 'Count / Value', 'Operational Classification', 'Notes']);
  kpiHead.height = 24;
  kpiHead.eachCell((c) => styleHeaderCell(c));

  const s = dashboardData.stats;
  const kpiItems = [
    ['Total Registered Users', s.totalUsers, 'Accounts', 'All system accounts across roles'],
    ['Active Registered Users', s.activeUsers, 'Accounts', 'Users currently active and verified'],
    ['Inactive / Locked Users', s.deactiveUsers ?? 0, 'Accounts', 'Accounts deactivated or suspended'],
    ['Total Registered Tenants', s.totalTenants, 'Organizations', 'Enterprise clients & client organizations'],
    ['Active Operational Tenants', s.activeTenants, 'Organizations', 'Tenants currently actively serviced'],
    ['Total Registered Tickets', s.totalTickets, 'Ticket Volume', 'Cumulative tickets across all departments'],
    ['Active Open Tickets', s.openTickets, 'Pending Workload', 'Tickets awaiting triage or initial assignment'],
    ['Active Departments', s.totalDepartments, 'Divisions', 'Total operational departments in matrix'],
    ['Pending Feedback Reviews', s.pendingFeedback, 'Citizen Quality', 'Customer feedback ratings awaiting staff review'],
  ];

  kpiItems.forEach((rowValues, idx) => {
    const r = masterSheet.addRow(rowValues);
    r.height = 21;
    styleDataCell(r.getCell(1), idx % 2 === 1, 'left');
    styleDataCell(r.getCell(2), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(3), idx % 2 === 1, 'center');
    styleDataCell(r.getCell(4), idx % 2 === 1, 'left');
    r.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_PALETTE.DARK_TEXT } };
  });

  masterSheet.addRow([]);

  // Section 2: SLA Health
  if (slaData && slaData.stats) {
    addSectionHeader(masterSheet, '2. SERVICE LEVEL AGREEMENT (SLA) HEALTH OVERVIEW', 1, 4, EXCEL_PALETTE.TEAL_ACCENT);
    const slaHead = masterSheet.addRow(['SLA Health Metric', 'Value', 'Benchmark Target', 'Compliance Status']);
    slaHead.height = 24;
    slaHead.eachCell((c) => styleHeaderCell(c));

    const withinSla = Number(slaData.stats.ticketsWithinSla || 0);
    const overdue = Number(slaData.stats.overdueTickets || 0);
    const complianceRate = Number(slaData.stats.slaCompliancePercentage || 100);

    const slaItems = [
      ['Tickets Fulfilled Within SLA', withinSla, '≥ 95%', 'Optimal Velocity'],
      ['Tickets Breached SLA / Overdue', overdue, '0 Target', overdue > 0 ? 'CRITICAL ATTENTION' : 'COMPLIANT'],
      ['Overall SLA Compliance Rate', `${complianceRate}%`, '≥ 95.0%', complianceRate >= 95 ? 'TARGET MET' : 'ATTENTION REQUIRED'],
    ];

    slaItems.forEach((rowValues, idx) => {
      const r = masterSheet.addRow(rowValues);
      r.height = 21;
      styleDataCell(r.getCell(1), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(2), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(3), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(4), idx % 2 === 1, 'center');
      r.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_PALETTE.DARK_TEXT } };
    });
    masterSheet.addRow([]);
  }

  autoEnlargeColumns(masterSheet, 14);

  // ── TAB 2: RECENT TICKETS LEDGER ──────────────────────────────────────────
  if (dashboardData.recentTickets && dashboardData.recentTickets.length > 0) {
    const ticketSheet = workbook.addWorksheet('Recent Tickets', { views: [{ showGridLines: true }] });
    const tTitle = ticketSheet.addRow(['RECENT TICKET ACTIVITY & INFLOW LEDGER']);
    ticketSheet.mergeCells('A1:G1');
    tTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
    tTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PALETTE.NAVY_HEADER } };
    tTitle.height = 30;

    const tHead = ticketSheet.addRow([
      'Reference Number',
      'Ticket Title',
      'Status',
      'Priority',
      'Client / Tenant',
      'Department',
      'Logged Date',
    ]);
    tHead.height = 24;
    tHead.eachCell((c) => styleHeaderCell(c));

    dashboardData.recentTickets.forEach((t, idx) => {
      const r = ticketSheet.addRow([
        t.referenceNumber ? `#${t.referenceNumber}` : t.id,
        t.title,
        STATUS_LABELS[t.status as TicketStatus] || t.status,
        t.priority ? t.priority.toUpperCase() : 'NORMAL',
        t.tenantName || 'Standard Client',
        t.departmentName || 'General Helpdesk',
        new Date(t.createdAt).toLocaleString(),
      ]);
      r.height = 21;
      styleDataCell(r.getCell(1), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(2), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(3), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(4), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(5), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(6), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(7), idx % 2 === 1, 'center');
    });
    autoEnlargeColumns(ticketSheet, 14);
  }

  // ── TAB 3: RECENT USERS ──────────────────────────────────────────────────
  if (dashboardData.recentUsers && dashboardData.recentUsers.length > 0) {
    const userSheet = workbook.addWorksheet('Recent Users', { views: [{ showGridLines: true }] });
    const uTitle = userSheet.addRow(['RECENT USER REGISTRATIONS & ACCOUNTS']);
    userSheet.mergeCells('A1:E1');
    uTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_PALETTE.BLUE_BANNER } };
    uTitle.height = 30;

    const uHead = userSheet.addRow(['User ID', 'Full Name', 'Email Address', 'Assigned Role', 'Account Created']);
    uHead.height = 24;
    uHead.eachCell((c) => styleHeaderCell(c));

    dashboardData.recentUsers.forEach((u, idx) => {
      const r = userSheet.addRow([
        u.id,
        `${u.firstName} ${u.lastName}`,
        u.email,
        u.role ? u.role.toUpperCase() : 'USER',
        new Date(u.createdAt).toLocaleString(),
      ]);
      r.height = 21;
      styleDataCell(r.getCell(1), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(2), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(3), idx % 2 === 1, 'left');
      styleDataCell(r.getCell(4), idx % 2 === 1, 'center');
      styleDataCell(r.getCell(5), idx % 2 === 1, 'center');
    });
    autoEnlargeColumns(userSheet, 14);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(workbook, `HDMS_CommandCenter_Overview_${dateStr}.xlsx`);
}

