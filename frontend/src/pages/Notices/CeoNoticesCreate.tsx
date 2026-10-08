import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { createNotice, getMyDepartments } from '../../api/noticeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import styles from './CeoNotices.module.css';

type NoticeFormValues = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  targetAudience: 'all' | 'admin' | 'manager' | 'staff' | 'tenant' | 'department';
  departmentId?: string;
  expiresAt?: string;
};

export default function CeoNoticesCreate() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishIntent, setPublishIntent] = useState<'draft' | 'published'>('draft');
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [myDepartments, setMyDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NoticeFormValues>({
    defaultValues: {
      priority: 'medium',
      targetAudience: 'all',
      departmentId: '',
    },
  });

  const selectedAudience = watch('targetAudience');

  useEffect(() => {
    Promise.all([
      getMyDepartments().catch(() => ({ data: { data: [] } })),
      fetchActiveDepartments().catch(() => ({ data: { data: [] } })),
    ])
      .then(([myRes, allRes]) => {
        const myDepts = myRes.data.data || [];
        setMyDepartments(myDepts);
        setDepartments(allRes.data.data || []);
      })
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  useEffect(() => {
    if (selectedAudience === 'department') {
      if (myDepartments.length === 1) {
        setValue('departmentId', myDepartments[0].id);
      } else if (myDepartments.length > 1) {
        const current = watch('departmentId');
        if (!myDepartments.some((d) => d.id === current)) {
          setValue('departmentId', '');
        }
      } else {
        setValue('departmentId', '');
      }
    }
  }, [selectedAudience, myDepartments, setValue, watch]);

  const onSubmit = async (values: NoticeFormValues) => {
    setSaving(true);
    setServerError('');
    try {
      if (values.targetAudience === 'department') {
        if (myDepartments.length === 0) {
          setServerError('You are not assigned to any department. Department-targeted notices require an assigned department.');
          setSaving(false);
          return;
        }
        if (!values.departmentId && myDepartments.length === 1) {
          values.departmentId = myDepartments[0].id;
        }
        if (!values.departmentId) {
          setServerError('Please select your department for this notice.');
          setSaving(false);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: publishIntent,
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

  const isDepartmentAudienceBlocked = selectedAudience === 'department' && myDepartments.length === 0;

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
            {...register('description', { required: 'Description is required', minLength: { value: 50, message: 'Description must be at least 50 characters' } })}
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

          {selectedAudience === 'department' ? (
            myDepartments.length === 0 ? (
              <div className={styles.formGroup}>
                <label>Department *</label>
                <div className={styles.warningBox}>
                  <span>⚠️</span>
                  <div>
                    <strong>No department assigned:</strong> You are not currently assigned to any department. Department-specific notices can only be created for your own department.
                  </div>
                </div>
              </div>
            ) : myDepartments.length === 1 ? (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">
                  Department * <span className={styles.deptNoticeBadge}>Creator's Department</span>
                </label>
                <input
                  id="departmentId-readonly"
                  type="text"
                  readOnly
                  value={`${myDepartments[0].name} (${myDepartments[0].code})`}
                  className={styles.readOnlyInput}
                />
                <input
                  type="hidden"
                  {...register('departmentId', { required: 'Department is required' })}
                  value={myDepartments[0].id}
                />
                <span className={styles.helperText}>
                  Restricted to your assigned department ({myDepartments[0].name}).
                </span>
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">
                  Department * <span className={styles.deptNoticeBadge}>Your Departments</span>
                </label>
                <select
                  id="departmentId"
                  {...register('departmentId', { required: 'Department is required' })}
                >
                  <option value="">Select your department...</option>
                  {myDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {errors.departmentId && <span className={styles.fieldError}>{errors.departmentId.message}</span>}
                <span className={styles.helperText}>
                  Restricted to the departments you belong to.
                </span>
              </div>
            )
          ) : (selectedAudience === 'staff' || selectedAudience === 'manager') ? (
            <div className={styles.formGroup}>
              <label htmlFor="departmentId">Department (Optional / All if unselected)</label>
              <select id="departmentId" {...register('departmentId')}>
                <option value="">All Departments (No restriction)</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="expiresAt">Expires At (optional)</label>
          <input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
        </div>

        <div className={styles.hint}>
          <span className={styles.hintIcon}>💡</span>
          <span>
            Publishing notifies every user in the selected audience by email and in-app.
            When the notice expires, recipients who have not acknowledged it are sent an
            expiry warning through both channels, and the notice is automatically archived.
          </span>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/ceo/notices')}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.btnSecondary}
            disabled={saving || isDepartmentAudienceBlocked}
            onClick={() => setPublishIntent('draft')}
          >
            {saving && publishIntent === 'draft' ? 'Saving...' : (
              <><span className={styles.btnIcon}>📝</span> Save as Draft</>
            )}
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || isDepartmentAudienceBlocked}
            onClick={() => setPublishIntent('published')}
          >
            {saving && publishIntent === 'published' ? 'Publishing...' : (
              <><span className={styles.btnIcon}>🚀</span> Publish Now</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
