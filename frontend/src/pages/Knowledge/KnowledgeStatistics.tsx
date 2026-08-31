import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { fetchArticleStats } from '../../api/knowledgeApi';
import type { ArticleStats } from '../../types/article';
import styles from './KnowledgeStatistics.module.css';

export default function KnowledgeStatistics() {
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchArticleStats()
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.page}>Loading...</div>;
  if (!stats) return <div className={styles.page}>Failed to load statistics</div>;

  const statCards = [
    { label: 'Total Articles', value: stats.total, color: '#3b82f6' },
    { label: 'Drafts', value: stats.draft, color: '#f59e0b' },
    { label: 'Pending Approval', value: stats.pending_approval, color: '#8b5cf6' },
    { label: 'Needs Revision', value: stats.needs_revision, color: '#ef4444' },
    { label: 'Approved', value: stats.approved, color: '#10b981' },
    { label: 'Published', value: stats.published, color: '#06b6d4' },
    { label: 'Unpublished', value: stats.unpublished, color: '#f97316' },
    { label: 'Rejected', value: stats.rejected, color: '#dc2626' },
    { label: 'Archived', value: stats.archived, color: '#6b7280' },
    { label: 'Restored', value: stats.restored, color: '#84cc16' },
  ];

  return (
    <div className={styles.page}>
      <PageHeader title="Knowledge Base Statistics" description="Overview of knowledge base articles" backTo="/admin/knowledge" />

      <div className={styles.grid}>
        {statCards.map((card) => (
          <div key={card.label} className={styles.card} style={{ borderTopColor: card.color }}>
            <div className={styles.cardValue}>{card.value}</div>
            <div className={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <h3>Feedback Summary</h3>
        <div className={styles.feedbackGrid}>
          <div className={styles.card}>
            <div className={styles.cardValue}>{stats.helpfulYes || 0}</div>
            <div className={styles.cardLabel}>Helpful</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{stats.notHelpfulNo || 0}</div>
            <div className={styles.cardLabel}>Not Helpful</div>
          </div>
        </div>
      </div>

      {stats.byDepartment?.length > 0 && (
        <div className={styles.section}>
          <h3>Articles by Department</h3>
          <div className={styles.deptList}>
            {stats.byDepartment.map((dept) => (
              <div key={dept.name} className={styles.deptItem}>
                <span className={styles.deptName}>{dept.name || 'Unassigned'}</span>
                <span className={styles.deptCount}>{dept.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
