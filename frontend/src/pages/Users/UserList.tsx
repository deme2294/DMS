import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortUserId } from '../../utils/idUtils';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
import UserProfileModal from '../../components/UserProfileModal/UserProfileModal';
import {
  fetchUsers,
  deleteUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
} from '../../api/userApi';
import type { User } from '../../types/user';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import styles from './Users.module.css';

import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  KeyIcon,
  TrashIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  UserIcon,
  BuildingOffice2Icon,
  StarIcon,
  UserGroupIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

export default function UserList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { can } = usePermission();
  const { showSuccess, showError } = useAlert();
  const { page, limit, setPage, resetPage } = usePagination();
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');

  // Modals state
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteModal, setDeleteModal] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Stats overview state
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    staff: 0,
    tenants: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchUsers({ page: 1, limit: 100 });
      const allUsers = res.data.data || [];
      const total = res.data.pagination?.total || allUsers.length;
      const active = allUsers.filter((u) => u.status === 'active').length;
      const inactive = allUsers.filter((u) => u.status !== 'active').length;
      const staff = allUsers.filter((u) => ['staff', 'manager', 'admin', 'ceo'].includes(u.role)).length;
      const tenants = allUsers.filter((u) => u.role === 'tenant').length;
      setStats({ total, active, inactive, staff, tenants });
    } catch {
      // Fallback gracefully
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({ search, role, status, page, limit });
      setUsers(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || (res.data.data || []).length);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setErrorMessage(err?.response?.data?.message || 'Failed to load user list.');
      setUsers([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page, limit]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Read action message passed via navigation state (e.g. from create/edit pages)
  useEffect(() => {
    if (!location.state) return;
    const st = location.state as any;
    const successMsg =
      st.message ||
      st.alert?.message ||
      (typeof st.alert === 'string' ? st.alert : null);
    const errorMsg =
      st.errorMessage ||
      st.error ||
      (st.alert?.type === 'error' ? st.alert.message : null);

    if (successMsg) {
      setMessage(successMsg);
      setErrorMessage('');
      showSuccess(successMsg, st.alert?.title || 'User Action Completed');
    } else if (errorMsg) {
      setErrorMessage(errorMsg);
      showError(errorMsg, st.alert?.title || 'User Management Notice');
    }

    try {
      window.history.replaceState({}, document.title);
    } catch { }
  }, [location.state, showSuccess, showError]);

  // Auto-dismiss notification alerts after 5 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleFilterStatus = (targetStatus: string) => {
    if (status === targetStatus) {
      setStatus('');
      setSearchParams({});
    } else {
      setStatus(targetStatus);
      setSearchParams({ status: targetStatus });
    }
    resetPage();
  };

  const handleClearFilters = () => {
    setSearch('');
    setRole('');
    setStatus('');
    setSearchParams({});
    resetPage();
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    if (deleteModal.id === currentUser?.id) {
      const err = 'You cannot delete your own account.';
      setErrorMessage(err);
      showError(err, 'Action Not Allowed');
      setDeleteModal(null);
      return;
    }
    try {
      const res = await deleteUser(deleteModal.id);
      const text = res?.data?.message || `User @${deleteModal.username} was permanently deleted.`;
      setMessage(text);
      showSuccess(text, 'User Deleted');
      setErrorMessage('');
      setDeleteModal(null);
      loadUsers();
      loadStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete user account.';
      setErrorMessage(msg);
      showError(msg, 'Delete Failed');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      const err = 'You cannot deactivate your own account.';
      setErrorMessage(err);
      showError(err, 'Action Not Allowed');
      return;
    }
    try {
      if (user.status === 'active') {
        const res = await deactivateUser(user.id);
        const text = res?.data?.message || `User @${user.username} was deactivated.`;
        setMessage(text);
        showSuccess(text, 'User Deactivated');
      } else {
        const res = await activateUser(user.id);
        const text = res?.data?.message || `User @${user.username} was activated.`;
        setMessage(text);
        showSuccess(text, 'User Activated');
      }
      setErrorMessage('');
      loadUsers();
      loadStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update user status.';
      setErrorMessage(msg);
      showError(msg, 'Status Update Failed');
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || newPassword.length < 8) return;
    try {
      const res = await resetUserPassword(resetModal.id, newPassword);
      const text = res?.data?.message || `Password for @${resetModal.username} reset successfully.`;
      setResetModal(null);
      setNewPassword('');
      setMessage(text);
      showSuccess(text, 'Password Reset');
      setErrorMessage('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to reset password.';
      setErrorMessage(msg);
      showError(msg, 'Reset Failed');
    }
  };

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let pwd = '';
    pwd += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
    pwd += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)];
    pwd += '23456789'[Math.floor(Math.random() * 8)];
    pwd += '!@#$%&*'[Math.floor(Math.random() * 7)];
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    const shuffled = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setNewPassword(shuffled);
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    if (username) return username.slice(0, 2).toUpperCase();
    return 'US';
  };

  const getRoleAvatarClass = (r: string) => {
    switch (r) {
      case 'admin': return styles.avatarAdmin;
      case 'manager': return styles.avatarManager;
      case 'staff': return styles.avatarStaff;
      case 'ceo': return styles.avatarCeo;
      case 'tenant': return styles.avatarTenant;
      default: return styles.avatarDefault;
    }
  };

  const renderRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return (
          <span className={`${styles.roleBadge} ${styles.roleAdmin}`} title="System Administrator">
            <ShieldCheckIcon className={styles.roleIcon} />
            <span>Admin</span>
          </span>
        );
      case 'manager':
        return (
          <span className={`${styles.roleBadge} ${styles.roleManager}`} title="Department Manager">
            <BriefcaseIcon className={styles.roleIcon} />
            <span>Manager</span>
          </span>
        );
      case 'staff':
        return (
          <span className={`${styles.roleBadge} ${styles.roleStaff}`} title="Department Staff Member">
            <UserIcon className={styles.roleIcon} />
            <span>Staff</span>
          </span>
        );
      case 'ceo':
        return (
          <span className={`${styles.roleBadge} ${styles.roleCeo}`} title="Executive Leadership">
            <StarIcon className={styles.roleIcon} />
            <span>Executive (CEO)</span>
          </span>
        );
      case 'tenant':
        return (
          <span className={`${styles.roleBadge} ${styles.roleTenant}`} title="Registered Tenant">
            <BuildingOffice2Icon className={styles.roleIcon} />
            <span>Tenant</span>
          </span>
        );
      default:
        return (
          <span className={`${styles.roleBadge} ${styles.roleDefault}`}>
            <span>{r}</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (s: string) => {
    switch (s) {
      case 'active':
        return (
          <span className={`${styles.statusBadge} ${styles.statusActive}`} title="Account is active and verified">
            <span className={styles.statusDotActive} />
            <span>Active</span>
          </span>
        );
      case 'inactive':
        return (
          <span className={`${styles.statusBadge} ${styles.statusInactive}`} title="Account is currently inactive">
            <span className={styles.statusDotInactive} />
            <span>Inactive</span>
          </span>
        );
      case 'locked':
        return (
          <span className={`${styles.statusBadge} ${styles.statusLocked}`} title="Account is locked due to security policy">
            <LockClosedIcon className={styles.statusDotIcon} />
            <span>Locked</span>
          </span>
        );
      default:
        return (
          <span className={styles.statusBadge}>
            <span>{s}</span>
          </span>
        );
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="User Management"
        description="Oversee user accounts, assign roles, departments, manage security credentials, and access permissions."
        backTo="/admin/dashboard"
        actionLabel={can('users.create') ? '+ Add User' : undefined}
        onAction={can('users.create') ? () => navigate('/admin/users/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      {/* ── Live Metric Overview Cards ── */}
      <div className={styles.statsGrid}>
        <div
          className={`${styles.statCard} ${!status ? styles.statCardActive : ''}`}
          onClick={() => { setStatus(''); setSearchParams({}); resetPage(); }}
        >
          <div className={`${styles.statIconWrap} ${styles.statIconTotal}`}>
            <UserGroupIcon style={{ width: 24, height: 24 }} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Accounts</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'active' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('active')}
        >
          <div className={`${styles.statIconWrap} ${styles.statIconActive}`}>
            <CheckCircleIcon style={{ width: 24, height: 24 }} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.active}</span>
            <span className={styles.statLabel}>Active Accounts</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'inactive' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('inactive')}
        >
          <div className={`${styles.statIconWrap} ${styles.statIconInactive}`}>
            <NoSymbolIcon style={{ width: 24, height: 24 }} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.inactive}</span>
            <span className={styles.statLabel}>Inactive Accounts</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${role === 'staff' || role === 'manager' ? styles.statCardActive : ''}`}
          onClick={() => { setRole(role === 'staff' ? '' : 'staff'); resetPage(); }}
        >
          <div className={`${styles.statIconWrap} ${styles.statIconStaff}`}>
            <BriefcaseIcon style={{ width: 24, height: 24 }} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.staff}</span>
            <span className={styles.statLabel}>Internal Staff & Managers</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${role === 'tenant' ? styles.statCardActive : ''}`}
          onClick={() => { setRole(role === 'tenant' ? '' : 'tenant'); resetPage(); }}
        >
          <div className={`${styles.statIconWrap} ${styles.statIconTenant}`}>
            <BuildingOffice2Icon style={{ width: 24, height: 24 }} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.tenants}</span>
            <span className={styles.statLabel}>Registered Tenants</span>
          </div>
        </div>
      </div>

      {/* ── Modern Glassmorphic Search & Filters Toolbar ── */}
      <div className={styles.filtersCard}>
        <div className={styles.searchBox}>
          <MagnifyingGlassIcon className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by name, email, username, or User ID (e.g. 1001)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => { setSearch(''); resetPage(); }}
              title="Clear search"
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>

        <select
          className={styles.filterSelect}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="tenant">Tenant</option>
        </select>

        <select
          className={styles.filterSelect}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </select>

        {(search || role || status) && (
          <button
            type="button"
            className={styles.resetFiltersBtn}
            onClick={handleClearFilters}
            title="Reset all filters"
          >
            <XMarkIcon style={{ width: 14, height: 14 }} />
            <span>Reset Filters</span>
          </button>
        )}

        <div className={styles.resultCountBadge}>
          {totalCount} {totalCount === 1 ? 'account' : 'accounts'}
        </div>
      </div>

      {/* ── Professional Action Alert Banner ── */}
      {(message || errorMessage) && (
        <div className={styles.professionalAlertBanner}>
          <div className={`${styles.alertCardInner} ${errorMessage ? styles.alertCardError : styles.alertCardSuccess}`} role={errorMessage ? 'alert' : 'status'}>
            <div className={styles.alertIconCol}>
              {errorMessage ? (
                <ExclamationTriangleIcon className={styles.alertActionIcon} />
              ) : (
                <CheckCircleIcon className={styles.alertActionIcon} />
              )}
            </div>
            <div className={styles.alertBodyCol}>
              <div className={styles.alertHeaderRow}>
                <span className={styles.alertCategoryBadge}>
                  {errorMessage ? 'Action Failed' : 'Action Confirmed'}
                </span>
                <span className={styles.alertTimestamp}>Just now</span>
              </div>
              <h5 className={styles.alertHeadline}>
                {errorMessage ? 'User Management Notice' : 'User Action Completed'}
              </h5>
              <p className={styles.alertDescription}>
                {message || errorMessage}
              </p>
            </div>
            <button
              type="button"
              className={styles.alertCloseBtn}
              onClick={() => {
                setMessage('');
                setErrorMessage('');
              }}
              title="Dismiss notification"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Enterprise Users Table ── */}
      <DataTable<User>
        loading={loading}
        data={users}
        emptyTitle="No Users Found"
        emptyMessage={
          search || role || status
            ? 'No accounts match the current filter criteria. Try adjusting or clearing your search.'
            : 'No user accounts are currently registered in the system.'
        }
        columns={[
          {
            key: 'name',
            label: 'User',
            render: (row) => (
              <div className={styles.userCell}>
                {row.profileImage ? (
                  <img
                    src={`http://localhost:5000${row.profileImage}`}
                    alt={`${row.firstName} ${row.lastName}`}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={`${styles.avatar} ${getRoleAvatarClass(row.role)}`}>
                    {getInitials(row.firstName, row.lastName, row.username)}
                  </div>
                )}
                <div className={styles.userInfoCol}>
                  <span className={styles.userFullName}>
                    {row.firstName} {row.lastName}
                  </span>
                  <span className={styles.userUsername}>@{row.username}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'email',
            label: 'Email',
            render: (row) => (
              <button
                type="button"
                onClick={() => setContactTarget({
                  email: row.email,
                  name: `${row.firstName} ${row.lastName}`.trim() || row.username,
                  roleOrType: row.role,
                })}
                className={styles.emailLink}
                title={`Send email to ${row.email}`}
              >
                <EnvelopeIcon className={styles.emailIcon} />
                <span>{row.email}</span>
              </button>
            ),
          },
          {
            key: 'role',
            label: 'Role',
            render: (row) => renderRoleBadge(row.role),
          },
          {
            key: 'department',
            label: 'Department',
            render: (row) => {
              if (row.departments && row.departments.length > 0) {
                return (
                  <span className={styles.deptChip} title={row.departments.map((d) => d.name).join(', ')}>
                    <BuildingOffice2Icon style={{ width: 13, height: 13, color: '#3b82f6' }} />
                    <span>{row.departments[0].name}</span>
                  </span>
                );
              }
              if (row.tenantName) {
                return (
                  <span className={styles.deptChip} title={`Tenant: ${row.tenantName}`}>
                    <BuildingOffice2Icon style={{ width: 13, height: 13, color: '#10b981' }} />
                    <span>{row.tenantName}</span>
                  </span>
                );
              }
              return <span style={{ color: 'var(--usr-text-muted)', fontSize: '0.84rem' }}>—</span>;
            },
          },
          {
            key: 'userCode',
            label: 'User ID',
            render: (row) => {
              const displayId = row.userCode || (row.id && /^\d{4}$/.test(row.id) ? row.id : toShortUserId(row));
              return (
                <span className={styles.userCodeChip}>
                  #{displayId}
                </span>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => renderStatusBadge(row.status),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actionGroup}>
                <button
                  type="button"
                  className={styles.actionBtnView}
                  onClick={() => setViewUser(row)}
                  title="View user profile & manage avatar image"
                >
                  <EyeIcon className={styles.actionIcon} />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  className={styles.actionBtnEdit}
                  style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                  onClick={() => setContactTarget({
                    email: row.email,
                    name: `${row.firstName} ${row.lastName}`.trim() || row.username,
                    roleOrType: row.role,
                  })}
                  title={`Send email to ${row.email}`}
                >
                  <EnvelopeIcon className={styles.actionIcon} />
                  <span>Contact</span>
                </button>

                {can('users.update') && (
                  <>
                    <button
                      type="button"
                      className={styles.actionBtnEdit}
                      onClick={() => navigate(`/admin/users/${toShortUserId(row)}/edit`)}
                      title="Edit user profile and permissions"
                    >
                      <PencilSquareIcon className={styles.actionIcon} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      disabled={row.id === currentUser?.id}
                      className={row.status === 'active' ? styles.actionBtnDeactivate : styles.actionBtnActivate}
                      onClick={() => handleToggleStatus(row)}
                      title={
                        row.id === currentUser?.id
                          ? 'You cannot deactivate your own account'
                          : row.status === 'active'
                            ? 'Deactivate account access'
                            : 'Activate account access'
                      }
                    >
                      {row.status === 'active' ? (
                        <>
                          <NoSymbolIcon className={styles.actionIcon} />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className={styles.actionIcon} />
                          <span>Activate</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtnReset}
                      onClick={() => {
                        setResetModal(row);
                        setNewPassword('');
                        setShowPassword(false);
                      }}
                      title="Reset account password"
                    >
                      <KeyIcon className={styles.actionIcon} />
                      <span>Reset PW</span>
                    </button>
                  </>
                )}

                {can('users.delete') && (
                  <button
                    type="button"
                    disabled={row.id === currentUser?.id}
                    className={styles.actionBtnDelete}
                    onClick={() => setDeleteModal(row)}
                    title={row.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete user account'}
                  >
                    <TrashIcon className={styles.actionIcon} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* ── Modern Pagination ── */}
      <div className={styles.pagination}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className={styles.pageInfo}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>

      {/* ── In-App Delete Confirmation Modal ── */}
      <Modal
        open={!!deleteModal}
        title="Delete User Account"
        onClose={() => setDeleteModal(null)}
        maxWidth="500px"
      >
        {deleteModal && (
          <div className={styles.modalBody}>
            <div className={styles.deleteWarningBox}>
              <div className={styles.deleteWarningIconWrapper}>
                <ExclamationTriangleIcon className={styles.deleteWarningIcon} />
              </div>
              <div>
                <h4 className={styles.deleteWarningTitle}>Permanent Action</h4>
                <p className={styles.deleteWarningText}>
                  Are you sure you want to permanently delete account for{' '}
                  <strong>
                    {deleteModal.firstName} {deleteModal.lastName}
                  </strong>{' '}
                  (<code>@{deleteModal.username}</code>)? All permissions and authentication credentials will be revoked.
                </p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalDeleteConfirmBtn}
                onClick={handleConfirmDelete}
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── In-App Reset Password Modal ── */}
      <Modal
        open={!!resetModal}
        title={`Reset Password — @${resetModal?.username}`}
        onClose={() => setResetModal(null)}
        maxWidth="520px"
      >
        {resetModal && (
          <div className={styles.modalBody}>
            <div className={styles.resetHeaderCard}>
              <div className={styles.resetAvatarWrapper}>
                <KeyIcon className={styles.resetKeyIcon} />
              </div>
              <div>
                <div className={styles.resetUserName}>
                  {resetModal.firstName} {resetModal.lastName}
                </div>
                <div className={styles.resetUserMeta}>
                  <span>@{resetModal.username}</span> · <span>{resetModal.email}</span>
                </div>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>New Secure Password</label>
              <div className={styles.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.modalPasswordInput}
                  placeholder="Enter new password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.passwordToggleBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlashIcon style={{ width: 18, height: 18 }} />
                  ) : (
                    <EyeIcon style={{ width: 18, height: 18 }} />
                  )}
                </button>
              </div>

              <div className={styles.passwordTools}>
                <button
                  type="button"
                  className={styles.generatePwBtn}
                  onClick={generateSecurePassword}
                >
                  <SparklesIcon style={{ width: 14, height: 14 }} />
                  Generate Strong Password
                </button>
                <span
                  className={`${styles.pwLengthHint} ${newPassword.length >= 8 ? styles.pwValid : ''
                    }`}
                >
                  {newPassword.length >= 8
                    ? '✓ Min 8 characters met'
                    : `${newPassword.length}/8 characters`}
                </span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setResetModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                disabled={newPassword.length < 8}
                onClick={handleResetPassword}
              >
                <KeyIcon style={{ width: 16, height: 16 }} />
                <span>Save New Password</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ContactModal
        open={!!contactTarget}
        target={contactTarget}
        onClose={() => setContactTarget(null)}
      />

      {/* ── User Profile & Image Manager Modal ── */}
      <UserProfileModal
        user={viewUser}
        isOpen={!!viewUser}
        onClose={() => setViewUser(null)}
        onUserUpdated={(updatedUser) => {
          setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
          setViewUser(updatedUser);
          showSuccess('User profile image updated successfully.', 'Profile Updated');
        }}
        onContactUser={(target) => setContactTarget(target)}
        onEditUser={(u) => navigate(`/admin/users/${toShortUserId(u)}/edit`)}
      />
    </div>
  );
}