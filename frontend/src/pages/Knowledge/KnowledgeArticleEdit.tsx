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
  deleteArticle,
  requestRevision,
  fetchAllCategories,
} from '../../api/knowledgeApi';
import type { KnowledgeCategory } from '../../types/article';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import Modal from '../../components/Modal/Modal';
import styles from './KnowledgeArticleEdit.module.css';

interface DeptOption {
  id: string;
  name: string;
  code: string;
}

export default function KnowledgeArticleEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role;

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
    formState: { errors },
  } = useForm<ArticleFormValues>({
    defaultValues: { title: '', summary: '', content: '', category: '', tags: '', visibility: 'internal', departmentId: null },
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchArticle(id),
      fetchActiveDepartments().then((res) => setDepartments(res.data.data || [])).catch(() => setDepartments([])),
      fetchAllCategories().then((res) => setCategories(res.data.data || [])).catch(() => setCategories([])),
    ])
      .then(([res]) => {
        const a: Article = res.data.data;
        setArticle(a);
        reset({
          title: a.title,
          summary: a.summary || '',
          content: a.content,
          category: a.category,
          tags: a.tags || '',
          visibility: a.visibility || 'internal',
          departmentId: a.departmentId || null,
        });
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const editable =
    !!article &&
    (role === 'admin' ||
      (role === 'manager') ||
      (role === 'staff' && article.authorId === user?.id && ['draft', 'needs_revision'].includes(article.status)));

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
    try {
      await updateArticle(id, {
        title: values.title,
        summary: values.summary,
        content: values.content,
        category: values.category,
        tags: values.tags || null,
        visibility: values.visibility || 'internal',
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
  const handleApprove = () => runAction(() => approveArticle(article.id), 'Article approved');
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
  const handleDelete = () => {
    setDeleteTarget(false);
    runAction(() => deleteArticle(article.id), 'Article deleted').then(() => navigate('/admin/knowledge'));
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Edit Knowledge Article" backTo="/admin/knowledge" />

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>{error}</div>}
      {message && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#ecfdf5', color: '#065f46' }}>{message}</div>}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>Status:</span>
        <span className={`${styles.badge} ${styles[article.status] || ''}`}>{article.status?.replace(/_/g, ' ')}</span>
        {article.rejectionReason && <span style={{ color: '#991b1b' }}>Rejection: {article.rejectionReason}</span>}
        {article.revisionNotes && <span style={{ color: '#f59e0b' }}>Revision: {article.revisionNotes}</span>}
      </div>

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
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
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
          <textarea id="content" disabled={!editable} {...register('content', { required: 'Content is required' })} placeholder="Write the article content here..." rows={10} />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="visibility">Visibility</label>
            <select id="visibility" disabled={!editable} {...register('visibility')}>
              <option value="internal">Internal</option>
              <option value="tenant">Tenant</option>
              <option value="department">Department</option>
              <option value="restricted">Restricted</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="departmentId">Department</label>
            <select id="departmentId" disabled={!editable} {...register('departmentId')}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tags">Tags</label>
          <input id="tags" type="text" disabled={!editable} {...register('tags')} placeholder="e.g. onboarding, payroll, leave" />
        </div>

        <div className={styles.formActions}>
          {editable && (
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Update Article'}
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/admin/knowledge')}>
            Cancel
          </button>
        </div>
      </form>

      <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {role === 'staff' && article.authorId === user?.id && article.status === 'draft' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleSubmitForReview}>Submit for Review</button>
        )}
        {role === 'staff' && article.authorId === user?.id && article.status === 'needs_revision' && (
          <button className={styles.submitBtn} disabled={busy} onClick={handleSubmitForReview}>Resubmit for Review</button>
        )}
        {can('knowledge.request_revision') && article.status === 'pending_approval' && article.authorId !== user?.id && (
          <button className={styles.edit} disabled={busy} onClick={() => setShowRevisionModal(true)}>Request Changes</button>
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
        {can('knowledge.delete') && (
          <button className={styles.danger} disabled={busy} onClick={() => setDeleteTarget(true)}>Delete</button>
        )}
      </div>

      <Modal open={showRevisionModal} title="Request Changes" onClose={() => { setShowRevisionModal(false); setRevisionReason(''); }}>
        <p>Please provide revision notes:</p>
        <textarea value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="Enter revision notes..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleRequestRevision}>Submit</button>
          <button className={styles.cancelBtn} onClick={() => { setShowRevisionModal(false); setRevisionReason(''); }}>Cancel</button>
        </div>
      </Modal>

      <Modal open={showRejectModal} title="Reject Article" onClose={() => { setShowRejectModal(false); setRejectReason(''); }}>
        <p>Please provide a rejection reason:</p>
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleReject}>Reject</button>
          <button className={styles.cancelBtn} onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancel</button>
        </div>
      </Modal>

      <Modal open={showUnpublishModal} title="Unpublish Article" onClose={() => { setShowUnpublishModal(false); setUnpublishReason(''); }}>
        <p>Please provide a reason for unpublishing (optional):</p>
        <textarea value={unpublishReason} onChange={(e) => setUnpublishReason(e.target.value)} placeholder="Enter reason..." rows={4} style={{ width: '100%', marginTop: 8 }} />
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={handleUnpublish}>Unpublish</button>
          <button className={styles.submitBtn} onClick={() => setShowUnpublishModal(false)}>Cancel</button>
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
