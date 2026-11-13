import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../../types/user';
import { updateUser } from '../../api/userApi';
import { toShortUserId } from '../../utils/idUtils';
import styles from './UserProfileModal.module.css';
import {
  XMarkIcon,
  PhotoIcon,
  TrashIcon,
  MagnifyingGlassPlusIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  UserIcon,
  StarIcon,
  ClockIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

export interface UserProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (updatedUser: User) => void;
  onContactUser?: (target: { email: string; name: string; roleOrType?: string }) => void;
  onEditUser?: (user: User) => void;
}

export default function UserProfileModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onContactUser,
  onEditUser,
}: UserProfileModalProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentUser(user);
    setSelectedFile(null);
    setPreviewUrl(null);
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [user, isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen || !currentUser) return null;

  const displayId = currentUser.userCode || (currentUser.id && /^\d{4}$/.test(currentUser.id) ? currentUser.id : toShortUserId(currentUser));

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    if (username) return username.slice(0, 2).toUpperCase();
    return 'US';
  };

  const getRoleGradient = (role: string) => {
    switch (role) {
      case 'admin':
        return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
      case 'ceo':
        return 'linear-gradient(135deg, #701a75 0%, #ec4899 100%)';
      case 'manager':
        return 'linear-gradient(135deg, #065f46 0%, #10b981 100%)';
      case 'staff':
        return 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)';
      case 'tenant':
        return 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
      default:
        return 'linear-gradient(135deg, #334155 0%, #64748b 100%)';
    }
  };

  const resolveImageUrl = (img?: string | null) => {
    if (!img) return '';
    if (img.startsWith('blob:') || img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }
    return `http://localhost:5000${img.startsWith('/') ? '' : '/'}${img}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size cannot exceed 5MB.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelNewImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveImage = async () => {
    if (!selectedFile || !currentUser) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('profileImage', selectedFile);

      const res = await updateUser(currentUser.id, formData);
      const updated = res.data?.data;
      if (updated) {
        setCurrentUser(updated);
        onUserUpdated?.(updated);
      } else {
        // Fallback update local state
        const updatedUser: User = {
          ...currentUser,
          profileImage: previewUrl || currentUser.profileImage,
        };
        setCurrentUser(updatedUser);
        onUserUpdated?.(updatedUser);
      }

      setSuccessMsg('Profile image successfully updated and saved!');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to upload profile image.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!currentUser) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('removeProfileImage', 'true');

      const res = await updateUser(currentUser.id, formData);
      const updated = res.data?.data;
      if (updated) {
        setCurrentUser(updated);
        onUserUpdated?.(updated);
      } else {
        const updatedUser: User = {
          ...currentUser,
          profileImage: null,
        };
        setCurrentUser(updatedUser);
        onUserUpdated?.(updatedUser);
      }

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccessMsg('Profile image removed. Reverted to default avatar.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to remove profile image.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentActiveImg = previewUrl || (currentUser.profileImage ? resolveImageUrl(currentUser.profileImage) : null);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleGroup}>
            <div className={styles.headerBadgeRow}>
              <span className={styles.headerBadge}>User Profile Details</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                ID: #{displayId}
              </span>
            </div>
            <h2 className={styles.modalTitle}>
              {currentUser.firstName} {currentUser.lastName}
            </h2>
            <p className={styles.modalSubtitle}>@{currentUser.username}</p>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close Profile">
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className={styles.modalBody}>
          {successMsg && (
            <div className={styles.alertSuccess}>
              <CheckCircleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className={styles.alertError}>
              <ExclamationCircleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Avatar View & Image Management Card ── */}
          <div className={styles.avatarHeroCard}>
            <div
              className={styles.avatarWrapper}
              onClick={() => {
                if (currentActiveImg) setIsEnlarged(true);
              }}
              title={currentActiveImg ? 'Click to inspect full-size image' : 'User Initials Avatar'}
            >
              {currentActiveImg ? (
                <img
                  src={currentActiveImg}
                  alt={`${currentUser.firstName} ${currentUser.lastName}`}
                  className={styles.avatarImg}
                />
              ) : (
                <div
                  className={styles.avatarFallback}
                  style={{ background: getRoleGradient(currentUser.role) }}
                >
                  {getInitials(currentUser.firstName, currentUser.lastName, currentUser.username)}
                </div>
              )}

              {currentActiveImg && (
                <div className={styles.avatarHoverOverlay}>
                  <MagnifyingGlassPlusIcon style={{ width: 22, height: 22 }} />
                  <span>Enlarge</span>
                </div>
              )}
            </div>

            <div className={styles.avatarControlsCol}>
              <div className={styles.avatarStatusRow}>
                {currentUser.profileImage || previewUrl ? (
                  <span className={`${styles.avatarStatusTag} ${styles.avatarStatusCustom}`}>
                    ✓ Custom Photo Uploaded
                  </span>
                ) : (
                  <span className={`${styles.avatarStatusTag} ${styles.avatarStatusDefault}`}>
                    Default System Initials
                  </span>
                )}
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>

              <p className={styles.avatarHelpText}>
                View user avatar in high resolution or upload/manage a new profile picture (PNG, JPG up to 5MB).
              </p>

              <div className={styles.avatarButtonsRow}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className={styles.btnUpload}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  title="Select image file from computer"
                >
                  <PhotoIcon style={{ width: 16, height: 16 }} />
                  <span>{currentUser.profileImage ? 'Change Photo' : 'Upload Photo'}</span>
                </button>

                {currentActiveImg && (
                  <button
                    type="button"
                    className={styles.btnViewEnlarge}
                    onClick={() => setIsEnlarged(true)}
                    title="Inspect photo in full resolution"
                  >
                    <MagnifyingGlassPlusIcon style={{ width: 15, height: 15 }} />
                    <span>View Large</span>
                  </button>
                )}

                {(currentUser.profileImage || previewUrl) && (
                  <button
                    type="button"
                    className={styles.btnRemovePhoto}
                    onClick={handleRemoveImage}
                    disabled={saving}
                    title="Remove custom photo and restore default initials"
                  >
                    <TrashIcon style={{ width: 15, height: 15 }} />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Pending Image Save Confirmation Bar ── */}
          {selectedFile && (
            <div className={styles.pendingImageBar}>
              <span className={styles.pendingImageLabel}>
                📷 New photo selected: "{selectedFile.name}" ({(selectedFile.size / 1024).toFixed(0)} KB)
              </span>
              <div className={styles.pendingActionBtns}>
                <button
                  type="button"
                  className={styles.btnSaveImage}
                  onClick={handleSaveImage}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <ArrowPathIcon style={{ width: 14, height: 14 }} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon style={{ width: 14, height: 14 }} />
                      <span>Save Photo</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.btnCancelSelection}
                  onClick={handleCancelNewImage}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── User Profile Information Grid ── */}
          <div className={styles.profileGrid}>
            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <UserIcon style={{ width: 14, height: 14 }} />
                <span>Full Name</span>
              </span>
              <span className={styles.cardValue}>
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className={styles.cardSub}>Username: @{currentUser.username}</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <EnvelopeIcon style={{ width: 14, height: 14 }} />
                <span>Email Address</span>
              </span>
              <span className={styles.cardValue}>{currentUser.email}</span>
              <span className={styles.cardSub}>Primary communication channel</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <ShieldCheckIcon style={{ width: 14, height: 14 }} />
                <span>Role & Permissions</span>
              </span>
              <span className={styles.cardValue} style={{ textTransform: 'capitalize' }}>
                {currentUser.role}
              </span>
              <span className={styles.cardSub}>System Access Level</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                <span>Department / Tenant</span>
              </span>
              <span className={styles.cardValue}>
                {currentUser.departments && currentUser.departments.length > 0
                  ? currentUser.departments.map((d) => d.name).join(', ')
                  : currentUser.tenantName || 'Standard / Unassigned'}
              </span>
              <span className={styles.cardSub}>Organizational unit</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <PhoneIcon style={{ width: 14, height: 14 }} />
                <span>Phone Contact</span>
              </span>
              <span className={styles.cardValue}>{currentUser.phone || 'No phone recorded'}</span>
              <span className={styles.cardSub}>Direct dial / extension</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <LockClosedIcon style={{ width: 14, height: 14 }} />
                <span>Account Status</span>
              </span>
              <span
                className={styles.cardValue}
                style={{
                  color:
                    currentUser.status === 'active'
                      ? '#16a34a'
                      : currentUser.status === 'locked'
                      ? '#dc2626'
                      : '#64748b',
                  textTransform: 'capitalize',
                }}
              >
                ● {currentUser.status}
              </span>
              <span className={styles.cardSub}>Security authorization state</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <ClockIcon style={{ width: 14, height: 14 }} />
                <span>Last Login Time</span>
              </span>
              <span className={styles.cardValue}>
                {currentUser.lastLoginAt
                  ? new Date(currentUser.lastLoginAt).toLocaleString()
                  : 'Never logged in yet'}
              </span>
              <span className={styles.cardSub}>System session timestamp</span>
            </div>

            <div className={styles.profileCard}>
              <span className={styles.cardLabel}>
                <CalendarDaysIcon style={{ width: 14, height: 14 }} />
                <span>Account Created</span>
              </span>
              <span className={styles.cardValue}>
                {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}
              </span>
              <span className={styles.cardSub}>Registration date</span>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            {onEditUser && (
              <button
                type="button"
                className={styles.btnSecondaryFooter}
                onClick={() => {
                  onClose();
                  onEditUser(currentUser);
                }}
                title="Edit user details"
              >
                <PencilSquareIcon style={{ width: 15, height: 15 }} />
                <span>Edit Account</span>
              </button>
            )}

            {onContactUser && (
              <button
                type="button"
                className={styles.btnSecondaryFooter}
                onClick={() => {
                  onClose();
                  onContactUser({
                    email: currentUser.email,
                    name: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.username,
                    roleOrType: currentUser.role,
                  });
                }}
                title="Send email message"
              >
                <EnvelopeIcon style={{ width: 15, height: 15 }} />
                <span>Contact</span>
              </button>
            )}
          </div>

          <div className={styles.footerRight}>
            <button type="button" className={styles.btnPrimaryFooter} onClick={onClose}>
              Close Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Fullscreen Enlarge Overlay ── */}
      {isEnlarged && currentActiveImg && (
        <div className={styles.enlargeOverlay} onClick={() => setIsEnlarged(false)}>
          <div className={styles.enlargeCard} onClick={(e) => e.stopPropagation()}>
            <img
              src={currentActiveImg}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
              className={styles.enlargeImg}
            />
            <div className={styles.enlargeMeta}>
              <span>{currentUser.firstName} {currentUser.lastName}</span> · <span>@{currentUser.username}</span>
            </div>
            <button
              type="button"
              className={styles.enlargeCloseBtn}
              onClick={() => setIsEnlarged(false)}
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
              <span>Close Preview</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

