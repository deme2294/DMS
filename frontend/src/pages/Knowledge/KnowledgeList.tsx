import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchArticles,
  fetchArticle,
  fetchPendingReview,
  fetchNeedsRevision,
  deleteArticle,
  submitArticle,
  approveArticle,
  rejectArticle,
  requestRevision,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  restoreArticle,
  rateArticle,
  fetchAllCategories,
  fetchArticleStats,
} from '../../api/knowledgeApi';
import type { Article, KnowledgeCategory, ArticleStats } from '../../types/article';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import styles from './KnowledgeList.module.css';

type Tab = 'all' | 'my-drafts' | 'pending' | 'approved' | 'published' | 'needs-revision';

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
    if (isAdmin || isManager) {
      try {
        const res = await fetchArticleStats();
        if (res.data?.success && res.data?.data) {
          setStats(res.data.data);
        }
      } catch {
        // ignore
      }
    }
  }, [isAdmin, isManager]);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search: search || undefined, status: status || undefined, category: category || undefined, page, limit };
      let res;

      if (tab === 'my-drafts') {
        res = await fetchArticles({ ...params, status: 'draft', authorId: user?.id });
      } else if (tab === 'pending') {
        res = await fetchPendingReview();
      } else if (tab === 'approved') {
        res = await fetchArticles({ ...params, status: 'approved' });
      } else if (tab === 'published') {
        res = await fetchArticles({ ...params, status: 'published' });
      } else if (tab === 'needs-revision') {
        res = await fetchNeedsRevision();
      } else {
        res = await fetchArticles({
          ...params,
          status: isTenant ? 'published' : status || undefined,
        });
      }
      setArticles(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [isTenant, tab, search, status, category, page, limit, user?.id]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchAllCategories();
      setCategories(res.data.data || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    loadCategories();
    loadStats();
  }, [loadCategories, loadStats]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      setMessage(successMsg);
      await loadArticles();
      await loadStats();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Action failed'
      );
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
    if (isStaff) return a.authorId === user?.id && ['draft', 'needs_revision'].includes(a.status);
    return false;
  };

  const renderActions = (a: Article) => {
    if (isTenant) {
      return (
        <button className={styles.view} onClick={() => navigate(`${basePath}/${a.id}`)}>
          Read
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
            🚀 Publish to Tenants
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
            🚀 Publish
          </button>
        );
        buttons.push(
          <button
            key="approve"
            className={styles.approveBtn}
            title="Approve draft"
            onClick={() => runAction(() => approveArticle(a.id), 'Draft approved')}
          >
            ✓ Approve
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
            🚀 Publish
          </button>
        );
        buttons.push(
          <button
            key="approve"
            className={styles.approveBtn}
            title="Approve article"
            onClick={() => runAction(() => approveArticle(a.id), 'Article approved')}
          >
            ✓ Approve
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
            Request Changes
          </button>
        );
        buttons.push(
          <button
            key="reject"
            className={styles.danger}
            title="Reject article"
            onClick={() => {
              setRejectTarget(a);
              setRejectReason('');
            }}
          >
            Reject
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
            🚀 Re-publish
          </button>
        );
      }
    }

    // Manager review actions (if not admin)
    if (!isAdmin && isManager && a.status === 'pending_approval' && can('knowledge.approve')) {
      buttons.push(
        <button
          key="approve"
          className={styles.approveBtn}
          onClick={() => runAction(() => approveArticle(a.id), 'Article approved by Department Manager')}
        >
          ✓ Approve
        </button>
      );
      buttons.push(
        <button
          key="revision"
          className={styles.revisionBtn}
          onClick={() => {
            setRevisionTarget(a);
            setRevisionReason('');
          }}
        >
          Request Changes
        </button>
      );
      buttons.push(
        <button
          key="reject"
          className={styles.danger}
          onClick={() => {
            setRejectTarget(a);
            setRejectReason('');
          }}
        >
          Reject
        </button>
      );
    }

    // Staff submission action
    if (isStaff && a.authorId === user?.id && (a.status === 'draft' || a.status === 'needs_revision')) {
      buttons.push(
        <button
          key="submit"
          className={styles.approveBtn}
          onClick={() => runAction(() => submitArticle(a.id), 'Submitted for review')}
        >
          Submit for Review
        </button>
      );
    }

    // Unpublish / Archive / Restore
    if (can('knowledge.unpublish') && a.status === 'published') {
      buttons.push(
        <button
          key="unpublish"
          className={styles.cancelBtn}
          onClick={() => runAction(() => unpublishArticle(a.id, ''), 'Article unpublished')}
        >
          Unpublish
        </button>
      );
    }

    if (can('knowledge.archive') && a.status === 'published') {
      buttons.push(
        <button
          key="archive"
          className={styles.cancelBtn}
          onClick={() => runAction(() => archiveArticle(a.id), 'Article archived')}
        >
          Archive
        </button>
      );
    }

    if (can('knowledge.restore') && a.status === 'archived') {
      buttons.push(
        <button
          key="restore"
          className={styles.approveBtn}
          onClick={() => runAction(() => restoreArticle(a.id), 'Article restored')}
        >
          Restore
        </button>
      );
    }

    // Edit button
    if (canEdit(a)) {
      buttons.push(
        <button key="edit" className={styles.edit} onClick={() => navigate(`${basePath}/${a.id}/edit`)}>
          Edit
        </button>
      );
    }

    // View button
    buttons.push(
      <button key="view" className={styles.view} onClick={() => navigate(`${basePath}/${a.id}`)}>
        View
      </button>
    );

    // Delete button
    if (can('knowledge.delete') || (isStaff && a.authorId === user?.id && a.status === 'draft')) {
      buttons.push(
        <button key="delete" className={styles.danger} onClick={() => setDeleteTarget(a)}>
          Delete
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
            : isAdmin
            ? 'Review, approve, and publish knowledge base articles to empower tenants and staff.'
            : 'Browse, create, and manage knowledge base articles for your department.'
        }
        backTo={role ? `/${role}/dashboard` : '/'}
        actionLabel={!isTenant && can('knowledge.create') ? '+ New Article' : undefined}
        onAction={!isTenant && can('knowledge.create') ? () => navigate(`${basePath}/create`) : undefined}
      />

      {message && <div className={styles.toast}>✓ {message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>⚠ {error}</div>}

      {/* ── Admin & Manager Live Overview Metric Cards ── */}
      {(isAdmin || isManager) && stats && (
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
              <span className={styles.statLabel}>Total Articles</span>
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
              <span className={styles.statLabel}>Drafts</span>
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
              <span className={styles.statLabel}>Pending Review</span>
            </div>
            {stats.pending_approval > 0 && (
              <span className={styles.statHighlightAlert}>{stats.pending_approval} Pending</span>
            )}
          </div>

          <div
            className={`${styles.statCard} ${tab === 'approved' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('approved')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#dcfce7', color: '#166534' }}>
              🚀
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.approved}</span>
              <span className={styles.statLabel}>Ready to Publish</span>
            </div>
            {stats.approved > 0 && (
              <span className={styles.statHighlightSuccess}>{stats.approved} Ready</span>
            )}
          </div>

          <div
            className={`${styles.statCard} ${tab === 'published' ? styles.statCardActive : ''}`}
            onClick={() => handleTabChange('published')}
          >
            <div className={styles.statIconWrapper} style={{ background: '#ecfdf5', color: '#059669' }}>
              🌐
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.published}</span>
              <span className={styles.statLabel}>Published & Live</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Modern Navigation Tabs ── */}
      {!isTenant && (
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All Articles
            {stats && <span className={styles.tabBadge}>{stats.total}</span>}
          </button>

          {(isStaff || isAdmin) && (
            <button
              className={`${styles.tabBtn} ${tab === 'my-drafts' ? styles.tabBtnActive : ''}`}
              onClick={() => handleTabChange('my-drafts')}
            >
              My Drafts
              {stats && stats.draft > 0 && <span className={styles.tabBadge}>{stats.draft}</span>}
            </button>
          )}

          {(isManager || isAdmin) && (
            <button
              className={`${styles.tabBtn} ${tab === 'pending' ? styles.tabBtnActive : ''}`}
              onClick={() => handleTabChange('pending')}
            >
              Pending Review
              {stats && stats.pending_approval > 0 && (
                <span className={`${styles.tabBadge} ${styles.tabBadgeUrgent}`}>
                  {stats.pending_approval}
                </span>
              )}
            </button>
          )}

          {(isAdmin || isManager) && (
            <button
              className={`${styles.tabBtn} ${tab === 'approved' ? styles.tabBtnActive : ''}`}
              onClick={() => handleTabChange('approved')}
            >
              Ready to Publish
              {stats && stats.approved > 0 && (
                <span className={`${styles.tabBadge} ${styles.tabBadgeReady}`}>
                  {stats.approved}
                </span>
              )}
            </button>
          )}

          <button
            className={`${styles.tabBtn} ${tab === 'published' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('published')}
          >
            Published
            {stats && stats.published > 0 && (
              <span className={styles.tabBadge}>{stats.published}</span>
            )}
          </button>

          <button
            className={`${styles.tabBtn} ${tab === 'needs-revision' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('needs-revision')}
          >
            Needs Revision
            {stats && stats.needs_revision > 0 && (
              <span className={`${styles.tabBadge} ${styles.tabBadgeUrgent}`}>
                {stats.needs_revision}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className={styles.filters}>
        <input
          placeholder="Search by title, reference, or content..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />

        {!isTenant && tab === 'all' && (
          <select
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
          </select>
        )}

        <select
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

        {(search || status || category) && (
          <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
            ✕ Clear Filters
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
                  <span className={styles.referenceBadge}>{row.articleReference}</span>
                  {row.departmentName && <span className={styles.deptChip}>{row.departmentName}</span>}
                  {row.approvedFirstName && (
                    <span
                      className={styles.approvedChip}
                      title={`Approved at ${
                        row.approvedAt ? new Date(row.approvedAt).toLocaleString() : ''
                      }`}
                    >
                      ✓ Approved by {row.approvedFirstName} {row.approvedLastName || ''}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '1rem' }}>{resolveCategoryIcon(row.category)}</span>
                <span>{row.category}</span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`${styles.badge} ${styles[row.status] || ''}`}>
                {row.status === 'approved'
                  ? 'Approved (Ready to Publish)'
                  : row.status?.replace(/_/g, ' ')}
              </span>
            ),
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
          <button className={styles.danger} onClick={handleDelete}>
            Delete Article
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
            Submit Request
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
            className={styles.danger}
            disabled={!rejectReason.trim()}
            onClick={async () => {
              if (!rejectTarget || !rejectReason.trim()) return;
              await runAction(() => rejectArticle(rejectTarget.id, rejectReason), 'Article rejected');
              setRejectTarget(null);
            }}
          >
            Reject Article
          </button>
        </div>
      </Modal>

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div className={styles.date} style={{ marginBottom: 8 }}>
              Category: {viewTarget.category} · {viewTarget.articleReference}
            </div>
            {viewTarget.summary && (
              <p style={{ fontWeight: 500, marginBottom: 8 }}>{viewTarget.summary}</p>
            )}
            <p style={{ whiteSpace: 'pre-wrap' }}>{viewTarget.content}</p>
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
