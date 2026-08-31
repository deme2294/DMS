import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchArticles,
  fetchArticle,
  fetchMyDrafts,
  fetchPendingReview,
  getPublicArticles,
  deleteArticle,
  submitArticle,
  approveArticle,
  rejectArticle,
  publishArticle,
  archiveArticle,
  restoreArticle,
  rateArticle,
  fetchAllCategories,
} from '../../api/knowledgeApi';
import type { Article, KnowledgeCategory } from '../../types/article';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import styles from './CeoKnowledge.module.css';

type Tab = 'all' | 'drafts' | 'pending';

export default function CeoKnowledgeList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const { page, limit, setPage, resetPage } = usePagination();

  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  const [viewTarget, setViewTarget] = useState<Article | null>(null);

  const isTenant = role === 'tenant';

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, status, category, page, limit };
      let res;
      if (isTenant) {
        res = await getPublicArticles(params);
      } else if (tab === 'drafts') {
        res = await fetchMyDrafts();
      } else if (tab === 'pending') {
        res = await fetchPendingReview();
      } else {
        res = await fetchArticles(params);
      }
      setArticles(res.data.data);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [isTenant, tab, search, status, page, limit]);

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
  }, [loadCategories]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      setMessage(successMsg);
      loadArticles();
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
    if (role === 'admin') return true;
    if (role === 'manager') return true;
    if (role === 'ceo') return true;
    if (role === 'staff') return a.authorId === user?.id && a.status === 'draft';
    return false;
  };

  const renderActions = (a: Article) => {
    if (isTenant) {
      return (
        <button className={styles.view} onClick={() => openDetail(a.id)}>
          Read
        </button>
      );
    }
    const buttons: ReactElement[] = [];

    if (canEdit(a)) {
      buttons.push(
        <button key="edit" className={styles.edit} onClick={() => navigate(`/ceo/knowledge/${a.id}/edit`)}>
          Edit
        </button>
      );
    }

    if (role === 'staff' && a.authorId === user?.id && a.status === 'draft') {
      buttons.push(
        <button key="submit" className={styles.edit} onClick={() => runAction(() => submitArticle(a.id), 'Submitted for review')}>
          Submit
        </button>
      );
    }

    if (can('knowledge.approve') && a.status === 'pending_approval') {
      buttons.push(
        <button key="approve" className={styles.edit} onClick={() => runAction(() => approveArticle(a.id), 'Article approved')}>
          Approve
        </button>
      );
      buttons.push(
        <button key="reject" className={styles.danger} onClick={() => runAction(() => rejectArticle(a.id, 'Needs revision'), 'Article rejected')}>
          Reject
        </button>
      );
    }

    if (can('knowledge.publish') && a.status === 'approved') {
      buttons.push(
        <button key="publish" className={styles.edit} onClick={() => runAction(() => publishArticle(a.id), 'Article published')}>
          Publish
        </button>
      );
    }

    if (can('knowledge.delete')) {
      if (a.status === 'published') {
        buttons.push(
          <button key="archive" className={styles.view} onClick={() => runAction(() => archiveArticle(a.id), 'Article archived')}>
            Archive
          </button>
        );
      }
      if (a.status === 'archived') {
        buttons.push(
          <button key="restore" className={styles.edit} onClick={() => runAction(() => restoreArticle(a.id), 'Article restored')}>
            Restore
          </button>
        );
      }
      buttons.push(
        <button key="delete" className={styles.danger} onClick={() => setDeleteTarget(a)}>
          Delete
        </button>
      );
    }

    if (!buttons.length) {
      return (
        <button className={styles.view} onClick={() => navigate(`/ceo/knowledge/${a.id}/edit`)}>
          View
        </button>
      );
    }
    return <div className={styles.actions}>{buttons}</div>;
  };

  const openDetail = async (id: string) => {
    try {
      const res = await fetchArticle(id);
      setViewTarget(res.data.data);
    } catch {
      setError('Failed to load article');
    }
  };

  const rate = async (helpful: boolean) => {
    if (!viewTarget) return;
    await runAction(() => rateArticle(viewTarget.id, helpful), 'Thanks for your feedback');
    setViewTarget(null);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive Knowledge Management"
        description={
          isTenant
            ? 'Search published solutions. If none help, create a ticket.'
            : 'Browse, create, and manage knowledge base articles.'
        }
        backTo={role ? `/${role}/dashboard` : '/'}
        actionLabel={!isTenant && can('knowledge.create') ? '+ New Article' : undefined}
        onAction={!isTenant && can('knowledge.create') ? () => navigate('/ceo/knowledge/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      <div className={styles.filters}>
        <input
          placeholder="Search by title or content..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        {!isTenant && (
          <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        )}
        <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {!isTenant && (role === 'staff' || role === 'manager' || role === 'admin' || role === 'ceo') && (
        <div className={styles.filters} style={{ gridTemplateColumns: 'repeat(3, auto)', width: 'fit-content' }}>
          <button className={tab === 'all' ? styles.edit : styles.view} onClick={() => setTab('all')}>All</button>
          {(role === 'staff' || role === 'admin' || role === 'ceo') && (
            <button className={tab === 'drafts' ? styles.edit : styles.view} onClick={() => setTab('drafts')}>My Drafts</button>
          )}
          {(role === 'manager' || role === 'admin' || role === 'ceo') && (
            <button className={tab === 'pending' ? styles.edit : styles.view} onClick={() => setTab('pending')}>Pending Review</button>
          )}
        </div>
      )}

      <DataTable<Article>
        loading={loading}
        data={articles}
        columns={[
          {
            key: 'title',
            label: 'Title',
            render: (row) => (
              <div>
                <div style={{ fontWeight: 600 }}>{row.title}</div>
                <div className={styles.date}>
                  {row.departmentName ? `Dept: ${row.departmentName} · ` : ''}
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}
                </div>
              </div>
            ),
          },
          { key: 'category', label: 'Category' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <span className={`${styles.badge} ${styles[row.status]}`}>{row.status?.replace('_', ' ')}</span>,
          },
          {
            key: 'author',
            label: 'Author',
            render: (row) => (
              <span className={styles.author}>
                 {[row.authorFirstName, row.authorLastName].filter(Boolean).join(' ') ||
                  row.authorId?.slice(0, 8) ||
                  '—'}
              </span>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => renderActions(row),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      <Modal open={!!deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(null)}>
        <p>Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.</p>
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleDelete}>Delete</button>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div className={styles.date} style={{ marginBottom: 8 }}>Category: {viewTarget.category}</div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{viewTarget.content}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className={styles.submitBtn} onClick={() => rate(true)}>👍 Helpful</button>
              <button className={styles.cancelBtn} onClick={() => rate(false)}>👎 Not Helpful</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
