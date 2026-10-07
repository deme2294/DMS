import React from 'react';
import { useSocket } from '../../context/SocketContext';
import styles from './ConnectionStatus.module.css';

export const ConnectionStatus: React.FC = () => {
  const { connected } = useSocket();

  return (
    <div
      className={`${styles.badge} ${connected ? styles.connected : styles.disconnected}`}
      role="status"
      aria-live="polite"
      title={connected ? 'Connected to live API server' : 'Disconnected from server'}
    >
      <div className={styles.dotWrapper}>
        <span className={styles.ping} />
        <span className={styles.dot} />
      </div>
      <span className={styles.text}>{connected ? 'Online' : 'Reconnecting...'}</span>

      <div className={styles.tooltip}>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>API Server:</span>
          <span className={styles.tooltipValue}>{connected ? 'Online' : 'Offline'}</span>
        </div>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Port:</span>
          <span className={styles.tooltipValue}>5000</span>
        </div>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>WebSocket:</span>
          <span className={styles.tooltipValue}>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
