import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowsRightLeftIcon,
  XMarkIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type { Ticket, MergeCandidateWithSimilarity } from '../../types/ticket';
import { fetchMergeCandidates, mergeTickets } from '../../api/ticketApi';
import styles from './MergeTicketsModal.module.css';

interface MergeTicketsModalProps {
  open: boolean;
  onClose: () => void;
  initialTargetTicket: Ticket;
  preselectedSource?: Ticket | null;
  onMergedSuccess?: (primaryTicket: Ticket) => void;
}

const QUICK_TEMPLATES = [
  'Repeated issue submitted by same tenant in same category',
  'Duplicate issue reported by same tenant',
  'Same technical category fault (Internet / Network / Server)',
  'Recurring system incident across multiple users',
  'Duplicate submission created in error',
  'Same hardware workstation/equipment fault',
];

export default function MergeTicketsModal({
  open,
  onClose,
  initialTargetTicket,
  preselectedSource,
  onMergedSuccess,
}: MergeTicketsModalProps) {
  const { user } = useAuth();
  const [primaryTicket, setPrimaryTicket] = useState<Ticket>(initialTargetTicket);
  const [activeTab, setActiveTab] = useState<'suggested' | 'search'>('suggested');
  const [candidates, setCandidates] = useState<MergeCandidateWithSimilarity[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [selectedSources, setSelectedSources] = useState<Ticket[]>([]);
  const [mergeReason, setMergeReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (open) {
      let target = initialTargetTicket;
      let source = preselectedSource;

      // If user is a Department Manager, ensure the primary ticket belongs to their department
      if (user?.role === 'manager') {
        const userDeptIds = (user.departments || []).map((d: any) => String(d?.id || d)).filter(Boolean);
        if ((user as any)?.departmentId) userDeptIds.push(String((user as any).departmentId));
        if ((user as any)?.department_id) userDeptIds.push(String((user as any).department_id));
        const targetDept = String(target?.departmentId || (target as any)?.department_id || '');
        const sourceDept = String(source?.departmentId || (source as any)?.department_id || '');

        if (source && sourceDept && userDeptIds.includes(sourceDept) && (!targetDept || !userDeptIds.includes(targetDept))) {
          target = source;
          source = initialTargetTicket;
        }
      }

      setPrimaryTicket(target);
      setSelectedSources(source ? [source] : []);
      setMergeReason('');
      setShowConfirm(false);
      setErrorMessage(null);
      setSearchQuery('');
      setManualInput('');
    }
  }, [open, initialTargetTicket, preselectedSource, user]);

  // Load candidates for current primary ticket
  useEffect(() => {
    if (!open || !primaryTicket?.id) return;
    setLoadingCandidates(true);
    setErrorMessage(null);
    fetchMergeCandidates(primaryTicket.id, searchQuery)
      .then((res) => {
        setCandidates(res.data?.data || []);
      })
      .catch((err) => {
        setCandidates([]);
        setErrorMessage(err?.response?.data?.message || 'Failed to load duplicate suggestions.');
      })
      .finally(() => {
        setLoadingCandidates(false);
      });
  }, [open, primaryTicket?.id, searchQuery]);

  // STRICT RULE: Candidates MUST have the exact same category as the primary ticket.
  // Tickets with different categories can never be merged or shown as merge options.
  const targetCategory = (primaryTicket?.category || '').toLowerCase().trim();

  const sameCategoryCandidates = useMemo(() => {
    if (!targetCategory) return [];
    return candidates.filter((c) => (c.category || '').toLowerCase().trim() === targetCategory);
  }, [candidates, targetCategory]);

  // Filter candidates for suggested tab vs search tab
  const suggestedCandidates = useMemo(() => {
    return sameCategoryCandidates.filter((c) => (c.similarityScore || 0) >= 40);
  }, [sameCategoryCandidates]);

  // Candidates visible in current tab & search filter
  const visibleCandidates = useMemo(() => {
    const base = activeTab === 'suggested' ? suggestedCandidates : sameCategoryCandidates;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.referenceNumber?.toLowerCase().includes(q) ||
        c.trackNumber?.toLowerCase().includes(q) ||
        c.tenantName?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q)
    );
  }, [activeTab, suggestedCandidates, sameCategoryCandidates, searchQuery]);

  const handleSelectAllVisible = () => {
    const toAdd = visibleCandidates.filter(
      (c) => c.id !== primaryTicket.id && !selectedSources.some((s) => s.id === c.id)
    );
    setSelectedSources((prev) => [...prev, ...toAdd]);
  };

  const handleClearSelected = () => {
    setSelectedSources([]);
  };

  const toggleSelectSource = (ticketToToggle: Ticket) => {
    if (ticketToToggle.id === primaryTicket.id) return;

    // Reject selection if categories differ
    const toggleCat = (ticketToToggle.category || '').toLowerCase().trim();
    if (targetCategory && toggleCat && toggleCat !== targetCategory) {
      setErrorMessage(
        `Cannot select ticket #${ticketToToggle.referenceNumber || ticketToToggle.id}: it belongs to category "${ticketToToggle.category}", while primary ticket is in category "${primaryTicket.category}". Only tickets in the exact same category can be merged.`
      );
      return;
    }

    setSelectedSources((prev) => {
      const exists = prev.some((t) => t.id === ticketToToggle.id);
      if (exists) {
        return prev.filter((t) => t.id !== ticketToToggle.id);
      } else {
        return [...prev, ticketToToggle];
      }
    });
  };

  const handleManualAdd = () => {
    const raw = manualInput.trim();
    if (!raw) return;
    const found = candidates.find(
      (c) =>
        c.referenceNumber?.toLowerCase() === raw.toLowerCase() ||
        c.id.toLowerCase() === raw.toLowerCase()
    );
    if (found) {
      const foundCat = (found.category || '').toLowerCase().trim();
      if (targetCategory && foundCat && foundCat !== targetCategory) {
        setErrorMessage(
          `Cannot merge ticket #${found.referenceNumber || found.id}: it belongs to category "${found.category}", which is different from primary ticket category "${primaryTicket.category}". Tickets with different categories can never be merged.`
        );
        return;
      }
      toggleSelectSource(found);
      setManualInput('');
    } else {
      // Mock minimal ticket from input to allow backend to resolve by ref #
      const tempTicket: Ticket = {
        id: raw,
        referenceNumber: raw,
        trackNumber: raw,
        title: `Ticket ${raw}`,
        description: '',
        status: 'open',
        priority: 'medium',
        category: primaryTicket.category || 'General',
        tenantId: '',
        createdBy: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantConfirmationStatus: 'not_required',
        isEscalated: false,
      };
      toggleSelectSource(tempTicket);
      setManualInput('');
    }
  };

  const handleDesignatePrimary = (newPrimary: Ticket) => {
    const newCat = (newPrimary?.category || '').toLowerCase().trim();
    if (targetCategory && newCat && newCat !== targetCategory) {
      setErrorMessage(
        `Cannot designate ticket #${newPrimary.referenceNumber || newPrimary.id} as primary because its category ("${newPrimary.category}") differs from "${primaryTicket.category}". All merged tickets must have the exact same category.`
      );
      return;
    }

    if (user?.role === 'manager') {
      const userDeptIds = (user.departments || []).map((d: any) => String(d.id)).filter(Boolean);
      const newDept = String(newPrimary?.departmentId || (newPrimary as any)?.department_id || '');
      if (newDept && !userDeptIds.includes(newDept)) {
        setErrorMessage(
          `Cannot designate ticket #${newPrimary.referenceNumber || newPrimary.id} as primary because it belongs to another department. The primary ticket must be assigned to your department.`
        );
        return;
      }
    }
    // Current primary ticket moves to sources if it wasn't there
    const oldPrimary = primaryTicket;
    setPrimaryTicket(newPrimary);

    setSelectedSources((prev) => {
      const withoutNew = prev.filter((t) => t.id !== newPrimary.id);
      if (!withoutNew.some((t) => t.id === oldPrimary.id)) {
        return [oldPrimary, ...withoutNew];
      }
      return withoutNew;
    });
  };

  const handleExecuteMerge = async () => {
    if (selectedSources.length === 0) {
      setErrorMessage('Please select at least one duplicate ticket to merge.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const sourceIds = selectedSources.map((s) => s.id || s.referenceNumber).filter(Boolean);
      if (sourceIds.length === 0) {
        setErrorMessage('No valid ticket IDs selected for merge.');
        return;
      }
      const reasonToSend = mergeReason.trim() || 'Duplicate reports combined into primary ticket';
      const res = await mergeTickets(primaryTicket.id, sourceIds, reasonToSend);
      if (onMergedSuccess && res.data?.data) {
        onMergedSuccess(res.data.data as Ticket);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMessage(e?.response?.data?.message || 'Failed to merge tickets. Check permissions and ticket states.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // Helper styles for priority badge
  const getPriorityBadgeClass = (priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent') return styles.priorityBadgeUrgent;
    if (p === 'high') return styles.priorityBadgeHigh;
    if (p === 'medium') return styles.priorityBadgeMed;
    return styles.priorityBadgeLow;
  };

  // Helper styles for status badge
  const getStatusBadgeClass = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('escalat')) return styles.statusBadgeEscalated;
    if (s.includes('progress') || s.includes('assign')) return styles.statusBadgeProgress;
    if (s.includes('open') || s.includes('pending')) return styles.statusBadgeOpen;
    return styles.statusBadgeResolved;
  };

  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="merge-modal-title">
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleGroup}>
            <div className={styles.modalHeaderIconWrap}>
              <ArrowsRightLeftIcon className={styles.modalHeaderIcon} />
            </div>
            <div>
              <h2 id="merge-modal-title" className={styles.modalTitle}>Merge Duplicate Tickets</h2>
              <div className={styles.modalSubtitle}>
                Combine duplicate or related reports into one active primary ticket. Original records, tenant identities, and frozen SLA timers are preserved.
              </div>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} title="Close" aria-label="Close dialog">
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {errorMessage && (
            <div className={styles.errorNoticeCard} role="alert">
              <ExclamationTriangleIcon className={styles.errorNoticeIcon} />
              <div className={styles.errorNoticeBody}>
                <span className={styles.errorNoticeTitle}>Access Notice</span>
                <span className={styles.errorNoticeMsg}>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Primary Ticket Highlight */}
          <div className={styles.primaryTicketBanner}>
            <div className={styles.primaryIconBadge}>
              <ShieldCheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Primary Ticket
            </div>
            <div className={styles.primaryBannerDetails}>
              <div className={styles.primaryBannerTitleRow}>
                <span className={styles.primaryRefBadge}>#{primaryTicket.referenceNumber || primaryTicket.id}</span>
                {primaryTicket.trackNumber && (
                  <span className={styles.candidateTrk}>TRK: {primaryTicket.trackNumber}</span>
                )}
                <span className={styles.primaryTitleText}>{primaryTicket.title}</span>
              </div>
              <div className={styles.primaryBannerMeta}>
                <span className={styles.metaItem}>
                  <strong className={styles.metaLabel}>Tenant:</strong>{' '}
                  <span className={styles.metaVal}>{primaryTicket.tenantName || 'N/A'}</span>
                </span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.metaItem}>
                  <strong className={styles.metaLabel}>Category:</strong>{' '}
                  <span className={styles.metaVal}>{primaryTicket.category}</span>
                </span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.metaItem}>
                  <strong className={styles.metaLabel}>Priority:</strong>{' '}
                  <span className={getPriorityBadgeClass(primaryTicket.priority)}>{primaryTicket.priority}</span>
                </span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.metaItem}>
                  <strong className={styles.metaLabel}>Status:</strong>{' '}
                  <span className={getStatusBadgeClass(primaryTicket.status)}>{primaryTicket.status}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabsBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'suggested' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('suggested')}
            >
              <SparklesIcon style={{ width: 16, height: 16 }} />
              <span>Suggested Duplicates</span>
              <span className={styles.tabCountBadge}>{suggestedCandidates.length}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'search' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />
              <span>Search & Select All</span>
              <span className={styles.tabCountBadge}>{sameCategoryCandidates.length}</span>
            </button>
          </div>

          {/* Search Bar / Manual Add */}
          <div className={styles.searchBarRow}>
            <div className={styles.searchInputWrap}>
              <MagnifyingGlassIcon className={styles.searchLeadingIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={activeTab === 'suggested' ? `Filter suggestions in "${primaryTicket.category}"...` : `Search tickets in "${primaryTicket.category}" category...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.directAddWrap}>
              <input
                type="text"
                className={styles.directAddInput}
                placeholder="Direct Ref # or ID..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualAdd();
                  }
                }}
              />
              <button
                type="button"
                className={styles.quickAddBtn}
                onClick={handleManualAdd}
                disabled={!manualInput.trim()}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Candidates Toolbar */}
          <div className={styles.candidatesToolbar}>
            <span className={styles.candidatesCountText}>
              Showing <strong>{visibleCandidates.length}</strong> {activeTab === 'suggested' ? 'suggested duplicates' : 'candidate tickets'} in category <strong>"{primaryTicket.category}"</strong>
              {selectedSources.length > 0 && (
                <span className={styles.selectedCountBadge}> • {selectedSources.length} selected</span>
              )}
            </span>
            <div className={styles.toolbarActions}>
              {visibleCandidates.length > 0 && (
                <button
                  type="button"
                  className={styles.toolbarBtn}
                  onClick={handleSelectAllVisible}
                  title="Select all tickets currently listed"
                >
                  Select All ({visibleCandidates.length})
                </button>
              )}
              {selectedSources.length > 0 && (
                <button
                  type="button"
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnSecondary}`}
                  onClick={handleClearSelected}
                  title="Uncheck all selected tickets"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Candidates List */}
          {loadingCandidates ? (
            <div className={styles.loadingBox}>
              <span className={styles.loadingSpinner} />
              <span>Scanning active tickets in category "{primaryTicket.category}" for duplicate patterns…</span>
            </div>
          ) : (
            <div className={styles.candidatesList}>
              {visibleCandidates.length === 0 ? (
                <div className={styles.emptyCandidatesBox}>
                  {activeTab === 'suggested'
                    ? `No high-confidence duplicate tickets automatically detected in category "${primaryTicket.category}". Only tickets belonging to the same category can be merged.`
                    : `No candidate tickets found in category "${primaryTicket.category}". Tickets with different categories are strictly prohibited from merging.`}
                </div>
              ) : (
                visibleCandidates.map((cand) => {
                  const isSelected = selectedSources.some((s) => s.id === cand.id);
                  const isCurrentPrimary = cand.id === primaryTicket.id;
                  const score = cand.similarityScore || 0;

                  return (
                    <div
                      key={cand.id}
                      className={`${styles.candidateCard} ${isSelected ? styles.candidateCardSelected : ''}`}
                      onClick={() => !isCurrentPrimary && toggleSelectSource(cand)}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          if (!isCurrentPrimary) toggleSelectSource(cand);
                        }
                      }}
                    >
                      <div className={styles.checkboxWrapper}>
                        <input
                          type="checkbox"
                          className={styles.candidateCheckbox}
                          checked={isSelected}
                          disabled={isCurrentPrimary}
                          onChange={() => !isCurrentPrimary && toggleSelectSource(cand)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ticket ${cand.referenceNumber || cand.id}`}
                        />
                      </div>
                      <div className={styles.candidateInfo}>
                        {/* Top Row: Badges on left, Action on right */}
                        <div className={styles.candidateTopRow}>
                          <div className={styles.badgeCluster}>
                            <span className={styles.candidateRef}>#{cand.referenceNumber || cand.id.slice(0, 8)}</span>
                            {cand.trackNumber && (
                              <span className={styles.candidateTrk}>TRK: {cand.trackNumber}</span>
                            )}
                            {score >= 80 ? (
                              <span className={styles.similarityScoreBadgeHigh}>★ {score}% Match</span>
                            ) : score >= 50 ? (
                              <span className={styles.similarityScoreBadgeMed}>● {score}% Match</span>
                            ) : score > 0 ? (
                              <span className={styles.similarityScoreBadgeLow}>{score}%</span>
                            ) : null}
                          </div>
                          {!isCurrentPrimary && (
                            <button
                              type="button"
                              className={styles.setPrimaryBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDesignatePrimary(cand);
                              }}
                              title="Make this ticket the Primary ticket instead"
                            >
                              <StarIcon style={{ width: 13, height: 13, display: 'inline', marginRight: 3 }} />
                              Set as Primary
                            </button>
                          )}
                        </div>

                        {/* Title Row */}
                        <div className={styles.candidateTitleRow}>
                          <span className={styles.candidateTitle}>{cand.title}</span>
                        </div>

                        {/* Metadata row with badge pills */}
                        <div className={styles.candidateMeta}>
                          <span className={styles.metaItem}>
                            <strong className={styles.metaLabel}>Tenant:</strong>{' '}
                            <span className={styles.metaVal}>{cand.tenantName || 'N/A'}</span>
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}>
                            <strong className={styles.metaLabel}>Category:</strong>{' '}
                            <span className={styles.metaVal}>{cand.category}</span>
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}>
                            <strong className={styles.metaLabel}>Priority:</strong>{' '}
                            <span className={getPriorityBadgeClass(cand.priority)}>{cand.priority}</span>
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}>
                            <strong className={styles.metaLabel}>Status:</strong>{' '}
                            <span className={getStatusBadgeClass(cand.status)}>{cand.status}</span>
                          </span>
                          {cand.createdAt && (
                            <>
                              <span className={styles.metaDot}>•</span>
                              <span className={styles.metaItem}>
                                <span className={styles.metaVal}>{new Date(cand.createdAt).toLocaleDateString()}</span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Similarity rationale tags */}
                        {cand.similarityReasons && cand.similarityReasons.length > 0 && (
                          <div className={styles.reasonTagsRow}>
                            {cand.similarityReasons.map((r, idx) => (
                              <span key={idx} className={styles.reasonTag}>
                                <CheckCircleIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
                                <span>{r}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Selected Tickets Box */}
          {selectedSources.length > 0 && (
            <div className={styles.selectedBox}>
              <div className={styles.selectedHeader}>
                <span>Selected Duplicate Tickets to Merge ({selectedSources.length})</span>
                <span className={styles.selectedHeaderHint}>Click ✕ to remove from merge list</span>
              </div>
              <div className={styles.selectedPillsRow}>
                {selectedSources.map((st) => (
                  <span key={st.id} className={styles.selectedPill}>
                    <strong>#{st.referenceNumber || st.id.slice(0, 8)}</strong>: {st.title}
                    <button
                      type="button"
                      className={styles.removePillBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectSource(st);
                      }}
                      title="Remove from merge list"
                      aria-label={`Remove ticket ${st.referenceNumber || st.id}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison */}
          {selectedSources.length > 0 && (
            <div className={styles.comparisonContainer}>
              <div className={styles.comparisonHeader}>
                <ArrowsRightLeftIcon style={{ width: 16, height: 16 }} />
                <span>Ticket Comparison Before Merging</span>
              </div>
              <div className={styles.comparisonGrid}>
                {/* Primary Column */}
                <div className={styles.comparisonCol}>
                  <div className={styles.comparisonColHeader}>
                    <span>🎯 Designated Primary</span>
                    <span className={styles.colSubtext}>(Will remain active)</span>
                  </div>
                  <div className={styles.comparisonItem}>
                    <span className={styles.comparisonLabel}>Reference & Title</span>
                    <span className={styles.comparisonVal}>
                      <strong>#{primaryTicket.referenceNumber || primaryTicket.id}</strong> — {primaryTicket.title}
                    </span>
                  </div>
                  <div className={styles.comparisonItem}>
                    <span className={styles.comparisonLabel}>Tenant & Submitter</span>
                    <span className={styles.comparisonVal}>{primaryTicket.tenantName || 'N/A'}</span>
                  </div>
                  <div className={styles.comparisonItem}>
                    <span className={styles.comparisonLabel}>Category & Priority</span>
                    <span className={styles.comparisonVal}>{primaryTicket.category} • {primaryTicket.priority}</span>
                  </div>
                  <div className={styles.comparisonItem}>
                    <span className={styles.comparisonLabel}>Status & Created</span>
                    <span className={styles.comparisonVal}>
                      {primaryTicket.status} • {primaryTicket.createdAt ? new Date(primaryTicket.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Secondary Column */}
                <div className={styles.comparisonCol}>
                  <div className={styles.comparisonColHeader}>
                    <span>📎 Selected Duplicate(s)</span>
                    <span className={styles.colSubtext}>({selectedSources.length} will be merged & closed)</span>
                  </div>
                  {selectedSources.map((src) => (
                    <div key={src.id} className={styles.comparisonSubCard}>
                      <div className={styles.comparisonItem}>
                        <span className={styles.comparisonLabel}>Reference & Title</span>
                        <span className={styles.comparisonVal}>
                          <strong>#{src.referenceNumber || src.id}</strong> — {src.title}
                        </span>
                      </div>
                      <div className={styles.comparisonItem}>
                        <span className={styles.comparisonLabel}>Tenant / Category</span>
                        <span className={styles.comparisonVal}>{src.tenantName || 'N/A'} • {src.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Merge Reason & Templates */}
          <div className={styles.reasonSection}>
            <div className={styles.reasonLabelRow}>
              <label htmlFor="merge-reason-input" className={styles.reasonLabel}>
                Merge Reason <span className={styles.requiredTag}>(Required)</span>
              </label>
              <span className={styles.reasonHint}>
                Will be documented in audit trails and notified to tenants
              </span>
            </div>
            <div className={styles.templateRow}>
              {QUICK_TEMPLATES.map((tmpl) => {
                const isActive = mergeReason === tmpl;
                return (
                  <button
                    key={tmpl}
                    type="button"
                    className={`${styles.templateChip} ${isActive ? styles.templateChipActive : ''}`}
                    onClick={() => setMergeReason(tmpl)}
                  >
                    {isActive ? '✓ ' : '+ '}
                    {tmpl}
                  </button>
                );
              })}
            </div>
            <textarea
              id="merge-reason-input"
              className={styles.reasonTextarea}
              placeholder="Explain why these tickets are duplicate or related (minimum 3 characters)..."
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
            />
          </div>

          {/* SLA Preservation Policy Notice */}
          <div className={styles.slaNoticeBox}>
            <strong>SLA & History Preservation:</strong> Original ticket records, IDs, comments, attachments, and submitter identities will never be deleted. SLA timers on merged duplicate tickets are frozen as of the merge moment. Resolution outcomes and closures will synchronize from the Primary Ticket to all linked tickets.
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          {!showConfirm ? (
            <button
              type="button"
              className={styles.mergeBtn}
              onClick={() => {
                if (selectedSources.length === 0) {
                  setErrorMessage('Please select at least one duplicate ticket to merge.');
                  return;
                }
                if (!mergeReason.trim() || mergeReason.trim().length < 3) {
                  setMergeReason('Duplicate reports combined into primary incident');
                }
                setErrorMessage(null);
                setShowConfirm(true);
              }}
              disabled={selectedSources.length === 0 || submitting}
            >
              Review & Merge ({selectedSources.length})
            </button>
          ) : (
            <div className={styles.confirmActionRow}>
              <span className={styles.confirmPromptText}>
                Confirm combining {selectedSources.length} ticket(s) into #{primaryTicket.referenceNumber || primaryTicket.id}?
              </span>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="button"
                className={`${styles.mergeBtn} ${styles.mergeBtnConfirm}`}
                onClick={handleExecuteMerge}
                disabled={submitting}
              >
                {submitting ? 'Merging…' : `Yes, Merge ${selectedSources.length} Tickets Together`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
