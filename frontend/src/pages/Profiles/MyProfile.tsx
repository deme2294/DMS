import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../context/AuthContext';
import { updateMyProfile, getMe } from '../../api/authApi';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import styles from './Profile.module.css';

type ProfileForm = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function MyProfile() {
  const { user, updateUser } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.profileImage || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch } = useForm<ProfileForm>({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const newPassword = watch('newPassword');

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
      });
      setPhotoPreview(user.profileImage || null);
    }
  }, [user, reset]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (values: ProfileForm) => {
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('email', values.email);
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('phone', values.phone);

      if (values.currentPassword) formData.append('currentPassword', values.currentPassword);
      if (values.newPassword) formData.append('newPassword', values.newPassword);
      if (values.confirmPassword) formData.append('confirmPassword', values.confirmPassword);

      if (photoFile) {
        formData.append('profileImage', photoFile);
      }

      const res = await updateMyProfile(formData);
      updateUser(res.data.data);
      setMessage('Profile updated successfully');
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const meRes = await getMe();
      updateUser(meRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>My Profile</h1>
        <p className={styles.headerDescription}>Update your account information and preferences</p>
      </div>

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={styles.errorToast}>{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Profile Information</h2>

          <div className={styles.form}>
            <div className={styles.photoSection}>
              <div className={styles.photoPreview}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" />
                ) : (
                  <div className={styles.photoPlaceholder}>
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                )}
              </div>
              <div className={styles.photoActions}>
                <span className={styles.photoLabel}>Profile Photo</span>
                <div className={styles.fileInputWrapper}>
                  <span className={styles.fileInputBtn}>Choose Photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoChange}
                    className={styles.fileInput}
                  />
                </div>
                <span className={styles.hint}>JPG, PNG, WebP or GIF. Max 2MB.</span>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Username</label>
                <input {...register('username', { required: true, minLength: 3, maxLength: 80 })} />
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input type="email" {...register('email', { required: true })} />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>First Name</label>
                <input {...register('firstName', { required: true })} />
              </div>
              <div className={styles.formGroup}>
                <label>Last Name</label>
                <input {...register('lastName', { required: true })} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Phone</label>
              <input
                {...register('phone', {
                  pattern: {
                    value: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
                    message: 'Invalid international phone number',
                  },
                })}
                placeholder="+1 (555) 000-0000"
              />
              <span className={styles.hint}>Include country code, e.g. +1 555 000 0000</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>🎨</div>
            <div>
              <h2 className={styles.sectionTitle}>Theme & Appearance</h2>
              <p className={styles.sectionDescription}>Choose your preferred application theme mode</p>
            </div>
          </div>
          <div className={styles.form} style={{ paddingTop: '12px' }}>
            <div className={styles.divider} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingTop: '8px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-primary, #0f172a)' }}>Theme Preference</strong>
                <span className={styles.hint}>Switch between Light (White), Night (Dark/Black), or System automatic default mode</span>
              </div>
              <ThemeToggle showLabels={true} />
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>🔒</div>
            <div>
              <h2 className={styles.sectionTitle}>Change Password</h2>
              <p className={styles.sectionDescription}>Leave blank to keep your current password</p>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.divider} />

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Current Password</label>
                <div className={styles.passwordField}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    {...register('currentPassword')}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className={styles.passwordToggle}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? (
                      <EyeSlashIcon className={styles.passwordIcon} />
                    ) : (
                      <EyeIcon className={styles.passwordIcon} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>New Password</label>
                <div className={styles.passwordField}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    {...register('newPassword', { minLength: 8 })}
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className={styles.passwordToggle}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <EyeSlashIcon className={styles.passwordIcon} />
                    ) : (
                      <EyeIcon className={styles.passwordIcon} />
                    )}
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Confirm New Password</label>
                <div className={styles.passwordField}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword')}
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className={styles.passwordToggle}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className={styles.passwordIcon} />
                    ) : (
                      <EyeIcon className={styles.passwordIcon} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}