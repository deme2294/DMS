import React, { useState, useEffect } from 'react';
import type { ChatMessage } from '../../../api/chatApi';
import { parseMeetingMessage, formatTimeOnly } from '../types';
import styles from '../ChatPage.module.css';

interface DeleteMessageModalProps {
  show: boolean;
  message: ChatMessage | null;
  currentUserId: string;
  deleting: boolean;
  onClose: () => void;
  onConfirmDelete: (deleteType: 'everyone' | 'for_me') => void;
}

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  show,
  message,
  currentUserId,
  deleting,
  onClose,
  onConfirmDelete,
}) => {
  const isOwn = message?.sender_id === currentUserId;
  const [deleteType, setDeleteType] = useState<'everyone' | 'for_me'>(isOwn ? 'everyone' : 'for_me');

  useEffect(() => {
    if (message) {
      setDeleteType(message.sender_id === currentUserId ? 'everyone' : 'for_me');
    }
  }, [message, currentUserId]);

  if (!show || !message) return null;

  const meetingInfo = parseMeetingMessage(message.message);
  const isMeeting = Boolean(meetingInfo);
  const isImage = message.attachment_path && message.message_type === 'image';
  const isFile = message.attachment_path && message.message_type === 'file';

  const authorName = isOwn
    ? 'You'
    : `${message.first_name || ''} ${message.last_name || ''}`.trim() || 'Sender';

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={`${styles.modalContent} ${styles.deleteModalContainer}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Header */}
        <div className={styles.deleteModalHeader}>
          <div className={styles.deleteModalIconBox}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div className={styles.deleteModalTitleWrapper}>
            <h3 id="delete-dialog-title" className={styles.deleteModalTitle}>
              {isMeeting ? 'Delete Video Call Invite' : 'Delete Message'}
            </h3>
            <p className={styles.deleteModalSubtitle}>
              Choose how you would like to delete this {isMeeting ? 'video call' : 'message'}.
            </p>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.deleteModalBody}>
          {/* Message Preview */}
          <div className={styles.deleteMessagePreviewBox}>
            <div className={styles.deletePreviewMeta}>
              <span className={styles.deletePreviewAuthor}>
                {authorName}
                {isOwn && <span className={styles.deletePreviewAuthorTag}> (Author)</span>}
              </span>
              <span className={styles.deletePreviewTime}>
                {formatTimeOnly(message.created_at)}
              </span>
            </div>

            {isMeeting && meetingInfo ? (
              <div className={styles.deletePreviewMeeting}>
                <span className={styles.deletePreviewBadge}>🎥 Video Call</span>
                <span className={styles.deletePreviewText}>
                  <strong>{meetingInfo.title}</strong>
                </span>
              </div>
            ) : isImage ? (
              <div className={styles.deletePreviewMedia}>
                <span>🖼️ Attached Image</span>
                {message.attachment_name && (
                  <span className={styles.deleteFileName}>({message.attachment_name})</span>
                )}
              </div>
            ) : isFile ? (
              <div className={styles.deletePreviewMedia}>
                <span>📄 Attached File</span>
                {message.attachment_name && (
                  <span className={styles.deleteFileName}>({message.attachment_name})</span>
                )}
              </div>
            ) : (
              <div className={styles.deletePreviewContent}>
                {message.message}
              </div>
            )}
          </div>

          {/* Delete Option Selector Cards */}
          <div className={styles.deleteOptionsContainer}>
            {/* Option 1: Delete for Everyone (Available only for Creator/Author) */}
            {isOwn && (
              <label
                className={`${styles.deleteOptionCard} ${
                  deleteType === 'everyone' ? styles.deleteOptionCardSelected : ''
                }`}
                onClick={() => setDeleteType('everyone')}
              >
                <div className={styles.deleteOptionRadio}>
                  <input
                    type="radio"
                    name="deleteType"
                    value="everyone"
                    checked={deleteType === 'everyone'}
                    onChange={() => setDeleteType('everyone')}
                    disabled={deleting}
                  />
                </div>
                <div className={styles.deleteOptionContent}>
                  <div className={styles.deleteOptionTitleRow}>
                    <span className={styles.deleteOptionTitle}>Delete for everyone</span>
                    <span className={styles.deleteOptionBadgeDanger}>Permanent</span>
                  </div>
                  <p className={styles.deleteOptionDescription}>
                    Permanently deletes this {isMeeting ? 'video call' : 'message'} from the chat room for all participants in real time.
                  </p>
                </div>
              </label>
            )}

            {/* Option 2: Delete Only for Me (Available for everyone) */}
            <label
              className={`${styles.deleteOptionCard} ${
                deleteType === 'for_me' ? styles.deleteOptionCardSelected : ''
              }`}
              onClick={() => setDeleteType('for_me')}
            >
              <div className={styles.deleteOptionRadio}>
                <input
                  type="radio"
                  name="deleteType"
                  value="for_me"
                  checked={deleteType === 'for_me'}
                  onChange={() => setDeleteType('for_me')}
                  disabled={deleting}
                />
              </div>
              <div className={styles.deleteOptionContent}>
                <div className={styles.deleteOptionTitleRow}>
                  <span className={styles.deleteOptionTitle}>Delete only for me</span>
                  <span className={styles.deleteOptionBadgeMuted}>My Screen</span>
                </div>
                <p className={styles.deleteOptionDescription}>
                  Removes this {isMeeting ? 'video call' : 'message'} from your screen only. Other participants will still be able to see it.
                </p>
              </div>
            </label>
          </div>

          {/* Context Alert Warning */}
          {deleteType === 'everyone' ? (
            <div className={styles.deleteWarningAlert}>
              <span className={styles.warningAlertIcon}>⚠️</span>
              <span>
                "Delete for everyone" will immediately remove this {isMeeting ? 'video conference session' : 'message'} from all connected screens.
              </span>
            </div>
          ) : (
            <div className={styles.deleteInfoAlert}>
              <span className={styles.warningAlertIcon}>ℹ️</span>
              <span>
                "Delete only for me" will hide this from your device and history without modifying it for other members.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.deleteModalFooter}>
          <button
            type="button"
            className={styles.deleteCancelBtn}
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              deleteType === 'everyone'
                ? styles.deleteConfirmBtn
                : styles.deleteForMeConfirmBtn
            }
            onClick={() => onConfirmDelete(deleteType)}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <span className={styles.miniSpinner} />
                Deleting...
              </>
            ) : deleteType === 'everyone' ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete for Everyone
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Delete only for Me
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default DeleteMessageModal;
