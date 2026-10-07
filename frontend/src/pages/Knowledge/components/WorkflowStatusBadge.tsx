import React from 'react';
import type { ArticleStatus } from '../../../types/article';
import { getLatestRevisionItem } from '../../../utils/revisionUtils';
import styles from '../KnowledgeMyArticles.module.css';

interface WorkflowStatusBadgeProps {
  status: ArticleStatus | string;
  showSubtitle?: boolean;
  role?: string;
  reviewedBy?: string | null;
  revisionNotes?: string | null;
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, showSubtitle = false, role, reviewedBy, revisionNotes }) => {
  switch (status) {
    case 'draft':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageDraft}`}>
            <span className={styles.badgeDotDraft} />
            📝 Draft
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Author editable</span>}
        </div>
      );
    case 'pending_approval': {
      const isApprovedByDept = Boolean(reviewedBy);
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${isApprovedByDept ? (styles.stagePendingAdmin || styles.stagePending) : styles.stagePending}`}>
            <span className={isApprovedByDept ? (styles.badgeDotPendingAdmin || styles.badgeDotPending) : styles.badgeDotPending} />
            {isApprovedByDept ? '⏳ Pending Review for Admin' : '⏳ Pending Dept Review'}
          </span>
          {showSubtitle && (
            <span className={styles.badgeHint}>
              {isApprovedByDept
                ? 'Approved by Dept Manager · Ready for Admin Review & Publish'
                : 'Awaiting Department Manager Verification'}
            </span>
          )}
        </div>
      );
    }
    case 'needs_revision': {
      const latestRev = getLatestRevisionItem(revisionNotes);
      const isRoutedToAuthor = latestRev?.step === 'manager_revision';
      const isRoutedToManager = latestRev?.step === 'admin_revision' && latestRev?.targetRole === 'manager';

      let label = '⚠️ Needs Revision';
      let hint = 'Revision requested';

      if (isRoutedToAuthor) {
        label = '⚠️ Revision Routed to Author';
        hint = 'Manager forwarded revision instructions to Author';
      } else if (isRoutedToManager) {
        label = '⚠️ Revision with Manager';
        hint = 'Admin requested changes from Department Manager';
      }

      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageRevision}`}>
            <span className={styles.badgeDotRevision} />
            {label}
          </span>
          {showSubtitle && <span className={styles.badgeHint}>{hint}</span>}
        </div>
      );
    }
    case 'approved':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageApproved}`}>
            <span className={styles.badgeDotApproved} />
            ✓ Approved
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Approved by Admin · Ready to Publish</span>}
        </div>
      );
    case 'published':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stagePublished}`}>
            <span className={styles.badgeDotPublished} />
            🌐 Published
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Live for portal users</span>}
        </div>
      );
    case 'unpublished':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageUnpublished}`}>
            ⏸ Unpublished
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Hidden from public</span>}
        </div>
      );
    case 'rejected':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageRejected}`}>
            ✕ Rejected
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Declined by reviewer</span>}
        </div>
      );
    case 'archived':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageArchived}`}>
            📦 Archived
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Retired from live portal</span>}
        </div>
      );
    case 'restored':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageRestored}`}>
            <span className={styles.badgeDotRestored} />
            🔄 Restored
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Recovered · Edit to Draft or Re-publish</span>}
        </div>
      );
    default:
      return (
        <span className={styles.statusWorkflowBadge}>
          {String(status).replace(/_/g, ' ')}
        </span>
      );
  }
};
