import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchVersions, restoreArticleVersion } from '../../api/knowledgeApi';
import type { ArticleVersion } from '../../types/article';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
import {
  EyeIcon,
  ArrowPathIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { resolveCategoryIcon } from '../../utils/categoryIconUtils';
import styles from './KnowledgeVersions.module.css';

export default function KnowledgeVersions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const basePath = role === 'staff' ? '/staff/knowledge' : role === 'manager' ? '/manager/knowledge' : '/admin/knowledge';
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [selectedSnapshot, setSelectedSnapshot] = useState<ArticleVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArticleVersion | null>(null);
  const [restoreNotes, setRestoreNotes] = useState('');
  const [restoreIsMajor, setRestoreIsMajor] = useState(false);

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    fetchVersions(id)
      .then((res) => setVersions(res.data.data || []))
      .catch(() => setError('Failed to load article versions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleConfirmRestore = async () => {
    if (!id || !restoreTarget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await restoreArticleVersion(id, restoreTarget.id, {
        isMajor: restoreIsMajor,
        changeSummary: restoreNotes.trim() || undefined,
      });
      setMessage(res.data.message || `Restored version ${restoreTarget.versionNumber} as new version ${res.data.data?.newVersion}`);
      setRestoreTarget(null);
      setSelectedSnapshot(null);
      setRestoreNotes('');
      setRestoreIsMajor(false);
      loadData();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to restore version');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={styles.page}>Loading versions...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Article Version History"
        description="Immutable snapshot records of all published and approved revisions"
        backTo={`${basePath}/${id}`}
      />

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: '10px', background: '#ecfdf5', color: '#065f46', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      <div className={styles.versionList}>
        {versions.map((v) => (
          <div key={v.id} className={styles.versionItem}>
            <div className={styles.versionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#2563eb', fontFamily: 'monospace' }}>
                  v{v.versionNumber}
                </span>
                {v.publishedAt ? (
                  <span style={{ fontSize: '0.74rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    Published Live
                  </span>
                ) : v.approvedAt ? (
                  <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    Approved
                  </span>
                ) : null}
              </div>
              <span className={styles.versionDate}>
                {new Date(v.createdAt).toLocaleDateString()} at {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className={styles.versionTitle}>{v.title}</div>
            <div className={styles.versionContent}>
              {v.content?.slice(0, 300)}{v.content?.length > 300 ? '...' : ''}
            </div>

            {v.changeSummary && <div className={styles.versionSummary}>Changes: {v.changeSummary}</div>}

            <div className={styles.versionMeta}>
              <div>
                Author: {[v.creatorFirstName, v.creatorLastName].filter(Boolean).join(' ') || v.createdBy?.slice(0, 8) || '—'}
                {v.approvedAt && ` · Approved by ${[v.approverFirstName, v.approverLastName].filter(Boolean).join(' ') || 'Admin'}`}
                {v.publishedAt && ` · Published ${new Date(v.publishedAt).toLocaleDateString()}`}
              </div>

              <div className={styles.actionBtns}>
                <button className={styles.viewBtn} onClick={() => setSelectedSnapshot(v)}>
                  <EyeIcon style={{ width: 14, height: 14 }} />
                  <span>View Snapshot</span>
                </button>
                {(role === 'admin' || role === 'manager') && (
                  <button
                    className={styles.restoreBtn}
                    onClick={() => {
                      setRestoreTarget(v);
                      setRestoreNotes(`Restored from version ${v.versionNumber}`);
                      setRestoreIsMajor(false);
                    }}
                  >
                    <ArrowPathIcon style={{ width: 14, height: 14 }} />
                    <span>Restore as New</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!versions.length && <div className={styles.empty}>No versions recorded yet</div>}
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <Modal
          open={!!selectedSnapshot}
          title={`Version Snapshot: v${selectedSnapshot.versionNumber}`}
          onClose={() => setSelectedSnapshot(null)}
          maxWidth="760px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2563eb', background: 'rgba(37,99,235,0.1)', padding: '3px 10px', borderRadius: 6 }}>
                v{selectedSnapshot.versionNumber}
              </span>
              <span style={{ fontSize: '0.8rem', background: 'var(--bg-subtle, #f8fafc)', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
                {resolveCategoryIcon(selectedSnapshot.category || '')} {selectedSnapshot.category || 'General'}
              </span>
              <span style={{ fontSize: '0.8rem', background: 'var(--bg-subtle, #f8fafc)', padding: '4px 8px', borderRadius: 6 }}>
                Visibility: {selectedSnapshot.visibility || 'public'}
              </span>
              {selectedSnapshot.publishedAt && (
                <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                  Published: {new Date(selectedSnapshot.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>{selectedSnapshot.title}</h3>
              {selectedSnapshot.changeSummary && (
                <div style={{ fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid #3b82f6', borderRadius: 6, marginBottom: 12 }}>
                  <strong>Change Summary:</strong> {selectedSnapshot.changeSummary}
                </div>
              )}
              {selectedSnapshot.summary && (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '3px solid #10b981', borderRadius: 6, fontSize: '0.9rem', marginBottom: 12 }}>
                  <InformationCircleIcon style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
                  <span>{selectedSnapshot.summary}</span>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                Snapshot Body Content
              </label>
              <div
                style={{
                  marginTop: 6,
                  padding: 18,
                  borderRadius: 10,
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  lineHeight: 1.7,
                  maxHeight: '380px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.92rem',
                }}
              >
                {selectedSnapshot.content}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Recorded {new Date(selectedSnapshot.createdAt).toLocaleString()} by {[selectedSnapshot.creatorFirstName, selectedSnapshot.creatorLastName].filter(Boolean).join(' ') || 'Author'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={styles.viewBtn} onClick={() => setSelectedSnapshot(null)}>
                  Close
                </button>
                {(role === 'admin' || role === 'manager') && (
                  <button
                    className={styles.restoreBtn}
                    onClick={() => {
                      const snap = selectedSnapshot;
                      setSelectedSnapshot(null);
                      setRestoreTarget(snap);
                      setRestoreNotes(`Restored from version ${snap.versionNumber}`);
                      setRestoreIsMajor(false);
                    }}
                  >
                    <ArrowPathIcon style={{ width: 14, height: 14 }} />
                    <span>Restore as New Version</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <Modal
          open={!!restoreTarget}
          title={`Restore Version v${restoreTarget.versionNumber} as New Version`}
          onClose={() => setRestoreTarget(null)}
          maxWidth="600px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.08)', borderLeft: '4px solid #3b82f6', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Restoring snapshot <strong>v{restoreTarget.versionNumber}</strong> ("{restoreTarget.title}") will automatically generate a <strong>new version</strong> containing this snapshot's content.
              <div style={{ marginTop: 6, color: '#16a34a', fontWeight: 600 }}>
                ✓ No existing versions will be overwritten or deleted. Full version history is permanently preserved.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: 6 }}>
                Restore Change Notes / Summary
              </label>
              <textarea
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.9rem' }}
                rows={2}
                value={restoreNotes}
                onChange={(e) => setRestoreNotes(e.target.value)}
                placeholder="e.g. Rolled back to version 1.0 due to revised department policy"
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={restoreIsMajor}
                  onChange={(e) => setRestoreIsMajor(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                />
                <span><strong>Major Version Release (e.g. v2.0)</strong> — increments major version number</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className={styles.viewBtn} disabled={busy} onClick={() => setRestoreTarget(null)}>
                Cancel
              </button>
              <button className={styles.restoreBtn} disabled={busy} onClick={handleConfirmRestore}>
                <ArrowPathIcon style={{ width: 15, height: 15 }} />
                <span>{busy ? 'Restoring...' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
