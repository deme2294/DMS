import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchArticles,
  fetchArticle,
  fetchAllCategories,
  rateArticle,
} from '../../api/knowledgeApi';
import type { Article, KnowledgeCategory } from '../../types/article';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import styles from './CeoKnowledge.module.css';

export default function CeoKnowledgeList() {
  const { user } = useAuth();
  const role = user?.role;
  const { page, limit, setPage, resetPage } = usePagination();

  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [viewTarget, setViewTarget] = useState<Article | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, status, category, page, limit };
      const res = await fetchArticles(params);
      setArticles(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch {
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [search, status, category, page, limit]);

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

  const uniqueCategories = Array.from(
    new Set([...categories.map((c) => c.name), ...articles.map((a) => a.category).filter(Boolean)])
  );

  const openDetail = async (id: string) => {
    try {
      const res = await fetchArticle(id);
      setViewTarget(res.data.data);
    } catch {
      setError('Failed to load article details');
    }
  };

  const rate = async (helpful: boolean) => {
    if (!viewTarget) return;
    try {
      await rateArticle(viewTarget.id, helpful);
      setMessage('Thanks for your feedback');
      setViewTarget(null);
    } catch {
      setError('Failed to rate article');
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive Knowledge Base"
        description="Browse and view organizational knowledge base articles."
        backTo={role ? `/${role}/dashboard` : '/'}
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
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

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
            render: (row) => <span className={`${styles.badge} ${styles[row.status] || ''}`}>{row.status?.replace('_', ' ')}</span>,
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
            render: (row) => (
              <button className={styles.view} onClick={() => openDetail(row.id)}>
                Read / View
              </button>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div className={styles.date} style={{ marginBottom: 8 }}>
              {viewTarget.departmentName ? `Department: ${viewTarget.departmentName} · ` : ''}
              Category: {viewTarget.category} · Status: {viewTarget.status}
            </div>
            {viewTarget.summary && (
              <div style={{ marginBottom: 12, fontStyle: 'italic', color: 'var(--text-muted, #64748b)' }}>
                {viewTarget.summary}
              </div>
            )}
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{viewTarget.content}</p>
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
