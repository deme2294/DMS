import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  QueueListIcon,
  ShieldCheckIcon,
  EyeIcon,
  CheckIcon,
  SparklesIcon,
  XMarkIcon,
  PencilSquareIcon,
  PauseIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  UserIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../../components/PageHeader/PageHeader';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchPendingReview,
  approveArticle,
  rejectArticle,
  publishArticle,
  requestRevision,
  unpublishArticle,
  submitArticle,
} from '../../api/knowledgeApi';
import type { Article } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowActionModal, type WorkflowActionType } from './components/WorkflowActionModal';
import { ArticleDetailDrawer } from './components/ArticleDetailDrawer';
import { QuickReviseModal } from './components/QuickReviseModal';
import { ManagerAssignRevisionModal } from './components/ManagerAssignRevisionModal';
import { getLatestRevisionItem } from '../../utils/revisionUtils';
import styles from './KnowledgeApproval.module.css';

type ApprovalTab = 'all' | 'pending_approval' | 'draft' | 'approved' | 'needs_revision' | 'published' | 'unpublished';

export default function KnowledgeApproval() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const basePath = isManager ? '/manager/knowledge' : '/admin/knowledge';

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Live overview counters across workflow queues
  const [queueCounts, setQueueCounts] = useState({
    draft: 0,
    pending_approval: 0,
    approved: 0,
    needs_revision: 0,
    published: 0,
    unpublished: 0,
    total: 0,
  });

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<ApprovalTab>('all');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalPageSize, setApprovalPageSize] = useState(10);
  const APPROVAL_PAGE_OPTIONS = [10, 20, 50];

  // Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<WorkflowActionType | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Drawer Preview State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerArticle, setDrawerArticle] = useState<Article | null>(null);

  // Quick Revise Modal State
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [reviseArticle, setReviseArticle] = useState<Article | null>(null);

  // Manager Assign Revision Modal State
  const [managerRevisionModalOpen, setManagerRevisionModalOpen] = useState(false);
  const [managerRevisionArticle, setManagerRevisionArticle] = useState<Article | null>(null);

  const fetchOverviewCounts = useCallback(async () => {
    try {
      const res = await fetchPendingReview({ status: 'all' });
      const all = res.data.data || [];
      setQueueCounts({
        draft: all.filter((a) => a.status === 'draft').length,
        pending_approval: all.filter((a) => a.status === 'pending_approval').length,
        approved: all.filter((a) => a.status === 'approved').length,
        needs_revision: all.filter((a) => a.status === 'needs_revision').length,
        published: all.filter((a) => a.status === 'published').length,
        unpublished: all.filter((a) => a.status === 'unpublished').length,
        total: all.length,
      });
    } catch {
      // silent fallback
    }
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPendingReview({
        status: activeTab === 'all' ? 'all' : (activeTab || 'all'),
      });
      setArticles(res.data.data || []);
    } catch {
      setError('Failed to load articles for verification');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadArticles();
    fetchOverviewCounts();
  }, [loadArticles, fetchOverviewCounts]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // Computed Breakdown of Statuses in Current Queue
  const statusBreakdownInQueue = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [articles]);

  // Filtered & Paged Articles
  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeTab === 'all' && subStatusFilter) {
      list = list.filter((a) => a.status === subStatusFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.articleReference.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.departmentName && a.departmentName.toLowerCase().includes(q)) ||
        (a.content && a.content.toLowerCase().includes(q))
    );
  }, [articles, search, activeTab, subStatusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredArticles.length / approvalPageSize)),
    [filteredArticles.length, approvalPageSize]
  );

  const pagedArticles = useMemo(
    () =>
      filteredArticles.slice(
        (approvalPage - 1) * approvalPageSize,
        approvalPage * approvalPageSize
      ),
    [filteredArticles, approvalPage, approvalPageSize]
  );

  const runAction = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await Promise.all([loadArticles(), fetchOverviewCounts()]);
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

  // Open Unified Action Modal
  const handleOpenActionModal = (article: Article, type: WorkflowActionType) => {
    setSelectedArticle(article);
    setActionType(type);
    setActionModalOpen(true);
  };

  // Submit Workflow Action (Request Revision, Reject, Publish, Unpublish, Resubmit)
  const handleWorkflowSubmit = async (
    articleId: string,
    type: WorkflowActionType,
    reason?: string,
    options?: { routeTo?: 'manager' | 'author' }
  ) => {
    setActionBusy(true);
    setError('');
    try {
      switch (type) {
        case 'request_revision':
          await requestRevision(articleId, reason || '', options);
          setMessage(
            options?.routeTo === 'manager'
              ? `Revision directive routed to Department Manager.`
              : `Revision directive issued to Author.`
          );
          break;
        case 'reject':
          await rejectArticle(articleId, reason || '');
          setMessage(`Article marked as rejected.`);
          break;
        case 'publish':
          await publishArticle(articleId);
          setMessage(`Article published live! Now accessible to portal tenants.`);
          break;
        case 'unpublish':
          await unpublishArticle(articleId, reason);
          setMessage(`Article unpublished.`);
          break;
        case 'submit':
          await submitArticle(articleId, reason ? { notes: reason } : undefined);
          setMessage(isManager ? `Article revised and routed directly to Admin!` : `Article resubmitted for department review.`);
          break;
      }
      setActionModalOpen(false);
      setSelectedArticle(null);
      await Promise.all([loadArticles(), fetchOverviewCounts()]);
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

  // Direct 1-Click Approve (Admin or Department Manager)
  const handleDirectApprove = async (articleId: string) => {
    await runAction(
      articleId,
      () => approveArticle(articleId),
      isAdmin
        ? 'Article approved! Ready to publish to tenants.'
        : 'Department Manager approved! Sent to Admin queue for final publication.'
    );
  };

  // Direct 1-Click Approve & Publish (Admin only)
  const handleApproveAndPublish = async (articleId: string) => {
    await runAction(
      articleId,
      async () => {
        await approveArticle(articleId);
        await publishArticle(articleId);
      },
      'Article approved & published live! Now visible to portal tenants.'
    );
  };

  // Open Quick Review Drawer
  const handleOpenDrawer = (article: Article) => {
    setDrawerArticle(article);
    setDrawerOpen(true);
  };

  // Submit Manager Revision Assignment
  const handleManagerAssignRevisionSubmit = async (articleId: string, managerComment: string) => {
    setActionBusy(true);
    setError('');
    try {
      await requestRevision(articleId, managerComment);
      setMessage('Revision assigned to Author with Admin feedback and Department Manager directions.');
      setManagerRevisionModalOpen(false);
      setManagerRevisionArticle(null);
      await Promise.all([loadArticles(), fetchOverviewCounts()]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to assign revision to author';
      setError(msg);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={isAdmin ? 'Knowledge Base Approval & Publishing Hub' : 'Department Knowledge Approval Desk'}
        description={
          isAdmin
            ? 'Review department manager knowledge submissions, issue revision directives, approve verified articles, and publish live to reach tenants.'
            : 'Review and approve knowledge base articles created by staff in your department before final Admin publishing.'
        }
        backTo={basePath}
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      {/* ── Executive Governance Banner ── */}
      <div className={styles.roleScopeBanner}>
        <div className={styles.bannerGrid} />

        <div className={styles.bannerTop}>
          <div className={styles.bannerLeft}>
            <div className={styles.bannerIconCard}>
              <ShieldCheckIcon style={{ width: 28, height: 28, color: '#38bdf8' }} />
            </div>
            <div>
              <div className={styles.bannerTopTag}>
                <span className={styles.liveDot} />
                {isAdmin ? 'CENTRAL VERIFICATION GATEWAY' : 'DEPARTMENT WORKFLOW GATE'}
              </div>
              <h2 className={styles.bannerTitle}>
                {isAdmin
                  ? 'Central Administration · Knowledge Verification & Publishing Gateway'
                  : 'Department Management · Peer Review & Verification Desk'}
              </h2>
              <div className={styles.bannerDesc}>
                {isAdmin
                  ? 'Department Managers author department knowledge bases and submit them for your review. If revisions are required, issue clear directives for them to update. When accurate, approve and publish to make articles live for tenants.'
                  : 'Review articles authored by staff members in your department. Approve verified documentation so Admin can publish it live to the tenants.'}
              </div>
            </div>
          </div>

          <div className={styles.bannerRight}>
            <div className={styles.queueStatsCapsule}>
              <div className={styles.queueStatItem}>
                <span className={styles.queueStatVal} style={{ color: '#fbbf24' }}>
                  {queueCounts.pending_approval}
                </span>
                <span className={styles.queueStatLabel}>Pending</span>
              </div>
              <div className={styles.queueStatDivider} />
              <div className={styles.queueStatItem}>
                <span className={styles.queueStatVal} style={{ color: '#34d399' }}>
                  {queueCounts.approved}
                </span>
                <span className={styles.queueStatLabel}>Approved</span>
              </div>
              <div className={styles.queueStatDivider} />
              <div className={styles.queueStatItem}>
                <span className={styles.queueStatVal} style={{ color: '#f87171' }}>
                  {queueCounts.needs_revision}
                </span>
                <span className={styles.queueStatLabel}>Revision</span>
              </div>
              {isAdmin && (
                <>
                  <div className={styles.queueStatDivider} />
                  <div className={styles.queueStatItem}>
                    <span className={styles.queueStatVal} style={{ color: '#38bdf8' }}>
                      {queueCounts.published}
                    </span>
                    <span className={styles.queueStatLabel}>Live</span>
                  </div>
                  {queueCounts.unpublished > 0 && (
                    <>
                      <div className={styles.queueStatDivider} />
                      <div className={styles.queueStatItem}>
                        <span className={styles.queueStatVal} style={{ color: '#fb923c' }}>
                          {queueCounts.unpublished}
                        </span>
                        <span className={styles.queueStatLabel}>Unpublished</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 4-Stage Lifecycle Stepper ── */}
        <div className={styles.stepperContainer}>
          <div className={`${styles.stepItem} ${activeTab === 'draft' ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepInfo}>
              <span className={styles.stepTitle}>Draft Authoring</span>
              <span className={styles.stepSub}>Staff / Dept Manager</span>
            </div>
          </div>

          <div className={`${styles.stepItem} ${isManager ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber}>2</span>
            <div className={styles.stepInfo}>
              <span className={styles.stepTitle}>Dept Review</span>
              <span className={styles.stepSub}>Manager Verification</span>
            </div>
          </div>

          <div className={`${styles.stepItem} ${isAdmin && activeTab === 'pending_approval' ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber}>3</span>
            <div className={styles.stepInfo}>
              <span className={styles.stepTitle}>Admin Verify</span>
              <span className={styles.stepSub}>Directives & Approval</span>
            </div>
          </div>

          <div className={`${styles.stepItem} ${isAdmin && (activeTab === 'approved' || activeTab === 'published') ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber}>4</span>
            <div className={styles.stepInfo}>
              <span className={styles.stepTitle}>Tenant Publish</span>
              <span className={styles.stepSub}>Live Knowledge Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workflow Tabs ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'pending_approval' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveTab('pending_approval');
            setApprovalPage(1);
          }}
        >
          <ClockIcon className={styles.tabIcon} />
          <span>Pending Review</span>
          <span className={styles.tabBadge}>{queueCounts.pending_approval}</span>
        </button>

        {isManager && (
          <button
            className={`${styles.tabBtn} ${activeTab === 'draft' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('draft');
              setApprovalPage(1);
            }}
          >
            <PencilSquareIcon className={styles.tabIcon} />
            <span>Staff Drafts</span>
            <span className={styles.tabBadge}>{queueCounts.draft}</span>
          </button>
        )}

        <button
          className={`${styles.tabBtn} ${activeTab === 'approved' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveTab('approved');
            setApprovalPage(1);
          }}
        >
          <CheckCircleIcon className={styles.tabIcon} />
          <span>Approved (Ready to Publish)</span>
          <span className={styles.tabBadge}>{queueCounts.approved}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'needs_revision' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveTab('needs_revision');
            setApprovalPage(1);
          }}
        >
          <ExclamationTriangleIcon className={styles.tabIcon} />
          <span>Needs Revision</span>
          <span className={styles.tabBadge}>{queueCounts.needs_revision}</span>
        </button>

        {isAdmin && (
          <button
            className={`${styles.tabBtn} ${activeTab === 'published' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('published');
              setSubStatusFilter('');
              setApprovalPage(1);
            }}
          >
            <GlobeAltIcon className={styles.tabIcon} />
            <span>Published Live</span>
            <span className={styles.tabBadge}>{queueCounts.published}</span>
          </button>
        )}

        {isAdmin && queueCounts.unpublished > 0 && (
          <button
            className={`${styles.tabBtn} ${activeTab === 'unpublished' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('unpublished');
              setSubStatusFilter('');
              setApprovalPage(1);
            }}
          >
            <PauseIcon className={styles.tabIcon} />
            <span>Unpublished</span>
            <span className={styles.tabBadge}>{queueCounts.unpublished}</span>
          </button>
        )}

        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveTab('all');
            setSubStatusFilter('');
            setApprovalPage(1);
          }}
        >
          <QueueListIcon className={styles.tabIcon} />
          <span>All Queue</span>
          <span className={styles.tabBadge}>{queueCounts.total}</span>
        </button>
      </div>

      {/* ── Status Count & Breakdown for All Queue ── */}
      {activeTab === 'all' && (
        <div className={styles.statusBreakdownBar}>
          <div className={styles.statusBreakdownTitle}>
            <QueueListIcon style={{ width: 15, height: 15, color: '#38bdf8' }} />
            <span>Statuses Served in Queue ({articles.length} total):</span>
          </div>
          <div className={styles.statusChipsList}>
            <button
              type="button"
              className={`${styles.statusChipBtn} ${subStatusFilter === '' ? styles.statusChipBtnActive : ''}`}
              onClick={() => {
                setSubStatusFilter('');
                setApprovalPage(1);
              }}
            >
              All Statuses
              <span className={styles.chipCountBadge}>{articles.length}</span>
            </button>
            {Object.entries(statusBreakdownInQueue).map(([st, cnt]) => {
              const label =
                st === 'approved'
                  ? 'Approved'
                  : st === 'published'
                  ? 'Published Live'
                  : st === 'unpublished'
                  ? 'Unpublished'
                  : st === 'pending_approval'
                  ? 'Pending Review'
                  : st === 'needs_revision'
                  ? 'Needs Revision'
                  : st === 'draft'
                  ? 'Staff Drafts'
                  : st.replace(/_/g, ' ');
              const icon =
                st === 'approved'
                  ? '✓'
                  : st === 'published'
                  ? '🌐'
                  : st === 'unpublished'
                  ? '⏸'
                  : st === 'pending_approval'
                  ? '⏳'
                  : st === 'needs_revision'
                  ? '⚠️'
                  : '📝';
              return (
                <button
                  key={st}
                  type="button"
                  className={`${styles.statusChipBtn} ${subStatusFilter === st ? styles.statusChipBtnActive : ''}`}
                  onClick={() => {
                    setSubStatusFilter(subStatusFilter === st ? '' : st);
                    setApprovalPage(1);
                  }}
                >
                  <span>{icon} {label}</span>
                  <span className={styles.chipCountBadge}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters & Search ── */}
      <div className={styles.filtersRow}>
        <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 520 }}>
          <MagnifyingGlassIcon
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 18,
              height: 18,
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className={styles.searchInput}
            style={{ paddingLeft: 42, width: '100%' }}
            placeholder="Filter by title, reference (KB-...), department, or author..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setApprovalPage(1);
            }}
          />
        </div>

        <div className={styles.filterMeta}>
          <span className={styles.totalBadge}>
            {filteredArticles.length === 0 ? '0 articles' : `${filteredArticles.length} article${filteredArticles.length > 1 ? 's' : ''}`}
          </span>
          <select
            className={styles.pageSizeSelect}
            value={approvalPageSize}
            onChange={(e) => {
              setApprovalPageSize(Number(e.target.value));
              setApprovalPage(1);
            }}
          >
            {APPROVAL_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Show {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <DataTable<Article>
        loading={loading}
        data={pagedArticles}
        columns={[
          {
            key: 'title',
            label: 'Article Title & Reference',
            render: (row) => {
              const hasRevisionNotes = row.status === 'needs_revision' && row.revisionNotes;
              const isAuthorManager = row.authorFirstName || row.authorLastName;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                  <div>
                    <span
                      className={styles.articleTitleLink}
                      onClick={() => handleOpenDrawer(row)}
                      title="Click to review full content"
                    >
                      {row.title}
                    </span>
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.referenceBadge}>{row.articleReference}</span>
                    {row.departmentName && (
                      <span className={styles.deptChip}>
                        <BuildingOffice2Icon style={{ width: 13, height: 13, display: 'inline', verticalAlign: '-2px' }} /> {row.departmentName}
                      </span>
                    )}
                    <span className={styles.authorChip}>
                      <UserIcon style={{ width: 13, height: 13, display: 'inline', verticalAlign: '-2px' }} /> {[row.authorFirstName, row.authorLastName].filter(Boolean).join(' ') || 'Creator'}
                    </span>
                    {isManager && row.authorId === user?.id && (
                      <span className={styles.authorManagerBadge}>Your Department Article</span>
                    )}
                    <span>· Submitted {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</span>
                  </div>

                  {hasRevisionNotes && (() => {
                    const latest = getLatestRevisionItem(row.revisionNotes);
                    return (
                      <div className={styles.inlineRevisionNotice}>
                        <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#c2410c', flexShrink: 0 }} />
                        <div>
                          <strong>{latest?.roleLabel || 'Revision Directive'}:</strong> {latest?.comment || row.revisionNotes}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            },
          },
          {
            key: 'category',
            label: 'Category',
            render: (row) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>{resolveCategoryIcon(row.category)}</span>
                <span style={{ fontWeight: 600 }}>{row.category}</span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Workflow Gate',
            render: (row) => <WorkflowStatusBadge status={row.status} showSubtitle role={role} reviewedBy={row.reviewedBy} revisionNotes={row.revisionNotes} />,
          },
          {
            key: 'actions',
            label: 'Verification Actions',
            render: (row) => {
              const isAuthor = row.authorId === user?.id;
              const isBusy = busyId === row.id;

              return (
                <div className={styles.actions}>
                  {/* Quick Review Drawer Button */}
                  <button
                    className={styles.viewBtn}
                    onClick={() => handleOpenDrawer(row)}
                    title="Review full article and metadata"
                  >
                    <EyeIcon style={{ width: 14, height: 14 }} />
                    <span>Review</span>
                  </button>

                  {/* ADMIN ACTIONS on pending_approval */}
                  {isAdmin && row.status === 'pending_approval' && (
                    <>
                      {row.reviewedBy || row.authorRole === 'manager' || row.authorRole === 'admin' ? (
                        <>
                          <button
                            className={styles.approveBtn}
                            disabled={isBusy}
                            onClick={() => handleDirectApprove(row.id)}
                            title="Approve article (moves to Approved state)"
                          >
                            <CheckIcon style={{ width: 14, height: 14 }} />
                            <span>Approve</span>
                          </button>
                          <button
                            className={styles.approveAndPublishBtn}
                            disabled={isBusy}
                            onClick={() => handleApproveAndPublish(row.id)}
                            title="Approve and Publish live to tenants in one click"
                          >
                            <SparklesIcon style={{ width: 14, height: 14 }} />
                            <span>Approve & Publish</span>
                          </button>
                          <button
                            className={styles.revisionBtn}
                            disabled={isBusy}
                            onClick={() => handleOpenActionModal(row, 'request_revision')}
                            title="Notify Department Manager of required revisions"
                          >
                            <ExclamationTriangleIcon style={{ width: 14, height: 14 }} />
                            <span>Request Revision</span>
                          </button>
                          <button
                            className={styles.rejectBtn}
                            disabled={isBusy}
                            onClick={() => handleOpenActionModal(row, 'reject')}
                            title="Reject article submission"
                          >
                            <XMarkIcon style={{ width: 14, height: 14 }} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span className={styles.staffWaitingChip} title="Staff article must be verified by Department Manager first">
                          ⏳ Awaiting Dept Manager Review
                        </span>
                      )}
                    </>
                  )}

                  {/* ADMIN ACTIONS on approved -> Publish Live, Request Revision, or Reject */}
                  {isAdmin && row.status === 'approved' && (
                    <>
                      <button
                        className={styles.publishBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'publish')}
                        title="Publish article live so it reaches tenants"
                      >
                        <GlobeAltIcon style={{ width: 14, height: 14 }} />
                        <span>Publish Live</span>
                      </button>
                      <button
                        className={styles.revisionBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'request_revision')}
                        title="Send back to department manager with recommendations of what should be changed"
                      >
                        <ExclamationTriangleIcon style={{ width: 14, height: 14 }} />
                        <span>Request Revision</span>
                      </button>
                      <button
                        className={styles.rejectBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'reject')}
                        title="Reject article submission"
                      >
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {/* Edit button: Allows Dept Manager or Admin to finish/polish article before or after approval */}
                  {(isAdmin || isManager) && (
                    <button
                      className={styles.viewBtn}
                      onClick={() => navigate(`${basePath}/${row.id}/edit`)}
                      title="Edit and finish article content before approval"
                    >
                      <PencilSquareIcon style={{ width: 14, height: 14 }} />
                      <span>Edit</span>
                    </button>
                  )}

                  {/* DEPARTMENT MANAGER ACTIONS on pending_approval or draft (for staff articles in dept) */}
                  {isManager && !isAuthor && (row.status === 'pending_approval' || row.status === 'draft') && (
                    <>
                      {!row.reviewedBy ? (
                        <>
                          <button
                            className={styles.approveBtn}
                            disabled={isBusy}
                            onClick={() => handleDirectApprove(row.id)}
                            title="Department Manager approval (routes to Admin for verification)"
                          >
                            <CheckIcon style={{ width: 14, height: 14 }} />
                            <span>Approve & Route to Admin</span>
                          </button>
                          <button
                            className={styles.revisionBtn}
                            disabled={isBusy}
                            onClick={() => handleOpenActionModal(row, 'request_revision')}
                            title="Instruct staff to revise"
                          >
                            <ExclamationTriangleIcon style={{ width: 14, height: 14 }} />
                            <span>Request Revision</span>
                          </button>
                          <button
                            className={styles.rejectBtn}
                            disabled={isBusy}
                            onClick={() => handleOpenActionModal(row, 'reject')}
                            title="Reject staff submission"
                          >
                            <XMarkIcon style={{ width: 14, height: 14 }} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span
                          className={styles.deptSignedOffBadge}
                          title="You have approved this article. It has been routed to Admin for review & publishing."
                        >
                          ✓ Dept Approved · With Admin
                        </span>
                      )}
                    </>
                  )}

                  {/* DEPARTMENT MANAGER on article in needs_revision */}
                  {isManager && !isAuthor && row.status === 'needs_revision' && (
                    <>
                      <button
                        className={styles.viewBtn}
                        onClick={() => {
                          setReviseArticle(row);
                          setReviseModalOpen(true);
                        }}
                        title="Directly update article content based on Admin directive"
                      >
                        <PencilSquareIcon style={{ width: 14, height: 14 }} />
                        <span>Revise Directly</span>
                      </button>
                      <button
                        className={styles.approveBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'submit')}
                        title="Resubmit revised article directly to Admin for publishing"
                      >
                        <PaperAirplaneIcon style={{ width: 14, height: 14 }} />
                        <span>Resubmit to Admin</span>
                      </button>
                      <button
                        className={styles.managerAssignBtn}
                        disabled={isBusy}
                        onClick={() => {
                          setManagerRevisionArticle(row);
                          setManagerRevisionModalOpen(true);
                        }}
                        title="Check Admin comments and assign revision to the Author with Manager directions"
                      >
                        <ExclamationTriangleIcon style={{ width: 14, height: 14 }} />
                        <span>Route to Author</span>
                      </button>
                    </>
                  )}

                  {/* AUTHOR on article in needs_revision */}
                  {isAuthor && row.status === 'needs_revision' && (
                    <button
                      className={styles.revisionBtn}
                      onClick={() => {
                        setReviseArticle(row);
                        setReviseModalOpen(true);
                      }}
                      title="Update article and assign new version to Department Manager"
                    >
                      <PencilSquareIcon style={{ width: 14, height: 14 }} />
                      <span>Update & Submit to Manager</span>
                    </button>
                  )}

                  {/* ADMIN ACTIONS on published -> Unpublish */}
                  {isAdmin && row.status === 'published' && (
                    <button
                      className={styles.viewBtn}
                      disabled={isBusy}
                      onClick={() => handleOpenActionModal(row, 'unpublish')}
                      title="Temporarily unpublish article"
                    >
                      <PauseIcon style={{ width: 14, height: 14 }} />
                      <span>Unpublish</span>
                    </button>
                  )}

                  {/* ADMIN ACTIONS on unpublished -> Re-publish live or Request Revision */}
                  {isAdmin && row.status === 'unpublished' && (
                    <>
                      <button
                        className={styles.publishBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'publish')}
                        title="Re-publish article live to portal tenants"
                      >
                        <GlobeAltIcon style={{ width: 14, height: 14 }} />
                        <span>Publish Live</span>
                      </button>
                      <button
                        className={styles.revisionBtn}
                        disabled={isBusy}
                        onClick={() => handleOpenActionModal(row, 'request_revision')}
                        title="Send back for revisions"
                      >
                        <ExclamationTriangleIcon style={{ width: 14, height: 14 }} />
                        <span>Request Revision</span>
                      </button>
                    </>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.paginationWrap}>
          <button
            onClick={() => setApprovalPage((p) => Math.max(1, p - 1))}
            disabled={approvalPage <= 1}
            className={styles.pageBtn}
          >
            ← Previous
          </button>
          <span className={styles.pageIndicator}>
            Page {approvalPage} of {totalPages}
          </span>
          <button
            onClick={() => setApprovalPage((p) => Math.min(totalPages, p + 1))}
            disabled={approvalPage >= totalPages}
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
        userRole={role}
        onClose={() => {
          setActionModalOpen(false);
          setSelectedArticle(null);
        }}
        onSubmit={handleWorkflowSubmit}
      />

      {/* ── Quick Review Drawer ── */}
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
        onOpenRevise={(art) => {
          setReviseArticle(art);
          setReviseModalOpen(true);
        }}
      />

      {/* ── Quick Revise Modal (For In-Place Modification & Resubmission) ── */}
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
        }}
      />

      {/* ── Manager Assign Revision Modal ── */}
      <ManagerAssignRevisionModal
        open={managerRevisionModalOpen}
        article={managerRevisionArticle}
        busy={actionBusy}
        onClose={() => {
          setManagerRevisionModalOpen(false);
          setManagerRevisionArticle(null);
        }}
        onSubmit={handleManagerAssignRevisionSubmit}
      />
    </div>
  );
}
