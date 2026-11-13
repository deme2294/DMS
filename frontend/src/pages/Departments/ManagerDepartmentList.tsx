import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortDepartmentId } from '../../utils/idUtils';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAlert } from '../../context/AlertContext';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import styles from './Departments.module.css';

export default function ManagerDepartmentList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { showSuccess, showError } = useAlert();
  const { page, limit, setPage, resetPage } = usePagination();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Department | null>(null);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDepartments({ search, status, page, limit });
      setDepartments(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || res.data.data?.length || 0);
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    try {
      await deleteDepartment(deleteModal.id);
      const msg = `Department "${deleteModal.name}" deleted successfully.`;
      setMessage({ text: msg });
      showSuccess(msg, 'Department Deleted');
      setDeleteModal(null);
      loadDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete department';
      setMessage({ text: msg, isError: true });
      showError(msg, 'Delete Error');
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      if (dept.status === 'active') {
        await deactivateDepartment(dept.id);
        const msg = `Department "${dept.name}" deactivated.`;
        setMessage({ text: msg });
        showSuccess(msg, 'Department Deactivated');
      } else {
        await activateDepartment(dept.id);
        const msg = `Department "${dept.name}" activated.`;
        setMessage({ text: msg });
        showSuccess(msg, 'Department Activated');
      }
      loadDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update department status';
      setMessage({ text: msg, isError: true });
      showError(msg, 'Status Update Failed');
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
      <PageHeader
        title="My Departments"
        description="View and manage departments you belong to."
        backTo="/manager/dashboard"
      />

      {message && (
        <div className={`${styles.toast} ${message.isError ? styles.error : ''}`}>
          {message.isError ? <ExclamationTriangleIcon /> : <CheckCircleIcon />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Professional Search & Filter Toolbar */}
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
            onClick={() => {
              setStatus('');
              resetPage();
            }}
          >
            <span>All</span>
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${status === 'active' ? styles.filterChipActive : ''}`}
            onClick={() => {
              setStatus('active');
              resetPage();
            }}
          >
            <span>Active</span>
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${status === 'inactive' ? styles.filterChipActive : ''}`}
            onClick={() => {
              setStatus('inactive');
              resetPage();
            }}
          >
            <span>Inactive</span>
          </button>

          {(search || status) && (
            <button
              type="button"
              className={styles.clearAllFiltersBtn}
              onClick={() => {
                setSearch('');
                setStatus('');
                resetPage();
              }}
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
            render: (row) => <span className={styles.codeChip}>{row.code}</span>,
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
                      onClick={() => navigate(`/manager/departments/${toShortDepartmentId(row)}/edit`)}
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
