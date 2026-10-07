import React from 'react';
import { parseRevisionThread } from '../../../utils/revisionUtils';
import styles from './RevisionThreadCard.module.css';

interface RevisionThreadCardProps {
  revisionNotes?: string | null;
  className?: string;
}

export const RevisionThreadCard: React.FC<RevisionThreadCardProps> = ({
  revisionNotes,
  className,
}) => {
  const items = parseRevisionThread(revisionNotes);

  if (!items || items.length === 0) return null;

  const getStepIconAndClasses = (step: string, role: string) => {
    switch (step) {
      case 'admin_revision':
        return {
          icon: '⚠️',
          markerClass: styles.markerAdmin,
          roleClass: styles.roleAdmin,
          badgeLabel: 'Admin Revision Request',
        };
      case 'manager_revision':
        return {
          icon: '🏢',
          markerClass: styles.markerManager,
          roleClass: styles.roleManager,
          badgeLabel: 'Manager Review & Directive',
        };
      case 'author_resubmit':
        return {
          icon: '✏️',
          markerClass: styles.markerAuthor,
          roleClass: styles.roleAuthor,
          badgeLabel: 'Author Updated Version',
        };
      case 'manager_approve':
        return {
          icon: '✓',
          markerClass: styles.markerApprove,
          roleClass: styles.roleManager,
          badgeLabel: 'Manager Dept Sign-off',
        };
      case 'admin_approve':
        return {
          icon: '🛡️',
          markerClass: styles.markerApprove,
          roleClass: styles.roleAdmin,
          badgeLabel: 'Admin Verified & Approved',
        };
      default:
        return {
          icon: role === 'admin' ? '⚠️' : '💬',
          markerClass: role === 'admin' ? styles.markerAdmin : styles.markerManager,
          roleClass: role === 'admin' ? styles.roleAdmin : styles.roleManager,
          badgeLabel: 'Revision Note',
        };
    }
  };

  return (
    <div className={`${styles.threadCard} ${className || ''}`}>
      <div className={styles.threadHeader}>
        <div className={styles.threadTitleGroup}>
          <span className={styles.threadIcon}>📋</span>
          <span className={styles.threadTitle}>Multi-Tier Revision & Feedback Trail</span>
          <span className={styles.threadCountBadge}>
            {items.length} {items.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      <div className={styles.timeline}>
        {items.map((item, idx) => {
          const meta = getStepIconAndClasses(item.step, item.role);
          const dateStr = item.createdAt
            ? new Date(item.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div key={item.id || idx} className={styles.timelineItem}>
              <div className={`${styles.timelineMarker} ${meta.markerClass}`}>
                {meta.icon}
              </div>

              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={`${styles.itemRoleBadge} ${meta.roleClass}`}>
                    {meta.badgeLabel}
                  </span>
                  <div className={styles.itemMeta}>
                    <span className={styles.authorName}>{item.authorName}</span>
                    {item.version && (
                      <span className={styles.itemVersion}>v{item.version}</span>
                    )}
                    {dateStr && <span>• {dateStr}</span>}
                  </div>
                </div>

                <p className={styles.itemComment}>{item.comment}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevisionThreadCard;
