import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchPendingReview,
  approveArticle,
  rejectArticle,
  publishArticle,
  requestRevision,
  fetchArticle,
} from '../../api/knowledgeApi';
import type { Article } from '../../types/article';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import styles from './KnowledgeApproval.module.css';

export default function KnowledgeApproval() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const basePath = role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<Article | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Article | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewTarget, setViewTarget] = useState<Article | null>(null);
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalPageSize, setApprovalPageSize] = useState(10);
  const APPROVAL_PAGE_OPTIONS = [10, 20, 50];

  const totalApprovalPages = useMemo(() => Math.max(1, Math.ceil(articles.length / approvalPageSize)), [articles.length, approvalPageSize]);
  const pagedArticles = useMemo(() => articles.slice((approvalPage - 1) * approvalPageSize, approvalPage * approvalPageSize), [articles, approvalPage, approvalPageSize]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await fetchPendingReview();
      setArticles(res.data.data || []);
    } catch {
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

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

  const openDetail = async (id: string) => {
    try {
      const res = await fetchArticle(id);
      setViewTarget(res.data.data);
    } catch {
      setError('Failed to load article');
    }
  };

  const handleRequestRevision = () => {
    if (!revisionTarget) return;
    if (!revisionReason.trim()) { setError('Revision notes are required'); return; }
    setRevisionTarget(null);
    runAction(revisionTarget.id, () => requestRevision(revisionTarget.id, revisionReason), 'Revision requested');
    setRevisionReason('');
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { setError('Rejection reason is required'); return; }
    setRejectTarget(null);
    runAction(rejectTarget.id, () => rejectArticle(rejectTarget.id, rejectReason), 'Article rejected');
    setRejectReason('');
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Knowledge Base Approval" description="Review and manage pending articles" backTo={basePath} />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
          {articles.length === 0 ? 'No pending articles' : `Showing ${Math.min((approvalPage - 1) * approvalPageSize + 1, articles.length)}–${Math.min(approvalPage * approvalPageSize, articles.length)} of ${articles.length}`}
        </span>
        <select
          value={approvalPageSize}
          onChange={(e) => { setApprovalPageSize(Number(e.target.value)); setApprovalPage(1); }}
          style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--input-bg, #fff)', color: 'var(--text-main, #0f172a)' }}
        >
          {APPROVAL_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>

      <DataTable<Article>
        loading={loading}
        data={pagedArticles}
        columns={[
          { key: 'articleReference', label: 'Reference', render: (row) => row.articleReference },
          { key: 'title', label: 'Title', render: (row) => <strong>{row.title}</strong> },
          { key: 'category', label: 'Category' },
          { key: 'departmentName', label: 'Department' },
          {
            key: 'author',
            label: 'Author',
            render: (row) => [row.authorFirstName, row.authorLastName].filter(Boolean).join(' ') || row.authorId?.slice(0, 8) || '—'
          },
          {
            key: 'createdAt',
            label: 'Submitted',
            render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <button className={styles.view} onClick={() => openDetail(row.id)}>View</button>
                {can('knowledge.request_revision') && row.authorId !== user?.id && (
                  <button className={styles.edit} onClick={() => setRevisionTarget(row)}>Request Changes</button>
                )}
                {can('knowledge.reject') && (
                  <button className={styles.danger} onClick={() => setRejectTarget(row)}>Reject</button>
                )}
                {can('knowledge.approve') && row.authorId !== user?.id && (
                  <button className={styles.submitBtn} disabled={busyId === row.id} onClick={() => runAction(row.id, () => approveArticle(row.id), 'Approved')}>Approve</button>
                )}
                {can('knowledge.publish') && row.status === 'approved' && (
                  <button className={styles.submitBtn} disabled={busyId === row.id} onClick={() => runAction(row.id, () => publishArticle(row.id), 'Published')}>Publish</button>
                )}
              </div>
            ),
          },
        ]}
      />

      {totalApprovalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button
            onClick={() => setApprovalPage(p => Math.max(1, p - 1))}
            disabled={approvalPage <= 1}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: approvalPage <= 1 ? 'not-allowed' : 'pointer', opacity: approvalPage <= 1 ? 0.5 : 1 }}
          >← Previous</button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #334155)' }}>Page {approvalPage} of {totalApprovalPages}</span>
          <button
            onClick={() => setApprovalPage(p => Math.min(totalApprovalPages, p + 1))}
            disabled={approvalPage >= totalApprovalPages}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: approvalPage >= totalApprovalPages ? 'not-allowed' : 'pointer', opacity: approvalPage >= totalApprovalPages ? 0.5 : 1 }}
          >Next →</button>
        </div>
      )}

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div className={styles.metaGrid}>
              <div><strong>Reference:</strong> {viewTarget.articleReference}</div>
              <div><strong>Category:</strong> {viewTarget.category}</div>
              <div><strong>Department:</strong> {viewTarget.departmentName || '—'}</div>
              <div><strong>Author:</strong> {[viewTarget.authorFirstName, viewTarget.authorLastName].filter(Boolean).join(' ') || '—'}</div>
              <div><strong>Status:</strong> {viewTarget.status}</div>
            </div>
            <div style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{viewTarget.content}</div>
          </div>
        )}
      </Modal>

      <Modal open={!!revisionTarget} title="Request Changes" onClose={() => { setRevisionTarget(null); setRevisionReason(''); }}>
        <p>Please provide revision notes for "{revisionTarget?.title}":</p>
        <textarea
          value={revisionReason}
          onChange={(e) => setRevisionReason(e.target.value)}
          placeholder="Enter revision notes..."
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleRequestRevision}>Submit</button>
          <button className={styles.cancelBtn} onClick={() => { setRevisionTarget(null); setRevisionReason(''); }}>Cancel</button>
        </div>
      </Modal>

      <Modal open={!!rejectTarget} title="Reject Article" onClose={() => { setRejectTarget(null); setRejectReason(''); }}>
        <p>Please provide a rejection reason for "{rejectTarget?.title}":</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Enter rejection reason..."
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleReject}>Reject</button>
          <button className={styles.cancelBtn} onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
