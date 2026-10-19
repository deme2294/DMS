import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  FunnelIcon,
  TicketIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  TagIcon,
  FireIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchTicketReport,
  fetchDepartmentReport,
  fetchStaffReport,
  fetchTenantReport,
  exportReport,
} from '../../api/reportApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type {
  TicketReport,
  DepartmentReport,
  StaffReport,
  TenantReport,
  ReportFilter,
} from '../../api/reportApi';
import styles from './Reports.module.css';

export default function CeoReports() {
  const [ticketReport, setTicketReport] = useState<TicketReport | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [tenantReport, setTenantReport] = useState<TenantReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [filter, setFilter] = useState<ReportFilter>({});
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7d' | '30d' | 'month' | 'last_month' | 'custom'>('all');
  const [exportingType, setExportingType] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [tickets, depts, staff, tenants] = await Promise.all([
        fetchTicketReport(filter),
        fetchDepartmentReport(filter),
        fetchStaffReport(filter),
        fetchTenantReport(filter),
      ]);
      setTicketReport(tickets.data.data);
      setDepartmentReport(depts.data.data);
      setStaffReport(staff.data.data);
      setTenantReport(tenants.data.data);
    } catch (err) {
      console.error('[CeoReports] Error fetching reports:', err);
      setTicketReport(null);
      setDepartmentReport(null);
      setStaffReport(null);
      setTenantReport(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    fetchActiveDepartments()
      .then((res) => setAllDepartments(res.data.data))
      .catch(() => {});
  }, []);

  const handleExport = async (type: 'tickets' | 'departments' | 'staff' | 'tenants' | 'comprehensive' | 'all') => {
    setExportingType(type);
    try {
      await exportReport(type, filter);
    } catch (err) {
      console.error('[CeoReports] Export error:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setQuickDateRange = (preset: 'all' | 'today' | '7d' | '30d' | 'month' | 'last_month') => {
    const now = new Date();
    if (preset === 'all') {
      setActivePreset('all');
      setFilter((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
      return;
    }
    const endDate = formatLocalDate(now);
    let startDate = '';

    if (preset === 'today') {
      startDate = endDate;
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDate = formatLocalDate(d);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = formatLocalDate(d);
    } else if (preset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatLocalDate(d);
    } else if (preset === 'last_month') {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      setActivePreset('last_month');
      setFilter((prev) => ({
        ...prev,
        startDate: formatLocalDate(startOfLast),
        endDate: formatLocalDate(endOfLast),
      }));
      return;
    }
    setActivePreset(preset);
    setFilter((prev) => ({ ...prev, startDate, endDate }));
  };

  const clearFilters = () => {
    setActivePreset('all');
    setFilter({});
  };

  // Calculations
  const totalTickets = ticketReport?.totalTickets ?? 0;
  const resolvedTickets = (ticketReport?.resolved ?? 0) + (ticketReport?.closed ?? 0);
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
  const inProgressTickets = ticketReport?.inProgress ?? 0;
  const pendingTickets = ticketReport?.pending ?? 0;

  const hasActiveFilters = !!(filter.startDate || filter.endDate || filter.departmentId);

  return (
    <div className={styles.page}>
      {/* Printable Report Header */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div>
            <h1 className={styles.printReportTitle}>Help Desk Management System — Executive Board Report</h1>
            <p className={styles.printReportMeta}>
              Generated On: <strong>{new Date().toLocaleString()}</strong> | Report Scope: <strong>Chief Executive Officer & Board Oversight</strong>
            </p>
          </div>
          <div className={styles.printHeaderBadge}>
            CONFIDENTIAL EXECUTIVE REPORT
          </div>
        </div>
        <div className={styles.printFilterSummary}>
          <span>Active Filters:</span>
          <strong>{filter.startDate ? `From: ${filter.startDate}` : 'Start: All Time'}</strong>
          <strong>{filter.endDate ? `To: ${filter.endDate}` : 'To: Present'}</strong>
          {filter.departmentId && <strong>Department Scoped</strong>}
        </div>
      </div>

      {/* Page Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerBadge}>
            <ChartBarIcon className={styles.headerBadgeIcon} />
            <span>Executive Governance</span>
          </div>
          <h1 className={styles.title}>Executive Reports & Operational Analytics</h1>
          <p className={styles.subtitle}>
            High-level organizational intelligence, resolution speed benchmarks, department efficiency metrics, and staff throughput.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={handlePrintReport}
            title="Export / Print interactive report with graphs and charts as PDF"
          >
            <PrinterIcon className={styles.btnIcon} />
            <span>Print / PDF Report</span>
          </button>

          <button
            type="button"
            className={styles.primaryActionBtn}
            onClick={() => handleExport('comprehensive')}
            disabled={exportingType !== null}
            title="Export full comprehensive report with all columns and graph trend data as CSV"
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exportingType === 'comprehensive' ? 'Generating All Columns...' : 'Export Full Report (Excel / All Columns)'}</span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <FunnelIcon className={styles.filterIcon} />
            <span>Filter Metrics & Date Range</span>
          </div>
          {hasActiveFilters && (
            <button type="button" className={styles.clearFilterBtn} onClick={clearFilters}>
              <XMarkIcon className={styles.btnIcon} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className={styles.filterControls}>
          <div className={styles.quickPresets}>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === 'all' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === 'today' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === '7d' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('7d')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === '30d' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('30d')}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === 'month' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('month')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${activePreset === 'last_month' ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('last_month')}
            >
              Last Month
            </button>
          </div>

          <div className={styles.filterInputsRow}>
            <div className={styles.dateInputWrapper}>
              <CalendarDaysIcon className={styles.inputFieldIcon} />
              <input
                type="date"
                className={styles.dateInput}
                value={filter.startDate ?? ''}
                onChange={(e) => {
                  setActivePreset('custom');
                  setFilter((prev) => ({ ...prev, startDate: e.target.value || undefined }));
                }}
                title="Start Date"
              />
            </div>

            <span className={styles.dateDivider}>to</span>

            <div className={styles.dateInputWrapper}>
              <CalendarDaysIcon className={styles.inputFieldIcon} />
              <input
                type="date"
                className={styles.dateInput}
                value={filter.endDate ?? ''}
                onChange={(e) => {
                  setActivePreset('custom');
                  setFilter((prev) => ({ ...prev, endDate: e.target.value || undefined }));
                }}
                title="End Date"
              />
            </div>

            <div className={styles.selectWrapper}>
              <BuildingOffice2Icon className={styles.inputFieldIcon} />
              <select
                className={styles.deptSelect}
                value={filter.departmentId ?? ''}
                onChange={(e) => setFilter((prev) => ({ ...prev, departmentId: e.target.value || undefined }))}
              >
                <option value="">All Departments</option>
                {allDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={loadReports}
              disabled={loading}
              title="Refresh reports"
            >
              <ArrowPathIcon className={`${styles.btnIcon} ${loading ? styles.spinner : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Status Notice Banner */}
      {hasActiveFilters && (
        <div className={`${styles.activeFilterNotice} ${totalTickets === 0 ? styles.activeFilterNoticeEmpty : ''}`}>
          <div className={styles.activeFilterNoticeLeft}>
            <FunnelIcon className={styles.activeFilterNoticeIcon} />
            <span>
              {totalTickets === 0 ? (
                <>
                  No tickets found for filter range: <strong>{filter.startDate || 'Beginning'}</strong> to <strong>{filter.endDate || 'Present'}</strong>
                  {filter.departmentId ? ' (department scoped)' : ''}. Displaying empty metrics for this period.
                </>
              ) : (
                <>
                  Filtered by: <strong>{filter.startDate || 'Beginning'}</strong> to <strong>{filter.endDate || 'Present'}</strong>
                  {filter.departmentId ? ' (department scoped)' : ''} &bull; <strong>{totalTickets}</strong> ticket(s) found.
                </>
              )}
            </span>
          </div>
          <button type="button" className={styles.resetFilterLink} onClick={clearFilters}>
            Reset to All Time
          </button>
        </div>
      )}

      {/* KPI Stats Overview Cards */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Total Tickets Volume</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxBlue}`}>
              <TicketIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{totalTickets.toLocaleString()}</div>
          <div className={styles.statSubtext}>
            {totalTickets === 0 && hasActiveFilters ? (
              <span className={styles.statSubMuted}>0 in progress • 0 pending</span>
            ) : (
              <>
                <span className={styles.statSubHighlight}>{resolvedTickets} resolved</span> • <span>{pendingTickets + inProgressTickets} active</span>
              </>
            )}
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Resolved Tickets</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxGreen}`}>
              <CheckCircleIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{resolvedTickets.toLocaleString()}</div>
          <div className={styles.statSubtext}>
            <span className={totalTickets === 0 ? styles.statSubMuted : styles.statValueGreen}>{resolutionRate}%</span> resolution rate
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardAmber}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Open & In-Progress</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxAmber}`}>
              <ClockIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{(inProgressTickets + pendingTickets).toLocaleString()}</div>
          <div className={styles.statSubtext}>
            <span className={styles.statSubHighlight}>{inProgressTickets} being handled</span> • <span>{pendingTickets} pending</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Resolution Efficiency</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxPurple}`}>
              <ChartBarIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={`${styles.statValue} ${resolutionRate >= 70 ? styles.statValueGreen : styles.statValueAmber}`}>{resolutionRate}%</div>
          <div className={styles.statSubtext}>Turnaround target: ≥ 85%</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Avg Turnaround Time</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxPink}`}>
              <FireIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>
            {ticketReport?.avgResolutionHours && totalTickets > 0 ? `${ticketReport.avgResolutionHours.toFixed(1)}h` : '0.0h'}
          </div>
          <div className={styles.statSubtext}>{totalTickets === 0 ? 'No resolved tickets in period' : 'Average hours to resolution'}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Active Entities</span>
            <div className={`${styles.statIconBox} ${styles.iconBoxEmerald}`}>
              <BuildingStorefrontIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>
            {hasActiveFilters && totalTickets === 0
              ? 0
              : (departmentReport?.activeDepartments ?? departmentReport?.departmentPerformance?.length ?? 0) +
                (staffReport?.activeStaff ?? staffReport?.staffPerformance?.length ?? 0)}
          </div>
          <div className={styles.statSubtext}>
            <span>
              {hasActiveFilters && totalTickets === 0
                ? '0 depts • 0 staff'
                : `${departmentReport?.activeDepartments ?? departmentReport?.departmentPerformance?.length ?? 0} depts • ${staffReport?.activeStaff ?? staffReport?.staffPerformance?.length ?? 0} staff`}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Status & Priority Distributions */}
      <div className={styles.twoColGrid}>
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <ChartBarIcon className={styles.sectionTitleIcon} style={{ color: '#2563eb' }} />
              <div>
                <h2 className={styles.sectionHeading}>Ticket Status Distribution</h2>
                <span className={styles.sectionSub}>Breakdown of ticket workflow lifecycle</span>
              </div>
            </div>
          </div>

          <div className={styles.breakdownList}>
            {Object.entries(ticketReport?.statusCounts ?? {}).map(([st, count]) => {
              const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
              return (
                <div key={st} className={styles.breakdownItem}>
                  <div className={styles.breakdownLabelRow}>
                    <span className={styles.breakdownKey} style={{ textTransform: 'capitalize' }}>
                      {st.replace('_', ' ')}
                    </span>
                    <span className={styles.breakdownCount}>
                      {count} <span className={styles.breakdownPct}>({pct}%)</span>
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progressFill} ${
                        st === 'resolved' || st === 'closed'
                          ? styles.fillGreen
                          : st === 'in_progress'
                          ? styles.fillYellow
                          : st === 'rejected'
                          ? styles.fillRed
                          : styles.fillBlue
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <FireIcon className={styles.sectionTitleIcon} style={{ color: '#ef4444' }} />
              <div>
                <h2 className={styles.sectionHeading}>Ticket Priority Breakdown</h2>
                <span className={styles.sectionSub}>Severity tier capacity allocation</span>
              </div>
            </div>
          </div>

          <div className={styles.breakdownList}>
            {Object.entries(ticketReport?.priorityCounts ?? {}).map(([pr, count]) => {
              const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
              return (
                <div key={pr} className={styles.breakdownItem}>
                  <div className={styles.breakdownLabelRow}>
                    <span className={styles.breakdownKey} style={{ textTransform: 'capitalize' }}>
                      {pr} Priority
                    </span>
                    <span className={styles.breakdownCount}>
                      {count} <span className={styles.breakdownPct}>({pct}%)</span>
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progressFill} ${
                        pr === 'urgent'
                          ? styles.fillRed
                          : pr === 'high'
                          ? styles.fillYellow
                          : pr === 'medium'
                          ? styles.fillBlue
                          : styles.fillMuted
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Trend Activity */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <ChartBarIcon className={styles.sectionTitleIcon} style={{ color: '#10b981' }} />
            <div>
              <h2 className={styles.sectionHeading}>Monthly Inflow Trend</h2>
              <span className={styles.sectionSub}>Historical monthly volume trajectory</span>
            </div>
          </div>
        </div>

        {(ticketReport?.monthlyTrend ?? []).length > 0 ? (
          <div className={styles.monthlyTrendContainer}>
            {(ticketReport?.monthlyTrend ?? []).map((m) => {
              const maxCount = Math.max(...(ticketReport?.monthlyTrend ?? []).map((x) => x.count), 1);
              const heightPct = Math.max(Math.round((m.count / maxCount) * 100), 8);
              return (
                <div key={m.month} className={styles.trendColumn}>
                  <div className={styles.trendCountBadge}>{m.count}</div>
                  <div className={styles.trendBarTrack}>
                    <div className={styles.trendBarFill} style={{ height: `${heightPct}%` }} />
                  </div>
                  <div className={styles.trendMonthLabel}>{m.month}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyNotice}>No ticket inflow activity recorded for this period.</div>
        )}
      </div>

      {/* Department Performance Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <BuildingOffice2Icon className={styles.sectionTitleIcon} style={{ color: '#2563eb' }} />
            <div>
              <h2 className={styles.sectionHeading}>Department Operational Performance</h2>
              <span className={styles.sectionSub}>Workload distribution and resolution efficiency per department</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={() => handleExport('departments')}
            disabled={exportingType !== null}
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exportingType === 'departments' ? 'Exporting...' : 'Export Departments CSV'}</span>
          </button>
        </div>

        <DataTable<{ id: string; name: string; totalTickets: number; openTickets: number; inProgressTickets: number; resolvedTickets: number; closedTickets: number; avgResolutionTime: number; resolutionRate: number }>
          loading={loading}
          data={(departmentReport?.departmentPerformance ?? []).map((r) => {
            const tot = Number(r.totalTickets || 0);
            const res = Number(r.resolvedTickets || 0) + Number(r.closedTickets || 0);
            return {
              ...r,
              resolutionRate: tot > 0 ? Math.round((res / tot) * 100) : 0,
            };
          })}
          emptyMessage="No department performance data available"
          columns={[
            {
              key: 'name',
              label: 'Department',
              render: (row) => (
                <div className={styles.tableDeptName}>
                  <BuildingOffice2Icon className={styles.inlineTableIcon} />
                  <span>{row.name}</span>
                </div>
              ),
            },
            { key: 'totalTickets', label: 'Total', render: (row) => <span className={styles.tableNumberBold}>{row.totalTickets}</span> },
            { key: 'openTickets', label: 'Open', render: (row) => <span className={styles.statusOpenText}>{row.openTickets}</span> },
            { key: 'inProgressTickets', label: 'In Progress', render: (row) => <span className={styles.statusProgText}>{row.inProgressTickets}</span> },
            { key: 'resolvedTickets', label: 'Resolved', render: (row) => <span className={styles.statusResText}>{row.resolvedTickets}</span> },
            { key: 'closedTickets', label: 'Closed', render: (row) => <span className={styles.statusClosedText}>{row.closedTickets}</span> },
            {
              key: 'resolutionRate',
              label: 'Efficiency Rate',
              render: (row) => (
                <span className={`${styles.efficiencyTag} ${row.resolutionRate >= 70 ? styles.efficiencyHigh : styles.efficiencyLow}`}>
                  {row.resolutionRate}%
                </span>
              ),
            },
            {
              key: 'avgResolutionTime',
              label: 'Avg Turnaround',
              render: (row) => row.avgResolutionTime ? `${Number(row.avgResolutionTime).toFixed(1)} hrs` : '—',
            },
          ]}
        />
      </div>

      {/* Staff Technician Performance Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <UserGroupIcon className={styles.sectionTitleIcon} style={{ color: '#7c3aed' }} />
            <div>
              <h2 className={styles.sectionHeading}>Staff Member Performance</h2>
              <span className={styles.sectionSub}>Assigned ticket workload and resolution statistics</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={() => handleExport('staff')}
            disabled={exportingType !== null}
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exportingType === 'staff' ? 'Exporting...' : 'Export Staff CSV'}</span>
          </button>
        </div>

        <DataTable<{ id: string; name: string; ticketCount: number; inProgressCount: number; resolvedCount: number; resolutionRate: number; avgRating?: number }>
          loading={loading}
          data={(staffReport?.staffPerformance ?? []).map((r) => {
            const tot = Number(r.ticketCount || 0);
            const res = Number(r.resolvedCount || 0);
            return {
              ...r,
              resolutionRate: tot > 0 ? Math.round((res / tot) * 100) : 0,
            };
          })}
          emptyMessage="No staff performance records available"
          columns={[
            {
              key: 'name',
              label: 'Staff Member',
              render: (row) => (
                <div className={styles.tableStaffName}>
                  <div className={styles.staffAvatar}>
                    {row.name.charAt(0)}
                  </div>
                  <span>{row.name}</span>
                </div>
              ),
            },
            { key: 'ticketCount', label: 'Assigned', render: (row) => <span className={styles.tableNumberBold}>{row.ticketCount}</span> },
            { key: 'inProgressCount', label: 'In Progress', render: (row) => <span className={styles.statusProgText}>{row.inProgressCount}</span> },
            { key: 'resolvedCount', label: 'Resolved', render: (row) => <span className={styles.statusResText}>{row.resolvedCount}</span> },
            {
              key: 'resolutionRate',
              label: 'Completion',
              render: (row) => (
                <span className={`${styles.efficiencyTag} ${row.resolutionRate >= 70 ? styles.efficiencyHigh : styles.efficiencyNeutral}`}>
                  {row.resolutionRate}%
                </span>
              ),
            },
            {
              key: 'avgRating',
              label: 'Avg Rating',
              render: (row) => row.avgRating ? `⭐ ${row.avgRating.toFixed(1)}` : '—',
            },
          ]}
        />
      </div>

      {/* Tenant Activity Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <BuildingStorefrontIcon className={styles.sectionTitleIcon} style={{ color: '#db2777' }} />
            <div>
              <h2 className={styles.sectionHeading}>Tenant & Organization Activity</h2>
              <span className={styles.sectionSub}>Ticket engagement across client organizations</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={() => handleExport('tenants')}
            disabled={exportingType !== null}
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exportingType === 'tenants' ? 'Exporting...' : 'Export Tenants CSV'}</span>
          </button>
        </div>

        <DataTable<{ id: string; organizationName: string; ticketCount: number; userCount: number }>
          loading={loading}
          data={tenantReport?.tenantActivity ?? []}
          emptyMessage="No tenant activity records available"
          columns={[
            {
              key: 'organizationName',
              label: 'Organization',
              render: (row) => (
                <div className={styles.tableTenantName}>
                  <BuildingStorefrontIcon className={styles.inlineTableIcon} />
                  <span>{row.organizationName}</span>
                </div>
              ),
            },
            { key: 'ticketCount', label: 'Total Tickets', render: (row) => <span className={styles.tableNumberBold}>{row.ticketCount}</span> },
          ]}
        />
      </div>
    </div>
  );
}
