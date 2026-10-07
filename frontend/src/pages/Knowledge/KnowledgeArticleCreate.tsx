import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { ArticleFormValues } from '../../types/article';
import {
  createArticle,
  fetchAllCategories,
} from '../../api/knowledgeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type { KnowledgeCategory } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import styles from './KnowledgeArticleCreate.module.css';

interface DeptOption {
  id: string;
  name: string;
  code: string;
}

export default function KnowledgeArticleCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormValues>({
    defaultValues: {
      title: '',
      summary: '',
      content: '',
      category: '',
      tags: '',
      visibility: 'restricted',
      departmentId: null,
    },
  });

  useEffect(() => {
    setError('');
    (async () => {
      try {
        const [deptRes, catRes] = await Promise.all([
          fetchActiveDepartments(),
          fetchAllCategories(),
        ]);
        setDepartments(deptRes.data.data || []);
        setCategories(catRes.data.data || []);
      } catch {
        setDepartments([]);
        setCategories([]);
      }
    })();
  }, []);

  const onSubmit = async (values: ArticleFormValues) => {
    if (role === 'staff' && !values.departmentId) {
      setError('Please assign the article to a department');
      return;
    }
    try {
      await createArticle({
        title: values.title,
        summary: values.summary,
        content: values.content,
        category: values.category,
        tags: values.tags || null,
        visibility: values.visibility || 'internal',
        departmentId: values.departmentId || null,
      });
      navigate('/admin/knowledge');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create article');
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Create Knowledge Article" backTo="/admin/knowledge" />

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title</label>
            <input id="title" type="text" {...register('title', { required: 'Title is required' })} placeholder="Enter article title" />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>
            <select id="category" {...register('category', { required: 'Category is required' })}>
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
          <textarea id="summary" {...register('summary')} placeholder="Brief summary of the article..." rows={2} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">Content</label>
          <textarea id="content" {...register('content', { required: 'Content is required' })} placeholder="Write the article content here..." rows={10} />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="visibility">
              Visibility Lifecycle
              <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, marginLeft: 6 }}>
                (Automated Step-by-Step)
              </span>
            </label>
            <input type="hidden" {...register('visibility')} value="restricted" />
            <div className={styles.autoVisibilityBox} title="Saved as private draft visible only to creator">
              🔒 Restricted · Creator Only (Private draft)
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="departmentId">Department</label>
            <select id="departmentId" {...register('departmentId', { required: role === 'staff' })}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {role === 'staff' && <span className={styles.error}>Assign to one of your departments</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tags">Tags</label>
          <input id="tags" type="text" {...register('tags')} placeholder="e.g. onboarding, payroll, leave" />
        </div>

        <p style={{ color: '#577297ff', fontSize: '0.85rem' }}>
          Articles are saved as <strong>draft</strong> and must be submitted for approval before publishing.
        </p>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create Article'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/admin/knowledge')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
