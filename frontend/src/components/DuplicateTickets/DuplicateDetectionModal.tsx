import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  SparklesIcon,
  XMarkIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  TagIcon,
  ClockIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import type { Ticket, GlobalDuplicateSuggestion } from '../../types/ticket';
import { fetchGlobalDuplicateSuggestions } from '../../api/ticketApi';
import MergeTicketsModal from './MergeTicketsModal';
import styles from './DuplicateDetectionModal.module.css';

interface DuplicateDetectionModalProps {
  open: boolean;
  onClose: () => void;
  departmentId?: string;
  onMergedSuccess?: () => void;
}

export default function DuplicateDetectionModal({
  open,
  onClose,
  departmentId,
  onMergedSuccess,
}: DuplicateDetectionModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<GlobalDuplicateSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'same_tenant' | 'high' | 'medium'>('all');
  const [mergeModalPair, setMergeModalPair] = useState<{ target: Ticket; source: Ticket } | null>(null);

  const effectiveDepartmentId = departmentId || (user?.role === 'manager' ? user.departments?.[0]?.id : undefined);

  const loadSuggestions = () => {
    setLoading(true);
    fetchGlobalDuplicateSuggestions(effectiveDepartmentId)
      .then((res) => {
        setSuggestions(res.data?.data || []);
      })
      .catch(() => {
        setSuggestions([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open) {
      loadSuggestions();
    }
  }, [open, effectiveDepartmentId]);

  const filteredSuggestions = useMemo(() => {
    if (filterConfidence === 'all') return suggestions;
    if (filterConfidence === 'same_tenant') {
      return suggestions.filter(
        (s) => s.isSameTenantRepeated || s.isSameTenant || s.pattern === 'same_tenant_repeated' || s.pattern === 'same_tenant'
      );
    }
    return suggestions.filter((s) => s.confidence === filterConfidence);
  }, [suggestions, filterConfidence]);

  if (!open) return null;

  const handleCompareAndMerge = (item: GlobalDuplicateSuggestion) => {
    let target = item.primaryCandidate || item.ticketA;
    let source = item.duplicateCandidate || item.ticketB;

    if (user?.role === 'manager') {
      const userDeptIds = (user.departments || []).map((d: any) => String(d.id)).filter(Boolean);
      const deptA = String(item.ticketA?.departmentId || (item.ticketA as any)?.department_id || '');
      const deptB = String(item.ticketB?.departmentId || (item.ticketB as any)?.department_id || '');

      // If ticketB is in manager's department and ticketA is not, designate ticketB as primary target
      if (deptB && userDeptIds.includes(deptB) && (!deptA || !userDeptIds.includes(deptA))) {
        target = item.ticketB;
        source = item.ticketA;
      } else if (deptA && userDeptIds.includes(deptA)) {
        target = item.ticketA;
        source = item.ticketB;
      }
    }

    setMergeModalPair({ target, source });
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    let badgeClass = styles.statusOpen;
    if (s.includes('escalat')) badgeClass = styles.statusEscalated;
    else if (s.includes('progress')) badgeClass = styles.statusProgress;
    else if (s.includes('resolv') || s.includes('closed')) badgeClass = styles.statusResolved;

    return (
      <span className={`${styles.statusPill} ${badgeClass}`}>
        <span className={styles.statusDot} />
        {status.replace(/[._]/g, ' ')}
      </span>
    );
  };

  const renderPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    let pClass = styles.priorityNormal;
    if (p === 'urgent' || p === 'high') pClass = styles.priorityHigh;

    return (
      <span className={`${styles.priorityPill} ${pClass}`}>
        {priority}
      </span>
    );
  };

  const managerDeptName = user?.departments?.[0]?.name;

  return (
    <>
      <div className={styles.modalBackdrop}>
        <div className={styles.modalCard}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderTitleGroup}>
              <div className={styles.modalIconWrap}>
                <SparklesIcon className={styles.modalHeaderIcon} />
              </div>
              <div>
                <div className={styles.headerTagRow}>
                  <h2 className={styles.modalTitle}>Duplicate Ticket Detection Hub</h2>
                  <span className={styles.headerEnginePill}>
                    <span className={styles.headerLiveDot} />
                    Live Engine
                  </span>
                </div>
                <div className={styles.modalSubtitle}>
                  Automated similarity detection engine scans open tickets for duplicate titles, categories, tenants, and timestamps.
                  Merges are never automatic and require explicit authorized confirmation.
                </div>
              </div>
            </div>
            <button type="button" className={styles.modalCloseBtn} onClick={onClose} title="Close window">
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                className={`${styles.filterTabBtn} ${filterConfidence === 'all' ? styles.filterTabBtnActive : ''}`}
                onClick={() => setFilterConfidence('all')}
              >
                All Potential Duplicates <span className={styles.pillCount}>({suggestions.length})</span>
              </button>
              <button
                type="button"
                className={`${styles.filterTabBtn} ${filterConfidence === 'same_tenant' ? styles.filterTabBtnActive : ''}`}
                onClick={() => setFilterConfidence('same_tenant')}
              >
                🔁 Same Tenant Repeated <span className={styles.pillCount}>({suggestions.filter((s) => s.isSameTenantRepeated || s.isSameTenant || s.pattern === 'same_tenant_repeated' || s.pattern === 'same_tenant').length})</span>
              </button>
              <button
                type="button"
                className={`${styles.filterTabBtn} ${filterConfidence === 'high' ? styles.filterTabBtnActive : ''}`}
                onClick={() => setFilterConfidence('high')}
              >
                High Confidence (80%+) <span className={styles.pillCount}>({suggestions.filter((s) => s.confidence === 'high').length})</span>
              </button>
              <button
                type="button"
                className={`${styles.filterTabBtn} ${filterConfidence === 'medium' ? styles.filterTabBtnActive : ''}`}
                onClick={() => setFilterConfidence('medium')}
              >
                Medium Confidence (50–79%) <span className={styles.pillCount}>({suggestions.filter((s) => s.confidence === 'medium').length})</span>
              </button>
            </div>

            <div className={styles.filterActionsRight}>
              <div className={styles.scopeBadge}>
                {user?.role === 'manager' ? (
                  <>
                    <BuildingOffice2Icon style={{ width: 15, height: 15, color: '#3b82f6' }} />
                    <span>Dept: {managerDeptName || 'My Department'}</span>
                  </>
                ) : (
                  <>
                    <GlobeAltIcon style={{ width: 15, height: 15, color: '#3b82f6' }} />
                    <span>Global: All Departments</span>
                  </>
                )}
              </div>

              <button type="button" className={styles.refreshBtn} onClick={loadSuggestions} disabled={loading} title="Re-scan open tickets">
                <ArrowPathIcon style={{ width: 15, height: 15 }} className={loading ? styles.spinAnimation : ''} />
                <span>{loading ? 'Scanning...' : 'Rescan'}</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={styles.modalBody}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingPulseRing}>
                  <ArrowPathIcon className={`${styles.loadingSpinner} ${styles.spinAnimation}`} />
                </div>
                <h3 className={styles.loadingTitle}>Analyzing Ticket Queue...</h3>
                <p className={styles.loadingSubtitle}>
                  Evaluating title semantic similarity, cross-tenant overlap, domain categories, and timeline proximity.
                </p>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className={styles.emptyContainer}>
                <div className={styles.emptyGlowHalo}>
                  <div className={styles.emptyIconRing}>
                    <ShieldCheckIcon className={styles.emptyIcon} />
                  </div>
                </div>

                <div className={styles.emptyStatusPill}>
                  <span className={styles.emptyPulseDot} />
                  Engine Active • Zero Duplicate Collisions Detected
                </div>

                <h3 className={styles.emptyTitle}>All Open Tickets Are Unique</h3>
                <p className={styles.emptySubtitle}>
                  The automated similarity detection engine analyzed active tickets across titles, categories, tenants, and timestamps.
                  Every open ticket currently represents a distinct, isolated issue with independent SLA tracking.
                </p>

                {/* 3-Column Diagnostic Summary Grid */}
                <div className={styles.emptyDiagnosticsGrid}>
                  <div className={styles.diagnosticCard}>
                    <div className={styles.diagnosticIconWrap}>
                      <BuildingOffice2Icon style={{ width: 18, height: 18 }} />
                    </div>
                    <div className={styles.diagnosticContent}>
                      <span className={styles.diagnosticLabel}>Department Scope</span>
                      <strong className={styles.diagnosticValue}>
                        {user?.role === 'manager'
                          ? (managerDeptName || 'Assigned Department')
                          : 'System-Wide (All Departments)'}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.diagnosticCard}>
                    <div className={styles.diagnosticIconWrap}>
                      <SparklesIcon style={{ width: 18, height: 18 }} />
                    </div>
                    <div className={styles.diagnosticContent}>
                      <span className={styles.diagnosticLabel}>Similarity Models</span>
                      <strong className={styles.diagnosticValue}>
                        Levenshtein & Token Clusters
                      </strong>
                    </div>
                  </div>

                  <div className={styles.diagnosticCard}>
                    <div className={styles.diagnosticIconWrap}>
                      <CheckBadgeIcon style={{ width: 18, height: 18 }} />
                    </div>
                    <div className={styles.diagnosticContent}>
                      <span className={styles.diagnosticLabel}>Confidence Filter</span>
                      <strong className={styles.diagnosticValue}>
                        {filterConfidence === 'all'
                          ? 'All Potential Matches (50%+)'
                          : filterConfidence === 'high'
                          ? 'Strict High Confidence (80%+)'
                          : 'Medium Proximity (50–79%)'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Empty State Call to Actions */}
                <div className={styles.emptyActionsRow}>
                  <button
                    type="button"
                    className={styles.emptyPrimaryBtn}
                    onClick={loadSuggestions}
                    disabled={loading}
                  >
                    <ArrowPathIcon style={{ width: 16, height: 16 }} className={loading ? styles.spinAnimation : ''} />
                    <span>Run Live Rescan</span>
                  </button>

                  <button
                    type="button"
                    className={styles.emptySecondaryBtn}
                    onClick={() => {
                      onClose();
                      navigate('/tickets/duplicate-hub');
                    }}
                  >
                    <DocumentCheckIcon style={{ width: 16, height: 16 }} />
                    <span>Open Merged Tickets Ledger</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredSuggestions.map((item, idx) => {
                const ticketA = item.ticketA;
                const ticketB = item.ticketB;
                const isCrossTenant = item.isCrossTenant || item.pattern === 'cross_tenant' || item.pattern === 'cross_tenant_time_shifted';
                const isTimeShifted = item.isTimeShifted || item.pattern === 'time_shifted' || item.pattern === 'cross_tenant_time_shifted';

                return (
                  <div key={idx} className={styles.suggestionCard}>
                    {/* Top Row: Score Badge, Pattern Tags, Compare & Merge CTA */}
                    <div className={styles.suggestionHeader}>
                      <div className={styles.badgesGroup}>
                        <div className={styles.scoreBadgeWrapper}>
                          <span
                            className={`${styles.suggestionScoreBadge} ${
                              item.score >= 80 ? styles.scoreHigh : item.score >= 50 ? styles.scoreMed : styles.scoreLow
                            }`}
                          >
                            ★ {item.score}% Similarity Match ({item.confidence.toUpperCase()})
                          </span>
                          <div className={styles.scoreBarTrack}>
                            <div
                              className={`${styles.scoreBarFill} ${
                                item.score >= 80 ? styles.scoreBarFillHigh : styles.scoreBarFillMed
                              }`}
                              style={{ width: `${Math.min(100, Math.max(10, item.score))}%` }}
                            />
                          </div>
                        </div>

                        {(item.isSameTenantRepeated || item.pattern === 'same_tenant_repeated' || item.isSameTenant) && (
                          <span className={styles.badgeSameTenant}>
                            🔁 Same Tenant · {ticketA.category || ticketB.category || 'Same Domain'}
                          </span>
                        )}

                        {isCrossTenant && (
                          <span className={styles.badgeCrossTenant}>
                            🏢 Cross-Tenant Incident
                          </span>
                        )}

                        {isTimeShifted && (
                          <span className={styles.badgeTimeShifted}>
                            ⏱️ Time-Shifted Issue
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleCompareAndMerge(item)}
                      >
                        <ArrowsRightLeftIcon style={{ width: 16, height: 16 }} />
                        <span>Compare & Merge</span>
                      </button>
                    </div>

                    {/* Comparison Grid: Candidate A vs Candidate B */}
                    <div className={styles.comparisonGrid}>
                      {/* Candidate A (Target) */}
                      <div className={styles.candidateTicketCard}>
                        <div className={styles.candidateCardHeader}>
                          <span className={styles.candidateTagPrimary}>
                            <CheckBadgeIcon style={{ width: 14, height: 14 }} />
                            Candidate A (Target Primary)
                          </span>
                          <span className={styles.ticketRefBadge}>
                            #{ticketA.referenceNumber || ticketA.id.slice(0, 8)}
                          </span>
                        </div>

                        <h4 className={styles.candidateTitle}>{ticketA.title}</h4>

                        <div className={styles.candidateMetaRow}>
                          <div className={styles.metaItem}>
                            <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                            <span>Tenant:</span>
                            <span className={styles.metaStrong}>{ticketA.tenantName || 'N/A'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <TagIcon style={{ width: 14, height: 14 }} />
                            <span>Cat:</span>
                            <span className={styles.metaStrong}>{ticketA.category}</span>
                          </div>

                          {ticketA.priority && renderPriorityBadge(ticketA.priority)}
                          {ticketA.status && renderStatusBadge(ticketA.status)}

                          {ticketA.createdAt && (
                            <div className={styles.metaItem}>
                              <ClockIcon style={{ width: 14, height: 14 }} />
                              <span>{new Date(ticketA.createdAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle Separator */}
                      <div className={styles.vsDividerCol}>
                        <div className={styles.vsBadge}>VS</div>
                      </div>

                      {/* Candidate B (Source Duplicate) */}
                      <div className={styles.candidateTicketCard}>
                        <div className={styles.candidateCardHeader}>
                          <span className={styles.candidateTagDuplicate}>
                            Candidate B (Duplicate Report)
                          </span>
                          <span className={styles.ticketRefBadge}>
                            #{ticketB.referenceNumber || ticketB.id.slice(0, 8)}
                          </span>
                        </div>

                        <h4 className={styles.candidateTitle}>{ticketB.title}</h4>

                        <div className={styles.candidateMetaRow}>
                          <div className={styles.metaItem}>
                            <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                            <span>Tenant:</span>
                            <span className={styles.metaStrong}>{ticketB.tenantName || 'N/A'}</span>
                          </div>

                          <div className={styles.metaItem}>
                            <TagIcon style={{ width: 14, height: 14 }} />
                            <span>Cat:</span>
                            <span className={styles.metaStrong}>{ticketB.category}</span>
                          </div>

                          {ticketB.priority && renderPriorityBadge(ticketB.priority)}
                          {ticketB.status && renderStatusBadge(ticketB.status)}

                          {ticketB.createdAt && (
                            <div className={styles.metaItem}>
                              <ClockIcon style={{ width: 14, height: 14 }} />
                              <span>{new Date(ticketB.createdAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detection Evidence & Rationale */}
                    {item.reasons && item.reasons.length > 0 && (
                      <div className={styles.reasonsContainer}>
                        <span className={styles.reasonsTitle}>Detection Evidence & Match Criteria:</span>
                        <div className={styles.reasonsRow}>
                          {item.reasons.map((r, rIdx) => (
                            <span key={rIdx} className={styles.reasonChip}>
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <div className={styles.footerInfo}>
              <SparklesIcon style={{ width: 16, height: 16, color: '#3b82f6', flexShrink: 0 }} />
              <span>
                Automated similarity detection engine • Explicit authorization required for all merges
              </span>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {mergeModalPair && (
        <MergeTicketsModal
          open={Boolean(mergeModalPair)}
          onClose={() => setMergeModalPair(null)}
          initialTargetTicket={mergeModalPair.target}
          preselectedSource={mergeModalPair.source}
          onMergedSuccess={() => {
            setMergeModalPair(null);
            loadSuggestions();
            if (onMergedSuccess) onMergedSuccess();
          }}
        />
      )}
    </>
  );
}
