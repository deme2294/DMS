import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import type { Article, ArticleFormValues } from '../../types/article';
import {
  fetchArticle,
  updateArticle,
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
  fetchAllCategories,
} from '../../api/knowledgeApi';
import type { KnowledgeCategory } from '../../types/article';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import Modal from '../../components/Modal/Modal';
import {
  TrashIcon,
  GlobeAltIcon,
  PaperAirplaneIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeSlashIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import { RevisionThreadCard } from './components/RevisionThreadCard';
import styles from './KnowledgeEdit.module.css';

interface DeptOption {
  id: string;
  name: string;
  code: string;
}

export default function KnowledgeEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role;
  const basePath = role === 'staff' ? '/staff/knowledge' : role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [article, setArticle] = useState<Article | null>(null);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ArticleFormValues>({
    defaultValues: { title: '', summary: '', content: '', category: '', tags: '', visibility: 'internal', departmentId: '' as any },
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchArticle(id),
      fetchActiveDepartments().catch(() => ({ data: { data: [] } })),
      fetchAllCategories().catch(() => ({ data: { data: [] } })),
    ])
      .then(([artRes, deptRes, catRes]) => {
        const a: Article = artRes.data.data;
        const depts: DeptOption[] = deptRes.data.data || [];
        let cats: KnowledgeCategory[] = catRes.data.data || [];

        // Automatically ensure the article's category from creation is always in the options list
        const articleCat = (a?.category || '').trim();
        if (articleCat && !cats.some((c) => c.name.toLowerCase() === articleCat.toLowerCase())) {
          cats = [
            {
              id: `existing-${articleCat}`,
              name: articleCat,
              slug: articleCat.toLowerCase().replace(/\s+/g, '-'),
              icon: 'folder',
              isActive: true,
            } as KnowledgeCategory,
            ...cats,
          ];
        }

        setDepartments(depts);
        setCategories(cats);
        setArticle(a);

        const deptId = (a.departmentId || (a as any).department_id || '') as any;
        reset({
          title: a.title || '',
          summary: a.summary || '',
          content: a.content || '',
          category: articleCat,
          tags: a.tags || '',
          visibility: a.visibility || 'internal',
          departmentId: deptId,
        });

        if (articleCat) {
          setValue('category', articleCat, { shouldValidate: true, shouldDirty: false });
        }
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, reset, setValue]);

  // Keep category synchronized whenever categories or article category updates
  useEffect(() => {
    if (article?.category) {
      setValue('category', article.category, { shouldValidate: true, shouldDirty: false });
    }
  }, [article?.category, categories, setValue]);

  const editable =
    !!article &&
    (role === 'admin' ||
      (role === 'manager') ||
      (role === 'staff' && article.authorId === user?.id && ['draft', 'needs_revision', 'restored'].includes(article.status)));

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(successMsg);
      const res = await fetchArticle(id as string);
      setArticle(res.data.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (values: ArticleFormValues) => {
    if (!id) return;
    setSaving(true);
    setError('');
    const finalCategory = values.category || article?.category || '';
    if (!finalCategory) {
      setError('Category is required');
      setSaving(false);
      return;
    }
    try {
      await updateArticle(id, {
        title: values.title,
        summary: values.summary,
        content: values.content,
        category: finalCategory,
        tags: values.tags || null,
        visibility: values.visibility || 'internal',
        departmentId: values.departmentId || (article as any)?.departmentId || (article as any)?.department_id || null,
      });
      setMessage('Article updated');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update article');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.page}>Loading...</div>;
  if (!article) return <div className={styles.page}>Article not found</div>;

  const handleSubmitForReview = () => runAction(() => submitArticle(article.id), 'Submitted for review');
  const handleRequestRevision = () => {
    if (!revisionReason.trim()) { setError('Revision notes are required'); return; }
    setShowRevisionModal(false);
    runAction(() => requestRevision(article.id, revisionReason), 'Revision requested');
    setRevisionReason('');
  };
  const handleReject = () => {
    if (!rejectReason.trim()) { setError('Rejection reason is required'); return; }
    setShowRejectModal(false);
    runAction(() => rejectArticle(article.id, rejectReason), 'Article rejected');
    setRejectReason('');
  };
  const handlePublish = () => runAction(() => publishArticle(article.id), 'Article published');
  const handleUnpublish = () => {
    setShowUnpublishModal(false);
    runAction(() => unpublishArticle(article.id, unpublishReason), 'Article unpublished');
  };
  const handleArchive = () => runAction(() => archiveArticle(article.id), 'Article archived');
  const handleRestore = () => runAction(() => restoreArticle(article.id), 'Article restored');
  const handleMoveToDraft = () => runAction(() => moveToDraft(article.id), 'Article moved to draft');
  const handleDelete = () => {
    setDeleteTarget(false);
    runAction(() => deleteArticle(article.id), 'Article deleted').then(() => navigate(basePath));
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Edit Knowledge Article" backTo={basePath} />

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>{error}</div>}
      {message && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#ecfdf5', color: '#065f46' }}>{message}</div>}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>Status:</span>
        <span className={`${styles.badge} ${styles[article.status] || ''}`}>{article.status?.replace(/_/g, ' ')}</span>
        {article.rejectionReason && <span style={{ color: '#991b1b' }}>Rejection: {article.rejectionReason}</span>}
      </div>

      {article.revisionNotes && (
        <div style={{ marginBottom: 20 }}>
          <RevisionThreadCard revisionNotes={article.revisionNotes} />
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title</label>
            <input id="title" type="text" disabled={!editable} {...register('title', { required: 'Title is required' })} placeholder="Enter article title" />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>
            <select id="category" disabled={!editable} {...register('category', { required: 'Category is required' })}>
              <option value="">Select category</option>
              {article?.category && !categories.some((c) => c.name.toLowerCase() === article.category.toLowerCase()) && (
                <option value={article.category}>
                  {resolveCategoryIcon(article.category)} {article.category} (Original)
                </option>
              )}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {resolveCategoryIcon(cat.icon || cat.name)} {cat.name}
                </option>
              ))}
            </select>
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="summary">Summary</label>
          <textarea id="summary" disabled={!editable} {...register('summary')} placeholder="Brief summary..." rows={2} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">Content</label>
          <textarea id="content" disabled={!editable} {...register('content', { required: 'Content is required', minLength: { value: 50, message: 'Content must be at least 50 characters' } })} placeholder="Write the article content here..." rows={10} />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
        </div>

        <div className={styles.formRow}>
          {role !== 'admin' ? (
            <div className={styles.formGroup}>
              <label htmlFor="visibility">
                Visibility Lifecycle
                <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, marginLeft: 6 }}>
                  (Automated)
                </span>
              </label>
              <input type="hidden" {...register('visibility')} />
              <div className={styles.autoVisibilityCard}>
                <div className={styles.autoVisibilityCardHeader}>
                  <span className={styles.autoVisibilityCardTitle}>
                    {article.status === 'draft'
                      ? '🔒 Restricted · Creator Only'
                      : (article.status === 'pending_approval' && !article.reviewedBy)
                      ? '👥 Internal · Creator & Dept Manager'
                      : (article.status === 'pending_approval' && article.reviewedBy) || article.status === 'approved'
                      ? '🏢 Department · All Staff, Manager & Admin'
                      : article.status === 'published'
                      ? '🌐 Public · Portal & Tenants'
                      : '⚠️ Internal · Review Scope'}
                  </span>
                  <span
                    className={`${styles.autoVisibilityStatusBadge} ${
                      article.status === 'draft' ? styles.draft : styles.other
                    }`}
                  >
                    {article.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <span className={styles.autoVisibilityCardDesc}>
                  {article.status === 'draft'
                    ? 'Private to author. Use "Route to Department Manager" below when ready to submit for review.'
                    : (article.status === 'pending_approval' && !article.reviewedBy)
                    ? 'Shared between you and Department Manager for review.'
                    : (article.status === 'pending_approval' && article.reviewedBy) || article.status === 'approved'
                    ? 'Approved by Department Manager. Visible to all department staff and Admin.'
                    : article.status === 'published'
                    ? 'Publicly accessible to all users, tenants, and department staff.'
                    : 'Visible to author and reviewer while revisions are pending.'}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="visibility">
                Visibility
                <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, marginLeft: 6 }}>
                  (Automated Lifecycle · Admin Override)
                </span>
              </label>
              <select id="visibility" disabled={!editable} {...register('visibility')}>
                <option value="restricted">Restricted (Author Only / Private Draft)</option>
                <option value="internal">Internal (Author & Dept Manager)</option>
                <option value="department">Department (Whole Dept Staff, Manager & Admin)</option>
                <option value="public">Public (Open Knowledge Base & Tenants)</option>
                <option value="tenant">Tenant (Visible to Tenants & Portal Users)</option>
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="departmentId">Department</label>
            <select id="departmentId" disabled={!editable || role === 'staff'} {...register('departmentId')}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {role === 'staff' && (
              <span style={{ fontSize: '0.78rem', color: '#15803d', marginTop: 4, display: 'block' }}>
                ✓ Locked to your assigned department
              </span>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tags">Tags</label>
          <input id="tags" type="text" disabled={!editable} {...register('tags')} placeholder="e.g. onboarding, payroll, leave" />
        </div>

        <div className={styles.formActions}>
          {can('knowledge.delete') && (
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy || saving}
              onClick={() => setDeleteTarget(true)}
            >
              <TrashIcon className={styles.btnIcon} />
              <span>Delete</span>
            </button>
          )}

          {role === 'staff' && article.authorId === user?.id && article.status === 'draft' && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={handleSubmitForReview}
              title="Route draft to Department Manager (changes visibility to Internal)"
            >
              <PaperAirplaneIcon className={styles.btnIcon} />
              <span>Route to Department Manager</span>
            </button>
          )}
          {role === 'staff' && article.authorId === user?.id && article.status === 'needs_revision' && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={handleSubmitForReview}
              title="Re-submit corrected article to Department Manager"
            >
              <PaperAirplaneIcon className={styles.btnIcon} />
              <span>Re-route to Department Manager</span>
            </button>
          )}
          {role === 'manager' && (article.status === 'draft' || article.status === 'needs_revision') && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={handleSubmitForReview}
              title="Submit article to Admin for final review"
            >
              <PaperAirplaneIcon className={styles.btnIcon} />
              <span>{article.status === 'needs_revision' ? 'Re-submit to Admin' : 'Submit to Admin for Approval'}</span>
            </button>
          )}
          {/* Admin Draft Controls */}
          {role === 'admin' && article.status === 'draft' && (
            <>
              <button
                type="button"
                className={styles.publishBtn}
                disabled={busy || saving}
                onClick={handlePublish}
              >
                <GlobeAltIcon className={styles.btnIcon} />
                <span>Publish to Tenants</span>
              </button>
              <button
                type="button"
                className={styles.approveBtn}
                disabled={busy || saving}
                onClick={() => runAction(() => approveArticle(article.id), 'Draft approved')}
              >
                <CheckIcon className={styles.btnIcon} />
                <span>Approve Draft</span>
              </button>
            </>
          )}

          {/* Pending Approval Controls */}
          {role === 'admin' && article.status === 'pending_approval' && (
            <button
              type="button"
              className={styles.publishBtn}
              disabled={busy || saving}
              onClick={handlePublish}
            >
              <GlobeAltIcon className={styles.btnIcon} />
              <span>Publish to Tenants</span>
            </button>
          )}
          {can('knowledge.approve') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
            <button type="button" className={styles.approveBtn} disabled={busy || saving} onClick={() => runAction(() => approveArticle(article.id), 'Approved')}>
              <CheckIcon className={styles.btnIcon} />
              <span>Approve</span>
            </button>
          )}
          {can('knowledge.request_revision') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
            <button type="button" className={styles.warningBtn} disabled={busy || saving} onClick={() => setShowRevisionModal(true)}>
              <ExclamationTriangleIcon className={styles.btnIcon} />
              <span>Request Changes</span>
            </button>
          )}
          {can('knowledge.reject') && article.status === 'pending_approval' && (article.authorId !== user?.id || role === 'admin') && (
            <button type="button" className={styles.dangerBtn} disabled={busy || saving} onClick={() => setShowRejectModal(true)}>
              <XCircleIcon className={styles.btnIcon} />
              <span>Reject</span>
            </button>
          )}
          {/* Approved state actions */}
          {role === 'admin' && article.status === 'approved' && (
            <>
              <button type="button" className={styles.publishBtn} disabled={busy || saving} onClick={handlePublish}>
                <GlobeAltIcon className={styles.btnIcon} />
                <span>Publish to Tenants</span>
              </button>
              <button type="button" className={styles.warningBtn} disabled={busy || saving} onClick={() => setShowRevisionModal(true)}>
                <ExclamationTriangleIcon className={styles.btnIcon} />
                <span>Request Changes</span>
              </button>
              <button type="button" className={styles.dangerBtn} disabled={busy || saving} onClick={() => setShowRejectModal(true)}>
                <XCircleIcon className={styles.btnIcon} />
                <span>Reject</span>
              </button>
            </>
          )}
          {can('knowledge.unpublish') && article.status === 'published' && (
            <button type="button" className={styles.secondaryBtn} disabled={busy || saving} onClick={() => setShowUnpublishModal(true)}>
              <EyeSlashIcon className={styles.btnIcon} />
              <span>Unpublish</span>
            </button>
          )}
          {can('knowledge.archive') && (article.status === 'published' || article.status === 'unpublished') && (
            <button type="button" className={styles.secondaryBtn} disabled={busy || saving} onClick={handleArchive}>
              <ArchiveBoxIcon className={styles.btnIcon} />
              <span>Retire (Archive)</span>
            </button>
          )}
          {can('knowledge.archive') && article.status === 'archived' && (
            <button type="button" className={styles.approveBtn} disabled={busy || saving} onClick={handleRestore}>
              <ArrowPathIcon className={styles.btnIcon} />
              <span>Restore</span>
            </button>
          )}
          {article.status === 'restored' && (
            <>
              {(role === 'admin' || role === 'manager' || article.authorId === user?.id) && (
                <button
                  type="button"
                  className={styles.approveBtn}
                  disabled={busy || saving}
                  onClick={handleMoveToDraft}
                  title="Move restored article to Draft"
                >
                  <DocumentTextIcon className={styles.btnIcon} />
                  <span>Move to Draft</span>
                </button>
              )}
              {role === 'admin' && (
                <button
                  type="button"
                  className={styles.publishBtn}
                  disabled={busy || saving}
                  onClick={handlePublish}
                  title="Directly re-publish to tenants"
                >
                  <GlobeAltIcon className={styles.btnIcon} />
                  <span>Re-publish to Tenants</span>
                </button>
              )}
            </>
          )}

          <button type="button" className={styles.cancelBtn} onClick={() => navigate(basePath)}>
            <XMarkIcon className={styles.btnIcon} />
            <span>Cancel</span>
          </button>

          {editable && (
            <button type="submit" className={styles.submitBtn} disabled={saving || busy}>
              {saving ? (
                <>
                  <ArrowPathIcon className={styles.spinnerIcon} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <PencilSquareIcon className={styles.btnIcon} />
                  <span>Update Article</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>

      <Modal open={showRevisionModal} title="Request Changes" onClose={() => { setShowRevisionModal(false); setRevisionReason(''); }}>
        <p>Please provide revision notes:</p>
        <textarea value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="Enter revision notes..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleRequestRevision}>
            <CheckIcon className={styles.btnIcon} />
            <span>Submit</span>
          </button>
          <button className={styles.cancelBtn} onClick={() => { setShowRevisionModal(false); setRevisionReason(''); }}>
            <XMarkIcon className={styles.btnIcon} />
            <span>Cancel</span>
          </button>
        </div>
      </Modal>

      <Modal open={showRejectModal} title="Reject Article" onClose={() => { setShowRejectModal(false); setRejectReason(''); }}>
        <p>Please provide a rejection reason:</p>
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.dangerBtn} onClick={handleReject}>
            <XCircleIcon className={styles.btnIcon} />
            <span>Reject</span>
          </button>
          <button className={styles.cancelBtn} onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
            <XMarkIcon className={styles.btnIcon} />
            <span>Cancel</span>
          </button>
        </div>
      </Modal>

      <Modal open={showUnpublishModal} title="Unpublish Article" onClose={() => { setShowUnpublishModal(false); setUnpublishReason(''); }}>
        <p>Please provide a reason for unpublishing (optional):</p>
        <textarea value={unpublishReason} onChange={(e) => setUnpublishReason(e.target.value)} placeholder="Enter reason..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.secondaryBtn} onClick={handleUnpublish}>
            <EyeSlashIcon className={styles.btnIcon} />
            <span>Unpublish</span>
          </button>
          <button className={styles.cancelBtn} onClick={() => setShowUnpublishModal(false)}>
            <XMarkIcon className={styles.btnIcon} />
            <span>Cancel</span>
          </button>
        </div>
      </Modal>

      <Modal open={deleteTarget} title="Delete Article" onClose={() => setDeleteTarget(false)}>
        <p>Are you sure you want to delete "{article.title}"? This action cannot be undone.</p>
        <div className={styles.formActions}>
          <button className={styles.dangerBtn} onClick={handleDelete}>
            <TrashIcon className={styles.btnIcon} />
            <span>Delete</span>
          </button>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(false)}>
            <XMarkIcon className={styles.btnIcon} />
            <span>Cancel</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
