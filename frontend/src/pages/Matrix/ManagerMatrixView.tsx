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

export default function ManagerMatrixView() {
  const { page, limit, setPage, resetPage } = usePagination(1, 15);
  const [grid, setGrid] = useState<MatrixGridData | null>(null);
  const [assignments, setAssignments] = useState<MatrixAssignment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingGrid, setLoadingGrid] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [bulkModal, setBulkModal] = useState<'user' | 'department' | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const loadGrid = useCallback(async () => {
    setLoadingGrid(true);
    try {
      const res = await fetchMatrixGrid();
      setGrid(res.data.data);
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
    } finally {
      setLoadingList(false);
    }
  }, [search, page, limit]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const activeDepartments = useMemo(
    () => grid?.departments.filter((d) => d.status === 'active') || [],
    [grid]
  );

  const handleToggleCell = async (userId: string, departmentId: string, assigned: boolean) => {
    const key = `${userId}-${departmentId}`;
    setSavingCell(key);
    try {
      await toggleAssignment({ userId, departmentId, assigned });
      setMessage(assigned ? 'Assignment added' : 'Assignment removed');
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to toggle assignment');
    } finally {
      setSavingCell(null);
    }
  };

  const handleDeleteAssignment = async (assignment: MatrixAssignment) => {
    if (!window.confirm('Remove this assignment?')) return;
    await deleteAssignment(assignment.id);
    setMessage('Assignment deleted');
    await Promise.all([loadGrid(), loadAssignments()]);
  };

  const handleBulkUser = async ({ id, selectedId }: { id: string; selectedId: string | null }) => {
    try {
      await assignUserToDepartment(id, selectedId);
      setBulkModal(null);
      setMessage('User department updated');
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to assign user to department');
    }
  };

  const handleBulkDepartment = async ({ id, selectedId }: { id: string; selectedId: string | null }) => {
    try {
      await assignDepartmentToUser(id, selectedId);
      setBulkModal(null);
      setMessage('Department user updated');
      await Promise.all([loadGrid(), loadAssignments()]);
    } catch (err) {
      setMessage((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to assign department to user');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>User–Department Matrix</h1>
          <p>Assign users in your departments and manage organizational coverage.</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setBulkModal('user')}>👤 Assign User → Departments</button>
          <button onClick={() => setBulkModal('department')}>🏢 Assign Department → Users</button>
        </div>
      </div>

      {message && <div className={styles.toast}>{message}</div>}

      <section className={styles.section}>
        <h2>Matrix Grid</h2>
        {loadingGrid || !grid ? (
          <div className={styles.loading}>Loading matrix...</div>
        ) : (
          <div className={styles.gridWrapper}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>User</th>
                  {activeDepartments.map((dept) => (
                    <th key={dept.id} title={dept.name}>
                      {dept.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <strong>{user.firstName} {user.lastName}</strong>
                        <span>{user.role}</span>
                      </div>
                    </td>
                    {activeDepartments.map((dept) => {
                      const assigned = user.departmentId === dept.id;
                      const cellKey = `${user.id}-${dept.id}`;
                      return (
                        <td key={dept.id} className={styles.cell}>
                          <button
                            type="button"
                            className={`${styles.toggle} ${assigned ? styles.on : styles.off}`}
                            disabled={savingCell === cellKey}
                            onClick={() => handleToggleCell(user.id, dept.id, !assigned)}
                            aria-label={`Toggle ${user.username} in ${dept.code}`}
                          >
                            {assigned ? '✓' : '—'}
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

      <section className={styles.section}>
        <div className={styles.listHeader}>
          <h2>Assignment List</h2>
          <input
            placeholder="Search assignments..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>

        <DataTable<MatrixAssignment>
          loading={loadingList}
          data={assignments}
          columns={[
            {
              key: 'user',
              label: 'User',
              render: (row) => `${row.firstName} ${row.lastName} (${row.username})`,
            },
            {
              key: 'department',
              label: 'Department',
              render: (row) => `${row.departmentName} (${row.departmentCode})`,
            },
            { key: 'userRole', label: 'Role' },
            {
              key: 'assignedAt',
              label: 'Assigned',
              render: (row) =>
                row.assignedAt ? new Date(row.assignedAt).toLocaleString() : '—',
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button className={styles.danger} onClick={() => handleDeleteAssignment(row)}>
                  Remove
                </button>
              ),
            },
          ]}
        />

        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>

      <Modal
        open={bulkModal === 'user'}
        title="Assign User to Departments"
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

      <Modal
        open={bulkModal === 'department'}
        title="Assign Department to Users"
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
    </div>
  );
}
