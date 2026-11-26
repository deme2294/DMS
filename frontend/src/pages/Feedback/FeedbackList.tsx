import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import { fetchFeedback, deleteFeedback, replyToFeedback } from '../../api/feedbackApi';
import { fetchCategories, type TicketCategory } from '../../api/categoryApi';
import type { Feedback } from '../../types/feedback';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import { toShortFeedbackId } from '../../utils/idUtils';
import styles from './Feedback.module.css';

const basePaths: Record<string, string> = {
  admin: '/admin/feedback',
  manager: '/manager/feedback',
  staff: '/staff/feedback',
  ceo: '/ceo/feedback',
  tenant: '/tenant/feedback',
};

const dashboardPaths: Record<string, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  staff: '/staff/dashboard',
  ceo: '/ceo/dashboard',
  tenant: '/tenant/dashboard',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned_to_dept: 'Assigned to Dept',
  assigned_to_staff: 'Shared with Staff',
  in_progress: 'In Progress',
  read: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default function FeedbackList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'admin';
  const base = basePaths[role] || '/admin/feedback';
  const backTo = dashboardPaths[role] || '/admin/dashboard';

  const { page, limit, setPage, resetPage } = usePagination();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [message, setMessage] = useState('');
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchCategories({ status: 'active' })
      .then((res) => {
        setCategories(res.data.data || []);
      })
      .catch(() => {});
  }, []);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeedback({
        search,
        status,
        categoryId: categoryId || undefined,
        page,
        limit,
      });
      setFeedbacks(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      if (res.data.data.length > 0) {
        const ratedItems = res.data.data.filter((f) => f.rating);
        if (ratedItems.length > 0) {
          const avg =
            Math.round(
              (ratedItems.reduce((sum, fb) => sum + (fb.rating || 0), 0) / ratedItems.length) * 10
            ) / 10;
          setAverageRating(avg);
        } else {
          setAverageRating(0);
        }
      } else {
        setAverageRating(0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, categoryId, page, limit]);

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

  const isAdminOrCeo = role === 'admin' || role === 'ceo';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isTenant = role === 'tenant';

  const subtitle = isTenant
    ? 'Track your feedback submissions and review responses from the team.'
    : isManager
    ? 'Review feedback assigned to your department, set directives, and assign staff specialists.'
    : isStaff
    ? 'Tasks and feedback items assigned to you for investigation and resolution.'
    : 'Manage tenant feedback, direct improvements to departments, and track resolutions.';

  return (
    <div className={styles.page}>
      <PageHeader
        title={isManager ? 'Department Feedback Desk' : isStaff ? 'My Assigned Feedback' : 'Feedback Management'}
        description={subtitle}
        backTo={backTo}
        actionLabel={isTenant ? 'New Feedback' : undefined}
        onAction={isTenant ? () => navigate('/tenant/feedback/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      {averageRating > 0 && (
        <div className={styles.avgRating}>
          Tenant Satisfaction Rating: <strong>{averageRating}</strong> / 5 ⭐
        </div>
      )}

      <div className={styles.filters}>
        <input
          placeholder="Search by subject, tenant, directive..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending (Unassigned)</option>
          <option value="assigned_to_dept">Assigned to Dept</option>
          <option value="assigned_to_staff">Assigned to Specialist</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable<Feedback>
        loading={loading}
        data={feedbacks}
        columns={[
          {
            key: 'id',
            label: 'ID',
            render: (row) => (
              <span style={{ fontWeight: 600, color: '#64748b' }}>
                #{toShortFeedbackId(row)}
              </span>
            ),
          },
          {
            key: 'categoryName',
            label: 'Category / Service',
            render: (row) => (
              <div>
                {row.categoryName ? (
                  <span
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '0.78rem',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      display: 'inline-block',
                      marginBottom: row.serviceName ? '3px' : '0',
                    }}
                  >
                    🏷️ {row.categoryName}
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>General</span>
                )}
                {row.serviceName && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                    ⚡ {row.serviceName}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'tenantName',
            label: 'Tenant',
            render: (row) => (
              <div>
                <div style={{ fontWeight: 600 }}>{row.tenantName || '—'}</div>
                {row.contactPerson && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{row.contactPerson}</div>
                )}
              </div>
            ),
          },
          {
            key: 'subject',
            label: 'Subject',
            render: (row) => (
              <div>
                <Link
                  to={`${base}/${toShortFeedbackId(row)}`}
                  className={styles.link}
                  style={{ fontWeight: 600 }}
                >
                  {row.subject}
                </Link>
                {row.adminDirective && (
                  <div className={styles.directiveText}>
                    Directive: {row.adminDirective}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'departmentName',
            label: 'Department / Head',
            render: (row) => (
              <div>
                {row.departmentName ? (
                  <span className={styles.deptName}>🏛️ {row.departmentName}</span>
                ) : (
                  <span className={styles.mutedText}>Unassigned</span>
                )}
                {row.departmentHeadName && (
                  <div className={styles.deptHead}>
                    Head: {row.departmentHeadName}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'assignedToName',
            label: 'Staff / Sharing',
            render: (row) =>
              row.assignedToName ? (
                <span className={styles.staffSpecialist}>
                  👤 {row.assignedToName}
                </span>
              ) : (
                <span className={styles.mutedText}>Pending Staff</span>
              ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`${styles.badge} ${styles[row.status]}`}>
                {STATUS_LABELS[row.status] || row.status}
              </span>
            ),
          },
          {
            key: 'rating',
            label: 'Rating',
            render: (row) =>
              row.rating ? (
                <span className={styles.ratingGroup}>
                  <span className={styles.ratingStarsRow} aria-label={`${row.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={star <= (row.rating || 0) ? styles.starFilled : styles.starEmpty}
                      >
                        {star <= (row.rating || 0) ? '★' : '☆'}
                      </span>
                    ))}
                  </span>
                  <span className={styles.ratingNumeric}>{row.rating}/5</span>
                </span>
              ) : (
                <span className={styles.mutedText}>—</span>
              ),
          },
          {
            key: 'createdAt',
            label: 'Submitted',
            render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <Link
                  to={`${base}/${toShortFeedbackId(row)}`}
                  className={styles.linkBtn}
                >
                  Manage →
                </Link>
                {isAdminOrCeo && (
                  <button onClick={() => setDeleteModal(row)} className={styles.danger}>
                    Delete
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>

      <Modal open={!!deleteModal} title="Delete Feedback" onClose={() => setDeleteModal(null)} maxWidth="500px">
        <div className={styles.modalBody}>
          <p>
            Are you sure you want to delete feedback from{' '}
            <strong>{deleteModal?.tenantName || deleteModal?.tenantId}</strong> with subject{' '}
            <strong>"{deleteModal?.subject}"</strong>? This action cannot be undone.
          </p>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={() => setDeleteModal(null)}>
              Cancel
            </button>
            <button className={styles.confirmBtn} onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!replyModal} title="Quick Reply" onClose={() => { setReplyModal(null); setReplyText(''); }} maxWidth="640px">
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
