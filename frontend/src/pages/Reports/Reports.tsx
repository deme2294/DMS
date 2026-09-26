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
  DocumentChartBarIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchTicketReport,
  fetchDepartmentReport,
  fetchStaffReport,
  fetchTenantReport,
  fetchMyDepartments,
  exportReport,
} from '../../api/reportApi';
import type { MyDepartment } from '../../api/reportApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type {
  TicketReport,
  DepartmentReport,
  StaffReport,
  TenantReport,
  ReportFilter,
} from '../../api/reportApi';
import { useAuth } from '../../context/AuthContext';
import styles from './Reports.module.css';

export default function Reports() {
  const { user } = useAuth();
  const [ticketReport, setTicketReport] = useState<TicketReport | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [tenantReport, setTenantReport] = useState<TenantReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [myDepts, setMyDepts] = useState<MyDepartment[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [filter, setFilter] = useState<ReportFilter>({});
  const [exportingType, setExportingType] = useState<string | null>(null);

  const isManager = user?.role === 'manager';

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
      console.error('[Reports] Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const loadDepts = async () => {
      if (isManager) {
        try {
          const res = await fetchMyDepartments();
          setMyDepts(res.data.data);
        } catch { /* ignore */ }
      } else {
        try {
          const res = await fetchActiveDepartments();
          setAllDepartments(res.data.data);
        } catch { /* ignore */ }
      }
    };
    loadDepts();
  }, [isManager]);

  const handleExport = async (type: 'tickets' | 'departments' | 'staff' | 'tenants' | 'comprehensive' | 'all') => {
    setExportingType(type);
    try {
      await exportReport(type, filter);
    } catch (err) {
      console.error('[Reports] Export error:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const setQuickDateRange = (preset: 'all' | 'today' | '7d' | '30d' | 'month') => {
    const now = new Date();
    if (preset === 'all') {
      setFilter((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
      return;
    }
    const format = (d: Date) => d.toISOString().split('T')[0];
    const endDate = format(now);
    let startDate = '';

    if (preset === 'today') {
      startDate = endDate;
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDate = format(d);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = format(d);
    } else if (preset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = format(d);
    }
    setFilter((prev) => ({ ...prev, startDate, endDate }));
  };

  const clearFilters = () => {
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
      {/* Printable Report Header - Only visible during Print / PDF Export */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div>
            <h1 className={styles.printReportTitle}>Help Desk Management System — Analytics Report</h1>
            <p className={styles.printReportMeta}>
              Generated On: <strong>{new Date().toLocaleString()}</strong> | Report Scope: <strong>{isManager ? 'Department Manager' : 'Enterprise Administration'}</strong>
            </p>
          </div>
          <div className={styles.printHeaderBadge}>
            CONFIDENTIAL & EXECUTIVE ANALYTICS
          </div>
        </div>
        <div className={styles.printFilterSummary}>
          <span>Active Filters:</span>
          <strong>{filter.startDate ? `From: ${filter.startDate}` : 'Start: All Time'}</strong>
          <strong>{filter.endDate ? `To: ${filter.endDate}` : 'To: Present'}</strong>
          {filter.departmentId && <strong>Department Filter Applied</strong>}
        </div>
      </div>

      {/* Page Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerBadge}>
            <ChartBarIcon className={styles.headerBadgeIcon} />
            <span>Operational Analytics</span>
          </div>
          <h1 className={styles.title}>{isManager ? 'Department Performance Reports' : 'System Reports & Analytics'}</h1>
          <p className={styles.subtitle}>
            {isManager
              ? 'Real-time performance metrics, ticket throughput, resolution velocity, and staff activity for your assigned department(s).'
              : 'Enterprise-wide operational insights across all tickets, departments, staff technicians, and tenant organizations.'}
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
            <span>Print / PDF Graph Report</span>
          </button>

          <button
            type="button"
            className={styles.primaryActionBtn}
            onClick={() => handleExport('comprehensive')}
            disabled={exportingType !== null}
            title="Export full comprehensive report with all columns and graph trend data as CSV"
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exportingType === 'comprehensive' ? 'Generating All Columns...' : 'Export Full Report (All Columns)'}</span>
          </button>
        </div>
      </div>


      {/* Manager Scope Banner */}
      {isManager && myDepts.length > 0 && (
        <div className={styles.deptBadgeRow}>
          <BuildingOffice2Icon className={styles.deptBadgeRowIcon} />
          <span className={styles.deptBadgeLabel}>Scoped to Department(s):</span>
          <div className={styles.deptBadgePills}>
            {myDepts.map((d) => (
              <span key={d.id} className={styles.deptBadge}>{d.name} ({d.code})</span>
            ))}
          </div>
        </div>
      )}

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
          {/* Quick Preset Buttons */}
          <div className={styles.quickPresets}>
            <button
              type="button"
              className={`${styles.presetBtn} ${!filter.startDate && !filter.endDate ? styles.presetBtnActive : ''}`}
              onClick={() => setQuickDateRange('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setQuickDateRange('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setQuickDateRange('7d')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setQuickDateRange('30d')}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setQuickDateRange('month')}
            >
              This Month
            </button>
          </div>

          <div className={styles.filterInputsRow}>
            <div className={styles.dateInputWrapper}>
              <CalendarDaysIcon className={styles.inputFieldIcon} />
              <input
                type="date"
                className={styles.dateInput}
                value={filter.startDate ?? ''}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
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
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                title="End Date"
              />
            </div>

            {!isManager && (
              <div className={styles.selectWrapper}>
                <BuildingOffice2Icon className={styles.inputFieldIcon} />
                <select
                  className={styles.deptSelect}
                  value={filter.departmentId ?? ''}
                  onChange={(e) => setFilter({ ...filter, departmentId: e.target.value || undefined })}
                >
                  <option value="">All Departments</option>
                  {allDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={loadReports}
              disabled={loading}
              title="Refresh Report Data"
            >
              <ArrowPathIcon className={`${styles.btnIcon} ${loading ? styles.spinning : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Grid */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Total Tickets</span>
            <div className={styles.statIconBox} style={{ background: '#eff6ff', color: '#2563eb' }}>
              <TicketIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{totalTickets.toLocaleString()}</div>
          <div className={styles.statSubtext}>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{inProgressTickets} in progress</span> • {pendingTickets} pending
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Resolution Rate</span>
            <div className={styles.statIconBox} style={{ background: '#ecfdf5', color: '#16a34a' }}>
              <CheckCircleIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue} style={{ color: '#16a34a' }}>{resolutionRate}%</div>
          <div className={styles.statSubtext}>
            <span>{resolvedTickets} resolved / closed tickets</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardAmber}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Avg Resolution Time</span>
            <div className={styles.statIconBox} style={{ background: '#fffbeb', color: '#d97706' }}>
              <ClockIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue} style={{ color: '#d97706' }}>
            {ticketReport?.avgResolutionHours ? Number(ticketReport.avgResolutionHours).toFixed(1) : '0.0'}
            <span className={styles.statUnit}>hrs</span>
          </div>
          <div className={styles.statSubtext}>
            <span>Average turnaround per ticket</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>{isManager ? 'Active Sections' : 'Active Departments'}</span>
            <div className={styles.statIconBox} style={{ background: '#f0fdf4', color: '#15803d' }}>
              <BuildingOffice2Icon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{departmentReport?.activeDepartments ?? departmentReport?.totalDepartments ?? 0}</div>
          <div className={styles.statSubtext}>
            <span>Operational units</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Active Staff</span>
            <div className={styles.statIconBox} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <UserGroupIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{staffReport?.totalStaff ?? 0}</div>
          <div className={styles.statSubtext}>
            <span>Support agents</span>
          </div>
        </div>

        {!isManager && (
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Active Tenants</span>
              <div className={styles.statIconBox} style={{ background: '#fdf2f8', color: '#db2777' }}>
                <BuildingStorefrontIcon className={styles.statIcon} />
              </div>
            </div>
            <div className={styles.statValue}>{tenantReport?.totalTenants ?? tenantReport?.activeTenants ?? 0}</div>
            <div className={styles.statSubtext}>
              <span>Registered organizations</span>
            </div>
          </div>
        )}
      </div>

      {/* Two-Column Analytics: Status Breakdown & Priority Breakdown */}
      <div className={styles.twoColGrid}>
        {/* Ticket Status Distribution */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <TicketIcon className={styles.sectionTitleIcon} style={{ color: '#2563eb' }} />
              <div>
                <h2 className={styles.sectionHeading}>Ticket Status Distribution</h2>
                <span className={styles.sectionSub}>Breakdown of ticket volume by current stage</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => handleExport('tickets')}
              disabled={exportingType !== null}
            >
              <ArrowDownTrayIcon className={styles.btnIcon} />
              <span>CSV</span>
            </button>
          </div>

          <div className={styles.distributionList}>
            {Object.entries(ticketReport?.statusCounts ?? {}).map(([status, count]) => {
              const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
              return (
                <div key={status} className={styles.distRow}>
                  <div className={styles.distRowHeader}>
                    <span className={`${styles.badge} ${styles[status] || styles.badgeDefault}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    <div className={styles.distCountGroup}>
                      <span className={styles.distCount}>{count}</span>
                      <span className={styles.distPct}>{pct}%</span>
                    </div>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={`${styles.progressFill} ${styles[`fill_${status}`] || styles.fillDefault}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(ticketReport?.statusCounts ?? {}).length === 0 && (
              <div className={styles.emptyNotice}>No status records available for this period.</div>
            )}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <FireIcon className={styles.sectionTitleIcon} style={{ color: '#ea580c' }} />
              <div>
                <h2 className={styles.sectionHeading}>Priority Distribution</h2>
                <span className={styles.sectionSub}>Severity classification of reported tickets</span>
              </div>
            </div>
          </div>

          <div className={styles.distributionList}>
            {Object.entries(ticketReport?.priorityCounts ?? {}).map(([priority, count]) => {
              const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
              return (
                <div key={priority} className={styles.distRow}>
                  <div className={styles.distRowHeader}>
                    <span className={`${styles.badge} ${styles[`priority_${priority}`] || styles.badgeDefault}`}>
                      {priority}
                    </span>
                    <div className={styles.distCountGroup}>
                      <span className={styles.distCount}>{count}</span>
                      <span className={styles.distPct}>{pct}%</span>
                    </div>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={`${styles.progressFill} ${styles[`fill_priority_${priority}`] || styles.fillDefault}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(ticketReport?.priorityCounts ?? {}).length === 0 && (
              <div className={styles.emptyNotice}>No priority records available for this period.</div>
            )}
          </div>
        </div>
      </div>

      {/* Two-Column Analytics: Categories & Resolution Velocity */}
      <div className={styles.twoColGrid}>
        {/* Ticket Categories */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <TagIcon className={styles.sectionTitleIcon} style={{ color: '#0ea5e9' }} />
              <div>
                <h2 className={styles.sectionHeading}>Category Analysis</h2>
                <span className={styles.sectionSub}>Ticket distribution across service categories</span>
              </div>
            </div>
          </div>

          <DataTable<{ id: string; category: string; count: number; share: string }>
            loading={loading}
            data={Object.entries(ticketReport?.categoryCounts ?? {}).map(([category, count]) => ({
              id: category,
              category: category || 'Uncategorized',
              count,
              share: totalTickets > 0 ? `${Math.round((count / totalTickets) * 100)}%` : '0%',
            }))}
            emptyMessage="No category data found"
            columns={[
              {
                key: 'category',
                label: 'Category',
                render: (row) => (
                  <span className={styles.categoryPill}>
                    <TagIcon className={styles.inlinePillIcon} />
                    {row.category}
                  </span>
                ),
              },
              {
                key: 'count',
                label: 'Tickets',
                render: (row) => <span className={styles.tableNumberBold}>{row.count}</span>,
              },
              {
                key: 'share',
                label: 'Share %',
                render: (row) => <span className={styles.tableShareTag}>{row.share}</span>,
              },
            ]}
          />
        </div>

        {/* Resolution Time Performance */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <ClockIcon className={styles.sectionTitleIcon} style={{ color: '#8b5cf6' }} />
              <div>
                <h2 className={styles.sectionHeading}>Resolution Velocity by Priority</h2>
                <span className={styles.sectionSub}>Average turnaround time from creation to resolution</span>
              </div>
            </div>
          </div>

          <DataTable<{ id: string; priority: string; avgHours: number; count: number }>
            loading={loading}
            data={(ticketReport?.resolutionTimeByPriority ?? []).map((r, i) => ({
              ...r,
              id: r.priority || String(i),
            }))}
            emptyMessage="No resolution velocity records found"
            columns={[
              {
                key: 'priority',
                label: 'Priority',
                render: (row) => (
                  <span className={`${styles.badge} ${styles[`priority_${row.priority}`] || styles.badgeDefault}`}>
                    {row.priority}
                  </span>
                ),
              },
              {
                key: 'avgHours',
                label: 'Avg Turnaround',
                render: (row) => (
                  <span className={styles.timeBadge}>
                    <ClockIcon className={styles.inlinePillIcon} />
                    {row.avgHours ? `${Number(row.avgHours).toFixed(1)} hrs` : '—'}
                  </span>
                ),
              },
              {
                key: 'count',
                label: 'Resolved Volume',
                render: (row) => <span className={styles.tableNumberBold}>{row.count}</span>,
              },
            ]}
          />
        </div>
      </div>

      {/* Monthly Trend Activity */}
      {(ticketReport?.monthlyTrend ?? []).length > 0 && (
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
        </div>
      )}

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
            { key: 'openTickets', label: 'Open', render: (row) => <span style={{ color: '#ef4444', fontWeight: 600 }}>{row.openTickets}</span> },
            { key: 'inProgressTickets', label: 'In Progress', render: (row) => <span style={{ color: '#f59e0b', fontWeight: 600 }}>{row.inProgressTickets}</span> },
            { key: 'resolvedTickets', label: 'Resolved', render: (row) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{row.resolvedTickets}</span> },
            { key: 'closedTickets', label: 'Closed', render: (row) => <span style={{ color: '#64748b' }}>{row.closedTickets}</span> },
            {
              key: 'resolutionRate',
              label: 'Efficiency Rate',
              render: (row) => (
                <span className={styles.efficiencyTag} style={{ background: row.resolutionRate >= 70 ? '#ecfdf5' : '#fef3c7', color: row.resolutionRate >= 70 ? '#15803d' : '#b45309' }}>
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
            { key: 'inProgressCount', label: 'In Progress', render: (row) => <span style={{ color: '#f59e0b', fontWeight: 600 }}>{row.inProgressCount}</span> },
            { key: 'resolvedCount', label: 'Resolved', render: (row) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{row.resolvedCount}</span> },
            {
              key: 'resolutionRate',
              label: 'Completion',
              render: (row) => (
                <span className={styles.efficiencyTag} style={{ background: row.resolutionRate >= 70 ? '#ecfdf5' : '#f8fafc', color: row.resolutionRate >= 70 ? '#15803d' : '#475569' }}>
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

      {/* Tenant Activity Table (Admins / CEO) */}
      {!isManager && (
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
      )}
    </div>
  );
}

