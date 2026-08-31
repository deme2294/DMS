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
import styles from './Users.module.css';

export default function UserList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { page, limit, setPage, resetPage } = usePagination();
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({ search, role, status, page, limit });
      setUsers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page, limit]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    await deleteUser(user.id);
    setMessage('User deleted successfully');
    loadUsers();
  };

  const handleToggleStatus = async (user: User) => {
    if (user.status === 'active') {
      await deactivateUser(user.id);
      setMessage('User deactivated');
    } else {
      await activateUser(user.id);
      setMessage('User activated');
    }
    loadUsers();
  };

  const handleResetPassword = async () => {
    if (!resetModal || newPassword.length < 8) return;
    await resetUserPassword(resetModal.id, newPassword);
    setResetModal(null);
    setNewPassword('');
    setMessage('Password reset successfully');
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="User Management"
        description="Manage system users, roles, departments, and account status."
        backTo="/admin/dashboard"
        actionLabel={can('users.create') ? '+ Add User' : undefined}
        onAction={can('users.create') ? () => navigate('/admin/users/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

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
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'userCode', label: 'User ID' },
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
                {can('users.update') && (
                  <>
                    <button onClick={() => navigate(`/admin/users/${row.id}/edit`)}>Edit</button>
                    <button onClick={() => handleToggleStatus(row)}>
                      {row.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => setResetModal(row)}>Reset Password</button>
                  </>
                )}
                {can('users.delete') && (
                  <button className={styles.danger} onClick={() => handleDelete(row)}>Delete</button>
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
    </div>
  );
}