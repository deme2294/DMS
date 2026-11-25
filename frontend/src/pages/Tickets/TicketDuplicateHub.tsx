import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  ArrowTopRightOnSquareIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
  TagIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { fetchGlobalDuplicateSuggestions, fetchMergedTicketsLedger } from '../../api/ticketApi';
import type { GlobalDuplicateSuggestion, MergedTicketRecord, Ticket } from '../../types/ticket';
import MergeTicketsModal from '../../components/DuplicateTickets/MergeTicketsModal';
import DuplicateDetectionModal from '../../components/DuplicateTickets/DuplicateDetectionModal';
import styles from './TicketDuplicateHub.module.css';

/**
 * Formats a reason string by highlighting category domains, labels, and quoted keywords
 */
const renderFormattedReason = (text: string) => {
  const colonIndex = text.indexOf(':');
  let label = '';
  let body = text;

  if (colonIndex > 0 && colonIndex < 35 && !text.slice(0, colonIndex).includes('"')) {
    label = text.slice(0, colonIndex + 1);
    body = text.slice(colonIndex + 1).trim();
  }

  const parts = body.split(/(".*?"|\(.*?\))/g);

  return (
    <div className={styles.reasonTextWrap}>
      {label && <strong className={styles.reasonLabel}>{label} </strong>}
      <span className={styles.reasonBody}>
        {parts.map((part, idx) => {
          if (!part) return null;
          const isQuoted = part.startsWith('"') && part.endsWith('"');
          const isParenPhrase = part.startsWith('(') && part.endsWith(')') && part.length > 3;
          if (isQuoted || isParenPhrase) {
            return (
              <span key={idx} className={styles.reasonHighlight}>
                {part}
              </span>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </span>
    </div>
  );
};

export const TicketDuplicateHub: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab State: 'suggestions' | 'ledger'
  const [activeTab, setActiveTab] = useState<'suggestions' | 'ledger'>('suggestions');

  // Filter Pill State: 'all' | 'same_tenant' | 'cross_tenant' | 'time_shifted' | 'high_confidence'
  const [filterPill, setFilterPill] = useState<'all' | 'same_tenant' | 'cross_tenant' | 'time_shifted' | 'high_confidence'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [suggestions, setSuggestions] = useState<GlobalDuplicateSuggestion[]>([]);
  const [ledger, setLedger] = useState<MergedTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Merge Modals
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [targetTicketForMerge, setTargetTicketForMerge] = useState<Ticket | null>(null);
  const [preselectedSource, setPreselectedSource] = useState<Ticket | null>(null);

  // Manual Scan Modal
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const userDeptId = user?.departments?.[0]?.id;
      const [sugRes, ledRes] = await Promise.all([
        fetchGlobalDuplicateSuggestions(userDeptId),
        fetchMergedTicketsLedger(userDeptId),
      ]);
      setSuggestions(sugRes.data?.data || []);
      setLedger(ledRes.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load duplicate tickets data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Statistics
  const stats = useMemo(() => {
    const totalSuggested = suggestions.length;
    const sameTenantCount = suggestions.filter(
      (s) => s.isSameTenantRepeated || s.isSameTenant || s.pattern === 'same_tenant_repeated' || s.pattern === 'same_tenant'
    ).length;
    const crossTenantCount = suggestions.filter(
      (s) => s.isCrossTenant || s.pattern === 'cross_tenant' || s.pattern === 'cross_tenant_time_shifted'
    ).length;
    const timeShiftedCount = suggestions.filter(
      (s) => s.isTimeShifted || s.pattern === 'time_shifted' || s.pattern === 'cross_tenant_time_shifted' || (s.hoursDiff !== null && s.hoursDiff !== undefined && s.hoursDiff >= 0.5)
    ).length;
    const totalMerged = ledger.length;
    return { totalSuggested, sameTenantCount, crossTenantCount, timeShiftedCount, totalMerged };
  }, [suggestions, ledger]);

  // Filtered Suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      // Pattern Filter
      if (filterPill === 'same_tenant' && !(s.isSameTenantRepeated || s.isSameTenant || s.pattern === 'same_tenant_repeated' || s.pattern === 'same_tenant')) {
        return false;
      }
      if (filterPill === 'cross_tenant' && !(s.isCrossTenant || s.pattern === 'cross_tenant' || s.pattern === 'cross_tenant_time_shifted')) {
        return false;
      }
      if (filterPill === 'time_shifted' && !(s.isTimeShifted || s.pattern === 'time_shifted' || s.pattern === 'cross_tenant_time_shifted' || (s.hoursDiff !== null && s.hoursDiff !== undefined && s.hoursDiff >= 0.5))) {
        return false;
      }
      if (filterPill === 'high_confidence' && s.score < 70) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tA = s.ticketA || s.primaryCandidate;
        const tB = s.ticketB || s.duplicateCandidate;
        const matchTitle = (tA?.title?.toLowerCase() || '').includes(q) || (tB?.title?.toLowerCase() || '').includes(q);
        const matchRef = (tA?.referenceNumber?.toLowerCase() || '').includes(q) || (tB?.referenceNumber?.toLowerCase() || '').includes(q);
        const matchTenant = (tA?.tenantName?.toLowerCase() || '').includes(q) || (tB?.tenantName?.toLowerCase() || '').includes(q);
        const matchCat = (tA?.category?.toLowerCase() || '').includes(q) || (tB?.category?.toLowerCase() || '').includes(q);
        return matchTitle || matchRef || matchTenant || matchCat;
      }

      return true;
    });
  }, [suggestions, filterPill, searchQuery]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    if (!searchQuery.trim()) return ledger;
    const q = searchQuery.toLowerCase();
    return ledger.filter((item) =>
      (item.title?.toLowerCase() || '').includes(q) ||
      (item.referenceNumber?.toLowerCase() || '').includes(q) ||
      (item.primaryReference?.toLowerCase() || '').includes(q) ||
      (item.tenantName?.toLowerCase() || '').includes(q) ||
      (item.mergeReason?.toLowerCase() || '').includes(q)
    );
  }, [ledger, searchQuery]);

  const handleOpenMerge = (primary: Ticket, secondary?: Ticket) => {
    let target: Ticket = primary;
    let source: Ticket | null = secondary || null;

    if (user?.role === 'manager' && secondary) {
      const userDeptIds = (user.departments || []).map((d: any) => String(d.id)).filter(Boolean);
      const deptA = String(primary?.departmentId || (primary as any)?.department_id || '');
      const deptB = String(secondary?.departmentId || (secondary as any)?.department_id || '');

      if (deptB && userDeptIds.includes(deptB) && (!deptA || !userDeptIds.includes(deptA))) {
        target = secondary;
        source = primary;
      }
    }

    setTargetTicketForMerge(target);
    setPreselectedSource(source);
    setMergeModalOpen(true);
  };

  const handleMergeSuccess = () => {
    setMergeModalOpen(false);
    loadData(true);
  };

  // Determine Ticket Detail Base Route for role
  const getTicketDetailPath = (id: string) => {
    if (user?.role === 'ceo') return `/ceo/tickets/${id}`;
    if (user?.role === 'admin') return `/admin/tickets/${id}`;
    if (user?.role === 'manager') return `/manager/tickets/${id}`;
    return `/tickets/${id}`;
  };

  const renderLedgerStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    let badgeClass = styles.ledgerStatusOpen;
    if (s.includes('resolv') || s.includes('closed') || s.includes('complet')) {
      badgeClass = styles.ledgerStatusResolved;
    } else if (s.includes('escalat')) {
      badgeClass = styles.ledgerStatusEscalated;
    } else if (s.includes('progress')) {
      badgeClass = styles.ledgerStatusProgress;
    }

    return (
      <span className={`${styles.ledgerStatusBadge} ${badgeClass}`}>
        <span className={styles.statusDot} />
        {status.replace(/[._]/g, ' ')}
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.badgeHeader}>
            <ArrowsRightLeftIcon style={{ width: 14, height: 14 }} />
            <span>Incident Intelligence</span>
          </div>
          <h1 className={styles.title}>Duplicate & Merged Tickets Hub</h1>
          <p className={styles.subtitle}>
            Detect repeated issues submitted by the same tenant in the same category (e.g. Internet, Ethernet, Server, Troubleshooting) or collisions across tenants, compare details, and merge them into one primary ticket while preserving tenant audit trails and SLA history.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            title="Refresh duplicate analysis"
          >
            <ArrowPathIcon style={{ width: 16, height: 16 }} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Scanning...' : 'Refresh'}</span>
          </button>

          <button
            className={styles.btnPrimary}
            onClick={() => setScanModalOpen(true)}
            title="Scan an individual ticket for merge candidates"
          >
            <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />
            <span>Scan Ticket for Duplicates</span>
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div className={styles.statGrid}>
        <div className={styles.statCard} onClick={() => setFilterPill('all')} style={{ cursor: 'pointer' }}>
          <div className={styles.statIconWrap} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <ArrowsRightLeftIcon style={{ width: 22, height: 22 }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalSuggested}</span>
            <span className={styles.statLabel}>Suggested Duplicate Pairs</span>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => setFilterPill('same_tenant')} style={{ cursor: 'pointer', borderColor: filterPill === 'same_tenant' ? '#8b5cf6' : undefined }}>
          <div className={styles.statIconWrap} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <DocumentDuplicateIcon style={{ width: 22, height: 22 }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.sameTenantCount}</span>
            <span className={styles.statLabel}>Same Tenant Repeated</span>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => setFilterPill('cross_tenant')} style={{ cursor: 'pointer', borderColor: filterPill === 'cross_tenant' ? '#db2777' : undefined }}>
          <div className={styles.statIconWrap} style={{ background: '#fdf2f8', color: '#db2777' }}>
            <BuildingOffice2Icon style={{ width: 22, height: 22 }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.crossTenantCount}</span>
            <span className={styles.statLabel}>Cross-Tenant Incidents</span>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => setFilterPill('time_shifted')} style={{ cursor: 'pointer', borderColor: filterPill === 'time_shifted' ? '#16a34a' : undefined }}>
          <div className={styles.statIconWrap} style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <ClockIcon style={{ width: 22, height: 22 }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.timeShiftedCount}</span>
            <span className={styles.statLabel}>Time-Shifted / Recurring</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: '#f8fafc', color: '#475569' }}>
            <ShieldCheckIcon style={{ width: 22, height: 22 }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalMerged}</span>
            <span className={styles.statLabel}>Active Merged Tickets</span>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'suggestions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          <span>Suggested Duplicate Pairs</span>
          <span className={styles.tabCount}>{suggestions.length}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'ledger' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <span>Merged Tickets Ledger</span>
          <span className={styles.tabCount}>{ledger.length}</span>
        </button>
      </div>

      {/* ── Tab Content: Suggested Duplicates ── */}
      {activeTab === 'suggestions' && (
        <div>
          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.pillsRow}>
              <button
                className={`${styles.pillBtn} ${filterPill === 'all' ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterPill('all')}
              >
                <span>All Suggestions</span>
                <span>({suggestions.length})</span>
              </button>

              <button
                className={`${styles.pillBtn} ${filterPill === 'same_tenant' ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterPill('same_tenant')}
              >
                <span>🔁 Same Tenant (Repeated Issues)</span>
                <span>({stats.sameTenantCount})</span>
              </button>

              <button
                className={`${styles.pillBtn} ${filterPill === 'cross_tenant' ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterPill('cross_tenant')}
              >
                <span>🏢 Cross-Tenant Only</span>
                <span>({stats.crossTenantCount})</span>
              </button>

              <button
                className={`${styles.pillBtn} ${filterPill === 'time_shifted' ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterPill('time_shifted')}
              >
                <span>⏱️ Time-Shifted / Recurring</span>
                <span>({stats.timeShiftedCount})</span>
              </button>

              <button
                className={`${styles.pillBtn} ${filterPill === 'high_confidence' ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterPill('high_confidence')}
              >
                <span>⭐ High Confidence (≥70%)</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by title, ref, or tenant..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Suggestions List */}
          {loading ? (
            <div className={styles.emptyState}>
              <ArrowPathIcon style={{ width: 32, height: 32 }} className="spin" />
              <p>Scanning active tickets for similarity across tenants and timestamps...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔍</span>
              <h3>No Duplicate Pairs Found</h3>
              <p>No tickets currently meet the similarity threshold under this filter.</p>
            </div>
          ) : (
            <div className={styles.suggestionList}>
              {filteredSuggestions.map((sug, idx) => {
                const ticketA = sug.primaryCandidate || sug.ticketA;
                const ticketB = sug.duplicateCandidate || sug.ticketB;
                const isSameTenantRepeated = sug.isSameTenantRepeated || sug.isSameTenant || sug.pattern === 'same_tenant_repeated' || sug.pattern === 'same_tenant';
                const isCrossTenant = sug.isCrossTenant || sug.pattern === 'cross_tenant' || sug.pattern === 'cross_tenant_time_shifted';
                const isTimeShifted = sug.isTimeShifted || sug.pattern === 'time_shifted' || sug.pattern === 'cross_tenant_time_shifted';

                return (
                  <div key={`${ticketA.id}-${ticketB.id}-${idx}`} className={styles.suggestionCard}>
                    {/* Top Row: Pattern Badge & Similarity Score */}
                    <div className={cardTopRowStyle(sug.score)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {isSameTenantRepeated ? (
                          <span className={`${styles.patternBadge} ${styles.badgeSameTenant}`}>
                            🔁 Same Tenant Repeated · {ticketA.category || ticketB.category || 'Same Domain'}
                          </span>
                        ) : isCrossTenant && isTimeShifted ? (
                          <span className={`${styles.patternBadge} ${styles.badgeCombined}`}>
                            🏢 Cross-Tenant & ⏱️ Time-Shifted Incident
                          </span>
                        ) : isCrossTenant ? (
                          <span className={`${styles.patternBadge} ${styles.badgeCrossTenant}`}>
                            🏢 Cross-Tenant Incident (Different Tenants)
                          </span>
                        ) : isTimeShifted ? (
                          <span className={`${styles.patternBadge} ${styles.badgeTimeShifted}`}>
                            ⏱️ Time-Shifted / Recurring Issue
                          </span>
                        ) : (
                          <span className={`${styles.patternBadge} ${styles.badgeSimilar}`}>
                            Identical / Similar Issue
                          </span>
                        )}

                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Confidence:{' '}
                          <strong className={sug.score >= 70 ? styles.confidenceHigh : styles.confidenceMed}>
                            {sug.confidence.toUpperCase()}
                          </strong>
                        </span>
                      </div>

                      <div className={styles.scoreMeter}>
                        <div className={styles.scoreBarBg}>
                          <div
                            className={styles.scoreBarFill}
                            style={{
                              width: `${Math.min(100, Math.max(10, sug.score))}%`,
                              background: sug.score >= 70 ? '#16a34a' : sug.score >= 50 ? '#2563eb' : '#f59e0b',
                            }}
                          />
                        </div>
                        <span className={sug.score >= 70 ? styles.confidenceHigh : styles.confidenceMed}>
                          {sug.score}% Match
                        </span>
                      </div>
                    </div>

                    {/* Side-by-Side Comparison Grid */}
                    <div className={styles.comparisonGrid}>
                      {/* Ticket A: Primary Candidate */}
                      <div className={styles.ticketSide}>
                        <div className={styles.ticketSideHeader}>
                          <span className={`${styles.candidateTag} ${styles.primaryTag}`}>
                            Recommended Primary Ticket
                          </span>
                          <span className={styles.ticketRef}>#{ticketA.referenceNumber || ticketA.id}</span>
                        </div>

                        <h4 className={styles.ticketTitle}>{ticketA.title}</h4>

                        <div className={styles.ticketMetaRow}>
                          <div className={styles.metaItem}>
                            <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                            <span>Tenant:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketA.tenantName || 'City Housing Office'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <TagIcon style={{ width: 14, height: 14 }} />
                            <span>Category:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketA.category || 'General'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <ClockIcon style={{ width: 14, height: 14 }} />
                            <span>Created:</span>{' '}
                            <span className={styles.metaHighlight}>
                              {ticketA.createdAt ? new Date(ticketA.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>

                          <div className={styles.metaItem}>
                            <span>Dept:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketA.departmentName || 'General'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <span>Priority:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketA.priority}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle Divider Icon */}
                      <div className={styles.dividerCol}>
                        <div className={styles.dividerIcon}>⮂</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>VS</span>
                      </div>

                      {/* Ticket B: Duplicate Candidate */}
                      <div className={styles.ticketSide}>
                        <div className={styles.ticketSideHeader}>
                          <span className={`${styles.candidateTag} ${styles.duplicateTag}`}>
                            Potential Duplicate
                          </span>
                          <span className={styles.ticketRef}>#{ticketB.referenceNumber || ticketB.id}</span>
                        </div>

                        <h4 className={styles.ticketTitle}>{ticketB.title}</h4>

                        <div className={styles.ticketMetaRow}>
                          <div className={styles.metaItem}>
                            <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                            <span>Tenant:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketB.tenantName || 'Tenant Organization'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <TagIcon style={{ width: 14, height: 14 }} />
                            <span>Category:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketB.category || 'General'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <ClockIcon style={{ width: 14, height: 14 }} />
                            <span>Created:</span>{' '}
                            <span className={styles.metaHighlight}>
                              {ticketB.createdAt ? new Date(ticketB.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>

                          <div className={styles.metaItem}>
                            <span>Dept:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketB.departmentName || 'General'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <span>Priority:</span>{' '}
                            <span className={styles.metaHighlight}>{ticketB.priority}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reasons & Comparison Findings - High Contrast, Large & Professional UI */}
                    {sug.reasons && sug.reasons.length > 0 && (
                      <div className={styles.reasonsBox}>
                        <div className={styles.reasonsHeader}>
                          <div className={styles.reasonsHeaderLeft}>
                            <span className={styles.reasonsIconWrapper}>
                              <SparklesIcon className={styles.reasonsIcon} />
                            </span>
                            <div>
                              <h4 className={styles.reasonsTitle}>Detection Rationale & Similarity Signals</h4>
                              <p className={styles.reasonsSubtitle}>
                                Automated analysis confirmed {sug.reasons.length} matching criteria between these tickets
                              </p>
                            </div>
                          </div>
                          <span className={styles.reasonsCountBadge}>
                            {sug.reasons.length} {sug.reasons.length === 1 ? 'Signal Matched' : 'Signals Matched'}
                          </span>
                        </div>

                        <div className={styles.reasonsGrid}>
                          {sug.reasons.map((r, rIdx) => (
                            <div key={rIdx} className={styles.reasonCard}>
                              <div className={styles.reasonCardIcon}>
                                <CheckCircleIcon className={styles.checkIcon} />
                              </div>
                              <div className={styles.reasonContent}>
                                {renderFormattedReason(r)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className={styles.cardActions}>
                      <Link
                        to={getTicketDetailPath(ticketA.id)}
                        className={styles.btnSecondary}
                        target="_blank"
                        rel="noreferrer"
                        title="Open Ticket A details in new tab"
                      >
                        <span>View #{ticketA.referenceNumber}</span>
                        <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
                      </Link>

                      <Link
                        to={getTicketDetailPath(ticketB.id)}
                        className={styles.btnSecondary}
                        target="_blank"
                        rel="noreferrer"
                        title="Open Ticket B details in new tab"
                      >
                        <span>View #{ticketB.referenceNumber}</span>
                        <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
                      </Link>

                      <button
                        className={styles.btnPrimary}
                        onClick={() => handleOpenMerge(ticketA, ticketB)}
                        title="Review and merge duplicate ticket into primary"
                      >
                        <ArrowsRightLeftIcon style={{ width: 16, height: 16 }} />
                        <span>Compare & Merge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Merged Tickets Ledger ── */}
      {activeTab === 'ledger' && (
        <div>
          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
                Showing all <strong>{filteredLedger.length}</strong> duplicate tickets merged across the system.
              </span>
              <span className={styles.scrollHint}>↔ Scroll horizontally to view all columns</span>
            </div>

            <input
              type="text"
              placeholder="Search merged ledger by ref, title, tenant, or reason..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.tableCard}>
            {loading ? (
              <div className={styles.emptyState}>
                <ArrowPathIcon style={{ width: 32, height: 32 }} className="spin" />
                <p>Loading merged tickets ledger...</p>
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📋</span>
                <h3>No Merged Tickets in Ledger</h3>
                <p>There are currently no tickets merged into a primary ticket.</p>
              </div>
            ) : (
              <div className={styles.tableScrollWrapper}>
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 260 }}>Merged Ticket</th>
                      <th style={{ width: 180 }}>Tenant</th>
                      <th style={{ width: 260 }}>Linked Primary Ticket</th>
                      <th style={{ width: 160 }}>Live Primary Status</th>
                      <th style={{ width: 200 }}>Local Assignment</th>
                      <th style={{ width: 280 }}>Merged Date & Reason</th>
                      <th style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((row) => (
                      <tr key={row.id}>
                        {/* Merged Ticket */}
                        <td>
                          <div className={styles.ledgerTicketCol}>
                            <Link to={getTicketDetailPath(row.id)} className={styles.ledgerTicketRef}>
                              #{row.referenceNumber || row.id.slice(0, 8)}
                            </Link>
                            <span className={styles.ledgerTicketTitle} title={row.title}>
                              {row.title}
                            </span>
                            {row.category && (
                              <span className={styles.ledgerCategoryTag}>
                                {row.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tenant */}
                        <td>
                          <div className={styles.ledgerTenantCol}>
                            <div className={styles.ledgerTenantName}>
                              <BuildingOffice2Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                              <span>{row.tenantName || 'Tenant'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Linked Primary Ticket */}
                        <td>
                          <div className={styles.ledgerTicketCol}>
                            <div className={styles.primaryLinkRow}>
                              <span className={styles.primaryTargetPill}>Primary</span>
                              <Link to={getTicketDetailPath(row.primaryId)} className={styles.ledgerPrimaryRef}>
                                #{row.primaryReference || row.primaryId.slice(0, 8)}
                              </Link>
                            </div>
                            <span className={styles.ledgerPrimaryTitle} title={row.primaryTitle}>
                              {row.primaryTitle}
                            </span>
                          </div>
                        </td>

                        {/* Live Primary Status */}
                        <td>
                          {renderLedgerStatusBadge(row.primaryStatus)}
                        </td>

                        {/* Local Assignment */}
                        <td>
                          <div className={styles.ledgerAssignCol}>
                            <div className={styles.assignItem}>
                              <span className={styles.assignLabel}>Dept:</span>
                              <span className={styles.assignValue}>{row.departmentName || 'Not Assigned'}</span>
                            </div>
                            <div className={styles.assignItem}>
                              <span className={styles.assignLabel}>Staff:</span>
                              <span className={styles.assignValue}>{row.assignedToName || 'Unassigned'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Merged Date & Reason */}
                        <td>
                          <div className={styles.ledgerAuditCol}>
                            <div className={styles.auditMeta}>
                              <ClockIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                              <span>{row.mergedAt ? new Date(row.mergedAt).toLocaleDateString() : 'N/A'}</span>
                              {row.mergedByName && (
                                <span className={styles.auditActor}>by {row.mergedByName}</span>
                              )}
                            </div>
                            <div className={styles.auditReason} title={row.mergeReason}>
                              "{row.mergeReason}"
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td>
                          <Link
                            to={getTicketDetailPath(row.id)}
                            className={styles.ledgerActionBtn}
                            title="Manage merged ticket and view primary link"
                          >
                            <span>Manage</span>
                            <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {mergeModalOpen && targetTicketForMerge && (
        <MergeTicketsModal
          open={mergeModalOpen}
          onClose={() => setMergeModalOpen(false)}
          initialTargetTicket={targetTicketForMerge}
          onMergedSuccess={handleMergeSuccess}
          preselectedSource={preselectedSource || undefined}
        />
      )}

      {scanModalOpen && (
        <DuplicateDetectionModal
          open={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          departmentId={user?.role === 'manager' ? user?.departments?.[0]?.id : undefined}
          onMergedSuccess={handleMergeSuccess}
        />
      )}
    </div>
  );
};

function cardTopRowStyle(_score: number): string {
  return styles.cardTopRow;
}
