import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
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

import {
  BuildingOffice2Icon,
  UserIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BriefcaseIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export default function DepartmentList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { page, limit, setPage, resetPage } = usePagination(1, 10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // In-app delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<Department | null>(null);

  // Overall stats state
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchDepartments({ page: 1, limit: 100 });
      setAllDepartments(res.data.data || []);
    } catch {
      // Fallback
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDepartments({ search, status, page, limit });
      setDepartments(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || (res.data.data || []).length);
    } catch {
      setMessage({ text: 'Failed to load departments directory.', isError: true });
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

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
    const total = allDepartments.length;
    const active = allDepartments.filter((d) => d.status === 'active').length;
    const inactive = allDepartments.filter((d) => d.status === 'inactive').length;
    const totalUsers = allDepartments.reduce((acc, d) => acc + (d.userCount || 0), 0);
    const withHead = allDepartments.filter((d) => Boolean(d.headName || d.headUserId)).length;
    return { total, active, inactive, totalUsers, withHead };
  }, [allDepartments]);

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

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    try {
      await deleteDepartment(deleteModal.id);
      setMessage({ text: `Department "${deleteModal.name}" deleted successfully.` });
      setDeleteModal(null);
      loadDepartments();
      loadStats();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete department';
      setMessage({ text: msg, isError: true });
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      if (dept.status === 'active') {
        await deactivateDepartment(dept.id);
        setMessage({ text: `Department "${dept.name}" deactivated.` });
      } else {
        await activateDepartment(dept.id);
        setMessage({ text: `Department "${dept.name}" activated.` });
      }
      loadDepartments();
      loadStats();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update department status';
      setMessage({ text: msg, isError: true });
    }
  };

  const getInitials = (code: string, name: string) => {
    if (code) return code.slice(0, 3).toUpperCase();
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return 'DP';
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <PageHeader
        title="Department Management"
        description="Create and manage organizational departments and department heads."
        backTo="/admin/dashboard"
        actionLabel="+ Add Department"
        onAction={can('departments.manage') ? () => navigate('/admin/departments/create') : undefined}
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
          title="Click to view all departments"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
            <BuildingOffice2Icon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Departments</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'active' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('active')}
          title="Click to filter active departments"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconEmerald}`}>
            <CheckCircleIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.active}</span>
            <span className={styles.statLabel}>Active Departments</span>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${status === 'inactive' ? styles.statCardActive : ''}`}
          onClick={() => handleFilterStatus('inactive')}
          title="Click to filter inactive departments"
        >
          <div className={`${styles.statIconWrapper} ${styles.statIconSlate}`}>
            <NoSymbolIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.inactive}</span>
            <span className={styles.statLabel}>Inactive / Archived</span>
          </div>
        </div>

        <div className={styles.statCard} style={{ cursor: 'default' }}>
          <div className={`${styles.statIconWrapper} ${styles.statIconPurple}`}>
            <UsersIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.totalUsers}</span>
            <span className={styles.statLabel}>Assigned Personnel</span>
          </div>
        </div>

        <div className={styles.statCard} style={{ cursor: 'default' }}>
          <div className={`${styles.statIconWrapper} ${styles.statIconAmber}`}>
            <BriefcaseIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {stats.withHead} / {stats.total}
            </span>
            <span className={styles.statLabel}>Headed Departments</span>
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
              placeholder="Search by department name, code, or description..."
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
      <DataTable<Department>
        loading={loading}
        data={departments}
        columns={[
          {
            key: 'name',
            label: 'Department',
            render: (row) => (
              <div className={styles.deptCell}>
                <div className={styles.deptAvatar}>
                  {getInitials(row.code, row.name)}
                </div>
                <div className={styles.deptInfo}>
                  <span className={styles.deptName}>{row.name}</span>
                  {row.description && (
                    <span className={styles.deptDesc} title={row.description}>
                      {row.description}
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'code',
            label: 'Code',
            render: (row) => (
              <span className={styles.codeChip}>
                {row.code}
              </span>
            ),
          },
          {
            key: 'headName',
            label: 'Department Head',
            render: (row) =>
              row.headName ? (
                <div className={styles.headCell}>
                  <div className={styles.headAvatar}>
                    {row.headName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className={styles.headName}>{row.headName}</span>
                    {row.headEmail && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                        {row.headEmail}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className={styles.headUnassigned}>— Not Assigned</span>
              ),
          },
          {
            key: 'userCount',
            label: 'Assigned Users',
            render: (row) => (
              <span className={styles.userCountChip}>
                <UserGroupIcon />
                <span>
                  {row.userCount ?? 0} member{(row.userCount ?? 0) === 1 ? '' : 's'}
                </span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => {
              const isActive = row.status === 'active';
              return (
                <span
                  className={`${styles.statusBadge} ${
                    isActive ? styles.statusActive : styles.statusInactive
                  }`}
                >
                  <span className={styles.statusDot} />
                  <span>{row.status}</span>
                </span>
              );
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actionGroup}>
                {can('departments.manage') && (
                  <>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                      onClick={() => navigate(`/admin/departments/${row.id}/edit`)}
                      title="Edit department"
                    >
                      <PencilSquareIcon className={styles.actionIcon} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${row.status === 'active' ? styles.actionBtnDeactivate : styles.actionBtnActivate}`}
                      onClick={() => handleToggleStatus(row)}
                      title={row.status === 'active' ? 'Deactivate department' : 'Activate department'}
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
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteModal(row)}
                      title="Delete department"
                    >
                      <TrashIcon className={styles.actionIcon} />
                      <span>Delete</span>
                    </button>
                  </>
                )}
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
        title="Confirm Delete Department"
        onClose={() => setDeleteModal(null)}
      >
        {deleteModal && (
          <div className={styles.confirmModalBody}>
            <div className={styles.confirmWarningBox}>
              <ExclamationTriangleIcon className={styles.confirmWarningIcon} />
              <p>
                Are you sure you want to delete the department{' '}
                <strong>"{deleteModal.name}" ({deleteModal.code})</strong>?
                This action is permanent and will unassign any member users.
              </p>
            </div>

            <div className={styles.confirmDetailsBox}>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Department Name</span>
                <span className={styles.confirmDetailValue}>{deleteModal.name}</span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Department Code</span>
                <span className={styles.confirmDetailValue}>{deleteModal.code}</span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Department Head</span>
                <span className={styles.confirmDetailValue}>
                  {deleteModal.headName || 'None assigned'}
                </span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Assigned Users</span>
                <span className={styles.confirmDetailValue}>
                  {deleteModal.userCount ?? 0} members
                </span>
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
                onClick={handleDeleteConfirm}
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
                <span>Delete Department</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}