import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { fetchTickets } from '../../api/ticketApi';
import { fetchCategories } from '../../api/categoryApi';
import type { Ticket } from '../../types/ticket';
import { STATUS_LABELS } from '../../types/ticket';
import styles from './CeoApprovals.module.css';

export default function CeoApprovals() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchTickets({ status: 'escalated', limit: 100 })
      .then((r) => setTickets(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchCategories().catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Executive Approvals"
        description="Review escalated tickets requiring executive oversight. Direct handling is performed by department managers."
      />

      {loading && <div className={styles.loading}>Loading escalated tickets…</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Department</th>
              <th>Assigned To</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className={styles.strong}>{t.referenceNumber}</td>
                <td>{t.title}</td>
                <td><span className={`${styles.badge} ${styles[t.priority] || ''}`}>{t.priority}</span></td>
                <td><span className={styles.strong}>{STATUS_LABELS[t.status] || t.status}</span></td>
                <td>{t.departmentName || '—'}</td>
                <td>{t.assignedToName || '—'}</td>
              </tr>
            ))}
            {!tickets.length && !loading && (
              <tr><td colSpan={6} className={styles.empty}>No escalated tickets awaiting approval</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
