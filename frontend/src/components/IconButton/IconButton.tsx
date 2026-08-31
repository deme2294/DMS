import React from 'react';
import styles from './IconButton.module.css';

export type IconButtonVariant = 
  | 'add' 
  | 'edit' 
  | 'view' 
  | 'delete' 
  | 'activate' 
  | 'deactivate' 
  | 'reset'
  | 'approve'
  | 'reject'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'send'
  | 'reply'
  | 'archive'
  | 'assign'
  | 'close';

interface IconButtonProps {
  variant: IconButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const icons: Record<IconButtonVariant, string> = {
  add: '➕',
  edit: '✏️',
  view: '👁️',
  delete: '🗑️',
  activate: '✅',
  deactivate: '⏸️',
  reset: '🔄',
  approve: '✔️',
  reject: '✖️',
  download: '⬇️',
  upload: '⬆️',
  refresh: '🔃',
  send: '📤',
  reply: '💬',
  archive: '📦',
  assign: '👤',
  close: '✕',
};

const defaultTitles: Record<IconButtonVariant, string> = {
  add: 'Add',
  edit: 'Edit',
  view: 'View',
  delete: 'Delete',
  activate: 'Activate',
  deactivate: 'Deactivate',
  reset: 'Reset',
  approve: 'Approve',
  reject: 'Reject',
  download: 'Download',
  upload: 'Upload',
  refresh: 'Refresh',
  send: 'Send',
  reply: 'Reply',
  archive: 'Archive',
  assign: 'Assign',
  close: 'Close',
};

export default function IconButton({
  variant,
  onClick,
  disabled = false,
  title,
  size = 'medium',
  className = '',
}: IconButtonProps) {
  return (
    <button
      className={`${styles.iconButton} ${styles[variant]} ${styles[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title || defaultTitles[variant]}
      aria-label={title || defaultTitles[variant]}
    >
      {icons[variant]}
    </button>
  );
}
