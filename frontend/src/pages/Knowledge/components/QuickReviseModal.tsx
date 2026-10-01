import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal/Modal';
import type { Article, ArticleVisibility } from '../../../types/article';
import { updateArticle, submitArticle } from '../../../api/knowledgeApi';
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
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<ArticleVisibility>('internal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (article && open) {
      setTitle(article.title || '');
      setCategory(article.category || 'General');
      setSummary(article.summary || '');
      setContent(article.content || '');
      setVisibility(article.visibility || 'internal');
      setError('');
    }
  }, [article, open]);

  if (!open || !article) return null;

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
      });

      if (submitNow) {
        await submitArticle(article.id);
        onSuccess(`Article "${title}" updated and resubmitted to Admin for review!`);
      } else {
        onSuccess(`Changes to "${title}" saved successfully.`);
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
      title={`Revise Article: ${article.articleReference}`}
      onClose={busy ? () => {} : onClose}
    >
      <div className={styles.reviseModalContent}>
        {/* Admin Feedback Box */}
        {article.revisionNotes && (
          <div className={styles.adminFeedbackAlert}>
            <div className={styles.feedbackAlertHeader}>
              <span className={styles.feedbackAlertIcon}>⚠️</span>
              <strong>Admin Revision Instructions & Feedback</strong>
            </div>
            <p className={styles.feedbackAlertBody}>{article.revisionNotes}</p>
          </div>
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
            {busy ? 'Submitting...' : '🚀 Save & Resubmit to Admin'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
