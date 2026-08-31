import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import {
  fetchTenants,
  deleteTenant,
  activateTenant,
  deactivateTenant,
  approveTenant,
} from '../../api/tenantApi';
import type { Tenant } from '../../types/tenant';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import styles from './CeoTenants.module.css';

export default function CeoTenantList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { page, limit, setPage, resetPage } = usePagination();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTenants({ search, status, page, limit });
      setTenants(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleDelete = async (tenant: Tenant) => {
    if (!window.confirm(`Delete tenant "${tenant.organizationName}"?`)) return;
    try {
      await deleteTenant(tenant.id);
      setMessage('Tenant deleted successfully');
      loadTenants();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete tenant';
      setMessage(msg);
    }
  };

  const handleApprove = async (tenant: Tenant) => {
    await approveTenant(tenant.id);
    setMessage('Tenant approved and activated');
    loadTenants();
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      if (tenant.status === 'active') {
        await deactivateTenant(tenant.id);
        setMessage('Tenant deactivated');
      } else {
        await activateTenant(tenant.id);
        setMessage('Tenant activated');
      }
      loadTenants();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update tenant status';
      setMessage(msg);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive Tenant Management"
        description="Review, approve, and manage external organization accounts."
        backTo="/ceo/dashboard"
        actionLabel="+ Add Tenant"
        onAction={can('tenants.manage') ? () => navigate('/ceo/tenants/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.filters}>
        <input
          placeholder="Search organization, contact, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <DataTable<Tenant>
        loading={loading}
        data={tenants}
        columns={[
          { key: 'organizationName', label: 'Organization' },
          { key: 'contactPerson', label: 'Contact' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span>
            ),
          },
          {
            key: 'counts',
            label: 'Users / Tickets',
            render: (row) => `${row.userCount ?? 0} / ${row.ticketCount ?? 0}`,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <button onClick={() => navigate(`/ceo/tenants/${row.id}`)}>View</button>
                <button onClick={() => navigate(`/ceo/tenants/${row.id}/edit`)}>Edit</button>
                {row.status === 'pending' && (
                  <button onClick={() => handleApprove(row)}>Approve</button>
                )}
                {row.status !== 'pending' && (
                  <button onClick={() => handleToggleStatus(row)}>
                    {row.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <button className={styles.danger} onClick={() => handleDelete(row)}>Delete</button>
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
    </div>
  );
}
