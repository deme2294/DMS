import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { fetchMyTenantProfile, updateMyTenantProfile } from '../../api/tenantApi';
import type { Tenant } from '../../types/tenant';
import styles from './Profile.module.css';

type ProfileForm = {
  contactPerson: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export default function TenantProfile() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [message, setMessage] = useState('');
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ProfileForm>();

  useEffect(() => {
    fetchMyTenantProfile().then((res) => {
      setTenant(res.data.data);
      reset({
        contactPerson: res.data.data.contactPerson,
        phone: res.data.data.phone || '',
        address: res.data.data.address || '',
        notes: res.data.data.notes || '',
      });
    });
  }, [reset]);

  const onSubmit = async (values: ProfileForm) => {
    const res = await updateMyTenantProfile(values);
    setTenant(res.data.data);
    setMessage('Profile updated successfully');
  };

  if (!tenant) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <h1>Organization Profile</h1>
      <p className={styles.orgName}>{tenant.organizationName}</p>

      {message && <div className={styles.toast}>{message}</div>}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <label>Contact Person</label>
        <input {...register('contactPerson', { required: true })} />

        <label>Phone</label>
        <input {...register('phone')} />

        <label>Address</label>
        <textarea rows={3} {...register('address')} />

        <label>Notes</label>
        <textarea rows={3} {...register('notes')} />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}