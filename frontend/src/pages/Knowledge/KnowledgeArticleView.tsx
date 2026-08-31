import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchArticle,
  submitArticle,
  approveArticle,
  rejectArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  restoreArticle,
  deleteArticle,
  requestRevision,
  rateArticle,
  fetchVersions,
  createVersion,
  fetchAttachments,
  deleteAttachment,
  uploadAttachment,
  searchArticles,
} from '../../api/knowledgeApi';
import type { Article, ArticleVersion, KnowledgeAttachment } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import Modal from '../../components/Modal/Modal';
import styles from './KnowledgeArticleView.module.css';

export default function KnowledgeArticleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role;
  const basePath = role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);
  const [related, setRelated] = useState<Article[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [versionForm, setVersionForm] = useState({ versionNumber: '', title: '', content: '', changeSummary: '' });
  const [showVersionModal, setShowVersionModal] = useState(false);

  const loadArticle = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchArticle(id);
      setArticle(res.data.data);
      if (can('knowledge.view_versions')) {
        const vRes = await fetchVersions(id);
        setVersions(vRes.data.data || []);
      }
      const aRes = await fetchAttachments(id);
      setAttachments(aRes.data.data || []);
      const sRes = await searchArticles(res.data.data.title, 5, id);
      setRelated((sRes.data.data || []));
    } catch {
      setError('Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticle();
  }, [id]);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await loadArticle();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () => runAction(() => submitArticle(id!), 'Submitted for review');
  const handleApprove = () => runAction(() => approveArticle(id!), 'Article approved');
  const handleReject = () => {
    if (!rejectReason.trim()) { setError('Rejection reason is required'); return; }
    setShowRejectModal(false);
    runAction(() => rejectArticle(id!, rejectReason), 'Article rejected');
  };
  const handleRequestRevision = () => {
    if (!revisionReason.trim()) { setError('Revision notes are required'); return; }
    setShowRevisionModal(false);
    runAction(() => requestRevision(id!, revisionReason), 'Revision requested');
  };
  const handlePublish = () => runAction(() => publishArticle(id!), 'Article published');
  const handleUnpublish = () => {
    setShowUnpublishModal(false);
    runAction(() => unpublishArticle(id!, unpublishReason), 'Article unpublished');
  };
  const handleArchive = () => runAction(() => archiveArticle(id!), 'Article archived');
  const handleRestore = () => runAction(() => restoreArticle(id!), 'Article restored');
  const handleDelete = () => {
    setDeleteTarget(false);
    runAction(() => deleteArticle(id!), 'Article deleted').then(() => navigate(basePath));
  };
  const handleRate = (helpful: boolean) => runAction(() => rateArticle(id!, helpful), 'Thanks for your feedback');
  const handleCreateVersion = () => {
    setShowVersionModal(false);
    runAction(() => createVersion(id!, versionForm), 'Version created').then(() => {
      setVersionForm({ versionNumber: '', title: '', content: '', changeSummary: '' });
    });
  };
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadAttachment(id!, file);
      setMessage('Attachment uploaded');
      const aRes = await fetchAttachments(id!);
      setAttachments(aRes.data.data || []);
    } catch {
      setError('Failed to upload attachment');
    } finally {
      setBusy(false);
    }
  };
  const handleDeleteAttachment = async (attachmentId: string) => {
    await runAction(() => deleteAttachment(id!, attachmentId), 'Attachment deleted');
    const aRes = await fetchAttachments(id!);
    setAttachments(aRes.data.data || []);
  };

  if (loading) return <div className={styles.page}>Loading...</div>;
  if (!article) return <div className={styles.page}>Article not found</div>;

  const isTenant = role === 'tenant';
  const canEdit = article.authorId === user?.id && ['draft', 'needs_revision'].includes(article.status) && !isTenant;

  const statusBadgeClass = `${styles.badge} ${styles[article.status] || ''}`;

  return (
    <div className={styles.page}>
      <PageHeader title={article.title} backTo={basePath} />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.label}>Reference</span>
          <span className={styles.value}>{article.articleReference}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Status</span>
          <span className={statusBadgeClass}>{article.status?.replace(/_/g, ' ')}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Version</span>
          <span className={styles.value}>{article.version}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Category</span>
          <span className={styles.value}>{article.category}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Visibility</span>
          <span className={styles.value}>{article.visibility}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Department</span>
          <span className={styles.value}>{article.departmentName || '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Author</span>
          <span className={styles.value}>
            {[article.authorFirstName, article.authorLastName].filter(Boolean).join(' ') || article.authorId?.slice(0, 8)}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Views</span>
          <span className={styles.value}>{article.viewCount || 0}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Feedback</span>
          <span className={styles.value}>👍 {(article.helpfulCount || 0)} 👎 {(article.notHelpfulCount || 0)}</span>
        </div>
        {!isTenant && article.approvedAt && (
          <div className={styles.metaItem}>
            <span className={styles.label}>Approved</span>
            <span className={styles.value}>{new Date(article.approvedAt).toLocaleString()} {article.approvedFirstName ? `by ${article.approvedFirstName} ${article.approvedLastName}` : ''}</span>
          </div>
        )}
        {!isTenant && article.rejectedAt && (
          <div className={styles.metaItem}>
            <span className={styles.label}>Rejected</span>
            <span className={styles.value}>{new Date(article.rejectedAt).toLocaleString()} {article.rejectedFirstName ? `by ${article.rejectedFirstName} ${article.rejectedLastName}` : ''}</span>
          </div>
        )}
        {!isTenant && article.unpublishedAt && (
          <div className={styles.metaItem}>
            <span className={styles.label}>Unpublished</span>
            <span className={styles.value}>{new Date(article.unpublishedAt).toLocaleString()} {article.unpublishedFirstName ? `by ${article.unpublishedFirstName} ${article.unpublishedLastName}` : ''}</span>
          </div>
        )}
        {!isTenant && article.archivedAt && (
          <div className={styles.metaItem}>
            <span className={styles.label}>Archived</span>
            <span className={styles.value}>{new Date(article.archivedAt).toLocaleString()} {article.archivedFirstName ? `by ${article.archivedFirstName} ${article.archivedLastName}` : ''}</span>
          </div>
        )}
        {!isTenant && article.unpublishReason && (
          <div className={styles.metaItem}>
            <span className={styles.label}>Unpublish Reason</span>
            <span className={styles.value}>{article.unpublishReason}</span>
          </div>
        )}
      </div>

      {article.summary && <div className={styles.summary}>{article.summary}</div>}

      <div className={styles.content}>
        <h3>Content</h3>
        <div style={{ whiteSpace: 'pre-wrap' }}>{article.content}</div>
      </div>

      {!isTenant && article.rejectionReason && (
        <div className={styles.rejectionBox}>
          <strong>Rejection Reason:</strong> {article.rejectionReason}
        </div>
      )}
      {!isTenant && article.revisionNotes && (
        <div className={styles.revisionBox}>
          <strong>Revision Notes:</strong> {article.revisionNotes}
        </div>
      )}

      <div className={styles.section}>
        <h4>Attachments ({attachments.length})</h4>
        <div className={styles.attachmentList}>
          {attachments.map((att) => (
            <div key={att.id} className={styles.attachmentItem}>
              <a href={att.filePath} target="_blank" rel="noopener noreferrer" className={styles.attachmentLink}>
                {att.fileName}
              </a>
              <span className={styles.attachmentSize}>
                {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : ''}
              </span>
              {can('knowledge.create') && (
                <button className={styles.danger} onClick={() => handleDeleteAttachment(att.id)}>Delete</button>
              )}
            </div>
          ))}
          {!attachments.length && <span className={styles.empty}>No attachments</span>}
        </div>
        {can('knowledge.create') && (
          <label className={styles.uploadBtn}>
            Upload Attachment
            <input type="file" hidden onChange={handleUploadAttachment} />
          </label>
        )}
      </div>

      <div className={styles.section}>
        <h4>Related Articles</h4>
        <div className={styles.relatedList}>
          {related.map((r) => (
            <div key={r.id} className={styles.relatedItem} onClick={() => navigate(`${basePath}/${r.id}`)}>
              <strong>{r.title}</strong>
              <span className={styles.relatedRef}>{r.articleReference}</span>
            </div>
          ))}
          {!related.length && <span className={styles.empty}>No related articles found</span>}
        </div>
      </div>

      <div className={styles.actions}>
        {!isTenant && canEdit && (
          <button className={styles.submitBtn} onClick={() => navigate(`${basePath}/${id}/edit`)}>Edit</button>
        )}
        {!isTenant && can('knowledge.submit') && article.authorId === user?.id && (article.status === 'draft' || article.status === 'needs_revision') && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleSubmit}>Submit for Review</button>
        )}
        {can('knowledge.request_revision') && article.status === 'pending_approval' && article.authorId !== user?.id && (
          <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>Request Changes</button>
        )}
        {can('knowledge.reject') && article.status === 'pending_approval' && article.authorId !== user?.id && (
          <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>Reject</button>
        )}
        {can('knowledge.approve') && article.status === 'pending_approval' && article.authorId !== user?.id && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleApprove}>Approve</button>
        )}
        {can('knowledge.publish') && article.status === 'approved' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handlePublish}>Publish</button>
        )}
        {can('knowledge.unpublish') && article.status === 'published' && (
          <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowUnpublishModal(true)}>Unpublish</button>
        )}
        {can('knowledge.archive') && article.status === 'published' && (
          <button className={styles.cancelBtn} disabled={busy} onClick={handleArchive}>Archive</button>
        )}
        {can('knowledge.archive') && article.status === 'archived' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleRestore}>Restore</button>
        )}
        {can('knowledge.manage_versions') && (
          <button className={styles.submitBtn} disabled={busy} onClick={() => setShowVersionModal(true)}>New Version</button>
        )}
        {can('knowledge.delete') && (
          <button className={styles.danger} disabled={busy} onClick={() => setDeleteTarget(true)}>Delete</button>
        )}
        {!isTenant && canEdit && (
          <button className={styles.edit} onClick={() => navigate(`${basePath}/${id}/edit`)}>Edit</button>
        )}
      </div>

      {!isTenant && can('knowledge.view_versions') && (
        <div className={styles.section}>
          <h4>Versions</h4>
          <button className={styles.submitBtn} onClick={() => setShowVersions(!showVersions)}>
            {showVersions ? 'Hide' : 'Show'} Versions ({versions.length})
          </button>
          {showVersions && (
            <div className={styles.versionList}>
              {versions.map((v) => (
                <div key={v.id} className={styles.versionItem}>
                  <strong>v{v.versionNumber}</strong> - {v.title}
                  <span className={styles.versionDate}>{new Date(v.createdAt).toLocaleDateString()}</span>
                  {v.changeSummary && <span className={styles.versionSummary}>{v.changeSummary}</span>}
                </div>
              ))}
              {!versions.length && <span className={styles.empty}>No versions</span>}
            </div>
          )}
        </div>
      )}

      {isTenant && (
        <div className={styles.feedbackSection}>
          <h4>Was this article helpful?</h4>
          <div className={styles.feedbackBtns}>
            <button className={styles.submitBtn} onClick={() => handleRate(true)}>👍 Helpful</button>
            <button className={styles.cancelBtn} onClick={() => handleRate(false)}>👎 Not Helpful</button>
          </div>
        </div>
      )}

      <Modal open={showRevisionModal} title="Request Revision" onClose={() => setShowRevisionModal(false)}>
        <p>Please provide revision notes:</p>
        <textarea
          value={revisionReason}
          onChange={(e) => setRevisionReason(e.target.value)}
          placeholder="Enter revision notes..."
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleRequestRevision}>Submit</button>
          <button className={styles.cancelBtn} onClick={() => setShowRevisionModal(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={showRejectModal} title="Reject Article" onClose={() => setShowRejectModal(false)}>
        <p>Please provide a rejection reason:</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Enter rejection reason..."
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleReject}>Reject</button>
          <button className={styles.cancelBtn} onClick={() => setShowRejectModal(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={showUnpublishModal} title="Unpublish Article" onClose={() => setShowUnpublishModal(false)}>
        <p>Please provide a reason for unpublishing (optional):</p>
        <textarea
          value={unpublishReason}
          onChange={(e) => setUnpublishReason(e.target.value)}
          placeholder="Enter reason..."
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={handleUnpublish}>Unpublish</button>
          <button className={styles.submitBtn} onClick={() => setShowUnpublishModal(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={showVersionModal} title="Create New Version" onClose={() => setShowVersionModal(false)}>
        <div className={styles.formGroup}>
          <label>Version Number</label>
          <input value={versionForm.versionNumber} onChange={(e) => setVersionForm({ ...versionForm, versionNumber: e.target.value })} placeholder="e.g. 1.1" />
        </div>
        <div className={styles.formGroup}>
          <label>Title</label>
          <input value={versionForm.title} onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })} placeholder="Version title" />
        </div>
        <div className={styles.formGroup}>
          <label>Content</label>
          <textarea value={versionForm.content} onChange={(e) => setVersionForm({ ...versionForm, content: e.target.value })} rows={6} />
        </div>
        <div className={styles.formGroup}>
          <label>Change Summary</label>
          <textarea value={versionForm.changeSummary} onChange={(e) => setVersionForm({ ...versionForm, changeSummary: e.target.value })} rows={3} />
        </div>
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleCreateVersion}>Create Version</button>
          <button className={styles.cancelBtn} onClick={() => setShowVersionModal(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(false)}>
        <p>Are you sure you want to delete "{article.title}"? This action cannot be undone.</p>
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleDelete}>Delete</button>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
