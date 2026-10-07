import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { User, UserFormValues, RoleOption } from '../../types/user';
import styles from './UserForm.module.css';

type Props = {
  initialData?: User | null;
  roles: RoleOption[];
  departments: { id: string; name: string }[];
  onSubmit: (values: UserFormValues) => Promise<void>;
  loading?: boolean;
  onCancel?: () => void;
  isSelf?: boolean;
};

export default function UserForm({
  initialData,
  roles,
  departments,
  onSubmit,
  loading,
  onCancel,
  isSelf,
}: Props) {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    defaultValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      roleId: roles[0]?.id || 1,
      status: 'active',
      departmentId: null,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        username: initialData.username,
        email: initialData.email,
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        phone: initialData.phone || '',
        roleId: initialData.roleId || roles.find((r) => r.name === initialData.role)?.id || 1,
        status: initialData.status,
        departmentId: initialData.departments?.[0]?.id || null,
      });
    }
  }, [initialData, reset, roles]);

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Personal Details</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>First Name <span className={styles.required}>*</span></label>
            <input {...register('firstName', { required: true })} placeholder="Enter first name" />
            {errors.firstName && <span className={styles.error}>First name is required</span>}
          </div>

          <div className={styles.field}>
            <label>Last Name <span className={styles.required}>*</span></label>
            <input {...register('lastName', { required: true })} placeholder="Enter last name" />
            {errors.lastName && <span className={styles.error}>Last name is required</span>}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account Credentials</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Username <span className={styles.required}>*</span></label>
            <input {...register('username', { required: true, minLength: 3 })} placeholder="Choose a username" />
            {errors.username && <span className={styles.error}>Username is required (min 3 chars)</span>}
          </div>

          <div className={styles.field}>
            <label>Email Address <span className={styles.required}>*</span></label>
            <input type="email" {...register('email', { required: true })} placeholder="user@organization.com" />
            {errors.email && <span className={styles.error}>Valid email is required</span>}
          </div>

          {!initialData && (
            <div className={styles.field}>
              <label>Password <span className={styles.required}>*</span></label>
              <input type="password" {...register('password', { required: true, minLength: 8 })} placeholder="••••••••" />
              {errors.password && <span className={styles.error}>Password required (min 8 chars)</span>}
            </div>
          )}

          <div className={styles.field}>
            <label>Phone Number</label>
            <input {...register('phone')} placeholder="+1 (555) 000-0000" />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Role & Department Access</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>System Role <span className={styles.required}>*</span></label>
            <select {...register('roleId', { required: true, valueAsNumber: true })}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Account Status {isSelf && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>(Cannot deactivate own account)</span>}</label>
            <select {...register('status')} disabled={isSelf}>
              <option value="active">Active</option>
              <option value="inactive" disabled={isSelf}>Inactive</option>
            </select>
          </div>

          {initialData?.userCode && (
            <div className={styles.field}>
              <label>Registered User ID</label>
              <input type="text" value={initialData.userCode} disabled />
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <label>Assigned Department</label>
          <select {...register('departmentId')}>
            <option value="">None</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label>Profile Image</label>
          <input type="file" accept="image/*" {...register('profileImage')} />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={handleCancelClick} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
}