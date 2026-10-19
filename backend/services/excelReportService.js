import ExcelJS from 'exceljs';

/**
 * Styling constants for professional Excel reports
 */
const COLORS = {
  NAVY_HEADER: 'FF1E293B',     // #1E293B Dark Slate
  BLUE_BANNER: 'FF2563EB',     // #2563EB Primary Blue
  LIGHT_BG: 'FFF8FAFC',        // #F8FAFC Zebra row
  BORDER_COLOR: 'FFCBD5E1',    // #CBD5E1 Slate Border
  WHITE: 'FFFFFFFF',
  DARK_TEXT: 'FF0F172A',
  MUTED_TEXT: 'FF64748B',
  ACCENT_GREEN: 'FF16A34A',
};

/**
 * Apply thin borders to a cell
 */
function applyBorders(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
  };
}

/**
 * Accurately determines if a cell is part of a title banner, merged section banner, or subtitle
 */
function isMergedOrBannerCell(sheet, cell) {
  // Slave cells in a merge range
  if (cell.isMerged) return true;

  // Master cells of merged ranges tracked in worksheet _merges
  if (sheet._merges) {
    for (const key of Object.keys(sheet._merges)) {
      const m = sheet._merges[key];
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
        if (c1 !== c2 && cell.row >= r1 && cell.row <= r2) {
          return true;
        }
      }
    }
  }

  // Rows 1 to 3 are always top-level report title and metadata banners
  if (cell.row <= 3) return true;

  // Banner text patterns
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
      val.includes('TRENDS')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Automatically adjusts column widths precisely based on data & header content length.
 * Prevents truncation, expands to accommodate actual strings, and wraps long text cleanly.
 */
function autoFitColumns(sheet, defaultMinWidth = 14, defaultMaxWidth = 85) {
  if (!sheet.columns) return;

  sheet.columns.forEach((column) => {
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
 * Style a section title banner across specified columns
 */
function addSectionBanner(sheet, title, startCol = 1, endCol = 8) {
  const row = sheet.addRow([title]);
  sheet.mergeCells(row.number, startCol, row.number, endCol);
  const cell = row.getCell(startCol);
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BLUE_BANNER } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  row.height = 30;
  return row;
}

/**
 * Style a table header row
 */
function styleHeaderRow(row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    applyBorders(cell);
  });
}

/**
 * Style a data row with optional zebra striping
 */
function styleDataRow(row, isZebra = false) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.DARK_TEXT } };
    if (isZebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LIGHT_BG } };
    }
    cell.alignment = { vertical: 'middle', wrapText: false };
    applyBorders(cell);
  });
}

/**
 * Builds a comprehensive multi-sheet Excel Workbook
 */
export async function generateComprehensiveWorkbook({ rawTickets, rawDepts, rawStaff, rawTenants }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DMS Help Desk System';
  workbook.created = new Date();

  const total = Number(rawTickets.stats?.total_tickets || 0);
  const resolved = Number(rawTickets.stats?.resolved || 0) + Number(rawTickets.stats?.closed || 0);
  const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // ============================================================================
  // TAB 1: MASTER SUMMARY (Structured single-page view with all sections)
  // ============================================================================
  const masterSheet = workbook.addWorksheet('Master Report', {
    views: [{ showGridLines: true }],
  });

  // Main Report Title
  const titleRow = masterSheet.addRow(['HELP DESK MANAGEMENT SYSTEM — COMPREHENSIVE ANALYTICS']);
  masterSheet.mergeCells('A1:J1');
  titleRow.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 36;

  // Subtitle
  const subRow = masterSheet.addRow([`Report Generated: ${new Date().toLocaleString()} | Scope: Enterprise-Wide Operations`]);
  masterSheet.mergeCells('A2:J2');
  subRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.MUTED_TEXT } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.height = 20;
  masterSheet.addRow([]);

  // Section 1: Executive KPIs
  addSectionBanner(masterSheet, '1. EXECUTIVE KPI SUMMARY', 1, 4);
  const kpiHeader = masterSheet.addRow(['Metric', 'Count / Value', 'Benchmark Indicator', 'Notes']);
  styleHeaderRow(kpiHeader);

  const kpis = [
    ['Total Registered Tickets', total, '100.0%', 'Total tickets received in system'],
    ['Resolved Tickets', Number(rawTickets.stats?.resolved || 0), `${total > 0 ? ((Number(rawTickets.stats?.resolved || 0) / total) * 100).toFixed(1) : 0}%`, 'Resolved by support staff'],
    ['Closed Tickets', Number(rawTickets.stats?.closed || 0), `${total > 0 ? ((Number(rawTickets.stats?.closed || 0) / total) * 100).toFixed(1) : 0}%`, 'Verified & closed by submitters'],
    ['In Progress Tickets', Number(rawTickets.stats?.in_progress || 0), `${total > 0 ? ((Number(rawTickets.stats?.in_progress || 0) / total) * 100).toFixed(1) : 0}%`, 'Currently actively being worked'],
    ['Pending / Submitted', Number(rawTickets.stats?.pending || 0), `${total > 0 ? ((Number(rawTickets.stats?.pending || 0) / total) * 100).toFixed(1) : 0}%`, 'Awaiting initial triage or review'],
    ['Overall Resolution Rate', `${resRate}%`, resRate >= 80 ? 'TARGET MET' : 'ATTENTION', 'Resolved + Closed vs Total'],
    ['Avg Resolution Turnaround', `${Number(rawTickets.stats?.avg_resolve_hours || 0).toFixed(1)} Hours`, '< 24h SLA', 'Average duration from creation to resolved'],
  ];
  kpis.forEach((kpi, idx) => {
    const row = masterSheet.addRow(kpi);
    styleDataRow(row, idx % 2 === 1);
  });
  masterSheet.addRow([]);

  // Section 2: Monthly Inflow Trend (Clean Series Data)
  addSectionBanner(masterSheet, '2. MONTHLY INFLOW TREND (TIME SERIES)', 1, 4);
  const monthHeader = masterSheet.addRow(['Reporting Month', 'Ticket Inflow Count', 'MoM Dynamic', 'Trend Indicator']);
  styleHeaderRow(monthHeader);
  let prevCount = null;
  (rawTickets.monthlyTrend || []).forEach((m, idx) => {
    const count = Number(m.count);
    let diffStr = 'Base';
    if (prevCount !== null) {
      const diff = count - prevCount;
      diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    }
    prevCount = count;
    const row = masterSheet.addRow([m.month, count, diffStr, count > 0 ? 'Active' : 'No Inflow']);
    styleDataRow(row, idx % 2 === 1);
  });
  masterSheet.addRow([]);

  // Section 3: Priority & Velocity
  addSectionBanner(masterSheet, '3. RESOLUTION VELOCITY BY PRIORITY', 1, 4);
  const priorityHeader = masterSheet.addRow(['Ticket Priority', 'Total Volume', 'Resolved Volume', 'Avg Turnaround (Hours)']);
  styleHeaderRow(priorityHeader);
  (rawTickets.resolutionByPriority || []).forEach((p, idx) => {
    const row = masterSheet.addRow([
      p.priority,
      Number(p.total_count || p.resolved_count || 0),
      Number(p.resolved_count || 0),
      Number(p.avg_resolve_hours || 0).toFixed(1),
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  masterSheet.addRow([]);

  // Section 4: Department Performance (All columns clearly formatted!)
  addSectionBanner(masterSheet, '4. DEPARTMENT OPERATIONAL PERFORMANCE', 1, 10);
  const deptHeader = masterSheet.addRow([
    'Dept ID',
    'Department Name',
    'Code',
    'Total Tickets',
    'Open / Pending',
    'In Progress',
    'Resolved',
    'Closed',
    'Success Rate',
    'Avg Turnaround (Hrs)'
  ]);
  styleHeaderRow(deptHeader);
  rawDepts.forEach((d, idx) => {
    const dTotal = Number(d.total_tickets || 0);
    const dResolved = Number(d.resolved || 0) + Number(d.closed || 0);
    const dRate = dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0;
    const row = masterSheet.addRow([
      d.id,
      d.name,
      d.code || 'N/A',
      dTotal,
      Number(d.open_tickets || 0),
      Number(d.in_progress || 0),
      Number(d.resolved || 0),
      Number(d.closed || 0),
      `${dRate}%`,
      Number(d.avg_resolve_hours || 0).toFixed(1),
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  masterSheet.addRow([]);

  // Section 5: Staff Performance Matrix (Full UUID, Full Email displayed!)
  addSectionBanner(masterSheet, '5. STAFF PERFORMANCE MATRIX', 1, 10);
  const staffHeader = masterSheet.addRow([
    'Staff ID',
    'Full Name',
    'Username',
    'Email Address',
    'Status',
    'Assigned Total',
    'In Progress',
    'Resolved Total',
    'Pending Workload',
    'Success Rate'
  ]);
  styleHeaderRow(staffHeader);
  rawStaff.forEach((s, idx) => {
    const sTotal = Number(s.total_assigned || 0);
    const sResolved = Number(s.resolved || 0);
    const sInProgress = Number(s.in_progress || 0);
    const sPending = Math.max(0, sTotal - sResolved);
    const sRate = sTotal > 0 ? Math.round((sResolved / sTotal) * 100) : 0;
    const row = masterSheet.addRow([
      s.id,
      `${s.first_name} ${s.last_name}`,
      s.username || 'N/A',
      s.email,
      s.status || 'active',
      sTotal,
      sInProgress,
      sResolved,
      sPending,
      `${sRate}%`
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  masterSheet.addRow([]);

  // Section 6: Tenant Activity Ledger
  addSectionBanner(masterSheet, '6. TENANT ACTIVITY LEDGER', 1, 8);
  const tenantHeader = masterSheet.addRow([
    'Tenant ID',
    'Organization Name',
    'Contact Email',
    'Total Volume',
    'Resolved Count',
    'Closed Count',
    'Active Open',
    'Resolution Rate'
  ]);
  styleHeaderRow(tenantHeader);
  rawTenants.forEach((t, idx) => {
    const tTotal = Number(t.total_tickets || 0);
    const tResolved = Number(t.resolved || 0) + Number(t.closed || 0);
    const tActive = Math.max(0, tTotal - tResolved);
    const tRate = tTotal > 0 ? Math.round((tResolved / tTotal) * 100) : 0;
    const row = masterSheet.addRow([
      t.tenant_id,
      t.organization_name,
      t.email || 'N/A',
      tTotal,
      Number(t.resolved || 0),
      Number(t.closed || 0),
      tActive,
      `${tRate}%`
    ]);
    styleDataRow(row, idx % 2 === 1);
  });

  autoFitColumns(masterSheet);

  // ============================================================================
  // TAB 2: MONTHLY TRENDS (Dedicated for Graphs & Series Plotting)
  // ============================================================================
  const trendSheet = workbook.addWorksheet('Monthly Inflow Trends', { views: [{ showGridLines: true }] });
  const trendTitle = trendSheet.addRow(['MONTHLY TICKET INFLOW & RESOLUTION TRENDS']);
  trendSheet.mergeCells('A1:C1');
  trendTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  trendTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  trendTitle.height = 30;

  const tHead = trendSheet.addRow(['Month (Period)', 'Total Inflow Tickets', 'Cumulative Percentage']);
  styleHeaderRow(tHead);
  let runningTotal = 0;
  (rawTickets.monthlyTrend || []).forEach((m, idx) => {
    const count = Number(m.count);
    runningTotal += count;
    const cumPct = total > 0 ? `${((runningTotal / total) * 100).toFixed(1)}%` : '0%';
    const row = trendSheet.addRow([m.month, count, cumPct]);
    styleDataRow(row, idx % 2 === 1);
  });
  autoFitColumns(trendSheet);

  // ============================================================================
  // TAB 3: DEPARTMENT PERFORMANCE (Dedicated Table)
  // ============================================================================
  const deptSheet = workbook.addWorksheet('Departments', { views: [{ showGridLines: true }] });
  const dTitle = deptSheet.addRow(['DEPARTMENT OPERATIONAL PERFORMANCE MATRIX']);
  deptSheet.mergeCells('A1:J1');
  dTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  dTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  dTitle.height = 30;

  const dHead2 = deptSheet.addRow([
    'Department ID',
    'Department Name',
    'Code',
    'Total Tickets',
    'Open / Pending',
    'In Progress',
    'Resolved',
    'Closed',
    'Resolution Rate (%)',
    'Avg Resolution (Hours)'
  ]);
  styleHeaderRow(dHead2);
  rawDepts.forEach((d, idx) => {
    const dTotal = Number(d.total_tickets || 0);
    const dResolved = Number(d.resolved || 0) + Number(d.closed || 0);
    const dRate = dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0;
    const row = deptSheet.addRow([
      d.id,
      d.name,
      d.code || 'N/A',
      dTotal,
      Number(d.open_tickets || 0),
      Number(d.in_progress || 0),
      Number(d.resolved || 0),
      Number(d.closed || 0),
      `${dRate}%`,
      Number(d.avg_resolve_hours || 0).toFixed(1)
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  autoFitColumns(deptSheet);

  // ============================================================================
  // TAB 4: STAFF MATRIX (Dedicated Table)
  // ============================================================================
  const staffSheet = workbook.addWorksheet('Staff Performance', { views: [{ showGridLines: true }] });
  const sTitle = staffSheet.addRow(['STAFF WORKLOAD & RESOLUTION PERFORMANCE']);
  staffSheet.mergeCells('A1:J1');
  sTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  sTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  sTitle.height = 30;

  const sHead2 = staffSheet.addRow([
    'Staff ID',
    'Full Name',
    'Username',
    'Email Address',
    'Account Status',
    'Total Assigned',
    'In Progress',
    'Resolved',
    'Pending Workload',
    'Resolution Rate (%)'
  ]);
  styleHeaderRow(sHead2);
  rawStaff.forEach((s, idx) => {
    const sTotal = Number(s.total_assigned || 0);
    const sResolved = Number(s.resolved || 0);
    const sInProgress = Number(s.in_progress || 0);
    const sPending = Math.max(0, sTotal - sResolved);
    const sRate = sTotal > 0 ? Math.round((sResolved / sTotal) * 100) : 0;
    const row = staffSheet.addRow([
      s.id,
      `${s.first_name} ${s.last_name}`,
      s.username || 'N/A',
      s.email,
      s.status || 'active',
      sTotal,
      sInProgress,
      sResolved,
      sPending,
      `${sRate}%`
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  autoFitColumns(staffSheet);

  // ============================================================================
  // TAB 5: TENANT ACTIVITY (Dedicated Table)
  // ============================================================================
  const tenantSheet = workbook.addWorksheet('Tenants', { views: [{ showGridLines: true }] });
  const tnTitle = tenantSheet.addRow(['TENANT ACTIVITY & ENGAGEMENT LEDGER']);
  tenantSheet.mergeCells('A1:H1');
  tnTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  tnTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  tnTitle.height = 30;

  const tnHead2 = tenantSheet.addRow([
    'Tenant ID',
    'Organization Name',
    'Email Address',
    'Total Tickets',
    'Resolved Tickets',
    'Closed Tickets',
    'Active Tickets',
    'Resolution Rate (%)'
  ]);
  styleHeaderRow(tnHead2);
  rawTenants.forEach((t, idx) => {
    const tTotal = Number(t.total_tickets || 0);
    const tResolved = Number(t.resolved || 0) + Number(t.closed || 0);
    const tActive = Math.max(0, tTotal - tResolved);
    const tRate = tTotal > 0 ? Math.round((tResolved / tTotal) * 100) : 0;
    const row = tenantSheet.addRow([
      t.tenant_id,
      t.organization_name,
      t.email || 'N/A',
      tTotal,
      Number(t.resolved || 0),
      Number(t.closed || 0),
      tActive,
      `${tRate}%`
    ]);
    styleDataRow(row, idx % 2 === 1);
  });
  autoFitColumns(tenantSheet);

  return workbook;
}

/**
 * Builds a single-domain Excel Workbook (for individual exports)
 */
export async function generateDomainWorkbook(title, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DMS Help Desk System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Report Data', { views: [{ showGridLines: true }] });

  // Title Banner
  const titleRow = sheet.addRow([title]);
  const colCount = Math.max(headers.length, 2);
  sheet.mergeCells(1, 1, 1, colCount);
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 32;

  // Subtitle
  const subRow = sheet.addRow([`Exported on: ${new Date().toLocaleString()} | Help Desk Management System`]);
  sheet.mergeCells(2, 1, 2, colCount);
  subRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.MUTED_TEXT } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.height = 18;
  sheet.addRow([]);

  // Headers
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  // Data rows
  rows.forEach((r, idx) => {
    const rowData = Array.isArray(r) ? r : headers.map((h) => r[h]);
    const row = sheet.addRow(rowData);
    styleDataRow(row, idx % 2 === 1);
  });

  autoFitColumns(sheet);
  return workbook;
}
