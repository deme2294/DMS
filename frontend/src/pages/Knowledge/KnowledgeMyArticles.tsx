import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchMyArticles,
  submitArticle,
  requestRevision,
  approveArticle,
  rejectArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  restoreArticle,
  moveToDraft,
  deleteArticle,
  fetchArticleStats,
} from '../../api/knowledgeApi';
import type { Article, ArticleStats } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import Modal from '../../components/Modal/Modal';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowActionModal, type WorkflowActionType } from './components/WorkflowActionModal';
import { QuickReviseModal } from './components/QuickReviseModal';
import { ArticleDetailDrawer } from './components/ArticleDetailDrawer';
import styles from './KnowledgeMyArticles.module.css';

type StatusFilter = '' | 'draft' | 'pending_approval' | 'needs_revision' | 'approved' | 'published' | 'archived' | 'restored';

export default function KnowledgeMyArticles() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  const basePath = role === 'staff' ? '/staff/knowledge' : role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';

  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pagination & Filters
  const [artPage, setArtPage] = useState(1);
  const [artPageSize, setArtPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const ART_PAGE_OPTIONS = [10, 20, 50];

  // Action Modals State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<WorkflowActionType | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Quick Revise Modal State
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [reviseArticle, setReviseArticle] = useState<Article | null>(null);

  // Drawer Preview State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerArticle, setDrawerArticle] = useState<Article | null>(null);

  // Delete Target
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyArticles({
        page: artPage,
        limit: artPageSize,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setArticles(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch {
      setError('Failed to load your knowledge articles');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [artPage, artPageSize, statusFilter, search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchArticleStats();
      if (res.data.success && res.data.data) {
        setStats(res.data.data);
      }
    } catch {
      // Non-critical statistics
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadStats();
  }, [loadArticles, loadStats]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const runAction = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await loadArticles();
      await loadStats();
      if (drawerArticle?.id === id) {
        setDrawerOpen(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Workflow action failed';
      setError(msg);
    } finally {
      setBusyId(null);
    }
  };

  // Open the unified workflow action modal (request_revision, reject, publish, unpublish, submit)
  const handleOpenActionModal = (article: Article, type: WorkflowActionType) => {
    setSelectedArticle(article);
    setActionType(type);
    setActionModalOpen(true);
  };

  // Submit the workflow action with the reason/information
  const handleWorkflowSubmit = async (articleId: string, type: WorkflowActionType, reason?: string) => {
    setActionBusy(true);
    setError('');
    try {
      switch (type) {
        case 'request_revision':
          await requestRevision(articleId, reason || '');
          setMessage(`Revision requested on article. Creator has been notified.`);
          break;
        case 'reject':
          await rejectArticle(articleId, reason || '');
          setMessage(`Article marked as rejected.`);
          break;
        case 'publish':
          await publishArticle(articleId);
          setMessage(`Article successfully published to live portal!`);
          break;
        case 'unpublish':
          await unpublishArticle(articleId, reason);
          setMessage(`Article unpublished.`);
          break;
        case 'submit':
          await submitArticle(articleId);
          setMessage(`Article submitted to Admin for review.`);
          break;
      }
      setActionModalOpen(false);
      setSelectedArticle(null);
      await loadArticles();
      await loadStats();
      if (drawerArticle?.id === articleId) {
        setDrawerOpen(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to process workflow action';
      setError(msg);
    } finally {
      setActionBusy(false);
    }
  };

  // Direct 1-Click Approve (Admin or Manager)
  const handleDirectApprove = async (articleId: string) => {
    await runAction(
      articleId,
      () => approveArticle(articleId),
      'Article approved! Ready for Admin publication.'
    );
  };

  // Open Quick Revise Modal
  const handleOpenRevise = (article: Article) => {
    setReviseArticle(article);
    setReviseModalOpen(true);
  };

  // Open Drawer Quick Review
  const handleOpenDrawer = (article: Article) => {
    setDrawerArticle(article);
    setDrawerOpen(true);
  };

  // Delete Draft
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await runAction(deleteTarget.id, () => deleteArticle(deleteTarget.id), 'Article deleted');
    setDeleteTarget(null);
  };

  const handleTabChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setArtPage(1);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Department Knowledge Base"
        description="End-to-end knowledge lifecycle: create, review, verify, revise, approve, and publish articles seamlessly."
        backTo={basePath}
        actionLabel="+ New Article"
        onAction={() => navigate(`${basePath}/create`)}
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      {/* ── Executive Governance Banner ── */}
      <div className={styles.roleScopeBanner}>
        <div className={styles.roleScopeLeft}>
          <div className={styles.roleScopeIcon}>📚</div>
          <div>
            <div className={styles.roleScopeTitle}>
              {isAdmin
                ? 'Admin Knowledge Governance & Publishing Queue'
                : isManager
                ? 'Department Manager Knowledge Operations & Verification'
                : 'Staff Contributor Workspace'}
            </div>
            <div className={styles.roleScopeDesc}>
              {isAdmin
                ? 'Review department manager submissions, verify accuracy, issue revision directives, and publish official articles live for users.'
                : isManager
                ? 'Manage department articles, address Admin revision directives, and progress your documentation from draft to approved publication.'
                : 'Author, revise, and track where your documentation submissions have reached from review to approved publication, and monitor reader feedback. Note: Review, approval, and live publishing are the exclusive duty of Department Managers and System Administrators.'}
            </div>
          </div>
        </div>

        {/* Quick Lifecycle Stage Indicators */}
        <div className={styles.lifecyclePills}>
          <span className={styles.lifecycleStep}>1. Draft</span>
          <span className={styles.lifecycleArrow}>→</span>
          <span className={styles.lifecycleStep}>2. Review</span>
          <span className={styles.lifecycleArrow}>→</span>
          <span className={styles.lifecycleStep}>3. Revise</span>
          <span className={styles.lifecycleArrow}>→</span>
          <span className={styles.lifecycleStep}>4. Approve</span>
          <span className={styles.lifecycleArrow}>→</span>
          <span className={`${styles.lifecycleStep} ${styles.lifecycleStepActive}`}>5. Publish</span>
        </div>
      </div>

      {/* ── Workflow Status Tabs ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${statusFilter === '' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('')}
        >
          All Articles {totalCount > 0 ? `(${totalCount})` : ''}
        </button>
        <button
          className={`${styles.tabBtn} ${statusFilter === 'draft' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('draft')}
        >
          📝 Drafts {stats?.draft ? `(${stats.draft})` : ''}
        </button>
        <button
          className={`${styles.tabBtn} ${statusFilter === 'pending_approval' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('pending_approval')}
        >
          ⏳ Under Review {stats?.pending_approval ? `(${stats.pending_approval})` : ''}
        </button>
        <button
          className={`${styles.tabBtn} ${statusFilter === 'needs_revision' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('needs_revision')}
        >
          ⚠️ Needs Revision {stats?.needs_revision ? `(${stats.needs_revision})` : ''}
        </button>
        <button
          className={`${styles.tabBtn} ${statusFilter === 'approved' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('approved')}
        >
          ✓ Approved {stats?.approved ? `(${stats.approved})` : ''}
        </button>
        <button
          className={`${styles.tabBtn} ${statusFilter === 'published' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('published')}
        >
          🌐 Published {stats?.published ? `(${stats.published})` : ''}
        </button>
        {isAdmin && (
          <button
            className={`${styles.tabBtn} ${statusFilter === 'archived' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('archived')}
          >
            📦 Archived {stats?.archived ? `(${stats.archived})` : ''}
          </button>
        )}
        <button
          className={`${styles.tabBtn} ${statusFilter === 'restored' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('restored')}
        >
          🔄 Restored {stats?.restored ? `(${stats.restored})` : ''}
        </button>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className={styles.filtersRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by article title, reference (KB-...), category, or content..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setArtPage(1);
          }}
        />

        <div className={styles.filterMeta}>
          <span className={styles.totalBadge}>
            {totalCount === 0 ? '0 articles' : `${totalCount} article${totalCount > 1 ? 's' : ''}`}
          </span>
          <select
            className={styles.pageSizeSelect}
            value={artPageSize}
            onChange={(e) => {
              setArtPageSize(Number(e.target.value));
              setArtPage(1);
            }}
          >
            {ART_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Show {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Data Table with Interactive Lifecycle Actions ── */}
      <DataTable<Article>
        loading={loading}
        data={articles}
        columns={[
          {
            key: 'title',
            label: 'Article Title & Reference',
            render: (row) => {
              const hasRevisionNotes = row.status === 'needs_revision' && row.revisionNotes;
              return (
                <div className={styles.titleColumnWrap}>
                  <div className={styles.articleTitleRow}>
                    <span
                      className={styles.articleTitleLink}
                      onClick={() => handleOpenDrawer(row)}
                      title="Click to review full article"
                    >
                      {row.title}
                    </span>
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.referenceBadge}>{row.articleReference}</span>
                    {row.departmentName && (
                      <span className={styles.deptChip}>🏢 {row.departmentName}</span>
                    )}
                    <span className={styles.authorChip}>
                      👤{' '}
                      {row.authorFirstName || row.authorLastName
                        ? `${row.authorFirstName || ''} ${row.authorLastName || ''}`.trim()
                        : 'Author'}
                    </span>
                    <span>· Created {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</span>
                  </div>

                  {/* Inline Revision Alert Card */}
                  {hasRevisionNotes && (
                    <div className={styles.inlineRevisionAlert}>
                      <span className={styles.inlineRevisionIcon}>⚠️</span>
                      <div className={styles.inlineRevisionText}>
                        <strong>Admin Revision Directive:</strong> {row.revisionNotes}
                      </div>
                      {(row.authorId === user?.id || isManager) && (
                        <button
                          type="button"
                          className={styles.inlineReviseBtn}
                          onClick={() => handleOpenRevise(row)}
                        >
                          Revise Now →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: 'category',
            label: 'Category',
            render: (row) => (
              <span className={styles.categoryCell}>
                <span>{resolveCategoryIcon(row.category)}</span>
                <span className={styles.categoryName}>{row.category}</span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Where It Reached (Lifecycle Stage)',
            render: (row) => {
              let step = 1;
              let stageText = 'Stage 1: Draft Created';
              if (row.status === 'pending_approval') {
                step = 2;
                stageText = 'Stage 2: Under Review by Admin/Manager';
              } else if (row.status === 'needs_revision') {
                step = 2;
                stageText = '⚠️ Changes Requested by Reviewer';
              } else if (row.status === 'approved') {
                step = 3;
                stageText = 'Stage 3: Approved · Waiting Admin to Publish';
              } else if (row.status === 'published') {
                step = 4;
                stageText = 'Stage 4: Live on Help Desk Portal';
              } else if (row.status === 'rejected') {
                step = 2;
                stageText = '✕ Submission Rejected';
              } else if (row.status === 'archived') {
                step = 4;
                stageText = '📦 Retired to Archive';
              } else if (row.status === 'restored') {
                step = 1;
                stageText = '🔄 Restored · Ready to Edit or Re-publish';
              }

              return (
                <div className={styles.stageColumnWrap}>
                  <div className={styles.stepperMini}>
                    {/* Step 1: Draft */}
                    <div className={styles.stepperMiniStep}>
                      <span
                        className={`${styles.stepperMiniDot} ${
                          step >= 1 ? (step > 1 ? styles.stepperMiniDotCompleted : styles.stepperMiniDotActive) : ''
                        }`}
                        title="Draft Created"
                      >
                        {step > 1 ? '✓' : '1'}
                      </span>
                    </div>
                    <span className={`${styles.stepperMiniLine} ${step > 1 ? styles.stepperMiniLineCompleted : ''}`} />

                    {/* Step 2: Review / Revision */}
                    <div className={styles.stepperMiniStep}>
                      <span
                        className={`${styles.stepperMiniDot} ${
                          row.status === 'needs_revision'
                            ? styles.stepperMiniDotRevision
                            : step >= 2
                            ? step > 2
                              ? styles.stepperMiniDotCompleted
                              : styles.stepperMiniDotActive
                            : ''
                        }`}
                        title={row.status === 'needs_revision' ? 'Revision Requested' : 'Under Review'}
                      >
                        {row.status === 'needs_revision' ? '!' : step > 2 ? '✓' : '2'}
                      </span>
                    </div>
                    <span className={`${styles.stepperMiniLine} ${step > 2 ? styles.stepperMiniLineCompleted : ''}`} />

                    {/* Step 3: Approved */}
                    <div className={styles.stepperMiniStep}>
                      <span
                        className={`${styles.stepperMiniDot} ${
                          step >= 3 ? (step > 3 ? styles.stepperMiniDotCompleted : styles.stepperMiniDotActive) : ''
                        }`}
                        title="Approved by Department"
                      >
                        {step > 3 ? '✓' : '3'}
                      </span>
                    </div>
                    <span className={`${styles.stepperMiniLine} ${step > 3 ? styles.stepperMiniLineCompleted : ''}`} />

                    {/* Step 4: Published */}
                    <div className={styles.stepperMiniStep}>
                      <span
                        className={`${styles.stepperMiniDot} ${
                          step >= 4 ? styles.stepperMiniDotActive : ''
                        }`}
                        title="Published Live"
                      >
                        {step >= 4 ? '🌐' : '4'}
                      </span>
                    </div>
                  </div>

                  <WorkflowStatusBadge status={row.status} showSubtitle={false} />

                  <div className={styles.stageDescriptionText}>
                    <span>{stageText}</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: 'feedback',
            label: 'Reader & Reviewer Feedback',
            render: (row) => {
              const isPublished = row.status === 'published';
              const hasRevisionNotes = row.status === 'needs_revision' && row.revisionNotes;
              const hasRejection = row.status === 'rejected' && row.rejectionReason;
              const hasApproval = row.approvedAt;

              return (
                <div className={styles.feedbackColumnWrap}>
                  {/* Live Reader Feedback */}
                  <div className={styles.feedbackMetricsRow}>
                    <span className={styles.helpfulTag} title="Helpful votes from readers">
                      👍 {row.helpfulCount || 0}
                    </span>
                    <span className={styles.unhelpfulTag} title="Unhelpful votes from readers">
                      👎 {row.notHelpfulCount || 0}
                    </span>
                    <span className={styles.viewsTag} title="Total view count">
                      👁️ {row.viewCount || 0}
                    </span>
                  </div>

                  {/* Reviewer / Admin Feedback */}
                  {row.revisionNotes && (
                    <div className={styles.reviewerFeedbackChip} title={row.revisionNotes}>
                      <span>⚠️</span>
                      <span>{row.revisionNotes.slice(0, 45)}{row.revisionNotes.length > 45 ? '...' : ''}</span>
                    </div>
                  )}

                  {row.rejectionReason && (
                    <div className={styles.reviewerFeedbackChip} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#dc2626' }} title={row.rejectionReason}>
                      <span>✕</span>
                      <span>{row.rejectionReason.slice(0, 45)}{row.rejectionReason.length > 45 ? '...' : ''}</span>
                    </div>
                  )}

                  {hasApproval && (
                    <div className={styles.approvedByChip} title={`Approved on ${new Date(row.approvedAt!).toLocaleDateString()}`}>
                      <span>✓ Approved</span>
                      {row.approvedFirstName && <span>by {row.approvedFirstName}</span>}
                    </div>
                  )}

                  {!isPublished && !hasRevisionNotes && !hasRejection && !hasApproval && row.status === 'pending_approval' && (
                    <span className={styles.viewsTag}>⏳ Awaiting verification</span>
                  )}
                  {!isPublished && !hasRevisionNotes && !hasRejection && !hasApproval && row.status === 'draft' && (
                    <span className={styles.viewsTag}>📝 Draft (Not submitted)</span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'actions',
            label: 'Operations',
            render: (row) => {
              const isAuthor = row.authorId === user?.id;
              const isStaff = role === 'staff';
              // Staff CANNOT approve, reject, request revision, or publish. This is strictly for Manager & Admin.
              const canApproveOrReview = (isAdmin || (isManager && !isAuthor)) && !isStaff;
              const canPublish = isAdmin;
              const isBusy = busyId === row.id;

              return (
                <div className={styles.actions}>
                  {/* Quick Review Drawer Button (Available for all roles to see full details) */}
                  <button
                    className={styles.viewBtn}
                    onClick={() => handleOpenDrawer(row)}
                    title="Review article body, lifecycle, and feedback details"
                  >
                    👁 Review Details
                  </button>

                  {/* Staff & Author Operations: Edit & Submit allowed when in Draft, Needs Revision, or Restored */}
                  {isAuthor && ['draft', 'needs_revision', 'restored'].includes(row.status) && (
                    <>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleOpenRevise(row)}
                        title="Edit and update article"
                      >
                        ✏️ {row.status === 'restored' ? 'Edit to Draft' : 'Revise'}
                      </button>
                      {row.status !== 'restored' ? (
                        <button
                          className={styles.submitBtn}
                          disabled={isBusy}
                          onClick={() => handleOpenActionModal(row, 'submit')}
                          title="Submit to review queue"
                        >
                          📤 {row.status === 'needs_revision' ? 'Resubmit' : 'Submit'}
                        </button>
                      ) : (
                        <button
                          className={styles.approveBtn}
                          disabled={isBusy}
                          onClick={() => runAction(row.id, () => moveToDraft(row.id), 'Article moved to Draft')}
                          title="Move restored article to Draft"
                        >
                          📝 Move to Draft
                        </button>
                      )}
                    </>
                  )}

                  {/* Restored article action for non-author admin/manager */}
                  {!isAuthor && (isAdmin || isManager) && row.status === 'restored' && (
                    <button
                      className={styles.approveBtn}
                      disabled={isBusy}
                      onClick={() => runAction(row.id, () => moveToDraft(row.id), 'Article moved to Draft')}
                      title="Move restored article to Draft"
                    >
                      📝 Move to Draft
                    </button>
                  )}

                  {/* Admin Direct Re-publish for Restored */}
                  {isAdmin && row.status === 'restored' && (
                    <button
                      className={styles.publishBtn}
                      disabled={isBusy}
                      onClick={() => runAction(row.id, () => publishArticle(row.id), 'Article re-published to tenants!')}
                      title="Admin directly re-publishes restored article"
                    >
                      🚀 Re-publish
                    </button>
                  )}

                  {/* Admin Restore from Archived */}
                  {isAdmin && row.status === 'archived' && (
                    <button
                      className={styles.approveBtn}
                      disabled={isBusy}
                      onClick={() => runAction(row.id, () => restoreArticle(row.id), 'Article restored from archive')}
                      title="Restore article from archive"
                    >
                      🔄 Restore
                    </button>
                  )}

                  {/* Staff Info Indicator: Staff cannot approve/publish, so show state */}
                  {isStaff && row.status === 'pending_approval' && (
                    <span className={styles.staffWaitingChip} title="Submitted to Manager/Admin for review">
                      ⏳ Under Review
                    </span>
                  )}
                  {isStaff && row.status === 'approved' && (
                    <span className={styles.staffWaitingChip} title="Approved by Department — Awaiting Admin Live Publication">
                      ✓ Ready for Admin Publish
                    </span>
                  )}
                  {isStaff && row.status === 'published' && (
                    <span className={styles.staffWaitingChip} style={{ color: '#059669', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }} title="Live on Help Desk Portal">
                      🌐 Published Live
                    </span>
                  )}

                  {/* Admin / Reviewer Actions: Pending Review (Manager & Admin ONLY) */}
                  {canApproveOrReview && row.status === 'pending_approval' && (
                    <>
                      <button
                        className={styles.approveBtn}
                        disabled={isBusy}
                        onClick={() => handleDirectApprove(row.id)}
                        title="Verify and Approve article"
                      >
                        ✓ Approve
                      </button>
                      <button
                        className={styles.revisionBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'request_revision')}
                        title="Direct author to revise with notes"
                      >
                        ⚠️ Request Revision
                      </button>
                      <button
                        className={styles.rejectBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'reject')}
                        title="Reject article submission"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}

                  {/* Admin Publishing: Approved -> Publish Live (Admin ONLY) */}
                  {canPublish && row.status === 'approved' && (
                    <button
                      className={styles.publishBtn}
                      disabled={isBusy}
                      onClick={() => handleOpenActionModal(row, 'publish')}
                      title="Publish article live on the portal"
                    >
                      🌐 Publish Live
                    </button>
                  )}

                  {/* Admin Unpublishing: Published -> Take Offline (Admin ONLY) */}
                  {canPublish && row.status === 'published' && (
                    <button
                      className={styles.unpublishBtn}
                      disabled={isBusy}
                      onClick={() => handleOpenActionModal(row, 'unpublish')}
                      title="Temporarily take offline"
                    >
                      ⏸ Unpublish
                    </button>
                  )}

                  {/* Admin Archive / Retire Article */}
                  {isAdmin && (row.status === 'published' || row.status === 'unpublished') && (
                    <button
                      className={styles.cancelBtn}
                      disabled={isBusy}
                      onClick={() => runAction(row.id, () => archiveArticle(row.id), 'Article retired to archive')}
                      title="Retire article to archive"
                    >
                      📦 Retire
                    </button>
                  )}

                  {/* Delete Draft (Author only when draft) */}
                  {isAuthor && row.status === 'draft' && (
                    <button
                      className={styles.dangerBtn}
                      disabled={isBusy}
                      onClick={() => setDeleteTarget(row)}
                      title="Delete draft article"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={styles.paginationWrap}>
          <button
            onClick={() => setArtPage((p) => Math.max(1, p - 1))}
            disabled={artPage <= 1}
            className={styles.pageBtn}
          >
            ← Previous
          </button>
          <span className={styles.pageIndicator}>
            Page {artPage} of {totalPages}
          </span>
          <button
            onClick={() => setArtPage((p) => Math.min(totalPages, p + 1))}
            disabled={artPage >= totalPages}
            className={styles.pageBtn}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Workflow Action Modal (Revision, Rejection, Publishing, Submission) ── */}
      <WorkflowActionModal
        open={actionModalOpen}
        actionType={actionType}
        article={selectedArticle}
        busy={actionBusy}
        onClose={() => {
          setActionModalOpen(false);
          setSelectedArticle(null);
        }}
        onSubmit={handleWorkflowSubmit}
      />

      {/* ── Quick Revise Modal (Department Manager In-Place Editor) ── */}
      <QuickReviseModal
        open={reviseModalOpen}
        article={reviseArticle}
        onClose={() => {
          setReviseModalOpen(false);
          setReviseArticle(null);
        }}
        onSuccess={(msg) => {
          setMessage(msg);
          loadArticles();
          loadStats();
        }}
      />

      {/* ── Quick Review & Action Drawer ── */}
      <ArticleDetailDrawer
        article={drawerArticle}
        open={drawerOpen}
        currentUserRole={role}
        currentUserId={user?.id}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerArticle(null);
        }}
        onRequestAction={(art, action) => handleOpenActionModal(art, action)}
        onApproveDirect={(id) => handleDirectApprove(id)}
        onOpenRevise={(art) => handleOpenRevise(art)}
      />

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={!!deleteTarget} title="Delete Draft Article" onClose={() => setDeleteTarget(null)}>
        <p>
          Are you sure you want to delete draft <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
        </p>
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button className={styles.dangerBtn} onClick={handleDelete}>
            Delete Article
          </button>
        </div>
      </Modal>
    </div>
  );
}
