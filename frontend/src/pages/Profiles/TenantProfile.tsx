import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  BuildingOffice2Icon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
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
    setMessage('Organization profile updated successfully.');
  };

  if (!tenant) return <div className={styles.loadingPage}>Loading organization profile...</div>;

  return (
    <div className={styles.page}>
      {/* Hero Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroBanner}>
          <div className={styles.heroRoleBadge}>
            <BuildingStorefrontIcon className={styles.heroBadgeIcon} />
            <span>ORGANIZATION PROFILE</span>
          </div>
        </div>

        <div className={styles.heroProfileRow}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarCircle}>
              <div className={styles.avatarFallback} style={{ background: 'linear-gradient(135deg, #db2777, #9d174d)' }}>
                {tenant.organizationName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <div className={styles.heroInfo}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>{tenant.organizationName}</h1>
              <span className={styles.onlineBadge}>
                <span className={styles.onlineDot} />
                Verified Tenant
              </span>
            </div>

            <div className={styles.heroMetaTags}>
              <span className={styles.metaTag}>
                <BuildingOffice2Icon className={styles.metaIcon} />
                {tenant.email || 'Registered Tenant'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={styles.toastSuccess}>
          <CheckCircleIcon className={styles.toastIcon} />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.formContainer}>
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionIconWrap} style={{ background: '#fdf2f8', color: '#db2777' }}>
                <BuildingOffice2Icon className={styles.sectionIcon} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Company Information</h2>
                <p className={styles.sectionSub}>Update your organization's primary contact and location details</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  <span>Primary Contact Person</span>
                  <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} />
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Contact full name"
                    {...register('contactPerson', { required: true })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Contact Phone</label>
                <div className={styles.inputWrapper}>
                  <PhoneIcon className={styles.inputIcon} />
                  <input
                    type="tel"
                    className={styles.inputField}
                    placeholder="+1 (555) 000-0000"
                    {...register('phone')}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Headquarters Address</label>
              <div className={styles.inputWrapper}>
                <MapPinIcon className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="Street address, City, Country"
                  {...register('address')}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Organizational Notes</label>
              <div className={styles.inputWrapper} style={{ alignItems: 'flex-start' }}>
                <DocumentTextIcon className={styles.inputIcon} style={{ marginTop: '3px' }} />
                <textarea
                  rows={3}
                  className={styles.inputField}
                  placeholder="Additional notes about your team or service requirements..."
                  {...register('notes')}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.submitBar}>
          <button
            type="submit"
            className={styles.saveProfileBtn}
            disabled={isSubmitting}
          >
            <CheckCircleIcon className={styles.btnIcon} />
            <span>{isSubmitting ? 'Saving...' : 'Save Organization Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}