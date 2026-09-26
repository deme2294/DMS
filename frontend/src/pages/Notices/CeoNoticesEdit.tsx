import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { fetchNotice, updateNotice } from '../../api/noticeApi';
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

const formatDateForInput = (value: string) => {
  const d = new Date(value.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CeoNoticesEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [creatorDepartments, setCreatorDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [creatorInfo, setCreatorInfo] = useState<{ name?: string; role?: string; dept?: string }>({});

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NoticeFormValues>();

  const selectedAudience = watch('targetAudience');

  useEffect(() => {
    fetchActiveDepartments()
      .then((res) => setDepartments(res.data.data || []))
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchNotice(id)
      .then((res) => {
        const n = res.data.data;
        const targetAudience = n.targetAudience ?? (n as any).target_audience ?? 'all';
        const departmentId = n.departmentId ?? (n as any).department_id ?? '';
        const expiresAt = n.expiresAt ?? (n as any).expires_at;

        let creatorDepts = (n as any).creatorDepartments || [];
        if (creatorDepts.length === 0 && departmentId && (n as any).department_name) {
          creatorDepts = [{ id: departmentId, name: (n as any).department_name, code: '' }];
        }
        setCreatorDepartments(creatorDepts);

        setCreatorInfo({
          name: (n as any).creator_first_name ? `${(n as any).creator_first_name} ${(n as any).creator_last_name}` : (n as any).createdByName,
          role: (n as any).creator_role,
          dept: (n as any).department_name,
        });

        reset({
          title: n.title,
          description: n.description,
          priority: n.priority as NoticeFormValues['priority'],
          status: n.status as NoticeFormValues['status'],
          targetAudience: targetAudience as NoticeFormValues['targetAudience'],
          departmentId: departmentId,
          expiresAt: expiresAt ? formatDateForInput(expiresAt) : '',
        });
      })
      .catch(() => setServerError('Failed to load notice'))
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => {
    if (selectedAudience === 'department') {
      if (creatorDepartments.length === 1) {
        setValue('departmentId', creatorDepartments[0].id);
      } else if (creatorDepartments.length > 1) {
        const current = watch('departmentId');
        if (!creatorDepartments.some((d) => d.id === current)) {
          setValue('departmentId', creatorDepartments[0].id);
        }
      }
    }
  }, [selectedAudience, creatorDepartments, setValue, watch]);

  const onSubmit = async (values: NoticeFormValues) => {
    if (!id) return;
    setSaving(true);
    setServerError('');
    try {
      if (values.targetAudience === 'department') {
        if (creatorDepartments.length === 0) {
          setServerError('Notice creator is not assigned to any department. Department-specific notices require a department.');
          setSaving(false);
          return;
        }
        if (!values.departmentId && creatorDepartments.length === 1) {
          values.departmentId = creatorDepartments[0].id;
        }
        if (!values.departmentId) {
          setServerError('Please select a valid department for this notice.');
          setSaving(false);
          return;
        }
      }

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

      await updateNotice(id, payload);
      navigate('/ceo/notices');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(e?.response?.data?.message || 'Failed to update notice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.page}>Loading...</div>;

  const isDepartmentAudienceBlocked = selectedAudience === 'department' && creatorDepartments.length === 0;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit Executive Notice"
        description={
          creatorInfo.name
            ? `Created by ${creatorInfo.name} (${creatorInfo.role || 'User'})${creatorInfo.dept ? ` • Dept: ${creatorInfo.dept}` : ''}`
            : 'Update and manage executive notice delivery and audience'
        }
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

          {selectedAudience === 'department' ? (
            creatorDepartments.length === 0 ? (
              <div className={styles.formGroup}>
                <label>Department *</label>
                <div className={styles.warningBox}>
                  <span>⚠️</span>
                  <div>
                    <strong>No department assigned:</strong> The notice creator has no assigned department. Department-specific notices can only target the creator's department.
                  </div>
                </div>
              </div>
            ) : creatorDepartments.length === 1 ? (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">
                  Department * <span className={styles.deptNoticeBadge}>Creator's Department</span>
                </label>
                <input
                  id="departmentId-readonly"
                  type="text"
                  readOnly
                  value={`${creatorDepartments[0].name}${creatorDepartments[0].code ? ` (${creatorDepartments[0].code})` : ''}`}
                  className={styles.readOnlyInput}
                />
                <input
                  type="hidden"
                  {...register('departmentId', { required: 'Department is required' })}
                  value={creatorDepartments[0].id}
                />
                <span className={styles.helperText}>
                  Locked to the notice creator's department ({creatorDepartments[0].name}).
                </span>
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">
                  Department * <span className={styles.deptNoticeBadge}>Creator's Departments</span>
                </label>
                <select
                  id="departmentId"
                  {...register('departmentId', { required: 'Department is required' })}
                >
                  <option value="">Select creator's department...</option>
                  {creatorDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {dept.code ? `(${dept.code})` : ''}
                    </option>
                  ))}
                </select>
                {errors.departmentId && <span className={styles.fieldError}>{errors.departmentId.message}</span>}
                <span className={styles.helperText}>
                  Restricted to the departments assigned to the notice creator.
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

        <p className={styles.hint}>
          Publishing notifies every user in the selected audience/department by email and in-app.
          When the notice expires, recipients who have not acknowledged it are sent an
          expiry warning through both channels, and the notice is automatically archived.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/ceo/notices')}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || isDepartmentAudienceBlocked}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
