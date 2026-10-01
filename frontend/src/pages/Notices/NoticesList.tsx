import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import { fetchNotices, deleteNotice, updateNotice, fetchNoticeCategories, acknowledgeNotice, fetchMyAcknowledgements } from '../../api/noticeApi';
import type { Notice } from '../../types/notice';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import styles from './Notices.module.css';

export default function NoticesList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { page, limit, setPage, resetPage } = usePagination();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const loadNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNotices({ search, status, category, page, limit });
      setNotices(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [search, status, category, page, limit]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchNoticeCategories();
      setCategories(res.data.data);
    } catch {
      setCategories(['General', 'Maintenance', 'Policy', 'Announcement']);
    }
  }, []);

  // Recipients (non-admins) fetch their own acknowledgement state.
  const loadMyAcknowledgements = useCallback(async () => {
    if (isAdmin) return;
    try {
      const res = await fetchMyAcknowledgements();
      setAcknowledgedIds(new Set(res.data.data));
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadMyAcknowledgements();
  }, [loadMyAcknowledgements]);

  const handleDelete = async (notice: Notice) => {
    if (!window.confirm(`Delete notice "${notice.title}"?`)) return;
    try {
      await deleteNotice(notice.id);
      setMessage('Notice deleted successfully');
      loadNotices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete notice';
      setMessage(msg);
    }
  };

  const handleToggleStatus = async (notice: Notice) => {
    try {
      const newStatus = notice.status === 'draft' ? 'published' : 'draft';
      await updateNotice(notice.id, { status: newStatus });
      setMessage(`Notice ${newStatus === 'published' ? 'published' : 'moved to draft'} successfully`);
      loadNotices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update status';
      setMessage(msg);
    }
  };

  const handleAcknowledge = async (notice: Notice) => {
    try {
      await acknowledgeNotice(notice.id);
      setAcknowledgedIds((prev) => new Set(prev).add(notice.id));
      setMessage(`Notice "${notice.title}" acknowledged.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to acknowledge notice';
      setMessage(msg);
    }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: Notice) => (
        <span className={`${styles.badge} ${styles[row.priority]}`}>{row.priority}</span>
      ),
    },
    {
      key: 'targetAudience',
      label: 'Target / Department',
      render: (row: Notice) => {
        const aud = (row as any).target_audience || row.targetAudience || 'all';
        const dept = (row as any).department_name || row.departmentName;
        return (
          <span style={{ fontSize: '0.85rem' }}>
            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{aud}</span>
            {dept && (
              <span style={{ display: 'block', color: 'var(--text-secondary, #6b7280)', fontSize: '0.75rem' }}>
                🏢 {dept}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Notice) => (
        <button
          type="button"
          className={`${styles.statusToggle} ${row.status === 'published' ? styles.statusPublished : styles.statusDraft}`}
          onClick={() => handleToggleStatus(row)}
          title={`Click to ${row.status === 'draft' ? 'publish' : 'move to draft'}`}
        >
          {row.status}
        </button>
      ),
    },
    {
      key: 'createdByName',
      label: 'Author',
      render: (row: Notice) => {
        const authorName = (row as any).creator_first_name
          ? `${(row as any).creator_first_name} ${(row as any).creator_last_name || ''}`
          : row.createdByName || 'System';
        const role = (row as any).creator_role;
        return (
          <span style={{ fontSize: '0.85rem' }}>
            {authorName}
            {role && (
              <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                ({role})
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (row: Notice) => (row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'),
    },
    ...(isAdmin
      ? [
          {
            key: 'recipients',
            label: 'Acknowledged',
            render: (row: Notice) =>
              row.recipientCounts ? (
                <span className={styles.badge}>
                  {row.recipientCounts.acknowledged}/{row.recipientCounts.total}
                </span>
              ) : (
                '—'
              ),
          },
        ]
      : []),
    ...(isAdmin
      ? []
      : [
          {
            key: 'ack',
            label: 'Your Action',
            render: (row: Notice) => {
              if (row.status !== 'published') return <span className={styles.date}>—</span>;
              if (acknowledgedIds.has(row.id)) {
                return <span className={`${styles.badge} ${styles.published}`}>✓ Acknowledged</span>;
              }
              return (
                <button
                  className={styles.btnSecondary}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcknowledge(row);
                  }}
                >
                  Acknowledge
                </button>
              );
            },
          },
        ]),
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Notice) => (
        <div className={styles.actions}>
          {(can('notices.manage') || row.createdBy === user?.id || row.created_by === user?.id || (row as any).creator_id === user?.id) && (
            <>
              <button onClick={() => navigate(`/admin/notices/${row.id}/edit`)}>Edit</button>
              <button className={styles.danger} onClick={() => handleDelete(row)}>Delete</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Notices Management"
        description="Create, publish, and manage system notices and announcements."
        backTo="/admin/dashboard"
        actionLabel={can('notices.manage') ? '+ Add Notice' : undefined}
        onAction={can('notices.manage') ? () => navigate('/admin/notices/create') : undefined}
      />

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.filters}>
        <input
          placeholder="Search by title or content..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <DataTable<Notice>
        loading={loading}
        data={notices}
        columns={columns}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
