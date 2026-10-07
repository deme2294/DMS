import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  KeyIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  CameraIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  IdentificationIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemePreference } from '../../context/ThemeContext';
import { updateMyProfile, getMe } from '../../api/authApi';
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
  const { themePreference, setThemePreference } = useTheme();
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
  const confirmPassword = watch('confirmPassword');

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
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file size exceeds 2MB limit.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (values: ProfileForm) => {
    setMessage('');
    setError('');

    if (values.newPassword && values.newPassword !== values.confirmPassword) {
      setError('New passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('email', values.email);
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('phone', values.phone || '');

      if (values.currentPassword) formData.append('currentPassword', values.currentPassword);
      if (values.newPassword) formData.append('newPassword', values.newPassword);
      if (values.confirmPassword) formData.append('confirmPassword', values.confirmPassword);

      if (photoFile) {
        formData.append('profileImage', photoFile);
      }

      const res = await updateMyProfile(formData);
      updateUser(res.data.data);
      setMessage('Your profile and account settings have been saved successfully.');
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const meRes = await getMe();
      updateUser(meRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className={styles.loadingPage}>Loading profile...</div>;

  const roleLabel = (user.role || 'user').toUpperCase();

  const themeOptions: { id: ThemePreference; title: string; desc: string; icon: any }[] = [
    {
      id: 'light',
      title: 'Light (White)',
      desc: 'Crisp bright workspace for daytime clarity',
      icon: SunIcon,
    },
    {
      id: 'dark',
      title: 'Night (Dark)',
      desc: 'High contrast dark surfaces easy on the eyes',
      icon: MoonIcon,
    },
    {
      id: 'system',
      title: 'System Auto',
      desc: 'Synchronizes automatically with device OS',
      icon: ComputerDesktopIcon,
    },
  ];

  const hasAssignedDepartments = Boolean(user.departments && user.departments.length > 0);
  const departmentDisplayText = hasAssignedDepartments
    ? user.departments!.map((d) => d.name).join(', ')
    : user.role === 'admin'
    ? 'Central Administration (All Departments)'
    : user.role === 'ceo'
    ? 'Executive Suite (All Departments)'
    : user.tenantName
    ? `${user.tenantName} (Client Organization)`
    : 'Not Assigned';

  return (
    <div className={styles.page}>
      {/* Profile Hero Header Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroBanner}>
          <div className={styles.heroBannerBadges}>
            <div className={styles.heroDeptBadge} title="Organizational / Departmental Unit">
              <BuildingOffice2Icon className={styles.heroBadgeIcon} />
              <span>
                {hasAssignedDepartments
                  ? user.departments![0].name + (user.departments!.length > 1 ? ` (+${user.departments!.length - 1})` : '')
                  : user.role === 'admin'
                  ? 'Central Administration'
                  : user.role === 'ceo'
                  ? 'Executive Suite'
                  : user.tenantName || 'IT Park Tenant'}
              </span>
            </div>
            <div className={styles.heroRoleBadge}>
              <ShieldCheckIcon className={styles.heroBadgeIcon} />
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className={styles.heroProfileRow}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarCircle}>
              {photoPreview ? (
                <img src={photoPreview} alt="User Avatar" className={styles.avatarImg} />
              ) : (
                <div className={styles.avatarFallback}>
                  {(user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase()}
                  {(user.lastName?.[0] || '').toUpperCase()}
                </div>
              )}
            </div>

            <label className={styles.avatarUploadBtn} title="Upload new photo">
              <CameraIcon className={styles.avatarUploadIcon} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoChange}
                className={styles.hiddenFileInput}
              />
            </label>
          </div>

          <div className={styles.heroInfo}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>
                {user.firstName ? `${user.firstName} ${user.lastName}` : user.username}
              </h1>
              <span className={styles.onlineBadge}>
                <span className={styles.onlineDot} />
                Active
              </span>
            </div>

            <div className={styles.heroMetaTags}>
              <span className={styles.metaTag}>
                <EnvelopeIcon className={styles.metaIcon} />
                {user.email}
              </span>
              <span className={styles.metaTag}>
                <IdentificationIcon className={styles.metaIcon} />
                @{user.username}
              </span>
              <span className={styles.metaTag}>
                <ShieldCheckIcon className={styles.metaIcon} />
                Role: {roleLabel}
              </span>
              <span className={styles.deptMetaTag} title="Department / Organization">
                <BuildingOffice2Icon className={styles.deptMetaIcon} />
                <span>Dept: {departmentDisplayText}</span>
              </span>
            </div>
          </div>

          {photoPreview && (
            <div className={styles.photoControlGroup}>
              <button
                type="button"
                className={styles.removePhotoBtn}
                onClick={handleRemovePhoto}
                title="Remove photo preview"
              >
                <TrashIcon className={styles.btnMiniIcon} />
                <span>Remove Photo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div className={styles.toastSuccess}>
          <CheckCircleIcon className={styles.toastIcon} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className={styles.toastError}>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.formContainer}>
        {/* Section 1: Personal Profile Details */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionIconWrap} style={{ background: '#eff6ff', color: '#2563eb' }}>
                <UserCircleIcon className={styles.sectionIcon} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Personal & Account Information</h2>
                <p className={styles.sectionSub}>Update your personal identification and communication channels</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  <span>First Name</span>
                  <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="First Name"
                    {...register('firstName', { required: true })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  <span>Last Name</span>
                  <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Last Name"
                    {...register('lastName', { required: true })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  <span>Username</span>
                  <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <IdentificationIcon className={styles.inputIcon} />
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Username"
                    {...register('username', { required: true, minLength: 3, maxLength: 80 })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  <span>Work Email</span>
                  <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <EnvelopeIcon className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="name@company.com"
                    {...register('email', { required: true })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Phone Number</label>
              <div className={styles.inputWrapper}>
                <PhoneIcon className={styles.inputIcon} />
                <input
                  type="tel"
                  className={styles.inputField}
                  placeholder="+1 (555) 000-0000"
                  {...register('phone')}
                />
              </div>
              <span className={styles.fieldHint}>Include your country code for direct international contact.</span>
            </div>
          </div>
        </div>

        {/* Section 2: Department & Organizational Placement */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionIconWrap} style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <BuildingOffice2Icon className={styles.sectionIcon} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Department & Organizational Scope</h2>
                <p className={styles.sectionSub}>Your assigned organizational unit, department access, and workflow scope</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.deptGridDisplay}>
              <div className={styles.deptDisplayItem}>
                <span className={styles.deptItemLabel}>Operational Department</span>
                <div className={styles.deptItemValue}>
                  <BuildingOffice2Icon style={{ width: 18, height: 18, color: '#2563eb', flexShrink: 0 }} />
                  <span>{departmentDisplayText}</span>
                </div>
              </div>

              <div className={styles.deptDisplayItem}>
                <span className={styles.deptItemLabel}>Workflow Gate & Scope</span>
                <div className={styles.deptItemValue}>
                  <ShieldCheckIcon style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
                  <span>
                    {user.role === 'admin'
                      ? 'Full System & Central Compliance'
                      : user.role === 'manager'
                      ? 'Department Approval & Staff Routing'
                      : user.role === 'staff'
                      ? 'Department Operations & Ticket Resolution'
                      : user.role === 'ceo'
                      ? 'Executive Governance & Enterprise Oversight'
                      : 'Tenant Portal Requester'}
                  </span>
                </div>
              </div>

              {user.userCode && (
                <div className={styles.deptDisplayItem}>
                  <span className={styles.deptItemLabel}>Registered User ID</span>
                  <div className={styles.deptItemValue}>
                    <IdentificationIcon style={{ width: 18, height: 18, color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace' }}>{user.userCode}</span>
                  </div>
                </div>
              )}
            </div>

            {hasAssignedDepartments && (
              <div style={{ marginTop: 16 }}>
                <span className={styles.deptItemLabel} style={{ display: 'block', marginBottom: 8 }}>
                  Assigned Department Units ({user.departments!.length})
                </span>
                <div className={styles.deptBadgesList}>
                  {user.departments!.map((dept) => (
                    <div key={dept.id} className={styles.deptPill}>
                      <span className={styles.deptCodeBadge}>{dept.code}</span>
                      <span>{dept.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.deptPolicyNote}>
              <InformationCircleIcon className={styles.deptPolicyIcon} />
              <span>
                Department allocations and authorization boundaries are managed centrally by System Administrators.
                Contact the IT Help Desk Administration if your department assignment requires updates.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Theme & Appearance Preferences */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionIconWrap} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <PaintBrushIcon className={styles.sectionIcon} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Theme & Appearance Preferences</h2>
                <p className={styles.sectionSub}>Select how the Help Desk system renders across your devices</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.themeGrid}>
              {themeOptions.map((opt) => {
                const isSelected = themePreference === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.themeCard} ${isSelected ? styles.themeCardActive : ''}`}
                    onClick={() => setThemePreference(opt.id)}
                  >
                    <div className={styles.themeCardTop}>
                      <div className={styles.themeIconCircle}>
                        <IconComponent className={styles.themeOptionIcon} />
                      </div>
                      <div className={`${styles.themeRadio} ${isSelected ? styles.themeRadioActive : ''}`}>
                        {isSelected && <div className={styles.themeRadioDot} />}
                      </div>
                    </div>
                    <div className={styles.themeCardContent}>
                      <span className={styles.themeTitle}>{opt.title}</span>
                      <span className={styles.themeDesc}>{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: Security & Password Management */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionIconWrap} style={{ background: '#fffbeb', color: '#d97706' }}>
                <KeyIcon className={styles.sectionIcon} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Security & Credentials</h2>
                <p className={styles.sectionSub}>Manage your account password (leave blank to keep current password)</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Current Password</label>
              <div className={styles.inputWrapper}>
                <KeyIcon className={styles.inputIcon} />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  className={styles.inputField}
                  placeholder="Enter current password to authorize changes"
                  {...register('currentPassword')}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeSlashIcon className={styles.eyeIcon} /> : <EyeIcon className={styles.eyeIcon} />}
                </button>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>New Password</label>
                <div className={styles.inputWrapper}>
                  <KeyIcon className={styles.inputIcon} />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="Min 8 characters"
                    {...register('newPassword', { minLength: 8 })}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowNewPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeSlashIcon className={styles.eyeIcon} /> : <EyeIcon className={styles.eyeIcon} />}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Confirm New Password</label>
                <div className={styles.inputWrapper}>
                  <KeyIcon className={styles.inputIcon} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="Re-type new password"
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeSlashIcon className={styles.eyeIcon} /> : <EyeIcon className={styles.eyeIcon} />}
                  </button>
                </div>
              </div>
            </div>

            {newPassword && confirmPassword && (
              <div className={styles.passwordMatchStatus}>
                {newPassword === confirmPassword ? (
                  <span className={styles.matchOk}>✓ New passwords match</span>
                ) : (
                  <span className={styles.matchError}>✕ Passwords do not match yet</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className={styles.submitBar}>
          <button
            type="submit"
            className={styles.saveProfileBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Saving Profile...</span>
            ) : (
              <>
                <CheckCircleIcon className={styles.btnIcon} />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}