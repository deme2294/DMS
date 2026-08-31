import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchDepartments,
  deleteDepartment,
  activateDepartment,
  deactivateDepartment,
} from '../../api/departmentApi';
import type { Department } from '../../types/department';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import styles from './Departments.module.css';

export default function DepartmentList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { page, limit, setPage, resetPage } = usePagination();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDepartments({ search, status, page, limit });
      setDepartments(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await deleteDepartment(dept.id);
      setMessage('Department deleted successfully');
      loadDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete department';
      setMessage(msg);
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      if (dept.status === 'active') {
        await deactivateDepartment(dept.id);
        setMessage('Department deactivated');
      } else {
        await activateDepartment(dept.id);
        setMessage('Department activated');
      }
      loadDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update department status';
      setMessage(msg);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Department Management"
        description="Create and manage organizational departments and department heads."
        backTo="/admin/dashboard"
        actionLabel="+ Add Department"
        onAction={can('departments.manage') ? () => navigate('/admin/departments/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.filters}>
        <input
          placeholder="Search by name, code, or description..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <DataTable<Department>
        loading={loading}
        data={departments}
        columns={[
          { key: 'name', label: 'Department' },
          { key: 'code', label: 'Code' },
          {
            key: 'headName',
            label: 'Department Head',
            render: (row) => row.headName || '—',
          },
          {
            key: 'userCount',
            label: 'Users',
            render: (row) => row.userCount ?? 0,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`${styles.badge} ${styles[row.status]}`}>
                {row.status}
              </span>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                {can('departments.manage') && (
                  <>
                    <button onClick={() => navigate(`/admin/departments/${row.id}/edit`)}>
                      Edit
                    </button>
                    <button onClick={() => handleToggleStatus(row)}>
                      {row.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className={styles.danger}
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}