import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { ArticleFormValues } from '../../types/article';
import {
  createArticle,
  fetchAllCategories,
} from '../../api/knowledgeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchMyDepartments } from '../../api/reportApi';
import type { KnowledgeCategory } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import styles from './KnowledgeCreate.module.css';

interface DeptOption {
  id: string;
  name: string;
  code: string;
}

export default function KnowledgeCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const basePath = role === 'staff' ? '/staff/knowledge' : role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [submitForApproval, setSubmitForApproval] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormValues>({
    defaultValues: {
      title: '',
      summary: '',
      content: '',
      category: '',
      tags: '',
      visibility: 'internal',
      departmentId: '' as any,
    },
  });

  const selectedDepartmentId = watch('departmentId');

  // Load department options
  useEffect(() => {
    setError('');
    (async () => {
      try {
        let deptList: DeptOption[] = [];
        if (role === 'manager' || role === 'staff') {
          try {
            const myDepts = await fetchMyDepartments();
            deptList = (myDepts.data.data as DeptOption[]) || [];
          } catch {
            const allDepts = await fetchActiveDepartments();
            deptList = (allDepts.data.data as DeptOption[]) || [];
          }
        } else {
          const allDepts = await fetchActiveDepartments();
          deptList = (allDepts.data.data as DeptOption[]) || [];
        }

        setDepartments(deptList);

        // Auto-assign department for staff and manager
        if (deptList.length > 0) {
          setValue('departmentId', deptList[0].id, { shouldValidate: true, shouldDirty: true });
        }
      } catch {
        setDepartments([]);
      }
    })();
  }, [role, setValue]);

  // Load categories filtered for the assigned/selected department
  const loadCategoriesForDepartment = useCallback(async (deptId?: string) => {
    try {
      const res = await fetchAllCategories(deptId ? { departmentId: deptId } : undefined);
      const allCats = res.data.data || [];
      setCategories(allCats);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadCategoriesForDepartment(selectedDepartmentId);
    } else {
      loadCategoriesForDepartment();
    }
  }, [selectedDepartmentId, loadCategoriesForDepartment]);

  // Split categories: department-specific categories first, then global
  const departmentCategories = categories.filter((c) => c.departmentId === selectedDepartmentId);
  const globalCategories = categories.filter((c) => !c.departmentId);
  const activeDeptObj = departments.find((d) => d.id === selectedDepartmentId) || departments[0];

  const onSubmit = async (values: ArticleFormValues) => {
    const finalDeptId = values.departmentId || (departments.length > 0 ? departments[0].id : null);

    if ((role === 'staff' || role === 'manager') && !finalDeptId && departments.length > 0) {
      setError('Please assign the article to your department');
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
        departmentId: finalDeptId || null,
        submitForApproval,
      });
      navigate(basePath);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create article');
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Create Knowledge Article" backTo={basePath} />

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title *</label>
            <input id="title" type="text" {...register('title', { required: 'Title is required' })} placeholder="Enter article title" />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">
              Category *
              {activeDeptObj && (
                <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 500, marginLeft: 6 }}>
                  (Showing for {activeDeptObj.name})
                </span>
              )}
            </label>
            <select id="category" {...register('category', { required: 'Category is required' })}>
              <option value="">Select category</option>
              {departmentCategories.length > 0 && (
                <optgroup label={`🏢 ${activeDeptObj?.name || 'Department'} Categories`}>
                  {departmentCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {resolveCategoryIcon(cat.icon || cat.name)} {cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {globalCategories.length > 0 && (
                <optgroup label="🌐 Organization-Wide Categories">
                  {globalCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {resolveCategoryIcon(cat.icon || cat.name)} {cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {departmentCategories.length === 0 && globalCategories.length === 0 && categories.map((cat) => (
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
          <textarea id="summary" {...register('summary')} placeholder="Brief summary of the article..." rows={2} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">Content *</label>
          <textarea id="content" {...register('content', { required: 'Content is required' })} placeholder="Write the article content here..." rows={10} />
          {errors.content && <span className={styles.error}>{errors.content.message}</span>}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="visibility">Visibility</label>
            <select id="visibility" {...register('visibility')}>
              <option value="internal">Internal</option>
              <option value="tenant">Tenant</option>
              <option value="department">Department</option>
              <option value="restricted">Restricted</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="departmentId">Department *</label>
            {role === 'staff' && departments.length <= 1 ? (
              <>
                <select
                  id="departmentId"
                  disabled
                  value={departments[0]?.id || ''}
                  style={{ background: '#f8fafc', color: '#0f172a', fontWeight: 600, cursor: 'default' }}
                >
                  <option value={departments[0]?.id || ''}>
                    🏢 {departments[0]?.name || 'Your Assigned Department'}
                  </option>
                </select>
                <input type="hidden" {...register('departmentId')} value={departments[0]?.id || ''} />
                <span style={{ fontSize: '0.8rem', color: '#15803d', marginTop: 4, display: 'block', fontWeight: 500 }}>
                  ✓ Automatically assigned to your department ({departments[0]?.name || 'Department'})
                </span>
              </>
            ) : (
              <>
                <select
                  id="departmentId"
                  {...register('departmentId', { required: (role === 'staff' || role === 'manager') && departments.length > 0 })}
                  value={selectedDepartmentId || (departments.length > 0 ? departments[0].id : '')}
                  onChange={(e) => setValue('departmentId', e.target.value, { shouldValidate: true, shouldDirty: true })}
                >
                  {departments.length === 0 && <option value="">No departments available</option>}
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      🏢 {d.name} {role === 'staff' ? '(Your Department)' : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: 4, display: 'block', fontWeight: 500 }}>
                  {role === 'staff'
                    ? 'Assigned to your staff department'
                    : 'Articles will be managed within this department scope'}
                </span>
              </>
            )}
            {errors.departmentId && <span className={styles.error}>{errors.departmentId.message}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tags">Tags</label>
          <input id="tags" type="text" {...register('tags')} placeholder="e.g. onboarding, payroll, leave" />
        </div>

        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Articles submitted for review will be checked and approved by your <strong>Department Manager</strong> before Admin publishes them to tenants.
        </p>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
            onClick={() => setSubmitForApproval(true)}
          >
            {isSubmitting && submitForApproval ? 'Submitting...' : 'Submit for Approval'}
          </button>
          <button
            type="submit"
            className={styles.draftBtn}
            disabled={isSubmitting}
            onClick={() => setSubmitForApproval(false)}
          >
            {isSubmitting && !submitForApproval ? 'Saving...' : 'Save as Draft'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate(basePath)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
