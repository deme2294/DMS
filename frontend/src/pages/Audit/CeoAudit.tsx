import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PrinterIcon,
  FunnelIcon,
  XMarkIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  UserIcon,
  TagIcon,
  ClockIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  KeyIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import DataTable from '../../components/Tables/DataTable';
import { fetchAuditLogs, exportAuditLogs } from '../../api/auditApi';
import type { AuditLog, AuditFilter } from '../../api/auditApi';
import { usePagination } from '../../hooks/usePagination';
import styles from './CeoAudit.module.css';

export default function CeoAudit() {
  const { page, limit, setPage, resetPage } = usePagination();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<AuditFilter>({});
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = [
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'assign',
    'unassign',
    'escalate',
    'resolve',
    'close',
    'status_change',
    'approve',
    'reject',
  ];

  const entities = [
    'ticket',
    'user',
    'department',
    'tenant',
    'notice',
    'knowledge',
    'sla',
    'feedback',
    'system',
  ];

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ ...filter, page, limit });
      setLogs(res.data.data);
      setTotalCount(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error('[CeoAudit] Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, page, limit]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = (newFilter: Partial<AuditFilter>) => {
    setFilter((prev) => ({ ...prev, ...newFilter }));
    resetPage();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAuditLogs(filter);
    } catch (err) {
      console.error('[CeoAudit] Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const setQuickDateRange = (preset: 'all' | 'today' | '7d' | '30d') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setFilter((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
      resetPage();
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
    }
    setFilter((prev) => ({ ...prev, startDate, endDate }));
    resetPage();
  };

  const clearFilters = () => {
    setFilter({});
    setActivePreset('all');
    resetPage();
  };

  const hasActiveFilters = !!(
    filter.userId ||
    filter.action ||
    filter.entity ||
    filter.startDate ||
    filter.endDate
  );

  const getActionBadgeClass = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('add') || act.includes('approve')) return styles.badgeSuccess;
    if (act.includes('delete') || act.includes('remove') || act.includes('reject')) return styles.badgeDanger;
    if (act.includes('update') || act.includes('edit') || act.includes('change')) return styles.badgePrimary;
    if (act.includes('login') || act.includes('auth')) return styles.badgeIndigo;
    if (act.includes('logout')) return styles.badgeMuted;
    if (act.includes('assign') || act.includes('escalat')) return styles.badgeWarning;
    return styles.badgeSecondary;
  };

  const getEntityBadgeClass = (entity: string) => {
    const ent = (entity || '').toLowerCase();
    if (ent.includes('ticket')) return styles.entityTicket;
    if (ent.includes('user')) return styles.entityUser;
    if (ent.includes('dept') || ent.includes('department')) return styles.entityDept;
    if (ent.includes('tenant')) return styles.entityTenant;
    if (ent.includes('knowledge') || ent.includes('notice')) return styles.entityKnowledge;
    return styles.entityDefault;
  };

  const copyDetailsJson = (details: string | undefined) => {
    if (!details) return;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Metrics summary
  const authEventsCount = logs.filter((l) => l.action.includes('login') || l.action.includes('logout')).length;
  const ticketEventsCount = logs.filter((l) => (l.entity || '').toLowerCase().includes('ticket')).length;
  const mutationEventsCount = logs.filter((l) => ['create', 'update', 'delete'].some((a) => l.action.includes(a))).length;

  return (
    <div className={styles.page}>
      {/* Print Header */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div>
            <h1 className={styles.printReportTitle}>Executive Audit Trail & Governance Log</h1>
            <p className={styles.printReportMeta}>
              Exported On: <strong>{new Date().toLocaleString()}</strong> | Records: <strong>{totalCount} Total Entries</strong>
            </p>
          </div>
          <div className={styles.printHeaderBadge}>
            CEO CONFIDENTIAL COMPLIANCE
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerBadge}>
            <ShieldCheckIcon className={styles.headerBadgeIcon} />
            <span>Executive Governance</span>
          </div>
          <h1 className={styles.title}>Executive Audit Trail</h1>
          <p className={styles.subtitle}>
            System-wide oversight of administrative activities, approval actions, authentication events, and critical entity changes.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={handlePrint}
            title="Print or export PDF report"
          >
            <PrinterIcon className={styles.btnIcon} />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            className={styles.primaryActionBtn}
            onClick={handleExport}
            disabled={exporting}
            title="Export full audit records with all columns as professional Excel (.xlsx)"
          >
            <ArrowDownTrayIcon className={styles.btnIcon} />
            <span>{exporting ? 'Generating...' : 'Export Audit (Excel)'}</span>
          </button>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={loadLogs}
            disabled={loading}
            title="Reload latest audit logs"
          >
            <ArrowPathIcon className={`${styles.btnIcon} ${loading ? styles.spinner : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>Total Matched Logs</span>
            <div className={`${styles.statIconWrap} ${styles.statIconBlue}`}>
              <DocumentTextIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{totalCount.toLocaleString()}</div>
          <div className={styles.statSub}>Full database ledger count</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>Auth & Security Events</span>
            <div className={`${styles.statIconWrap} ${styles.statIconPurple}`}>
              <KeyIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{authEventsCount}</div>
          <div className={styles.statSub}>Logins, logouts & session triggers</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>Ticket Operations</span>
            <div className={`${styles.statIconWrap} ${styles.statIconGreen}`}>
              <CheckCircleIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{ticketEventsCount}</div>
          <div className={styles.statSub}>Ticket status & lifecycle changes</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>Mutations & Changes</span>
            <div className={`${styles.statIconWrap} ${styles.statIconAmber}`}>
              <CubeIcon className={styles.statIcon} />
            </div>
          </div>
          <div className={styles.statValue}>{mutationEventsCount}</div>
          <div className={styles.statSub}>Creates, updates & deletions</div>
        </div>
      </div>

      {/* Filter Card */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <FunnelIcon className={styles.filterIcon} />
            <span>Search & Filter Executive Audit Records</span>
          </div>
          {hasActiveFilters && (
            <button type="button" className={styles.clearFilterBtn} onClick={clearFilters}>
              <XMarkIcon className={styles.btnIcon} />
              <span>Clear All Filters</span>
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
          </div>

          <div className={styles.filterInputsRow}>
            <div className={styles.searchInputWrapper}>
              <MagnifyingGlassIcon className={styles.inputFieldIcon} />
              <input
                type="text"
                placeholder="Search user ID / username..."
                className={styles.searchInput}
                value={filter.userId ?? ''}
                onChange={(e) => handleFilterChange({ userId: e.target.value || undefined })}
              />
            </div>

            <div className={styles.selectWrapper}>
              <TagIcon className={styles.inputFieldIcon} />
              <select
                className={styles.selectInput}
                value={filter.action ?? ''}
                onChange={(e) => handleFilterChange({ action: e.target.value || undefined })}
              >
                <option value="">All Action Types</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className={styles.selectWrapper}>
              <CubeIcon className={styles.inputFieldIcon} />
              <select
                className={styles.selectInput}
                value={filter.entity ?? ''}
                onChange={(e) => handleFilterChange({ entity: e.target.value || undefined })}
              >
                <option value="">All Target Entities</option>
                {entities.map((e) => (
                  <option key={e} value={e}>{e.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className={styles.dateInputWrapper}>
              <CalendarDaysIcon className={styles.inputFieldIcon} />
              <input
                type="date"
                className={styles.dateInput}
                value={filter.startDate ?? ''}
                onChange={(e) => {
                  setActivePreset('custom');
                  handleFilterChange({ startDate: e.target.value || undefined });
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
                  handleFilterChange({ endDate: e.target.value || undefined });
                }}
                title="End Date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        <DataTable<AuditLog>
          loading={loading}
          data={logs}
          emptyMessage="No matching audit records found."
          columns={[
            {
              key: 'username',
              label: 'Actor / User',
              render: (row) => (
                <div className={styles.actorCell}>
                  <div className={styles.actorAvatar}>
                    {(row.username || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.actorMeta}>
                    <span className={styles.actorName}>{row.username || 'System Automation'}</span>
                    {row.userId && <span className={styles.actorId}>ID: {row.userId}</span>}
                  </div>
                </div>
              ),
            },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <span className={`${styles.actionBadge} ${getActionBadgeClass(row.action)}`}>
                  {row.action}
                </span>
              ),
            },
            {
              key: 'entity',
              label: 'Target Entity',
              render: (row) => (
                <div className={styles.entityCell}>
                  <span className={`${styles.entityBadge} ${getEntityBadgeClass(row.entity)}`}>
                    {row.entity || 'system'}
                  </span>
                  {row.entityId && <span className={styles.entityIdTag}>#{row.entityId}</span>}
                </div>
              ),
            },
            {
              key: 'createdAt',
              label: 'Timestamp',
              render: (row) => {
                const date = new Date(row.createdAt);
                return (
                  <div className={styles.timeCell}>
                    <div className={styles.timeDate}>
                      <CalendarDaysIcon className={styles.miniIcon} />
                      <span>{date.toLocaleDateString()}</span>
                    </div>
                    <div className={styles.timeClock}>
                      <ClockIcon className={styles.miniIcon} />
                      <span>{date.toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'details',
              label: 'Activity Details',
              render: (row) => {
                if (!row.details) return <span className={styles.emptyDetails}>No additional payload</span>;
                return (
                  <div className={styles.detailsCell}>
                    <button
                      type="button"
                      className={styles.inspectBtn}
                      onClick={() => setSelectedLog(row)}
                      title="Inspect full audit details and payload"
                    >
                      <DocumentTextIcon className={styles.btnMiniIcon} />
                      <span>Inspect Details</span>
                    </button>
                    <span className={styles.detailsPreview}>
                      {typeof row.details === 'string'
                        ? row.details.length > 45
                          ? `${row.details.slice(0, 45)}...`
                          : row.details
                        : JSON.stringify(row.details).slice(0, 45)}
                    </span>
                  </div>
                );
              },
            },
          ]}
        />

        <div className={styles.paginationBar}>
          <div className={styles.paginationInfo}>
            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> (Total <strong>{totalCount}</strong> logs)
          </div>

          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeftIcon className={styles.btnIcon} />
              <span>Previous</span>
            </button>

            <div className={styles.pageNumberPill}>
              Page {page} / {totalPages}
            </div>

            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <span>Next</span>
              <ChevronRightIcon className={styles.btnIcon} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedLog && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <div className={styles.modalBadge}>
                  <DocumentTextIcon className={styles.modalBadgeIcon} />
                  <span>Audit Record Inspection</span>
                </div>
                <h2 className={styles.modalTitle}>Event Log #{selectedLog.id}</h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedLog(null)}
              >
                <XMarkIcon className={styles.btnIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalMetaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Action Type</span>
                  <span className={`${styles.actionBadge} ${getActionBadgeClass(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>

                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Target Entity</span>
                  <div className={styles.entityCell}>
                    <span className={`${styles.entityBadge} ${getEntityBadgeClass(selectedLog.entity)}`}>
                      {selectedLog.entity}
                    </span>
                    {selectedLog.entityId && (
                      <span className={styles.entityIdTag}>ID: {selectedLog.entityId}</span>
                    )}
                  </div>
                </div>

                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Actor (User)</span>
                  <span className={styles.metaValueBold}>{selectedLog.username || 'System'}</span>
                  {selectedLog.userId && <span className={styles.metaSub}>User ID: {selectedLog.userId}</span>}
                </div>

                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Timestamp</span>
                  <span className={styles.metaValue}>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  <span className={styles.metaSub}>{selectedLog.createdAt}</span>
                </div>
              </div>

              <div className={styles.payloadSection}>
                <div className={styles.payloadHeader}>
                  <span className={styles.payloadTitle}>Activity Payload & Changes</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyDetailsJson(selectedLog.details)}
                  >
                    <ClipboardDocumentCheckIcon className={styles.btnMiniIcon} />
                    <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>

                <div className={styles.payloadContent}>
                  {(() => {
                    try {
                      const parsed = typeof selectedLog.details === 'string'
                        ? JSON.parse(selectedLog.details)
                        : selectedLog.details;
                      return (
                        <pre className={styles.jsonCode}>
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      );
                    } catch {
                      return (
                        <pre className={styles.jsonCode}>
                          {selectedLog.details || 'No payload details stored for this event.'}
                        </pre>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalClosePrimaryBtn}
                onClick={() => setSelectedLog(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
