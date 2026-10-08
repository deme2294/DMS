import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchArticleStats,
  requestRevision,
  approveArticle,
  rejectArticle,
  publishArticle,
  unpublishArticle,
  submitArticle,
} from '../../api/knowledgeApi';
import type { Article, ArticleStats } from '../../types/article';
import { ArticleDetailDrawer } from './components/ArticleDetailDrawer';
import { WorkflowActionModal, type WorkflowActionType } from './components/WorkflowActionModal';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import styles from './KnowledgeStatistics.module.css';

export default function KnowledgeStatistics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader Feedback & Utility interactive state
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'helpful' | 'not_helpful'>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<WorkflowActionType | null>(null);
  const [actionTargetArticle, setActionTargetArticle] = useState<Article | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

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

  const ratedArticles: Article[] = useMemo(() => stats?.ratedArticles || [], [stats]);
  const helpfulArticles = useMemo(
    () => ratedArticles.filter((a) => (Number(a.helpfulCount) || 0) > 0),
    [ratedArticles]
  );
  const notHelpfulArticles = useMemo(
    () => ratedArticles.filter((a) => (Number(a.notHelpfulCount) || 0) > 0),
    [ratedArticles]
  );

  const filteredArticles = useMemo(() => {
    return ratedArticles.filter((a) => {
      if (feedbackFilter === 'helpful' && (Number(a.helpfulCount) || 0) <= 0) return false;
      if (feedbackFilter === 'not_helpful' && (Number(a.notHelpfulCount) || 0) <= 0) return false;

      if (feedbackSearch.trim()) {
        const q = feedbackSearch.toLowerCase();
        const matchTitle = (a.title || '').toLowerCase().includes(q);
        const matchRef = (a.articleReference || '').toLowerCase().includes(q);
        const matchCat = (a.category || '').toLowerCase().includes(q);
        const matchDept = (a.departmentName || '').toLowerCase().includes(q);
        const matchAuthor = `${a.authorFirstName || ''} ${a.authorLastName || ''}`.toLowerCase().includes(q);
        if (!matchTitle && !matchRef && !matchCat && !matchDept && !matchAuthor) return false;
      }
      return true;
    });
  }, [ratedArticles, feedbackFilter, feedbackSearch]);

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

  const handleWorkflowSubmit = async (
    articleId: string,
    type: WorkflowActionType,
    reason?: string,
    options?: { routeTo?: 'manager' | 'author' }
  ) => {
    setActionBusy(true);
    try {
      switch (type) {
        case 'request_revision':
          await requestRevision(articleId, reason || '', options);
          setActionMessage(
            options?.routeTo === 'manager'
              ? 'Revision directive routed to Department Manager.'
              : 'Revision directive sent to Author. Article moved to Needs Revision.'
          );
          break;
        case 'reject':
          await rejectArticle(articleId, reason || '');
          setActionMessage('Article marked as rejected.');
          break;
        case 'publish':
          await publishArticle(articleId);
          setActionMessage('Article published live to portal!');
          break;
        case 'unpublish':
          await unpublishArticle(articleId, reason);
          setActionMessage('Article unpublished.');
          break;
        case 'submit':
          await submitArticle(articleId, reason ? { notes: reason } : undefined);
          setActionMessage('Article resubmitted for review.');
          break;
      }
      setWorkflowModalOpen(false);
      setActionTargetArticle(null);
      setDrawerOpen(false);
      loadStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Workflow action failed';
      alert(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const handleApproveDirect = async (articleId: string) => {
    setActionBusy(true);
    try {
      await approveArticle(articleId);
      setActionMessage('Article approved successfully.');
      setDrawerOpen(false);
      loadStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Approval failed';
      alert(msg);
    } finally {
      setActionBusy(false);
    }
  };

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

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Tenant Reads & Reach</span>
            <div className={styles.kpiIconWrapper} style={{ color: '#06b6d4' }}>
              👥
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{stats.tenantViews ?? 0}</span>
            <span className={`${styles.kpiBadge} ${styles.badgeInfo}`}>
              {stats.totalViews ?? 0} Total Views
            </span>
          </div>
          <div className={styles.kpiFooter}>
            {stats.staffViews ?? 0} internal staff reads across articles
          </div>
          <div className={styles.kpiProgressBar}>
            <div
              className={styles.kpiProgressFill}
              style={{
                width: `${(stats.totalViews ?? 0) > 0 ? Math.round(((stats.tenantViews ?? 0) / (stats.totalViews ?? 1)) * 100) : 0}%`,
                background: '#06b6d4',
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

      {actionMessage && (
        <div className={styles.toastNotification}>
          <span>✓ {actionMessage}</span>
          <button
            type="button"
            className={styles.toastCloseBtn}
            onClick={() => setActionMessage(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dual Split Panels: Reader Sentiment & Department Breakdown */}
      <div className={`${styles.dualGrid} ${isPanelExpanded ? styles.dualGridExpanded : ''}`}>
        {/* Panel 1: Reader Sentiment & Feedback */}
        <div className={`${styles.panelCard} ${isPanelExpanded ? styles.panelCardExpanded : ''}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTitleGroup}>
              <h2 className={styles.sectionTitle}>Reader Feedback & Sentiment</h2>
              <p className={styles.sectionSubtitle}>
                Audience ratings and utility evaluation for published articles
              </p>
            </div>
            <button
              type="button"
              className={styles.expandToggleBtn}
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              title={isPanelExpanded ? 'Switch to side-by-side view' : 'Expand feedback panel to full width'}
            >
              {isPanelExpanded ? '⬌ Split View' : '⛶ Full Width View'}
            </button>
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

          {/* Interactive Feedback Tiles */}
          <div className={styles.feedbackTiles}>
            <button
              type="button"
              className={`${styles.feedbackTile} ${styles.feedbackTileHelpful} ${
                feedbackFilter === 'helpful' ? styles.feedbackTileActiveHelpful : ''
              }`}
              onClick={() => setFeedbackFilter(feedbackFilter === 'helpful' ? 'all' : 'helpful')}
              title="Click to filter and view helpful articles"
            >
              <div className={styles.feedbackTileHeader}>
                <span className={styles.feedbackTileTitle}>Helpful Votes</span>
                <span>👍</span>
              </div>
              <div className={styles.feedbackTileValue}>{helpful}</div>
              <div className={styles.feedbackTileSub}>Direct positive evaluations</div>
              <div className={styles.feedbackTileHint}>
                {feedbackFilter === 'helpful'
                  ? '✓ Active Filter (Click to show all)'
                  : 'Click to inspect helpful articles →'}
              </div>
            </button>

            <button
              type="button"
              className={`${styles.feedbackTile} ${styles.feedbackTileNotHelpful} ${
                feedbackFilter === 'not_helpful' ? styles.feedbackTileActiveNotHelpful : ''
              }`}
              onClick={() => setFeedbackFilter(feedbackFilter === 'not_helpful' ? 'all' : 'not_helpful')}
              title="Click to filter and view articles needing improvement"
            >
              <div className={styles.feedbackTileHeader}>
                <span className={styles.feedbackTileTitle}>Not Helpful Votes</span>
                <span>👎</span>
              </div>
              <div className={styles.feedbackTileValue}>{notHelpful}</div>
              <div className={styles.feedbackTileSub}>Marked as needing improvement</div>
              <div className={styles.feedbackTileHint}>
                {feedbackFilter === 'not_helpful'
                  ? '✓ Active Filter (Click to show all)'
                  : 'Click to inspect articles needing revision →'}
              </div>
            </button>
          </div>

          {/* Detailed Feedback-Rated Articles Section */}
          <div className={styles.feedbackArticlesSection}>
            <div className={styles.feedbackArticlesHeader}>
              <div className={styles.feedbackArticlesTitleGroup}>
                <h3 className={styles.feedbackArticlesTitle}>
                  <span>Evaluated Articles & Reader Feedback</span>
                  <span className={styles.feedbackArticlesCountBadge}>
                    {filteredArticles.length} of {ratedArticles.length} Rated
                  </span>
                </h3>
                <p className={styles.feedbackArticlesSubtitle}>
                  Select any article below to inspect reader evaluations, check content, and address what should be changed.
                </p>
              </div>
            </div>

            {/* Filter Pills & Quick Search */}
            <div className={styles.feedbackFilterBar}>
              <div className={styles.feedbackFilterTabs}>
                <button
                  type="button"
                  className={`${styles.feedbackFilterTab} ${
                    feedbackFilter === 'all' ? styles.feedbackFilterTabActive : ''
                  }`}
                  onClick={() => setFeedbackFilter('all')}
                >
                  🌟 All Rated ({ratedArticles.length})
                </button>
                <button
                  type="button"
                  className={`${styles.feedbackFilterTab} ${
                    feedbackFilter === 'helpful' ? styles.feedbackFilterTabActiveHelpful : ''
                  }`}
                  onClick={() => setFeedbackFilter('helpful')}
                >
                  👍 Helpful ({helpfulArticles.length})
                </button>
                <button
                  type="button"
                  className={`${styles.feedbackFilterTab} ${
                    feedbackFilter === 'not_helpful' ? styles.feedbackFilterTabActiveNotHelpful : ''
                  }`}
                  onClick={() => setFeedbackFilter('not_helpful')}
                >
                  👎 Needs Improvement ({notHelpfulArticles.length})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search rated articles..."
                className={styles.feedbackSearchInput}
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
              />
            </div>

            {/* Articles List */}
            {filteredArticles.length > 0 ? (
              <div className={styles.feedbackArticlesList}>
                {filteredArticles.map((art) => {
                  const artHelpful = Number(art.helpfulCount) || 0;
                  const artNotHelpful = Number(art.notHelpfulCount) || 0;
                  const artTotal = artHelpful + artNotHelpful;
                  const artUtility = artTotal > 0 ? Math.round((artHelpful / artTotal) * 100) : 0;
                  const hasNegative = artNotHelpful > 0;

                  return (
                    <div
                      key={art.id}
                      className={`${styles.feedbackArticleCard} ${
                        hasNegative
                          ? styles.feedbackArticleCardNeedingImprovement
                          : styles.feedbackArticleCardHelpful
                      }`}
                    >
                      {/* Top Chips Row */}
                      <div className={styles.cardTopRow}>
                        <div className={styles.cardTopLeft}>
                          <button
                            type="button"
                            className={styles.refChip}
                            onClick={() => {
                              setSelectedArticle(art);
                              setDrawerOpen(true);
                            }}
                            title="Click to inspect this article"
                          >
                            {art.articleReference || 'KB-ARTICLE'}
                          </button>
                          {art.category && (
                            <span className={styles.catChip}>📁 {art.category}</span>
                          )}
                          {art.departmentName && (
                            <span className={styles.deptChip}>🏢 {art.departmentName}</span>
                          )}
                        </div>
                        <div>
                          <WorkflowStatusBadge status={art.status} />
                        </div>
                      </div>

                      {/* Title & Author */}
                      <div>
                        <h4
                          className={styles.cardTitle}
                          onClick={() => {
                            setSelectedArticle(art);
                            setDrawerOpen(true);
                          }}
                          title="Click to inspect full article details"
                        >
                          {art.title}
                        </h4>
                        <div className={styles.cardMeta}>
                          <span>
                            ✍️ {art.authorFirstName ? `${art.authorFirstName} ${art.authorLastName || ''}` : 'Knowledge Author'}
                            {art.authorRole ? ` (${art.authorRole})` : ''}
                          </span>
                          {art.updatedAt && (
                            <span>🕒 Updated {new Date(art.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Reader Sentiment Metrics Bar */}
                      <div className={styles.cardMetricsRow}>
                        <div className={styles.metricsPills}>
                          <span className={styles.pillHelpful}>
                            👍 {artHelpful} Helpful
                          </span>
                          <span className={styles.pillNotHelpful}>
                            👎 {artNotHelpful} Not Helpful
                          </span>
                          <span className={styles.pillViews}>
                            👁️ {art.viewCount || 0} views
                          </span>
                        </div>
                        <div
                          className={`${styles.pillScore} ${
                            artUtility >= 70 ? styles.pillScoreGood : styles.pillScoreWarning
                          }`}
                        >
                          {artUtility}% Utility Score
                        </div>
                      </div>

                      {/* Diagnostic Status */}
                      {hasNegative ? (
                        <div className={`${styles.diagnosticBanner} ${styles.diagnosticWarning}`}>
                          <span style={{ fontSize: '1.15rem' }}>⚠️</span>
                          <div>
                            <strong>Marked as Needing Improvement ({artNotHelpful} reader vote{artNotHelpful > 1 ? 's' : ''})</strong>
                            <p>
                              Readers reported this article did not solve their inquiry. Inspect the content below to check what instructions, steps, or details need to be updated.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={`${styles.diagnosticBanner} ${styles.diagnosticSuccess}`}>
                          <span style={{ fontSize: '1.15rem' }}>✓</span>
                          <div>
                            <strong>Positive Reader Utility ({artHelpful} reader vote{artHelpful > 1 ? 's' : ''})</strong>
                            <p>
                              Readers confirmed this article directly resolved their inquiry.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Reader Comments (if any logged) */}
                      {art.feedbackEntries && art.feedbackEntries.length > 0 && (
                        <div className={styles.feedbackCommentsWrap}>
                          <span className={styles.feedbackCommentsTitle}>
                            💬 Reader Feedback Log ({art.feedbackEntries.length}):
                          </span>
                          {art.feedbackEntries.map((fb) => (
                            <div key={fb.id} className={styles.commentItem}>
                              <span className={styles.commentAuthor}>
                                {fb.isHelpful ? '👍' : '👎'}{' '}
                                {fb.userFirstName ? `${fb.userFirstName} ${fb.userLastName || ''}` : 'Reader'}
                                {fb.userRole ? ` (${fb.userRole})` : ''}:
                              </span>{' '}
                              {fb.reason && <span><strong>[{fb.reason}]</strong> </span>}
                              {fb.comment ? (
                                <span className={styles.commentQuote}>"{fb.comment}"</span>
                              ) : (
                                <span>{fb.isHelpful ? 'Marked as helpful' : 'Marked as needing improvement'}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons ("Check what should be changed") */}
                      <div className={styles.cardActionBtns}>
                        <button
                          type="button"
                          className={styles.btnInspectAction}
                          onClick={() => {
                            setSelectedArticle(art);
                            setDrawerOpen(true);
                          }}
                          title="Open article in detail drawer to read content, see revision threads, and evaluate changes"
                        >
                          🔍 Check What Should Be Changed
                        </button>

                        <button
                          type="button"
                          className={styles.btnEditAction}
                          onClick={() => navigate(`/admin/knowledge/${art.id}/edit`)}
                          title="Directly edit and update this article"
                        >
                          ✏️ Edit Article
                        </button>

                        {(user?.role === 'admin' || user?.role === 'manager') && (
                          <button
                            type="button"
                            className={styles.btnReviseAction}
                            onClick={() => {
                              setActionTargetArticle(art);
                              setWorkflowAction('request_revision');
                              setWorkflowModalOpen(true);
                            }}
                            title="Send revision notes to the author specifying what must be corrected"
                          >
                            ⚠️ Request Revision
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.btnViewPublicAction}
                          onClick={() => navigate(`/admin/knowledge/${art.id}`)}
                          title="View live published article page"
                        >
                          🌐 View Live
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState} style={{ padding: '24px 16px' }}>
                <div className={styles.emptyStateIcon}>📋</div>
                <h4>No Articles Match This Filter</h4>
                <p>
                  {feedbackFilter === 'not_helpful'
                    ? 'No articles currently marked as needing improvement.'
                    : feedbackFilter === 'helpful'
                    ? 'No articles rated as helpful yet.'
                    : 'No rated articles found matching your search.'}
                </p>
                {feedbackFilter !== 'all' && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      setFeedbackFilter('all');
                      setFeedbackSearch('');
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    View All Rated Articles
                  </button>
                )}
              </div>
            )}
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

      {/* Article Detail Drawer for inspection and checking what should be changed */}
      <ArticleDetailDrawer
        article={selectedArticle}
        open={drawerOpen}
        currentUserRole={user?.role}
        currentUserId={user?.id}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedArticle(null);
        }}
        onRequestAction={(art, action) => {
          setSelectedArticle(art);
          setActionTargetArticle(art);
          setWorkflowAction(action);
          setWorkflowModalOpen(true);
        }}
        onApproveDirect={handleApproveDirect}
        onOpenRevise={(art) => navigate(`/admin/knowledge/${art.id}/edit`)}
        onRouteToAuthor={(art) => {
          setSelectedArticle(art);
          setActionTargetArticle(art);
          setWorkflowAction('request_revision');
          setWorkflowModalOpen(true);
        }}
      />

      {/* Workflow Action Modal for Requesting Revision or Publishing */}
      <WorkflowActionModal
        open={workflowModalOpen}
        actionType={workflowAction}
        article={actionTargetArticle}
        busy={actionBusy}
        userRole={user?.role}
        onClose={() => {
          setWorkflowModalOpen(false);
          setActionTargetArticle(null);
        }}
        onSubmit={handleWorkflowSubmit}
      />
    </div>
  );
}
