import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchArticleStats } from '../../api/knowledgeApi';
import type { ArticleStats } from '../../types/article';
import styles from './KnowledgeStatistics.module.css';

export default function KnowledgeStatistics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = () => {
    setLoading(true);
    setError(null);
    fetchArticleStats()
      .then((res) => setStats(res.data.data))
      .catch(() => setError('Failed to retrieve knowledge base statistics. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader
          title="Knowledge Base Statistics"
          description="Analytics, lifecycle health, and reader sentiment across articles"
          backTo="/admin/knowledge"
        />
        <div className={styles.loadingContainer}>
          <div className={styles.skeletonBar} />
          <div className={styles.skeletonBar} style={{ height: '300px' }} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.page}>
        <PageHeader
          title="Knowledge Base Statistics"
          description="Analytics, lifecycle health, and reader sentiment across articles"
          backTo="/admin/knowledge"
        />
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>⚠️</div>
          <h3>Unable to Load Statistics</h3>
          <p>{error || 'An unexpected error occurred while fetching analytics.'}</p>
          <button onClick={loadStats} className={styles.btnPrimary} style={{ marginTop: '12px' }}>
            🔄 Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const total = Number(stats.total) || 0;
  const publishedCount = Number(stats.published) || 0;
  const publishRate = total > 0 ? Math.round((publishedCount / total) * 100) : 0;

  const helpful = Number(stats.helpfulYes) || 0;
  const notHelpful = Number(stats.notHelpfulNo) || 0;
  const totalFeedback = helpful + notHelpful;
  const satisfactionRate = totalFeedback > 0 ? Math.round((helpful / totalFeedback) * 100) : 0;

  const inReviewCount = (Number(stats.pending_approval) || 0) + (Number(stats.needs_revision) || 0) + (Number(stats.draft) || 0);

  // Workflow status items
  const activeStatusCards = [
    {
      label: 'Published',
      value: stats.published || 0,
      icon: '🌐',
      color: '#0ea5e9',
      desc: 'Live and accessible to targeted readers',
    },
    {
      label: 'Approved',
      value: stats.approved || 0,
      icon: '✅',
      color: '#10b981',
      desc: 'Reviewed and verified for publication',
    },
    {
      label: 'Pending Approval',
      value: stats.pending_approval || 0,
      icon: '⏳',
      color: '#8b5cf6',
      desc: 'Awaiting managerial editorial sign-off',
    },
    {
      label: 'Needs Revision',
      value: stats.needs_revision || 0,
      icon: '🔄',
      color: '#f59e0b',
      desc: 'Sent back to authors for edits or clarification',
    },
    {
      label: 'Drafts',
      value: stats.draft || 0,
      icon: '📝',
      color: '#64748b',
      desc: 'In-progress compositions being authored',
    },
  ];

  const archivedStatusCards = [
    {
      label: 'Unpublished',
      value: stats.unpublished || 0,
      icon: '⏸️',
      color: '#f97316',
      desc: 'Temporarily deactivated from public view',
    },
    {
      label: 'Rejected',
      value: stats.rejected || 0,
      icon: '❌',
      color: '#dc2626',
      desc: 'Declined during review due to policy/content',
    },
    {
      label: 'Archived',
      value: stats.archived || 0,
      icon: '📦',
      color: '#6b7280',
      desc: 'Retired or obsolete articles preserved for record',
    },
    {
      label: 'Restored',
      value: stats.restored || 0,
      icon: '♻️',
      color: '#84cc16',
      desc: 'Re-activated articles from previous archives',
    },
  ];

  // Pipeline percentages
  const pipelineSegments = [
    { label: 'Published', count: stats.published || 0, color: '#0ea5e9' },
    { label: 'Approved', count: stats.approved || 0, color: '#10b981' },
    { label: 'Pending Review', count: stats.pending_approval || 0, color: '#8b5cf6' },
    { label: 'Needs Revision', count: stats.needs_revision || 0, color: '#f59e0b' },
    { label: 'Drafts', count: stats.draft || 0, color: '#94a3b8' },
    {
      label: 'Archived / Other',
      count:
        (stats.archived || 0) +
        (stats.rejected || 0) +
        (stats.unpublished || 0) +
        (stats.restored || 0),
      color: '#cbd5e1',
    },
  ].filter((s) => s.count > 0);

  // Departments sorted by count
  const sortedDepartments = [...(stats.byDepartment || [])].sort((a, b) => b.count - a.count);
  const maxDeptCount = sortedDepartments.length > 0 ? Math.max(...sortedDepartments.map((d) => d.count), 1) : 1;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge Base Statistics"
        description="Comprehensive overview of article lifecycle, editorial pipeline, and reader satisfaction"
        backTo="/admin/knowledge"
      />

      {/* Quick Action Navigation Bar */}
      <div className={styles.actionBar}>
        <button
          type="button"
          onClick={() => navigate('/admin/knowledge')}
          className={styles.btnSecondary}
        >
          📚 Article Directory
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/knowledge/create')}
          className={styles.btnPrimary}
        >
          ✏️ Author New Article
        </button>
        <button
          type="button"
          onClick={loadStats}
          className={styles.btnSecondary}
          title="Refresh Statistics"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Top Level Executive KPI Highlights */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Articles</span>
            <div className={styles.kpiIconWrapper} style={{ color: '#2563eb' }}>
              📚
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{total}</span>
            <span className={`${styles.kpiBadge} ${styles.badgeInfo}`}>All Records</span>
          </div>
          <div className={styles.kpiFooter}>
            Cumulative articles across all workflow stages
          </div>
          <div className={styles.kpiProgressBar}>
            <div
              className={styles.kpiProgressFill}
              style={{ width: '100%', background: '#2563eb' }}
            />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Live / Published</span>
            <div className={styles.kpiIconWrapper} style={{ color: '#0ea5e9' }}>
              🌐
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{publishedCount}</span>
            <span className={`${styles.kpiBadge} ${styles.badgeSuccess}`}>
              {publishRate}% Live
            </span>
          </div>
          <div className={styles.kpiFooter}>
            Articles currently active and readable by users
          </div>
          <div className={styles.kpiProgressBar}>
            <div
              className={styles.kpiProgressFill}
              style={{ width: `${publishRate}%`, background: '#0ea5e9' }}
            />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Satisfaction Rate</span>
            <div className={styles.kpiIconWrapper} style={{ color: '#10b981' }}>
              ⭐
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {totalFeedback > 0 ? `${satisfactionRate}%` : 'N/A'}
            </span>
            <span
              className={`${styles.kpiBadge} ${
                satisfactionRate >= 75
                  ? styles.badgeSuccess
                  : satisfactionRate >= 50
                  ? styles.badgeWarning
                  : styles.badgeInfo
              }`}
            >
              {totalFeedback > 0 ? `${helpful} 👍 / ${notHelpful} 👎` : 'No votes yet'}
            </span>
          </div>
          <div className={styles.kpiFooter}>
            {totalFeedback > 0
              ? `Based on ${totalFeedback} reader rating responses`
              : 'Ratings will appear once readers submit feedback'}
          </div>
          <div className={styles.kpiProgressBar}>
            <div
              className={styles.kpiProgressFill}
              style={{
                width: `${totalFeedback > 0 ? satisfactionRate : 0}%`,
                background: '#10b981',
              }}
            />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>In Editorial Pipeline</span>
            <div className={styles.kpiIconWrapper} style={{ color: '#f59e0b' }}>
              ⚙️
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{inReviewCount}</span>
            <span
              className={`${styles.kpiBadge} ${
                inReviewCount > 0 ? styles.badgeWarning : styles.badgeSuccess
              }`}
            >
              {inReviewCount > 0 ? 'Requires Action' : 'Clear Queue'}
            </span>
          </div>
          <div className={styles.kpiFooter}>
            Drafts ({stats.draft}), Pending ({stats.pending_approval}), Revisions ({stats.needs_revision})
          </div>
          <div className={styles.kpiProgressBar}>
            <div
              className={styles.kpiProgressFill}
              style={{
                width: `${total > 0 ? Math.round((inReviewCount / total) * 100) : 0}%`,
                background: '#f59e0b',
              }}
            />
          </div>
        </div>
      </div>

      {/* Visual Workflow Pipeline Distribution */}
      {total > 0 && (
        <div className={styles.pipelineSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTitleGroup}>
              <h2 className={styles.sectionTitle}>Editorial Lifecycle Distribution</h2>
              <p className={styles.sectionSubtitle}>
                Proportional breakdown of all {total} articles by current lifecycle stage
              </p>
            </div>
          </div>

          <div className={styles.pipelineBar}>
            {pipelineSegments.map((segment) => {
              const segPct = Math.max(1, Math.round((segment.count / total) * 100));
              return (
                <div
                  key={segment.label}
                  className={styles.pipelineSegment}
                  style={{
                    width: `${segPct}%`,
                    backgroundColor: segment.color,
                  }}
                  title={`${segment.label}: ${segment.count} (${segPct}%)`}
                />
              );
            })}
          </div>

          <div className={styles.pipelineLegend}>
            {pipelineSegments.map((segment) => {
              const pct = Math.round((segment.count / total) * 100);
              return (
                <div key={segment.label} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}:</span>
                  <span className={styles.legendCount}>
                    {segment.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Pipeline Status Cards */}
      <h3 className={styles.statusCategoryTitle}>Active & Workflow Stages</h3>
      <div className={styles.statusGrid}>
        {activeStatusCards.map((card) => {
          const pct = total > 0 ? Math.round((card.value / total) * 100) : 0;
          return (
            <div
              key={card.label}
              className={styles.statusCard}
              style={{ '--card-color': card.color } as React.CSSProperties}
            >
              <div>
                <div className={styles.statusCardHeader}>
                  <span className={styles.statusCardIcon}>{card.icon}</span>
                  <span className={styles.statusCardPercent}>{pct}% of total</span>
                </div>
                <div className={styles.statusCardValue}>{card.value}</div>
                <div className={styles.statusCardLabel}>{card.label}</div>
              </div>
              <div className={styles.statusCardDesc}>{card.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Inactive & Archived Status Cards */}
      <h3 className={styles.statusCategoryTitle}>Historical & Inactive Stages</h3>
      <div className={styles.statusGrid}>
        {archivedStatusCards.map((card) => {
          const pct = total > 0 ? Math.round((card.value / total) * 100) : 0;
          return (
            <div
              key={card.label}
              className={styles.statusCard}
              style={{ '--card-color': card.color } as React.CSSProperties}
            >
              <div>
                <div className={styles.statusCardHeader}>
                  <span className={styles.statusCardIcon}>{card.icon}</span>
                  <span className={styles.statusCardPercent}>{pct}% of total</span>
                </div>
                <div className={styles.statusCardValue}>{card.value}</div>
                <div className={styles.statusCardLabel}>{card.label}</div>
              </div>
              <div className={styles.statusCardDesc}>{card.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Dual Split Panels: Reader Sentiment & Department Breakdown */}
      <div className={styles.dualGrid}>
        {/* Panel 1: Reader Sentiment & Feedback */}
        <div className={styles.panelCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTitleGroup}>
              <h2 className={styles.sectionTitle}>Reader Feedback & Sentiment</h2>
              <p className={styles.sectionSubtitle}>
                Audience ratings and utility evaluation for published articles
              </p>
            </div>
          </div>

          <div className={styles.feedbackScoreWidget}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreNumber}>{satisfactionRate}</span>
              <span className={styles.scoreSymbol}>% Score</span>
            </div>
            <div className={styles.scoreInfo}>
              <div className={styles.scoreTitle}>
                {satisfactionRate >= 80
                  ? 'Highly Effective Knowledge'
                  : satisfactionRate >= 60
                  ? 'Positive Reader Utility'
                  : totalFeedback === 0
                  ? 'Awaiting Reader Feedback'
                  : 'Requires Content Optimization'}
              </div>
              <div className={styles.scoreDesc}>
                {totalFeedback > 0
                  ? `${helpful} out of ${totalFeedback} readers confirmed these articles directly resolved their inquiries.`
                  : 'Encourage users to rate articles to identify helpful solutions and areas needing revision.'}
              </div>
            </div>
          </div>

          {totalFeedback > 0 && (
            <div className={styles.sentimentBarContainer}>
              <div className={styles.sentimentLabels}>
                <span className={styles.helpfulText}>
                  👍 Helpful ({satisfactionRate}%)
                </span>
                <span className={styles.notHelpfulText}>
                  👎 Not Helpful ({100 - satisfactionRate}%)
                </span>
              </div>
              <div className={styles.sentimentBar}>
                <div
                  className={styles.sentimentHelpfulFill}
                  style={{ width: `${satisfactionRate}%` }}
                />
                <div
                  className={styles.sentimentNotHelpfulFill}
                  style={{ width: `${100 - satisfactionRate}%` }}
                />
              </div>
            </div>
          )}

          <div className={styles.feedbackTiles}>
            <div className={`${styles.feedbackTile} ${styles.feedbackTileHelpful}`}>
              <div className={styles.feedbackTileHeader}>
                <span className={styles.feedbackTileTitle}>Helpful Votes</span>
                <span>👍</span>
              </div>
              <div className={styles.feedbackTileValue}>{helpful}</div>
              <div className={styles.feedbackTileSub}>Direct positive evaluations</div>
            </div>

            <div className={`${styles.feedbackTile} ${styles.feedbackTileNotHelpful}`}>
              <div className={styles.feedbackTileHeader}>
                <span className={styles.feedbackTileTitle}>Not Helpful Votes</span>
                <span>👎</span>
              </div>
              <div className={styles.feedbackTileValue}>{notHelpful}</div>
              <div className={styles.feedbackTileSub}>Marked as needing improvement</div>
            </div>
          </div>
        </div>

        {/* Panel 2: Departmental Distribution */}
        <div className={styles.panelCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTitleGroup}>
              <h2 className={styles.sectionTitle}>Articles by Department</h2>
              <p className={styles.sectionSubtitle}>
                Volume and ownership distribution across organizational departments
              </p>
            </div>
          </div>

          {sortedDepartments.length > 0 ? (
            <div className={styles.deptList}>
              {sortedDepartments.map((dept, index) => {
                const deptCount = Number(dept.count) || 0;
                const pctOfTotal = total > 0 ? Math.round((deptCount / total) * 100) : 0;
                const barWidth = Math.round((deptCount / maxDeptCount) * 100);

                return (
                  <div key={dept.name || 'unassigned'} className={styles.deptItem}>
                    <div className={styles.deptItemTop}>
                      <div className={styles.deptItemLeft}>
                        <span
                          className={`${styles.deptRank} ${
                            index < 3 ? styles.deptRankTop : ''
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <span className={styles.deptName}>
                          {dept.name || 'General / Unassigned'}
                        </span>
                      </div>
                      <div className={styles.deptItemRight}>
                        <span className={styles.deptCount}>{deptCount}</span>
                        <span className={styles.deptUnit}>
                          ({pctOfTotal}% of total)
                        </span>
                      </div>
                    </div>
                    <div className={styles.deptBar}>
                      <div
                        className={styles.deptBarFill}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🏢</div>
              <p>No departmental articles recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
