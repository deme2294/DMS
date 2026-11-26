import styles from './Modal.module.css';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
};

const SIZE_MAP: Record<string, string> = {
  sm: '480px',
  md: '680px',
  lg: '860px',
  xl: '1040px',
  full: '96vw',
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth,
  size,
}: Props) {
  if (!open) return null;

  const resolvedMaxWidth = maxWidth || (size ? SIZE_MAP[size] : '680px');

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: resolvedMaxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

