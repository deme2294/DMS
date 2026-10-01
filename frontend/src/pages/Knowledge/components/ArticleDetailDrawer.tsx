import React from 'react';
import type { Article } from '../../../types/article';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';
import styles from '../KnowledgeMyArticles.module.css';

interface ArticleDetailDrawerProps {
  article: Article | null;
  open: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onRequestAction: (article: Article, action: 'request_revision' | 'reject' | 'publish' | 'unpublish' | 'submit') => void;
  onApproveDirect: (articleId: string) => void;
  onOpenRevise: (article: Article) => void;
}

export const ArticleDetailDrawer: React.FC<ArticleDetailDrawerProps> = ({
  article,
  open,
  currentUserRole,
  currentUserId,
  onClose,
  onRequestAction,
  onApproveDirect,
  onOpenRevise,
}) => {
  if (!open || !article) return null;

  const isAdmin = currentUserRole === 'admin';
  const isStaff = currentUserRole === 'staff';
  const isAuthor = article.authorId === currentUserId;
  const isManager = currentUserRole === 'manager';

  // Staff can NEVER approve, review, reject, or publish - this is strictly the duty of Admin & Manager
  const canApproveOrReview = (isAdmin || (isManager && !isAuthor)) && !isStaff;
  const canPublish = isAdmin;

  // Determine active step in the 4-stage lifecycle pipeline
  const getStepStatus = () => {
    switch (article.status) {
      case 'draft':
        return { step: 1, label: 'Stage 1 of 4: Draft Created' };
      case 'pending_approval':
        return { step: 2, label: 'Stage 2 of 4: Under Review by Admin/Manager' };
      case 'needs_revision':
        return { step: 2, label: 'Stage 2 (Revision Requested): Awaiting Author Updates' };
      case 'approved':
        return { step: 3, label: 'Stage 3 of 4: Approved by Department Manager — Ready for Admin Publication' };
      case 'published':
        return { step: 4, label: 'Stage 4 of 4: Published Live on Help Desk' };
      case 'rejected':
        return { step: 2, label: 'Submission Rejected' };
      default:
        return { step: 1, label: 'Stage 1: Draft' };
    }
  };

  const currentStage = getStepStatus();

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawerContainer} onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerPreHeader}>
              <span className={styles.drawerRef}>{article.articleReference}</span>
              <span className={styles.drawerCategory}>{article.category}</span>
              {article.departmentName && (
                <span className={styles.drawerDept}>🏢 {article.departmentName}</span>
              )}
            </div>
            <h2 className={styles.drawerTitle}>{article.title}</h2>
          </div>
          <button className={styles.drawerCloseBtn} onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* ── Lifecycle Pipeline Tracker (Where It Reached) ── */}
        <div className={styles.drawerStepperWrap}>
          <div className={styles.drawerStepperHeader}>
            <span className={styles.drawerStepperTitle}>Article Lifecycle Pipeline</span>
            <span className={styles.drawerStepperCurrent}>{currentStage.label}</span>
          </div>

          <div className={styles.drawerStepperBar}>
            {/* Step 1: Draft */}
            <div className={styles.drawerStepItem}>
              <div
                className={`${styles.drawerStepCircle} ${
                  currentStage.step >= 1 ? (currentStage.step > 1 ? styles.drawerStepCircleCompleted : styles.drawerStepCircleActive) : ''
                }`}
              >
                {currentStage.step > 1 ? '✓' : '1'}
              </div>
              <span className={styles.drawerStepText}>1. Draft</span>
            </div>

            <div className={`${styles.drawerStepConnector} ${currentStage.step > 1 ? styles.drawerStepConnectorCompleted : ''}`} />

            {/* Step 2: Under Review */}
            <div className={styles.drawerStepItem}>
              <div
                className={`${styles.drawerStepCircle} ${
                  article.status === 'needs_revision'
                    ? styles.stepperMiniDotRevision
                    : currentStage.step >= 2
                    ? currentStage.step > 2
                      ? styles.drawerStepCircleCompleted
                      : styles.drawerStepCircleActive
                    : ''
                }`}
              >
                {article.status === 'needs_revision' ? '⚠️' : currentStage.step > 2 ? '✓' : '2'}
              </div>
              <span className={styles.drawerStepText}>2. Review</span>
            </div>

            <div className={`${styles.drawerStepConnector} ${currentStage.step > 2 ? styles.drawerStepConnectorCompleted : ''}`} />

            {/* Step 3: Approved */}
            <div className={styles.drawerStepItem}>
              <div
                className={`${styles.drawerStepCircle} ${
                  currentStage.step >= 3 ? (currentStage.step > 3 ? styles.drawerStepCircleCompleted : styles.drawerStepCircleActive) : ''
                }`}
              >
                {currentStage.step > 3 ? '✓' : '3'}
              </div>
              <span className={styles.drawerStepText}>3. Approved</span>
            </div>

            <div className={`${styles.drawerStepConnector} ${currentStage.step > 3 ? styles.drawerStepConnectorCompleted : ''}`} />

            {/* Step 4: Published Live */}
            <div className={styles.drawerStepItem}>
              <div
                className={`${styles.drawerStepCircle} ${
                  currentStage.step >= 4 ? styles.drawerStepCircleActive : ''
                }`}
              >
                {currentStage.step >= 4 ? '🌐' : '4'}
              </div>
              <span className={styles.drawerStepText}>4. Published</span>
            </div>
          </div>
        </div>

        {/* Workflow Status & Meta Row */}
        <div className={styles.drawerMetaSection}>
          <div className={styles.drawerStatusBlock}>
            <span className={styles.drawerMetaLabel}>Current Gate:</span>
            <WorkflowStatusBadge status={article.status} showSubtitle />
          </div>

          <div className={styles.drawerMetaGrid}>
            <div className={styles.drawerMetaItem}>
              <span className={styles.drawerMetaLabel}>Author</span>
              <span className={styles.drawerMetaValue}>
                {article.authorFirstName || article.authorLastName
                  ? `${article.authorFirstName || ''} ${article.authorLastName || ''}`.trim()
                  : 'Staff Contributor'}
              </span>
            </div>
            <div className={styles.drawerMetaItem}>
              <span className={styles.drawerMetaLabel}>Created Date</span>
              <span className={styles.drawerMetaValue}>
                {article.createdAt ? new Date(article.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className={styles.drawerMetaItem}>
              <span className={styles.drawerMetaLabel}>Reader Feedback</span>
              <span className={styles.drawerMetaValue}>
                👍 {article.helpfulCount || 0} · 👎 {article.notHelpfulCount || 0}
              </span>
            </div>
            <div className={styles.drawerMetaItem}>
              <span className={styles.drawerMetaLabel}>Live Views</span>
              <span className={styles.drawerMetaValue}>
                👁️ {article.viewCount || 0} views
              </span>
            </div>
          </div>
        </div>

        {/* Staff Duty Notice: Clearly explaining that approval and publication belong to Admin */}
        {isStaff && (
          <div className={styles.staffDutyNotice}>
            <span>ℹ️</span>
            <div>
              <strong>Staff Tracking Mode:</strong> You can follow the lifecycle progress and feedback of your articles here. Article review, approval, and live portal publishing are the exclusive responsibility of Department Managers and System Administrators.
            </div>
          </div>
        )}

        {/* Approval Verification Banner */}
        {article.approvedAt && (
          <div className={`${styles.drawerAlertBox} ${styles.approvedByChip}`}>
            <span style={{ fontSize: '1.1rem' }}>✓</span>
            <div>
              <strong>Verification Milestone:</strong> Approved by{' '}
              {article.approvedFirstName || 'Department Manager'} {article.approvedLastName || ''} on{' '}
              {new Date(article.approvedAt).toLocaleDateString()}.{' '}
              {article.status === 'approved' && 'Queued for live publication by Central Administration.'}
            </div>
          </div>
        )}

        {/* Published Banner */}
        {article.publishedAt && (
          <div className={`${styles.drawerAlertBox} ${styles.approvedByChip}`} style={{ background: 'rgba(14, 165, 233, 0.1)', borderColor: 'rgba(14, 165, 233, 0.3)', color: '#0369a1' }}>
            <span style={{ fontSize: '1.1rem' }}>🌐</span>
            <div>
              <strong>Live on Portal:</strong> Published live on{' '}
              {new Date(article.publishedAt).toLocaleDateString()}. Accessible to all tenants and staff.
            </div>
          </div>
        )}

        {/* Revision Feedback Banner (if in needs_revision) */}
        {article.status === 'needs_revision' && article.revisionNotes && (
          <div className={styles.drawerAlertBox}>
            <div className={styles.drawerAlertTitle}>
              <span>⚠️</span>
              <strong>Admin Revision Notice & Required Changes</strong>
            </div>
            <p className={styles.drawerAlertText}>{article.revisionNotes}</p>
          </div>
        )}

        {/* Rejection Banner */}
        {article.status === 'rejected' && article.rejectionReason && (
          <div className={`${styles.drawerAlertBox} ${styles.drawerAlertDanger}`}>
            <div className={styles.drawerAlertTitle}>
              <span>✕</span>
              <strong>Article Rejection Reason</strong>
            </div>
            <p className={styles.drawerAlertText}>{article.rejectionReason}</p>
          </div>
        )}

        {/* Article Body Content */}
        <div className={styles.drawerBody}>
          {article.summary && (
            <div className={styles.drawerSummaryBox}>
              <span className={styles.drawerSummaryLabel}>Abstract / Summary:</span>
              <p>{article.summary}</p>
            </div>
          )}

          <div className={styles.drawerContentLabel}>Full Article Content:</div>
          <div className={styles.drawerContentText}>{article.content}</div>
        </div>

        {/* Bottom Interactive Workflow Actions Bar */}
        <div className={styles.drawerFooter}>
          <div className={styles.drawerFooterLeft}>
            {/* If author and needs revision/draft, allow quick revise */}
            {isAuthor && ['draft', 'needs_revision'].includes(article.status) && (
              <button
                type="button"
                className={styles.primaryReviseBtn}
                onClick={() => {
                  onClose();
                  onOpenRevise(article);
                }}
              >
                ✏️ Edit & Revise
              </button>
            )}

            {isAuthor && ['draft', 'needs_revision'].includes(article.status) && (
              <button
                type="button"
                className={styles.submitModalBtn}
                onClick={() => onRequestAction(article, 'submit')}
              >
                📤 Submit for Review
              </button>
            )}
          </div>

          <div className={styles.drawerFooterRight}>
            {/* Admin or Reviewer Verification Controls (NEVER visible to staff) */}
            {canApproveOrReview && article.status === 'pending_approval' && (
              <>
                <button
                  type="button"
                  className={styles.revisionSubmitBtn}
                  onClick={() => onRequestAction(article, 'request_revision')}
                >
                  ⚠️ Request Revision
                </button>
                <button
                  type="button"
                  className={styles.approveSubmitBtn}
                  onClick={() => onApproveDirect(article.id)}
                >
                  ✓ Approve Article
                </button>
                <button
                  type="button"
                  className={styles.dangerSubmitBtn}
                  onClick={() => onRequestAction(article, 'reject')}
                >
                  ✕ Reject
                </button>
              </>
            )}

            {/* Admin Publishing Control (NEVER visible to staff) */}
            {canPublish && article.status === 'approved' && (
              <button
                type="button"
                className={styles.publishSubmitBtn}
                onClick={() => onRequestAction(article, 'publish')}
              >
                🌐 Publish Live
              </button>
            )}

            {/* Admin Unpublishing Control */}
            {canPublish && article.status === 'published' && (
              <button
                type="button"
                className={styles.unpublishSubmitBtn}
                onClick={() => onRequestAction(article, 'unpublish')}
              >
                ⏸ Unpublish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
