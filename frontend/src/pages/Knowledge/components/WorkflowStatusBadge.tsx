import React from 'react';
import type { ArticleStatus } from '../../../types/article';
import styles from '../KnowledgeMyArticles.module.css';

interface WorkflowStatusBadgeProps {
  status: ArticleStatus | string;
  showSubtitle?: boolean;
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, showSubtitle = false }) => {
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
    case 'pending_approval':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stagePending}`}>
            <span className={styles.badgeDotPending} />
            ⏳ Under Review
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Awaiting Admin Verification</span>}
        </div>
      );
    case 'needs_revision':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageRevision}`}>
            <span className={styles.badgeDotRevision} />
            ⚠️ Needs Revision
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Admin requested changes</span>}
        </div>
      );
    case 'approved':
      return (
        <div className={styles.badgeWrapper}>
          <span className={`${styles.statusWorkflowBadge} ${styles.stageApproved}`}>
            <span className={styles.badgeDotApproved} />
            ✓ Approved
          </span>
          {showSubtitle && <span className={styles.badgeHint}>Ready for Admin to Publish</span>}
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
