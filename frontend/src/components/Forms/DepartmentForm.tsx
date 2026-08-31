import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type {
  Department,
  DepartmentFormValues,
  DepartmentHeadOption,
  DepartmentMember,
} from '../../types/department';
import styles from './DepartmentForm.module.css';

type Props = {
  initialData?: Department | null;
  heads: DepartmentHeadOption[];
  users: DepartmentMember[];
  onSubmit: (values: DepartmentFormValues) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
};

export default function DepartmentForm({
  initialData,
  heads,
  users,
  onSubmit,
  onCancel,
  loading,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    defaultValues: {
      name: '',
      code: '',
      description: '',
      headUserId: '',
      status: 'active',
      memberIds: [],
    },
  });

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        code: initialData.code,
        description: initialData.description || '',
        headUserId: initialData.headUserId || '',
        status: initialData.status,
        memberIds: initialData.memberIds || [],
      });
      setSelectedMembers(initialData.memberIds || []);
    }
  }, [initialData, reset]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, memberSearch]);

  const onFormSubmit = (values: DepartmentFormValues) => {
    onSubmit({ ...values, memberIds: selectedMembers });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onFormSubmit)}>
      <div className={styles.grid}>
        <div className={styles.formGroup}>
          <label htmlFor="name">Department Name *</label>
          <input
            id="name"
            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
            placeholder="e.g. Human Resources"
          />
          {errors.name && <span className={styles.error}>{errors.name.message}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="code">Department Code *</label>
          <input
            id="code"
            {...register('code', {
              required: 'Code is required',
              minLength: { value: 2, message: 'Min 2 characters' },
              pattern: { value: /^[A-Za-z0-9_-]+$/, message: 'Letters, numbers, - and _ only' },
            })}
            placeholder="e.g. HR"
          />
          {errors.code && <span className={styles.error}>{errors.code.message}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="status">Status</label>
          <select id="status" {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="headUserId">Department Head</label>
          <select id="headUserId" {...register('headUserId')}>
            <option value="">— No head assigned —</option>
            {heads.map((head) => (
              <option key={head.id} value={head.id}>
                {head.fullName} ({head.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={4}
          {...register('description')}
          placeholder="Brief description of the department's responsibilities..."
        />
      </div>

      <div className={styles.formGroup}>
        <div className={styles.membersHeader}>
          <label>Assign Users to Department</label>
          <span className={styles.memberCount}>{selectedMembers.length} selected</span>
        </div>
        <input
          className={styles.memberSearch}
          placeholder="Search users by name, email or role..."
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
        />
        <div className={styles.memberGrid}>
          {filteredUsers.map((u) => {
            const checked = selectedMembers.includes(u.id);
            return (
              <label
                key={u.id}
                className={`${styles.memberItem} ${checked ? styles.memberItemActive : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(u.id)}
                />
                <span className={styles.memberName}>
                  {u.firstName} {u.lastName}
                </span>
                <span className={styles.memberMeta}>{u.role} · {u.email}</span>
              </label>
            );
          })}
          {filteredUsers.length === 0 && (
            <p className={styles.empty}>No users match your search.</p>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Department' : 'Create Department'}
        </button>
      </div>
    </form>
  );
}
