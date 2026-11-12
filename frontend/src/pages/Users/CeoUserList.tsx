import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortUserId } from '../../utils/idUtils';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
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
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import styles from './CeoUsers.module.css';

export default function CeoUserList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { can } = usePermission();
  const { showSuccess, showError } = useAlert();
  const { page, limit, setPage, resetPage } = usePagination();
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({ search, role, status, page, limit });
      setUsers(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setErrorMessage(err?.response?.data?.message || 'Failed to load user list.');
      setUsers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page, limit]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
    } catch {}
  }, [location.state, showSuccess, showError]);

  // Auto-dismiss alerts
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

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      const err = 'You cannot delete your own account.';
      setErrorMessage(err);
      showError(err, 'Action Not Allowed');
      return;
    }
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    try {
      const res = await deleteUser(user.id);
      const text = res?.data?.message || `User @${user.username} was permanently deleted.`;
      setMessage(text);
      showSuccess(text, 'User Deleted');
      setErrorMessage('');
      loadUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete user.';
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

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive User Management"
        description="Oversee system users, executive roles, departments, and account status."
        backTo="/ceo/dashboard"
        actionLabel={can('users.create') ? '+ Add User' : undefined}
        onAction={can('users.create') ? () => navigate('/ceo/users/create') : undefined}
      />

      <div className={styles.filters}>
        <input
          placeholder="Search users..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <select value={role} onChange={(e) => { setRole(e.target.value); resetPage(); }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="tenant">Tenant</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </select>
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

      <DataTable<User>
        loading={loading}
        data={users}
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (row) => (
              <div className={styles.userCell}>
                {row.profileImage && (
                  <img src={`http://localhost:5000${row.profileImage}`} alt="" />
                )}
                <span>{row.firstName} {row.lastName}</span>
              </div>
            ),
          },
          { key: 'username', label: 'Username' },
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
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
                title={`Send email to ${row.email}`}
              >
                {row.email}
              </button>
            ),
          },
          {
            key: 'userCode',
            label: 'User ID',
            render: (row) => {
              const displayId = row.userCode || (row.id && /^\d{4}$/.test(row.id) ? row.id : toShortUserId(row));
              return <span>#{displayId}</span>;
            },
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <button
                  type="button"
                  style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  onClick={() => setContactTarget({
                    email: row.email,
                    name: `${row.firstName} ${row.lastName}`.trim() || row.username,
                    roleOrType: row.role,
                  })}
                >
                  Contact
                </button>
                {can('users.update') && (
                  <>
                    <button onClick={() => navigate(`/ceo/users/${toShortUserId(row)}/edit`)}>Edit</button>
                    <button
                      disabled={row.id === currentUser?.id}
                      onClick={() => handleToggleStatus(row)}
                      title={row.id === currentUser?.id ? 'You cannot deactivate your own account' : undefined}
                    >
                      {row.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => setResetModal(row)}>Reset Password</button>
                  </>
                )}
                {can('users.delete') && (
                  <button
                    className={styles.danger}
                    disabled={row.id === currentUser?.id}
                    onClick={() => handleDelete(row)}
                    title={row.id === currentUser?.id ? 'You cannot delete your own account' : undefined}
                  >
                    Delete
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      <Modal
        open={!!resetModal}
        title={`Reset Password — ${resetModal?.username}`}
        onClose={() => setResetModal(null)}
      >
        <input
          type="password"
          placeholder="New password (min 8 chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button onClick={handleResetPassword}>Reset Password</button>
      </Modal>

      <ContactModal
        open={!!contactTarget}
        target={contactTarget}
        onClose={() => setContactTarget(null)}
      />
    </div>
  );
}
