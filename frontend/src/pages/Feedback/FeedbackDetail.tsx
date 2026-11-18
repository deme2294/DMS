import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import {
  fetchFeedback,
  fetchFeedbackItem,
  fetchReplies,
  replyToFeedback,
  updateFeedback,
  assignFeedbackToDepartment,
  assignFeedbackToStaff,
  respondToFeedback,
} from '../../api/feedbackApi';
import { fetchActiveDepartments, fetchDepartmentMembers } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import type { Feedback, FeedbackReply, FeedbackAiResponseResult } from '../../types/feedback';
import type { DepartmentMember } from '../../types/department';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { toShortFeedbackId } from '../../utils/idUtils';
import { analyzeFeedbackLocally } from '../../utils/feedbackAiFallback';
import styles from './FeedbackDetail.module.css';

const basePaths: Record<string, string> = {
  admin: '/admin/feedback',
  manager: '/manager/feedback',
  staff: '/staff/feedback',
  ceo: '/ceo/feedback',
  tenant: '/tenant/feedback',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned_to_dept: 'Assigned to Dept',
  assigned_to_staff: 'Shared with Staff',
  in_progress: 'In Progress',
  read: 'Under Review',
  resolved: 'Responded',
  closed: 'Closed',
};

export default function FeedbackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const role = user?.role || 'tenant';
  const base = basePaths[role] || '/admin/feedback';

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Department / Direct User assignment state (Admin)
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [assignTargetType, setAssignTargetType] = useState<'department' | 'user'>('department');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDeptHeadId, setSelectedDeptHeadId] = useState('');
  const [deptManagers, setDeptManagers] = useState<DepartmentMember[]>([]);
  const [directUsers, setDirectUsers] = useState<{ id: string; firstName?: string; lastName?: string; email?: string; role?: string }[]>([]);
  const [selectedDirectUserId, setSelectedDirectUserId] = useState('');
  const [adminDirective, setAdminDirective] = useState('');
  const [editWhatIsCorrect, setEditWhatIsCorrect] = useState('');
  const [editWhatShouldChange, setEditWhatShouldChange] = useState('');
  const [isAssigningDept, setIsAssigningDept] = useState(false);

  // Department-to-Staff feedback sharing state (Department Manager)
  const [deptStaff, setDeptStaff] = useState<DepartmentMember[]>([]);
  const [staffAssignScope, setStaffAssignScope] = useState<'department_general' | 'specific_staff'>('department_general');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [departmentNotes, setDepartmentNotes] = useState('');
  const [deptWhatIsCorrect, setDeptWhatIsCorrect] = useState('');
  const [deptWhatShouldChange, setDeptWhatShouldChange] = useState('');
  const [isAssigningStaff, setIsAssigningStaff] = useState(false);

  // Resolution response state (Staff / Manager / Admin)
  const [resolutionText, setResolutionText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<FeedbackAiResponseResult | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Reply / internal message state
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Status modal
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const isAdminOrCeo = role === 'admin' || role === 'ceo';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isTenant = role === 'tenant';

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (type === 'error') {
      showError(message, 'Feedback Alert');
    } else {
      showSuccess(message, 'Feedback Action');
    }
    setTimeout(() => setToast(null), 4500);
  };

  const loadFeedback = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [fbRes, repliesRes] = await Promise.all([
        fetchFeedbackItem(id),
        fetchReplies(id).catch(() => ({ data: { data: [] } })),
      ]);
      const fbData = fbRes.data.data;
      setFeedback(fbData);
      setReplies(repliesRes.data?.data || []);
      setNewStatus(fbData.status);
      setAssignTargetType(fbData.assignmentScope === 'direct_user' && !fbData.departmentId ? 'user' : 'department');
      setSelectedDeptId(fbData.departmentId || '');
      setSelectedDeptHeadId(fbData.departmentHeadId || '');
      setSelectedDirectUserId(fbData.assignmentScope === 'direct_user' ? (fbData.assignedToUserId || '') : '');
      setAdminDirective(fbData.adminDirective || '');
      setEditWhatIsCorrect(fbData.whatIsCorrect || '');
      setEditWhatShouldChange(fbData.whatShouldChange || '');
      setStaffAssignScope(fbData.assignmentScope === 'specific_staff' ? 'specific_staff' : 'department_general');
      setSelectedStaffIds(
        Array.isArray(fbData.assignedUserIds) && fbData.assignedUserIds.length > 0
          ? fbData.assignedUserIds
          : fbData.assignedToUserId
            ? [fbData.assignedToUserId]
            : []
      );
      setDepartmentNotes(fbData.departmentNotes || '');
      setDeptWhatIsCorrect(fbData.whatIsCorrect || '');
      setDeptWhatShouldChange(fbData.whatShouldChange || '');

      const shortId = toShortFeedbackId(fbData);
      if (shortId && id !== shortId && id.length > 4) {
        navigate(`${base}/${shortId}`, { replace: true });
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load feedback', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, base, navigate]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Load active departments and users for Admin feedback assignment
  useEffect(() => {
    if (isAdminOrCeo) {
      fetchActiveDepartments()
        .then((res) => {
          setDepartments(res.data.data || []);
        })
        .catch(() => {});
      fetchUsers({ status: 'active', limit: 100 })
        .then((res) => {
          const list = (res.data.data || []).filter((u: any) => (u.role || '').toLowerCase() !== 'tenant');
          setDirectUsers(list);
        })
        .catch(() => {});
    }
  }, [isAdminOrCeo]);

  // When selected department changes (or on load), load its department managers for Admin
  useEffect(() => {
    if (selectedDeptId) {
      fetchDepartmentMembers(selectedDeptId)
        .then((res) => {
          const members = res.data.data || [];
          const managers = members.filter((m: any) => m.role?.toLowerCase() === 'manager');
          setDeptManagers(managers);
          if (managers.length > 0 && !selectedDeptHeadId) {
            setSelectedDeptHeadId(feedback?.departmentHeadId || managers[0].id);
          }
        })
        .catch(() => {});
    } else {
      setDeptManagers([]);
    }
  }, [selectedDeptId, feedback?.departmentHeadId, selectedDeptHeadId]);

  // When manager or staff opens feedback, load staff members of the department
  useEffect(() => {
    const deptId = feedback?.departmentId || (isManager && user?.departments?.[0]?.id);
    if (deptId) {
      fetchDepartmentMembers(deptId)
        .then((res) => {
          const members = res.data.data || [];
          const staffOnly = members.filter((m: any) => m.role?.toLowerCase() === 'staff');
          setDeptStaff(staffOnly.length > 0 ? staffOnly : members);
        })
        .catch(() => {});
    }
  }, [feedback?.departmentId, isManager, user]);

  // 1. Admin assigns feedback (what is good / what should change) to a Department OR directly to a Needed User
  const handleAssignDepartment = async () => {
    if (!id) return;
    if (assignTargetType === 'user') {
      if (!selectedDirectUserId) {
        showToast('Please select the user who needs to receive this feedback', 'error');
        return;
      }
    } else if (!selectedDeptId) {
      showToast('Please select a department to assign this feedback', 'error');
      return;
    }

    setIsAssigningDept(true);
    try {
      await assignFeedbackToDepartment(id, {
        targetType: assignTargetType,
        departmentId: assignTargetType === 'department' ? selectedDeptId : undefined,
        departmentHeadId: assignTargetType === 'department' ? (selectedDeptHeadId || undefined) : undefined,
        assignedToUserId: assignTargetType === 'user' ? selectedDirectUserId : undefined,
        adminDirective: adminDirective.trim(),
        whatIsCorrect: editWhatIsCorrect.trim(),
        whatShouldChange: editWhatShouldChange.trim(),
      });
      showToast(
        assignTargetType === 'user'
          ? 'Feedback assigned to the selected user & notified!'
          : 'Feedback assigned to department head! Manager has been notified.'
      );
      loadFeedback();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to assign feedback', 'error');
    } finally {
      setIsAssigningDept(false);
    }
  };

  // 2. Department Manager shares feedback information to staff in their department (General or One by One)
  const handleAssignStaff = async () => {
    if (!id) return;
    if (staffAssignScope === 'specific_staff' && selectedStaffIds.length === 0) {
      showToast('Please select at least one staff member in your department (or choose General)', 'error');
      return;
    }
    setIsAssigningStaff(true);
    try {
      await assignFeedbackToStaff(id, {
        assignmentScope: staffAssignScope,
        assignedToUserId: staffAssignScope === 'specific_staff' ? selectedStaffIds[0] : undefined,
        assignedUserIds: staffAssignScope === 'specific_staff' ? selectedStaffIds : undefined,
        departmentNotes: departmentNotes.trim(),
        whatIsCorrect: deptWhatIsCorrect.trim(),
        whatShouldChange: deptWhatShouldChange.trim(),
      });
      showToast(
        staffAssignScope === 'department_general'
          ? 'Feedback shared generally with all staff in your department!'
          : `Feedback shared with ${selectedStaffIds.length} selected staff member(s)!`
      );
      loadFeedback();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to share feedback with staff', 'error');
    } finally {
      setIsAssigningStaff(false);
    }
  };

  // 3. Staff / Manager submits resolution response back to Tenant
  const handleGenerateAiResponse = useCallback(async (forceOverwrite = true) => {
    if (!id || !feedback) return;
    setIsGeneratingAi(true);
    try {
      let priorFeedbacks: Feedback[] = [];
      try {
        const listRes = await fetchFeedback({ limit: 30 });
        const allItems = listRes.data?.data || [];
        priorFeedbacks = allItems.filter(
          (item) =>
            item.id !== feedback.id &&
            ((feedback.tenantId && item.tenantId === feedback.tenantId) ||
              (feedback.tenantName && item.tenantName === feedback.tenantName))
        );
      } catch {
        priorFeedbacks = [];
      }

      const analysis = analyzeFeedbackLocally(feedback, priorFeedbacks);
      setAiAnalysis(analysis);
      setResolutionText((prev) => (forceOverwrite || !prev.trim() ? analysis.recommendedResponse : prev));
    } finally {
      setIsGeneratingAi(false);
    }
  }, [id, feedback]);

  const isDirectFeedbackRouting = (feedback?.routingType || 'general') === 'direct';
  const canRespondToTenant = isDirectFeedbackRouting ? isManager : role === 'admin';

  useEffect(() => {
    if (!feedback || isTenant || !canRespondToTenant) return;
    if (feedback.status !== 'resolved' && feedback.status !== 'closed' && !feedback.adminResponse && !aiAnalysis) {
      handleGenerateAiResponse(false);
    }
  }, [feedback, isTenant, canRespondToTenant, aiAnalysis, handleGenerateAiResponse]);

  const countResponseWords = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((w) => /[a-zA-Z0-9\u00C0-\u024F\u1200-\u137F]/.test(w)).length;

  const responseWordCount = countResponseWords(resolutionText);
  const isResponseLengthValid = responseWordCount > 10;

  const handleResolve = async () => {
    if (!id || !resolutionText.trim()) {
      showToast('Please write a response message for the tenant', 'error');
      return;
    }
    if (!isResponseLengthValid) {
      showToast(`Response must be more than 10 words (currently ${responseWordCount} word${responseWordCount === 1 ? '' : 's'}).`, 'error');
      return;
    }
    setIsResolving(true);
    try {
      await respondToFeedback(id, {
        status: 'resolved',
        adminResponse: resolutionText.trim(),
      });
      setResolutionText('');
      showToast('Resolution sent! Tenant has been notified via in-app notification & email.');
      loadFeedback();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to submit resolution', 'error');
    } finally {
      setIsResolving(false);
    }
  };

  // 4. Post Reply / Internal Note
  const handleReply = async () => {
    if (!id || !replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await replyToFeedback(id, replyText.trim());
      setReplyText('');
      showToast('Message sent');
      loadFeedback();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send reply', 'error');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Quick status update modal
  const handleUpdateStatus = async () => {
    if (!id) return;
    try {
      await updateFeedback(id, { status: newStatus });
      setStatusModal(false);
      showToast('Status updated');
      loadFeedback();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  if (loading || !feedback) return <div className={styles.page}>Loading feedback details...</div>;

  // Determine Stepper State
  const isStep1Done = true; // Tenant submitted
  const isStep2Done = Boolean(feedback.departmentId || feedback.assignmentScope === 'direct_user');
  const isStep3Done = Boolean(
    feedback.assignedToUserId ||
    feedback.assignmentScope === 'department_general' ||
    (feedback.assignedUserIds && feedback.assignedUserIds.length > 0)
  );
  const isStep4Done = feedback.status === 'resolved';

  const ticketPortalUrl = feedback.ticketReference
    ? `/${role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : role === 'staff' ? 'staff' : role === 'ceo' ? 'ceo' : 'tenant'}/tickets/${feedback.ticketReference}`
    : null;

  return (
    <div className={styles.page}>
      <PageHeader
        title={feedback.subject}
        description={`Feedback #${toShortFeedbackId(feedback)} · Submitter: ${feedback.tenantName || 'Tenant Organization'} · Contact: ${feedback.contactPerson || '—'}`}
        backTo={base}
        actionLabel={isAdminOrCeo ? 'Update Status' : undefined}
        onAction={isAdminOrCeo ? () => setStatusModal(true) : undefined}
      />

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.error : ''}`}>
          {toast.message}
        </div>
      )}

      {/* ── Enterprise Workflow Stepper ── */}
      <div className={styles.workflowStepper}>
        <div className={`${styles.stepItem} ${isStep1Done ? styles.completed : ''}`}>
          <div className={styles.stepDot}>✓</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepLabel}>Step 1</span>
            <span className={styles.stepTitle}>Tenant Submission</span>
          </div>
        </div>
        <div className={`${styles.stepDivider} ${isStep2Done ? styles.active : ''}`} />

        <div
          className={`${styles.stepItem} ${
            isStep2Done ? styles.completed : !isStep2Done ? styles.current : ''
          }`}
        >
          <div className={styles.stepDot}>{isStep2Done ? '✓' : '2'}</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepLabel}>Step 2</span>
            <span className={styles.stepTitle}>User / Dept Assigned</span>
          </div>
        </div>
        <div className={`${styles.stepDivider} ${isStep3Done ? styles.active : ''}`} />

        <div
          className={`${styles.stepItem} ${
            isStep3Done ? styles.completed : isStep2Done && !isStep3Done ? styles.current : ''
          }`}
        >
          <div className={styles.stepDot}>{isStep3Done ? '✓' : '3'}</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepLabel}>Step 3</span>
            <span className={styles.stepTitle}>Shared with Staff</span>
          </div>
        </div>
        <div className={`${styles.stepDivider} ${isStep4Done ? styles.active : ''}`} />

        <div className={`${styles.stepItem} ${isStep4Done ? styles.completed : isStep3Done ? styles.current : ''}`}>
          <div className={styles.stepDot}>{isStep4Done ? '✓' : '4'}</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepLabel}>Step 4</span>
            <span className={styles.stepTitle}>Tenant Response</span>
          </div>
        </div>
      </div>

      {/* ── Admin Directive Banner (if assigned) ── */}
      {feedback.adminDirective && (
        <div className={styles.directiveBanner}>
          <div className={styles.directiveHeader}>
            <span className={styles.directiveTag}>
              🏛️ Admin Directive for {feedback.departmentName || 'Department'}
            </span>
          </div>
          <div className={styles.directiveContent}>{feedback.adminDirective}</div>
        </div>
      )}

      {/* ── Department Head Instructions Banner (if assigned to staff) ── */}
      {feedback.departmentNotes && (
        <div className={styles.managerBanner}>
          <div className={styles.directiveHeader}>
            <span className={styles.directiveTag}>
              👤 Department Head Instructions for {feedback.assignedToName || 'Specialist'}
            </span>
          </div>
          <div className={styles.directiveContent}>{feedback.departmentNotes}</div>
        </div>
      )}

      {/* ── Resolution Banner (if resolved) ── */}
      {feedback.adminResponse && (
        <div className={styles.resolutionBanner}>
          <div className={styles.resolutionBannerHeader}>
            <span className={styles.resolutionBannerTag}>
              ✅ Official Response Delivered to Tenant
            </span>
            <span className={styles.resolutionBannerDate}>
              {feedback.responseAt ? new Date(feedback.responseAt).toLocaleString() : ''}
            </span>
          </div>
          <div className={styles.resolutionBannerBody}>
            {feedback.adminResponse}
          </div>
        </div>
      )}

      <div className={styles.detailGrid}>
        {/* Left Card: Feedback Overview */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitle}>
              <span className={styles.cardHeaderIcon}>📋</span>
              <div>
                <h3 className={styles.cardHeading}>Feedback Overview</h3>
                <span className={styles.cardHeaderSub}>Tenant feedback details, ratings & operational routing</span>
              </div>
            </div>
            <span className={`${styles.badge} ${styles[feedback.status]}`}>
              {STATUS_LABELS[feedback.status] || feedback.status}
            </span>
          </div>

          <div className={styles.overviewGrid}>
            {/* Top row: Rating & Submission Time */}
            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Tenant Rating</span>
              <div className={styles.fieldValue}>
                {feedback.rating ? (
                  <div className={styles.ratingGroup}>
                    <div className={styles.ratingStarsRow} aria-label={`${feedback.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={star <= (feedback.rating || 0) ? styles.starFilled : styles.starEmpty}
                        >
                          {star <= (feedback.rating || 0) ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                    <span className={styles.ratingNumeric}>({feedback.rating} / 5)</span>
                  </div>
                ) : (
                  <span className={styles.valueMuted}>Not Rated</span>
                )}
              </div>
            </div>

            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Submitted On</span>
              <div className={styles.fieldValue}>
                <span className={styles.submittedDate}>
                  📅 {feedback.createdAt ? new Date(feedback.createdAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {/* Category & Feedback Type */}
            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Ticket Category & Service</span>
              <div className={styles.fieldValueWrap}>
                {feedback.categoryName ? (
                  <span className={styles.categoryPill}>
                    🏷️ {feedback.categoryName}
                  </span>
                ) : (
                  <span className={styles.valueMuted}>General</span>
                )}
                {feedback.serviceName && (
                  <span className={styles.servicePill}>⚡ {feedback.serviceName}</span>
                )}
              </div>
            </div>

            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Feedback Type</span>
              <div className={styles.fieldValue}>
                <span className={styles.feedbackTypePill}>
                  💡 {feedback.feedbackType ? feedback.feedbackType.charAt(0).toUpperCase() + feedback.feedbackType.slice(1) : 'Suggestion'}
                </span>
              </div>
            </div>

            {/* Assigned Department */}
            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Assigned Department</span>
              <div className={styles.fieldValue}>
                {feedback.departmentName ? (
                  <span className={styles.deptPill}>
                    🏛️ {feedback.departmentName}
                  </span>
                ) : (
                  <span className={styles.unassignedPill}>Unassigned</span>
                )}
              </div>
            </div>

            {/* Department Head / Manager */}
            <div className={styles.overviewFieldCard}>
              <span className={styles.fieldLabel}>Department Head (Manager)</span>
              <div className={styles.fieldValue}>
                {feedback.departmentHeadName ? (
                  <div className={styles.managerInfo}>
                    <span className={styles.managerName}>👤 {feedback.departmentHeadName}</span>
                    {feedback.departmentHeadEmail && (
                      <span className={styles.managerEmail}>{feedback.departmentHeadEmail}</span>
                    )}
                  </div>
                ) : (
                  <span className={styles.pendingPill}>⏳ Pending manager designation</span>
                )}
              </div>
            </div>

            {/* Assigned Staff / Sharing Scope (Full width card) */}
            <div className={`${styles.overviewFieldCard} ${styles.fullWidthField}`}>
              <span className={styles.fieldLabel}>Assigned Staff / Sharing Scope</span>
              <div className={styles.fieldValue}>
                {feedback.assignmentScope === 'department_general' ? (
                  <div className={styles.scopeBannerGeneral}>
                    <span className={styles.scopeIcon}>📢</span>
                    <div className={styles.scopeContent}>
                      <strong>General Broadcast:</strong> All Staff in {feedback.departmentName || 'Department'}
                    </div>
                  </div>
                ) : feedback.assignmentScope === 'direct_user' && feedback.assignedToName ? (
                  <div className={styles.scopeBannerDirect}>
                    <span className={styles.scopeIcon}>👤</span>
                    <div className={styles.scopeContent}>
                      <strong>Direct Assignee:</strong> {feedback.assignedToName}
                      {feedback.assignedToEmail ? ` (${feedback.assignedToEmail})` : ''}
                    </div>
                  </div>
                ) : feedback.assignedUserIds && feedback.assignedUserIds.length > 0 ? (
                  <div className={styles.scopeBannerDirect}>
                    <span className={styles.scopeIcon}>👥</span>
                    <div className={styles.scopeContent}>
                      <strong>One by One Sharing ({feedback.assignedUserIds.length} staff):</strong>{' '}
                      {feedback.assignedUserIds
                        .map((uid) => {
                          const m = deptStaff.find((s) => s.id === uid);
                          return m ? `${m.firstName} ${m.lastName}` : null;
                        })
                        .filter(Boolean)
                        .join(', ') || feedback.assignedToName || 'Selected Staff'}
                    </div>
                  </div>
                ) : feedback.assignedToName ? (
                  <div className={styles.scopeBannerDirect}>
                    <span className={styles.scopeIcon}>👤</span>
                    <div className={styles.scopeContent}>
                      <strong>Direct Assignee:</strong> {feedback.assignedToName}
                      {feedback.assignedToEmail ? ` (${feedback.assignedToEmail})` : ''}
                    </div>
                  </div>
                ) : (
                  <div className={styles.scopeBannerPending}>
                    <span className={styles.scopeIcon}>⏳</span>
                    <div className={styles.scopeContent}>Pending sharing to staff (General broadcast or One by One)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Associated Ticket (Full width if present) */}
            {ticketPortalUrl && (
              <div className={`${styles.overviewFieldCard} ${styles.fullWidthField}`}>
                <span className={styles.fieldLabel}>Associated Ticket</span>
                <div className={styles.fieldValue}>
                  <Link to={ticketPortalUrl} className={styles.ticketLinkBadge}>
                    <span className={styles.ticketRefBadge}>[{feedback.ticketReference}]</span>
                    <span className={styles.ticketTitleText}>{feedback.ticketTitle || 'View Ticket'}</span>
                    <span className={styles.ticketLinkArrow}>↗</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Original Message (Full width) */}
            <div className={`${styles.overviewFieldCard} ${styles.fullWidthField}`}>
              <span className={styles.fieldLabel}>Original Tenant Message</span>
              <div className={styles.originalMessageBox}>
                <div className={styles.messageQuoteIcon}>“</div>
                <div className={styles.messageContentText}>{feedback.message || 'No additional message provided.'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Detailed Assessment Breakdown */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitle}>
              <span className={styles.cardHeaderIcon}>🔍</span>
              <div>
                <h3 className={styles.cardHeading}>Detailed Assessment Breakdown</h3>
                <span className={styles.cardHeaderSub}>Structured 4-pillar tenant review breakdown</span>
              </div>
            </div>
          </div>

          <div className={styles.assessmentGrid}>
            {/* Pillar 1: Working Well */}
            <div className={`${styles.assessmentCard} ${styles.assessCardGood}`}>
              <div className={styles.assessCardHeader}>
                <div className={styles.assessCardTitle}>
                  <span className={styles.assessDotGood}>●</span>
                  <span className={styles.assessTitleText}>What is Working Well / Continue</span>
                </div>
                <span className={styles.assessTagGood}>STRENGTH</span>
              </div>
              <div className={styles.assessCardBody}>
                {feedback.whatIsCorrect ? (
                  <p className={styles.assessText}>{feedback.whatIsCorrect}</p>
                ) : (
                  <div className={styles.assessEmptyState}>
                    <span className={styles.assessEmptyIcon}>✓</span>
                    <span>No specific highlights entered by tenant</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pillar 2: Should Change */}
            <div className={`${styles.assessmentCard} ${styles.assessCardChange}`}>
              <div className={styles.assessCardHeader}>
                <div className={styles.assessCardTitle}>
                  <span className={styles.assessDotChange}>●</span>
                  <span className={styles.assessTitleText}>What Should Change / Improve</span>
                </div>
                <span className={styles.assessTagChange}>IMPROVEMENT</span>
              </div>
              <div className={styles.assessCardBody}>
                {feedback.whatShouldChange ? (
                  <p className={styles.assessText}>{feedback.whatShouldChange}</p>
                ) : (
                  <div className={styles.assessEmptyState}>
                    <span className={styles.assessEmptyIcon}>⚡</span>
                    <span>No change requests entered by tenant</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pillar 3: What is Wrong */}
            <div className={`${styles.assessmentCard} ${styles.assessCardWrong}`}>
              <div className={styles.assessCardHeader}>
                <div className={styles.assessCardTitle}>
                  <span className={styles.assessDotWrong}>●</span>
                  <span className={styles.assessTitleText}>What is Wrong</span>
                </div>
                <span className={styles.assessTagWrong}>DEFECT / ISSUE</span>
              </div>
              <div className={styles.assessCardBody}>
                {feedback.whatIsWrong ? (
                  <p className={styles.assessText}>{feedback.whatIsWrong}</p>
                ) : (
                  <div className={styles.assessEmptyState}>
                    <span className={styles.assessEmptyIcon}>—</span>
                    <span>No defects reported in this review</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pillar 4: How It Should Go */}
            <div className={`${styles.assessmentCard} ${styles.assessCardGuide}`}>
              <div className={styles.assessCardHeader}>
                <div className={styles.assessCardTitle}>
                  <span className={styles.assessDotGuide}>●</span>
                  <span className={styles.assessTitleText}>How It Should Go</span>
                </div>
                <span className={styles.assessTagGuide}>TARGET FLOW</span>
              </div>
              <div className={styles.assessCardBody}>
                {feedback.howItShouldGo ? (
                  <p className={styles.assessText}>{feedback.howItShouldGo}</p>
                ) : (
                  <div className={styles.assessEmptyState}>
                    <span className={styles.assessEmptyIcon}>🎯</span>
                    <span>No target process requested in this review</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workflow Action 1: Admin Assigns Feedback (What is Good / What Should Change) to Needed User or Department ── */}
      {isAdminOrCeo && (
        <div className={styles.card} style={{ borderTop: '4px solid #2563eb' }}>
          <h3>🏛️ Administration: Assign Feedback to User or Department</h3>
          <p className={styles.proseText}>
            Assign the tenant&rsquo;s feedback (what is good, what should be changed, and tenant comments) strictly to the needed user or department.
          </p>

          <div className={styles.modeToggleGroup}>
            <button
              type="button"
              onClick={() => setAssignTargetType('department')}
              className={`${styles.modeToggleBtn} ${assignTargetType === 'department' ? styles.modeToggleBlueActive : ''}`}
            >
              🏛️ Assign to Department
            </button>
            <button
              type="button"
              onClick={() => setAssignTargetType('user')}
              className={`${styles.modeToggleBtn} ${assignTargetType === 'user' ? styles.modeTogglePurpleActive : ''}`}
            >
              👤 Assign to Needed User Only
            </button>
          </div>

          <div className={styles.assignmentForm}>
            {assignTargetType === 'department' ? (
              <>
                <div>
                  <label>Select Responsible Department *</label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => {
                      setSelectedDeptId(e.target.value);
                      setSelectedDeptHeadId('');
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    <option value="">-- Choose a Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Select Department Head (Manager Role)</label>
                  <select
                    value={selectedDeptHeadId}
                    onChange={(e) => setSelectedDeptHeadId(e.target.value)}
                    style={{ marginTop: '8px' }}
                    disabled={!selectedDeptId}
                  >
                    <option value="">
                      {selectedDeptId
                        ? deptManagers.length > 0
                          ? '-- Select Department Head (Manager) --'
                          : '-- No Manager Role Assigned (Notifies All Department Managers) --'
                        : '-- Choose Department First --'}
                    </option>
                    {deptManagers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.firstName} {mgr.lastName} ({mgr.email}) — Department Manager
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label>Select Needed User *</label>
                <select
                  value={selectedDirectUserId}
                  onChange={(e) => setSelectedDirectUserId(e.target.value)}
                  style={{ marginTop: '8px' }}
                >
                  <option value="">-- Choose Needed User --</option>
                  {directUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email}) — {u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label>🟢 What is Good / Working Well (Feedback Highlight)</label>
              <textarea
                rows={2}
                value={editWhatIsCorrect}
                onChange={(e) => setEditWhatIsCorrect(e.target.value)}
                placeholder="Highlight what the tenant praised or what is working well..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <div>
              <label>🟠 What Should Be Changed / Improved</label>
              <textarea
                rows={2}
                value={editWhatShouldChange}
                onChange={(e) => setEditWhatShouldChange(e.target.value)}
                placeholder="Specify what should be changed or improved based on the tenant's feedback..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <div>
              <label>Feedback Notes / Guidance for {assignTargetType === 'user' ? 'User' : 'Department'}</label>
              <textarea
                rows={2}
                value={adminDirective}
                onChange={(e) => setAdminDirective(e.target.value)}
                placeholder="E.g., Share this feedback with the team so they keep what is working well and adjust the requested areas..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <button
              className={styles.actionBtnPrimary}
              onClick={handleAssignDepartment}
              disabled={isAssigningDept || (assignTargetType === 'department' ? !selectedDeptId : !selectedDirectUserId)}
            >
              {isAssigningDept
                ? 'Assigning...'
                : assignTargetType === 'user'
                  ? 'Assign Feedback to User & Notify'
                  : 'Assign Feedback to Department & Notify'}
            </button>
          </div>
        </div>
      )}

      {/* ── Workflow Action 2: Department Head Shares Feedback Information with Department Staff (General or One by One) ── */}
      {(isManager || isAdminOrCeo) && feedback.departmentId && (
        <div className={styles.card} style={{ borderTop: '4px solid #9333ea' }}>
          <h3>👥 Department Head: Share Feedback to Staff (General or One by One)</h3>
          <p className={styles.proseText}>
            Share what is good and what should be changed from this feedback with staff in{' '}
            <strong>{feedback.departmentName || 'your department'}</strong> — either to all department staff in general or to specific staff members one by one.
          </p>

          <div className={styles.modeToggleGroup}>
            <button
              type="button"
              onClick={() => setStaffAssignScope('department_general')}
              className={`${styles.modeToggleBtn} ${staffAssignScope === 'department_general' ? styles.modeToggleGreenActive : ''}`}
            >
              📢 General (All Staff in Department)
            </button>
            <button
              type="button"
              onClick={() => setStaffAssignScope('specific_staff')}
              className={`${styles.modeToggleBtn} ${staffAssignScope === 'specific_staff' ? styles.modeTogglePurpleActive : ''}`}
            >
              👤 One by One (Select Staff Member{selectedStaffIds.length > 0 ? `: ${selectedStaffIds.length}` : 's'})
            </button>
          </div>

          <div className={styles.assignmentForm}>
            {staffAssignScope === 'department_general' ? (
              <div className={styles.generalInfoBanner}>
                All active staff members in <strong>{feedback.departmentName || 'this department'}</strong> ({deptStaff.length} member{deptStaff.length === 1 ? '' : 's'}) will receive this feedback information.
              </div>
            ) : (
              <div>
                <label>Select Staff Member(s) One by One *</label>
                <div className={styles.staffChecklistBox}>
                  {deptStaff.length === 0 ? (
                    <span className={styles.emptyState}>No staff members found in this department</span>
                  ) : (
                    deptStaff.map((staff) => {
                      const isChecked = selectedStaffIds.includes(staff.id);
                      return (
                        <label
                          key={staff.id}
                          className={`${styles.staffChecklistRow} ${isChecked ? styles.staffChecklistRowActive : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedStaffIds((prev) =>
                                prev.includes(staff.id)
                                  ? prev.filter((sid) => sid !== staff.id)
                                  : [...prev, staff.id]
                              );
                            }}
                          />
                          <span>
                            <strong>{staff.firstName} {staff.lastName}</strong> ({staff.email}) — {staff.role}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div>
              <label>🟢 What is Good / Working Well</label>
              <textarea
                rows={2}
                value={deptWhatIsCorrect}
                onChange={(e) => setDeptWhatIsCorrect(e.target.value)}
                placeholder="What is going well according to the tenant..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <div>
              <label>🟠 What Should Be Changed</label>
              <textarea
                rows={2}
                value={deptWhatShouldChange}
                onChange={(e) => setDeptWhatShouldChange(e.target.value)}
                placeholder="What should be changed or improved by the department staff..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <div>
              <label>Department Feedback Notes for Staff</label>
              <textarea
                rows={2}
                value={departmentNotes}
                onChange={(e) => setDepartmentNotes(e.target.value)}
                placeholder="E.g., Please note the tenant's positive feedback and apply the requested improvements in our daily service..."
                style={{ marginTop: '8px' }}
              />
            </div>

            <button
              className={styles.actionBtnPrimary}
              style={{ background: staffAssignScope === 'department_general' ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #9333ea, #7e22ce)' }}
              onClick={handleAssignStaff}
              disabled={isAssigningStaff || (staffAssignScope === 'specific_staff' && selectedStaffIds.length === 0)}
            >
              {isAssigningStaff
                ? 'Sharing...'
                : staffAssignScope === 'department_general'
                  ? 'Share Feedback to All Department Staff'
                  : `Share Feedback to Selected Staff (${selectedStaffIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* ── Workflow Action 3: Feedback Response & Improvement Update to Tenant ── */}
      {canRespondToTenant ? (
        <div className={styles.card} style={{ borderTop: '4px solid #10b981' }}>
          <div className={styles.aiHeaderRow}>
            <h3>✅ Send Feedback Response to Tenant</h3>
            <button
              type="button"
              onClick={() => handleGenerateAiResponse(true)}
              disabled={isGeneratingAi}
              className={styles.aiGenerateBtn}
            >
              {isGeneratingAi ? '✨ Detecting & Generating...' : '✨ AI Detect & Regenerate Response'}
            </button>
          </div>
          <p className={styles.proseText}>
            AI automatically detects whether the tenant&rsquo;s feedback is <strong>what should be kept up</strong> or <strong>what should be changed</strong> and drafts a quick response. Submitting this updates the feedback and notifies the tenant.
          </p>

          {aiAnalysis && (
            <div
              className={`${styles.aiBanner} ${
                aiAnalysis.detectedType === 'keep_it_up'
                  ? styles.aiBannerKeepUp
                  : aiAnalysis.detectedType === 'needs_change'
                    ? styles.aiBannerChange
                    : ''
              }`}
            >
              <div className={styles.aiBannerHeader}>
                <strong>
                  {aiAnalysis.detectedType === 'keep_it_up'
                    ? '🟢 AI Detected: What to Keep Up (Positive)'
                    : aiAnalysis.detectedType === 'needs_change'
                      ? '🟠 AI Detected: What Should Be Changed'
                      : '🔵 AI Detected: Keep Up + What Should Be Changed'}
                </strong>
                <span className={styles.aiSourceTag}>
                  Type: {aiAnalysis.feedbackTypeUsed || 'General'} • {aiAnalysis.source === 'ai-nlp-engine' ? 'Built-in AI Analyzer' : aiAnalysis.source.toUpperCase()}
                </span>
              </div>

              {aiAnalysis.historySummary && (
                <div className={styles.aiHighlightLine} style={{ opacity: 0.9 }}>
                  <strong>Prior Feedback Check:</strong> {aiAnalysis.historySummary}
                </div>
              )}

              {aiAnalysis.keepUpHighlights.length > 0 && (
                <div className={`${styles.aiHighlightLine} ${styles.aiHighlightKeepUp}`}>
                  <strong>Keep It Up:</strong> {aiAnalysis.keepUpHighlights.join(' • ')}
                </div>
              )}
              {aiAnalysis.changeHighlights.length > 0 && (
                <div className={`${styles.aiHighlightLine} ${styles.aiHighlightChange}`}>
                  <strong>Should Be Changed:</strong> {aiAnalysis.changeHighlights.join(' • ')}
                </div>
              )}

              {aiAnalysis.quickResponses.length > 0 && (
                <div className={styles.aiChips}>
                  {aiAnalysis.quickResponses.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setResolutionText(opt.text)}
                      className={`${styles.aiChip} ${
                        resolutionText.trim() === opt.text.trim() ? styles.aiChipActive : ''
                      }`}
                      title={opt.tone}
                    >
                      ⚡ {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.assignmentForm}>
            <textarea
              rows={4}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="Write a clear response of more than 10 words (or use AI Detect above to auto-generate)..."
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: isResponseLengthValid ? '#10b981' : '#f59e0b',
              }}
            >
              <span>
                {isResponseLengthValid
                  ? `✓ ${responseWordCount} words (meets > 10 words requirement)`
                  : `Minimum > 10 words required (${responseWordCount} / 11+ words)`}
              </span>
            </div>
            <button
              className={styles.actionBtnSuccess}
              onClick={handleResolve}
              disabled={isResolving || !isResponseLengthValid}
            >
              {isResolving ? 'Sending...' : 'Send Feedback Response to Tenant'}
            </button>
          </div>
        </div>
      ) : (isStaff || isManager || isAdminOrCeo) ? (
        <div className={styles.card} style={{ borderTop: '4px solid #64748b' }}>
          <h3>✅ Send Feedback Response to Tenant</h3>
          <p className={styles.proseText}>
            {isDirectFeedbackRouting ? (
              <>
                <strong>Direct Department Routing:</strong> Only the <strong>Head of the assigned department</strong> ({feedback.departmentName || 'Assigned Department'}) can send the official feedback response to the tenant.
              </>
            ) : (
              <>
                <strong>General Routing:</strong> Only an <strong>Admin</strong> can send the official feedback response to the tenant.
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* ── Discussion & Internal Replies ── */}
      <div className={styles.card}>
        <h3>Internal Discussion & Replies ({replies.length})</h3>
        {replies.length === 0 ? (
          <p className={styles.emptyState}>No replies or comments recorded yet.</p>
        ) : (
          <ul className={styles.timeline}>
            {replies.map((reply) => {
              const author =
                [reply.firstName, reply.lastName].filter(Boolean).join(' ') ||
                reply.username ||
                reply.repliedBy ||
                'Team Member';
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

        <div className={styles.replyForm} style={{ marginTop: '20px' }}>
          <label>Add Message / Progress Note</label>
          <textarea
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a message, note, or update..."
          />
          <button
            className={styles.submitBtn}
            onClick={handleReply}
            disabled={replySubmitting || !replyText.trim()}
          >
            {replySubmitting ? 'Posting...' : 'Post Message'}
          </button>
        </div>
      </div>

      {/* Modal for manual status override */}
      <Modal open={statusModal} title="Update Feedback Status" onClose={() => setStatusModal(false)}>
        <div className={styles.modalForm}>
          <label>Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            {['pending', 'assigned_to_dept', 'assigned_to_staff', 'in_progress', 'resolved', 'closed'].map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s}
                </option>
              )
            )}
          </select>
          <button onClick={handleUpdateStatus}>Save Status</button>
        </div>
      </Modal>
    </div>
  );
}
