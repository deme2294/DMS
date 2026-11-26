import { useState } from 'react';
import { trackTicket } from '../../api/ticketApi';
import type { TicketTrackInfo } from '../../types/ticket';
import { getStatusLabel } from '../../types/ticket';
import {
  MagnifyingGlassIcon,
  TicketIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import styles from './TrackTicket.module.css';

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
      setError('Ticket not found. Please verify your tracking number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.cardWrapper}>
        <div className={styles.headerSection}>
          <div className={styles.headerBadge}>
            <TicketIcon style={{ width: 16, height: 16 }} />
            <span>Self-Service Portal</span>
          </div>
          <h1 className={styles.title}>Track Your Ticket</h1>
          <p className={styles.subtitle}>
            Enter your tracking number below to check the real-time status and assignment.
          </p>
        </div>

        <div className={styles.trackCard}>
          <form className={styles.trackForm} onSubmit={handleTrack}>
            <div className={styles.inputWrapper}>
              <MagnifyingGlassIcon className={styles.inputIcon} />
              <input
                className={styles.input}
                placeholder="e.g. TRK-2024-XXXX"
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Searching...' : 'Track Ticket'}
            </button>
          </form>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <ExclamationCircleIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <div>
                <h3 className={styles.resultTitle}>{result.title}</h3>
                <span className={styles.resultRef}>REF: {result.referenceNumber}</span>
              </div>
              <span className={styles.statusBadge}>
                {getStatusLabel(result.status)}
              </span>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Track Number</span>
                <span className={styles.infoValue}>{result.trackNumber}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Priority</span>
                <span className={styles.infoValue}>{result.priority}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Category</span>
                <span className={styles.infoValue}>{result.category}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Department</span>
                <span className={styles.infoValue}>{result.departmentName || '—'}</span>
              </div>
              <div className={styles.infoItem} style={{ gridColumn: 'span 2' }}>
                <span className={styles.infoLabel}>Last Updated</span>
                <span className={styles.infoValue}>
                  {result.updatedAt ? new Date(result.updatedAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
