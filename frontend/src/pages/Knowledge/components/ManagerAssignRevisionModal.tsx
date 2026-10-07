import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal/Modal';
import type { Article } from '../../../types/article';
import { getAdminRevisionDirective, getLatestRevisionItem } from '../../../utils/revisionUtils';
import styles from './ManagerAssignRevisionModal.module.css';

interface ManagerAssignRevisionModalProps {
  open: boolean;
  article: Article | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (articleId: string, managerComment: string) => Promise<void>;
}

export const ManagerAssignRevisionModal: React.FC<ManagerAssignRevisionModalProps> = ({
  open,
  article,
  busy,
  onClose,
  onSubmit,
}) => {
  const [managerNotes, setManagerNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setManagerNotes('');
      setError('');
    }
  }, [open, article]);

  if (!open || !article) return null;

  // Retrieve Admin's directive and feedback from revision history
  const adminDirective = getAdminRevisionDirective(article.revisionNotes) || getLatestRevisionItem(article.revisionNotes);
  const adminComment = adminDirective?.comment || article.revisionNotes || 'Changes requested by System Administrator.';

  const authorDisplayName = [article.authorFirstName, article.authorLastName].filter(Boolean).join(' ') || 'Article Author';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerNotes.trim()) {
      setError('Please add your review notes and directions before assigning revision to the author.');
      return;
    }
    await onSubmit(article.id, managerNotes.trim());
  };

  const suggestions = [
    'Update outdated department screenshots and system links',
    'Follow departmental step-by-step format and policy guidelines',
    'Provide verified terminal commands and configuration outputs',
    'Clarify troubleshooting section and known resolution pitfalls',
  ];

  return (
    <Modal
      open={open}
      title="🏢 Review & Assign Revision to Author"
      onClose={busy ? () => {} : onClose}
      maxWidth="620px"
    >
      <form onSubmit={handleConfirm} className={styles.modalForm}>
        <p className={styles.modalDescription}>
          As Department Manager, inspect Admin’s required changes, add your departmental directions, and assign this article to <strong>{authorDisplayName}</strong> for revision.
        </p>

        {/* Article Summary Capsule */}
        <div className={styles.articleCapsule}>
          <div className={styles.capsuleHeader}>
            <span className={styles.capsuleRef}>{article.articleReference}</span>
            <span className={styles.capsuleCategory}>{article.category}</span>
            {article.departmentName && (
              <span className={styles.capsuleDept}>🏢 {article.departmentName}</span>
            )}
            <span className={styles.capsuleAuthor}>👤 Author: {authorDisplayName}</span>
          </div>
          <div className={styles.capsuleTitle}>{article.title}</div>
        </div>

        {/* Admin Revision Directive Box */}
        <div className={styles.adminDirectiveCard}>
          <div className={styles.adminDirectiveHeader}>
            <span className={styles.adminDirectiveTitle}>
              ⚠️ Admin Requested Changes
            </span>
            {adminDirective?.createdAt && (
              <span className={styles.adminDirectiveTime}>
                Requested: {new Date(adminDirective.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className={styles.adminDirectiveContent}>{adminComment}</div>
        </div>

        {/* Manager Input */}
        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>
            Manager Review & Directions for Author *
          </label>
          <textarea
            className={styles.textareaField}
            rows={4}
            placeholder={`Provide specific instructions for ${authorDisplayName}, e.g. "Please address the admin feedback above, replace the screenshots on slide 3 with the new IT Support template, and submit new version back to me for approval..."`}
            value={managerNotes}
            onChange={(e) => {
              setManagerNotes(e.target.value);
              if (error) setError('');
            }}
            disabled={busy}
            autoFocus
          />

          <div className={styles.suggestionWrap}>
            <span className={styles.suggestionLabel}>Quick suggestions:</span>
            <div className={styles.suggestionChips}>
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() => {
                    setManagerNotes((prev) => (prev ? `${prev}\n• ${sug}` : `• ${sug}`));
                    if (error) setError('');
                  }}
                  disabled={busy}
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.modalError}>{error}</div>}
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.assignBtn}
            disabled={busy}
          >
            {busy ? 'Assigning...' : 'Assign Revision to Author'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ManagerAssignRevisionModal;
