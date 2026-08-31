import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { fetchTenant } from '../../api/tenantApi';
import type { Tenant } from '../../types/tenant';
import styles from './CeoTenants.module.css';

export default function CeoTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchTenant(id).then((res) => setTenant(res.data.data));
  }, [id]);

  if (!tenant) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title={tenant.organizationName}
        description="Tenant profile and linked user accounts"
        backTo="/ceo/tenants"
        actionLabel="Edit Tenant"
        onAction={() => navigate(`/ceo/tenants/${tenant.id}/edit`)}
      />

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <h3>Organization</h3>
          <p><strong>Contact:</strong> {tenant.contactPerson}</p>
          <p><strong>Email:</strong> {tenant.email}</p>
          <p><strong>Phone:</strong> {tenant.phone || '—'}</p>
          <p><strong>Status:</strong> {tenant.status}</p>
          <p><strong>Address:</strong> {tenant.address || '—'}</p>
        </div>

        <div className={styles.card}>
          <h3>Statistics</h3>
          <p><strong>Users:</strong> {tenant.userCount ?? 0}</p>
          <p><strong>Tickets:</strong> {tenant.ticketCount ?? 0}</p>
        </div>
      </div>

      <div className={styles.card}>
        <h3>Tenant Users</h3>
        {!tenant.users?.length ? (
          <p>No tenant users found.</p>
        ) : (
          <ul className={styles.userList}>
            {tenant.users.map((user) => (
              <li key={user.id}>
                {user.firstName} {user.lastName} — {user.username} ({user.status})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
