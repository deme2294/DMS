import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import {
  changeTicketStatus, fetchTicket, fetchTicketReplies, addTicketReply, fetchTicketTimeline,
  assignDepartment, assignStaff, reassignStaff, acceptAssignment, rejectAssignment,
  escalateTicket, mergeTickets, fetchMergeCandidates, closeTicket, reopenTicket, approveResolution, rejectResolution,
  approveReopenTicket, rejectReopenTicket,
  markResolved, changePriority, changeCategory, addInternalNote, uploadTicketAttachments, updateTicketAttachment, deleteTicketAttachment,
} from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import { toShortId } from '../../utils/idUtils';
import type { Ticket, TicketStatus, TicketReply, TimelineEvent } from '../../types/ticket';
import { STATUS_LABELS, TICKET_STATUSES, TICKET_PRIORITIES, getStatusLabel, getStatusClassName } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAlert } from '../../context/AlertContext';
import styles from './CeoTickets.module.css';
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  CheckBadgeIcon,
  ArrowUturnLeftIcon,
  FlagIcon,
  TagIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  DocumentIcon,
  PhotoIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  ChatBubbleBottomCenterTextIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  ChevronDoubleUpIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  BoltIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { formatFileSize, buildAttachmentUrl } from '../../utils/attachmentUtils';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const basePaths: Record<string, string> = {
  admin: '/admin/tickets',
  manager: '/manager/tickets',
  staff: '/staff/tickets',
  tenant: '/tenant/tickets',
  ceo: '/ceo/tickets',
};

const TRANSITIONS: Record<string, Partial<Record<TicketStatus, TicketStatus[]>>> = {
  admin: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['under_review', 'pending_approval', 'waiting_tenant', 'resolved', 'pending', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    under_review: ['pending_approval', 'waiting_tenant', 'resolved', 'in_progress', 'rejected', 'assigned'],
    pending_approval: ['waiting_tenant', 'resolved', 'in_progress', 'rejected'],
    waiting_tenant: [],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
  },
  ceo: {
    open: ['assigned', 'in_progress', 'escalated', 'rejected', 'cancelled'],
    assigned: ['in_progress', 'escalated', 'rejected', 'cancelled', 'open'],
    in_progress: ['under_review', 'pending_approval', 'waiting_tenant', 'resolved', 'pending', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    under_review: ['pending_approval', 'waiting_tenant', 'resolved', 'in_progress', 'rejected', 'assigned'],
    pending_approval: ['waiting_tenant', 'resolved', 'in_progress', 'rejected'],
    waiting_tenant: [],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
  },
  manager: {
    assigned: ['in_progress', 'rejected'],
    in_progress: ['under_review', 'pending_approval', 'pending', 'escalated'],
    pending: ['in_progress', 'escalated'],
    under_review: ['pending_approval', 'in_progress', 'rejected'],
    pending_approval: ['in_progress'],
    waiting_tenant: [],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'closed', 'in_progress'],
    completed: ['reopened', 'closed'],
    reopened: ['in_progress', 'escalated'],
    accepted: ['in_progress', 'escalated'],
    escalated: ['in_progress', 'resolved', 'waiting_tenant'],
    assigned_department: ['assigned_staff'],
    assigned_staff: ['in_progress'],
  },
  staff: {
    assigned: ['in_progress'],
    in_progress: ['under_review', 'pending'],
    under_review: [],
    pending: ['in_progress'],
    waiting_tenant: [],
    waiting_vendor: ['in_progress'],
    resolved: [],
    completed: [],
    reopened: ['in_progress'],
    escalated: ['in_progress'],
    assigned_staff: ['in_progress'],
  },
  tenant: {
    open: ['cancelled'],
    waiting_tenant: ['closed', 'in_progress', 'reopened'],
    resolved: ['closed', 'in_progress', 'reopened'],
    completed: ['reopened'],
    reopened: [],
    escalated: ['in_progress', 'reopened'],
    approved: ['closed'],
    submitted: ['cancelled'],
  },
};

type Department = { id: string; name: string };
type StaffUser = { id: string; firstName: string; lastName: string };

function formatRemaining(ms?: number | null): string {
  if (ms == null) return '—';
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3.6e6);
  const m = Math.floor((abs % 3.6e6) / 6e4);
  const sign = ms < 0 ? 'overdue by ' : '';
  return `${sign}${h}h ${m}m`;
}

export default function CeoTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const base = user ? basePaths[user.role] : '/tenant/tickets';
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineLimit, setTimelineLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isMe = (targetId?: string | number | null, targetEmail?: string | null, targetName?: string | null) => {
    if (!user) return false;
    if (targetId && user.id && String(targetId) === String(user.id)) return true;
    if (targetEmail && user.email && targetEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) return true;
    if (targetName) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const uname = (user.username || '').toLowerCase();
      const tName = targetName.trim().toLowerCase();
      if (tName && (tName === fullName || tName === uname)) return true;
    }
    return false;
  };

  const isTenantUser = (user?.role && String(user.role).toLowerCase() === 'tenant') || false;
  const isMyTenantTicket = isTenantUser || Boolean(user?.tenantId && ticket?.tenantId && String(user.tenantId) === String(ticket.tenantId));

  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>('assigned');
  const [notes, setNotes] = useState('');
  const [deptModal, setDeptModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [priorityModal, setPriorityModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [mergeModal, setMergeModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [attachModal, setAttachModal] = useState(false);
  const [reopenModal, setReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [assigningDept, setAssigningDept] = useState(false);
  const [assignmentAlert, setAssignmentAlert] = useState<{
    type: 'department' | 'staff';
    title: string;
    message: string;
    departmentName?: string;
    managerName?: string;
    timestamp: Date;
  } | null>(null);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<Ticket[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [selectedMergeTickets, setSelectedMergeTickets] = useState<Ticket[]>([]);
  const [manualMergeInput, setManualMergeInput] = useState('');
  const [mergeNotes, setMergeNotes] = useState('');
  const [mergingLoading, setMergingLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedNoteDepts, setSelectedNoteDepts] = useState<string[]>([]);
  const [attachFiles, setAttachFiles] = useState<FileList | null>(null);
  const [attachComment, setAttachComment] = useState('');
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [editAttachmentModal, setEditAttachmentModal] = useState(false);
  const [editAttachment, setEditAttachment] = useState<any | null>(null);
  const [editAttachmentComment, setEditAttachmentComment] = useState('');
  const [editAttachmentSaving, setEditAttachmentSaving] = useState(false);
  const [assignPrefill, setAssignPrefill] = useState<{ text: string } | null>(null);
  const { socket } = useSocket();

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchTicket(id);
      const ticketData = res.data.data;
      setTicket(ticketData);
      const shortId = ticketData?.ticketNum ? String(ticketData.ticketNum) : ticketData?.referenceNumber;
      if (shortId && id !== shortId && id.length > 20) {
        navigate(`${base}/${shortId}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };
  const loadReplies = async () => {
    if (!id) return;
    const res = await fetchTicketReplies(id);
    setReplies(res.data.data);
  };
  const loadTimeline = async () => {
    if (!id) return;
    const res = await fetchTicketTimeline(id);
    setTimeline(res.data.data);
  };

  useEffect(() => {
    loadTicket();
    loadReplies();
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!socket || !user) return;
    const joinRoom = () => {
      if (id) socket.emit('join-ticket', id);
    };
    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);
    const handleTicketUpdated = () => {
      loadTicket();
      loadReplies();
      loadTimeline();
    };
    socket.on('ticket:updated', handleTicketUpdated);
    return () => {
      socket.off('connect', joinRoom);
      socket.off('ticket:updated', handleTicketUpdated);
      if (id) {
        socket.emit('leave-ticket', id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user, id]);

  useEffect(() => {
    if (deptModal || noteModal) fetchActiveDepartments().then((r) => setDepartments(r.data.data));
    if (staffModal || mergeModal) {
      const tid = ticket?.departmentId;
      const tidShort = toShortId(tid);
      fetchUsers({ role: 'staff', limit: 200, departmentId: toShortId(tid) || undefined }).then((r) => {
        const list = r.data.data.filter((u) => !tid || u.departments?.some((d) => d.id === tid || d.code === tid || toShortId(d.id) === tidShort));
        setStaffUsers(list.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
      });
    }
    if (categoryModal) {
      import('../../api/ticketApi').then((m) => m.fetchTicketCategories().then((r) => setCategories(r.data.data)));
    }
    if (noteModal) {
      setSelectedNoteDepts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptModal, staffModal, categoryModal, mergeModal, noteModal]);

  useEffect(() => {
    if (mergeModal && ticket?.id) {
      setLoadingCandidates(true);
      fetchMergeCandidates(ticket.id, mergeSearch)
        .then((res) => setMergeCandidates(res.data.data || []))
        .catch(() => setMergeCandidates([]))
        .finally(() => setLoadingCandidates(false));
    } else if (!mergeModal) {
      setSelectedMergeTickets([]);
      setMergeSearch('');
      setManualMergeInput('');
      setMergeNotes('');
    }
  }, [mergeModal, ticket?.id]);

  useEffect(() => {
    if (!mergeModal || !ticket?.id) return;
    const timer = setTimeout(() => {
      setLoadingCandidates(true);
      fetchMergeCandidates(ticket.id, mergeSearch)
        .then((res) => setMergeCandidates(res.data.data || []))
        .catch(() => setMergeCandidates([]))
        .finally(() => setLoadingCandidates(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch]);

  const toggleMergeCandidate = (cand: Ticket) => {
    setSelectedMergeTickets((prev) => {
      const exists = prev.some((t) => t.id === cand.id);
      if (exists) return prev.filter((t) => t.id !== cand.id);
      return [...prev, cand];
    });
  };

  const handleManualAddMerge = async () => {
    const raw = manualMergeInput.trim();
    if (!raw || !ticket?.id) return;
    if (
      raw.toLowerCase() === ticket.id.toLowerCase() ||
      (ticket.referenceNumber && raw.toLowerCase() === ticket.referenceNumber.toLowerCase()) ||
      (ticket.trackNumber && raw.toLowerCase() === ticket.trackNumber.toLowerCase())
    ) {
      flash('Cannot merge the target ticket into itself. Please choose another ticket.', true);
      return;
    }
    const already = selectedMergeTickets.some(
      (t) => t.id.toLowerCase() === raw.toLowerCase() ||
             (t.referenceNumber && t.referenceNumber.toLowerCase() === raw.toLowerCase()) ||
             (t.trackNumber && t.trackNumber.toLowerCase() === raw.toLowerCase())
    );
    if (already) {
      setManualMergeInput('');
      return;
    }
    const found = mergeCandidates.find(
      (c) => c.id.toLowerCase() === raw.toLowerCase() ||
             (c.referenceNumber && c.referenceNumber.toLowerCase() === raw.toLowerCase()) ||
             (c.trackNumber && c.trackNumber.toLowerCase() === raw.toLowerCase())
    );
    if (found) {
      toggleMergeCandidate(found);
      setManualMergeInput('');
      return;
    }
    try {
      const res = await fetchMergeCandidates(ticket.id, raw);
      const candidates = res.data.data || [];
      if (candidates.length > 0) {
        toggleMergeCandidate(candidates[0]);
        setManualMergeInput('');
      } else {
        flash(`No active ticket found matching "${raw}"`, true);
      }
    } catch {
      flash('Failed to find ticket', true);
    }
  };

  const handleConfirmMerge = async () => {
    if (!selectedMergeTickets.length || !ticket?.id) return;
    setMergingLoading(true);
    try {
      const sourceIds = selectedMergeTickets.map((t) => t.id);
      await call(
        () => mergeTickets(ticket.id, sourceIds, mergeNotes || undefined),
        `Merged ${selectedMergeTickets.length} ticket(s) into this ticket`
      );
      setMergeModal(false);
    } finally {
      setMergingLoading(false);
    }
  };

  const flash = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      showError(msg, 'Ticket Alert');
    } else {
      setMessage(msg);
      showSuccess(msg, 'Ticket Updated');
    }
    setTimeout(() => { setMessage(''); setError(''); }, 4000);
  };

  const getTransitions = (): TicketStatus[] => {
    if (!ticket || !user) return [];
    return TRANSITIONS[user.role]?.[ticket.status] || [];
  };

  const handleAssignDepartmentSubmit = async () => {
    if (!selectedDept || !ticket) return;
    const targetDeptObj = departments.find((d) => d.id === selectedDept);
    const targetDeptName = targetDeptObj?.name || 'Department';

    try {
      setAssigningDept(true);
      await assignDepartment(ticket.id, { departmentId: selectedDept, notes });
      setDeptModal(false);
      setNotes('');

      setAssignmentAlert({
        type: 'department',
        title: 'Department Assignment Confirmed',
        message: `Ticket ${ticket.referenceNumber || ticket.id} was successfully assigned to the ${targetDeptName} department. In-app alert notification and registered email have been dispatched.`,
        departmentName: targetDeptName,
        timestamp: new Date(),
      });

      flash(`✓ Ticket ${ticket.referenceNumber || ticket.id} was successfully assigned to ${targetDeptName}. In-app alert and registered email dispatched.`);
      await Promise.all([loadTicket(), loadReplies(), loadTimeline()]);
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Failed to assign department', true);
    } finally {
      setAssigningDept(false);
    }
  };

  const call = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      flash(okMsg);
      loadTicket(); loadReplies(); loadTimeline();
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Action failed', true);
    }
  };

  if (loading || !ticket) return (
    <div className={styles.page}>
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} />
        <p>Loading ticket details…</p>
      </div>
    </div>
  );

  const transitions = getTransitions();
  const role = user?.role as string;

  const totalTimelinePages = Math.max(1, Math.ceil(timeline.length / timelineLimit));
  const currentTimelinePage = Math.min(timelinePage, totalTimelinePages);
  const paginatedTimeline = timeline.slice(
    (currentTimelinePage - 1) * timelineLimit,
    currentTimelinePage * timelineLimit
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title={ticket.title}
        description={`${ticket.referenceNumber} · Track: ${ticket.trackNumber}`}
        backTo={base}
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      {assignmentAlert && (
        <div className={styles.assignmentSuccessAlert}>
          <div className={styles.assignmentSuccessAlertContent}>
            <div className={styles.assignmentSuccessAlertIcon}>
              🔔
            </div>
            <div className={styles.assignmentSuccessAlertBody}>
              <div className={styles.assignmentSuccessAlertTitleRow}>
                <span className={styles.assignmentSuccessAlertBadge}>ASSIGNMENT DISPATCHED</span>
                <strong className={styles.assignmentSuccessAlertTitle}>{assignmentAlert.title}</strong>
              </div>
              <p className={styles.assignmentSuccessAlertMsg}>{assignmentAlert.message}</p>
              <div className={styles.assignmentSuccessAlertMeta}>
                {assignmentAlert.departmentName && (
                  <span className={styles.assignmentSuccessAlertPill}>
                    🏢 Department: <strong>{assignmentAlert.departmentName}</strong>
                  </span>
                )}
                {assignmentAlert.managerName && (
                  <span className={styles.assignmentSuccessAlertPill}>
                    👤 Assigned {assignmentAlert.type === 'department' ? 'Manager' : 'Staff'}: <strong>{assignmentAlert.managerName}</strong>
                  </span>
                )}
                <span
                  className={styles.assignmentSuccessAlertPill}
                  style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                >
                  ✓ In-App Alert & Registered Email Notification Dispatched
                </span>
                <span className={styles.assignmentSuccessAlertTime}>
                  {assignmentAlert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles.assignmentSuccessAlertClose}
            onClick={() => setAssignmentAlert(null)}
            title="Dismiss notification alert"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <div className={styles.detailsCardHeader}>
            <div className={styles.detailsHeaderTitle}>
              <span className={styles.detailsHeaderIconWrapper}>
                <ClipboardDocumentListIcon />
              </span>
              <h3>Ticket Details</h3>
            </div>
            <span className={styles.detailsHeaderTag}>Live Info</span>
          </div>
          <div className={styles.detailsSection}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <ShieldCheckIcon className={styles.detailLabelIcon} />
                Status
              </span>
              <span className={styles.detailValue}>
                <span className={`${styles.badge} ${styles[getStatusClassName(ticket.status)] || styles[ticket.status]}`}>{getStatusLabel(ticket.status)}</span>
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <FlagIcon className={styles.detailLabelIcon} />
                Priority
              </span>
              <span className={styles.detailValue}>
                <span className={`${styles.priorityBadge} ${styles['priority_' + ticket.priority] || styles.priority_medium}`}>
                  {(ticket.priority as string) === 'urgent' || (ticket.priority as string) === 'critical' ? (
                    <ChevronDoubleUpIcon />
                  ) : ticket.priority === 'high' ? (
                    <ChevronDoubleUpIcon />
                  ) : ticket.priority === 'medium' ? (
                    <ChevronUpIcon />
                  ) : (
                    <ChevronDownIcon />
                  )}
                  {ticket.priority}
                </span>
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <TagIcon className={styles.detailLabelIcon} />
                Category
              </span>
              <span className={styles.detailValue}>
                <span className={styles.categoryChip}>
                  <TagIcon />
                  {ticket.category || '—'}
                </span>
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <BuildingOffice2Icon className={styles.detailLabelIcon} />
                Department
              </span>
              <span className={styles.detailValue}>
                {ticket.departmentName ? (
                  <span className={styles.deptChip}>
                    <BuildingOffice2Icon />
                    {ticket.departmentName}
                  </span>
                ) : (
                  <span className={styles.unassignedChip}>Unassigned</span>
                )}
              </span>
            </div>
            {(() => {
              const isAssignedToMe = isMe(ticket.assignedTo, (ticket as any).assignedToEmail, ticket.assignedToName);
              return (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>
                    <UserCircleIcon className={styles.detailLabelIcon} />
                    {isAssignedToMe ? 'Assigned To You' : 'Assigned To'}
                  </span>
                  <span className={styles.detailValue}>
                    {ticket.assignedToName ? (
                      <span className={styles.userChip}>
                        <UserCircleIcon />
                        {ticket.assignedToName}
                        {isAssignedToMe && <span className={styles.youBadge}>You</span>}
                      </span>
                    ) : (
                      <span className={styles.unassignedChip}>Unassigned</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {(() => {
              const staffAssignments = (ticket.assignments || []).filter((a) => a.role === 'staff') || [];
              const latestStaff = staffAssignments.length ? staffAssignments[staffAssignments.length - 1] : null;
              const latestHistory = (ticket.statusHistory || []).slice().reverse()[0];
              const isAssignedByMe = isMe(latestStaff?.assignedBy, null, latestStaff?.assignedByName);
              const isChangedByMe = isMe(latestHistory?.changedBy, null, latestHistory?.changedByName);
              return (
                <>
                  {latestStaff?.assignedByName && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>
                        <UserPlusIcon className={styles.detailLabelIcon} />
                        {isAssignedByMe ? 'Assigned By You' : 'Assigned By'}
                      </span>
                      <span className={styles.detailValue}>
                        <span className={styles.userChip}>
                          <UserPlusIcon />
                          {latestStaff.assignedByName}
                          {isAssignedByMe && <span className={styles.youBadge}>You</span>}
                        </span>
                      </span>
                    </div>
                  )}
                  {latestHistory?.changedByName && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>
                        <ArrowPathIcon className={styles.detailLabelIcon} />
                        {isChangedByMe ? 'Changed By You' : 'Changed By'}
                      </span>
                      <span className={styles.detailValue}>
                        <span className={styles.userChip}>
                          <UserCircleIcon />
                          {latestHistory.changedByName}
                          {isChangedByMe && <span className={styles.youBadge}>You</span>}
                        </span>
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <BuildingOfficeIcon className={styles.detailLabelIcon} />
                {isTenantUser ? 'Your Organization' : 'Tenant'}
              </span>
              <span className={styles.detailValue}>
                {ticket.tenantName ? (
                  <span className={styles.tenantChip}>
                    <BuildingOfficeIcon />
                    {ticket.tenantName}
                    {isMyTenantTicket && <span className={styles.youBadge}>You</span>}
                  </span>
                ) : (
                  <span className={styles.unassignedChip}>—</span>
                )}
              </span>
            </div>
            {(() => {
              const isCreatedByMe = isMe(ticket.createdBy, ticket.createdByEmail, ticket.createdByName);
              return (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>
                    <UserCircleIcon className={styles.detailLabelIcon} />
                    {isCreatedByMe ? 'Created By You' : 'Created By'}
                  </span>
                  <span className={styles.detailValue}>
                    {ticket.createdByName ? (
                      <span className={styles.userChip}>
                        <UserCircleIcon />
                        {ticket.createdByName}
                        {isCreatedByMe && <span className={styles.youBadge}>You</span>}
                      </span>
                    ) : (
                      <span className={styles.unassignedChip}>—</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {(() => {
              const emailVal = ticket.tenantEmail || ticket.createdByEmail;
              const isEmailMine = isTenantUser || isMe(null, emailVal, null);
              return (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>
                    <EnvelopeIcon className={styles.detailLabelIcon} />
                    {isEmailMine ? 'Your Email' : 'Tenant Email'}
                  </span>
                  <span className={styles.detailValue}>
                    {emailVal ? (
                      <a
                        href={`mailto:${emailVal}`}
                        className={styles.tenantEmailLink}
                        title={`Send email to ${emailVal}`}
                      >
                        <EnvelopeIcon className={styles.contactIconSmall} />
                        <span className={styles.emailText}>{emailVal}</span>
                        {isEmailMine && <span className={styles.youBadge}>You</span>}
                      </a>
                    ) : (
                      <span className={styles.unassignedChip}>—</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {(() => {
              const phoneVal = ticket.tenantPhone || ticket.createdByPhone;
              const isPhoneMine = isTenantUser || (Boolean(user?.phone && phoneVal && user.phone.trim() === phoneVal.trim()));
              return (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>
                    <PhoneIcon className={styles.detailLabelIcon} />
                    {isPhoneMine ? 'Your Contact' : 'Tenant Contact'}
                  </span>
                  <span className={styles.detailValue}>
                    {phoneVal ? (
                      <a
                        href={`tel:${phoneVal}`}
                        className={styles.tenantPhoneLink}
                        title={`Call ${phoneVal}`}
                      >
                        <PhoneIcon className={styles.contactIconSmall} />
                        <span>{phoneVal}</span>
                        {isPhoneMine && <span className={styles.youBadge}>You</span>}
                      </a>
                    ) : (
                      <span className={styles.unassignedChip}>—</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {ticket.tenantContactPerson && (() => {
              const isPrimaryMine = isTenantUser || isMe(null, null, ticket.tenantContactPerson);
              return (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>
                    <UserIcon className={styles.detailLabelIcon} />
                    {isPrimaryMine ? 'Your Name' : 'Primary Contact'}
                  </span>
                  <span className={styles.detailValue}>
                    <span className={styles.userChip}>
                      <UserIcon />
                      {ticket.tenantContactPerson}
                      {isPrimaryMine && <span className={styles.youBadge}>You</span>}
                    </span>
                  </span>
                </div>
              );
            })()}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <CalendarDaysIcon className={styles.detailLabelIcon} />
                Created
              </span>
              <span className={styles.detailValue}>
                <span className={styles.dateChip}>
                  <CalendarDaysIcon />
                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}
                </span>
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <ClockIcon className={styles.detailLabelIcon} />
                Updated
              </span>
              <span className={styles.detailValue}>
                <span className={styles.dateChip}>
                  <ClockIcon />
                  {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}
                </span>
              </span>
            </div>
            {(ticket as any).responseDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <BoltIcon className={styles.detailLabelIcon} />
                  First Response SLA
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date((ticket as any).responseDueDate).toLocaleString()}
                    </span>
                    <span className={(ticket as any).responseSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {(ticket as any).responseSlaBreached ? (
                        <>
                          <ExclamationTriangleIcon />
                          Breached
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon />
                          Target Met
                        </>
                      )}
                    </span>
                  </div>
                </span>
              </div>
            )}
            {ticket.dueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <ExclamationTriangleIcon className={styles.detailLabelIcon} />
                  Resolution SLA Due
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date(ticket.dueDate).toLocaleString()}
                    </span>
                    <span
                      className={
                        ticket.isOverdue
                          ? styles.slaBadgeBreached
                          : ticket.remainingMs != null && ticket.remainingMs < 3.6e6
                          ? styles.slaBadgeImminent
                          : styles.slaBadgeOk
                      }
                    >
                      {ticket.isOverdue ? (
                        <>
                          <ExclamationTriangleIcon />
                          Overdue ({formatRemaining(ticket.remainingMs)})
                        </>
                      ) : ticket.remainingMs != null && ticket.remainingMs < 3.6e6 ? (
                        <>
                          <ClockIcon />
                          Due Soon ({formatRemaining(ticket.remainingMs)})
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon />
                          On Track ({formatRemaining(ticket.remainingMs)})
                        </>
                      )}
                    </span>
                  </div>
                </span>
              </div>
            )}
            {(ticket as any).escalationDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <ArrowTrendingUpIcon className={styles.detailLabelIcon} />
                  Escalation SLA Due
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date((ticket as any).escalationDueDate).toLocaleString()}
                    </span>
                    <span className={(ticket as any).escalationSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {(ticket as any).escalationSlaBreached ? (
                        <>
                          <ExclamationTriangleIcon />
                          Breached
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon />
                          Scheduled
                        </>
                      )}
                    </span>
                  </div>
                </span>
              </div>
            )}
          </div>
        </div>

      {(role === 'admin' || role === 'ceo' || role === 'manager' || role === 'staff') && (() => {
        const isClosed = ticket.status === 'closed' || (ticket as any).status === 'escalated.closed';
        if (isClosed) {
          return (
            <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <span>🔒</span> Ticket Actions Locked
              </h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0' }}>
                This ticket is <strong>Closed (Inactive)</strong>. Normal ticket processing, assignment, and status modifications are disabled.
                {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') ? ' A tenant reopening request is currently pending review below.' : ''}
              </p>
            </div>
          );
        }

        const isWaitingTenant = ticket.status === 'waiting_tenant' || (ticket as any).status === 'escalated.waiting_tenant';
        const canReopen =
          (role === 'admin' || role === 'ceo' || role === 'manager') &&
          !isWaitingTenant &&
          ['resolved', 'closed', 'completed'].includes(ticket.status);

        const hasWorkflowActions =
          transitions.length > 0 ||
          ((role === 'admin' || role === 'ceo') && (ticket.routingType ?? 'general') !== 'direct') ||
          (role === 'manager' && !!ticket.departmentId) ||
          ((role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open')) ||
          (role === 'staff' && ticket.status === 'in_progress') ||
          (role === 'manager' && (ticket.status === 'under_review' || ticket.status === 'in_progress')) ||
          ((role === 'admin' || role === 'ceo') && (ticket.status === 'pending_approval' || ticket.status === 'in_progress' || ticket.status === 'under_review')) ||
          transitions.includes('closed') ||
          (transitions.includes('reopened') && canReopen);

        const hasManagementActions = role === 'admin' || role === 'ceo' || role === 'manager';

        return (
          <div className={styles.card}>
            <h3>
              <span>⚡</span> Ticket Actions
            </h3>
            <div className={styles.actionsSection}>
              {role === 'admin' && (
                <div className={ticket.departmentId ? styles.deptInfoBanner : styles.deptWarnBanner}>
                  {ticket.departmentId ? (
                    <>
                      <BuildingOffice2Icon className={styles.bannerIcon} />
                      <span>
                        Assigned to <strong>{ticket.departmentName}</strong>. Department manager is responsible for delegating staff.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.bannerIconEmoji}>📌</span>
                      <span>
                        Assign this ticket to a department. The department manager will assign and oversee staff.
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className={styles.actionClusters}>
                {/* Cluster 1: Lifecycle & Workflow */}
                {hasWorkflowActions && (
                  <div className={styles.actionCluster}>
                    <div className={styles.clusterHeader}>
                      <span className={styles.clusterDotWorkflow} />
                      <span className={styles.clusterLabel}>Lifecycle & Assignment</span>
                    </div>
                    <div className={styles.btnClusterRow}>
                      {transitions.length > 0 && (
                        <button
                          className={styles.btnPrimary}
                          onClick={() => { setNewStatus(transitions[0]); setStatusModal(true); }}
                          title="Transition ticket to next workflow status"
                        >
                          <ArrowPathIcon className={styles.btnIcon} />
                          Update Status
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          className={styles.btnInfo}
                          onClick={() => {
                            if (isWaitingTenant) {
                              flash('Cannot assign department: Ticket is waiting for tenant response/confirmation.', true);
                              return;
                            }
                            setDeptModal(true);
                          }}
                          disabled={ticket.isOverdue || isWaitingTenant}
                          title={isWaitingTenant ? 'Cannot assign department: Ticket is waiting for tenant response/confirmation' : (ticket.isOverdue ? 'Cannot assign department: SLA overdue' : 'Assign Department')}
                        >
                          <BuildingOffice2Icon className={styles.btnIcon} />
                          Assign Dept
                        </button>
                      )}
                      {role === 'manager' && ticket.departmentId && (
                        <button
                          className={styles.btnInfo}
                          onClick={() => {
                            if (isWaitingTenant) {
                              flash('Cannot assign staff: Ticket is waiting for tenant response/confirmation.', true);
                              return;
                            }
                            setStaffModal(true);
                          }}
                          disabled={ticket.isOverdue || isWaitingTenant}
                          title={isWaitingTenant ? 'Cannot assign staff: Ticket is waiting for tenant response/confirmation' : (ticket.isOverdue ? 'Cannot assign staff: SLA overdue' : 'Assign Staff')}
                        >
                          <UserPlusIcon className={styles.btnIcon} />
                          Assign Staff
                        </button>
                      )}
                      {(role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open') && (
                        <button
                          className={styles.btnSuccess}
                          onClick={() => call(() => acceptAssignment(ticket.id), 'Assignment accepted')}
                          title="Accept ticket assignment"
                        >
                          <CheckCircleIcon className={styles.btnIcon} />
                          Accept
                        </button>
                      )}
                      {(role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open') && (
                        <button
                          className={styles.btnReject}
                          onClick={() => call(() => rejectAssignment(ticket.id), 'Assignment rejected')}
                          title="Reject ticket assignment"
                        >
                          <XCircleIcon className={styles.btnIcon} />
                          Reject
                        </button>
                      )}

                      {/* Staff: Resolve submits to Dept Manager */}
                      {role === 'staff' && ticket.status === 'in_progress' && (
                        <button
                          className={styles.btnEmerald}
                          onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution submitted for Department Manager approval!')}
                          title="Submit work for Department Manager approval"
                        >
                          <CheckCircleIcon className={styles.btnIcon} />
                          Resolve
                        </button>
                      )}

                      {/* Manager: approve/reject staff resolution */}
                      {role === 'manager' && ticket.status === 'under_review' && (
                        <>
                          <button
                            className={styles.btnEmerald}
                            onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution approved! Forwarded to Admin for verification.')}
                            title="Approve staff resolution and forward to Admin"
                          >
                            <CheckBadgeIcon className={styles.btnIcon} />
                            Approve Resolution
                          </button>
                          <button
                            className={styles.btnReject}
                            onClick={() => call(() => rejectResolution(ticket.id, notes || 'Department Manager requested rework'), 'Rework requested.')}
                            title="Request staff rework"
                          >
                            <ArrowUturnLeftIcon className={styles.btnIcon} />
                            Request Rework
                          </button>
                        </>
                      )}
                      {role === 'manager' && ticket.status === 'in_progress' && (
                        <button
                          className={styles.btnEmerald}
                          onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution submitted for Admin verification.')}
                          title="Resolve and forward to Admin"
                        >
                          <CheckCircleIcon className={styles.btnIcon} />
                          Resolve
                        </button>
                      )}

                      {/* Admin / CEO: verify & resolve or return for revision */}
                      {(role === 'admin' || role === 'ceo') && ticket.status === 'pending_approval' && (
                        <>
                          <button
                            className={styles.btnEmerald}
                            onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution verified! Marked Resolved and routed to tenant for confirmation.')}
                            title="Verify resolution and route to tenant for final confirmation"
                          >
                            <CheckBadgeIcon className={styles.btnIcon} />
                            Verify & Resolve
                          </button>
                          <button
                            className={styles.btnReject}
                            onClick={() => call(() => rejectResolution(ticket.id, notes || 'Admin returned for revision'), 'Returned for revision.')}
                            title="Return for revision"
                          >
                            <ArrowUturnLeftIcon className={styles.btnIcon} />
                            Return for Revision
                          </button>
                        </>
                      )}
                      {(role === 'admin' || role === 'ceo') && (ticket.status === 'in_progress' || ticket.status === 'under_review') && (
                        <button
                          className={styles.btnEmerald}
                          onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Ticket resolved and routed to tenant for confirmation')}
                          title="Resolve ticket and route to tenant for confirmation"
                        >
                          <CheckCircleIcon className={styles.btnIcon} />
                          Resolve
                        </button>
                      )}

                      {transitions.includes('closed') && (
                        <button
                          className={styles.btnDark}
                          onClick={() => call(() => closeTicket(ticket.id, notes || undefined), 'Closed')}
                          title="Close ticket"
                        >
                          <XMarkIcon className={styles.btnIcon} />
                          Close
                        </button>
                      )}
                      {transitions.includes('reopened') && canReopen && (
                        <button
                          className={styles.btnAmber}
                          onClick={() => { setReopenReason(''); setReopenModal(true); }}
                          title="Reopen ticket"
                        >
                          <ArrowPathIcon className={styles.btnIcon} />
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Cluster 2: Management & Properties */}
                {hasManagementActions && (
                  <div className={styles.actionCluster}>
                    <div className={styles.clusterHeader}>
                      <span className={styles.clusterDotProperties} />
                      <span className={styles.clusterLabel}>Properties & Routing</span>
                    </div>
                    <div className={styles.btnClusterRow}>
                      {(role === 'admin' || role === 'ceo') && (
                        <button
                          className={styles.btnAmber}
                          onClick={() => setPriorityModal(true)}
                          title="Change Ticket Priority"
                        >
                          <FlagIcon className={styles.btnIcon} />
                          Change Priority
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          className={styles.btnRose}
                          onClick={() => setCategoryModal(true)}
                          title="Change Ticket Category"
                        >
                          <TagIcon className={styles.btnIcon} />
                          Change Category
                        </button>
                      )}
                      {(role === 'admin' || role === 'ceo' || role === 'manager') && (
                        <button
                          className={styles.btnOrange}
                          onClick={() => call(() => escalateTicket(ticket.id, notes || undefined), 'Escalated')}
                          title="Escalate ticket to higher authority"
                        >
                          <ArrowTrendingUpIcon className={styles.btnIcon} />
                          Escalate
                        </button>
                      )}
                      {(role === 'admin' || role === 'ceo') && (
                        <button
                          className={styles.btnIndigo}
                          onClick={() => setMergeModal(true)}
                          title="Merge ticket into another"
                        >
                          <ArrowsRightLeftIcon className={styles.btnIcon} />
                          Merge
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Cluster 3: Collaboration & Files */}
                <div className={styles.actionCluster}>
                  <div className={styles.clusterHeader}>
                    <span className={styles.clusterDotCollab} />
                    <span className={styles.clusterLabel}>Collaboration & Updates</span>
                  </div>
                  <div className={styles.btnClusterRow}>
                    <button
                      className={styles.btnSlate}
                      onClick={() => setNoteModal(true)}
                      title="Add an internal staff note"
                    >
                      <ChatBubbleLeftRightIcon className={styles.btnIcon} />
                      Internal Note
                    </button>
                    <button
                      className={styles.btnInfoOutline}
                      onClick={() => setAttachModal(true)}
                      title="Upload file attachment"
                    >
                      <PaperClipIcon className={styles.btnIcon} />
                      Upload File
                    </button>
                  </div>
                </div>
              </div>

              {ticket.isOverdue && (
                <div className={styles.slaInlineWarning}>
                  ⚠️ <strong>SLA Overdue:</strong> This ticket has passed its resolution deadline. Assignments and routing actions are restricted until the SLA is resolved or the ticket is escalated.
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </div>

      {/* Escalation Banner */}
      {ticket.isEscalated && ticket.status === 'escalated' && (
        <div className={`${styles.card} ${styles.slaDangerCard}`}>
          <h3><span>🚨</span> Ticket Escalated</h3>
          <p>
            This ticket has been <strong>automatically escalated</strong> due to an SLA breach.
            {ticket.escalatedAt && <> Escalated at: <strong>{new Date(ticket.escalatedAt).toLocaleString()}</strong>.</>}
            {' '}Urgent attention required.
          </p>
        </div>
      )}

      {/* Under Review Banner */}
      {ticket.status === 'under_review' && (
        <div className={`${styles.card} ${styles.slaWarningCard}`} style={{ borderLeft: '4px solid #a855f7' }}>
          <h3><span>📋</span> {role === 'manager' ? 'Staff Resolution Awaiting Your Approval' : 'Resolution Under Department Review'}</h3>
          <p>
            {role === 'manager'
              ? `Staff member ${ticket.assignedToName || 'assigned staff'} has resolved the issue and submitted it for your department approval. Please review the work and either approve it to forward to Admin, or request rework.`
              : role === 'staff'
              ? 'You have submitted this ticket for resolution. It is currently under review by your Department Manager.'
              : 'Staff has resolved this ticket. Awaiting review and approval by the Department Manager.'}
          </p>
          {role === 'manager' && (
            <div className={styles.btnRow} style={{ marginTop: '12px' }}>
              <button
                className={styles.btnSuccess}
                onClick={() => call(() => markResolved(ticket.id, notes || 'Department Manager approved resolution'), 'Resolution approved! Forwarded to Admin for verification.')}
              >
                ✅ Approve Resolution (Send to Admin)
              </button>
              <button
                className={styles.btnReject}
                onClick={() => call(() => rejectResolution(ticket.id, notes || 'Department Manager requested rework'), 'Ticket returned to In Progress for staff rework.')}
              >
                🔄 Request Rework (Return to Staff)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Admin Approval Banner */}
      {ticket.status === 'pending_approval' && (
        <div className={`${styles.card} ${styles.slaWarningCard}`} style={{ borderLeft: '4px solid #3b82f6' }}>
          <h3><span>🛡️</span> {(role === 'admin' || role === 'ceo') ? 'Resolution Awaiting Admin Verification' : 'Pending Administrative Verification'}</h3>
          <p>
            {(role === 'admin' || role === 'ceo')
              ? 'Department Manager has approved the resolution. Verify the solution and click "Verify & Resolve" to mark it Resolved and notify the tenant for confirmation.'
              : role === 'manager'
              ? 'You approved this resolution. It is now awaiting final verification by an Administrator before the tenant is notified.'
              : 'Department Manager approved the resolution. Awaiting Administrator verification.'}
          </p>
          {(role === 'admin' || role === 'ceo') && (
            <div className={styles.btnRow} style={{ marginTop: '12px' }}>
              <button
                className={styles.btnEmerald}
                onClick={() => call(() => markResolved(ticket.id, notes || 'Admin verified resolution'), 'Resolution verified! Marked Resolved and routed to tenant for confirmation.')}
              >
                ✅ Verify & Resolve (Notify Tenant)
              </button>
              <button
                className={styles.btnReject}
                onClick={() => call(() => rejectResolution(ticket.id, notes || 'Admin returned for revision'), 'Returned for revision.')}
              >
                🔄 Return for Revision
              </button>
            </div>
          )}
        </div>
      )}

      {/* Waiting for Tenant Banner */}
      {(role === 'admin' || role === 'ceo' || role === 'manager' || role === 'staff') && (ticket.status === 'waiting_tenant' || (ticket as any).status === 'escalated.waiting_tenant') && (
        <div className={`${styles.card} ${styles.slaWarningCard}`}>
          <h3><span>⏳</span> Waiting for Tenant Confirmation</h3>
          <p>
            The ticket has been resolved by our team and verified by Admin. Waiting for the tenant to inspect the resolution, rate satisfaction, and confirm if the issue is solved.
          </p>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#b45309', fontWeight: 600 }}>
            🔒 Department assignment and status modifications are locked until the tenant responds or confirms the resolution.
          </div>
        </div>
      )}

      {/* Closed & Inactive Status Card */}
      {(ticket.status === 'closed' || ticket.status === 'completed') && (
        <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
              <span>🔒</span> Ticket Closed (Inactive)
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>
              Read-Only
            </span>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: '6px 0 14px' }}>
            All work has been completed and verified. This ticket is closed and inactive. Normal processing, assignments, and status modifications are disabled.
          </p>

          {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#92400e', fontSize: '15px' }}>
                  <span>⏳</span> Reopening Request from Tenant (Pending Approval)
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309' }}>
                  Awaiting Review
                </span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Reason for Reopening:
                </div>
                <div style={{ fontSize: '14px', color: '#1c1917', lineHeight: 1.5 }}>
                  {(ticket.reopenRequestReason || ticket.reopen_request_reason || 'No details provided')}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#78350f', marginBottom: '12px' }}>
                {(ticket.reopenRequestedAt || ticket.reopen_requested_at) && (
                  <div>
                    <strong>Requested:</strong> {new Date(ticket.reopenRequestedAt || ticket.reopen_requested_at || '').toLocaleString()}
                  </div>
                )}
                {(ticket.reopenRequestedByName || ticket.reopen_requested_by_name) && (
                  <div>
                    <strong>Requester:</strong> {ticket.reopenRequestedByName || ticket.reopen_requested_by_name}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className={styles.btnApprove}
                  onClick={() => call(() => approveReopenTicket(ticket.id), 'Ticket Reopening Approved! Active processing resumed.')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                >
                  <CheckCircleIcon style={{ width: 18, height: 18 }} />
                  Approve Reopening
                </button>
                <button
                  type="button"
                  className={styles.btnReject}
                  onClick={() => {
                    setDeclineReason('');
                    setDeclineModal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                >
                  <XMarkIcon style={{ width: 18, height: 18 }} />
                  Decline Request
                </button>
              </div>
            </div>
          )}

          {(ticket.reopenStatus === 'rejected' || ticket.reopen_status === 'rejected') && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginTop: '10px', fontSize: '13px', color: '#991b1b' }}>
              ℹ️ Previous reopening request was reviewed and declined. The ticket remains closed.
            </div>
          )}
        </div>
      )}

      {/* Reopened Status Card */}
      {ticket.status === 'reopened' && (
        <div className={`${styles.card} ${styles.reopenedCard}`}>
          <div className={styles.reopenedCardHeader}>
            <h3 className={styles.reopenedCardTitle}>
              <span>🔄</span> Ticket Reopened
            </h3>
            <span className={styles.reopenedBadge}>
              <span>⚠️</span> Action Required
            </span>
          </div>
          <p className={styles.reopenedDescription}>
            This ticket has been reopened for additional work because the issue was unresolved, recurred, or the proposed solution was rejected.
          </p>
          {(ticket.reopenReason || ticket.reopen_reason) && (
            <div className={styles.reopenedReasonBox}>
              <span className={styles.reopenedReasonLabel}>Reason for Reopening:</span>
              <p className={styles.reopenedReasonText}>{ticket.reopenReason || ticket.reopen_reason}</p>
            </div>
          )}
          <div className={styles.reopenedMetaGrid}>
            {(ticket.reopenedAt || ticket.reopened_at) && (
              <div className={styles.reopenedMetaItem}>
                <span className={styles.reopenedMetaLabel}>Reopened:</span>
                <span className={styles.reopenedMetaValue}>{new Date(ticket.reopenedAt || ticket.reopened_at || "").toLocaleString()}</span>
              </div>
            )}
            {(ticket.reopenedByName || ticket.reopened_by_name) && (
              <div className={styles.reopenedMetaItem}>
                <span className={styles.reopenedMetaLabel}>Reopened By:</span>
                <span className={styles.reopenedMetaValue}>{ticket.reopenedByName || ticket.reopened_by_name}</span>
              </div>
            )}
            {ticket.dueDate && (
              <div className={styles.reopenedMetaItem}>
                <span className={styles.reopenedMetaLabel}>Resumed SLA Target:</span>
                <span className={styles.reopenedMetaValue}>{new Date(ticket.dueDate).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tenant Contact Information Table Card */}
      <div className={styles.card}>
        <div className={styles.detailsCardHeader}>
          <div className={styles.detailsHeaderTitle}>
            <span className={styles.detailsHeaderIconWrapper}>
              <BuildingOffice2Icon />
            </span>
            <h3>Tenant & Requester Contact Information</h3>
          </div>
          <span className={styles.detailsHeaderTag}>Auto-Fetched</span>
        </div>
        <div className={styles.tenantContactTableWrapper}>
          <table className={styles.tenantContactTable}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Property</th>
                <th style={{ width: '50%' }}>Contact Information</th>
                <th style={{ width: '25%' }}>Source / Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Tenant Organization</strong></td>
                <td>
                  <span className={styles.tenantChip}>
                    <BuildingOfficeIcon />
                    {ticket.tenantName || 'Standard Tenant'}
                  </span>
                </td>
                <td><span className={styles.autoFetchedPill}>✓ Organization Record</span></td>
              </tr>
              <tr>
                <td><strong>Ticket Creator (Requester)</strong></td>
                <td>
                  <span className={styles.userChip}>
                    <UserCircleIcon />
                    {ticket.createdByName || '—'}
                  </span>
                </td>
                <td><span className={styles.autoFetchedPill}>✓ Ticket Submitter</span></td>
              </tr>
              {ticket.tenantContactPerson && (
                <tr>
                  <td><strong>Primary Contact Person</strong></td>
                  <td>
                    <span>{ticket.tenantContactPerson}</span>
                  </td>
                  <td><span className={styles.autoFetchedPill}>✓ Organization Contact</span></td>
                </tr>
              )}
              <tr>
                <td><strong>Tenant / Creator Email</strong></td>
                <td>
                  {(ticket.tenantEmail || ticket.createdByEmail) ? (
                    <a
                      href={`mailto:${ticket.tenantEmail || ticket.createdByEmail}`}
                      className={styles.tenantEmailLink}
                      title={`Send email to ${ticket.tenantEmail || ticket.createdByEmail}`}
                    >
                      <EnvelopeIcon className={styles.contactIconSmall} />
                      <span className={styles.emailTextStrong}>{ticket.tenantEmail || ticket.createdByEmail}</span>
                    </a>
                  ) : (
                    <span className={styles.textMuted}>No email on record</span>
                  )}
                </td>
                <td>
                  {(ticket.tenantEmail || ticket.createdByEmail) && (
                    <span className={styles.autoFetchedPill}>✓ Direct Email Link</span>
                  )}
                </td>
              </tr>
              <tr>
                <td><strong>Tenant / Creator Phone</strong></td>
                <td>
                  {(ticket.tenantPhone || ticket.createdByPhone) ? (
                    <a
                      href={`tel:${ticket.tenantPhone || ticket.createdByPhone}`}
                      className={styles.tenantPhoneLink}
                      title={`Call ${ticket.tenantPhone || ticket.createdByPhone}`}
                    >
                      <PhoneIcon className={styles.contactIconSmall} />
                      <span className={styles.phoneTextStrong}>{ticket.tenantPhone || ticket.createdByPhone}</span>
                    </a>
                  ) : (
                    <span className={styles.textMuted}>No phone number on record</span>
                  )}
                </td>
                <td>
                  {(ticket.tenantPhone || ticket.createdByPhone) && (
                    <span className={styles.autoFetchedPill}>✓ Direct Telephone Link</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <h3>📝 Description</h3>
        <p className={styles.description}>{ticket.description}</p>
      </div>

      {ticket.attachments && ticket.attachments.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.attachmentsCardHeader}>
            <div className={styles.attachmentsCardTitleGroup}>
              <span className={styles.attachmentsHeaderIcon}>📎</span>
              <h3>Attachments ({ticket.attachments.length})</h3>
            </div>
            <button
              type="button"
              className={styles.uploadAttachQuickBtn}
              onClick={() => setAttachModal(true)}
              title="Upload new attachment"
            >
              <PaperClipIcon className={styles.btnIcon} />
              + Upload File
            </button>
          </div>

          <div className={styles.attachmentsGrid}>
            {ticket.attachments.map((file) => {
              const fileName = file.fileName || (file as any).file_name || 'Attachment';
              const rawPath = file.filePath || (file as any).file_path || '';
              const fileUrl = buildAttachmentUrl(rawPath) || (rawPath.startsWith('http') ? rawPath : `${API_BASE}${rawPath}`);
              const uploaderName = file.uploadedByName || (file as any).uploaded_by_name || 'User';
              const uploaderRole = file.uploadedByRole || (file as any).uploaded_by_role || '';
              const comment = file.comment || (file as any).comment || null;
              const dateStr = file.createdAt || (file as any).created_at;
              const sizeStr = formatFileSize(file.fileSize || (file as any).file_size);
              const isImage = (file.mimeType || (file as any).mime_type || '').startsWith('image/') ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);

              return (
                <div key={file.id} className={styles.attachmentCard}>
                  {/* Top: File info and action buttons */}
                  <div className={styles.attachmentTop}>
                    <div className={styles.attachmentIconBox}>
                      {isImage ? (
                        <PhotoIcon className={styles.attachmentFileIcon} />
                      ) : (
                        <DocumentIcon className={styles.attachmentFileIcon} />
                      )}
                    </div>
                    <div className={styles.attachmentDetails}>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.attachmentFileName}
                        title={`Click to open: ${fileName}`}
                      >
                        {fileName}
                      </a>
                      <div className={styles.attachmentSubMeta}>
                        {sizeStr && <span className={styles.attachmentSize}>{sizeStr}</span>}
                        {sizeStr && dateStr && <span>•</span>}
                        {dateStr && (
                          <span className={styles.attachmentDate}>
                            {new Date(dateStr).toLocaleDateString()} {new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.attachmentActions}>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.attachmentActionBtn}
                        title="View file in new tab"
                      >
                        <EyeIcon className={styles.attachmentActionIcon} />
                      </a>
                      <a
                        href={fileUrl}
                        download={fileName}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.attachmentActionBtn}
                        title="Download file"
                      >
                        <ArrowDownTrayIcon className={styles.attachmentActionIcon} />
                      </a>
                    </div>
                  </div>

                  {/* Optional Image Thumbnail Preview */}
                  {isImage && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.attachmentThumbContainer}
                      title="Click to view full image"
                    >
                      <img src={fileUrl} alt={fileName} className={styles.attachmentThumb} loading="lazy" />
                    </a>
                  )}

                  {/* Middle: Uploader Badge */}
                  <div className={styles.attachmentUploaderRow}>
                    <div className={styles.attachmentUploaderUser}>
                      <UserCircleIcon className={styles.uploaderAvatarIcon} />
                      <span className={styles.uploaderName}>
                        {uploaderName}
                        {isMe(file.uploadedBy || (file as any).uploaded_by, (file as any).uploaderEmail, uploaderName) && <span className={styles.youBadge}>You</span>}
                      </span>
                      {uploaderRole && (
                        <span className={`${styles.uploaderRoleBadge} ${styles['role_' + uploaderRole.toLowerCase()] || styles.role_default}`}>
                          {uploaderRole.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Why the file was uploaded (Warning Alert / Reason) */}
                  <div className={styles.attachmentCommentBox} role="alert">
                    <div className={styles.commentBoxHeader}>
                      <div className={styles.commentBoxLabel}>
                        <ExclamationTriangleIcon className={styles.commentBoxIcon} />
                        <span>Why Uploaded / Comment:</span>
                      </div>
                      <span className={styles.commentBoxNoticeBadge}>Uploader Note</span>
                    </div>
                    <p className={styles.commentBoxText}>
                      {comment || <span className={styles.commentBoxMuted}>No reason or explanation provided with this file</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.attachmentsCardHeader}>
            <div className={styles.attachmentsCardTitleGroup}>
              <span className={styles.attachmentsHeaderIcon}>📎</span>
              <h3>Attachments (0)</h3>
            </div>
            <button
              type="button"
              className={styles.uploadAttachQuickBtn}
              onClick={() => setAttachModal(true)}
              title="Upload new attachment"
            >
              <PaperClipIcon className={styles.btnIcon} />
              + Upload File
            </button>
          </div>
          <div className={styles.attachmentsEmptyBox}>
            <PaperClipIcon className={styles.attachmentsEmptyIcon} />
            <p>No files attached to this ticket yet.</p>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Upload screenshots, documents, or diagnostics with a comment explaining why.
            </span>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h3>💬 Comments & Replies {role !== 'tenant' ? <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>(🔒 Internal notes are hidden from tenants)</span> : ''}</h3>
        {replies.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No replies yet.</p>}
        <ul className={styles.replies}>
          {replies.map((reply) => {
            const v = reply.visibility;
            const isPrivate = v === 'internal' || v === 'department' || !!reply.isInternal;
            const isTenantReply = reply.userRole === 'tenant';
            const isDirect = ticket?.routingType === 'direct';

            let label = '📢 Public';
            let badgeClass = styles.badgePublic;

            if (reply.targetUserId) {
              label = `🎯 To Staff: ${reply.targetUserName || 'Staff'}`;
              badgeClass = styles.badgeTargetStaff;
            } else if (isTenantReply) {
              if (isDirect) {
                label = '🏢 Direct to Dept Manager';
                badgeClass = styles.badgeDirectDept;
              } else {
                label = '🛡️ Routed to Admin';
                badgeClass = styles.badgeGeneralAdmin;
              }
            } else if (reply.userRole === 'staff') {
              label = '👔 Staff to Manager';
              badgeClass = styles.badgeInternal;
            } else if (v === 'tenant') {
              label = '👤 Tenant Only';
              badgeClass = styles.badgePublic;
            } else if (v === 'department') {
              label = '🏢 Department';
              badgeClass = styles.badgeInternal;
            } else if (v === 'both') {
              label = '👤🏢 Tenant & Dept';
              badgeClass = styles.badgePublic;
            } else if (v === 'internal') {
              label = '🔒 Internal';
              badgeClass = styles.badgeInternal;
            }

            return (
              <li key={reply.id} className={isPrivate ? styles.internal : styles.replyItem}>
                <div className={styles.replyHeader}>
                  <strong className={styles.replyAuthor}>{reply.userName || 'System'}</strong>
                  <span className={badgeClass}>{label}</span>
                  <span className={styles.time}>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                </div>
                <p className={styles.replyMessage}>{reply.message}</p>
              </li>
            );
          })}
        </ul>
        <ReplyForm
          ticketId={ticket.id}
          ticket={ticket}
          onReplyAdded={loadReplies}
          assignPrefill={assignPrefill}
          onClearPrefill={() => setAssignPrefill(null)}
        />
      </div>

      <div className={styles.card}>
        <div className={styles.timelineHeaderRow}>
          <h3>
            📊 Timeline
            <span className={styles.timelineBadge}>{timeline.length}</span>
          </h3>
          {timeline.length > 0 && (
            <div className={styles.timelineControls}>
              <label className={styles.perPageLabel}>
                Show:
                <select
                  value={timelineLimit}
                  onChange={(e) => {
                    setTimelineLimit(Number(e.target.value));
                    setTimelinePage(1);
                  }}
                  className={styles.limitSelect}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {timeline.length === 0 ? (
          <p className={styles.emptyTimeline}>No timeline events recorded yet.</p>
        ) : (
          <>
            <div className={styles.timelineContainer}>
              <ul className={styles.timeline}>
                {paginatedTimeline.map((ev) => {
                  const matchedAttachment = ticket.attachments?.find(
                    (att) => att.fileName === ev.message || (att.filePath && ev.filePath === att.filePath)
                  );
                  const downloadUrl = ev.filePath
                    ? `${API_BASE}${ev.filePath}`
                    : matchedAttachment
                    ? `${API_BASE}${matchedAttachment.filePath}`
                    : null;
                  const isImage = !!ev.message?.match(/\.(png|jpe?g|gif|webp|svg)$/i);

                  return (
                    <li key={ev.id}>
                      <div className={styles.timelineEvent}>
                        <div className={styles.timelineHeader}>
                          <div className={styles.timelineActorWrapper}>
                            <strong className={styles.timelineActor}>{ev.actorName || 'System'}</strong>
                            <span className={`${styles.timelineKind} ${styles[`kind-${ev.kind}` as keyof typeof styles]}`}>
                              {ev.kind === 'attachment' && <span className={styles.kindIcon}>📎</span>}
                              {ev.kind === 'status' && <span className={styles.kindIcon}>🔄</span>}
                              {ev.kind === 'assignment' && <span className={styles.kindIcon}>👤</span>}
                              {ev.kind === 'comment' && <span className={styles.kindIcon}>💬</span>}
                              <span className={styles.kindLabel}>{ev.kind}</span>
                            </span>
                          </div>
                          <span className={styles.timelineTime}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                        </div>
                        {ev.kind === 'status' && (
                          <div className={styles.timelineMessage}>
                            {ev.fromStatus ? getStatusLabel(ev.fromStatus) : 'Created'} → {getStatusLabel(ev.toStatus)}
                          </div>
                        )}
                        {ev.kind === 'comment' && (
                          <div className={styles.timelineMessage}>
                            {(ev.visibility === 'internal' ? '[Internal] ' : '') + (ev.message || '')}
                          </div>
                        )}
                        {ev.kind === 'attachment' && (
                          <div className={styles.timelineAttachmentSection}>
                            <div className={styles.timelineAttachmentCard}>
                              <div className={styles.timelineAttachmentIconWrapper}>
                                {isImage ? '🖼️' : '📄'}
                              </div>
                              <div className={styles.timelineAttachmentDetails}>
                                <span className={styles.timelineAttachmentAction}>Uploaded attachment</span>
                                <span className={styles.timelineAttachmentFileName} title={ev.message}>{ev.message}</span>
                              </div>
                              {downloadUrl && (
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={styles.timelineAttachmentDownloadBtn}
                                  title="View or download file"
                                >
                                  <span>View File</span>
                                  <span className={styles.downloadIcon}>↗</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {ev.kind === 'assignment' && (
                          <div className={styles.timelineMessage}>{ev.role} assignment {ev.status}</div>
                        )}
                        {ev.notes && <div className={styles.timelineNotes}>📌 {ev.notes}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={styles.timelinePagination}>
              <span className={styles.paginationInfo}>
                Showing {(currentTimelinePage - 1) * timelineLimit + 1} – {Math.min(currentTimelinePage * timelineLimit, timeline.length)} of {timeline.length} events
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={currentTimelinePage <= 1}
                  onClick={() => setTimelinePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className={styles.pageNumberIndicator}>
                  Page {currentTimelinePage} of {totalTimelinePages}
                </span>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={currentTimelinePage >= totalTimelinePages}
                  onClick={() => setTimelinePage((p) => Math.min(totalTimelinePages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={statusModal} title="Update Ticket Status" onClose={() => setStatusModal(false)}>
        <div className={styles.modalForm}>
          <label>New Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TicketStatus)}>
            {transitions.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={() => call(() => changeTicketStatus(ticket.id, { status: newStatus, notes }), 'Status updated')}>Save</button>
        </div>
      </Modal>

      <Modal open={deptModal} title="Assign Department" onClose={() => { setDeptModal(false); setNotes(''); }}>
        <div className={styles.modalForm}>
          <label>Department</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">Select Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional directives, instructions, or notes for the assigned department..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => { setDeptModal(false); setNotes(''); }}
              style={{
                background: 'var(--ceo-surface, #ffffff)',
                color: 'var(--ceo-text-secondary, #475569)',
                border: '1px solid var(--ceo-border, #cbd5e1)',
                borderRadius: '8px',
                padding: '9px 18px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedDept || assigningDept}
              onClick={handleAssignDepartmentSubmit}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 24px',
                cursor: (!selectedDept || assigningDept) ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                opacity: (!selectedDept || assigningDept) ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              }}
            >
              {assigningDept ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={staffModal}
        title={ticket?.assignedTo ? "Reassign Staff" : "Assign Staff"}
        onClose={() => { setStaffModal(false); setSelectedStaff(''); setNotes(''); }}
        maxWidth="500px"
      >
        <div className={styles.modalForm}>
          {ticket?.assignedTo && (
            <div className={styles.assignmentCurrentBox}>
              <UserIcon className={styles.assignmentCurrentIcon} />
              <span className={styles.assignmentCurrentLabel}>Currently Assigned:</span>
              <strong className={styles.assignmentCurrentValue}>{ticket.assignedToName || 'Assigned Staff'}</strong>
            </div>
          )}
          <label>Staff Member</label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className={styles.modalSelect}
          >
            <option value="">Select Staff</option>
            {staffUsers.map((s) => {
              const isCur = s.id === ticket?.assignedTo;
              return (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} {isCur ? '— (Currently Assigned)' : ''}
                </option>
              );
            })}
          </select>

          {selectedStaff && selectedStaff === ticket?.assignedTo && (
            <div className={styles.duplicateAssignWarning}>
              <div className={styles.duplicateAssignHeader}>
                <ExclamationTriangleIcon className={styles.duplicateAssignIcon} />
                <span>Duplicate Assignment Restricted</span>
              </div>
              <p style={{ margin: '4px 0' }}>
                <strong>{ticket.assignedToName || 'This staff member'}</strong> is already assigned to this ticket. Duplicate continuous assignment is restricted.
              </p>
            </div>
          )}

          <label>Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add optional assignment notes..."
            className={styles.modalTextarea}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={() => { setStaffModal(false); setSelectedStaff(''); setNotes(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedStaff || selectedStaff === ticket?.assignedTo}
              onClick={async () => {
                if (!selectedStaff || selectedStaff === ticket?.assignedTo) return;
                const staffObj = staffUsers.find((s) => s.id === selectedStaff);
                const staffName = staffObj ? `${staffObj.firstName} ${staffObj.lastName}` : 'Staff';
                await call(
                  () => assignStaff(ticket.id, { staffId: selectedStaff, notes }),
                  `✓ Ticket successfully assigned to ${staffName}. In-app alert and registered email notification have been sent.`
                );
                setStaffModal(false);
                setSelectedStaff('');
                setNotes('');
              }}
              className={styles.modalSubmitBtn}
            >
              {ticket?.assignedTo ? 'Reassign Staff' : 'Assign Staff'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={priorityModal} title="Change Priority" onClose={() => setPriorityModal(false)}>
        <div className={styles.modalForm}>
          <label>Priority</label>
          <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => call(() => changePriority(ticket.id, selectedPriority), 'Priority updated')}>Save</button>
        </div>
      </Modal>

      <Modal open={categoryModal} title="Change Category" onClose={() => setCategoryModal(false)}>
        <div className={styles.modalForm}>
          <label>Category</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button disabled={!selectedCategory} onClick={() => call(() => changeCategory(ticket.id, selectedCategory), 'Category updated')}>Save</button>
        </div>
      </Modal>

      <Modal open={mergeModal} title="Merge Duplicate Tickets" onClose={() => setMergeModal(false)}>
        <div className={styles.mergeModalContent}>
          {/* Target Ticket Highlight */}
          <div className={styles.mergeTargetBanner}>
            <span className={styles.mergeTargetIcon}>🎯</span>
            <div className={styles.mergeTargetInfo}>
              <span className={styles.mergeTargetTitle}>
                Target Ticket: {ticket.referenceNumber || ticket.id} — {ticket.title}
              </span>
              <span className={styles.mergeTargetDesc}>
                This ticket remains active and will absorb the duplicate tickets. All selected source tickets will be closed and marked as merged.
              </span>
            </div>
          </div>

          {/* Search & Auto-Discovery */}
          <div className={styles.mergeSearchRow}>
            <input
              type="text"
              className={styles.mergeSearchInput}
              placeholder="🔍 Search candidate tickets by Ref #, Title, or Tenant..."
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
            />
          </div>

          {/* Quick Add by Ref # / ID */}
          <div className={styles.mergeSearchRow}>
            <input
              type="text"
              className={styles.mergeSearchInput}
              placeholder="Or enter Ref # (e.g. HD-2026-00002) / UUID ID directly..."
              value={manualMergeInput}
              onChange={(e) => setManualMergeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualAddMerge(); } }}
            />
            <button
              type="button"
              className={styles.mergeQuickAddBtn}
              onClick={handleManualAddMerge}
              disabled={!manualMergeInput.trim()}
            >
              + Add Ticket
            </button>
          </div>

          {/* Selected Tickets Box */}
          {selectedMergeTickets.length > 0 && (
            <div className={styles.mergeSelectedBox}>
              <div className={styles.mergeSelectedHeader}>
                <span>Selected Tickets to Merge ({selectedMergeTickets.length}):</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Click ✕ to deselect</span>
              </div>
              <div className={styles.mergeSelectedPills}>
                {selectedMergeTickets.map((st) => (
                  <span key={st.id} className={styles.mergePill}>
                    <strong>{st.referenceNumber || st.id.slice(0, 8)}</strong>: {st.title}
                    <button
                      type="button"
                      className={styles.mergePillRemove}
                      onClick={() => toggleMergeCandidate(st)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Candidates Header */}
          <div className={styles.mergeSectionTitle}>
            <span>Discovered Duplicate Candidates</span>
            <span className={styles.mergeCandidateCount}>{mergeCandidates.length} found</span>
          </div>

          {/* Candidate List */}
          {loadingCandidates ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.84rem' }}>
              Searching for candidate duplicate tickets…
            </div>
          ) : mergeCandidates.length === 0 ? (
            <div className={styles.mergeEmptyCandidates}>
              No eligible duplicate tickets discovered. You can search by reference number or add a ticket ID above.
            </div>
          ) : (
            <div className={styles.mergeCandidatesList}>
              {mergeCandidates.map((cand) => {
                const isSelected = selectedMergeTickets.some((t) => t.id === cand.id);
                const isSameTenant = ticket.tenantId && cand.tenantId === ticket.tenantId;

                return (
                  <div
                    key={cand.id}
                    className={`${styles.mergeCandidateCard} ${isSelected ? styles.mergeCandidateCardSelected : ''}`}
                    onClick={() => toggleMergeCandidate(cand)}
                  >
                    <input
                      type="checkbox"
                      className={styles.mergeCheckbox}
                      checked={isSelected}
                      onChange={() => {}}
                    />
                    <div className={styles.mergeCandidateMain}>
                      <div className={styles.mergeCandidateHeader}>
                        <span className={styles.mergeCandidateRef}>{cand.referenceNumber || cand.id.slice(0, 8)}</span>
                        {isSameTenant && (
                          <span className={styles.mergeSameTenantBadge}>Same Tenant</span>
                        )}
                        <span className={styles.mergeCandidateTitle} title={cand.title}>
                          {cand.title}
                        </span>
                      </div>
                      <div className={styles.mergeCandidateMeta}>
                        <span>Tenant: {cand.tenantName || 'N/A'}</span>
                        <span>•</span>
                        <span>Status: {getStatusLabel(cand.status)}</span>
                        <span>•</span>
                        <span>{cand.createdAt ? new Date(cand.createdAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional Merge Reason / Note */}
          <div className={styles.mergeNotesField}>
            <label>Merge Reason / Internal Note (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Duplicate issue reported by tenant. Merging into primary ticket."
              value={mergeNotes}
              onChange={(e) => setMergeNotes(e.target.value)}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className={styles.mergeFooter}>
            <button
              type="button"
              className={styles.btnSlate}
              onClick={() => setMergeModal(false)}
              disabled={mergingLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleConfirmMerge}
              disabled={selectedMergeTickets.length === 0 || mergingLoading}
            >
              {mergingLoading ? 'Merging…' : `Confirm Merge (${selectedMergeTickets.length} Selected)`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={noteModal} title="Add Internal Note" onClose={() => setNoteModal(false)}>
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Note (Internal Only)</label>
            <textarea
              className={styles.modalTextarea}
              rows={4}
              placeholder="Write your internal note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Visible to Departments (Optional)</label>
            <select
              multiple
              className={styles.modalMultiSelect}
              value={selectedNoteDepts}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setSelectedNoteDepts(values);
              }}
            >
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span className={styles.modalHint}>Hold Ctrl/Cmd to select multiple. Leave empty to make visible to all internal staff.</span>
          </div>
          <button
            className={styles.modalSubmitBtn}
            disabled={!noteText.trim()}
            onClick={() => call(() => addInternalNote(ticket.id, noteText, undefined, selectedNoteDepts.join(',')), 'Internal note added')}
          >
            Save Note
          </button>
        </div>
      </Modal>

      <Modal open={attachModal} title="Upload Ticket Attachment" onClose={() => setAttachModal(false)}>
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Select File(s) (Max 5, 10MB each)</label>
            <input
              type="file"
              multiple
              className={styles.modalFileInput}
              onChange={(e) => setAttachFiles(e.target.files)}
            />
            {attachFiles && attachFiles.length > 0 && (
              <span className={styles.modalHint}>
                {attachFiles.length} file(s) selected ({Array.from(attachFiles).map((f) => f.name).join(', ')})
              </span>
            )}
          </div>

          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              Why are you uploading this file? (Comment / Reason)
            </label>
            <textarea
              className={styles.modalTextarea}
              rows={3}
              placeholder="Explain the purpose of this attachment (e.g. Screenshot of the error message, invoice receipt, proof of maintenance...)"
              value={attachComment}
              onChange={(e) => setAttachComment(e.target.value)}
            />
            <span className={styles.modalHint}>
              This comment and your name will be visible to everyone viewing this ticket.
            </span>
          </div>

          <div className={styles.modalFooterActions}>
            <button
              type="button"
              className={styles.btnSlate}
              onClick={() => { setAttachModal(false); setAttachFiles(null); setAttachComment(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!attachFiles || attachFiles.length === 0}
              onClick={async () => {
                if (!attachFiles) return;
                const fd = new FormData();
                Array.from(attachFiles).forEach((f) => fd.append('attachments', f));
                if (attachComment.trim()) {
                  fd.append('comment', attachComment.trim());
                }
                await call(() => uploadTicketAttachments(ticket.id, fd), 'Attachment uploaded successfully');
                setAttachFiles(null);
                setAttachComment('');
                setAttachModal(false);
              }}
            >
              Upload Attachment
            </button>
          </div>
        </div>
      </Modal>

      {/* Decline Reopening Request Modal */}
      <Modal open={declineModal} title="Decline Reopening Request" onClose={() => setDeclineModal(false)}>
        <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5, margin: '0 0 16px' }}>
          ⚠️ <strong>Declining Reopening Request:</strong> The ticket will remain Closed and Inactive. A notification will be sent to the tenant.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
            Reason for Declining <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            rows={4}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Provide an executive explanation for declining the reopening request..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setDeclineModal(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnReject}
            disabled={!declineReason.trim()}
            onClick={async () => {
              if (!declineReason.trim() || !ticket) return;
              await call(() => rejectReopenTicket(ticket.id, declineReason.trim()), 'Reopening request declined');
              setDeclineModal(false);
              setDeclineReason('');
            }}
          >
            Decline Request
          </button>
        </div>
      </Modal>

      {/* Edit Attachment Note Modal */}
      <Modal open={editAttachmentModal} title="Edit Attachment Comment / Note" onClose={() => setEditAttachmentModal(false)}>
        <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 12px' }}>
          Update the reason or explanatory notes for: <strong>{editAttachment?.fileName || 'Attachment'}</strong>
        </p>
        <textarea
          rows={3}
          value={editAttachmentComment}
          onChange={(e) => setEditAttachmentComment(e.target.value)}
          placeholder="Why was this file attached? (e.g. Resolution proof, diagnostics)..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button type="button" className={styles.btnSecondary} onClick={() => setEditAttachmentModal(false)}>Cancel</button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={editAttachmentSaving}
            onClick={async () => {
              if (!ticket || !editAttachment) return;
              setEditAttachmentSaving(true);
              try {
                await call(
                  () => updateTicketAttachment(ticket.id, editAttachment.id, editAttachmentComment),
                  'Attachment comment updated successfully'
                );
                setEditAttachmentModal(false);
              } finally {
                setEditAttachmentSaving(false);
              }
            }}
          >
            {editAttachmentSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Reopen Ticket Modal */}
      <Modal open={reopenModal} title="Reopen Ticket" onClose={() => setReopenModal(false)}>
        <form
          className={styles.modalForm}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reopenReason.trim()) return;
            setReopenSubmitting(true);
            try {
              await call(() => reopenTicket(ticket.id, reopenReason.trim()), 'Ticket Reopened');
              setReopenModal(false);
              setReopenReason('');
            } finally {
              setReopenSubmitting(false);
            }
          }}
        >
          <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12, fontSize: '0.875rem', color: '#92400e' }}>
            🔄 <strong>Reopening Ticket:</strong> The ticket will return to active workflow. Its SLA resolution timer will resume based on remaining SLA time.
          </div>
          <div className={styles.modalField} style={{ marginBottom: '14px' }}>
            <label className={styles.modalLabel} style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Reason for Reopening <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className={styles.modalTextarea}
              rows={4}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Explain what issue remains unresolved, has recurred, or why the proposed solution was rejected..."
              required
              style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.btnSlate}
              onClick={() => setReopenModal(false)}
              disabled={reopenSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnAmber}
              disabled={reopenSubmitting || !reopenReason.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowPathIcon style={{ width: 18, height: 18 }} />
              {reopenSubmitting ? 'Reopening…' : 'Confirm & Reopen Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ReplyForm({
  ticketId,
  ticket,
  onReplyAdded,
  assignPrefill,
  onClearPrefill,
}: {
  ticketId: string;
  ticket?: Ticket;
  onReplyAdded?: () => void;
  assignPrefill?: { text: string } | null;
  onClearPrefill?: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'tenant' | 'department' | 'both' | 'admin' | 'staff'>('both');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [deptStaffUsers, setDeptStaffUsers] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [msg, setMsg] = useState('');

  // Handle assign comment pre-fill from a tenant reply
  useEffect(() => {
    if (assignPrefill) {
      setVisibility('staff');
      setText(assignPrefill.text);
      onClearPrefill?.();
    }
  }, [assignPrefill, onClearPrefill]);

  // Load staff members for assignment if ticket has a department
  useEffect(() => {
    if (ticket?.departmentId) {
      const targetDeptId = toShortId(ticket.departmentId);
      fetchUsers({ role: 'staff', limit: 200, departmentId: targetDeptId })
        .then((r) => {
          const tid = ticket.departmentId;
          const tidShort = toShortId(tid);
          const list = (r.data.data || []).filter(
            (u: any) => !tid || u.departments?.some((d: any) => d.id === tid || d.code === tid || toShortId(d.id) === tidShort)
          );
          setDeptStaffUsers(list.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
        })
        .catch(() => setDeptStaffUsers([]));
    }
  }, [ticket?.departmentId]);

  useEffect(() => {
    fetchActiveDepartments()
      .then((res) => setDepartments(res.data.data || []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (ticket?.departmentId) setDepartmentId(ticket.departmentId);
  }, [ticket?.departmentId]);

  const needsDept = visibility === 'department' || visibility === 'both';
  const isTargetStaff = visibility === 'staff';

  const submit = async () => {
    if (!text.trim()) return;

    if (isTargetStaff && !targetStaffId) {
      setMsg('Please select a staff member to assign the comment to');
      return;
    }

    const resolvedDeptId = departmentId || ticket?.departmentId || null;

    try {
      await addTicketReply(ticketId, {
        message: text,
        visibility: isTargetStaff ? 'department' : visibility,
        departmentIds: needsDept ? resolvedDeptId : (ticket?.departmentId || null),
        targetUserId: isTargetStaff ? targetStaffId : null,
      });
      setText('');
      setTargetStaffId('');
      setMsg('Reply sent');
      onReplyAdded?.();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed');
    }
  };

  const getPlaceholder = () => {
    if (isTargetStaff) return 'Write an executive directive or instruction to the selected staff member…';
    if (visibility === 'admin') return 'Write an executive note visible to Admins…';
    if (visibility === 'department') return 'Executive instruction visible only to the department…';
    if (visibility === 'tenant') return 'Executive response visible directly to the tenant…';
    return 'Executive reply visible to tenant and department…';
  };

  return (
    <div className={styles.replyForm} id="ticket-reply-form">
      <div className={styles.replyFormControls}>
        <label className={styles.replyFormLabel}>
          Visibility:
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            className={styles.replyFormSelect}
          >
            <option value="both">👤🏢 Tenant & Department — both can see</option>
            <option value="tenant">👤 Tenant Only — visible directly to tenant</option>
            <option value="department">🏢 Department Only — internal note to department</option>
            <option value="staff">🎯 Assign to Staff User — executive instruction to staff</option>
            <option value="admin">🛡️ Executive & Admin Only — administrative note</option>
          </select>
        </label>

        {isTargetStaff && (
          <label className={styles.replyFormLabel}>
            Assign to Staff:
            <select
              value={targetStaffId}
              onChange={(e) => setTargetStaffId(e.target.value)}
              className={styles.replyFormSelect}
            >
              <option value="">Select staff member…</option>
              {deptStaffUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          </label>
        )}

        {needsDept && (
          <label className={styles.replyFormLabel}>
            Department:
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={styles.replyFormSelect}
            >
              <option value="">Select department (optional if unassigned)…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <textarea
        rows={3}
        placeholder={getPlaceholder()}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={submit}
        disabled={
          !text.trim() ||
          (isTargetStaff && !targetStaffId)
        }
      >
        {isTargetStaff ? 'Assign Instruction to Staff' : 'Submit Reply'}
      </button>
      {msg && <span className={styles.replySuccessMsg}>{msg}</span>}
    </div>
  );
}