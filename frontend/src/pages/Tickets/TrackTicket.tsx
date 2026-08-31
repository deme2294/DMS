import { useState } from 'react';
import { trackTicket } from '../../api/ticketApi';
import type { TicketTrackInfo } from '../../types/ticket';
import { STATUS_LABELS } from '../../types/ticket';
import styles from './Tickets.module.css';

export default function TrackTicket() {
  const [trackNumber, setTrackNumber] = useState('');
  const [result, setResult] = useState<TicketTrackInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await trackTicket(trackNumber.trim());
      setResult(res.data.data);
    } catch {
      setError('Ticket not found. Check your track number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1>Track Your Ticket</h1>
      <p className={styles.subtitle}>Enter your track number to check ticket status.</p>

      <form className={styles.trackForm} onSubmit={handleTrack}>
        <input
          placeholder="e.g. TRK-XXXX-XXXX"
          value={trackNumber}
          onChange={(e) => setTrackNumber(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Track'}
        </button>
      </form>

      {error && <div className={styles.errorBox}>{error}</div>}

      {result && (
        <div className={styles.card}>
          <h3>{result.title}</h3>
          <p><strong>Reference:</strong> {result.referenceNumber}</p>
          <p><strong>Track Number:</strong> {result.trackNumber}</p>
          <p><strong>Status:</strong> {STATUS_LABELS[result.status]}</p>
          <p><strong>Priority:</strong> {result.priority}</p>
          <p><strong>Category:</strong> {result.category}</p>
          <p><strong>Department:</strong> {result.departmentName || '—'}</p>
          <p><strong>Last Updated:</strong> {result.updatedAt ? new Date(result.updatedAt).toLocaleString() : '—'}</p>
        </div>
      )}
    </div>
  );
}
