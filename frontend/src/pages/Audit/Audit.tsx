import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/Tables/DataTable';
import { fetchAuditLogs, exportAuditLogs } from '../../api/auditApi';
import type { AuditLog, AuditFilter } from '../../api/auditApi';
import { usePagination } from '../../hooks/usePagination';
import styles from './Audit.module.css';

export default function Audit() {
  const { page, limit, setPage, resetPage } = usePagination();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuditFilter>({});

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ ...filter, page, limit });
      setLogs(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [filter, page, limit]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const actions = [
    'create', 'update', 'delete', 'login', 'logout', 'assign', 'unassign',
  ];
  const entities = ['ticket', 'user', 'department', 'tenant', 'notice', 'knowledge'];

  const handleFilterChange = (newFilter: Partial<AuditFilter>) => {
    setFilter({ ...filter, ...newFilter });
    resetPage();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Audit Log</h1>
        <p>View system audit logs with filtering capabilities.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            placeholder="User ID..."
            value={filter.userId ?? ''}
            onChange={(e) => handleFilterChange({ userId: e.target.value })}
          />
          <select
            value={filter.action ?? ''}
            onChange={(e) => handleFilterChange({ action: e.target.value || undefined })}
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={filter.entity ?? ''}
            onChange={(e) => handleFilterChange({ entity: e.target.value || undefined })}
          >
            <option value="">All Entities</option>
            {entities.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button onClick={() => exportAuditLogs(filter)}>Export CSV</button>
        </div>
      </div>

      <DataTable<AuditLog>
        loading={loading}
        data={logs}
        emptyMessage="No audit logs found"
        columns={[
          { key: 'username', label: 'User' },
          { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Entity' },
          { key: 'createdAt', label: 'Date', render: (row) =>
            new Date(row.createdAt).toLocaleString()
          },
          { key: 'details', label: 'Details', render: (row) => row.details ?? '—' },
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