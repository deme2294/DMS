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
  archiveArticle,
  restoreArticle,
  deleteArticle,
} from '../../api/knowledgeApi';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { TrashIcon } from '@heroicons/react/24/outline';
import styles from './CeoKnowledgeEdit.module.css';

export default function CeoKnowledgeEdit() {
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArticleFormValues>({
    defaultValues: { title: '', content: '', category: '', tags: '', departmentId: null },
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchArticle(id)
      .then((res) => {
        const a: Article = res.data.data;
        setArticle(a);
        reset({
          title: a.title,
          content: a.content,
          category: a.category,
          tags: a.tags || '',
          departmentId: a.departmentId || null,
        });
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const editable =
    !!article &&
    (role === 'admin' ||
      role === 'ceo' ||
      (role === 'manager') ||
      (role === 'staff' && article.authorId === user?.id && article.status === 'draft'));

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
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Action failed'
      );
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
        content: values.content,
        category: values.category,
        tags: values.tags || null,
      });
      navigate('/ceo/knowledge');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update article'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.page}>Loading...</div>;
  if (!article) return <div className={styles.page}>Article not found</div>;

  return (
    <div className={styles.page}>
      <PageHeader title="Edit Knowledge Article" backTo="/ceo/knowledge" />

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.14)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{error}</div>}
      {message && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.14)', color: '#6ee7b7', border: '1px solid rgba(34, 197, 94, 0.3)' }}>{message}</div>}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: '#e8dcb8' }}>Status:</span>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.06)', color: '#e8dcb8' }}>{article.status}</span>
        {article.rejectionReason && (
          <span style={{ color: '#fca5a5' }}>Rejection reason: {article.rejectionReason}</span>
        )}
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
            <input id="category" type="text" disabled={!editable} {...register('category', { required: 'Category is required' })} placeholder="e.g. Policy, Procedure, FAQ" />
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">Content</label>
          <textarea id="content" disabled={!editable} {...register('content', { required: 'Content is required', minLength: { value: 50, message: 'Content must be at least 50 characters' } })} placeholder="Write the article content here..." />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
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
              onClick={() => {
                if (confirm('Delete this article?')) {
                  runAction(() => deleteArticle(article.id), 'Deleted').then(() => navigate('/ceo/knowledge'));
                }
              }}
            >
              <TrashIcon style={{ width: 16, height: 16 }} />
              Delete
            </button>
          )}

          {role === 'staff' && article.authorId === user?.id && article.status === 'draft' && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={() => runAction(() => submitArticle(article.id), 'Submitted for review')}
            >
              Submit for Review
            </button>
          )}
          {can('knowledge.approve') && article.status === 'pending_approval' && (
            <>
              <button
                type="button"
                className={styles.submitBtn}
                disabled={busy || saving}
                onClick={() => runAction(() => approveArticle(article.id), 'Approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={busy || saving}
                onClick={() => runAction(() => rejectArticle(article.id, 'Needs revision'), 'Rejected')}
              >
                Reject
              </button>
            </>
          )}
          {can('knowledge.publish') && article.status === 'approved' && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={() => runAction(() => publishArticle(article.id), 'Published')}
            >
              Publish
            </button>
          )}
          {can('knowledge.delete') && article.status === 'published' && (
            <button
              type="button"
              className={styles.cancelBtn}
              disabled={busy || saving}
              onClick={() => runAction(() => archiveArticle(article.id), 'Archived')}
            >
              Archive
            </button>
          )}
          {can('knowledge.delete') && article.status === 'archived' && (
            <button
              type="button"
              className={styles.submitBtn}
              disabled={busy || saving}
              onClick={() => runAction(() => restoreArticle(article.id), 'Restored')}
            >
              Restore
            </button>
          )}

          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/ceo/knowledge')}>
            Cancel
          </button>

          {editable && (
            <button type="submit" className={styles.submitBtn} disabled={saving || busy}>
              {saving ? 'Saving...' : 'Update Article'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
