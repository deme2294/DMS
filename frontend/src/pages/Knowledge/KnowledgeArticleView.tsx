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
  moveToDraft,
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
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import styles from './KnowledgeArticleView.module.css';

export default function KnowledgeArticleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role;
  const basePath = role === 'staff' ? '/staff/knowledge' : role === 'manager' ? '/manager/knowledge' : role === 'tenant' ? '/tenant/knowledge' : '/admin/knowledge';

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
  const handleApprove = () =>
    runAction(
      () => approveArticle(id!),
      role === 'manager'
        ? 'Article approved! Admin has been notified to publish.'
        : 'Article approved'
    );
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
  const handleMoveToDraft = () => runAction(() => moveToDraft(id!), 'Article moved to draft');
  const handleDelete = () => {
    setDeleteTarget(false);
    runAction(() => deleteArticle(id!), 'Article deleted').then(() => navigate(basePath));
  };
  const handleRate = (helpful: boolean) => runAction(() => rateArticle(id!, helpful), 'Thanks for your feedback');
  const openVersionModal = () => {
    if (!article) return;
    let nextVer = '';
    if (article.version) {
      const parts = article.version.replace(/^v/i, '').split('.');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        nextVer = `${parts[0]}.${Number(parts[1]) + 1}`;
      } else if (!isNaN(Number(article.version))) {
        nextVer = `${Number(article.version) + 1}.0`;
      }
    }
    setVersionForm({
      versionNumber: nextVer || '1.1',
      title: article.title || '',
      content: article.content || '',
      changeSummary: '',
    });
    setShowVersionModal(true);
  };

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
  const canEdit = (role === 'admin' || role === 'manager' || (article.authorId === user?.id && ['draft', 'needs_revision', 'restored'].includes(article.status))) && !isTenant;

  const statusBadgeClass = `${styles.badge} ${styles[article.status] || ''}`;

  return (
    <div className={styles.page}>
      <PageHeader title={article.title} backTo={basePath} />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      {/* ── Workflow Division Lifecycle Card ── */}
      {!isTenant && article.status === 'pending_approval' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusPending}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>⏳</div>
            <div>
              <div className={styles.workflowStatusTitle}>Stage 2: Pending Department Manager Review</div>
              <div className={styles.workflowStatusDesc}>
                Submitted by {article.authorFirstName || 'Staff'} {article.authorLastName || ''}. Awaiting Department Manager review & approval before Admin can publish.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'approved' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusApproved}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>✓</div>
            <div>
              <div className={styles.workflowStatusTitle}>Stage 3: Approved by Department Manager — Ready for Admin to Publish</div>
              <div className={styles.workflowStatusDesc}>
                Approved by {article.approvedFirstName || 'Manager'} {article.approvedLastName || ''} {article.approvedAt ? `on ${new Date(article.approvedAt).toLocaleDateString()}` : ''}. Admin has been notified to publish this article.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'published' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusPublished}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>🌐</div>
            <div>
              <div className={styles.workflowStatusTitle}>Live Knowledge Base Article</div>
              <div className={styles.workflowStatusDesc}>
                Published and active for tenant search and department self-service resolution.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'needs_revision' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusRevision}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>⚠️</div>
            <div>
              <div className={styles.workflowStatusTitle}>Workflow Revision Requested</div>
              <div className={styles.workflowStatusDesc}>
                The manager has requested updates. Please review the revision notes below, edit the article, and resubmit.
              </div>
            </div>
          </div>
        </div>
      )}

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
          <span className={styles.value}>
            <span style={{ marginRight: 6 }}>{resolveCategoryIcon(article.category)}</span>
            {article.category}
          </span>
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
          <button className={styles.submitBtn} disabled={busy} onClick={handleSubmit}>
            📤 Submit for Review
          </button>
        )}
        {/* Admin Direct Draft Controls */}
        {role === 'admin' && article.status === 'draft' && (
          <>
            <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>🚀 Publish to Tenants</button>
            <button className={styles.approveBtn} disabled={busy} onClick={handleApprove}>✓ Approve Draft</button>
          </>
        )}
        {/* Pending Approval Controls for Admin */}
        {role === 'admin' && article.status === 'pending_approval' && (
          <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>🚀 Publish to Tenants</button>
        )}
        {/* Department Manager & Admin Approval Buttons */}
        {role !== 'staff' && can('knowledge.approve') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
          <button
            className={styles.approveBtn}
            disabled={busy}
            onClick={handleApprove}
            title={role === 'manager' ? 'Approve and notify Admin to publish' : 'Approve article'}
          >
            {role === 'manager' ? '✓ Approve (Notify Admin)' : '✓ Approve'}
          </button>
        )}
        {role !== 'staff' && can('knowledge.request_revision') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
          <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>Request Changes</button>
        )}
        {role !== 'staff' && can('knowledge.reject') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
          <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>Reject</button>
        )}
        {/* Approved Article - Admin Publish Authority Only */}
        {can('knowledge.publish') && role === 'admin' && article.status === 'approved' && (
          <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>🚀 Publish to Tenants</button>
        )}
        {/* Unpublish / Archive / Restore (Admin Only) */}
        {can('knowledge.unpublish') && role === 'admin' && article.status === 'published' && (
          <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowUnpublishModal(true)}>Unpublish</button>
        )}
        {can('knowledge.archive') && role === 'admin' && (article.status === 'published' || article.status === 'unpublished') && (
          <button className={styles.cancelBtn} disabled={busy} onClick={handleArchive}>📦 Retire (Archive)</button>
        )}
        {can('knowledge.restore') && role === 'admin' && article.status === 'archived' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleRestore}>🔄 Restore Article</button>
        )}
        {article.status === 'restored' && (
          <>
            {(role === 'admin' || role === 'manager' || article.authorId === user?.id) && (
              <button className={styles.approveBtn} disabled={busy} onClick={handleMoveToDraft} title="Move back to draft to edit and re-enter publishing cycle">
                📝 Move to Draft
              </button>
            )}
            {role === 'admin' && (
              <button className={styles.publishBtn} disabled={busy} onClick={handlePublish} title="Directly re-publish to tenants">
                🚀 Re-publish to Tenants
              </button>
            )}
          </>
        )}
        {can('knowledge.manage_versions') && (
          <button className={styles.submitBtn} disabled={busy} onClick={openVersionModal}>New Version</button>
        )}
        {((can('knowledge.delete') && role === 'admin') || (role === 'staff' && article.authorId === user?.id && article.status === 'draft')) && (
          <button className={styles.danger} disabled={busy} onClick={() => setDeleteTarget(true)}>Delete</button>
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

      {/* ── Request Revision Modal ── */}
      <Modal open={showRevisionModal} title="Request Changes / Revision" onClose={() => setShowRevisionModal(false)} maxWidth="580px">
        <div className={`${styles.modalNoticeBox} ${styles.warning}`}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Sending Back to Author</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              This article will transition to <strong>Needs Revision</strong> status. The author will be notified to review your notes and make corrections.
            </p>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Revision Notes <span className={styles.requiredStar}>*</span>
          </label>
          <textarea
            className={styles.formTextarea}
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            placeholder="Explain specifically what details, formatting, or corrections are needed..."
            rows={4}
          />
          <span className={styles.formHint}>Provide actionable guidance so the author can resolve issues quickly.</span>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryModalBtn} onClick={() => setShowRevisionModal(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryModalBtn}
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
            disabled={busy || !revisionReason.trim()}
            onClick={handleRequestRevision}
          >
            Submit Request
          </button>
        </div>
      </Modal>

      {/* ── Reject Article Modal ── */}
      <Modal open={showRejectModal} title="Reject Article" onClose={() => setShowRejectModal(false)} maxWidth="560px">
        <div className={`${styles.modalNoticeBox} ${styles.danger}`}>
          <span style={{ fontSize: '1.2rem' }}>🛑</span>
          <div>
            <strong>Reject Article Submission</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              This article will be marked as <strong>Rejected</strong> and removed from the active approval workflow.
            </p>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Rejection Reason <span className={styles.requiredStar}>*</span>
          </label>
          <textarea
            className={styles.formTextarea}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a clear explanation for rejecting this article..."
            rows={4}
          />
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryModalBtn} onClick={() => setShowRejectModal(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerModalBtn}
            disabled={busy || !rejectReason.trim()}
            onClick={handleReject}
          >
            Reject Article
          </button>
        </div>
      </Modal>

      {/* ── Unpublish Article Modal ── */}
      <Modal open={showUnpublishModal} title="Unpublish Article" onClose={() => setShowUnpublishModal(false)} maxWidth="560px">
        <div className={`${styles.modalNoticeBox} ${styles.warning}`}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Remove from Public Knowledge Base</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Tenants will no longer be able to search or view this article once unpublished.
            </p>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Reason for Unpublishing (Optional)</label>
          <textarea
            className={styles.formTextarea}
            value={unpublishReason}
            onChange={(e) => setUnpublishReason(e.target.value)}
            placeholder="e.g. Information is outdated; awaiting new software release..."
            rows={3}
          />
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryModalBtn} onClick={() => setShowUnpublishModal(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerModalBtn}
            disabled={busy}
            onClick={handleUnpublish}
          >
            Unpublish Article
          </button>
        </div>
      </Modal>

      {/* ── Create New Version Modal ── */}
      <Modal open={showVersionModal} title="Create New Version" onClose={() => setShowVersionModal(false)} maxWidth="680px">
        <div className={styles.modalSubheader}>
          <div className={styles.currentVersionBadge}>
            Current Version: <strong>v{article.version || '1.0'}</strong>
          </div>
          <p className={styles.modalIntro}>
            Create a new revision for this knowledge base article. The previous version will be preserved and accessible in version history.
          </p>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>
              Version Number <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.versionInputWrapper}>
              <span className={styles.versionPrefix}>v</span>
              <input
                className={styles.formInput}
                value={versionForm.versionNumber}
                onChange={(e) => setVersionForm({ ...versionForm, versionNumber: e.target.value })}
                placeholder="1.1"
              />
            </div>
            <span className={styles.formHint}>e.g. 1.1 or 2.0</span>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>
              Version Title <span className={styles.requiredStar}>*</span>
            </label>
            <input
              className={styles.formInput}
              value={versionForm.title}
              onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
              placeholder="Article version title"
            />
            <span className={styles.formHint}>Title displayed for this revision</span>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Article Content <span className={styles.requiredStar}>*</span>
          </label>
          <textarea
            className={styles.formTextarea}
            value={versionForm.content}
            onChange={(e) => setVersionForm({ ...versionForm, content: e.target.value })}
            rows={8}
            placeholder="Enter updated article content..."
          />
          <span className={styles.formHint}>Provide the updated body text and instructions.</span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Change Summary / Release Notes <span className={styles.requiredStar}>*</span>
          </label>
          <textarea
            className={styles.formTextarea}
            value={versionForm.changeSummary}
            onChange={(e) => setVersionForm({ ...versionForm, changeSummary: e.target.value })}
            rows={2}
            placeholder="Briefly describe what changed in this version (e.g. Added troubleshooting steps for Windows 11)"
          />
          <span className={styles.formHint}>A concise summary displayed in version comparison logs.</span>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryModalBtn}
            onClick={() => setShowVersionModal(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryModalBtn}
            disabled={busy || !versionForm.title.trim() || !versionForm.content.trim()}
            onClick={handleCreateVersion}
          >
            🚀 Create Version
          </button>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(false)} maxWidth="520px">
        <div className={`${styles.modalNoticeBox} ${styles.danger}`}>
          <span style={{ fontSize: '1.3rem' }}>🗑️</span>
          <div>
            <strong>Permanent Action</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Are you sure you want to delete <strong>"{article.title}"</strong>? This action cannot be undone and will remove all associated feedback and records.
            </p>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryModalBtn} onClick={() => setDeleteTarget(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerModalBtn}
            disabled={busy}
            onClick={handleDelete}
          >
            Delete Article
          </button>
        </div>
      </Modal>
    </div>
  );
}
