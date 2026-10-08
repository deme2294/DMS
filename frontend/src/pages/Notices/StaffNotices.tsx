import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  getMyNotices,
  getMyCreatedNotices,
  createTargetedNotice,
  acknowledgeNotice,
  getNoticeReplies,
  createNoticeReply,
  deleteNoticeReply,
  updateNotice,
  deleteNotice,
} from '../../api/noticeApi';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
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
  created_by?: string;
  assignedToName: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  created_at: string;
  createdAt?: string;
  published_at?: string | null;
  publishedAt?: string | null;
  expires_at: string | null;
  replyCount?: number;
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

export default function StaffNotices() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'create' | 'sent'>('inbox');

  // Inbox notices
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Sent / Created notices
  const [createdNotices, setCreatedNotices] = useState<any[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(false);
  const [createdPage, setCreatedPage] = useState(1);
  const [createdTotalPages, setCreatedTotalPages] = useState(1);

  // Create notice form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    expiresAt: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Replies
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<'all' | 'internal'>('all');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const { user } = useAuth();

  // Central feedback alert state
  const [centerAlert, setCenterAlert] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Delete notice modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit notice modal state
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    expiresAt: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  const loadCreatedNotices = async () => {
    setLoadingCreated(true);
    try {
      const res = await getMyCreatedNotices({ page: createdPage, limit: 10 });
      setCreatedNotices(res.data.data || []);
      setCreatedTotalPages(res.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load created notices:', error);
    } finally {
      setLoadingCreated(false);
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
    if (activeTab === 'inbox') {
      loadNotices();
    } else if (activeTab === 'sent') {
      loadCreatedNotices();
    }
  }, [activeTab, page, search, createdPage]);

  const handleCreateNoticeToHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTargetedNotice({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        targetAudience: 'manager',
        status: 'published',
        ...(formData.expiresAt ? { expiresAt: formData.expiresAt } : {}),
      });
      alert('Notice submitted successfully and routed to your Department Head!');
      setFormData({ title: '', description: '', priority: 'medium', expiresAt: '' });
      setActiveTab('sent');
      loadCreatedNotices();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to submit notice';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleOpenEdit = (notice: any) => {
    let formattedExpiresAt = '';
    if (notice.expires_at) {
      try {
        const d = new Date(notice.expires_at);
        formattedExpiresAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      } catch {
        formattedExpiresAt = '';
      }
    }

    setEditFormData({
      title: notice.title || '',
      description: notice.description || '',
      priority: (notice.priority as any) || 'medium',
      expiresAt: formattedExpiresAt,
    });
    setEditTarget(notice);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || savingEdit) return;

    setSavingEdit(true);
    try {
      await updateNotice(editTarget.id, {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        priority: editFormData.priority,
        expiresAt: editFormData.expiresAt ? new Date(editFormData.expiresAt).toISOString() : null,
      });

      setEditTarget(null);
      await loadNotices();
      await loadCreatedNotices();
      setCenterAlert({
        title: 'Notice Updated',
        message: `Notice "${editFormData.title}" has been updated successfully.`,
        type: 'success',
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update notice';
      setCenterAlert({
        title: 'Update Failed',
        message: msg,
        type: 'error',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDelete = (notice: any) => {
    setDeleteTarget(notice);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      await deleteNotice(deleteTarget.id);
      const deletedTitle = deleteTarget.title;
      setDeleteTarget(null);
      await loadNotices();
      await loadCreatedNotices();
      setCenterAlert({
        title: 'Notice Deleted',
        message: `Notice "${deletedTitle}" was deleted successfully.`,
        type: 'success',
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete notice';
      setCenterAlert({
        title: 'Delete Failed',
        message: msg,
        type: 'error',
      });
    } finally {
      setDeleting(false);
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
      manager: 'Department Head',
      staff: 'Staff',
      ceo: 'CEO',
    };
    return labels[creatorRole] || 'System';
  };

  const selectedNotice =
    notices.find((n) => n.id === selectedNoticeId) ||
    createdNotices.find((n) => n.id === selectedNoticeId);

  const isExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() <= Date.now();
  };

  const filteredNotices = notices.filter((notice) => {
    if (isExpired(notice.expires_at)) return false;
    if (filter === 'unread') return !notice.isAcknowledged;
    if (filter === 'read') return notice.isAcknowledged;
    return true;
  });

  const visibleCreatedNotices = createdNotices.filter((n) => !isExpired(n.expires_at));

  return (
    <div className={styles.page}>
      <PageHeader
        title="Staff Notices"
        description="View department announcements, receive delegated notices, or submit notices to your Department Head"
      />

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'inbox' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inbox')}
        >
          <span className={styles.tabIcon}>📬</span>
          <span className={styles.tabText}>Notices &amp; Assignments</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <span className={styles.tabIcon}>➕</span>
          <span className={styles.tabText}>Notice to Department Head</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sent' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          <span className={styles.tabIcon}>📝</span>
          <span className={styles.tabText}>Sent to Department Head</span>
        </button>
      </div>

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <>
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
              <p>No notices found in your inbox</p>
            </div>
          ) : (
            <div className={styles.noticesList}>
              {filteredNotices.map((notice) => {
                const isFromAdmin = notice.creator_role === 'admin';
                const isFromManager = notice.creator_role === 'manager';

                return (
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
                        {isFromAdmin && (
                          <span className={`${styles.badge} ${styles.badgeLow}`}>
                            From Admin
                          </span>
                        )}
                        {isFromManager && (
                          <span className={styles.badgeTargetManager}>
                            From Department Head
                          </span>
                        )}
                        {notice.assignedToName && (
                          <span className={styles.badgeAssigned}>
                            👤 Delegated to You
                          </span>
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
                            {notice.creatorName} ({getCreatorLabel(notice.creator_role)})
                          </span>
                        </div>

                        {notice.department_name && (
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Department:</span>
                            <span className={styles.infoValue}>{notice.department_name}</span>
                          </div>
                        )}

                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Published:</span>
                          <span className={styles.infoValue}>
                            {notice.published_at || (notice as any).publishedAt || notice.created_at || (notice as any).createdAt
                              ? new Date(notice.published_at || (notice as any).publishedAt || notice.created_at || (notice as any).createdAt).toLocaleString([], {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </span>
                        </div>

                        {notice.expires_at && (
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Expires:</span>
                            <span className={styles.infoValue} style={{ color: '#dc2626', fontWeight: 600 }}>
                              ⏳ {new Date(notice.expires_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className={styles.noticeActions}>
                        {notice.isAcknowledged ? (
                          <span className={styles.acknowledgedLabel}>
                            ✓ Acknowledged
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

                        {/* Edit and Delete if notice created by this user */}
                        {((notice as any).created_by === user?.id || (notice as any).creator_id === user?.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(notice)}
                              className={styles.btnEdit}
                              title="Edit this notice"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(notice)}
                              className={styles.btnDelete}
                              title="Delete this notice"
                            >
                              🗑️ Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        </>
      )}

      {/* CREATE NOTICE TO DEPARTMENT HEAD TAB */}
      {activeTab === 'create' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Submit Notice to Department Head</h2>
            <p>
              Submit an internal notice, coordination update, or urgent query directly to your Department Head.
            </p>
          </div>

          <div className={styles.infoNoticeBox}>
            <div className={styles.infoNoticeIcon}>🏛️</div>
            <div className={styles.infoNoticeContent}>
              <h4 className={styles.infoNoticeTitle}>Automatic Department Head Routing</h4>
              <p className={styles.infoNoticeText}>
                This notice is automatically routed to your assigned Department Head (Manager) and published to their inbox for review and direct action.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateNoticeToHead} className={styles.form}>
            <div className={styles.formCardHeader}>
              <h3>Notice Details</h3>
              <p>Compose an official notice or update for your department supervisor.</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Notice Title <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={styles.input}
                placeholder="Enter summary or subject of notice"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Notice Details &amp; Message <span className={styles.requiredStar}>*</span>
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={styles.textarea}
                rows={5}
                placeholder="Describe the update, question, or issue for your Department Head in detail..."
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Priority Level</label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value as any })
                  }
                  className={styles.select}
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority (Normal)</option>
                  <option value="high">🔴 High Priority / Urgent</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Target Destination</label>
                <div className={styles.readOnlyFieldWrapper}>
                  <input
                    type="text"
                    readOnly
                    value="🏛️ Department Head (Automated Route)"
                    className={`${styles.input} ${styles.readOnlyInput}`}
                  />
                  <span className={styles.lockBadge}>Auto-routed</span>
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Expires At (Optional)</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.btnSubmit}
              >
                {submitting ? (
                  <>
                    <span className={styles.btnSpinner} /> Submitting...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Submit Notice to Department Head
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SENT TO DEPARTMENT HEAD TAB */}
      {activeTab === 'sent' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Notices Sent to Department Head</h2>
            <p>
              View notices and messages you have submitted to your Department Head, along with replies and status.
            </p>
          </div>

          {loadingCreated ? (
            <div className={styles.loading}>Loading sent notices...</div>
          ) : visibleCreatedNotices.length === 0 ? (
            <div className={styles.empty}>
              <p>You haven't sent any active notices to your Department Head yet.</p>
            </div>
          ) : (
            <div className={styles.noticesList}>
              {visibleCreatedNotices.map((notice: any) => (
                <div
                  key={notice.id}
                  className={`${styles.noticeCard} ${
                    selectedNoticeId === notice.id ? styles.selected : ''
                  }`}
                >
                  <div className={styles.noticeHeader}>
                    <div>
                      <h3 className={styles.noticeTitle}>{notice.title}</h3>
                      <div className={styles.noticeMeta} style={{ marginTop: 8 }}>
                        <span className={`${styles.badge} ${getPriorityBadge(notice.priority)}`}>
                          {notice.priority}
                        </span>
                        <span className={styles.badgeTargetManager}>
                          To: Department Head
                        </span>
                        {notice.reply_count > 0 && (
                          <span className={`${styles.badge} ${styles.badgeLow}`}>
                            💬 {notice.reply_count} Replies
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.noticeBody}>
                    <p className={styles.noticeDescription}>{notice.description}</p>
                  </div>

                  <div className={styles.noticeFooter}>
                    <div className={styles.noticeInfo}>
                      {notice.department_name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Department:</span>
                          <span className={styles.infoValue}>{notice.department_name}</span>
                        </div>
                      )}
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Sent Date:</span>
                        <span className={styles.infoValue}>
                          {new Date(notice.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {notice.expires_at && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Expires:</span>
                          <span className={styles.infoValue} style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⏳ {new Date(notice.expires_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.noticeActions}>
                      <button
                        onClick={() => handleViewReplies(notice.id)}
                        className={styles.btnSecondary}
                      >
                        💬 View Discussion ({notice.reply_count || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(notice)}
                        className={styles.btnEdit}
                        title="Edit this notice"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(notice)}
                        className={styles.btnDelete}
                        title="Delete this notice"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {createdTotalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCreatedPage((p) => Math.max(1, p - 1))}
                disabled={createdPage <= 1}
                className={styles.paginationBtn}
              >
                Previous
              </button>
              <span className={styles.paginationInfo}>
                Page {createdPage} of {createdTotalPages}
              </span>
              <button
                onClick={() => setCreatedPage((p) => Math.min(createdTotalPages, p + 1))}
                disabled={createdPage >= createdTotalPages}
                className={styles.paginationBtn}
              >
                Next
              </button>
            </div>
          )}
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
                <div className={styles.emptyReplies}>
                  <p>No replies yet. Start the conversation!</p>
                </div>
              ) : (
                <div className={styles.repliesList}>
                  {replies.map((reply) => (
                    <div key={reply.id} className={styles.replyCard}>
                      <div className={styles.replyHeader}>
                        <div className={styles.replyAuthor}>
                          <strong>{reply.userName}</strong>
                          <span className={styles.roleTag}>({reply.userRole})</span>
                        </div>
                        <div className={styles.replyMeta}>
                          <span className={styles.replyTime}>
                            {new Date(reply.createdAt).toLocaleString()}
                          </span>
                          {reply.isInternal && (
                            <span className={styles.internalBadge}>Internal</span>
                          )}
                          <button
                            onClick={() => handleDeleteReply(reply.id)}
                            className={styles.deleteBtn}
                            title="Delete reply"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className={styles.replyMessage}>
                        <p>{reply.message}</p>
                      </div>

                      {reply.attachmentPath && (
                        <div className={styles.replyAttachment}>
                          <span className={styles.attachmentIcon}>📎</span>
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

      {/* ── Edit Notice Modal ── */}
      {editTarget && (
        <Modal
          open={Boolean(editTarget)}
          title={`Edit Notice: ${editTarget.title}`}
          maxWidth="600px"
          onClose={() => !savingEdit && setEditTarget(null)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEditTarget(null)}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving Changes...' : '💾 Save Changes'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveEdit} className={styles.form} style={{ padding: 0 }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title *</label>
              <input
                type="text"
                required
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className={styles.input}
                placeholder="Notice title"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description *</label>
              <textarea
                required
                rows={4}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className={styles.textarea}
                placeholder="Notice content..."
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Priority</label>
                <select
                  value={editFormData.priority}
                  onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value as any })}
                  className={styles.select}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Expiration Date &amp; Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={editFormData.expiresAt}
                  onChange={(e) => setEditFormData({ ...editFormData, expiresAt: e.target.value })}
                  className={styles.input}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteTarget && (
        <Modal
          open={Boolean(deleteTarget)}
          title="Delete Notice"
          maxWidth="460px"
          onClose={() => !deleting && setDeleteTarget(null)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnDeleteConfirm}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : '🗑️ Delete Notice'}
              </button>
            </div>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
              Are you sure you want to permanently delete <strong>"{deleteTarget.title}"</strong>?
            </p>
            <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748b' }}>
              This notice and all associated discussion replies will be deleted.
            </p>
          </div>
        </Modal>
      )}

      {/* ── Centered Alert Feedback Modal / Toast ── */}
      {centerAlert && (
        <div className={styles.centerAlertOverlay} onClick={() => setCenterAlert(null)}>
          <div
            className={styles.centerAlertCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.centerAlertIcon}>
              {centerAlert.type === 'success' ? '✅' : centerAlert.type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div className={styles.centerAlertContent}>
              <h4 className={styles.centerAlertTitle}>{centerAlert.title}</h4>
              <p className={styles.centerAlertMessage}>{centerAlert.message}</p>
            </div>
            <button
              className={styles.centerAlertClose}
              onClick={() => setCenterAlert(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}