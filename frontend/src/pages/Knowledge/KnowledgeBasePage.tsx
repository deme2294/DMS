import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchArticles,
  fetchArticle,
  rateArticle,
  searchArticles,
  getPopularArticles,
  getRecentArticles,
} from '../../api/knowledgeApi';
import type { Article } from '../../types/article';
import { useAuth } from '../../context/AuthContext';
import styles from './KnowledgeBasePage.module.css';

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [viewTarget, setViewTarget] = useState<Article | null>(null);
  const [message, setMessage] = useState('');
  const [suggested, setSuggested] = useState<Article[]>([]);
  const [showSuggested, setShowSuggested] = useState(false);
  const [popular, setPopular] = useState<Article[]>([]);
  const [recent, setRecent] = useState<Article[]>([]);
  const [recommended, setRecommended] = useState<Article[]>([]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await fetchArticles({ search, category, page: 1, limit: 20 });
      setArticles(res.data.data || []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [search, category]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    getPopularArticles(6).then((res) => setPopular(res.data.data || [])).catch(() => setPopular([]));
    getRecentArticles(6).then((res) => setRecent(res.data.data || [])).catch(() => setRecent([]));
  }, []);

  useEffect(() => {
    if (search.length > 2) {
      searchArticles(search, 5).then((res) => setRecommended(res.data.data || [])).catch(() => setRecommended([]));
    } else {
      setRecommended([]);
    }
  }, [search]);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length > 2) {
      const res = await searchArticles(query, 5);
      setSuggested(res.data.data || []);
      setShowSuggested(true);
    } else {
      setShowSuggested(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await fetchArticle(id);
      setViewTarget(res.data.data);
    } catch {
      setMessage('Failed to load article');
    }
  };

  const rate = async (helpful: boolean) => {
    if (!viewTarget) return;
    try {
      await rateArticle(viewTarget.id, helpful);
      setMessage('Thanks for your feedback');
      setViewTarget({ ...viewTarget, helpfulCount: (viewTarget.helpfulCount || 0) + (helpful ? 1 : 0), notHelpfulCount: (viewTarget.notHelpfulCount || 0) + (helpful ? 0 : 1) });
    } catch {
      setMessage('Failed to submit feedback');
    }
  };

  const handleUseSuggested = (article: Article) => {
    setShowSuggested(false);
    setSuggested([]);
    openDetail(article.id);
  };

  const renderCard = (article: Article) => (
    <div key={article.id} className={styles.articleCard} onClick={() => openDetail(article.id)}>
      <div className={styles.cardHeader}>
        <span className={styles.cardRef}>{article.articleReference}</span>
        {user?.role !== 'tenant' && <span className={`${styles.badge} ${styles[article.status]}`}>{article.status}</span>}
      </div>
      <h3>{article.title}</h3>
      <p>{article.summary?.slice(0, 150)}{(article.summary && article.summary.length > 150) ? '...' : ''}</p>
      <div className={styles.cardFooter}>
        <span>{article.category}</span>
        <span>Views: {article.viewCount || 0}</span>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader title="Knowledge Base" description="Find answers to common questions" backTo="/tenant/dashboard" />

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.searchSection}>
        <h2>How can we help?</h2>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search for articles..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button onClick={() => loadArticles()}>Search</button>
        </div>
        {showSuggested && suggested.length > 0 && (
          <div className={styles.suggestedBox}>
            <h4>Suggested Articles</h4>
            {suggested.map((s) => (
              <div key={s.id} className={styles.suggestedItem} onClick={() => handleUseSuggested(s)}>
                <strong>{s.title}</strong>
                <span>{s.articleReference}</span>
              </div>
            ))}
            <button className={styles.dismissBtn} onClick={() => setShowSuggested(false)}>Dismiss</button>
          </div>
        )}
      </div>

      <div className={styles.filters}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {popular.length > 0 && (
        <section className={styles.section}>
          <h3>Popular Articles</h3>
          <div className={styles.articleGrid}>
            {popular.map(renderCard)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className={styles.section}>
          <h3>Recently Published</h3>
          <div className={styles.articleGrid}>
            {recent.map(renderCard)}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className={styles.section}>
          <h3>Recommended Articles</h3>
          <div className={styles.articleGrid}>
            {recommended.map(renderCard)}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h3>All Articles</h3>
        <div className={styles.articleGrid}>
          {articles.map(renderCard)}
          {!articles.length && !loading && (
            <div className={styles.empty}>No articles found. Try creating a ticket for help.</div>
          )}
        </div>
      </section>

      <Modal open={!!viewTarget} title={viewTarget?.title || ''} onClose={() => setViewTarget(null)}>
        {viewTarget && (
          <div>
            <div className={styles.meta}>
              <span>{viewTarget.articleReference}</span>
              <span>{viewTarget.category}</span>
              <span>Published: {viewTarget.publishedAt ? new Date(viewTarget.publishedAt).toLocaleDateString() : '—'}</span>
            </div>
            {viewTarget.summary && <p className={styles.summary}>{viewTarget.summary}</p>}
            <div className={styles.content} style={{ whiteSpace: 'pre-wrap' }}>{viewTarget.content}</div>
            <div className={styles.feedback}>
              <span>Was this helpful?</span>
              <button className={styles.submitBtn} onClick={() => rate(true)}>👍 Helpful</button>
              <button className={styles.cancelBtn} onClick={() => rate(false)}>👎 Not Helpful</button>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className={styles.ticketBtn} onClick={() => { setViewTarget(null); navigate('/tenant/tickets/create'); }}>
                Still need help? Create a ticket
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
