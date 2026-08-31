import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { fetchTickets, closeTicket, changeTicketStatus, reopenTicket } from '../../api/ticketApi';
import { fetchCategories } from '../../api/categoryApi';
import type { Ticket } from '../../types/ticket';
import { STATUS_LABELS } from '../../types/ticket';
import styles from './CeoApprovals.module.css';

export default function CeoApprovals() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      flash(ok);
      load();
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Executive Approvals" description="Review and act on escalated tickets requiring CEO oversight" />

      {message && <div className={styles.toast}>{message}</div>}
      {loading && <div className={styles.loading}>Loading escalated tickets…</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Department</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className={styles.strong}>{t.referenceNumber}</td>
                <td>{t.title}</td>
                <td><span className={`${styles.badge} ${styles[t.priority] || ''}`}>{t.priority}</span></td>
                <td>{t.departmentName || '—'}</td>
                <td>{t.assignedToName || '—'}</td>
                <td className={styles.actions}>
                  <button className={styles.approve} onClick={() => act(t.id, () => closeTicket(t.id), 'Ticket closed')}>Close</button>
                  <button className={styles.reject} onClick={() => act(t.id, () => changeTicketStatus(t.id, { status: 'in_progress' }), 'Sent back to work')}>Return to Work</button>
                  <button className={styles.secondary} onClick={() => act(t.id, () => reopenTicket(t.id), 'Ticket reopened')}>Reopen</button>
                </td>
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
