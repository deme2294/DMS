import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal/Modal';
import type { Article, ArticleVisibility } from '../../../types/article';
import { updateArticle, submitArticle } from '../../../api/knowledgeApi';
import { useAuth } from '../../../context/AuthContext';
import { RevisionThreadCard } from './RevisionThreadCard';
import styles from '../KnowledgeMyArticles.module.css';

interface QuickReviseModalProps {
  open: boolean;
  article: Article | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const QuickReviseModal: React.FC<QuickReviseModalProps> = ({
  open,
  article,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<ArticleVisibility>('internal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [checklist, setChecklist] = useState<string[]>([]);
  const [resubmitNotes, setResubmitNotes] = useState('');

  useEffect(() => {
    if (article && open) {
      setTitle(article.title || '');
      setCategory(article.category || 'General');
      setSummary(article.summary || '');
      setContent(article.content || '');
      setVisibility(article.visibility || 'internal');
      setChecklist([]);
      setResubmitNotes('');
      setError('');
    }
  }, [article, open]);

  if (!open || !article) return null;

  const toggleChecklistItem = (item: string) => {
    setChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSave = async (submitNow: boolean) => {
    if (!title.trim()) {
      setError('Article title is required.');
      return;
    }
    if (!content.trim()) {
      setError('Article content is required.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await updateArticle(article.id, {
        title: title.trim(),
        category: category.trim(),
        summary: summary.trim() || null,
        content: content.trim(),
        visibility,
        bumpVersion: true,
      });

      if (submitNow) {
        const compiledNotes = [
          ...checklist.map((c) => `✓ ${c}`),
          resubmitNotes.trim() ? `Details: ${resubmitNotes.trim()}` : '',
        ]
          .filter(Boolean)
          .join('; ');

        await submitArticle(article.id, {
          resubmitNotes: compiledNotes || 'Addressed revision recommendations and updated version',
          bumpVersion: true,
        });

        if (isManager || isAdmin) {
          onSuccess(`Article "${title}" updated and routed to Admin for review.`);
        } else {
          onSuccess(`Article "${title}" updated (new version) and assigned to Department Manager for review!`);
        }
      } else {
        onSuccess(`Changes to "${title}" saved as updated draft.`);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save article revision';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Revise Article: ${article.articleReference} (v${article.version || '1.0'})`}
      onClose={busy ? () => {} : onClose}
      maxWidth="680px"
    >
      <div className={styles.reviseModalContent}>
        {/* Revision & Feedback Trail */}
        {article.revisionNotes && (
          <RevisionThreadCard revisionNotes={article.revisionNotes} />
        )}

        {error && <div className={styles.modalError}>{error}</div>}

        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Article Title *</label>
          <input
            type="text"
            className={styles.inputField}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="Clear, descriptive title..."
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Category</label>
            <input
              type="text"
              className={styles.inputField}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
              placeholder="E.g. Network, Software, Policy..."
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Visibility</label>
            <select
              className={styles.selectField}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ArticleVisibility)}
              disabled={busy}
            >
              <option value="internal">Internal (Staff & Managers)</option>
              <option value="tenant">Tenant & Portal Users</option>
              <option value="department">Department Only</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Brief Summary / Abstract</label>
          <input
            type="text"
            className={styles.inputField}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={busy}
            placeholder="One or two sentences explaining this article..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Article Content (Markdown supported) *</label>
          <textarea
            className={styles.contentEditor}
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy}
            placeholder="Write updated resolution steps, troubleshooting details, policies..."
          />
        </div>

        {/* Verification & Change Checklist */}
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: '8px' }}>
            ☑️ Revision Resolution Checklist (Checked by Dept Manager)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#334155' }}>
            {[
              'Addressed and resolved Admin revision recommendations',
              'Verified step-by-step procedures and technical accuracy',
              'Checked department guidelines and verified category',
              'Proofread content for clarity and complete resolution instructions',
            ].map((item) => (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.includes(item)}
                  onChange={() => toggleChecklistItem(item)}
                  disabled={busy}
                  style={{ accentColor: '#2563eb', width: '16px', height: '16px' }}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '4px', fontWeight: 500 }}>
              What was added or changed (Summary for Admin):
            </label>
            <input
              type="text"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              placeholder="E.g., Added missing steps, clarified troubleshooting commands, and verified department policy"
              value={resubmitNotes}
              onChange={(e) => setResubmitNotes(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveDraftBtn}
            onClick={() => handleSave(false)}
            disabled={busy}
          >
            {busy ? 'Saving...' : '💾 Save Draft'}
          </button>
          <button
            type="button"
            className={styles.resubmitBtn}
            onClick={() => handleSave(true)}
            disabled={busy}
          >
            {busy
              ? 'Submitting...'
              : isManager
              ? '🚀 Save & Route to Admin'
              : '🚀 Save & Submit New Version to Manager'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
