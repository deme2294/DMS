import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
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
import styles from './Tenants.module.css';

import {
  BuildingOffice2Icon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TicketIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

export default function TenantList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { page, limit, setPage, resetPage } = usePagination(1, 10);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // In-app delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<Tenant | null>(null);

  // Overall stats state
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchTenants({ page: 1, limit: 100 });
      setAllTenants(res.data.data || []);
    } catch {
      // Fallback
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTenants({ search, status, page, limit });
      setTenants(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || (res.data.data || []).length);
    } catch {
      setMessage({ text: 'Failed to load tenants directory.', isError: true });
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-dismiss message after 4s
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const stats = useMemo(() => {
    const total = allTenants.length;
    const active = allTenants.filter((t) => t.status === 'active').length;
    const pending = allTenants.filter((t) => t.status === 'pending').length;
    const inactive = allTenants.filter((t) => t.status === 'inactive').length;
    const totalUsers = allTenants.reduce((acc, t) => acc + (t.userCount || 0), 0);
    const totalTickets = allTenants.reduce((acc, t) => acc + (t.ticketCount || 0), 0);
    return { total, active, pending, inactive, totalUsers, totalTickets };
  }, [allTenants]);

  const handleFilterStatus = (targetStatus: string) => {
    if (status === targetStatus) {
      setStatus('');
      setSearchParams({});
    } else {
      setStatus(targetStatus);
      setSearchParams(targetStatus ? { status: targetStatus } : {});
    }
    resetPage();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setSearchParams({});
    resetPage();
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteTenant(deleteModal.id);
      setMessage({ text: `Organization "${deleteModal.organizationName}" deleted successfully.` });
      setDeleteModal(null);
      loadTenants();
      loadStats();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete tenant';
      setMessage({ text: msg, isError: true });
    }
  };

  const handleApprove = async (tenant: Tenant) => {
    try {
      await approveTenant(tenant.id);
      setMessage({ text: `Tenant "${tenant.organizationName}" approved and activated.` });
      loadTenants();
      loadStats();
    } catch {
      setMessage({ text: 'Failed to approve tenant.', isError: true });
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      if (tenant.status === 'active') {
        await deactivateTenant(tenant.id);
        setMessage({ text: `Tenant "${tenant.organizationName}" deactivated.` });
      } else {
        await activateTenant(tenant.id);
        setMessage({ text: `Tenant "${tenant.organizationName}" activated.` });
      }
      loadTenants();
      loadStats();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update tenant status';
      setMessage({ text: msg, isError: true });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'TN';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <PageHeader
        title="Tenant Management"
        description="Register, approve, and manage external organization accounts and their access."
        backTo="/admin/dashboard"
        actionLabel="+ Add Tenant"
        onAction={can('tenants.manage') ? () => navigate('/admin/tenants/create') : undefined}
      />

      {/* Toast Notification */}
      {message && (
        <div className={`${styles.toast} ${message.isError ? styles.error : ''}`}>
          {message.isError ? <ExclamationTriangleIcon /> : <CheckCircleIcon />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Live Stats Overview */}
      <div className={styles.statsGrid}>
        <div
          className={`${styles.statCard} ${status === '' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('')}
          title="Click to view all organizations"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
            <BuildingOffice2Icon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Organizations</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'active' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('active')}
          title="Click to filter active accounts"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconEmerald}`}>
            <CheckCircleIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.active}</span>
            <span className={styles.statLabel}>Active Accounts</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'pending' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('pending')}
          title="Click to filter pending approval accounts"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconAmber}`}>
            <ClockIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.pending}</span>
            <span className={styles.statLabel}>Pending Approval</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'inactive' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('inactive')}
          title="Click to filter inactive accounts"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconSlate}`}>
            <NoSymbolIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.inactive}</span>
            <span className={styles.statLabel}>Inactive / Suspended</span>
          </div>
        </div>

        <div className={styles.statCard} style={{ cursor: 'default' }}>
          <div className={`${styles.statIconWrapper} ${styles.statIconPurple}`}>
            <TicketIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {stats.totalUsers} / {stats.totalTickets}
            </span>
            <span className={styles.statLabel}>Linked Users &amp; Tickets</span>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className={styles.filterCard}>
        <div className={styles.filtersRow}>
          <div className={styles.searchBox}>
            <MagnifyingGlassIcon className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by organization, contact person, or email..."
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
                onClick={() => {
                  setSearch('');
                  resetPage();
                }}
                title="Clear search"
              >
                <XMarkIcon />
              </button>
            )}
          </div>

          <select
            className={styles.selectDropdown}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSearchParams(e.target.value ? { status: e.target.value } : {});
              resetPage();
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="pending">Pending Approval</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className={styles.filterChipsRow}>
          <button
            type="button"
            className={`${styles.filterChip} ${status === '' ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterStatus('')}
          >
            <span>All</span>
            <span className={styles.filterChipCount}>{stats.total}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${status === 'active' ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterStatus('active')}
          >
            <span>Active</span>
            <span className={styles.filterChipCount}>{stats.active}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${status === 'pending' ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterStatus('pending')}
          >
            <span>Pending</span>
            <span className={styles.filterChipCount}>{stats.pending}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${status === 'inactive' ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterStatus('inactive')}
          >
            <span>Inactive</span>
            <span className={styles.filterChipCount}>{stats.inactive}</span>
          </button>

          {(search || status) && (
            <button
              type="button"
              className={styles.clearAllFiltersBtn}
              onClick={handleClearFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <DataTable<Tenant>
        loading={loading}
        data={tenants}
        columns={[
          {
            key: 'organizationName',
            label: 'Organization',
            render: (row) => (
              <div className={styles.orgCell}>
                <div className={styles.orgAvatar}>
                  {getInitials(row.organizationName)}
                </div>
                <div className={styles.orgInfo}>
                  <span className={styles.orgName}>{row.organizationName}</span>
                  {row.registrationNumber && (
                    <span className={styles.orgReg}>
                      Reg: {row.registrationNumber}
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'contactPerson',
            label: 'Primary Contact',
            render: (row) => (
              <div className={styles.contactCell}>
                <UserIcon />
                <span>{row.contactPerson || '—'}</span>
              </div>
            ),
          },
          {
            key: 'email',
            label: 'Email',
            render: (row) => (
              <a
                href={`mailto:${row.email}`}
                className={styles.emailLink}
                title={`Send email to ${row.email}`}
              >
                <EnvelopeIcon />
                <span>{row.email}</span>
              </a>
            ),
          },
          {
            key: 'phone',
            label: 'Phone',
            render: (row) => (
              <div className={styles.phoneCell}>
                <PhoneIcon />
                <span>{row.phone || '—'}</span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => {
              const statusClass =
                row.status === 'active'
                  ? styles.statusActive
                  : row.status === 'pending'
                  ? styles.statusPending
                  : styles.statusInactive;
              return (
                <span className={`${styles.statusBadge} ${statusClass}`}>
                  <span className={styles.statusDot} />
                  <span>{row.status}</span>
                </span>
              );
            },
          },
          {
            key: 'counts',
            label: 'Users & Tickets',
            render: (row) => (
              <div className={styles.metricsGroup}>
                <span className={styles.metricChip} title={`${row.userCount ?? 0} linked users`}>
                  <UserGroupIcon />
                  <span>{row.userCount ?? 0}</span>
                </span>
                <span
                  className={`${styles.metricChip} ${styles.metricChipInteractive}`}
                  title="View tickets for this tenant"
                  onClick={() => navigate(`/admin/tickets?tenantId=${row.id}`)}
                >
                  <TicketIcon />
                  <span>{row.ticketCount ?? 0}</span>
                </span>
              </div>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actionGroup}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnView}`}
                  onClick={() => navigate(`/admin/tenants/${row.id}`)}
                  title="View details"
                >
                  <EyeIcon className={styles.actionIcon} />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                  onClick={() => navigate(`/admin/tenants/${row.id}/edit`)}
                  title="Edit tenant"
                >
                  <PencilSquareIcon className={styles.actionIcon} />
                  <span>Edit</span>
                </button>

                {row.status === 'pending' && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnApprove}`}
                    onClick={() => handleApprove(row)}
                    title="Approve organization"
                  >
                    <CheckCircleIcon className={styles.actionIcon} />
                    <span>Approve</span>
                  </button>
                )}

                {row.status !== 'pending' && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${row.status === 'active' ? styles.actionBtnDeactivate : styles.actionBtnActivate}`}
                    onClick={() => handleToggleStatus(row)}
                    title={row.status === 'active' ? 'Deactivate tenant' : 'Activate tenant'}
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
                )}

                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  onClick={() => setDeleteModal(row)}
                  title="Delete tenant account"
                >
                  <TrashIcon className={styles.actionIcon} />
                  <span>Delete</span>
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.paginationBtn}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeftIcon />
          <span>Previous</span>
        </button>
        <span className={styles.paginationInfo}>
          Page {page} of {Math.max(1, totalPages)} ({totalCount} total)
        </span>
        <button
          type="button"
          className={styles.paginationBtn}
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          <span>Next</span>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteModal)}
        title="Confirm Delete Tenant Organization"
        onClose={() => setDeleteModal(null)}
      >
        {deleteModal && (
          <div className={styles.confirmModalBody}>
            <div className={styles.confirmWarningBox}>
              <ExclamationTriangleIcon className={styles.confirmWarningIcon} />
              <p>
                Are you sure you want to permanently delete{' '}
                <strong>"{deleteModal.organizationName}"</strong>? This will remove all organization metadata and unlink any associated tenant user accounts.
              </p>
            </div>

            <div className={styles.confirmDetailsBox}>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Organization</span>
                <span className={styles.confirmDetailValue}>{deleteModal.organizationName}</span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Contact Person</span>
                <span className={styles.confirmDetailValue}>{deleteModal.contactPerson || '—'}</span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Email</span>
                <span className={styles.confirmDetailValue}>{deleteModal.email}</span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Linked Users</span>
                <span className={styles.confirmDetailValue}>{deleteModal.userCount ?? 0}</span>
              </div>
            </div>

            <div className={styles.confirmModalActions}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={handleConfirmDelete}
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
                <span>Delete Organization</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}