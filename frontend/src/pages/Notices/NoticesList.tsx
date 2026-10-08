import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchNotices,
  deleteNotice,
  updateNotice,
  fetchNoticeCategories,
  acknowledgeNotice,
  fetchMyAcknowledgements,
} from '../../api/noticeApi';
import type { Notice } from '../../types/notice';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import { buildAttachmentUrl } from '../../utils/attachmentUtils';
import styles from './Notices.module.css';

import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  UserCircleIcon,
  TagIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

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

  // Modal states
  const [viewingNotice, setViewingNotice] = useState<Notice | null>(null);
  const [deleteNoticeTarget, setDeleteNoticeTarget] = useState<Notice | null>(null);

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

  const confirmDelete = async () => {
    if (!deleteNoticeTarget) return;
    try {
      await deleteNotice(deleteNoticeTarget.id);
      setMessage(`Notice "${deleteNoticeTarget.title}" deleted successfully`);
      setDeleteNoticeTarget(null);
      if (viewingNotice?.id === deleteNoticeTarget.id) {
        setViewingNotice(null);
      }
      loadNotices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete notice';
      setMessage(msg);
      setDeleteNoticeTarget(null);
    }
  };

  const handlePublish = async (notice: Notice) => {
    try {
      const now = new Date().toISOString();
      await updateNotice(notice.id, { status: 'published' });
      setMessage(`Notice "${notice.title}" published successfully.`);
      if (viewingNotice?.id === notice.id) {
        setViewingNotice((prev) =>
          prev ? { ...prev, status: 'published', publishedAt: now, published_at: now } : null
        );
      }
      loadNotices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to publish notice';
      setMessage(msg);
    }
  };

  const handleToggleStatus = async (notice: Notice) => {
    try {
      const newStatus = notice.status === 'draft' ? 'published' : 'draft';
      await updateNotice(notice.id, { status: newStatus });
      setMessage(`Notice ${newStatus === 'published' ? 'published' : 'moved to draft'} successfully`);
      if (viewingNotice?.id === notice.id) {
        setViewingNotice((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
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
      if (viewingNotice?.id === notice.id) {
        setViewingNotice((prev) =>
          prev
            ? {
                ...prev,
                recipientCounts: prev.recipientCounts
                  ? {
                      ...prev.recipientCounts,
                      acknowledged: prev.recipientCounts.acknowledged + 1,
                    }
                  : undefined,
              }
            : null
        );
      }
      loadNotices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to acknowledge notice';
      setMessage(msg);
    }
  };

  const renderPriorityBadge = (priority: string) => {
    const meta = {
      high: { label: 'High', className: styles.priorityHigh, icon: ExclamationTriangleIcon },
      medium: { label: 'Medium', className: styles.priorityMedium, icon: ClockIcon },
      low: { label: 'Low', className: styles.priorityLow, icon: InformationCircleIcon },
    }[priority] || { label: priority, className: styles.priorityLow, icon: InformationCircleIcon };

    const Icon = meta.icon;
    return (
      <span className={`${styles.priorityBadge} ${meta.className}`}>
        <Icon className={styles.priorityIcon} />
        <span>{meta.label}</span>
      </span>
    );
  };

  const renderStatusBadge = (status: string, onToggle?: () => void, canToggle?: boolean) => {
    if (status === 'published') {
      if (canToggle && onToggle) {
        return (
          <button
            type="button"
            className={`${styles.statusToggle} ${styles.statusPublished}`}
            onClick={onToggle}
            title="Click to move back to draft"
          >
            <CheckCircleIcon className={styles.statusIcon} />
            <span>Published</span>
          </button>
        );
      }
      return (
        <span className={`${styles.statusBadge} ${styles.statusPublished}`}>
          <CheckCircleIcon className={styles.statusIcon} />
          <span>Published</span>
        </span>
      );
    }
    if (status === 'archived') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusArchived}`}>
          <ArchiveBoxIcon className={styles.statusIcon} />
          <span>Archived</span>
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.statusDraft}`}>
        <DocumentTextIcon className={styles.statusIcon} />
        <span>Draft</span>
      </span>
    );
  };

  const canManageNotice = (notice: Notice) => {
    const isCreator =
      notice.createdBy === user?.id ||
      notice.created_by === user?.id ||
      (notice as any).creator_id === user?.id;
    return can('notices.manage') || isCreator;
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (row: Notice) => (
        <button
          type="button"
          className={styles.titleBtn}
          onClick={() => setViewingNotice(row)}
          title="Click to view details"
        >
          <span className={styles.titleText}>{row.title}</span>
          {row.category && (
            <span className={styles.categoryPill}>
              <TagIcon className={styles.categoryIcon} />
              <span>{row.category}</span>
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: Notice) => renderPriorityBadge(row.priority),
    },
    {
      key: 'targetAudience',
      label: 'Target / Department',
      render: (row: Notice) => {
        const aud = (row as any).target_audience || row.targetAudience || 'all';
        const dept = (row as any).department_name || row.departmentName;
        return (
          <div className={styles.targetCell}>
            <span className={styles.targetAudience}>
              <UserGroupIcon className={styles.targetIcon} />
              <span>{aud}</span>
            </span>
            {dept && (
              <span className={styles.targetDepartment} title={`Department: ${dept}`}>
                <BuildingOffice2Icon className={styles.targetIcon} />
                <span>{dept}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Notice) => {
        const canManage = canManageNotice(row);
        return renderStatusBadge(row.status, () => handleToggleStatus(row), canManage);
      },
    },
    {
      key: 'createdByName',
      label: 'Author',
      render: (row: Notice) => {
        const authorName = (row as any).creator_first_name
          ? `${(row as any).creator_first_name} ${(row as any).creator_last_name || ''}`
          : row.createdByName || 'System Admin';
        const role = (row as any).creator_role;
        return (
          <div className={styles.authorCell}>
            <span className={styles.authorName}>
              <UserCircleIcon className={styles.authorIcon} />
              <span>{authorName}</span>
            </span>
            {role && <span className={styles.authorRole}>({role})</span>}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      render: (row: Notice) => {
        const dateVal = row.createdAt || row.created_at;
        return (
          <span className={styles.expiresCell}>
            <CalendarDaysIcon className={styles.metaIcon} />
            <span>{dateVal ? new Date(dateVal).toLocaleDateString() : '—'}</span>
          </span>
        );
      },
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (row: Notice) => (
        <span className={styles.expiresCell}>
          <ClockIcon className={styles.metaIcon} />
          <span>{row.expiresAt || row.expires_at ? new Date((row.expiresAt || row.expires_at)!).toLocaleDateString() : 'Never'}</span>
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'recipients',
            label: 'Acknowledged',
            render: (row: Notice) =>
              row.recipientCounts ? (
                <div className={styles.ackCell}>
                  <span className={styles.ackCount}>
                    <CheckBadgeIcon className={styles.ackIcon} />
                    <span>
                      {row.recipientCounts.acknowledged}/{row.recipientCounts.total}
                    </span>
                  </span>
                  {row.recipientCounts.total > 0 && (
                    <div className={styles.ackProgressBar}>
                      <div
                        className={styles.ackProgressFill}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (row.recipientCounts.acknowledged / row.recipientCounts.total) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <span className={styles.date}>—</span>
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
                return (
                  <span className={`${styles.statusBadge} ${styles.statusPublished}`}>
                    <CheckCircleIcon className={styles.statusIcon} />
                    <span>Acknowledged</span>
                  </span>
                );
              }
              return (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnAcknowledge}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcknowledge(row);
                  }}
                >
                  <CheckCircleIcon className={styles.actionIcon} />
                  <span>Acknowledge</span>
                </button>
              );
            },
          },
        ]),
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Notice) => {
        const canManage = canManageNotice(row);
        return (
          <div className={styles.actionGroup}>
            {/* View action button — always available */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnView}`}
              title="View notice details"
              onClick={() => setViewingNotice(row)}
            >
              <EyeIcon className={styles.actionIcon} />
              <span>View</span>
            </button>

            {canManage && (
              <>
                {(row.status === 'draft' || row.status === 'archived') && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnPublish}`}
                    title="Publish notice to audience"
                    onClick={() => handlePublish(row)}
                  >
                    <PaperAirplaneIcon className={styles.actionIcon} />
                    <span>Publish</span>
                  </button>
                )}
                {row.status === 'published' && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDraft}`}
                    title="Revert notice back to draft"
                    onClick={() => handleToggleStatus(row)}
                  >
                    <ArrowPathIcon className={styles.actionIcon} />
                    <span>Draft</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                  title="Edit notice"
                  onClick={() => navigate(`/admin/notices/${row.id}/edit`)}
                >
                  <PencilSquareIcon className={styles.actionIcon} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  title="Delete notice"
                  onClick={() => setDeleteNoticeTarget(row)}
                >
                  <TrashIcon className={styles.actionIcon} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        );
      },
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
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <DataTable<Notice> loading={loading} data={notices} columns={columns} />

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

      {/* ── View Notice Details Modal ── */}
      {viewingNotice && (
        <Modal
          open={!!viewingNotice}
          title="Notice Details"
          onClose={() => setViewingNotice(null)}
          maxWidth="640px"
          footer={
            <div className={styles.modalFooterActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={() => setViewingNotice(null)}
              >
                Close
              </button>
              {canManageNotice(viewingNotice) && (
                <>
                  {(viewingNotice.status === 'draft' || viewingNotice.status === 'archived') && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnPublish}`}
                      onClick={() => {
                        const target = viewingNotice;
                        handlePublish(target);
                      }}
                    >
                      <PaperAirplaneIcon className={styles.actionIcon} />
                      <span>Publish Notice</span>
                    </button>
                  )}
                  {viewingNotice.status === 'published' && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDraft}`}
                      onClick={() => {
                        const target = viewingNotice;
                        handleToggleStatus(target);
                      }}
                    >
                      <ArrowPathIcon className={styles.actionIcon} />
                      <span>Move to Draft</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                    onClick={() => {
                      navigate(`/admin/notices/${viewingNotice.id}/edit`);
                    }}
                  >
                    <PencilSquareIcon className={styles.actionIcon} />
                    <span>Edit Notice</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                    onClick={() => {
                      const target = viewingNotice;
                      setViewingNotice(null);
                      setDeleteNoticeTarget(target);
                    }}
                  >
                    <TrashIcon className={styles.actionIcon} />
                    <span>Delete</span>
                  </button>
                </>
              )}
              {!isAdmin &&
                viewingNotice.status === 'published' &&
                !acknowledgedIds.has(viewingNotice.id) && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnAcknowledge}`}
                    onClick={() => {
                      handleAcknowledge(viewingNotice);
                    }}
                  >
                    <CheckCircleIcon className={styles.actionIcon} />
                    <span>Acknowledge Notice</span>
                  </button>
                )}
            </div>
          }
        >
          <div className={styles.detailContainer}>
            <div className={styles.detailHeaderBadges}>
              {renderPriorityBadge(viewingNotice.priority)}
              {renderStatusBadge(viewingNotice.status)}
              <span className={styles.categoryPill}>
                <UserGroupIcon className={styles.categoryIcon} />
                <span>
                  Target:{' '}
                  <strong style={{ textTransform: 'capitalize' }}>
                    {(viewingNotice as any).target_audience || viewingNotice.targetAudience || 'all'}
                  </strong>
                </span>
              </span>
              {viewingNotice.category && (
                <span className={styles.categoryPill}>
                  <TagIcon className={styles.categoryIcon} />
                  <span>{viewingNotice.category}</span>
                </span>
              )}
            </div>

            <h3 className={styles.detailNoticeTitle}>{viewingNotice.title}</h3>

            <div className={styles.detailMetaGrid}>
              <div className={styles.detailMetaCard}>
                <span className={styles.detailMetaLabel}>
                  <UserCircleIcon className={styles.metaIcon} />
                  Author
                </span>
                <span className={styles.detailMetaValue}>
                  {(viewingNotice as any).creator_first_name
                    ? `${(viewingNotice as any).creator_first_name} ${
                        (viewingNotice as any).creator_last_name || ''
                      }`
                    : viewingNotice.createdByName || 'System Admin'}
                  {(viewingNotice as any).creator_role && ` (${(viewingNotice as any).creator_role})`}
                </span>
              </div>

              <div className={styles.detailMetaCard}>
                <span className={styles.detailMetaLabel}>
                  <CalendarDaysIcon className={styles.metaIcon} />
                  Created Date
                </span>
                <span className={styles.detailMetaValue}>
                  {viewingNotice.createdAt || viewingNotice.created_at
                    ? new Date((viewingNotice.createdAt || viewingNotice.created_at)!).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>

              {(viewingNotice.publishedAt || viewingNotice.published_at || viewingNotice.status === 'published') && (
                <div className={styles.detailMetaCard}>
                  <span className={styles.detailMetaLabel}>
                    <PaperAirplaneIcon className={styles.metaIcon} />
                    Published Time
                  </span>
                  <span className={styles.detailMetaValue}>
                    {viewingNotice.publishedAt || viewingNotice.published_at
                      ? new Date((viewingNotice.publishedAt || viewingNotice.published_at)!).toLocaleString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : viewingNotice.createdAt || viewingNotice.created_at
                        ? new Date((viewingNotice.createdAt || viewingNotice.created_at)!).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                  </span>
                </div>
              )}

              <div className={styles.detailMetaCard}>
                <span className={styles.detailMetaLabel}>
                  <ClockIcon className={styles.metaIcon} />
                  Expires
                </span>
                <span className={styles.detailMetaValue}>
                  {viewingNotice.expiresAt || viewingNotice.expires_at
                    ? new Date((viewingNotice.expiresAt || viewingNotice.expires_at)!).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>

              {((viewingNotice as any).department_name || viewingNotice.departmentName) && (
                <div className={styles.detailMetaCard}>
                  <span className={styles.detailMetaLabel}>
                    <BuildingOffice2Icon className={styles.metaIcon} />
                    Department
                  </span>
                  <span className={styles.detailMetaValue}>
                    {(viewingNotice as any).department_name || viewingNotice.departmentName}
                  </span>
                </div>
              )}

              {viewingNotice.recipientCounts && (
                <div className={styles.detailMetaCard}>
                  <span className={styles.detailMetaLabel}>
                    <CheckBadgeIcon className={styles.metaIcon} />
                    Acknowledgements
                  </span>
                  <span className={styles.detailMetaValue}>
                    {viewingNotice.recipientCounts.acknowledged} /{' '}
                    {viewingNotice.recipientCounts.total}
                    {viewingNotice.recipientCounts.total > 0 &&
                      ` (${Math.round(
                        (viewingNotice.recipientCounts.acknowledged /
                          viewingNotice.recipientCounts.total) *
                          100
                      )}%)`}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.detailContentCard}>
              <h4 className={styles.detailContentTitle}>Notice Content</h4>
              <p className={styles.detailContentText}>
                {viewingNotice.description || 'No description provided.'}
              </p>
            </div>

            {(viewingNotice.attachment || viewingNotice.image) && (
              <div className={styles.detailAttachmentCard}>
                <div className={styles.detailAttachmentInfo}>
                  <DocumentTextIcon className={styles.actionIcon} />
                  <span className={styles.detailAttachmentName}>
                    {viewingNotice.attachmentName || 'Notice Attachment'}
                  </span>
                </div>
                <a
                  href={buildAttachmentUrl(viewingNotice.attachment || viewingNotice.image)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.detailAttachmentBtn}
                >
                  <ArrowDownTrayIcon className={styles.actionIcon} />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteNoticeTarget && (
        <Modal
          open={!!deleteNoticeTarget}
          title="Delete Notice"
          onClose={() => setDeleteNoticeTarget(null)}
          maxWidth="460px"
          footer={
            <div className={styles.modalFooterActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={() => setDeleteNoticeTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                onClick={confirmDelete}
              >
                <TrashIcon className={styles.actionIcon} />
                <span>Delete Notice</span>
              </button>
            </div>
          }
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.95rem',
              color: 'var(--text-primary, #334155)',
              lineHeight: 1.5,
            }}
          >
            Are you sure you want to delete notice{' '}
            <strong>"{deleteNoticeTarget.title}"</strong>? This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
