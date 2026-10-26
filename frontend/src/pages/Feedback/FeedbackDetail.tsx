import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import { fetchFeedbackItem, fetchReplies, replyToFeedback, updateFeedback } from '../../api/feedbackApi';
import type { Feedback, FeedbackReply } from '../../types/feedback';
import { useAuth } from '../../context/AuthContext';
import styles from './FeedbackDetail.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  read: 'Read',
  resolved: 'Resolved',
};

export default function FeedbackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const loadFeedback = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [fbRes, repliesRes] = await Promise.all([
        fetchFeedbackItem(id),
        fetchReplies(id),
      ]);
      const fbData = fbRes.data.data;
      setFeedback(fbData);
      setReplies(repliesRes.data.data);
      setNewStatus(fbData.status);
      const base = user?.role === 'tenant' ? '/tenant/feedback' : '/admin/feedback';
      if (fbData?.feedbackNum && id !== String(fbData.feedbackNum) && id.length > 20) {
        navigate(`${base}/${fbData.feedbackNum}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [id]);

  const handleReply = async () => {
    if (!id || !replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await replyToFeedback(id, replyText.trim());
      setReplyText('');
      setToast('Reply sent');
      loadFeedback();
    } catch {
      setToast('Failed to send reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!id) return;
    try {
      await updateFeedback(id, { status: newStatus });
      setStatusModal(false);
      setToast('Status updated');
      loadFeedback();
    } catch {
      setToast('Failed to update status');
    }
  };

  if (loading || !feedback) return <div className={styles.page}>Loading...</div>;

  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';

  return (
    <div className={styles.page}>
      <PageHeader
        title={feedback.subject}
        description={`${feedback.tenantName || feedback.tenantId} · Contact: ${feedback.contactPerson || '—'}`}
        backTo={user?.role === 'tenant' ? '/tenant/feedback' : '/admin/feedback'}
        actionLabel={isAdmin ? 'Respond' : undefined}
        onAction={isAdmin ? () => setStatusModal(true) : undefined}
      />

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <h3>Details</h3>
          <p>
            <strong>Status:</strong>{' '}
            <span className={`${styles.badge} ${styles[feedback.status]}`}>{STATUS_LABELS[feedback.status] || feedback.status}</span>
          </p>
          <p><strong>Type:</strong> {feedback.feedbackType || '—'}</p>
          <p>
            <strong>Rating:</strong>{' '}
            <span className={styles.ratingStars}>
              {feedback.rating ? '★'.repeat(feedback.rating) + '☆'.repeat(5 - feedback.rating) : '—'}
            </span>
          </p>
          {feedback.ticketReference && (
            <p><strong>Ticket:</strong> [{feedback.ticketReference}] {feedback.ticketTitle || '—'}</p>
          )}
          <p><strong>Message:</strong></p>
          <p className={styles.description}>{feedback.message}</p>
          <p><strong>Created:</strong> {feedback.createdAt ? new Date(feedback.createdAt).toLocaleString() : '—'}</p>
          <p><strong>Updated:</strong> {feedback.updatedAt ? new Date(feedback.updatedAt).toLocaleString() : '—'}</p>
        </div>

        <div className={styles.card}>
          <h3>Detailed Assessment</h3>
          <div className={styles.assessmentSection}>
            <div className={styles.assessmentItem}>
              <strong>What is Correct:</strong>
              <p>{feedback.whatIsCorrect || '—'}</p>
            </div>
            <div className={styles.assessmentItem}>
              <strong>What is Wrong:</strong>
              <p>{feedback.whatIsWrong || '—'}</p>
            </div>
            <div className={styles.assessmentItem}>
              <strong>What Should Change:</strong>
              <p>{feedback.whatShouldChange || '—'}</p>
            </div>
            <div className={styles.assessmentItem}>
              <strong>How It Should Go:</strong>
              <p>{feedback.howItShouldGo || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className={styles.card}>
          <h3>Send Response</h3>
          <div className={styles.replyForm}>
            <label>Response Message</label>
            <textarea
              rows={5}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response to the tenant..."
            />
            <button
              className={styles.submitBtn}
              onClick={handleReply}
              disabled={replySubmitting || !replyText.trim()}
            >
              {replySubmitting ? 'Sending...' : 'Send Response'}
            </button>
          </div>
        </div>
      )}

      {feedback.adminResponse && (
        <div className={styles.card}>
          <h3>Admin Response</h3>
          <div className={styles.adminResponse}>
            <p className={styles.responseMessage}>{feedback.adminResponse}</p>
            <p className={styles.responseMeta}>
              {feedback.responseAt ? new Date(feedback.responseAt).toLocaleString() : ''}
            </p>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h3>{replies.length} Replies</h3>
        {replies.length === 0 ? (
          <p className={styles.emptyState}>No replies yet.</p>
        ) : (
          <ul className={styles.timeline}>
            {replies.map((reply) => {
              const author = [reply.firstName, reply.lastName].filter(Boolean).join(' ') || reply.repliedBy || '—';
              return (
                <li key={reply.id}>
                  <div className={styles.timelineHeader}>
                    <strong>{author}</strong>
                    <span className={styles.timestamp}>
                      {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p>{reply.message}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={statusModal} title="Update Feedback Status" onClose={() => setStatusModal(false)}>
        <div className={styles.modalForm}>
          <label>Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            {['pending', 'read', 'resolved', 'in_progress'].map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
            ))}
          </select>
          <button onClick={handleUpdateStatus}>Save Status</button>
        </div>
      </Modal>
    </div>
  );
}
