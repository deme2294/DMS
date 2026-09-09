import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { fetchTenant } from '../../api/tenantApi';
import { fetchTickets } from '../../api/ticketApi';
import type { Tenant } from '../../types/tenant';
import type { Ticket } from '../../types/ticket';
import { STATUS_LABELS } from '../../types/ticket';
import styles from './Tenants.module.css';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showTickets, setShowTickets] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTenant(id).then((res) => setTenant(res.data.data));
  }, [id]);

  const loadTenantTickets = async () => {
    if (!id) return;
    setTicketsLoading(true);
    try {
      const res = await fetchTickets({ tenantId: id, limit: 50 });
      setTickets(res.data.data);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleToggleTickets = () => {
    if (!showTickets) {
      loadTenantTickets();
    }
    setShowTickets(!showTickets);
  };

  if (!tenant) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title={tenant.organizationName}
        description="Tenant profile and linked user accounts"
        backTo="/admin/tenants"
        actionLabel="Edit Tenant"
        onAction={() => navigate(`/admin/tenants/${tenant.id}/edit`)}
      />

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Users</span>
          <span className={styles.statValue}>{tenant.userCount ?? 0}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardClickable}`} onClick={handleToggleTickets}>
          <span className={styles.statLabel}>Tickets</span>
          <span className={styles.statValue}>{tenant.ticketCount ?? 0}</span>
          <Link to={`/admin/tickets?tenantId=${tenant.id}`} className={styles.statLink} onClick={(e) => e.stopPropagation()}>
            View all tickets →
          </Link>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Status</span>
          <span className={`${styles.statusBadge} ${styles[tenant.status]}`}>{tenant.status}</span>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <h3>Organization</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Contact Person</span>
            <span className={styles.infoValue}>{tenant.contactPerson}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>{tenant.email}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Phone</span>
            <span className={styles.infoValue}>{tenant.phone || '—'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Address</span>
            <span className={styles.infoValue}>{tenant.address || '—'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Registration #</span>
            <span className={styles.infoValue}>{tenant.registrationNumber || '—'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Created</span>
            <span className={styles.infoValue}>{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}</span>
          </div>
        </div>

        <div className={styles.card}>
          <h3>Quick Actions</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>View Tickets</span>
            <Link to={`/admin/tickets?tenantId=${tenant.id}`} className={styles.statLink}>
              {tenant.ticketCount ?? 0} tickets →
            </Link>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Edit Tenant</span>
            <Link to={`/admin/tenants/${tenant.id}/edit`} className={styles.statLink}>Edit →</Link>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tenant Users</span>
            <span className={styles.infoValue}>{tenant.users?.length ?? 0} users</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3>Tenant Users</h3>
        {!tenant.users?.length ? (
          <div className={styles.emptyState}>
            <p>No tenant users found.</p>
          </div>
        ) : (
          <ul className={styles.userList}>
            {tenant.users.map((user) => (
              <li key={user.id}>
                <span className={styles.userName}>{user.firstName} {user.lastName}</span>
                <span className={styles.userMeta}>{user.username}</span>
                <span className={`${styles.userStatus} ${styles[user.status]}`}>{user.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showTickets && (
        <div className={styles.card} style={{ marginTop: 16 }}>
          <h3>Tickets Created by This Tenant</h3>
          {ticketsLoading ? (
            <div className={styles.loading}>Loading tickets...</div>
          ) : !tickets.length ? (
            <div className={styles.emptyState}>
              <p>No tickets found for this tenant.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.ticketTable}>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link to={`/admin/tickets/${ticket.id}`} className={styles.ticketRef}>
                          {ticket.referenceNumber}
                        </Link>
                      </td>
                      <td className={styles.ticketTitle}>{ticket.title}</td>
                      <td>{ticket.category}</td>
                      <td><span className={`${styles.priorityBadge} ${styles[ticket.priority]}`}>{ticket.priority}</span></td>
                      <td><span className={`${styles.ticketBadge} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span></td>
                      <td>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}





