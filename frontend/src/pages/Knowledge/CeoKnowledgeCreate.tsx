import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { ArticleFormValues } from '../../types/article';
import { createArticle } from '../../api/knowledgeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAuth } from '../../context/AuthContext';
import styles from './CeoKnowledgeCreate.module.css';

interface DeptOption {
  id: string;
  name: string;
  code: string;
}

export default function CeoKnowledgeCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<DeptOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormValues>({
    defaultValues: {
      title: '',
      content: '',
      category: '',
      tags: '',
      departmentId: null,
    },
  });

  useEffect(() => {
    setError('');
    fetchActiveDepartments()
      .then((res) => setDepartments(res.data.data || []))
      .catch(() => setDepartments([]));
  }, []);

  const onSubmit = async (values: ArticleFormValues) => {
    if (role === 'staff' && !values.departmentId) {
      setError('Please assign the article to a department');
      return;
    }
    try {
      await createArticle({
        title: values.title,
        content: values.content,
        category: values.category,
        tags: values.tags || null,
        departmentId: values.departmentId || null,
      });
      navigate('/ceo/knowledge');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to create article'
      );
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Create Knowledge Article" backTo="/ceo/knowledge" />

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.14)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              {...register('title', { required: 'Title is required' })}
              placeholder="Enter article title"
            />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>
            <input
              id="category"
              type="text"
              {...register('category', { required: 'Category is required' })}
              placeholder="e.g. Policy, Procedure, FAQ"
            />
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            {...register('content', { required: 'Content is required' })}
            placeholder="Write the article content here..."
          />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="tags">Tags</label>
            <input
              id="tags"
              type="text"
              {...register('tags')}
              placeholder="e.g. onboarding, payroll, leave"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="departmentId">Department</label>
            <select
              id="departmentId"
              {...register('departmentId', { required: role === 'staff' })}
              onChange={(e) => setValue('departmentId', e.target.value || null)}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {role === 'staff' && (
              <span className={styles.error}>Assign to one of your departments</span>
            )}
          </div>
        </div>

        <p style={{ color: '#b8a06a', fontSize: '0.85rem' }}>
          Articles are saved as <strong>draft</strong> and must be approved before publishing.
        </p>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create Article'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/ceo/knowledge')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
