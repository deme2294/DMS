import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { getMyNotices, acknowledgeNotice, getNoticeReplies, createNoticeReply, deleteNoticeReply } from '../../api/noticeApi';
import { buildAttachmentUrl } from '../../utils/attachmentUtils';
import styles from './Notices.module.css';

interface Notice {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  target_audience: string;
  department_name: string | null;
  creatorName: string;
  creator_role: string;
  assignedToName: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  created_at: string;
  createdAt?: string;
  published_at?: string | null;
  publishedAt?: string | null;
  expires_at: string | null;
}

interface Reply {
  id: string;
  noticeId: string;
  userId: string;
  userName: string;
  userRole: string;
  message: string;
  visibility: string;
  isInternal: boolean;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function TenantNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<'all' | 'internal'>('all');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      
      const res = await getMyNotices(params);
      setNotices(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async (noticeId: string) => {
    setLoadingReplies(true);
    try {
      const res = await getNoticeReplies(noticeId);
      setReplies(res.data.data || []);
    } catch (error) {
      console.error('Failed to load replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [page, search]);

  const handleAcknowledge = async (noticeId: string) => {
    try {
      await acknowledgeNotice(noticeId);
      loadNotices();
    } catch (error) {
      console.error('Failed to acknowledge notice:', error);
    }
  };

  const handleViewReplies = async (noticeId: string) => {
    setSelectedNoticeId(noticeId);
    await loadReplies(noticeId);
  };

  const handleCloseReplies = () => {
    setSelectedNoticeId(null);
    setReplies([]);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoticeId || !replyMessage.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      await createNoticeReply(selectedNoticeId, {
        message: replyMessage.trim(),
        visibility: replyVisibility,
      });
      setReplyMessage('');
      setReplyVisibility('all');
      await loadReplies(selectedNoticeId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await deleteNoticeReply(replyId);
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete reply');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: styles.badgeLow,
      medium: styles.badgeMedium,
      high: styles.badgeHigh,
    };
    return badges[priority as keyof typeof badges] || badges.medium;
  };

  const getCreatorLabel = (creatorRole: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      ceo: 'CEO',
    };
    return labels[creatorRole] || 'System';
  };

  const selectedNotice = notices.find((n) => n.id === selectedNoticeId);

  const filteredNotices = notices.filter((notice) => {
    if (filter === 'unread') return !notice.isAcknowledged;
    if (filter === 'read') return notice.isAcknowledged;
    return true;
  });

  return (
    <div className={styles.page}>
      <PageHeader
        title="My Notices"
        description="View notices and announcements targeted to you"
      />

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search notices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="all">All Notices</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading notices...</div>
      ) : filteredNotices.length === 0 && !selectedNoticeId ? (
        <div className={styles.empty}>
          <p>No notices found</p>
        </div>
      ) : (
        <div className={styles.noticesList}>
          {filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`${styles.noticeCard} ${
                !notice.isAcknowledged ? styles.unread : ''
              } ${selectedNoticeId === notice.id ? styles.selected : ''}`}
            >
              <div className={styles.noticeHeader}>
                <h3 className={styles.noticeTitle}>{notice.title}</h3>
                <div className={styles.noticeMeta}>
                  <span className={`${styles.badge} ${getPriorityBadge(notice.priority)}`}>
                    {notice.priority}
                  </span>
                  {!notice.isAcknowledged && (
                    <span className={styles.badgeUnread}>NEW</span>
                  )}
                </div>
              </div>

              <div className={styles.noticeBody}>
                <p className={styles.noticeDescription}>{notice.description}</p>
              </div>

              <div className={styles.noticeFooter}>
                <div className={styles.noticeInfo}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>From:</span>
                    <span className={styles.infoValue}>
                      {(notice as any).creator_first_name
                        ? `${(notice as any).creator_first_name} ${(notice as any).creator_last_name || ''}`.trim()
                        : (notice.creatorName || (notice as any).createdByName || 'System')} ({getCreatorLabel((notice as any).creator_role || notice.creator_role)})
                    </span>
                  </div>

                  {notice.department_name && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Department:</span>
                      <span className={styles.infoValue}>{notice.department_name}</span>
                    </div>
                  )}

                  {notice.assignedToName && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Assigned to:</span>
                      <span className={styles.infoValue}>{notice.assignedToName}</span>
                    </div>
                  )}

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Published:</span>
                    <span className={styles.infoValue}>
                      {notice.published_at || notice.publishedAt || notice.created_at || notice.createdAt
                        ? new Date((notice.published_at || notice.publishedAt || notice.created_at || notice.createdAt)!).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>

                  {(notice.created_at || notice.createdAt) && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Created:</span>
                      <span className={styles.infoValue}>
                        {new Date((notice.created_at || notice.createdAt)!).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  {notice.expires_at && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Expires:</span>
                      <span className={styles.infoValue}>
                        {new Date(notice.expires_at).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.noticeActions}>
                  {notice.isAcknowledged ? (
                    <span className={styles.acknowledgedLabel}>
                      ✓ Acknowledged on{' '}
                      {new Date(notice.acknowledgedAt!).toLocaleDateString()}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(notice.id)}
                      className={styles.btnAcknowledge}
                    >
                      Mark as Read
                    </button>
                  )}
                  <button
                    onClick={() => handleViewReplies(notice.id)}
                    className={styles.btnSecondary}
                  >
                    💬 Replies
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && !selectedNoticeId && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={styles.paginationBtn}
          >
            Previous
          </button>
          <span className={styles.paginationInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={styles.paginationBtn}
          >
            Next
          </button>
        </div>
      )}

      {/* Replies Modal */}
      {selectedNoticeId && selectedNotice && (
        <div className={styles.modalOverlay} onClick={handleCloseReplies}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Replies: {selectedNotice.title}</h2>
              <button className={styles.closeBtn} onClick={handleCloseReplies}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {loadingReplies ? (
                <div className={styles.loading}>Loading replies...</div>
              ) : replies.length === 0 ? (
                <div className={styles.empty}>
                  <p>No replies yet</p>
                </div>
              ) : (
                <div className={styles.repliesList}>
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`${styles.replyItem} ${reply.isInternal ? styles.internalReply : styles.publicReply}`}
                    >
                      <div className={styles.replyHeader}>
                        <strong>{reply.userName}</strong>
                        <span className={`${styles.badge} ${reply.isInternal ? styles.badgeLow : styles.badgePublished}`}>
                          {reply.isInternal ? '🔒 Internal' : '📢 Public'}
                        </span>
                        <span className={styles.replyTime}>
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className={styles.replyMessage}>{reply.message}</p>
                      {reply.attachmentPath && (
                        <div className={styles.replyAttachment}>
                          📎{' '}
                          <a
                            href={buildAttachmentUrl(reply.attachmentPath)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {reply.attachmentName || 'Attachment'}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Form */}
              <form className={styles.replyForm} onSubmit={handleSubmitReply}>
                <div className={styles.formGroup}>
                  <label>Your Reply</label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Write your reply..."
                    rows={3}
                    className={styles.textarea}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Visibility</label>
                    <select
                      value={replyVisibility}
                      onChange={(e) => setReplyVisibility(e.target.value as 'all' | 'internal')}
                      className={styles.select}
                    >
                      <option value="all">Public (Visible to all)</option>
                      <option value="internal">Internal (Staff/Managers only)</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleCloseReplies}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={!replyMessage.trim() || submittingReply}
                  >
                    {submittingReply ? 'Submitting...' : 'Submit Reply'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}