import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import { fetchMatrixGrid, fetchAssignments } from '../../api/matrixApi';
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Department Roster &amp; Coverage Matrix</h1>
          <p>View users and staff members assigned to your department. Assignments are managed centrally by the System Administrator.</p>
          {activeDepartments.length > 0 && (
            <div className={styles.deptTags}>
              {activeDepartments.map((dept) => (
                <span key={dept.id} className={styles.deptTag}>
                  🏛️ {dept.name} ({dept.code})
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badgeReadonly}>🔒 View-Only Roster</span>
        </div>
      </div>

      <div className={styles.infoBanner}>
        <span>ℹ️</span>
        <div>
          <strong>Department Coverage:</strong> You are viewing staff and users assigned to your department. User-to-department assignments and reallocations are managed centrally by the <strong>System Administrator</strong> on the Admin Matrix page.
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Matrix Grid</h2>
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
                {grid.users.length === 0 ? (
                  <tr>
                    <td colSpan={activeDepartments.length + 1} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      No users currently assigned to your department.
                    </td>
                  </tr>
                ) : (
                  grid.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userCell}>
                          <strong>{user.firstName} {user.lastName}</strong>
                          <span>{user.role} &bull; {user.email || user.username}</span>
                        </div>
                      </td>
                      {activeDepartments.map((dept) => {
                        const assigned = user.departmentId === dept.id;
                        return (
                          <td key={dept.id} className={styles.cell}>
                            {assigned ? (
                              <div
                                className={styles.assignedIndicator}
                                title={`${user.firstName} ${user.lastName} is assigned to ${dept.name}`}
                              >
                                ✓
                              </div>
                            ) : (
                              <span className={styles.unassignedIndicator}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.listHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Department Team Roster</h2>
            <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#64748b' }}>
              Detailed directory of active team members in your department.
            </p>
          </div>
          <input
            placeholder="Search team members..."
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
              render: (row) => (
                <div className={styles.userCell}>
                  <strong>{row.firstName} {row.lastName}</strong>
                  <span>@{row.username} &bull; {row.email}</span>
                </div>
              ),
            },
            {
              key: 'department',
              label: 'Department',
              render: (row) => `${row.departmentName} (${row.departmentCode})`,
            },
            {
              key: 'userRole',
              label: 'Role',
              render: (row) => (
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                  {row.userRole}
                </span>
              ),
            },
            {
              key: 'assignedAt',
              label: 'Assigned Date',
              render: (row) =>
                row.assignedAt
                  ? new Date(row.assignedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—',
            },
            {
              key: 'status',
              label: 'Coverage Status',
              render: () => (
                <span className={styles.statusPill}>
                  ✓ Active Member
                </span>
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
      </section>
    </div>
  );
}
