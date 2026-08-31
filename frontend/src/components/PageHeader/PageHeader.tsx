import { useNavigate } from 'react-router-dom';
import styles from './PageHeader.module.css';

type Props = {
  title: string;
  description?: string;
  backTo?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionLoading?: boolean;
};

export default function PageHeader({
  title,
  description,
  backTo,
  actionLabel,
  onAction,
  actionDisabled,
  actionLoading,
}: Props) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.left}>
        {backTo && (
          <button
            type="button"
            onClick={handleBack}
            className={styles.backBtn}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled || actionLoading}
          className={styles.actionBtn}
        >
          {actionLoading ? (
            <>
              <span className={styles.spinner} />
              Saving...
            </>
          ) : (
            actionLabel
          )}
        </button>
      )}
    </div>
  );
}

