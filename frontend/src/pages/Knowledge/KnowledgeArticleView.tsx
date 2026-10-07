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
  fetchVersionById,
  createVersion,
  restoreArticleVersion,
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
import { RevisionThreadCard } from './components/RevisionThreadCard';
import { ManagerAssignRevisionModal } from './components/ManagerAssignRevisionModal';
import { printArticleAsPdf } from '../../utils/pdfExportUtils';
import styles from './KnowledgeArticleView.module.css';

import {
  DocumentTextIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  PencilSquareIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  BuildingOffice2Icon,
  UserIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  HashtagIcon,
  InformationCircleIcon,
  BookmarkSquareIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArchiveBoxIcon,
  SparklesIcon,
  ClockIcon,
  TagIcon,
  CheckIcon,
  ArrowUturnLeftIcon,
  DocumentIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  BookOpenIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const getStatusBadgeClass = (status: string) => {
  const normalized = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const key = `badge_${normalized}` as keyof typeof styles;
  return `${styles.badge} ${styles[key] || styles.badge_draft}`;
};

const formatTimeDuration = (ms: number): string => {
  if (ms <= 0) return '< 1 min';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return minutes > 0 ? `${minutes}m` : '< 1 min';
};

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
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [versionForm, setVersionForm] = useState({ versionNumber: '', title: '', content: '', changeSummary: '' });
  const [versionIsMajor, setVersionIsMajor] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedVersionSnapshot, setSelectedVersionSnapshot] = useState<ArticleVersion | null>(null);
  const [restoreVersionTarget, setRestoreVersionTarget] = useState<ArticleVersion | null>(null);
  const [restoreNotes, setRestoreNotes] = useState('');
  const [restoreIsMajor, setRestoreIsMajor] = useState(false);
  const [restorePublishLive, setRestorePublishLive] = useState(false);
  const [showManagerRevisionModal, setShowManagerRevisionModal] = useState(false);
  const [readingAttachment, setReadingAttachment] = useState<KnowledgeAttachment | null>(null);
  const [attachmentTextContent, setAttachmentTextContent] = useState<string | null>(null);
  const [attachmentLoadingText, setAttachmentLoadingText] = useState(false);
  const [showUnhelpfulModal, setShowUnhelpfulModal] = useState(false);
  const [feedbackReasonOption, setFeedbackReasonOption] = useState('Instructions are unclear or incomplete');
  const [feedbackCommentText, setFeedbackCommentText] = useState('');

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
  const handleManagerAssignRevision = async (articleId: string, managerComment: string) => {
    setShowManagerRevisionModal(false);
    await runAction(
      () => requestRevision(articleId, managerComment),
      'Revision assigned to Author with Admin feedback and Department Manager directions'
    );
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
  const handleRate = async (helpful: boolean, options?: { reason?: string; comment?: string }) => {
    if (!id || !article) return;
    const currentVote = article.userFeedback;
    const isSameVote = (helpful && currentVote === 'helpful') || (!helpful && currentVote === 'not_helpful' && !options?.reason && !options?.comment);
    if (isSameVote) {
      setMessage('You have already submitted this feedback for this article');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await rateArticle(id, helpful, options);
      const apiMsg = res?.data?.message || (article.hasVoted ? 'Your feedback has been updated' : 'Thanks for your feedback');
      setMessage(apiMsg);
      if (res?.data?.data) {
        setArticle(res.data.data);
      } else {
        await loadArticle();
      }
      setShowUnhelpfulModal(false);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setBusy(false);
    }
  };
  const openVersionModal = () => {
    if (!article) return;
    setVersionForm({
      versionNumber: '',
      title: article.title || '',
      content: article.content || '',
      changeSummary: '',
    });
    setVersionIsMajor(false);
    setShowVersionModal(true);
  };

  const handleCreateVersion = () => {
    setShowVersionModal(false);
    runAction(() => createVersion(id!, {
      ...versionForm,
      isMajor: versionIsMajor,
    }), 'Version created').then(async () => {
      setVersionForm({ versionNumber: '', title: '', content: '', changeSummary: '' });
      if (id) {
        const [aRes, vRes] = await Promise.all([fetchArticle(id), fetchVersions(id)]);
        setArticle(aRes.data.data);
        setVersions(vRes.data.data || []);
      }
    });
  };

  const handleConfirmRestore = async () => {
    if (!id || !restoreVersionTarget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await restoreArticleVersion(id, restoreVersionTarget.id, {
        isMajor: restoreIsMajor,
        changeSummary: restoreNotes.trim() || undefined,
        publishImmediately: restorePublishLive,
      });
      setMessage(res.data.message || `Restored version ${restoreVersionTarget.versionNumber} as new version`);
      setRestoreVersionTarget(null);
      setSelectedVersionSnapshot(null);
      setRestoreNotes('');
      setRestoreIsMajor(false);
      const [artRes, verRes] = await Promise.all([fetchArticle(id), fetchVersions(id)]);
      setArticle(artRes.data.data);
      setVersions(verRes.data.data || []);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to restore version');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadAttachment(id!, file);
      setMessage('Attachment uploaded successfully');
      const aRes = await fetchAttachments(id!);
      setAttachments(aRes.data.data || []);
    } catch {
      setError('Failed to upload attachment');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await runAction(() => deleteAttachment(id!, attachmentId), 'Attachment deleted');
    const aRes = await fetchAttachments(id!);
    setAttachments(aRes.data.data || []);
    if (readingAttachment?.id === attachmentId) {
      setReadingAttachment(null);
    }
  };

  const handleOpenReader = async (att: KnowledgeAttachment) => {
    setReadingAttachment(att);
    const fileName = att.fileName || att.file_name || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const rawPath = att.filePath || att.file_path || '';
    const filePath = rawPath.startsWith('http') || rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const isText = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'js', 'ts', 'html', 'css'].includes(ext);

    if (isText && filePath) {
      setAttachmentLoadingText(true);
      setAttachmentTextContent(null);
      try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error('Failed to load text');
        const text = await res.text();
        setAttachmentTextContent(text);
      } catch {
        setAttachmentTextContent('Failed to load file preview. Please download the file to view.');
      } finally {
        setAttachmentLoadingText(false);
      }
    } else {
      setAttachmentTextContent(null);
      setAttachmentLoadingText(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>Loading Knowledge Article...</span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className={styles.page}>
        <div className={styles.notFoundContainer}>
          <div className={styles.notFoundCard}>
            <div className={styles.notFoundIconWrapper}>
              <ExclamationTriangleIcon style={{ width: 36, height: 36 }} />
            </div>
            <h2 className={styles.notFoundTitle}>Article Not Found</h2>
            <p className={styles.notFoundDesc}>
              The knowledge base article you are looking for does not exist, has been removed, or is not accessible with your current permissions.
            </p>
            <div className={styles.notFoundActions}>
              <button
                type="button"
                className={styles.notFoundPrimaryBtn}
                onClick={() => navigate(basePath)}
              >
                <ArrowUturnLeftIcon style={{ width: 18, height: 18 }} />
                Back to Knowledge Base
              </button>
              <button
                type="button"
                className={styles.notFoundSecondaryBtn}
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTenant = role === 'tenant';
  const isAuthor = !isTenant && (
    article.authorId === user?.id ||
    (article as any)?.author_id === user?.id ||
    (article as any)?.created_by === user?.id
  );
  const isReviewer = !isTenant && (
    ['admin', 'ceo', 'manager'].includes(role || '') ||
    (article.reviewedBy === user?.id || (article as any)?.reviewed_by === user?.id) ||
    (article.approvedBy === user?.id || (article as any)?.approved_by === user?.id) ||
    can('knowledge.approve') ||
    can('knowledge.review') ||
    can('knowledge.request_revision') ||
    can('knowledge.update')
  );
  const canManageAttachments = !isTenant && (isAuthor || isReviewer || can('knowledge.create'));
  const canEdit = (role === 'admin' || role === 'manager' || (isAuthor && ['draft', 'needs_revision', 'restored'].includes(article.status))) && !isTenant;
  const statusBadgeClass = getStatusBadgeClass(article.status);

  // Computed Counts & Attributes for all dimensions
  const wordCount = article?.content ? article.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));
  const viewCount = article?.viewCount ?? (article as any)?.view_count ?? 0;
  const totalViews = viewCount;
  const tenantViews = article?.tenantViewCount ?? (article as any)?.tenant_view_count ?? 0;
  const staffViews = article?.staffViewCount ?? Math.max(0, totalViews - tenantViews);

  // Tenant Published Time & Exposure Duration Across All Statuses
  const isPublishedStatus = article.status === 'published';
  const hasPublishedAt = Boolean(article.publishedAt || (article as any).published_at);
  const isTenantScope = article.visibility === 'public' || article.visibility === 'tenant';

  let publishedDurationMs = 0;
  let publishedDurationText = '0 min';
  let tenantPublishStatusText = '';

  if (hasPublishedAt) {
    const pubDate = new Date(article.publishedAt || (article as any).published_at).getTime();
    if (isPublishedStatus) {
      publishedDurationMs = Math.max(0, Date.now() - pubDate);
      publishedDurationText = formatTimeDuration(publishedDurationMs);
      if (isTenantScope) {
        tenantPublishStatusText = `Live to tenants for ${publishedDurationText}`;
      } else {
        tenantPublishStatusText = `Restricted scope (${publishedDurationText} internal)`;
      }
    } else {
      const unpubDateRaw =
        article.unpublishedAt || (article as any).unpublished_at ||
        article.archivedAt || (article as any).archived_at ||
        article.updatedAt || (article as any).updated_at;
      const unpubDate = unpubDateRaw ? new Date(unpubDateRaw).getTime() : pubDate;
      publishedDurationMs = Math.max(0, unpubDate - pubDate);
      publishedDurationText = formatTimeDuration(publishedDurationMs);
      if (isTenantScope) {
        tenantPublishStatusText = `Was live to tenants for ${publishedDurationText}`;
      } else {
        tenantPublishStatusText = `Restricted window: ${publishedDurationText}`;
      }
    }
  } else {
    publishedDurationText = '0 min';
    tenantPublishStatusText = 'Never published to tenants';
  }

  const helpfulCount = article?.helpfulCount ?? (article as any)?.helpful_count ?? 0;
  const notHelpfulCount = article?.notHelpfulCount ?? (article as any)?.not_helpful_count ?? 0;
  const totalFeedback = helpfulCount + notHelpfulCount;
  const satisfactionRate = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0;
  const versionsCount = versions.length > 0 ? versions.length : (article?.version ? 1 : 0);
  const attachmentsCount = attachments.length;
  const tagsList = article?.tags ? article.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const tagsCount = tagsList.length;
  const articleRef = article?.articleReference || (article as any)?.article_reference || '—';
  const authorFullName = [article?.authorFirstName, article?.authorLastName].filter(Boolean).join(' ') ||
    (article as any)?.author_name ||
    article?.authorEmail ||
    (article?.authorId ? `User #${article.authorId.slice(0, 8)}` : 'System Admin');
  const departmentDisplayName = article?.departmentName || (article as any)?.department_name || (article?.departmentId ? 'Department Assigned' : 'Organization-Wide');

  return (
    <div className={styles.page}>
      <PageHeader title={article.title} backTo={basePath} />

      {/* ── Document Quick Actions Toolbar (PDF Export, Print, Edit) ── */}
      <div className={styles.docToolbar}>
        <div className={styles.docToolbarLeft}>
          <span className={styles.docRefChip}>📄 {articleRef}</span>
          <span className={styles.docCategoryChip}>
            {resolveCategoryIcon(article.category)} {article.category}
          </span>
          {article.departmentName && (
            <span className={styles.docDeptChip}>🏢 {article.departmentName}</span>
          )}
          <span
            className={styles.docVersionChip}
            title={`Article Version v${article.version || '1.0'}`}
          >
            🔖 v{article.version || '1.0'}
          </span>
        </div>
        <div className={styles.docToolbarRight}>
          <button
            type="button"
            className={styles.pdfDownloadBtn}
            onClick={() => printArticleAsPdf(article, attachments)}
            title="Download / Save Article as PDF"
          >
            <ArrowDownTrayIcon style={{ width: 16, height: 16 }} />
            Download as PDF
          </button>
          <button
            type="button"
            className={styles.printBtn}
            onClick={() => printArticleAsPdf(article, attachments)}
            title="Print Article Document"
          >
            <PrinterIcon style={{ width: 16, height: 16 }} />
            Print
          </button>
          {canEdit && (
            <button
              type="button"
              className={styles.editBtnTop}
              onClick={() => navigate(`${basePath}/${article.id}/edit`)}
              title="Edit this article"
            >
              <PencilSquareIcon style={{ width: 16, height: 16 }} />
              Edit Article
            </button>
          )}
        </div>
      </div>

      {message && <div className={styles.toast}>✓ {message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>⚠ {error}</div>}

      {/* ── Workflow Division Lifecycle Banners for ALL Statuses ── */}
      {!isTenant && article.status === 'draft' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusDraft}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>📝</div>
            <div>
              <div className={styles.workflowStatusTitle}>Stage 1: Contributor Draft</div>
              <div className={styles.workflowStatusDesc}>
                Authored by {authorFullName}. This article is currently in draft stage and not visible to tenants.
                {role === 'staff' && ' Submit for review once your content edits are completed.'}
                {role === 'admin' && ' As Admin, you can edit, approve, or directly publish this draft.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'pending_approval' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusPending}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>⏳</div>
            <div>
              <div className={styles.workflowStatusTitle}>
                {article.reviewedBy
                  ? 'Stage 2.5: Approved by Department Manager — Routed to Admin'
                  : 'Stage 2: Pending Department Manager Review (Not Routed to Admin Yet)'}
              </div>
              <div className={styles.workflowStatusDesc}>
                {article.reviewedBy
                  ? `Verified and approved by Department Manager (${article.reviewedFirstName || 'Manager'} ${article.reviewedLastName || ''}). Now routed to Central Administration for final verification & live publishing.`
                  : `Drafted by Staff (${article.authorFirstName || 'Staff'} ${article.authorLastName || ''}). By hierarchy, this article is routed to the Department Manager for review and cannot be reviewed or published by Admin until Department Manager approves.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'in_review' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusInReview}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>🔍</div>
            <div>
              <div className={styles.workflowStatusTitle}>Stage 2: Under Active Department Review</div>
              <div className={styles.workflowStatusDesc}>
                Department leadership is actively reviewing the procedural and technical content of this article.
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
                Published and active for tenant search, office staff, and department self-service resolution.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'unpublished' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusUnpublished}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>🔒</div>
            <div>
              <div className={styles.workflowStatusTitle}>Unpublished / Inactive Knowledge Article</div>
              <div className={styles.workflowStatusDesc}>
                Temporarily hidden from tenant search and self-service portal{article.unpublishedAt ? ` since ${new Date(article.unpublishedAt).toLocaleDateString()}` : ''}.
                {article.unpublishReason ? ` Reason: "${article.unpublishReason}".` : ''} Admins can re-publish or retire anytime.
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

      {!isTenant && article.status === 'rejected' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusRejected}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>✕</div>
            <div>
              <div className={styles.workflowStatusTitle}>Article Rejected</div>
              <div className={styles.workflowStatusDesc}>
                This article was rejected by management{article.rejectedAt ? ` on ${new Date(article.rejectedAt).toLocaleDateString()}` : ''}.
                {article.rejectionReason ? ` Reason: "${article.rejectionReason}".` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'archived' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusArchived}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>📦</div>
            <div>
              <div className={styles.workflowStatusTitle}>Archived / Retired Record</div>
              <div className={styles.workflowStatusDesc}>
                This article has been decommissioned from active workflows{article.archivedAt ? ` on ${new Date(article.archivedAt).toLocaleDateString()}` : ''}. Admins can restore it if required.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTenant && article.status === 'restored' && (
        <div className={`${styles.workflowStatusCard} ${styles.workflowStatusRestored}`}>
          <div className={styles.workflowStatusContent}>
            <div className={styles.workflowStatusIcon}>🔄</div>
            <div>
              <div className={styles.workflowStatusTitle}>Restored Knowledge Article</div>
              <div className={styles.workflowStatusDesc}>
                Restored from archives. You can move it to Draft to revise content or directly re-publish it to tenants.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Metadata Hero Card ── */}
      <div className={styles.metaCard}>
        <div className={styles.metaHeader}>
          <div className={styles.metaHeaderTitle}>
            <InformationCircleIcon style={{ width: '18px', height: '18px', color: '#3b82f6' }} />
            <span>Article Specifications</span>
          </div>
          <span className={statusBadgeClass}>
            {article.status === 'restored' && <ArrowPathIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'published' && <CheckCircleIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'pending_approval' && <ClockIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'needs_revision' && <ExclamationTriangleIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'unpublished' && <EyeSlashIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'archived' && <ArchiveBoxIcon style={{ width: '13px', height: '13px' }} />}
            {article.status === 'pending_approval'
              ? (article.reviewedBy ? 'Pending Review for Admin' : 'Pending Dept Review')
              : article.status?.replace(/_/g, ' ')}
          </span>
        </div>

        <div className={styles.metaGrid}>
          {/* Reference */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <HashtagIcon className={styles.labelIcon} />
              Reference
            </span>
            <span className={styles.value}>{articleRef}</span>
            <span className={styles.subValue}>System tracking ID</span>
          </div>

          {/* Version */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <TagIcon className={styles.labelIcon} />
              Version
            </span>
            <span className={styles.value}>v{article.version || '1.0'}</span>
            <span className={styles.subValue}>{versionsCount > 1 ? `${versionsCount} recorded versions` : 'v1.0 release'}</span>
          </div>

          {/* Category */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <SparklesIcon className={styles.labelIcon} />
              Category
            </span>
            <span className={styles.value}>
              <span style={{ marginRight: 4 }}>{resolveCategoryIcon(article.category)}</span>
              {article.category || 'General'}
            </span>
            <span className={styles.subValue}>Selected category</span>
          </div>

          {/* Visibility */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <EyeIcon className={styles.labelIcon} />
              Visibility
            </span>
            <span className={styles.value} style={{ textTransform: 'capitalize' }}>
              {article.visibility === 'restricted'
                ? '🔒 Restricted'
                : article.visibility === 'internal'
                ? '👥 Internal'
                : article.visibility === 'department'
                ? '🏢 Department'
                : article.visibility === 'public'
                ? '🌐 Public'
                : article.visibility || 'Internal'}
            </span>
            <span className={styles.subValue}>
              {article.visibility === 'restricted'
                ? 'Author private draft'
                : article.visibility === 'internal'
                ? 'Author & Dept Manager'
                : article.visibility === 'department'
                ? 'All Department Staff & Admin'
                : article.visibility === 'public' || article.visibility === 'tenant'
                ? 'Open to tenants & portal'
                : 'Restricted scope'}
            </span>
          </div>

          {/* Department */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <BuildingOffice2Icon className={styles.labelIcon} />
              Department
            </span>
            <span className={styles.value}>{departmentDisplayName}</span>
            <span className={styles.subValue}>Operating unit</span>
          </div>

          {/* Author */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <UserIcon className={styles.labelIcon} />
              Author
            </span>
            <span className={styles.value}>{authorFullName}</span>
            <span className={styles.subValue}>{article.authorRole ? `Role: ${article.authorRole}` : 'Article author'}</span>
          </div>

          {/* Views Count */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <EyeIcon className={styles.labelIcon} />
              Views
            </span>
            {isTenant ? (
              <>
                <span className={styles.value}>{totalViews.toLocaleString()}</span>
                <span className={styles.subValue}>
                  {totalViews === 1 ? '1 total view' : `${totalViews.toLocaleString()} total views`}
                </span>
              </>
            ) : (
              <>
                <span className={styles.value} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <span className={styles.viewsHighlight}>
                    {tenantViews.toLocaleString()}
                  </span>
                  <span className={styles.viewsSubTag}>
                    tenant {tenantViews === 1 ? 'read' : 'reads'}
                  </span>
                </span>
                <span className={styles.subValue}>
                  {totalViews.toLocaleString()} total ({staffViews} internal / staff)
                </span>
                <span
                  className={styles.viewsStatusRow}
                  style={{
                    color: isPublishedStatus && isTenantScope ? '#38bdf8' : !isTenantScope ? '#f59e0b' : '#94a3b8',
                  }}
                >
                  <ClockIcon style={{ width: 11, height: 11, flexShrink: 0 }} />
                  <span>{tenantPublishStatusText}</span>
                </span>
              </>
            )}
          </div>

          {/* Feedback Counts */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <HandThumbUpIcon className={styles.labelIcon} />
              Feedback
            </span>
            <span className={styles.value}>
              👍 {helpfulCount} &nbsp; 👎 {notHelpfulCount}
            </span>
            <span className={styles.subValue}>
              {totalFeedback > 0 ? `${totalFeedback} ratings (${satisfactionRate}% helpful)` : '0 ratings'}
            </span>
          </div>

          {/* Word Count */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <DocumentTextIcon className={styles.labelIcon} />
              Word Count
            </span>
            <span className={styles.value}>{wordCount.toLocaleString()} words</span>
            <span className={styles.subValue}>~{readTimeMin} min read duration</span>
          </div>

          {/* Attachments Count */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <PaperClipIcon className={styles.labelIcon} />
              Attachments
            </span>
            <span className={styles.value}>{attachmentsCount}</span>
            <span className={styles.subValue}>{attachmentsCount === 1 ? '1 file attached' : `${attachmentsCount} files attached`}</span>
          </div>

          {/* Revisions Count */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <ClockIcon className={styles.labelIcon} />
              Revisions
            </span>
            <span className={styles.value}>{versionsCount}</span>
            <span className={styles.subValue}>{versionsCount > 1 ? `${versionsCount} recorded versions` : 'Initial draft'}</span>
          </div>

          {/* Tags */}
          <div className={styles.metaItem}>
            <span className={styles.label}>
              <TagIcon className={styles.labelIcon} />
              Tags
            </span>
            <span className={styles.value}>{tagsCount > 0 ? `${tagsCount} tags` : 'None'}</span>
            <span className={styles.subValue}>{tagsCount > 0 ? tagsList.slice(0, 2).join(', ') : 'No tags'}</span>
          </div>
        </div>

        {/* ── Status Milestones & Audit Check ── */}
        {!isTenant && (
          <div className={styles.milestonesSection}>
            <div className={styles.milestonesTitle}>
              <ShieldCheckIcon style={{ width: 14, height: 14, color: '#3b82f6' }} />
              <span>Status Check & Lifecycle Milestones</span>
            </div>
            <div className={styles.milestonesGrid}>
              <div className={styles.milestonePill}>
                <span className={styles.milestoneLabel}>
                  <CalendarIcon style={{ width: 12, height: 12 }} /> Created
                </span>
                <span className={styles.milestoneValue}>
                  {article.createdAt || (article as any).created_at
                    ? new Date(article.createdAt || (article as any).created_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>

              {(article.approvedAt || (article as any).approved_at) && (
                <div className={styles.milestonePill}>
                  <span className={styles.milestoneLabel} style={{ color: '#10b981' }}>
                    <CheckCircleIcon style={{ width: 12, height: 12 }} /> Approved
                  </span>
                  <span className={styles.milestoneValue}>
                    {new Date(article.approvedAt || (article as any).approved_at).toLocaleDateString()}
                    {article.approvedFirstName ? ` by ${article.approvedFirstName}` : ''}
                  </span>
                </div>
              )}

              {(article.publishedAt || (article as any).published_at) && (
                <div className={styles.milestonePill}>
                  <span className={styles.milestoneLabel} style={{ color: '#06b6d4' }}>
                    <CheckCircleIcon style={{ width: 12, height: 12 }} /> Published
                  </span>
                  <span className={styles.milestoneValue}>
                    {new Date(article.publishedAt || (article as any).published_at).toLocaleDateString()}
                    {article.publishedFirstName ? ` by ${article.publishedFirstName}` : ''}
                  </span>
                </div>
              )}

              {(article.unpublishedAt || (article as any).unpublished_at) && (
                <div className={styles.milestonePill}>
                  <span className={styles.milestoneLabel} style={{ color: '#f59e0b' }}>
                    <EyeSlashIcon style={{ width: 12, height: 12 }} /> Unpublished
                  </span>
                  <span className={styles.milestoneValue}>
                    {new Date(article.unpublishedAt || (article as any).unpublished_at).toLocaleDateString()}
                    {article.unpublishReason ? ` (${article.unpublishReason})` : ''}
                  </span>
                </div>
              )}

              {(article.rejectedAt || (article as any).rejected_at) && (
                <div className={styles.milestonePill}>
                  <span className={styles.milestoneLabel} style={{ color: '#ef4444' }}>
                    <XCircleIcon style={{ width: 12, height: 12 }} /> Rejected
                  </span>
                  <span className={styles.milestoneValue}>
                    {new Date(article.rejectedAt || (article as any).rejected_at).toLocaleDateString()}
                    {article.rejectedFirstName ? ` by ${article.rejectedFirstName}` : ''}
                  </span>
                </div>
              )}

              {(article.archivedAt || (article as any).archived_at) && (
                <div className={styles.milestonePill}>
                  <span className={styles.milestoneLabel} style={{ color: '#64748b' }}>
                    <ArchiveBoxIcon style={{ width: 12, height: 12 }} /> Archived
                  </span>
                  <span className={styles.milestoneValue}>
                    {new Date(article.archivedAt || (article as any).archived_at).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className={styles.milestonePill}>
                <span className={styles.milestoneLabel}>
                  <ArrowPathIcon style={{ width: 12, height: 12 }} /> Last Modified
                </span>
                <span className={styles.milestoneValue}>
                  {article.updatedAt || (article as any).updated_at
                    ? new Date(article.updatedAt || (article as any).updated_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>

              {/* Published Duration to Tenants Milestone */}
              <div className={styles.milestonePill}>
                <span
                  className={styles.milestoneLabel}
                  style={{ color: isPublishedStatus && isTenantScope ? '#38bdf8' : hasPublishedAt ? '#a855f7' : '#94a3b8' }}
                >
                  <ClockIcon style={{ width: 12, height: 12 }} /> Published Time to Tenants
                </span>
                <span className={styles.milestoneValue}>
                  {isPublishedStatus && isTenantScope
                    ? `🟢 ${publishedDurationText} active to tenants`
                    : isPublishedStatus && !isTenantScope
                    ? `🔒 Restricted scope (${publishedDurationText} internal)`
                    : hasPublishedAt && isTenantScope
                    ? `⏱️ ${publishedDurationText} published window (${tenantViews} tenant reads)`
                    : hasPublishedAt && !isTenantScope
                    ? `🔒 Restricted scope (${publishedDurationText} window)`
                    : '⚪ Not yet published to tenants'}
                </span>
              </div>

              {/* Reader Distribution Milestone */}
              <div className={styles.milestonePill}>
                <span className={styles.milestoneLabel} style={{ color: '#06b6d4' }}>
                  <EyeIcon style={{ width: 12, height: 12 }} /> Reader Distribution
                </span>
                <span className={styles.milestoneValue}>
                  {tenantViews} tenant reads &bull; {totalViews} total views ({staffViews} internal)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Callout ── */}
      {article.summary && (
        <div className={styles.summary}>
          <InformationCircleIcon className={styles.summaryIcon} />
          <div>{article.summary}</div>
        </div>
      )}

      {/* ── Content Card ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <DocumentTextIcon className={styles.sectionTitleIcon} />
            <h3 className={styles.sectionHeading}>Article Content</h3>
          </div>
          <span className={styles.sectionCountBadge}>Procedures & Instructions</span>
        </div>
        <div className={styles.articleBody}>{article.content}</div>
      </section>

      {/* ── Rejection & Revision Notes ── */}
      {!isTenant && article.rejectionReason && (
        <div className={styles.rejectionBox}>
          <XCircleIcon style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Rejection Reason:</strong> {article.rejectionReason}
          </div>
        </div>
      )}
      {!isTenant && article.revisionNotes && (
        <RevisionThreadCard revisionNotes={article.revisionNotes} />
      )}

      {/* ── Attachments Stream ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <PaperClipIcon className={styles.sectionTitleIcon} style={{ color: '#6366f1' }} />
            <h4 className={styles.sectionHeading}>Attachments ({attachments.length})</h4>
          </div>
          {canManageAttachments && (
            <label className={styles.uploadBtn}>
              <ArrowUpTrayIcon className={styles.uploadIcon} />
              <span>Upload Attachment</span>
              <input type="file" hidden onChange={handleUploadAttachment} />
            </label>
          )}
        </div>

        <div className={styles.attachmentList}>
          {attachments.map((att) => {
            const fileName = att.fileName || att.file_name || 'Attachment';
            const rawPath = att.filePath || att.file_path || '';
            const filePath = rawPath.startsWith('http') || rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
            const fileSize = att.fileSize ?? att.file_size ?? null;
            const ext = (att.fileExtension || att.file_extension || fileName.split('.').pop() || '').toLowerCase();
            const uploaderName = (att.uploaderFirstName || att.uploaderLastName)
              ? `${att.uploaderFirstName || ''} ${att.uploaderLastName || ''}`.trim()
              : null;

            return (
              <div key={att.id} className={styles.attachmentItem}>
                <div className={styles.attachmentInfo}>
                  <div className={`${styles.attachmentIconBadge} ${styles[`ext_${ext}`] || styles.ext_generic}`}>
                    {['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? (
                      <PhotoIcon className={styles.attachmentFileIcon} />
                    ) : ext === 'pdf' ? (
                      <DocumentTextIcon className={styles.attachmentFileIcon} />
                    ) : (
                      <DocumentIcon className={styles.attachmentFileIcon} />
                    )}
                  </div>
                  <div className={styles.attachmentDetails}>
                    <button
                      type="button"
                      className={styles.attachmentTitleBtn}
                      onClick={() => handleOpenReader(att)}
                      title={`Click to read/open ${fileName} in app`}
                    >
                      {fileName}
                    </button>
                    <div className={styles.attachmentSubMeta}>
                      <span className={styles.attachmentBadge}>{ext.toUpperCase()}</span>
                      {fileSize ? (
                        <span className={styles.attachmentSize}>
                          {(fileSize / 1024).toFixed(1)} KB
                        </span>
                      ) : null}
                      {uploaderName && (
                        <span className={styles.attachmentUploader}>Uploaded by {uploaderName}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.attachmentActions}>
                  <button
                    type="button"
                    className={styles.readBtn}
                    onClick={() => handleOpenReader(att)}
                    title={`Open and read ${fileName} in app`}
                  >
                    <BookOpenIcon style={{ width: 14, height: 14 }} />
                    <span>Read in App</span>
                  </button>

                  <a
                    href={filePath}
                    download={fileName}
                    className={styles.downloadBtn}
                    title={`Download ${fileName}`}
                  >
                    <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
                    <span>Download</span>
                  </a>

                  {canManageAttachments && (
                    <button
                      type="button"
                      className={styles.deleteAttachmentBtn}
                      onClick={() => handleDeleteAttachment(att.id)}
                      title={`Delete ${fileName}`}
                    >
                      <TrashIcon style={{ width: 13, height: 13 }} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!attachments.length && (
            <div className={styles.emptyState}>
              <PaperClipIcon className={styles.emptyStateIcon} />
              <span className={styles.emptyStateText}>No attachments uploaded for this article</span>
              {canManageAttachments && (
                <span style={{ fontSize: '0.78rem', color: 'var(--kb-text-muted)' }}>
                  Authors and reviewers can upload relevant procedures, guidelines, or reference files.
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Related Articles Section ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <BookmarkSquareIcon className={styles.sectionTitleIcon} style={{ color: '#06b6d4' }} />
            <h4 className={styles.sectionHeading}>Related Articles</h4>
          </div>
          <span className={styles.sectionCountBadge}>{related.length} Recommended</span>
        </div>

        <div className={styles.relatedList}>
          {related.map((r) => (
            <div key={r.id} className={styles.relatedItem} onClick={() => navigate(`${basePath}/${r.id}`)}>
              <div className={styles.relatedItemContent}>
                <span className={styles.relatedTitle}>{r.title}</span>
                <span className={styles.relatedRef}>{r.articleReference}</span>
              </div>
              <ArrowRightIcon className={styles.relatedArrow} />
            </div>
          ))}
          {!related.length && (
            <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
              <BookmarkSquareIcon className={styles.emptyStateIcon} />
              <span className={styles.emptyStateText}>No related articles found</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Modern Actions Command Toolbar ── */}
      <div className={styles.actionsBar}>
        {!isTenant && canEdit && (
          <button className={styles.editBtn} onClick={() => navigate(`${basePath}/${id}/edit`)}>
            <PencilSquareIcon className={styles.btnIcon} />
            <span>Edit Article</span>
          </button>
        )}

        {!isTenant && (article.status === 'draft' || article.status === 'needs_revision') && (
          (article.authorId === user?.id && can('knowledge.submit')) || role === 'manager'
        ) && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleSubmit}>
            <PaperAirplaneIcon className={styles.btnIcon} />
            <span>
              {article.status === 'needs_revision'
                ? (role === 'manager' ? 'Re-submit to Admin' : 'Re-route to Dept Manager')
                : (role === 'manager' ? 'Submit to Admin for Approval' : 'Route to Department Manager')}
            </span>
          </button>
        )}

        {/* Admin Direct Draft Controls */}
        {role === 'admin' && article.status === 'draft' && (
          <>
            <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
              <CheckCircleIcon className={styles.btnIcon} />
              <span>Publish to Tenants</span>
            </button>
            <button className={styles.approveBtn} disabled={busy} onClick={handleApprove}>
              <CheckIcon className={styles.btnIcon} />
              <span>Approve Draft</span>
            </button>
          </>
        )}

        {/* Pending Approval Controls for Admin */}
        {role === 'admin' && article.status === 'pending_approval' && (
          <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
            <CheckCircleIcon className={styles.btnIcon} />
            <span>Publish to Tenants</span>
          </button>
        )}

        {/* Hierarchy Approval Actions on pending_approval:
            1. Unreviewed Staff article: routed to Department Manager ONLY. Admin sees waiting notice.
            2. Manager-approved article: routed to Admin for publishing. Manager sees sign-off badge. */}
        {role === 'manager' && article.status === 'pending_approval' && !article.reviewedBy && article.authorId !== user?.id && (
          <>
            <button
              className={styles.approveBtn}
              disabled={busy}
              onClick={handleApprove}
              title="Verify article and route to Admin for final review & publishing"
            >
              <CheckIcon className={styles.btnIcon} />
              <span>✓ Approve & Route to Admin</span>
            </button>
            <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>
              <ExclamationTriangleIcon className={styles.btnIcon} style={{ color: '#f59e0b' }} />
              <span>Request Changes</span>
            </button>
            <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>
              <XCircleIcon className={styles.btnIcon} />
              <span>Reject Article</span>
            </button>
          </>
        )}

        {role === 'admin' && article.status === 'pending_approval' && !article.reviewedBy && (
          <div className={styles.hierarchyWaitingNotice}>
            <span>⏳ In Hierarchy: Awaiting Department Manager Approval before Admin Route</span>
          </div>
        )}

        {role === 'manager' && article.status === 'pending_approval' && article.reviewedBy && (
          <div className={styles.hierarchyWaitingNotice} style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>
            <span>✓ Approved by Department Manager — Routed to Admin for Publishing</span>
          </div>
        )}

        {role === 'admin' && article.status === 'pending_approval' && article.reviewedBy && (
          <>
            <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
              <CheckCircleIcon className={styles.btnIcon} />
              <span>Publish to Tenants</span>
            </button>
            <button className={styles.approveBtn} disabled={busy} onClick={handleApprove}>
              <CheckIcon className={styles.btnIcon} />
              <span>Approve Article</span>
            </button>
            <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>
              <ExclamationTriangleIcon className={styles.btnIcon} style={{ color: '#f59e0b' }} />
              <span>Request Changes</span>
            </button>
            <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>
              <XCircleIcon className={styles.btnIcon} />
              <span>Reject Article</span>
            </button>
          </>
        )}

        {/* Needs Revision Lifecycle Controls */}
        {article.status === 'needs_revision' && (
          <>
            {role === 'manager' && article.authorId !== user?.id && (
              <button
                className={styles.approveBtn}
                style={{ background: 'linear-gradient(135deg, #d97706, #ea580c)', color: '#ffffff' }}
                disabled={busy}
                onClick={() => setShowManagerRevisionModal(true)}
                title="Check Admin comments and assign revision to the Author with Manager directions"
              >
                <ExclamationTriangleIcon className={styles.btnIcon} />
                <span>Check & Assign to Author</span>
              </button>
            )}

            {article.authorId === user?.id && (
              <button
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => navigate(`${basePath}/${article.id}/edit`)}
                title="Update article content and submit new version to Department Manager"
              >
                <PencilSquareIcon className={styles.btnIcon} />
                <span>Update & Submit to Manager</span>
              </button>
            )}

            {role === 'admin' && (
              <>
                <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
                  <CheckCircleIcon className={styles.btnIcon} />
                  <span>Publish to Tenants</span>
                </button>
                <button className={styles.approveBtn} disabled={busy} onClick={handleApprove}>
                  <CheckIcon className={styles.btnIcon} />
                  <span>Approve Article</span>
                </button>
                <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>
                  <ExclamationTriangleIcon className={styles.btnIcon} style={{ color: '#f59e0b' }} />
                  <span>Request Changes Again</span>
                </button>
                <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>
                  <XCircleIcon className={styles.btnIcon} />
                  <span>Reject</span>
                </button>
              </>
            )}
          </>
        )}

        {/* Approved Article - Admin Publish Authority & Revisions */}
        {role === 'admin' && article.status === 'approved' && (
          <>
            <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
              <CheckCircleIcon className={styles.btnIcon} />
              <span>Publish to Tenants</span>
            </button>
            <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowRevisionModal(true)}>
              <ExclamationTriangleIcon className={styles.btnIcon} style={{ color: '#f59e0b' }} />
              <span>Request Changes</span>
            </button>
            <button className={styles.danger} disabled={busy} onClick={() => setShowRejectModal(true)}>
              <XCircleIcon className={styles.btnIcon} />
              <span>Reject</span>
            </button>
          </>
        )}

        {/* Unpublish / Archive / Restore (Admin Only) */}
        {can('knowledge.unpublish') && role === 'admin' && article.status === 'published' && (
          <button className={styles.cancelBtn} disabled={busy} onClick={() => setShowUnpublishModal(true)}>
            <EyeSlashIcon className={styles.btnIcon} />
            <span>Unpublish</span>
          </button>
        )}

        {/* Actions for Unpublished Articles */}
        {role === 'admin' && article.status === 'unpublished' && (
          <>
            <button className={styles.publishBtn} disabled={busy} onClick={handlePublish}>
              <CheckCircleIcon className={styles.btnIcon} />
              <span>Re-publish to Tenants</span>
            </button>
            <button
              className={styles.approveBtn}
              disabled={busy}
              onClick={handleMoveToDraft}
              title="Move back to draft to edit and re-enter publishing cycle"
            >
              <ArrowUturnLeftIcon className={styles.btnIcon} />
              <span>Move to Draft</span>
            </button>
          </>
        )}

        {can('knowledge.archive') && role === 'admin' && (article.status === 'published' || article.status === 'unpublished') && (
          <button className={styles.cancelBtn} disabled={busy} onClick={handleArchive}>
            <ArchiveBoxIcon className={styles.btnIcon} />
            <span>Retire (Archive)</span>
          </button>
        )}

        {can('knowledge.restore') && role === 'admin' && article.status === 'archived' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleRestore}>
            <ArrowPathIcon className={styles.btnIcon} />
            <span>Restore Article</span>
          </button>
        )}

        {article.status === 'restored' && (
          <>
            {(role === 'admin' || role === 'manager' || article.authorId === user?.id) && (
              <button
                className={styles.approveBtn}
                disabled={busy}
                onClick={handleMoveToDraft}
                title="Move back to draft to edit and re-enter publishing cycle"
              >
                <ArrowUturnLeftIcon className={styles.btnIcon} />
                <span>Move to Draft</span>
              </button>
            )}
            {role === 'admin' && (
              <button
                className={styles.publishBtn}
                disabled={busy}
                onClick={handlePublish}
                title="Directly re-publish to tenants"
              >
                <CheckCircleIcon className={styles.btnIcon} />
                <span>Re-publish to Tenants</span>
              </button>
            )}
          </>
        )}

        {can('knowledge.manage_versions') && (
          <button className={styles.newVersionBtn} disabled={busy} onClick={openVersionModal}>
            <DocumentDuplicateIcon className={styles.btnIcon} />
            <span>New Version</span>
          </button>
        )}

        {((can('knowledge.delete') && role === 'admin') || (role === 'staff' && article.authorId === user?.id && article.status === 'draft')) && (
          <button className={styles.danger} disabled={busy} onClick={() => setDeleteTarget(true)}>
            <TrashIcon className={styles.btnIcon} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* ── Versions Accordion Section ── */}
      {!isTenant && can('knowledge.view_versions') && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <TagIcon className={styles.sectionTitleIcon} style={{ color: '#8b5cf6' }} />
              <h4 className={styles.sectionHeading}>Version History ({versions.length})</h4>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className={styles.cancelBtn}
                onClick={() => navigate(`${basePath}/${id}/versions`)}
                title="Open dedicated version timeline view"
              >
                <span>Full Timeline</span>
                <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14, marginLeft: 4 }} />
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowVersions(!showVersions)}>
                <span>{showVersions ? 'Hide Versions' : 'View Versions'}</span>
              </button>
            </div>
          </div>

          {showVersions && (
            <div className={styles.versionList}>
              {versions.map((v) => (
                <div key={v.id} className={styles.versionItem}>
                  <div className={styles.versionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={styles.versionBadge}>v{v.versionNumber}</span>
                      {v.publishedAt && (
                        <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Published
                        </span>
                      )}
                    </div>
                    <span className={styles.versionDate}>
                      {new Date(v.createdAt).toLocaleDateString()} at {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <strong style={{ color: 'var(--kb-text-primary)', fontSize: '0.94rem' }}>{v.title}</strong>
                  {v.changeSummary && (
                    <span className={styles.versionSummary} style={{ color: 'var(--kb-text-secondary)', fontSize: '0.84rem' }}>
                      Changes: {v.changeSummary}
                    </span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--kb-text-muted)' }}>
                      Author: {[v.creatorFirstName, v.creatorLastName].filter(Boolean).join(' ') || v.createdBy?.slice(0, 8) || '—'}
                      {v.approvedAt && ` · Approved by ${[v.approverFirstName, v.approverLastName].filter(Boolean).join(' ') || 'Admin'}`}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className={styles.cancelBtn}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => setSelectedVersionSnapshot(v)}
                        title="View complete snapshot of this version"
                      >
                        <EyeIcon style={{ width: 13, height: 13, marginRight: 4 }} />
                        <span>View Snapshot</span>
                      </button>
                      {(role === 'admin' || role === 'manager') && (
                        <button
                          className={styles.approveBtn}
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => {
                            setRestoreVersionTarget(v);
                            setRestoreNotes(`Restored from version ${v.versionNumber}`);
                            setRestoreIsMajor(false);
                            setRestorePublishLive(article?.status === 'published');
                          }}
                          title="Restore this version as a new version snapshot"
                        >
                          <ArrowPathIcon style={{ width: 13, height: 13, marginRight: 4 }} />
                          <span>Restore as New</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!versions.length && (
                <div className={styles.emptyState}>
                  <TagIcon className={styles.emptyStateIcon} />
                  <span className={styles.emptyStateText}>No previous versions recorded</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Feedback Section (Available for published articles) ── */}
      {article.status === 'published' && (isTenant || can('knowledge.rate')) && (
        <div className={styles.feedbackSection}>
          <div className={styles.feedbackHeaderBox}>
            <h4 className={styles.feedbackHeading}>Was this article helpful?</h4>
            {article.hasVoted && (
              <span className={article.userFeedback === 'helpful' ? styles.feedbackBadgeHelpful : styles.feedbackBadgeNotHelpful}>
                {article.userFeedback === 'helpful' ? '👍 Helpful Recorded' : '👎 Not Helpful Recorded'}
              </span>
            )}
          </div>
          <p className={styles.feedbackSubtext}>
            {article.hasVoted
              ? 'Your feedback is registered (1 vote counted). You can switch your rating or keep it as is.'
              : 'Let us know if this article was useful to help improve our knowledge base.'}
          </p>
          <div className={styles.feedbackBtns}>
            <button
              type="button"
              className={`${styles.feedbackThumbBtn} ${article.userFeedback === 'helpful' ? styles.feedbackThumbActiveHelpful : ''}`}
              onClick={() => handleRate(true)}
              disabled={busy}
              title={article.userFeedback === 'helpful' ? 'You voted helpful' : 'Vote yes, helpful'}
            >
              <HandThumbUpIcon className={styles.btnIcon} style={{ color: '#10b981' }} />
              <span>{article.userFeedback === 'helpful' ? '✓ Helpful (Your Vote)' : 'Yes, Helpful'}</span>
            </button>
            <button
              type="button"
              className={`${styles.feedbackThumbBtn} ${article.userFeedback === 'not_helpful' ? styles.feedbackThumbActiveNotHelpful : ''}`}
              onClick={() => {
                if (article.userFeedback === 'not_helpful') {
                  setMessage('You have already submitted this feedback for this article');
                } else {
                  setShowUnhelpfulModal(true);
                }
              }}
              disabled={busy}
              title={article.userFeedback === 'not_helpful' ? 'You voted not helpful' : 'Vote not helpful'}
            >
              <HandThumbDownIcon className={styles.btnIcon} style={{ color: '#ef4444' }} />
              <span>{article.userFeedback === 'not_helpful' ? '✓ Not Helpful (Your Vote)' : 'Not Helpful'}</span>
            </button>
          </div>
          {article.hasVoted && (
            <div className={styles.feedbackNoticeRecorded}>
              <span>ℹ️ One user can only submit one rating per article. Repeated clicks will not increment the feedback count.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Unhelpful Feedback Modal ── */}
      <Modal open={showUnhelpfulModal} title="👎 Reader Feedback & Improvement" onClose={() => setShowUnhelpfulModal(false)} maxWidth="540px">
        <div className={`${styles.modalNoticeBox} ${styles.modalNoticeWarning}`}>
          <span style={{ fontSize: '1.2rem' }}>💡</span>
          <div>
            <strong>Help Us Improve This Article</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
              Tell us why this article was not helpful so our editors and authors can update what needs to be changed.
            </p>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>What issue did you encounter?</label>
          <select
            className={styles.formSelect}
            value={feedbackReasonOption}
            onChange={(e) => setFeedbackReasonOption(e.target.value)}
          >
            <option value="Instructions are unclear or incomplete">Instructions are unclear or incomplete</option>
            <option value="Information is outdated or no longer accurate">Information is outdated or no longer accurate</option>
            <option value="Missing steps or prerequisites">Missing steps or prerequisites</option>
            <option value="Did not resolve my issue">Did not resolve my issue</option>
            <option value="Formatting issues or broken links">Formatting issues or broken links</option>
            <option value="Other feedback">Other feedback</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>What should be changed? (Optional)</label>
          <textarea
            className={styles.formTextarea}
            value={feedbackCommentText}
            onChange={(e) => setFeedbackCommentText(e.target.value)}
            rows={3}
            placeholder="E.g. Step 3 is missing required credentials or links, please update..."
          />
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryModalBtn}
            onClick={() => handleRate(false, { reason: feedbackReasonOption })}
            disabled={busy}
          >
            Skip Comment & Submit Vote
          </button>
          <button
            type="button"
            className={styles.primaryModalBtn}
            onClick={() => handleRate(false, { reason: feedbackReasonOption, comment: feedbackCommentText })}
            disabled={busy}
          >
            Submit Feedback
          </button>
        </div>
      </Modal>

      {/* ── Request Revision Modal ── */}
      <Modal open={showRevisionModal} title="Request Changes / Revision" onClose={() => setShowRevisionModal(false)} maxWidth="580px">
        <div className={`${styles.modalNoticeBox} ${styles.modalNoticeWarning}`}>
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
        <div className={`${styles.modalNoticeBox} ${styles.modalNoticeDanger}`}>
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
        <div className={`${styles.modalNoticeBox} ${styles.modalNoticeWarning}`}>
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
            Create a new revision for this knowledge base article. Version numbers are automatically generated by the backend and previous versions remain permanently preserved.
          </p>
        </div>

        <div className={styles.formGroup}>
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
            placeholder="Briefly describe what changed in this version..."
          />
          <span className={styles.formHint}>A concise summary displayed in version comparison logs.</span>
        </div>

        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--kb-text-primary)' }}>
            <input
              type="checkbox"
              checked={versionIsMajor}
              onChange={(e) => setVersionIsMajor(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2563eb' }}
            />
            <span><strong>Major Version Update</strong> (e.g. generates v2.0 instead of minor increment)</span>
          </label>
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

      {/* ── View Version Snapshot Modal ── */}
      {selectedVersionSnapshot && (
        <Modal
          open={!!selectedVersionSnapshot}
          title={`Version Snapshot: v${selectedVersionSnapshot.versionNumber}`}
          onClose={() => setSelectedVersionSnapshot(null)}
          maxWidth="760px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--kb-subtle-border)' }}>
              <span className={styles.versionBadge} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
                v{selectedVersionSnapshot.versionNumber}
              </span>
              <span style={{ fontSize: '0.8rem', background: 'var(--kb-subtle-bg)', padding: '4px 8px', borderRadius: 6, color: 'var(--kb-text-secondary)', fontWeight: 600 }}>
                {resolveCategoryIcon(selectedVersionSnapshot.category || '')} {selectedVersionSnapshot.category || 'General'}
              </span>
              <span style={{ fontSize: '0.8rem', background: 'var(--kb-subtle-bg)', padding: '4px 8px', borderRadius: 6, color: 'var(--kb-text-secondary)' }}>
                Visibility: {selectedVersionSnapshot.visibility || 'public'}
              </span>
              {selectedVersionSnapshot.publishedAt ? (
                <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                  Published: {new Date(selectedVersionSnapshot.publishedAt).toLocaleDateString()}
                </span>
              ) : selectedVersionSnapshot.approvedAt ? (
                <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                  Approved: {new Date(selectedVersionSnapshot.approvedAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--kb-text-primary)', marginBottom: 8 }}>
                {selectedVersionSnapshot.title}
              </h3>
              {selectedVersionSnapshot.changeSummary && (
                <div style={{ fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid #3b82f6', borderRadius: 6, color: 'var(--kb-text-secondary)', marginBottom: 12 }}>
                  <strong>Change Summary:</strong> {selectedVersionSnapshot.changeSummary}
                </div>
              )}
              {selectedVersionSnapshot.summary && (
                <div className={styles.summary} style={{ marginBottom: 14 }}>
                  <InformationCircleIcon className={styles.summaryIcon} />
                  <span>{selectedVersionSnapshot.summary}</span>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--kb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Snapshot Content
              </label>
              <div
                style={{
                  marginTop: 6,
                  padding: 18,
                  borderRadius: 10,
                  background: 'var(--kb-subtle-bg)',
                  border: '1px solid var(--kb-subtle-border)',
                  color: 'var(--kb-text-secondary)',
                  lineHeight: 1.7,
                  maxHeight: '380px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '0.92rem',
                }}
              >
                {selectedVersionSnapshot.content}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--kb-subtle-border)', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--kb-text-muted)' }}>
                Recorded {new Date(selectedVersionSnapshot.createdAt).toLocaleString()} by {[selectedVersionSnapshot.creatorFirstName, selectedVersionSnapshot.creatorLastName].filter(Boolean).join(' ') || 'Author'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={styles.cancelBtn} onClick={() => setSelectedVersionSnapshot(null)}>
                  Close
                </button>
                {(role === 'admin' || role === 'manager') && (
                  <button
                    className={styles.approveBtn}
                    onClick={() => {
                      const snap = selectedVersionSnapshot;
                      setSelectedVersionSnapshot(null);
                      setRestoreVersionTarget(snap);
                      setRestoreNotes(`Restored from version ${snap.versionNumber}`);
                      setRestoreIsMajor(false);
                      setRestorePublishLive(article?.status === 'published');
                    }}
                  >
                    <ArrowPathIcon style={{ width: 14, height: 14, marginRight: 6 }} />
                    <span>Restore as New Version</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Restore Version Confirmation Modal ── */}
      {restoreVersionTarget && (
        <Modal
          open={!!restoreVersionTarget}
          title={`Restore Version v${restoreVersionTarget.versionNumber} as New Version`}
          onClose={() => setRestoreVersionTarget(null)}
          maxWidth="600px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.08)', borderLeft: '4px solid #3b82f6', color: 'var(--kb-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Restoring snapshot <strong>v{restoreVersionTarget.versionNumber}</strong> ("{restoreVersionTarget.title}") will automatically generate a <strong>new version</strong> with this snapshot's content.
              <div style={{ marginTop: 6, color: '#16a34a', fontWeight: 600 }}>
                ✓ No existing versions will be overwritten or deleted. Full version history is permanently preserved.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Restore Change Notes / Summary</label>
              <textarea
                className={styles.formTextarea}
                rows={2}
                value={restoreNotes}
                onChange={(e) => setRestoreNotes(e.target.value)}
                placeholder="e.g. Rolled back to version 1.0 due to policy clarification"
              />
              <span className={styles.formHint}>This note will be recorded on the new version snapshot.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--kb-text-primary)' }}>
                <input
                  type="checkbox"
                  checked={restoreIsMajor}
                  onChange={(e) => setRestoreIsMajor(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                />
                <span><strong>Major Version Release (e.g. v2.0)</strong> — bumps major version number</span>
              </label>

              {article?.status === 'published' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--kb-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={restorePublishLive}
                    onChange={(e) => setRestorePublishLive(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#16a34a' }}
                  />
                  <span>Publish live immediately to tenants upon restore</span>
                </label>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className={styles.cancelBtn} disabled={busy} onClick={() => setRestoreVersionTarget(null)}>
                Cancel
              </button>
              <button className={styles.approveBtn} disabled={busy} onClick={handleConfirmRestore}>
                <ArrowPathIcon style={{ width: 15, height: 15, marginRight: 6 }} />
                <span>{busy ? 'Restoring...' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(false)} maxWidth="520px">
        <div className={`${styles.modalNoticeBox} ${styles.modalNoticeDanger}`}>
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

      {/* ── Manager Assign Revision Modal ── */}
      <ManagerAssignRevisionModal
        open={showManagerRevisionModal}
        article={article}
        busy={busy}
        onClose={() => setShowManagerRevisionModal(false)}
        onSubmit={handleManagerAssignRevision}
      />

      {/* ── In-App Attachment Reader Modal ── */}
      {readingAttachment && (() => {
        const fileName = readingAttachment.fileName || readingAttachment.file_name || 'Attachment';
        const rawPath = readingAttachment.filePath || readingAttachment.file_path || '';
        const filePath = rawPath.startsWith('http') || rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
        const ext = (readingAttachment.fileExtension || readingAttachment.file_extension || fileName.split('.').pop() || '').toLowerCase();
        const fileSize = readingAttachment.fileSize ?? readingAttachment.file_size ?? null;
        const isPdf = ext === 'pdf';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
        const isText = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'js', 'ts', 'html', 'css'].includes(ext);

        return (
          <Modal
            open={!!readingAttachment}
            title={`Reading Attachment: ${fileName}`}
            onClose={() => setReadingAttachment(null)}
            maxWidth={isPdf ? '1100px' : isImage ? '960px' : '860px'}
            footer={
              <div className={styles.readerModalFooter}>
                <div className={styles.readerFooterMeta}>
                  <span className={styles.readerFooterTag}>{ext.toUpperCase()}</span>
                  {fileSize ? <span>{(fileSize / 1024).toFixed(1)} KB</span> : null}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <a
                    href={filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.readerExternalBtn}
                    title="Open in new window"
                  >
                    <ArrowTopRightOnSquareIcon style={{ width: 15, height: 15 }} />
                    <span>Open in New Tab</span>
                  </a>
                  <a
                    href={filePath}
                    download={fileName}
                    className={styles.readerDownloadBtn}
                    title="Download file"
                  >
                    <ArrowDownTrayIcon style={{ width: 15, height: 15 }} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    className={styles.secondaryModalBtn}
                    onClick={() => setReadingAttachment(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            }
          >
            <div className={styles.readerContainer}>
              {isPdf && (
                <div className={styles.readerPdfFrameWrapper}>
                  <iframe
                    src={`${filePath}#toolbar=1&navpanes=1`}
                    title={fileName}
                    className={styles.readerPdfFrame}
                  />
                </div>
              )}

              {isImage && (
                <div className={styles.readerImageWrapper}>
                  <img src={filePath} alt={fileName} className={styles.readerImage} />
                </div>
              )}

              {isText && (
                <div className={styles.readerTextWrapper}>
                  {attachmentLoadingText ? (
                    <div className={styles.readerTextLoading}>
                      <div className={styles.spinner} style={{ width: 28, height: 28 }} />
                      <span>Reading file content...</span>
                    </div>
                  ) : (
                    <pre className={styles.readerTextContent}>{attachmentTextContent || 'File is empty'}</pre>
                  )}
                </div>
              )}

              {!isPdf && !isImage && !isText && (
                <div className={styles.readerDocCard}>
                  <div className={styles.readerDocIconWrapper}>
                    <DocumentIcon style={{ width: 48, height: 48 }} />
                  </div>
                  <h3 className={styles.readerDocTitle}>{fileName}</h3>
                  <p className={styles.readerDocDesc}>
                    This document format ({ext.toUpperCase()}) is ready to download or view in your desktop application.
                  </p>
                  <div className={styles.readerDocBtnGroup}>
                    <a
                      href={filePath}
                      download={fileName}
                      className={styles.readerDocPrimaryBtn}
                    >
                      <ArrowDownTrayIcon style={{ width: 18, height: 18 }} />
                      <span>Download {fileName}</span>
                    </a>
                    <a
                      href={filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.readerDocSecondaryBtn}
                    >
                      <ArrowTopRightOnSquareIcon style={{ width: 18, height: 18 }} />
                      <span>Open Directly</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
