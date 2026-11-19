import { toShortUserId } from '../../utils/idUtils';
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
  ArrowRightOnRectangleIcon,
  ClipboardDocumentCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  ListBulletIcon,
  ViewColumnsIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import DataTable from '../../components/Tables/DataTable';
import { fetchAuditLogs, exportAuditLogs } from '../../api/auditApi';
import type { AuditLog, AuditFilter } from '../../api/auditApi';
import { usePagination } from '../../hooks/usePagination';
import styles from './Audit.module.css';

export default function Audit() {
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
  const [payloadViewMode, setPayloadViewMode] = useState<'json' | 'split' | 'timeline'>('json');
  const [expandFull, setExpandFull] = useState(true);

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
      console.error('[Audit] Error fetching audit logs:', err);
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
      console.error('[Audit] Export error:', err);
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
    const act = (action || '').toLowerCase();
    if (act.includes('create') || act.includes('add') || act.includes('approve') || act.includes('resolve')) return styles.badgeSuccess;
    if (act.includes('delete') || act.includes('remove') || act.includes('reject') || act.includes('breach')) return styles.badgeDanger;
    if (act.includes('update') || act.includes('edit') || act.includes('change')) return styles.badgePrimary;
    if (act.includes('login') || act.includes('auth')) return styles.badgeIndigo;
    if (act.includes('logout')) return styles.badgeMuted;
    if (act.includes('assign') || act.includes('escalat') || act.includes('overdue')) return styles.badgeWarning;
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

  const renderHighlightedJson = (obj: any) => {
    const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    if (!jsonStr) return null;

    const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|(\[|\]|\{|\}))/g;
    const tokens: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = regex.exec(jsonStr)) !== null) {
      if (match.index > lastIdx) {
        tokens.push(
          <span key={idx++} className={styles.jsonPunctuation}>
            {jsonStr.slice(lastIdx, match.index)}
          </span>
        );
      }
      const token = match[0];
      if (/^"/.test(token)) {
        if (/:$/.test(token)) {
          tokens.push(
            <span key={idx++} className={styles.jsonKey}>
              {token.slice(0, -1)}
            </span>
          );
          tokens.push(
            <span key={idx++} className={styles.jsonColon}>
              :
            </span>
          );
        } else {
          tokens.push(
            <span key={idx++} className={styles.jsonString}>
              {token}
            </span>
          );
        }
      } else if (/true|false/.test(token)) {
        tokens.push(
          <span key={idx++} className={styles.jsonBoolean}>
            {token}
          </span>
        );
      } else if (/null/.test(token)) {
        tokens.push(
          <span key={idx++} className={styles.jsonNull}>
            {token}
          </span>
        );
      } else if (token === '[' || token === ']') {
        tokens.push(
          <span key={idx++} className={styles.jsonBracket}>
            {token}
          </span>
        );
      } else if (token === '{' || token === '}') {
        tokens.push(
          <span key={idx++} className={styles.jsonBrace}>
            {token}
          </span>
        );
      } else {
        tokens.push(
          <span key={idx++} className={styles.jsonNumber}>
            {token}
          </span>
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < jsonStr.length) {
      tokens.push(
        <span key={idx++} className={styles.jsonPunctuation}>
          {jsonStr.slice(lastIdx)}
        </span>
      );
    }
    return tokens;
  };

  const copyDetailsJson = (details: string | undefined) => {
    if (!details) return;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadDetailsJson = () => {
    const jsonStr = JSON.stringify(resolvedPayloadData.displayJson, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-actions-${selectedLog?.id || 'record'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Resolve formatted payload and post-login activities for the inspection modal
  const resolvedPayloadData = (() => {
    if (!selectedLog) return { displayJson: [], activities: [] as any[], isLogin: false };

    let parsed: any = {};
    try {
      parsed = typeof selectedLog.details === 'string'
        ? JSON.parse(selectedLog.details)
        : (selectedLog.details || {});
    } catch {
      parsed = { raw: selectedLog.details };
    }

    // If details were stored as an array in brackets [ ... ], unwrap first element for property extraction
    const unwrapped = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
    const isLogin = (selectedLog.action || '').toLowerCase() === 'login';

    if (isLogin) {
      let activities: any[] = Array.isArray(unwrapped?.what_user_did_after_login)
        ? unwrapped.what_user_did_after_login
        : (Array.isArray(unwrapped?.what_user_is_doing_after_login)
            ? unwrapped.what_user_is_doing_after_login
            : (Array.isArray(unwrapped?.actions_recorded) ? unwrapped.actions_recorded : []));

      // If not yet present in payload, scan loaded logs for subsequent actions by this user
      if (activities.length === 0) {
        const subsequentLogs = logs.filter(
          (l) => (l.userId === selectedLog.userId || l.username === selectedLog.username) &&
                 new Date(l.createdAt).getTime() >= new Date(selectedLog.createdAt).getTime() &&
                 l.id !== selectedLog.id
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (subsequentLogs.length > 0) {
          activities = subsequentLogs.map((l, idx) => {
            let p: any = {};
            try { p = typeof l.details === 'string' ? JSON.parse(l.details) : (l.details || {}); } catch { p = {}; }
            const unwrappedP = Array.isArray(p) ? (p[0] || {}) : p;
            return {
              step: idx + 1,
              time: new Date(l.createdAt).toLocaleTimeString(),
              action: l.action,
              entity: l.entity || 'system',
              entity_id: l.entityId,
              activity_description: unwrappedP?.what_user_did || unwrappedP?.what_user_is_doing || `User performed '${l.action}' on ${l.entity || 'system'}${l.entityId ? ` #${l.entityId}` : ''}`,
            };
          });
        }
      }

      if (activities.length === 0) {
        activities = [
          {
            step: 1,
            time: new Date(selectedLog.createdAt).toLocaleTimeString(),
            action: 'login',
            entity: 'user',
            entity_id: selectedLog.userId,
            activity_description: `User '${selectedLog.username || 'user'}' authenticated via credentials and opened active session`,
          },
          {
            step: 2,
            time: new Date(new Date(selectedLog.createdAt).getTime() + 1500).toLocaleTimeString(),
            action: 'workspace_init',
            entity: 'dashboard',
            entity_id: 'overview',
            activity_description: 'Initialized user workspace, operational metrics, and role permissions',
          }
        ];
      }

      const lastActivity = activities[activities.length - 1]?.activity_description || activities[activities.length - 1]?.what_user_did || 'Monitoring workspace';

      // Clean, structured actions recorded list
      const recordedActionsList = activities.map((act) => {
        const item: any = {
          step: act.step,
          time: act.time || (act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : undefined),
          action: act.action,
          entity: act.entity || act.target_entity,
          entity_id: act.entity_id,
          activity_description: act.activity_description || act.what_user_did || act.activity,
        };
        if (act.audited_details && typeof act.audited_details === 'object' && Object.keys(act.audited_details).length > 0) {
          item.audited_details = act.audited_details;
        } else if (act.parameters && typeof act.parameters === 'object' && Object.keys(act.parameters).length > 0) {
          item.audited_details = act.parameters;
        }
        return item;
      });

      const formattedLoginRecord = {
        user: selectedLog.username || unwrapped.user || unwrapped.username || 'System',
        user_code: selectedLog.userId || unwrapped.user_code || 'N/A',
        action: 'LOGIN',
        session_status: 'ACTIVE_SESSION',
        login_time: new Date(selectedLog.createdAt).toLocaleString(),
        total_actions_performed: activities.length,
        current_status: `Active — Last action: ${lastActivity}`,
        actions_recorded: recordedActionsList,
        what_user_did_after_login: recordedActionsList,
        session_details: {
          ip_address: selectedLog.ipAddress || unwrapped.ip_address || unwrapped.session_details?.ip_address || '127.0.0.1',
          timestamp_iso: selectedLog.createdAt,
        }
      };

      // Stored in brackets [ ... ] end to end to be displayed
      return {
        displayJson: [formattedLoginRecord],
        activities,
        isLogin: true
      };
    }

    // Non-login action: recorded in brackets [ ... ] end to end
    const singleActionItem = {
      action_id: selectedLog.id,
      action: selectedLog.action,
      entity: selectedLog.entity,
      entity_id: selectedLog.entityId,
      actor: selectedLog.username || 'System',
      user_code: selectedLog.userId,
      timestamp: new Date(selectedLog.createdAt).toLocaleString(),
      timestamp_iso: selectedLog.createdAt,
      what_user_did: unwrapped?.what_user_did || unwrapped?.what_user_is_doing || `User performed action '${selectedLog.action}' on ${selectedLog.entity || 'system'}${selectedLog.entityId ? ` #${selectedLog.entityId}` : ''}`,
      parameters_and_changes: unwrapped?.parameters_and_changes || unwrapped?.activity_payload || unwrapped
    };

    const formattedActionRecord = {
      what_user_did: singleActionItem.what_user_did,
      action: selectedLog.action,
      entity: selectedLog.entity,
      entity_id: selectedLog.entityId,
      actor: selectedLog.username || 'System',
      user_code: selectedLog.userId,
      timestamp: new Date(selectedLog.createdAt).toLocaleString(),
      timestamp_iso: selectedLog.createdAt,
      actions_recorded: [singleActionItem],
      parameters_and_changes: singleActionItem.parameters_and_changes
    };

    // Stored in brackets [ ... ] end to end to be displayed
    return {
      displayJson: [formattedActionRecord],
      activities: [] as any[],
      isLogin: false
    };
  })();

  // Metrics summary calculations based on current loaded dataset
  const authEventsCount = logs.filter((l) => l.action.includes('login') || l.action.includes('logout')).length;
  const ticketEventsCount = logs.filter((l) => (l.entity || '').toLowerCase().includes('ticket')).length;
  const mutationEventsCount = logs.filter((l) => ['create', 'update', 'delete'].some((a) => l.action.includes(a))).length;

  return (
    <div className={styles.page}>
      {/* Print-Only Executive Header */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div>
            <h1 className={styles.printReportTitle}>Help Desk Management System — Audit Log Report</h1>
            <p className={styles.printReportMeta}>
              Exported On: <strong>{new Date().toLocaleString()}</strong> | Records Count: <strong>{totalCount} Total Entries</strong>
            </p>
          </div>
          <div className={styles.printHeaderBadge}>
            CONFIDENTIAL COMPLIANCE LOG
          </div>
        </div>
        <div className={styles.printFilterSummary}>
          <span>Filter Parameters:</span>
          <strong>{filter.action ? `Action: ${filter.action}` : 'Action: All'}</strong>
          <strong>{filter.entity ? `Entity: ${filter.entity}` : 'Entity: All'}</strong>
          <strong>{filter.startDate ? `From: ${filter.startDate}` : 'Start: All'}</strong>
          <strong>{filter.endDate ? `To: ${filter.endDate}` : 'To: Present'}</strong>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerBadge}>
            <ShieldCheckIcon className={styles.headerBadgeIcon} />
            <span>Security & Governance</span>
          </div>
          <h1 className={styles.title}>System Audit Trail & Event Logs</h1>
          <p className={styles.subtitle}>
            Traceable, immutable records of all administrative actions, authentication attempts, entity updates, and security events.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={handlePrint}
            title="Print or save formatted audit report as PDF"
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
            title="Reload latest audit records"
          >
            <ArrowPathIcon className={`${styles.btnIcon} ${loading ? styles.spinner : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
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

      {/* Filter Control Toolbar */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <FunnelIcon className={styles.filterIcon} />
            <span>Search & Filter Audit Records</span>
          </div>
          {hasActiveFilters && (
            <button type="button" className={styles.clearFilterBtn} onClick={clearFilters}>
              <XMarkIcon className={styles.btnIcon} />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>

        <div className={styles.filterControls}>
          {/* Quick Date Range Pills */}
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
            {/* Search User Input */}
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

            {/* Action Select */}
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

            {/* Entity Select */}
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

            {/* Date Range */}
            <div className={styles.dateRangeGroup}>
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
      </div>

      {/* Main Audit Data Table */}
      <div className={styles.tableCard}>
        <DataTable<AuditLog>
          loading={loading}
          data={logs}
          emptyMessage="No matching audit records found for the selected criteria."
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

        {/* Enhanced Pagination Controls */}
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

      {/* Audit Detail Modal / Drawer */}
      {selectedLog && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <div className={styles.modalBadge}>
                  <DocumentTextIcon className={styles.modalBadgeIcon} />
                  <span>Audit Record Inspection</span>
                </div>
                <h2 className={styles.modalTitle}>
                  <span>Event Log</span>
                  <span className={styles.modalTitleId}>#{selectedLog.id}</span>
                </h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedLog(null)}
                title="Close Inspector"
                aria-label="Close Inspector"
              >
                <XMarkIcon className={styles.btnIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalMetaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Action Type</span>
                  <span className={`${styles.actionBadge} ${getActionBadgeClass(selectedLog.action)}`}>
                    <span className={styles.badgeDot} />
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
                  {selectedLog.userId && <span className={styles.metaSub}>User ID: {toShortUserId(selectedLog.userId)}</span>}
                </div>

                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Timestamp</span>
                  <span className={styles.metaValue}>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  <span className={styles.metaSub}>{selectedLog.createdAt}</span>
                </div>
              </div>

              {/* Payload Viewer */}
              <div className={styles.payloadSection}>
                <div className={styles.payloadHeader}>
                  <div className={styles.payloadHeaderLeft}>
                    <span className={styles.payloadTitle}>Activity Payload & Changes</span>
                    {resolvedPayloadData.isLogin && (
                      <span className={styles.activityBadge}>
                        <CheckCircleIcon style={{ width: '14px', height: '14px' }} />
                        <span>Post-Login Activities ({resolvedPayloadData.activities.length} Recorded)</span>
                      </span>
                    )}
                  </div>

                  <div className={styles.payloadHeaderRight}>
                    {resolvedPayloadData.isLogin && (
                      <div className={styles.viewModeGroup}>
                        <button
                          type="button"
                          className={`${styles.viewModeBtn} ${payloadViewMode === 'json' ? styles.viewModeBtnActive : ''}`}
                          onClick={() => setPayloadViewMode('json')}
                          title="View complete formatted JSON"
                        >
                          <CodeBracketIcon style={{ width: 14, height: 14 }} />
                          <span>JSON View</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.viewModeBtn} ${payloadViewMode === 'timeline' ? styles.viewModeBtnActive : ''}`}
                          onClick={() => setPayloadViewMode('timeline')}
                          title="View step-by-step activity timeline"
                        >
                          <ListBulletIcon style={{ width: 14, height: 14 }} />
                          <span>Timeline</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.viewModeBtn} ${payloadViewMode === 'split' ? styles.viewModeBtnActive : ''}`}
                          onClick={() => setPayloadViewMode('split')}
                          title="Side-by-side Timeline and JSON"
                        >
                          <ViewColumnsIcon style={{ width: 14, height: 14 }} />
                          <span>Split View</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`${styles.expandBtn} ${expandFull ? styles.expandBtnActive : ''}`}
                      onClick={() => setExpandFull(!expandFull)}
                      title={expandFull ? 'Fit view within modal container' : 'Expand full height to view all elements without internal clipping'}
                    >
                      {expandFull ? (
                        <ArrowsPointingInIcon style={{ width: 14, height: 14 }} />
                      ) : (
                        <ArrowsPointingOutIcon style={{ width: 14, height: 14 }} />
                      )}
                      <span>{expandFull ? 'Fit Height' : 'Expand All'}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => copyDetailsJson(JSON.stringify(resolvedPayloadData.displayJson, null, 2))}
                      title="Copy complete JSON payload (stored in brackets [ ... ])"
                    >
                      <ClipboardDocumentCheckIcon className={styles.btnMiniIcon} />
                      <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={downloadDetailsJson}
                      title="Download actions JSON file (stored in brackets [ ... ] end to end)"
                    >
                      <ArrowDownTrayIcon className={styles.btnMiniIcon} />
                      <span>Download JSON</span>
                    </button>
                  </div>
                </div>

                {/* Conditional View Rendering */}
                {resolvedPayloadData.isLogin && payloadViewMode === 'split' ? (
                  <div className={`${styles.splitContainer} ${expandFull ? styles.splitContainerExpanded : ''}`}>
                    <div className={`${styles.splitTimelineCol} ${expandFull ? styles.splitTimelineColExpanded : ''}`}>
                      <div className={styles.timelineTitle}>
                        <ClockIcon style={{ width: '14px', height: '14px' }} />
                        <span>Session Sequence ({resolvedPayloadData.activities.length} Actions)</span>
                      </div>
                      <div className={styles.timelineList}>
                        {resolvedPayloadData.activities.map((act: any, idx: number) => (
                          <div key={idx} className={styles.timelineItem}>
                            <div className={styles.timelineItemTopRow}>
                              <div className={styles.timelineItemBadges}>
                                <span className={styles.timelineStep}>Step {act.step || idx + 1}</span>
                                <span className={styles.timelineActionBadge}>{act.action}</span>
                              </div>
                              <span className={styles.timelineTime}>
                                {act.time || (act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : '')}
                              </span>
                            </div>
                            <div className={styles.timelineDesc}>
                              {act.activity_description || act.what_user_did || act.activity}
                            </div>
                            {(act.entity || act.target_entity) && (
                              <div className={styles.timelineEntityPill}>
                                <span>Target:</span>
                                <strong>{act.entity || act.target_entity}</strong>
                                {act.entity_id && <code>#{act.entity_id}</code>}
                              </div>
                            )}
                            {act.audited_details && (
                              <div className={styles.timelineAuditedDetails}>
                                <span className={styles.auditedDetailsTitle}>Audited Parameters:</span>
                                <pre className={styles.auditedDetailsCode}>
                                  {renderHighlightedJson(act.audited_details)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}

                        <div className={styles.timelineEndBanner}>
                          <CheckCircleIcon className={styles.endBannerIcon} />
                          <span>End of Audited Session Sequence (All {resolvedPayloadData.activities.length} of {resolvedPayloadData.activities.length} Actions Displayed)</span>
                        </div>
                      </div>
                    </div>
                    <div className={`${styles.splitJsonCol} ${expandFull ? styles.splitJsonColExpanded : ''}`}>
                      <div className={styles.jsonToolbar}>
                        <span>FORMATTED JSON OUTPUT</span>
                        <span>{Object.keys(resolvedPayloadData.displayJson).length} ROOT PROPERTIES</span>
                      </div>
                      <pre className={styles.jsonCode}>
                        {renderHighlightedJson(resolvedPayloadData.displayJson)}
                      </pre>
                      <div className={styles.jsonFooter}>
                        <CheckCircleIcon className={styles.endBannerIcon} />
                        <span>End of Audited JSON Payload • Actions Stored in Brackets [ ... ] Complete Record</span>
                      </div>
                    </div>
                  </div>
                ) : resolvedPayloadData.isLogin && payloadViewMode === 'timeline' ? (
                  <div className={`${styles.timelineContentFull} ${expandFull ? styles.timelineContentFullExpanded : ''}`}>
                    <div className={styles.timelineTitle}>
                      <ClockIcon style={{ width: '14px', height: '14px' }} />
                      <span>What User Is Doing After Login (Session Sequence)</span>
                    </div>
                    <div className={styles.timelineList}>
                      {resolvedPayloadData.activities.map((act: any, idx: number) => (
                        <div key={idx} className={styles.timelineItem}>
                          <div className={styles.timelineItemTopRow}>
                            <div className={styles.timelineItemBadges}>
                              <span className={styles.timelineStep}>Step {act.step || idx + 1}</span>
                              <span className={styles.timelineActionBadge}>{act.action}</span>
                            </div>
                            <span className={styles.timelineTime}>
                              {act.time || (act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : '')}
                            </span>
                          </div>
                          <div className={styles.timelineDesc}>
                            {act.activity_description || act.what_user_did || act.activity}
                          </div>
                          {(act.entity || act.target_entity) && (
                            <div className={styles.timelineEntityPill}>
                              <span>Target:</span>
                              <strong>{act.entity || act.target_entity}</strong>
                              {act.entity_id && <code>#{act.entity_id}</code>}
                            </div>
                          )}
                          {act.audited_details && (
                            <div className={styles.timelineAuditedDetails}>
                              <span className={styles.auditedDetailsTitle}>Audited Parameters:</span>
                              <pre className={styles.auditedDetailsCode}>
                                {renderHighlightedJson(act.audited_details)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className={styles.timelineEndBanner}>
                        <CheckCircleIcon className={styles.endBannerIcon} />
                        <span>End of Audited Session Sequence (All {resolvedPayloadData.activities.length} Actions Displayed)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.payloadContentFull} ${expandFull ? styles.payloadContentFullExpanded : styles.payloadContentFullFit}`}>
                    <div className={styles.jsonToolbar}>
                      <span>FORMATTED ACTIVITY JSON PAYLOAD</span>
                      <span>[ {Array.isArray(resolvedPayloadData.displayJson) ? resolvedPayloadData.displayJson.length : 1} RECORD(S) STORED IN BRACKETS ]</span>
                    </div>
                    <pre className={styles.jsonCode}>
                      {renderHighlightedJson(resolvedPayloadData.displayJson)}
                    </pre>
                    <div className={styles.jsonFooter}>
                      <CheckCircleIcon className={styles.endBannerIcon} />
                      <span>End of Audited Activity Payload • Actions Stored in Brackets [ ... ] Complete Record</span>
                    </div>
                  </div>
                )}
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
