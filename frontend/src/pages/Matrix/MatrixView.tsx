import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import MatrixBulkForm from '../../components/Forms/MatrixBulkForm';
import {
  fetchMatrixGrid,
  fetchAssignments,
  toggleAssignment,
  assignUserToDepartment,
  assignDepartmentToUser,
  deleteAssignment,
} from '../../api/matrixApi';
import type { MatrixAssignment, MatrixGridData } from '../../types/matrix';
import { usePagination } from '../../hooks/usePagination';
import styles from './Matrix.module.css';

import {
  Squares2X2Icon,
  UserGroupIcon,
  BuildingOffice2Icon,
  CheckIcon,
  MinusIcon,
  TrashIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  UserIcon,
  StarIcon,
  ClockIcon,
  CheckCircleIcon,
  UserPlusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function MatrixView() {
  const { page, limit, setPage, resetPage } = usePagination(1, 15);
  const [grid, setGrid] = useState<MatrixGridData | null>(null);
  const [assignments, setAssignments] = useState<MatrixAssignment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingGrid, setLoadingGrid] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [bulkModal, setBulkModal] = useState<'user' | 'department' | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<MatrixAssignment | null>(null);

  const loadGrid = useCallback(async () => {
    setLoadingGrid(true);
    try {
      const res = await fetchMatrixGrid();
      setGrid(res.data.data);
    } catch {
      setMessage({ text: 'Failed to load matrix grid', isError: true });
    } finally {
      setLoadingGrid(false);
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchAssignments({ search, page, limit });
      setAssignments(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.total);
    } catch {
      setMessage({ text: 'Failed to load assignments', isError: true });
    } finally {
      setLoadingList(false);
    }
  }, [search, page, limit]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadGrid(), loadAssignments()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const activeDepartments = useMemo(
    () => grid?.departments.filter((d) => d.status === 'active') || [],
    [grid]
  );

  // Quick stats
  const stats = useMemo(() => {
    const totalUsers = grid?.users.length || 0;
    const assignedUsersCount = grid?.users.filter((u) => u.departmentId !== null).length || 0;
    const deptsCount = activeDepartments.length;
    const coveragePercent = totalUsers > 0 ? Math.round((assignedUsersCount / totalUsers) * 100) : 0;
    return {
      totalUsers,
      assignedUsersCount,
      deptsCount,
      coveragePercent,
    };
  }, [grid, activeDepartments]);

  const handleToggleCell = async (userId: string, departmentId: string, assigned: boolean) => {
    const key = `${userId}-${departmentId}`;
    setSavingCell(key);
    try {
      await toggleAssignment({ userId, departmentId, assigned });
      setMessage({ text: assigned ? 'Assignment added successfully.' : 'Assignment removed successfully.' });
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage({
        text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to toggle assignment',
        isError: true,
      });
    } finally {
      setSavingCell(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteAssignment(deleteModal.id);
      setMessage({ text: `Removed assignment for @${deleteModal.username}.` });
      setDeleteModal(null);
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch {
      setMessage({ text: 'Failed to delete assignment.', isError: true });
    }
  };

  const handleBulkUser = async ({ id, selectedId }: { id: string; selectedId: string | null }) => {
    try {
      await assignUserToDepartment(id, selectedId);
      setBulkModal(null);
      setMessage({ text: 'User department updated successfully.' });
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage({
        text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to assign user to department',
        isError: true,
      });
    }
  };

  const handleBulkDepartment = async ({ id, selectedId }: { id: string; selectedId: string | null }) => {
    try {
      await assignDepartmentToUser(id, selectedId);
      setBulkModal(null);
      setMessage({ text: 'Department assignments updated successfully.' });
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage({
        text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to assign department to user',
        isError: true,
      });
    }
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    if (username) return username.slice(0, 2).toUpperCase();
    return 'US';
  };

  const getAvatarClass = (role: string) => {
    switch (role) {
      case 'admin': return styles.avatarAdmin;
      case 'manager': return styles.avatarManager;
      case 'staff': return styles.avatarStaff;
      case 'ceo': return styles.avatarCeo;
      default: return styles.avatarDefault;
    }
  };

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className={`${styles.roleMiniBadge} ${styles.roleAdmin}`}>
            <ShieldCheckIcon style={{ width: 12, height: 12 }} />
            <span>Admin</span>
          </span>
        );
      case 'manager':
        return (
          <span className={`${styles.roleMiniBadge} ${styles.roleManager}`}>
            <BriefcaseIcon style={{ width: 12, height: 12 }} />
            <span>Manager</span>
          </span>
        );
      case 'staff':
        return (
          <span className={`${styles.roleMiniBadge} ${styles.roleStaff}`}>
            <UserIcon style={{ width: 12, height: 12 }} />
            <span>Staff</span>
          </span>
        );
      case 'ceo':
        return (
          <span className={`${styles.roleMiniBadge} ${styles.roleCeo}`}>
            <StarIcon style={{ width: 12, height: 12 }} />
            <span>CEO</span>
          </span>
        );
      default:
        return (
          <span className={`${styles.roleMiniBadge} ${styles.roleDefault}`}>
            <span>{role}</span>
          </span>
        );
    }
  };

  return (
    <div className={styles.page}>
      {/* Page Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconBadge}>
            <Squares2X2Icon />
          </div>
          <div className={styles.headerTitleGroup}>
            <h1>User–Department Matrix</h1>
            <p>Assign staff and managers to departments and monitor organizational coverage in real-time.</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setBulkModal('user')}
          >
            <UserPlusIcon />
            <span>Assign User → Department</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => setBulkModal('department')}
          >
            <BuildingOffice2Icon />
            <span>Assign Department → Users</span>
          </button>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh Matrix"
          >
            <ArrowPathIcon className={isRefreshing ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {message && (
        <div className={`${styles.toast} ${message.isError ? styles.error : ''}`}>
          {message.isError ? <ExclamationTriangleIcon /> : <CheckCircleIcon />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Live Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
            <UserGroupIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.totalUsers}</span>
            <span className={styles.statLabel}>Total Team Members</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconPurple}`}>
            <BuildingOffice2Icon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.deptsCount}</span>
            <span className={styles.statLabel}>Active Departments</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconEmerald}`}>
            <CheckCircleIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.assignedUsersCount}</span>
            <span className={styles.statLabel}>Covered Personnel</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconAmber}`}>
            <ChartBarIcon />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.coveragePercent}%</span>
            <span className={styles.statLabel}>Coverage Ratio</span>
          </div>
        </div>
      </div>

      {/* Section 1: Matrix Grid */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <Squares2X2Icon />
            <h2>Interactive Matrix Grid</h2>
            <span className={styles.sectionBadge}>
              {activeDepartments.length} Departments &bull; {grid?.users.length || 0} Users
            </span>
          </div>
          <p className={styles.gridHelperText}>
            Click any cell to immediately toggle department assignment.
          </p>
        </div>

        {loadingGrid || !grid ? (
          <div className={styles.loading}>
            <div className={styles.cellSpinnerDark} style={{ margin: '0 auto 12px' }} />
            <span>Loading matrix intersection grid...</span>
          </div>
        ) : (
          <div className={styles.gridWrapper}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>Team Member</th>
                  {activeDepartments.map((dept) => {
                    const countInDept = grid.users.filter((u) => u.departmentId === dept.id).length;
                    return (
                      <th key={dept.id} title={dept.name}>
                        <div className={styles.deptThContent}>
                          <span className={styles.deptCodeTag}>{dept.code}</span>
                          <span className={styles.deptNameSub}>{dept.name}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                            {countInDept} member{countInDept === 1 ? '' : 's'}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grid.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={`${styles.userAvatar} ${getAvatarClass(user.role)}`}>
                          {getInitials(user.firstName, user.lastName, user.username)}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userNameRow}>
                            <span className={styles.userName}>
                              {user.firstName} {user.lastName}
                            </span>
                            {renderRoleBadge(user.role)}
                          </div>
                          <span className={styles.userHandle}>@{user.username} &bull; {user.email}</span>
                        </div>
                      </div>
                    </td>
                    {activeDepartments.map((dept) => {
                      const assigned = user.departmentId === dept.id;
                      const cellKey = `${user.id}-${dept.id}`;
                      const isSaving = savingCell === cellKey;

                      return (
                        <td key={dept.id}>
                          <button
                            type="button"
                            className={`${styles.toggleBtn} ${assigned ? styles.on : styles.off}`}
                            disabled={isSaving}
                            onClick={() => handleToggleCell(user.id, dept.id, !assigned)}
                            title={
                              assigned
                                ? `Assigned to ${dept.name}. Click to remove.`
                                : `Not assigned to ${dept.name}. Click to assign.`
                            }
                            aria-label={`Toggle ${user.username} in ${dept.code}`}
                          >
                            {isSaving ? (
                              <div className={assigned ? styles.cellSpinner : styles.cellSpinnerDark} />
                            ) : assigned ? (
                              <CheckIcon />
                            ) : (
                              <MinusIcon />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Assignment List */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <BuildingOffice2Icon />
            <h2>Active Assignments Directory</h2>
          </div>
          <span className={styles.listCount}>
            Showing {assignments.length} of {totalCount} active records
          </span>
        </div>

        <div className={styles.listControlBar}>
          <div className={styles.searchBox}>
            <MagnifyingGlassIcon className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search assignments by user, email, department or role..."
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
        </div>

        <DataTable<MatrixAssignment>
          loading={loadingList}
          data={assignments}
          columns={[
            {
              key: 'user',
              label: 'Team Member',
              render: (row) => (
                <div className={styles.userCell}>
                  <div className={`${styles.userAvatar} ${getAvatarClass(row.userRole)}`}>
                    {getInitials(row.firstName, row.lastName, row.username)}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>
                      {row.firstName} {row.lastName}
                    </span>
                    <span className={styles.userHandle}>@{row.username} &bull; {row.email}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'department',
              label: 'Assigned Department',
              render: (row) => (
                <div className={styles.deptChip}>
                  <BuildingOffice2Icon />
                  <span>{row.departmentName} ({row.departmentCode})</span>
                </div>
              ),
            },
            {
              key: 'userRole',
              label: 'Role',
              render: (row) => renderRoleBadge(row.userRole),
            },
            {
              key: 'assignedAt',
              label: 'Assigned Date',
              render: (row) => (
                <div className={styles.dateChip}>
                  <ClockIcon />
                  <span>
                    {row.assignedAt
                      ? new Date(row.assignedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={() => setDeleteModal(row)}
                  title="Remove department assignment"
                >
                  <TrashIcon />
                  <span>Remove</span>
                </button>
              ),
            },
          ]}
        />

        <div className={styles.pagination}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>

      {/* Modal 1: Assign User to Departments */}
      <Modal
        open={bulkModal === 'user'}
        title="Assign User to Department"
        onClose={() => setBulkModal(null)}
      >
        {grid && (
          <MatrixBulkForm
            mode="user"
            users={grid.users}
            departments={activeDepartments}
            onSubmit={handleBulkUser}
          />
        )}
      </Modal>

      {/* Modal 2: Assign Department to Users */}
      <Modal
        open={bulkModal === 'department'}
        title="Assign Department to User"
        onClose={() => setBulkModal(null)}
      >
        {grid && (
          <MatrixBulkForm
            mode="department"
            users={grid.users}
            departments={activeDepartments}
            onSubmit={handleBulkDepartment}
          />
        )}
      </Modal>

      {/* Modal 3: Confirm Delete Assignment */}
      <Modal
        open={Boolean(deleteModal)}
        title="Confirm Remove Assignment"
        onClose={() => setDeleteModal(null)}
      >
        {deleteModal && (
          <div className={styles.confirmModalBody}>
            <div className={styles.confirmWarningBox}>
              <ExclamationTriangleIcon className={styles.confirmWarningIcon} />
              <p>
                Are you sure you want to remove this department assignment? The user will no longer be mapped to this department until reassigned.
              </p>
            </div>

            <div className={styles.confirmDetailsBox}>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Team Member</span>
                <span className={styles.confirmDetailValue}>
                  {deleteModal.firstName} {deleteModal.lastName} (@{deleteModal.username})
                </span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Department</span>
                <span className={styles.confirmDetailValue}>
                  {deleteModal.departmentName} ({deleteModal.departmentCode})
                </span>
              </div>
              <div className={styles.confirmDetailRow}>
                <span className={styles.confirmDetailLabel}>Role</span>
                <span className={styles.confirmDetailValue}>{deleteModal.userRole}</span>
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
                <span>Remove Assignment</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}