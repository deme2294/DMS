import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { createNotice } from '../../api/noticeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import styles from './CeoNotices.module.css';

type NoticeFormValues = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'published' | 'archived';
  targetAudience: 'all' | 'admin' | 'manager' | 'staff' | 'tenant' | 'department';
  departmentId?: string;
  expiresAt?: string;
};

export default function CeoNoticesCreate() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NoticeFormValues>({
    defaultValues: {
      priority: 'medium',
      status: 'draft',
      targetAudience: 'all',
      departmentId: '',
    },
  });

  const selectedAudience = watch('targetAudience');

  useEffect(() => {
    fetchActiveDepartments()
      .then((res) => setDepartments(res.data.data || []))
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  const onSubmit = async (values: NoticeFormValues) => {
    setSaving(true);
    setServerError('');
    try {
      const payload: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        targetAudience: values.targetAudience,
        departmentId: values.departmentId || null,
      };
      if (values.expiresAt) {
        payload.expiresAt = values.expiresAt.replace('T', ' ') + ':00';
      } else {
        payload.expiresAt = null;
      }

      await createNotice(payload);
      navigate('/ceo/notices');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(e?.response?.data?.message || 'Failed to create notice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
        <PageHeader
          title="Create Executive Notice"
          description="Create and publish a new executive notice or announcement"
          backTo="/ceo/notices"
        />

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
          {serverError && <div className={styles.errorBanner}>{serverError}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Minimum 3 characters' } })}
              placeholder="Notice title"
            />
            {errors.title && <span className={styles.fieldError}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              rows={6}
              {...register('description', { required: 'Description is required' })}
              placeholder="Notice content..."
            />
            {errors.description && <span className={styles.fieldError}>{errors.description.message}</span>}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="priority">Priority</label>
              <select id="priority" {...register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="status">Status</label>
              <select id="status" {...register('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="targetAudience">Target Audience</label>
              <select id="targetAudience" {...register('targetAudience')}>
                <option value="all">All (Organization-wide)</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="tenant">Tenant</option>
                <option value="department">Department</option>
              </select>
            </div>

            {(selectedAudience === 'department' || selectedAudience === 'staff' || selectedAudience === 'manager') && (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">
                  {selectedAudience === 'department' ? 'Department *' : 'Department (Optional / All if unselected)'}
                </label>
                <select
                  id="departmentId"
                  {...register('departmentId', { required: selectedAudience === 'department' ? 'Department is required' : false })}
                >
                  <option value="">
                    {selectedAudience === 'department' ? 'Select department...' : 'All Departments (No restriction)'}
                  </option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {errors.departmentId && <span className={styles.fieldError}>{errors.departmentId.message}</span>}
              </div>
            )}
          </div>

            <div className={styles.formGroup}>
              <label htmlFor="expiresAt">Expires At (optional)</label>
              <input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
            </div>

            <p className={styles.hint}>
              Publishing notifies every user in the selected audience by email and in-app.
              When the notice expires, recipients who have not acknowledged it are sent an
              expiry warning through both channels, and the notice is automatically archived.
            </p>

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={() => navigate('/ceo/notices')}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Creating...' : 'Create Notice'}
            </button>
          </div>
        </form>
      </div>
  );
}
