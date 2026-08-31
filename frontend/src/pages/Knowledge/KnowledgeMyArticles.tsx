import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchMyDrafts,
  fetchArticle,
  submitArticle,
  archiveArticle,
  restoreArticle,
  deleteArticle,
} from '../../api/knowledgeApi';
import type { Article } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
import styles from './KnowledgeMyArticles.module.css';

export default function KnowledgeMyArticles() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const basePath = role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [artPage, setArtPage] = useState(1);
  const [artPageSize, setArtPageSize] = useState(10);
  const ART_PAGE_OPTIONS = [10, 20, 50];

  const totalArtPages = useMemo(() => Math.max(1, Math.ceil(articles.length / artPageSize)), [articles.length, artPageSize]);
  const pagedArticles = useMemo(() => articles.slice((artPage - 1) * artPageSize, artPage * artPageSize), [articles, artPage, artPageSize]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await fetchMyDrafts();
      setArticles(res.data.data || []);
    } catch {
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  const runAction = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await loadArticles();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await runAction(deleteTarget.id, () => deleteArticle(deleteTarget.id), 'Article deleted');
    setDeleteTarget(null);
  };

  return (
    <div className={styles.page}>
      <PageHeader title="My Articles" description="Articles you have created" backTo={basePath} actionLabel="+ New Article" onAction={() => navigate(`${basePath}/create`)} />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
          {articles.length === 0 ? 'No articles' : `Showing ${Math.min((artPage - 1) * artPageSize + 1, articles.length)}–${Math.min(artPage * artPageSize, articles.length)} of ${articles.length}`}
        </span>
        <select
          value={artPageSize}
          onChange={(e) => { setArtPageSize(Number(e.target.value)); setArtPage(1); }}
          style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--input-bg, #fff)', color: 'var(--text-main, #0f172a)' }}
        >
          {ART_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>

      <DataTable<Article>
        loading={loading}
        data={pagedArticles}
        columns={[
          { key: 'title', label: 'Title', render: (row) => <strong>{row.title}</strong> },
          { key: 'category', label: 'Category' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <span className={`${styles.badge} ${styles[row.status] || ''}`}>{row.status?.replace(/_/g, ' ')}</span>
          },
          {
            key: 'createdAt',
            label: 'Created',
            render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <button className={styles.view} onClick={() => navigate(`${basePath}/${row.id}`)}>View</button>
                {row.authorId === user?.id && ['draft', 'needs_revision'].includes(row.status) && (
                  <button className={styles.edit} onClick={() => navigate(`${basePath}/${row.id}/edit`)}>Edit</button>
                )}
                {row.authorId === user?.id && (row.status === 'draft' || row.status === 'needs_revision') && (
                  <button className={styles.submitBtn} disabled={busyId === row.id} onClick={() => runAction(row.id, () => submitArticle(row.id), 'Submitted')}>Submit</button>
                )}
                {row.status === 'archived' && (
                  <button className={styles.submitBtn} disabled={busyId === row.id} onClick={() => runAction(row.id, () => restoreArticle(row.id), 'Restored')}>Restore</button>
                )}
                <button className={styles.danger} onClick={() => setDeleteTarget(row)}>Delete</button>
              </div>
            ),
          },
        ]}
      />

      {totalArtPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button
            onClick={() => setArtPage(p => Math.max(1, p - 1))}
            disabled={artPage <= 1}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: artPage <= 1 ? 'not-allowed' : 'pointer', opacity: artPage <= 1 ? 0.5 : 1 }}
          >← Previous</button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #334155)' }}>Page {artPage} of {totalArtPages}</span>
          <button
            onClick={() => setArtPage(p => Math.min(totalArtPages, p + 1))}
            disabled={artPage >= totalArtPages}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: artPage >= totalArtPages ? 'not-allowed' : 'pointer', opacity: artPage >= totalArtPages ? 0.5 : 1 }}
          >Next →</button>
        </div>
      )}

      <Modal open={!!deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(null)}>
        <p>Are you sure you want to delete "{deleteTarget?.title}"?</p>
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleDelete}>Delete</button>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}


