import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  getMyNotices,
  getMyCreatedNotices,
  createTargetedNotice,
  getAssignableNotices,
  assignNoticeToStaff,
  getDepartmentStaff,
  getMyDepartments,
  acknowledgeNotice,
  getNoticeReplies,
  createNoticeReply,
  deleteNoticeReply,
} from '../../api/noticeApi';
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
  expires_at: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
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

export default function ManagerNotices() {
  const [activeTab, setActiveTab] = useState<'notices' | 'create' | 'created'>('notices');

  // Combined notices state (inbox + assignable from admin)
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Created notices state
  const [createdNotices, setCreatedNotices] = useState<any[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(false);
  const [createdPage, setCreatedPage] = useState(1);
  const [createdTotalPages, setCreatedTotalPages] = useState(1);

  // Staff members for assignment
  const [staff, setStaff] = useState<StaffMember[]>([]);

  // Manager departments
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Create notice form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    targetAudience: 'staff',
    departmentId: '',
    assignedTo: '',
    expiresAt: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Replies state
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<'all' | 'internal'>('all');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('managerNoticeBookmarks');
      if (stored) {
        setBookmarks(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleBookmark = (noticeId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(noticeId)) {
        next.delete(noticeId);
      } else {
        next.add(noticeId);
      }
      localStorage.setItem('managerNoticeBookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  // Load combined notices (inbox + assignable from admin)
  const loadNotices = async () => {
    setLoading(true);
    try {
      const [inboxRes, assignableRes, staffRes, deptRes] = await Promise.all([
        getMyNotices({ page, limit: 20 }),
        getAssignableNotices({ page: 1, limit: 50 }),
        getDepartmentStaff(),
        getMyDepartments(),
      ]);

      const inboxNotices = inboxRes.data.data || [];
      const assignableNotices = assignableRes.data.data || [];
      
      const allNotices = [...inboxNotices];
      
      assignableNotices.forEach((notice: Notice) => {
        if (!allNotices.find(n => n.id === notice.id)) {
          allNotices.push({ ...notice, isAssignable: true } as any);
        }
      });

      const loadedDepts = deptRes.data.data || [];
      setNotices(allNotices);
      setStaff(staffRes.data.data || []);
      setDepartments(loadedDepts);
      if (loadedDepts.length === 1 && !formData.departmentId) {
        setFormData((prev) => ({ ...prev, departmentId: loadedDepts[0].id }));
      }
      setTotalPages(inboxRes.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = async (deptId: string) => {
    setFormData((prev) => ({ ...prev, departmentId: deptId, assignedTo: '' }));
    if (deptId) {
      try {
        const res = await getDepartmentStaff(deptId);
        setStaff(res.data.data || []);
      } catch (err) {
        console.error('Failed to load staff for department:', err);
      }
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
    if (activeTab === 'notices') {
      loadNotices();
    } else if (activeTab === 'created') {
      loadCreatedNotices();
    }
  }, [activeTab, page, createdPage]);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const chosenDeptId = formData.departmentId || (departments.length === 1 ? departments[0].id : undefined);
      const payload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        targetAudience: formData.targetAudience,
        status: 'published',
        ...(chosenDeptId ? { departmentId: chosenDeptId } : {}),
        ...(formData.assignedTo ? { assignedTo: formData.assignedTo } : {}),
        ...(formData.expiresAt ? { expiresAt: formData.expiresAt } : {}),
      };
      await createTargetedNotice(payload);
      alert('Notice created and routed to staff team successfully!');
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        targetAudience: 'staff',
        departmentId: departments.length === 1 ? departments[0].id : '',
        assignedTo: '',
        expiresAt: '',
      });
      setActiveTab('notices');
      loadNotices();
    } catch (error: any) {
      const errs = error.response?.data?.errors;
      alert(errs?.[0]?.msg || error.response?.data?.message || 'Failed to create notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignNotice = async (noticeId: string, staffUserId: string) => {
    try {
      await assignNoticeToStaff(noticeId, staffUserId);
      alert('Notice assigned successfully!');
      loadNotices();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign notice');
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

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: styles.badgeLow,
      medium: styles.badgeMedium,
      high: styles.badgeHigh,
    };
    return badges[priority as keyof typeof badges] || badges.medium;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: styles.badgeDraft,
      published: styles.badgePublished,
      archived: styles.badgeArchived,
    };
    return badges[status] || styles.badgeDraft;
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

  return (
    <div className={styles.page}>
      <PageHeader
        title="Manager Notices"
        description="View notices from Admin, create notices for your team, and assign to staff"
      />

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'notices' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('notices')}
        >
          📬 Notices & Assignments
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('created')}
        >
          📝 My Created Notices
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Notice
        </button>
      </div>

      {/* NOTICES & ASSIGNMENTS TAB */}
      {activeTab === 'notices' && (
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}>Loading notices...</div>
          ) : notices.length === 0 ? (
            <div className={styles.empty}>
              <p>No notices found</p>
            </div>
          ) : (
            <>
              <div className={styles.noticesList}>
                {notices.map((notice: any) => {
                  const isFromAdmin = notice.creator_role === 'admin';
                  const canAssign = isFromAdmin && staff.length > 0;

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
                            <span className={styles.infoLabel}>Date:</span>
                            <span className={styles.infoValue}>
                              {new Date(notice.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {notice.expires_at && (
                            <div className={styles.infoItem}>
                              <span className={styles.infoLabel}>Expires:</span>
                              <span className={styles.infoValue}>
                                {new Date(notice.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className={styles.noticeActions}>
                          {/* Acknowledgment button */}
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

                          {/* Assignment dropdown for admin notices */}
                          {canAssign && (
                            <div className={styles.assignSection}>
                              <select
                                className={styles.select}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignNotice(notice.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">Assign to staff...</option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

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
        </div>
      )}

      {/* MY CREATED NOTICES TAB */}
      {activeTab === 'created' && (
        <div className={styles.tabContent}>
          {loadingCreated ? (
            <div className={styles.loading}>Loading created notices...</div>
          ) : createdNotices.length === 0 ? (
            <div className={styles.empty}>
              <p>You haven't created any notices yet</p>
            </div>
          ) : (
            <>
              <div className={styles.noticesList}>
                {createdNotices.map((notice: any) => {
                  const isBookmarked = bookmarks.has(notice.id);
                  const rc = notice.recipientCounts || { total: 0, acknowledged: 0 };
                  const readLabel = rc.total > 0 ? `${rc.acknowledged}/${rc.total} read` : 'No recipients';

                  return (
                    <div
                      key={notice.id}
                      className={`${styles.noticeCard} ${selectedNoticeId === notice.id ? styles.selected : ''}`}
                    >
                      <div className={styles.noticeHeader}>
                        <div>
                          <h3 className={styles.noticeTitle}>{notice.title}</h3>
                          <div className={styles.noticeMeta} style={{ marginTop: 8 }}>
                            <span className={`${styles.badge} ${getStatusBadge(notice.status)}`}>
                              {notice.status || 'draft'}
                            </span>
                            <span className={`${styles.badge} ${getPriorityBadge(notice.priority)}`}>
                              {notice.priority}
                            </span>
                            {notice.replyCount > 0 && (
                              <span className={`${styles.badge} ${styles.badgeLow}`}>
                                💬 {notice.replyCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleBookmark(notice.id)}
                          className={styles.bookmarkBtn}
                          title={isBookmarked ? 'Remove bookmark' : 'Remember notice'}
                        >
                          {isBookmarked ? '🔖' : '📑'}
                        </button>
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
                            <span className={styles.infoLabel}>Date:</span>
                            <span className={styles.infoValue}>
                              {new Date(notice.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {notice.expires_at && (
                            <div className={styles.infoItem}>
                              <span className={styles.infoLabel}>Expires:</span>
                              <span className={styles.infoValue}>
                                {new Date(notice.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Read status:</span>
                            <span className={styles.infoValue}>{readLabel}</span>
                          </div>
                        </div>

                        <div className={styles.noticeActions}>
                          <button
                            onClick={() => handleViewReplies(notice.id)}
                            className={styles.btnSecondary}
                          >
                            💬 Replies
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {createdTotalPages > 1 && !selectedNoticeId && (
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
            </>
          )}
        </div>
      )}

      {/* CREATE NOTICE TAB */}
      {activeTab === 'create' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Create Notice for Staff Team</h2>
            <p>
              Notices created here route directly to staff members in your department. (Notices for other departments are managed and published by Admin).
            </p>
          </div>

          <form onSubmit={handleCreateNotice} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={styles.input}
                placeholder="Enter notice title"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={styles.textarea}
                rows={4}
                placeholder="Enter notice content for staff..."
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value as any })
                  }
                  className={styles.select}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Target Audience</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className={styles.select}
                >
                  <option value="staff">Staff Team (My Department)</option>
                  <option value="department">All Department Members</option>
                </select>
              </div>

              {departments.length > 1 ? (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Department *</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className={styles.select}
                    required
                  >
                    <option value="">Select department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : departments.length === 1 ? (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Department</label>
                  <input
                    type="text"
                    readOnly
                    value={departments[0].name}
                    className={styles.input}
                    style={{ background: 'var(--bg-secondary, #f3f4f6)', cursor: 'not-allowed' }}
                  />
                </div>
              ) : null}

              <div className={styles.formGroup}>
                <label className={styles.label}>Direct Staff Assignment (Optional)</label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className={styles.select}
                >
                  <option value="">All Staff in Department</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
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
            </div>

            <p className={styles.hint} style={{ marginTop: 8, fontSize: '0.85rem', color: '#6b7280' }}>
              💡 This notice will be immediately delivered to the staff in your department. Staff will receive notifications and will be able to acknowledge and reply.
            </p>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.btnSubmit}
              >
                {submitting ? 'Publishing...' : '🚀 Create & Route to Staff Team'}
              </button>
            </div>
          </form>
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