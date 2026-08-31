import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Tenant, TenantFormValues } from '../../types/tenant';
import styles from './TenantForm.module.css';

type Props = {
  initialData?: Tenant | null;
  showLoginFields?: boolean;
  onSubmit: (values: TenantFormValues) => Promise<void>;
  loading?: boolean;
};

export default function TenantForm({
  initialData,
  showLoginFields = false,
  onSubmit,
  loading,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormValues>({
    defaultValues: {
      organizationName: '',
      registrationNumber: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      status: 'active',
      username: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  useEffect(() => {
    if (initialData) {
      reset({
        organizationName: initialData.organizationName,
        registrationNumber: initialData.registrationNumber || '',
        contactPerson: initialData.contactPerson,
        email: initialData.email,
        phone: initialData.phone || '',
        address: initialData.address || '',
        notes: initialData.notes || '',
        status: initialData.status,
      });
    }
  }, [initialData, reset]);

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.sectionTitle}>Organization Information</div>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="organizationName" className={styles.label}>Organization Name <span className={styles.required}>*</span></label>
          <input
            id="organizationName"
            className={errors.organizationName ? styles.inputError : styles.input}
            {...register('organizationName', { required: 'Organization name is required' })}
            placeholder="Enter organization name"
          />
          {errors.organizationName && <span className={styles.errorText}>{errors.organizationName.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="registrationNumber" className={styles.label}>Registration Number / Organization ID <span className={styles.required}>*</span></label>
          <input
            id="registrationNumber"
            className={styles.input}
            {...register('registrationNumber', { required: 'Registration number is required' })}
            placeholder="e.g. REG-2024-001"
          />
          {errors.registrationNumber && <span className={styles.errorText}>{errors.registrationNumber.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="contactPerson" className={styles.label}>Contact Person <span className={styles.required}>*</span></label>
          <input
            id="contactPerson"
            className={errors.contactPerson ? styles.inputError : styles.input}
            {...register('contactPerson', { required: 'Contact person is required' })}
            placeholder="Full name"
          />
          {errors.contactPerson && <span className={styles.errorText}>{errors.contactPerson.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Email <span className={styles.required}>*</span></label>
          <input
            id="email"
            type="email"
            className={errors.email ? styles.inputError : styles.input}
            {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' } })}
            placeholder="contact@example.com"
          />
          {errors.email && <span className={styles.errorText}>{errors.email.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="phone" className={styles.label}>Phone Number <span className={styles.required}>*</span></label>
          <input
            id="phone"
            className={errors.phone ? styles.inputError : styles.input}
            {...register('phone', { required: 'Phone number is required' })}
            placeholder="+1 555-0100"
          />
          {errors.phone && <span className={styles.errorText}>{errors.phone.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="status" className={styles.label}>Status</label>
          <select id="status" className={styles.input} {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            {showLoginFields && !initialData && <option value="pending">Pending</option>}
          </select>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="address" className={styles.label}>Address</label>
        <textarea
          id="address"
          rows={3}
          className={styles.textarea}
          {...register('address')}
          placeholder="Street address, city, state, zip"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="notes" className={styles.label}>Notes</label>
        <textarea
          id="notes"
          rows={3}
          className={styles.textarea}
          {...register('notes')}
          placeholder="Additional information about the tenant"
        />
      </div>

      {showLoginFields && !initialData && (
        <>
          <div className={styles.sectionTitle}>Login Information</div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>Username <span className={styles.required}>*</span></label>
              <input
                id="username"
                className={errors.username ? styles.inputError : styles.input}
                {...register('username', { required: 'Username is required', minLength: { value: 3, message: 'Username must be at least 3 characters' } })}
                placeholder="tenant_user"
              />
              {errors.username && <span className={styles.errorText}>{errors.username.message}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Password <span className={styles.required}>*</span></label>
              <input
                id="password"
                type="password"
                className={errors.password ? styles.inputError : styles.input}
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Password must be at least 8 characters' } })}
                placeholder="Min 8 characters"
              />
              {errors.password && <span className={styles.errorText}>{errors.password.message}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword" className={styles.label}>Confirm Password <span className={styles.required}>*</span></label>
              <input
                id="confirmPassword"
                type="password"
                className={errors.confirmPassword ? styles.inputError : styles.input}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  validate: (value) => value === passwordValue || 'Passwords do not match'
                })}
                placeholder="Re-enter password"
              />
              {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword.message}</span>}
            </div>
          </div>
        </>
      )}

      <div className={styles.actions}>
        <button type="submit" disabled={isSubmitting || loading} className={styles.submitBtn}>
          {isSubmitting || loading ? (
            <span className={styles.spinner} />
          ) : null}
          {isSubmitting || loading ? 'Saving...' : initialData ? 'Update Tenant' : 'Create Tenant'}
        </button>
      </div>
    </form>
  );
}
