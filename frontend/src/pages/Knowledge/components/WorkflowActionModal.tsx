import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal/Modal';
import type { Article } from '../../../types/article';
import styles from '../KnowledgeMyArticles.module.css';

export type WorkflowActionType = 'request_revision' | 'reject' | 'publish' | 'unpublish' | 'submit';

interface WorkflowActionModalProps {
  open: boolean;
  actionType: WorkflowActionType | null;
  article: Article | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (articleId: string, actionType: WorkflowActionType, reason?: string) => Promise<void>;
}

export const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  open,
  actionType,
  article,
  busy,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setValidationError('');
    }
  }, [open, actionType]);

  if (!open || !article || !actionType) return null;

  const getModalMeta = () => {
    switch (actionType) {
      case 'request_revision':
        return {
          title: '⚠️ Request Revision (Feedback for Author)',
          description: `Specify the required changes and feedback for the Department Manager / author of "${article.title}".`,
          fieldLabel: 'Revision Feedback & Requested Changes *',
          placeholder: 'E.g., Please clarify step 3, update outdated department screenshots, and verify security protocols before approval...',
          buttonLabel: 'Send Revision Request',
          buttonClass: styles.revisionSubmitBtn,
          requiresReason: true,
          suggestions: [
            'Clarify step-by-step resolution details',
            'Update outdated screenshots or links',
            'Align with latest department policy guidelines',
            'Provide code or terminal command formatting',
          ],
        };
      case 'reject':
        return {
          title: '✕ Reject Article',
          description: `Are you sure you want to reject "${article.title}"? Provide a mandatory reason explaining why this article cannot be accepted.`,
          fieldLabel: 'Rejection Reason *',
          placeholder: 'E.g., Duplicate of existing KB-0042, or topic out of scope for department...',
          buttonLabel: 'Confirm Rejection',
          buttonClass: styles.dangerSubmitBtn,
          requiresReason: true,
          suggestions: [
            'Duplicate topic already covered in another article',
            'Information is out of scope or deprecated',
            'Security policy prohibits publishing this internal procedure',
          ],
        };
      case 'publish':
        return {
          title: '🌐 Publish Article to Live Knowledge Base',
          description: `You are about to make "${article.title}" (${article.articleReference}) publicly available according to its visibility setting (${article.visibility}).`,
          fieldLabel: 'Publishing Note (Optional)',
          placeholder: 'Optional release note or admin remark...',
          buttonLabel: 'Publish Article Now',
          buttonClass: styles.publishSubmitBtn,
          requiresReason: false,
        };
      case 'unpublish':
        return {
          title: '⏸ Unpublish Article',
          description: `Taking "${article.title}" offline will immediately hide it from portal readers and tenants.`,
          fieldLabel: 'Unpublish Reason (Optional)',
          placeholder: 'E.g., Temporarily reviewing information accuracy...',
          buttonLabel: 'Unpublish Article',
          buttonClass: styles.warningSubmitBtn,
          requiresReason: false,
        };
      case 'submit':
        return {
          title: '📤 Submit Article for Admin Review',
          description: `Submit "${article.title}" to the Admin review and approval queue. Once submitted, Admins will verify or request revisions.`,
          fieldLabel: 'Author Submission Notes (Optional)',
          placeholder: 'E.g., Initial draft ready for department review with updated procedures...',
          buttonLabel: 'Submit for Review',
          buttonClass: styles.submitModalBtn,
          requiresReason: false,
        };
    }
  };

  const meta = getModalMeta();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meta.requiresReason && !reason.trim()) {
      setValidationError('Please provide the required feedback or reason before proceeding.');
      return;
    }
    await onSubmit(article.id, actionType, reason.trim());
  };

  return (
    <Modal open={open} title={meta.title} onClose={busy ? () => {} : onClose}>
      <form onSubmit={handleConfirm} className={styles.modalForm}>
        <p className={styles.modalDescription}>{meta.description}</p>

        {/* Article Summary Capsule */}
        <div className={styles.articleCapsule}>
          <div className={styles.capsuleHeader}>
            <span className={styles.capsuleRef}>{article.articleReference}</span>
            <span className={styles.capsuleCategory}>{article.category}</span>
            {article.departmentName && (
              <span className={styles.capsuleDept}>🏢 {article.departmentName}</span>
            )}
          </div>
          <div className={styles.capsuleTitle}>{article.title}</div>
        </div>

        {meta.fieldLabel && (
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>{meta.fieldLabel}</label>
            <textarea
              className={styles.textareaField}
              rows={4}
              placeholder={meta.placeholder}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError('');
              }}
              disabled={busy}
              autoFocus
            />

            {meta.suggestions && (
              <div className={styles.suggestionWrap}>
                <span className={styles.suggestionLabel}>Quick suggestions:</span>
                <div className={styles.suggestionChips}>
                  {meta.suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => {
                        setReason((prev) => (prev ? `${prev}\n• ${sug}` : `• ${sug}`));
                        if (validationError) setValidationError('');
                      }}
                      disabled={busy}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {validationError && (
              <div className={styles.modalError}>{validationError}</div>
            )}
          </div>
        )}

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
            className={meta.buttonClass}
            disabled={busy}
          >
            {busy ? 'Processing...' : meta.buttonLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
