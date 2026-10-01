import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchArticles,
  submitArticle,
  approveArticle,
  rejectArticle,
  requestRevision,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  restoreArticle,
  moveToDraft,
  rateArticle,
  deleteArticle,
  fetchAllCategories,
  fetchArticleStats,
} from '../../api/knowledgeApi';
import type { Article, KnowledgeCategory, ArticleStats } from '../../types/article';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import styles from './KnowledgeList.module.css';

import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  EyeIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  EyeSlashIcon,
  ArchiveBoxIcon,
  BuildingOffice2Icon,
  HashtagIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type Tab = 'all' | 'my-drafts' | 'pending' | 'approved' | 'published' | 'needs-revision' | 'archived-restored';

export default function KnowledgeList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isTenant = role === 'tenant';

  const basePath = isStaff
    ? '/staff/knowledge'
    : isManager
    ? '/manager/knowledge'
    : isTenant
    ? '/tenant/knowledge'
    : '/admin/knowledge';

  const { page, limit, setPage, resetPage } = usePagination();

  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [viewTarget, setViewTarget] = useState<Article | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<Article | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Article | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadStats = useCallback(async () => {
    if (isAdmin || isManager || isStaff) {
      try {
        const res = await fetchArticleStats();
        if (res.data?.success && res.data?.data) {
          setStats(res.data.data);
        }
      } catch {
        // ignore
      }
    }
  }, [isAdmin, isManager, isStaff]);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search: search || undefined, status: status || undefined, category: category || undefined, page, limit };
      let res;

      if (tab === 'my-drafts') {
        res = await fetchArticles({ ...params, status: 'draft', authorId: user?.id });
      } else if (tab === 'pending') {
        res = await fetchArticles({
          ...params,
          status: 'pending_approval',
          authorId: isStaff ? user?.id : undefined,
        });
      } else if (tab === 'approved') {
        res = await fetchArticles({ ...params, status: 'approved' });
      } else if (tab === 'published') {
        res = await fetchArticles({ ...params, status: 'published' });
      } else if (tab === 'needs-revision') {
        res = await fetchArticles({
          ...params,
          status: 'needs_revision',
          authorId: isStaff ? user?.id : undefined,
        });
      } else if (tab === 'archived-restored') {
        res = await fetchArticles({
          ...params,
          status: status || 'archived,restored',
        });
      } else {
        res = await fetchArticles({
          ...params,
          status: isTenant ? 'published' : status || undefined,
        });
      }
      setArticles(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch {
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [search, status, category, tab, page, limit, user?.id, isStaff, isTenant]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    fetchAllCategories()
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {});
    loadStats();
  }, [loadStats]);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await loadArticles();
      await loadStats();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Action failed'
      );
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await runAction(() => deleteArticle(deleteTarget.id), 'Article deleted successfully');
    setDeleteTarget(null);
  };

  const uniqueCategories = Array.from(
    new Set([...categories.map((c) => c.name), ...articles.map((a) => a.category).filter(Boolean)])
  );

  const canEdit = (a: Article) => {
    if (isAdmin || isManager) return true;
    if (isStaff) return a.authorId === user?.id && ['draft', 'needs_revision', 'restored'].includes(a.status);
    return false;
  };

  const renderWorkflowStatusBadge = (articleStatus: string) => {
    switch (articleStatus) {
      case 'draft':
        return (
          <span className={`${styles.statusBadge} ${styles.statusDraft}`}>
            <PencilSquareIcon className={styles.statusBadgeIcon} />
            <span>Draft</span>
          </span>
        );
      case 'pending_approval':
        return (
          <span className={`${styles.statusBadge} ${styles.statusPending}`}>
            <ClockIcon className={styles.statusBadgeIcon} />
            <span>Pending Review</span>
          </span>
        );
      case 'approved':
        return (
          <span className={`${styles.statusBadge} ${styles.statusApproved}`}>
            <CheckIcon className={styles.statusBadgeIcon} />
            <span>Approved</span>
          </span>
        );
      case 'published':
        return (
          <span className={`${styles.statusBadge} ${styles.statusPublished}`}>
            <CheckCircleIcon className={styles.statusBadgeIcon} />
            <span>Published</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className={`${styles.statusBadge} ${styles.statusRevision}`}>
            <ExclamationTriangleIcon className={styles.statusBadgeIcon} />
            <span>Needs Revision</span>
          </span>
        );
      case 'restored':
        return (
          <span className={`${styles.statusBadge} ${styles.statusRestored}`}>
            <ArrowPathIcon className={styles.statusBadgeIcon} />
            <span>Restored</span>
          </span>
        );
      case 'archived':
        return (
          <span className={`${styles.statusBadge} ${styles.statusArchived}`}>
            <ArchiveBoxIcon className={styles.statusBadgeIcon} />
            <span>Archived</span>
          </span>
        );
      case 'unpublished':
        return (
          <span className={`${styles.statusBadge} ${styles.statusUnpublished}`}>
            <EyeSlashIcon className={styles.statusBadgeIcon} />
            <span>Unpublished</span>
          </span>
        );
      case 'rejected':
        return (
          <span className={`${styles.statusBadge} ${styles.statusRejected}`}>
            <XCircleIcon className={styles.statusBadgeIcon} />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className={`${styles.statusBadge} ${styles.statusDraft}`}>
            <span>{articleStatus?.replace(/_/g, ' ') || 'Unknown'}</span>
          </span>
        );
    }
  };

  const renderActions = (a: Article) => {
    if (isTenant) {
      return (
        <button className={styles.viewBtn} onClick={() => navigate(`${basePath}/${a.id}`)}>
          <EyeIcon className={styles.btnIcon} />
          <span>Read</span>
        </button>
      );
    }
    const buttons: ReactElement[] = [];

    // Admin direct control over any article
    if (isAdmin) {
      if (a.status === 'approved') {
        buttons.push(
          <button
            key="publish"
            className={styles.publishBtn}
            title="Publish this approved article to tenants"
            onClick={() => runAction(() => publishArticle(a.id), 'Article published to tenants!')}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Publish to Tenants</span>
          </button>
        );
      } else if (a.status === 'draft') {
        buttons.push(
          <button
            key="publish"
            className={styles.publishBtn}
            title="Directly publish draft to tenants"
            onClick={() => runAction(() => publishArticle(a.id), 'Draft published directly to tenants!')}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Publish</span>
          </button>
        );
        buttons.push(
          <button
            key="approve"
            className={styles.approveBtn}
            title="Approve draft"
            onClick={() => runAction(() => approveArticle(a.id), 'Draft approved')}
          >
            <CheckIcon className={styles.btnIcon} />
            <span>Approve</span>
          </button>
        );
      } else if (a.status === 'pending_approval') {
        buttons.push(
          <button
            key="publish"
            className={styles.publishBtn}
            title="Directly publish to tenants"
            onClick={() => runAction(() => publishArticle(a.id), 'Article published directly to tenants!')}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Publish</span>
          </button>
        );
        buttons.push(
          <button
            key="approve"
            className={styles.approveBtn}
            title="Approve article"
            onClick={() => runAction(() => approveArticle(a.id), 'Article approved')}
          >
            <CheckIcon className={styles.btnIcon} />
            <span>Approve</span>
          </button>
        );
        buttons.push(
          <button
            key="revision"
            className={styles.revisionBtn}
            title="Request changes from author"
            onClick={() => {
              setRevisionTarget(a);
              setRevisionReason('');
            }}
          >
            <ExclamationTriangleIcon className={styles.btnIcon} />
            <span>Request Changes</span>
          </button>
        );
        buttons.push(
          <button
            key="reject"
            className={styles.deleteBtn}
            title="Reject article"
            onClick={() => {
              setRejectTarget(a);
              setRejectReason('');
            }}
          >
            <XCircleIcon className={styles.btnIcon} />
            <span>Reject</span>
          </button>
        );
      } else if (a.status === 'unpublished') {
        buttons.push(
          <button
            key="republish"
            className={styles.publishBtn}
            title="Re-publish to tenants"
            onClick={() => runAction(() => publishArticle(a.id), 'Article re-published to tenants!')}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Re-publish</span>
          </button>
        );
      }
    }

    // Manager review actions (strictly for department staff articles)
    if (!isAdmin && isManager && a.status === 'pending_approval' && can('knowledge.approve')) {
      const isOwnArticle = a.authorId === user?.id;
      if (!isOwnArticle) {
        buttons.push(
          <button
            key="approve"
            className={styles.approveBtn}
            title="Approve article and automatically notify Admin to publish"
            onClick={() => runAction(() => approveArticle(a.id), 'Article approved! Admin has been notified to publish.')}
          >
            <CheckIcon className={styles.btnIcon} />
            <span>Approve</span>
          </button>
        );
      }
      buttons.push(
        <button
          key="revision"
          className={styles.revisionBtn}
          title="Send back to author with guidance notes"
          onClick={() => {
            setRevisionTarget(a);
            setRevisionReason('');
          }}
        >
          <ExclamationTriangleIcon className={styles.btnIcon} />
          <span>Request Changes</span>
        </button>
      );
      buttons.push(
        <button
          key="reject"
          className={styles.deleteBtn}
          title="Reject article"
          onClick={() => {
            setRejectTarget(a);
            setRejectReason('');
          }}
        >
          <XCircleIcon className={styles.btnIcon} />
          <span>Reject</span>
        </button>
      );
    }

    // Staff submission action (Staff can ONLY submit draft/revision, never approve or publish)
    if (isStaff && a.authorId === user?.id && (a.status === 'draft' || a.status === 'needs_revision')) {
      buttons.push(
        <button
          key="submit"
          className={styles.submitBtn}
          title="Submit article to your Department Manager for approval"
          onClick={() => runAction(() => submitArticle(a.id), 'Submitted to Department Manager for review!')}
        >
          <PaperAirplaneIcon className={styles.btnIcon} />
          <span>Submit for Review</span>
        </button>
      );
    }

    // Unpublish / Archive / Restore (Admin only)
    if (can('knowledge.unpublish') && a.status === 'published' && isAdmin) {
      buttons.push(
        <button
          key="unpublish"
          className={styles.cancelBtn}
          onClick={() => runAction(() => unpublishArticle(a.id, ''), 'Article unpublished')}
        >
          <EyeSlashIcon className={styles.btnIcon} />
          <span>Unpublish</span>
        </button>
      );
    }

    if (can('knowledge.archive') && (a.status === 'published' || a.status === 'unpublished') && isAdmin) {
      buttons.push(
        <button
          key="archive"
          className={styles.cancelBtn}
          title="Retire article to archive"
          onClick={() => runAction(() => archiveArticle(a.id), 'Article retired to archive')}
        >
          <ArchiveBoxIcon className={styles.btnIcon} />
          <span>Retire</span>
        </button>
      );
    }

    if (can('knowledge.restore') && a.status === 'archived' && isAdmin) {
      buttons.push(
        <button
          key="restore"
          className={styles.restoreBtn}
          title="Admin restores article from archive"
          onClick={() => runAction(() => restoreArticle(a.id), 'Article restored from archive')}
        >
          <ArrowPathIcon className={styles.btnIcon} />
          <span>Restore</span>
        </button>
      );
    }

    // Actions for Restored articles: Move to Draft or Re-publish
    if (a.status === 'restored') {
      if (isAdmin || isManager || (isStaff && a.authorId === user?.id)) {
        buttons.push(
          <button
            key="toDraft"
            className={styles.draftBtn}
            title="Move restored article to Draft for editing/revision"
            onClick={() => runAction(() => moveToDraft(a.id), 'Article moved to Draft')}
          >
            <ArrowUturnLeftIcon className={styles.btnIcon} />
            <span>Move to Draft</span>
          </button>
        );
      }
      if (isAdmin) {
        buttons.push(
          <button
            key="republish"
            className={styles.publishBtn}
            title="Admin directly re-publishes restored article"
            onClick={() => runAction(() => publishArticle(a.id), 'Article re-published to tenants!')}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Re-publish</span>
          </button>
        );
      }
    }

    // Edit button
    if (canEdit(a)) {
      buttons.push(
        <button key="edit" className={styles.editBtn} title="Edit Article" onClick={() => navigate(`${basePath}/${a.id}/edit`)}>
          <PencilSquareIcon className={styles.btnIcon} />
          <span>Edit</span>
        </button>
      );
    }

    // View button
    buttons.push(
      <button key="view" className={styles.viewBtn} title="View Article" onClick={() => navigate(`${basePath}/${a.id}`)}>
        <EyeIcon className={styles.btnIcon} />
        <span>View</span>
      </button>
    );

    // Delete button
    if (can('knowledge.delete') || (isStaff && a.authorId === user?.id && a.status === 'draft')) {
      buttons.push(
        <button key="delete" className={styles.deleteBtn} title="Delete Article" onClick={() => setDeleteTarget(a)}>
          <TrashIcon className={styles.btnIcon} />
          <span>Delete</span>
        </button>
      );
    }

    return <div className={styles.actions}>{buttons}</div>;
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    resetPage();
    if (newTab !== 'all') {
      setStatus('');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setCategory('');
    resetPage();
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge Base"
        description={
          isTenant
            ? 'Search verified solutions & guides. If none help, raise a support ticket.'
            : isStaff
            ? 'Create draft solutions for your department and browse published department guides.'
            : isManager
            ? 'Review and approve knowledge base articles submitted by your department staff.'
            : 'Review, approve, and publish knowledge base articles to empower tenants and staff.'
        }
        backTo={role ? `/${role}/dashboard` : '/'}
        actionLabel={!isTenant && can('knowledge.create') ? '+ New Article' : undefined}
        onAction={!isTenant && can('knowledge.create') ? () => navigate(`${basePath}/create`) : undefined}
      />

      {message && <div className={styles.toast}>✓ {message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>⚠ {error}</div>}

      {/* ── Workflow Division & Role Scope Banner ── */}
      {!isTenant && (
        <div className={styles.roleScopeBanner}>
          <div className={styles.roleScopeLeft}>
            <div className={styles.roleScopeIcon}>
              {isStaff ? '✍️' : isManager ? '👔' : '👑'}
            </div>
            <div>
              <div className={styles.roleScopeTitle}>
                {isStaff && `Staff Workspace · Department Scope`}
                {isManager && `Department Manager Review Desk · Assigned Department Scope`}
                {isAdmin && `Admin Publishing Authority · Organization-Wide Desk`}
              </div>
              <div className={styles.roleScopeDesc}>
                {isStaff && 'You can draft knowledge articles and submit them for Department Manager approval. You have access to your drafts and published department guides.'}
                {isManager && 'Review and approve knowledge base submissions from your department staff. Once approved, Admin is notified for final publication.'}
                {isAdmin && 'Final publication gatekeeper. Review manager-approved articles and publish them live to tenants across the platform.'}
              </div>
            </div>
          </div>

          <div className={styles.workflowDivisionCard}>
            <div className={`${styles.workflowStep} ${isStaff ? styles.workflowStepActive : ''}`}>
              <span className={styles.workflowStepNum}>1</span>
              <span className={styles.workflowStepText}>Staff Creates Draft</span>
            </div>
            <span className={styles.workflowArrow}>➔</span>
            <div className={`${styles.workflowStep} ${isManager ? styles.workflowStepActive : ''}`}>
              <span className={styles.workflowStepNum}>2</span>
              <span className={styles.workflowStepText}>Dept Manager Approves</span>
            </div>
            <span className={styles.workflowArrow}>➔</span>
            <div className={`${styles.workflowStep} ${isAdmin ? styles.workflowStepActive : ''}`}>
              <span className={styles.workflowStepNum}>3</span>
              <span className={styles.workflowStepText}>Admin Publishes</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Role-Specific Live Overview Metric Cards ── */}
      {(isAdmin || isManager || isStaff) && stats && (
        <div className={styles.statsGrid}>
          <div
            className={`${styles.statCard} ${tab === 'all' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#eff6ff', color: '#2563eb' }}>
              📚
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>
                {isStaff ? 'All My & Dept KB' : isManager ? 'Dept Articles' : 'Total Articles'}
              </span>
            </div>
          </div>

          <div
            className={`${styles.statCard} ${tab === 'my-drafts' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('my-drafts')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#f8fafc', color: '#475569' }}>
              📝
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.draft}</span>
              <span className={styles.statLabel}>{isStaff ? 'My Drafts' : 'Drafts'}</span>
            </div>
          </div>

          <div
            className={`${styles.statCard} ${tab === 'pending' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#fef3c7', color: '#b45309' }}>
              ⏳
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.pending_approval}</span>
              <span className={styles.statLabel}>
                {isStaff ? 'Submitted for Review' : isManager ? 'Pending Dept Review' : 'Pending Review'}
              </span>
            </div>
            {stats.pending_approval > 0 && (
              <span className={styles.statHighlightAlert}>{stats.pending_approval} Pending</span>
            )}
          </div>

          {(isAdmin || isManager) && (
            <div
              className={`${styles.statCard} ${tab === 'approved' ? styles.statCardActive : ''}`}
              onClick={() => handleTabChange('approved')}
            >
              <div className={styles.statIconWrapper} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                ✓
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.approved}</span>
                <span className={styles.statLabel}>
                  {isAdmin ? 'Ready to Publish' : 'Approved (At Admin)'}
                </span>
              </div>
              {stats.approved > 0 && (
                <span className={styles.statHighlightSuccess}>{stats.approved} Ready</span>
              )}
            </div>
          )}

          <div
            className={`${styles.statCard} ${tab === 'published' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('published')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#ecfdf5', color: '#059669' }}>
              🌐
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.published}</span>
              <span className={styles.statLabel}>
                {isStaff || isManager ? 'Dept Published' : 'Published & Live'}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div
              className={`${styles.statCard} ${tab === 'archived-restored' ? styles.statCardActive : ''}`}
              onClick={() => handleTabChange('archived-restored')}
            >
              <div className={styles.statIconWrapper} style={{ background: '#f8fafc', color: '#475569' }}>
                📦
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{(stats.archived || 0) + (stats.restored || 0)}</span>
                <span className={styles.statLabel}>Archived / Restored</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modern Navigation Tabs (Clean, Scrollbar-Free) ── */}
      {!isTenant && (
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <span>{isStaff ? 'All Accessible' : isManager ? 'All Dept Articles' : 'All Articles'}</span>
            {stats && <span className={styles.tabBadge}>{stats.total}</span>}
          </button>

          <button
            className={`${styles.tabBtn} ${tab === 'published' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('published')}
          >
            <span>{isStaff || isManager ? 'Dept Published' : 'Published'}</span>
            {stats && stats.published > 0 && (
              <span className={styles.tabBadge}>{stats.published}</span>
            )}
          </button>

          <button
            className={`${styles.tabBtn} ${tab === 'my-drafts' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('my-drafts')}
          >
            <span>{isStaff ? 'My Drafts' : isManager ? 'Manager Drafts' : 'Drafts'}</span>
            {stats && stats.draft > 0 && <span className={styles.tabBadge}>{stats.draft}</span>}
          </button>

          <button
            className={`${styles.tabBtn} ${tab === 'pending' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            <span>{isStaff ? 'Submitted for Review' : isManager ? 'Pending Dept Review' : 'Pending Review'}</span>
            {stats && stats.pending_approval > 0 && (
              <span className={`${styles.tabBadge} ${styles.tabBadgeUrgent}`}>
                {stats.pending_approval}
              </span>
            )}
          </button>

          {(isAdmin || isManager) && (
            <button
              className={`${styles.tabBtn} ${tab === 'approved' ? styles.tabBtnActive : ''}`}
              onClick={() => handleTabChange('approved')}
            >
              <span>{isAdmin ? 'Ready to Publish' : 'Approved (At Admin)'}</span>
              {stats && stats.approved > 0 && (
                <span className={`${styles.tabBadge} ${styles.tabBadgeReady}`}>
                  {stats.approved}
                </span>
              )}
            </button>
          )}

          <button
            className={`${styles.tabBtn} ${tab === 'needs-revision' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('needs-revision')}
          >
            <span>Needs Revision</span>
            {stats && stats.needs_revision > 0 && (
              <span className={`${styles.tabBadge} ${styles.tabBadgeUrgent}`}>
                {stats.needs_revision}
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              className={`${styles.tabBtn} ${tab === 'archived-restored' ? styles.tabBtnActive : ''}`}
              onClick={() => handleTabChange('archived-restored')}
            >
              <span>Archived & Restored</span>
              {stats && ((stats.archived || 0) + (stats.restored || 0) > 0) && (
                <span className={styles.tabBadge}>
                  {(stats.archived || 0) + (stats.restored || 0)}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <MagnifyingGlassIcon className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by title, reference, or content..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>

        {!isTenant && tab === 'all' && (
          <div className={styles.selectWrapper}>
            <select
              className={styles.selectInput}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetPage();
              }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="approved">Approved (Ready to Publish)</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
              <option value="restored">Restored</option>
            </select>
          </div>
        )}

        <div className={styles.selectWrapper}>
          <select
            className={styles.selectInput}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              resetPage();
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {resolveCategoryIcon(cat)} {cat}
              </option>
            ))}
          </select>
        </div>

        {(search || status || category) && (
          <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
            <XMarkIcon style={{ width: '15px', height: '15px' }} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* ── Articles Data Table ── */}
      <DataTable<Article>
        loading={loading}
        data={articles}
        columns={[
          {
            key: 'title',
            label: 'Article & Workflow Info',
            render: (row) => (
              <div>
                <div className={styles.articleTitle}>{row.title}</div>
                <div className={styles.metaRow}>
                  <span className={styles.referenceBadge}>
                    <HashtagIcon style={{ width: '12px', height: '12px', display: 'inline', marginRight: '2px' }} />
                    {row.articleReference}
                  </span>
                  {row.departmentName && (
                    <span className={styles.deptChip}>
                      <BuildingOffice2Icon style={{ width: '12px', height: '12px' }} />
                      <span>{row.departmentName}</span>
                    </span>
                  )}
                  {row.approvedFirstName && (
                    <span
                      className={styles.approvedChip}
                      title={`Approved at ${
                        row.approvedAt ? new Date(row.approvedAt).toLocaleString() : ''
                      }`}
                    >
                      <CheckCircleIcon style={{ width: '12px', height: '12px' }} />
                      <span>Dept Approved by {row.approvedFirstName} {row.approvedLastName || ''}</span>
                    </span>
                  )}
                  <span className={styles.visibilityChip}>{row.visibility}</span>
                  <span>· {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            render: (row) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <span style={{ fontSize: '1rem' }}>{resolveCategoryIcon(row.category)}</span>
                <span>{row.category}</span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Workflow Status',
            render: (row) => renderWorkflowStatusBadge(row.status),
          },
          {
            key: 'author',
            label: 'Author',
            render: (row) => (
              <div className={styles.authorCol}>
                <span className={styles.authorName}>
                  {[row.authorFirstName, row.authorLastName].filter(Boolean).join(' ') ||
                    row.authorId?.slice(0, 8) ||
                    '—'}
                </span>
                {row.authorEmail && <span className={styles.authorRole}>{row.authorEmail}</span>}
              </div>
            ),
          },
          {
            key: 'actions',
            label: 'Workflow Actions',
            render: (row) => renderActions(row),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>

      {/* ── Modals ── */}
      <Modal open={!!deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(null)} maxWidth="520px">
        <div className={`${styles.modalNoticeBox} ${styles.danger}`}>
          <span style={{ fontSize: '1.3rem' }}>🗑️</span>
          <div>
            <strong>Permanent Action</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button className={styles.deleteBtn} onClick={handleDelete}>
            <TrashIcon className={styles.btnIcon} />
            <span>Delete Article</span>
          </button>
        </div>
      </Modal>

      <Modal open={!!revisionTarget} title="Request Revision / Changes" onClose={() => setRevisionTarget(null)} maxWidth="580px">
        <div className={`${styles.modalNoticeBox} ${styles.warning}`}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Sending Back to Author</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Article: <strong>"{revisionTarget?.title}"</strong> will be placed in <strong>Needs Revision</strong> status.
            </p>
          </div>
        </div>

        <div className={styles.modalFormGroup}>
          <label className={styles.modalFormLabel}>Revision Guidance Notes *</label>
          <textarea
            className={styles.modalTextarea}
            rows={4}
            placeholder="Explain specifically what details, formatting, or corrections are needed..."
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
          />
        </div>

        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={() => setRevisionTarget(null)}>
            Cancel
          </button>
          <button
            className={styles.revisionBtn}
            disabled={!revisionReason.trim()}
            onClick={async () => {
              if (!revisionTarget || !revisionReason.trim()) return;
              await runAction(
                () => requestRevision(revisionTarget.id, revisionReason),
                'Revision requested from author'
              );
              setRevisionTarget(null);
            }}
          >
            <ExclamationTriangleIcon className={styles.btnIcon} />
            <span>Submit Request</span>
          </button>
        </div>
      </Modal>

      <Modal open={!!rejectTarget} title="Reject Article" onClose={() => setRejectTarget(null)} maxWidth="560px">
        <div className={`${styles.modalNoticeBox} ${styles.danger}`}>
          <span style={{ fontSize: '1.2rem' }}>🛑</span>
          <div>
            <strong>Reject Article Submission</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Article: <strong>"{rejectTarget?.title}"</strong> will be marked as <strong>Rejected</strong> and removed from the review queue.
            </p>
          </div>
        </div>

        <div className={styles.modalFormGroup}>
          <label className={styles.modalFormLabel}>Rejection Reason *</label>
          <textarea
            className={styles.modalTextarea}
            rows={4}
            placeholder="Enter reason for rejecting this article..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>

        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={() => setRejectTarget(null)}>
            Cancel
          </button>
          <button
            className={styles.deleteBtn}
            disabled={!rejectReason.trim()}
            onClick={async () => {
              if (!rejectTarget || !rejectReason.trim()) return;
              await runAction(() => rejectArticle(rejectTarget.id, rejectReason), 'Article rejected');
              setRejectTarget(null);
            }}
          >
            <XCircleIcon className={styles.btnIcon} />
            <span>Reject Article</span>
          </button>
        </div>
      </Modal>

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div style={{ marginBottom: 8, fontSize: '0.86rem', color: 'var(--kb-text-muted)' }}>
              Category: {viewTarget.category} · {viewTarget.articleReference}
            </div>
            {viewTarget.summary && (
              <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--kb-text-primary)' }}>{viewTarget.summary}</p>
            )}
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--kb-text-secondary)', lineHeight: 1.6 }}>{viewTarget.content}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className={styles.submitBtn}
                onClick={async () => {
                  await runAction(
                    () => rateArticle(viewTarget.id, true),
                    'Thanks for your feedback'
                  );
                  setViewTarget(null);
                }}
              >
                👍 Helpful
              </button>
              <button
                className={styles.cancelBtn}
                onClick={async () => {
                  await runAction(
                    () => rateArticle(viewTarget.id, false),
                    'Thanks for your feedback'
                  );
                  setViewTarget(null);
                }}
              >
                👎 Not Helpful
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
