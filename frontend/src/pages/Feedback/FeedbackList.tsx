import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import { fetchFeedback, deleteFeedback, replyToFeedback } from '../../api/feedbackApi';
import type { Feedback } from '../../types/feedback';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import styles from './Feedback.module.css';

const basePaths: Record<string, string> = {
  admin: '/admin/feedback',
  tenant: '/tenant/feedback',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  read: 'Read',
  resolved: 'Resolved',
};

export default function FeedbackList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const base = user ? basePaths[user.role] || '/admin/feedback' : '/admin/feedback';
  const { page, limit, setPage, resetPage } = usePagination();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [message, setMessage] = useState('');
  const [averageRating, setAverageRating] = useState(0);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeedback({ search, status, page, limit });
      setFeedbacks(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      if (res.data.data.length > 0) {
        const avg = Math.round((res.data.data.reduce((sum, fb) => sum + (fb.rating || 0), 0) / res.data.data.length) * 10) / 10;
        setAverageRating(avg);
      } else {
        setAverageRating(0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  const [deleteModal, setDeleteModal] = useState<Feedback | null>(null);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteFeedback(deleteModal.id);
      setMessage('Feedback deleted');
      loadFeedbacks();
    } catch {
      setMessage('Failed to delete feedback');
    } finally {
      setDeleteModal(null);
    }
  };

  const [replyModal, setReplyModal] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const handleReplySubmit = async () => {
    if (!replyModal || !replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await replyToFeedback(replyModal.id, replyText.trim());
      setReplyText('');
      setReplyModal(null);
      setMessage('Reply sent');
      loadFeedbacks();
    } catch {
      setMessage('Failed to send reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Feedback"
        description="View and manage tenant feedback submissions."
        backTo={user?.role === 'tenant' ? '/tenant/dashboard' : '/admin/dashboard'}
        actionLabel={user?.role === 'tenant' ? 'New Feedback' : undefined}
        onAction={user?.role === 'tenant' ? () => navigate('/tenant/feedback/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      {averageRating > 0 && (
        <div className={styles.avgRating}>
          Average Rating: <strong>{averageRating}</strong> / 5
        </div>
      )}

      <div className={styles.filters}>
        <input
          placeholder="Search tenant, subject, message..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="read">Read</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <DataTable<Feedback>
        loading={loading}
        data={feedbacks}
        columns={[
          {
            key: 'tenantName',
            label: 'Tenant',
            render: (row) => row.tenantName || '—',
          },
          {
            key: 'subject',
            label: 'Subject',
            render: (row) => (
              <Link to={`${base}/${row.id}`} className={styles.link}>
                {row.subject}
              </Link>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`${styles.badge} ${styles[row.status]}`}>{STATUS_LABELS[row.status] || row.status}</span>
            ),
          },
          {
            key: 'rating',
            label: 'Rating',
            render: (row) => (
              <span className={styles.ratingStars}>
                {row.rating ? '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating) : '—'}
              </span>
            ),
          },
          {
            key: 'createdAt',
            label: 'Created',
            render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—',
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <Link to={`${base}/${row.id}`} className={styles.linkBtn}>View</Link>
                <button onClick={() => { setReplyModal(row); setReplyText(''); }} className={styles.replyBtn}>Reply</button>
                <button onClick={() => setDeleteModal(row)} className={styles.danger}>Delete</button>
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      <Modal open={!!deleteModal} title="Delete Feedback" onClose={() => setDeleteModal(null)}>
        <div className={styles.modalBody}>
          <p>
            Are you sure you want to delete feedback from <strong>{deleteModal?.tenantName || deleteModal?.tenantId}</strong>
            {' '}with subject <strong>"{deleteModal?.subject}"</strong>? This action cannot be undone.
          </p>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className={styles.confirmBtn} onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!replyModal} title="Reply to Feedback" onClose={() => { setReplyModal(null); setReplyText(''); }}>
        <div className={styles.replyForm}>
          <label>Message</label>
          <textarea
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
          />
          <button
            className={styles.submitBtn}
            onClick={handleReplySubmit}
            disabled={replySubmitting || !replyText.trim()}
          >
            {replySubmitting ? 'Sending...' : 'Submit Reply'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
