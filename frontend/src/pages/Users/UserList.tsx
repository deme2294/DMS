import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
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
  const { user: currentUser } = useAuth();
  const { can } = usePermission();
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
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteModal, setDeleteModal] = useState<User | null>(null);
  const [message, setMessage] = useState('');

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
      setMessage('You cannot delete your own account.');
      setDeleteModal(null);
      return;
    }
    try {
      await deleteUser(deleteModal.id);
      setMessage(`User @${deleteModal.username} was permanently deleted.`);
      setDeleteModal(null);
      loadUsers();
      loadStats();
    } catch {
      setMessage('Failed to delete user.');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      setMessage('You cannot deactivate your own account.');
      return;
    }
    try {
      if (user.status === 'active') {
        await deactivateUser(user.id);
        setMessage(`User @${user.username} deactivated.`);
      } else {
        await activateUser(user.id);
        setMessage(`User @${user.username} activated.`);
      }
      loadUsers();
      loadStats();
    } catch {
      setMessage('Failed to update user status.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || newPassword.length < 8) return;
    try {
      await resetUserPassword(resetModal.id, newPassword);
      setResetModal(null);
      setNewPassword('');
      setMessage(`Password for @${resetModal.username} reset successfully.`);
    } catch {
      setMessage('Failed to reset password.');
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

      {message && <div className={styles.toast}>✓ {message}</div>}

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
              <a href={`mailto:${row.email}`} className={styles.emailLink} title={`Email ${row.email}`}>
                <EnvelopeIcon className={styles.emailIcon} />
                <span>{row.email}</span>
              </a>
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
            render: (row) => (
              <span className={styles.userCodeChip}>
                #{row.userCode || row.id.slice(0, 7).toUpperCase()}
              </span>
            ),
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
                {can('users.update') && (
                  <>
                    <button
                      type="button"
                      className={styles.actionBtnEdit}
                      onClick={() => navigate(`/admin/users/${row.id}/edit`)}
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
                  className={`${styles.pwLengthHint} ${
                    newPassword.length >= 8 ? styles.pwValid : ''
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
    </div>
  );
}