import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchTickets } from '../../api/ticketApi';
import { fetchCategories } from '../../api/categoryApi';
import type { Ticket } from '../../types/ticket';
import { STATUS_LABELS } from '../../types/ticket';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ClockIcon,
  BuildingOffice2Icon,
  TicketIcon,
} from '@heroicons/react/24/outline';
import styles from './CeoApprovals.module.css';

export default function CeoApprovals() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const load = () => {
    setLoading(true);
    fetchTickets({ status: 'escalated', limit: 100 })
      .then((r) => setTickets(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchCategories().catch(() => {});
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (t.departmentName && t.departmentName.toLowerCase().includes(search.toLowerCase()));
      const matchPriority = !priorityFilter || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [tickets, search, priorityFilter]);

  const urgentCount = tickets.filter((t) => t.priority === 'urgent').length;
  const highCount = tickets.filter((t) => t.priority === 'high').length;
  const overdueCount = tickets.filter((t) => t.isOverdue).length;

  return (
    <div className={styles.page}>
      {/* ── Executive Approvals Header ── */}
      <div className={styles.headerCard}>
        <div className={styles.headerLeft}>
          <div className={styles.headerBadge}>
            <ShieldCheckIcon className={styles.headerBadgeIcon} />
            <span>EXECUTIVE GOVERNANCE &amp; OVERSIGHT</span>
          </div>
          <h1 className={styles.headerTitle}>Executive Approvals &amp; Escalations</h1>
          <p className={styles.headerSubtitle}>
            Review critical incidents, SLA breaches, and escalated workflows requiring executive oversight and strategic guidance.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link to="/ceo/tickets" className={styles.secondaryBtn} title="View all tickets">
            <TicketIcon className={styles.btnIcon} />
            <span>All Incidents</span>
          </Link>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={load}
            disabled={loading}
            title="Refresh escalated queue"
          >
            <ArrowPathIcon className={`${styles.btnIcon} ${loading ? styles.spinIcon : ''}`} />
            <span>{loading ? 'Refreshing…' : 'Refresh Queue'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Escalated</span>
            <div className={`${styles.kpiIconBox} ${styles.iconBlue}`}>
              <TicketIcon className={styles.kpiIcon} />
            </div>
          </div>
          <div className={styles.kpiValue}>{tickets.length}</div>
          <div className={styles.kpiSub}>Awaiting executive review</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiRed}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Urgent Priority</span>
            <div className={`${styles.kpiIconBox} ${styles.iconRed}`}>
              <ExclamationTriangleIcon className={styles.kpiIcon} />
            </div>
          </div>
          <div className={styles.kpiValue}>{urgentCount}</div>
          <div className={styles.kpiSub}>Immediate action required</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>High Priority</span>
            <div className={`${styles.kpiIconBox} ${styles.iconAmber}`}>
              <ClockIcon className={styles.kpiIcon} />
            </div>
          </div>
          <div className={styles.kpiValue}>{highCount}</div>
          <div className={styles.kpiSub}>Elevated severity queue</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Overdue Breaches</span>
            <div className={`${styles.kpiIconBox} ${styles.iconPurple}`}>
              <BuildingOffice2Icon className={styles.kpiIcon} />
            </div>
          </div>
          <div className={styles.kpiValue}>{overdueCount}</div>
          <div className={styles.kpiSub}>SLA window exceeded</div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className={styles.filterCard}>
        <div className={styles.searchWrapper}>
          <MagnifyingGlassIcon className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by title, reference number, or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(search || priorityFilter) && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setSearch('');
                setPriorityFilter('');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading escalated tickets…</div>}

      {/* Desktop Table View */}
      <div className={styles.desktopTableWrap}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Incident Title</th>
                <th>Priority</th>
                <th>Lifecycle Status</th>
                <th>Department</th>
                <th>Assigned Staff</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/ceo/tickets/${t.id}`} className={styles.refLink} title="Inspect ticket details">
                      {t.referenceNumber}
                    </Link>
                  </td>
                  <td className={styles.titleCell}>
                    <span className={styles.strong}>{t.title}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[t.priority] || ''}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <span className={styles.statusPill}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </td>
                  <td>
                    <span className={styles.deptCell}>
                      <BuildingOffice2Icon className={styles.cellIcon} />
                      <span>{t.departmentName || '—'}</span>
                    </span>
                  </td>
                  <td>{t.assignedToName || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/ceo/tickets/${t.id}`} className={styles.inspectBtn} title="Inspect Incident">
                      <EyeIcon className={styles.btnIconSm} />
                      <span>Inspect</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {!filteredTickets.length && !loading && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    <CheckCircleIcon className={styles.emptyIcon} />
                    <div>No escalated tickets awaiting executive oversight</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className={styles.mobileCardsList}>
        {filteredTickets.map((t) => (
          <div key={t.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <Link to={`/ceo/tickets/${t.id}`} className={styles.refLink}>
                {t.referenceNumber}
              </Link>
              <span className={`${styles.badge} ${styles[t.priority] || ''}`}>{t.priority}</span>
            </div>
            <div className={styles.mobileCardTitle}>{t.title}</div>
            <div className={styles.mobileCardMeta}>
              <span>Dept: <strong>{t.departmentName || '—'}</strong></span>
              <span className={styles.strong}>{STATUS_LABELS[t.status] || t.status}</span>
            </div>
            <div className={styles.mobileCardAction}>
              <Link to={`/ceo/tickets/${t.id}`} className={styles.inspectBtn}>
                <EyeIcon className={styles.btnIconSm} />
                <span>Inspect Incident</span>
              </Link>
            </div>
          </div>
        ))}
        {!filteredTickets.length && !loading && (
          <div className={styles.empty}>No escalated tickets awaiting approval</div>
        )}
      </div>
    </div>
  );
}
