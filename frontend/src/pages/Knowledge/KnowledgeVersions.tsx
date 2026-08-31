import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchVersions } from '../../api/knowledgeApi';
import type { ArticleVersion } from '../../types/article';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import styles from './KnowledgeVersions.module.css';

export default function KnowledgeVersions() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const basePath = role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchVersions(id)
      .then((res) => setVersions(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader title="Article Versions" description="Version history and changes" backTo={`${basePath}/${id}`} />

      <div className={styles.versionList}>
        {versions.map((v) => (
          <div key={v.id} className={styles.versionItem}>
            <div className={styles.versionHeader}>
              <strong>Version {v.versionNumber}</strong>
              <span className={styles.versionDate}>{new Date(v.createdAt).toLocaleString()}</span>
            </div>
            <div className={styles.versionTitle}>{v.title}</div>
            <div className={styles.versionContent}>{v.content?.slice(0, 500)}{v.content?.length > 500 ? '...' : ''}</div>
            {v.changeSummary && <div className={styles.versionSummary}>Changes: {v.changeSummary}</div>}
            <div className={styles.versionMeta}>
              Created by: {[v.creatorFirstName, v.creatorLastName].filter(Boolean).join(' ') || v.createdBy?.slice(0, 8) || '—'}
              {v.approvedAt && ` · Approved: ${new Date(v.approvedAt).toLocaleDateString()}`}
              {v.publishedAt && ` · Published: ${new Date(v.publishedAt).toLocaleDateString()}`}
            </div>
          </div>
        ))}
        {!versions.length && <div className={styles.empty}>No versions yet</div>}
      </div>
    </div>
  );
}
