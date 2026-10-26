import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
import { fetchTenant } from '../../api/tenantApi';
import type { Tenant } from '../../types/tenant';
import {
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import styles from './Tenants.module.css';

export default function CeoTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchTenant(id).then((res) => {
      const data = res.data.data;
      setTenant(data);
      const shortId = data.tenantId || (data as any).tenant_id;
      if (shortId && id.length > 8 && String(id) !== String(shortId)) {
        navigate(`/ceo/tenants/${shortId}`, { replace: true });
      }
    });
  }, [id, navigate]);

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    if (f || l) return (f + l).toUpperCase();
    return (username?.slice(0, 2) || 'U').toUpperCase();
  };

  if (!tenant) return <div className={styles.loading}>Loading...</div>;

  const shortTenantId = tenant.tenantId || (tenant as any).tenant_id || tenant.id.slice(0, 8);

  return (
    <div className={styles.page}>
      <PageHeader
        title={tenant.organizationName}
        description={`Tenant #${shortTenantId} • Linked user accounts & organization profile`}
        backTo="/ceo/tenants"
        actionLabel="Edit Tenant"
        onAction={() => navigate(`/ceo/tenants/${shortTenantId}/edit`)}
      />

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Users</span>
          <span className={styles.statValue}>{tenant.userCount ?? 0}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Tickets</span>
          <span className={styles.statValue}>{tenant.ticketCount ?? 0}</span>
          <Link to={`/ceo/tickets?tenantId=${tenant.id}`} className={styles.statLink}>
            View tickets →
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
            <span className={styles.infoValue}>
              <button
                type="button"
                className={styles.emailActionButton}
                onClick={() =>
                  setContactTarget({
                    email: tenant.email,
                    name: tenant.contactPerson || tenant.organizationName,
                    roleOrType: 'Tenant Organization',
                  })
                }
                title={`Click to write email to ${tenant.email}`}
              >
                <EnvelopeIcon className={styles.emailActionIcon} />
                <span>{tenant.email}</span>
                <span className={styles.emailActionHint}>Send Email</span>
              </button>
            </span>
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
            <span className={styles.infoLabel}>Tenant ID</span>
            <span className={styles.infoValue}>
              <span className={styles.userCodeBadge}>#{shortTenantId}</span>
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Registration #</span>
            <span className={styles.infoValue}>{tenant.registrationNumber || '—'}</span>
          </div>
        </div>

        <div className={styles.card}>
          <h3>Statistics</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Users</span>
            <span className={styles.infoValue}>{tenant.userCount ?? 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tickets</span>
            <span className={styles.infoValue}>{tenant.ticketCount ?? 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Status</span>
            <span className={`${styles.statusBadge} ${styles[tenant.status]}`}>{tenant.status}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0 }}>Registered Tenant Users</h3>
          <span className={styles.filterChipCount} style={{ fontSize: '0.82rem', padding: '3px 10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
            {tenant.users?.length ?? 0} {tenant.users?.length === 1 ? 'user registered' : 'users registered'}
          </span>
        </div>

        {!tenant.users?.length ? (
          <div className={styles.emptyState}>
            <p>No tenant users found for this organization.</p>
          </div>
        ) : (
          <div className={styles.usersGrid}>
            {tenant.users.map((user) => (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userCardHeader}>
                  {user.profileImage ? (
                    <img
                      src={user.profileImage.startsWith('http') ? user.profileImage : `http://localhost:5000${user.profileImage}`}
                      alt={`${user.firstName} ${user.lastName}`}
                      className={styles.userProfileAvatar}
                      onClick={() => navigate(`/ceo/users/${user.id}/edit`)}
                      title="Click to visit profile"
                    />
                  ) : (
                    <div
                      className={styles.userProfileAvatarFallback}
                      onClick={() => navigate(`/ceo/users/${user.id}/edit`)}
                      title="Click to visit profile"
                      style={{ cursor: 'pointer' }}
                    >
                      {getInitials(user.firstName, user.lastName, user.username)}
                    </div>
                  )}

                  <div className={styles.userCardTitleCol}>
                    <div className={styles.userCardNameRow}>
                      <span className={styles.userName} title={`${user.firstName} ${user.lastName}`}>
                        {user.firstName} {user.lastName}
                      </span>
                      <span className={`${styles.userStatus} ${styles[user.status] || ''}`}>
                        {user.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span className={styles.userHandle}>@{user.username}</span>
                      {user.userCode && (
                        <span className={styles.userCodeBadge}>#{user.userCode}</span>
                      )}
                      <span className={styles.roleBadge}>{user.role || 'tenant'}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.userCardMetaList}>
                  <div className={styles.userMetaItem}>
                    <button
                      type="button"
                      className={styles.userEmailBtn}
                      onClick={() =>
                        setContactTarget({
                          email: user.email,
                          name: `${user.firstName} ${user.lastName}`.trim() || user.username,
                          roleOrType: user.role || 'Tenant User',
                        })
                      }
                      title={`Click to write email to ${user.email}`}
                    >
                      <EnvelopeIcon className={styles.userActionSmallIcon} />
                      <span>{user.email}</span>
                    </button>
                  </div>

                  {user.phone && (
                    <div className={styles.userMetaItem}>
                      <PhoneIcon />
                      <span>{user.phone}</span>
                    </div>
                  )}

                  {user.lastLoginAt && (
                    <div className={styles.userMetaItem}>
                      <ClockIcon />
                      <span>Last active: {new Date(user.lastLoginAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className={styles.userCardActionsRow}>
                  <button
                    type="button"
                    className={styles.userCardActionEmail}
                    onClick={() =>
                      setContactTarget({
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
                        roleOrType: user.role || 'Tenant User',
                      })
                    }
                    title={`Write message to ${user.email}`}
                  >
                    <EnvelopeIcon className={styles.userActionIcon} />
                    <span>Write Email</span>
                  </button>

                  <button
                    type="button"
                    className={styles.userCardActionVisit}
                    onClick={() => navigate(`/ceo/users/${user.id}/edit`)}
                    title="Visit and view user profile"
                  >
                    <UserIcon className={styles.userActionIcon} />
                    <span>Visit Profile</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ContactModal
        open={Boolean(contactTarget)}
        onClose={() => setContactTarget(null)}
        target={contactTarget}
      />
    </div>
  );
}
