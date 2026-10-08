import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  getMyNotices,
  getMyCreatedNotices,
  createTargetedNotice,
  getAssignableNotices,
  assignNoticeToStaff,
  routeNoticeToAdmin,
  getDepartmentStaff,
  getMyDepartments,
  acknowledgeNotice,
  getNoticeReplies,
  createNoticeReply,
  deleteNoticeReply,
  updateNoticeExpiry,
  updateNotice,
  deleteNotice,
} from '../../api/noticeApi';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
import { buildAttachmentUrl } from '../../utils/attachmentUtils';
import styles from './Notices.module.css';
import { button } from 'framer-motion/client';

interface Notice {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  target_audience: string;
  department_name: string | null;
  department_id?: string | null;
  creatorName: string;
  creator_role: string;
  created_by?: string;
  assignedToName: string | null;
  assigned_to?: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  created_at: string;
  createdAt?: string;
  published_at?: string | null;
  publishedAt?: string | null;
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
    targetAudience: 'staff',
    departmentId: '',
    assignedTo: '',
    expiresAt: '',
    status: 'published',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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
      const isRouteToAdmin = formData.targetAudience === 'admin';
      alert(
        isRouteToAdmin
          ? 'Notice created and routed directly to System Administrator!'
          : 'Notice created and routed to staff team successfully!'
      );
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
      alert('Notice assigned to staff member successfully!');
      loadNotices();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign notice');
    }
  };

  const handleRouteToAdmin = async (noticeId: string) => {
    const remarks = window.prompt('Route notice to System Administrator? Enter optional escalation note or remarks:');
    if (remarks === null) return;
    try {
      await routeNoticeToAdmin(noticeId, remarks || undefined);
      alert('Notice successfully routed to System Admin!');
      loadNotices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to route notice to Admin');
    }
  };

  // Expiry modal state & handlers
  const [expiryModalNotice, setExpiryModalNotice] = useState<any | null>(null);
  const [expiryValue, setExpiryValue] = useState<string>('');
  const [savingExpiry, setSavingExpiry] = useState(false);

  const openExpiryModal = (notice: any) => {
    setExpiryModalNotice(notice);
    if (notice.expires_at) {
      const d = new Date(notice.expires_at);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setExpiryValue(localIso);
    } else {
      setExpiryValue('');
    }
  };

  const handleSaveExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryModalNotice) return;
    setSavingExpiry(true);
    try {
      const payload = expiryValue ? new Date(expiryValue).toISOString() : null;
      await updateNoticeExpiry(expiryModalNotice.id, payload);
      if (expiryValue && new Date(expiryValue).getTime() <= Date.now()) {
        alert('Notice expiration date reached. The notice has been automatically archived and removed.');
      } else {
        alert('Notice expiration updated successfully!');
      }
      setExpiryModalNotice(null);
      loadNotices();
      if (activeTab === 'created') {
        loadCreatedNotices();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update notice expiration');
    } finally {
      setSavingExpiry(false);
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
      targetAudience: notice.target_audience || 'staff',
      departmentId: notice.department_id || (departments.length > 0 ? departments[0].id : ''),
      assignedTo: notice.assigned_to || '',
      expiresAt: formattedExpiresAt,
      status: notice.status || 'published',
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
        targetAudience: editFormData.targetAudience,
        departmentId: editFormData.departmentId || null,
        assignedTo: editFormData.assignedTo || null,
        expiresAt: editFormData.expiresAt ? new Date(editFormData.expiresAt).toISOString() : null,
        status: editFormData.status,
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

  const isExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() <= Date.now();
  };

  const filteredNotices = notices.filter((notice) => !isExpired(notice.expires_at));
  const visibleCreatedNotices = createdNotices.filter((notice) => !isExpired(notice.expires_at));

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
          <span className={styles.tabIcon}>📬</span>
          <span className={styles.tabText}>Notices &amp; Assignments</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('created')}
        >
          <span className={styles.tabIcon}>📝</span>
          <span className={styles.tabText}>My Created Notices</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <span className={styles.tabIcon}>➕</span>
          <span className={styles.tabText}>Create Notice</span>
        </button>
      </div>

      {/* NOTICES & ASSIGNMENTS TAB */}
      {activeTab === 'notices' && (
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}>Loading notices...</div>
          ) : filteredNotices.length === 0 ? (
            <div className={styles.empty}>
              <p>No active notices found</p>
            </div>
          ) : (
            <>
              <div className={styles.noticesList}>
                {filteredNotices.map((notice: any) => {
                  const isFromAdmin = notice.creator_role === 'admin';
                  const isFromStaff = notice.creator_role === 'staff';
                  const canAssign = staff.length > 0;

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
                          {isFromStaff && (
                            <span className={styles.badgeTargetStaff}>
                              From Staff
                            </span>
                          )}
                          {notice.assignedToName ? (
                            <span className={styles.badgeAssigned}>
                              👤 Assigned: {notice.assignedToName}
                            </span>
                          ) : (
                            <span className={styles.badgeUnassignedNotice}>
                              ⚠️ Unassigned
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

                          {/* Assignment dropdown for department staff */}
                          {canAssign && (
                            <div className={styles.assignSection}>
                              <select
                                className={styles.select}
                                value={notice.assigned_to || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignNotice(notice.id, e.target.value);
                                  }
                                }}
                              >
                                <option value="">{notice.assigned_to ? 'Reassign staff...' : 'Assign to staff...'}</option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.email})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Route to Admin button */}
                          <button
                            type="button"
                            onClick={() => handleRouteToAdmin(notice.id)}
                            className={styles.btnRouteAdmin}
                            title="Route / escalate this notice to System Admin"
                          >
                            🚀 Route to Admin
                          </button>

                          {/* Set or edit expiration date */}
                          <button
                            type="button"
                            onClick={() => openExpiryModal(notice)}
                            className={styles.btnSecondary}
                            title="Set or update notice expiration date"
                          >
                            ⏱️ {notice.expires_at ? 'Edit Expiry' : 'Set Expiry'}
                          </button>

                          {/* Edit and Delete actions if creator or admin */}
                          {((notice as any).created_by === user?.id || (notice as any).creator_id === user?.id || user?.role === 'admin') && (
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
          ) : visibleCreatedNotices.length === 0 ? (
            <div className={styles.empty}>
              <p>You haven't created any active notices yet</p>
            </div>
          ) : (
            <>
              <div className={styles.noticesList}>
                {visibleCreatedNotices.map((notice: any) => {
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
                            {notice.target_audience === 'admin' ? (
                              <span className={styles.badgeTargetAdmin}>To: Admin</span>
                            ) : notice.target_audience === 'staff' ? (
                              <span className={styles.badgeTargetStaff}>To: Staff</span>
                            ) : (
                              <span className={styles.badgeTargetStaff}>To: Department</span>
                            )}
                            {notice.assignedToName && (
                              <span className={styles.badgeAssigned}>
                                👤 Assigned: {notice.assignedToName}
                              </span>
                            )}
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
                              <span className={styles.infoValue} style={{ color: '#dc2626', fontWeight: 600 }}>
                                ⏳ {new Date(notice.expires_at).toLocaleString()}
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

                          {notice.target_audience !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleRouteToAdmin(notice.id)}
                              className={styles.btnRouteAdmin}
                              title="Route / escalate this notice to System Admin"
                            >
                              🚀 Route to Admin
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openExpiryModal(notice)}
                            className={styles.btnSecondary}
                            title="Set or update notice expiration date"
                          >
                            ⏱️ {notice.expires_at ? 'Edit Expiry' : 'Set Expiry'}
                          </button>

                          {/* Edit and Delete notice actions */}
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
            <h2>Create Notice for Staff Team or Route to Admin</h2>
            <p>
              Create and dispatch notices for your department staff team, or escalate/route notices directly to the System Administrator.
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
                placeholder="Enter notice content for staff or admin escalation..."
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
                <label className={styles.label}>Target Audience *</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className={styles.select}
                >
                  <option value="staff">Staff Team (My Department)</option>
                  <option value="department">All Department Members</option>
                  <option value="admin">System Administrator (Route / Notice to Admin)</option>
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

              {formData.targetAudience !== 'admin' && (
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
              )}

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

            {formData.targetAudience === 'admin' ? (
              <div className={styles.infoNoticeBox}>
                <span>📢</span>
                <div>
                  <strong>Route to System Administrator:</strong> This notice will be published and routed directly to the System Administrator for organizational oversight and action.
                </div>
              </div>
            ) : (
              <p className={styles.hint} style={{ marginTop: 8, fontSize: '0.85rem', color: '#6b7280' }}>
                💡 This notice will be immediately delivered to the staff in your department. Staff will receive notifications and will be able to acknowledge and reply.
              </p>
            )}

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.btnSubmit}
              >
                {submitting
                  ? 'Dispatching Notice...'
                  : formData.targetAudience === 'admin'
                  ? '🚀 Dispatch Notice to Admin'
                  : '📢 Publish & Route Notice to Staff'}
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

      {/* Expiry Modal */}
      {expiryModalNotice && (
        <div className={styles.modalOverlay} onClick={() => setExpiryModalNotice(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className={styles.modalHeader}>
              <h2>Set Notice Expiration</h2>
              <button className={styles.closeBtn} onClick={() => setExpiryModalNotice(null)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                Notice: <strong>{expiryModalNotice.title}</strong>
                <br />
                When this expiration date is reached, the notice is automatically archived and removed from all active views.
              </p>

              <form onSubmit={handleSaveExpiry}>
                <div className={styles.formGroup} style={{ marginBottom: 18 }}>
                  <label className={styles.label}>Expiration Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={expiryValue}
                    onChange={(e) => setExpiryValue(e.target.value)}
                    className={styles.input}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                    Leave empty or clear to keep notice active indefinitely.
                  </span>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setExpiryModalNotice(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={savingExpiry}
                  >
                    {savingExpiry ? 'Saving...' : '💾 Save Expiration'}
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
          maxWidth="640px"
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
                <label className={styles.label}>Target Audience</label>
                <select
                  value={editFormData.targetAudience}
                  onChange={(e) => setEditFormData({ ...editFormData, targetAudience: e.target.value })}
                  className={styles.select}
                >
                  <option value="staff">Staff Team (Department)</option>
                  <option value="department">All Department Members</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className={styles.select}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              {departments.length > 1 && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Department</label>
                  <select
                    value={editFormData.departmentId}
                    onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                    className={styles.select}
                  >
                    <option value="">Select department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editFormData.targetAudience !== 'admin' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Assigned Staff (Optional)</label>
                  <select
                    value={editFormData.assignedTo}
                    onChange={(e) => setEditFormData({ ...editFormData, assignedTo: e.target.value })}
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
              )}

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
              This notice and all associated discussion replies and acknowledgements will be deleted.
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