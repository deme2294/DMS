import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
import { canNotifyTenant } from '../../utils/permissionUtils';
import { toShortId } from '../../utils/idUtils';
import {
  changeTicketStatus, fetchTicket, fetchTicketReplies, addTicketReply, fetchTicketTimeline,
  assignDepartment, assignStaff, reassignStaff, acceptAssignment, rejectAssignment,
  escalateTicket, mergeTickets, fetchMergeCandidates, closeTicket, reopenTicket, approveResolution, rejectResolution,
  requestReopenTicket, approveReopenTicket, rejectReopenTicket,
  markResolved, changePriority, changeCategory, addInternalNote, uploadTicketAttachments, updateTicketAttachment, deleteTicketAttachment,
  overrideAssignment, remindStaff, fetchDepartmentManagers, type DepartmentManager,
} from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import { searchArticles } from '../../api/knowledgeApi';
import type { Ticket, TicketStatus, TicketReply, TimelineEvent, TicketAttachment } from '../../types/ticket';
import type { User } from '../../types/user';
import type { Article } from '../../types/article';
import { STATUS_LABELS, TICKET_STATUSES, TICKET_PRIORITIES, getStatusLabel, getStatusClassName } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAlert } from '../../context/AlertContext';
import styles from './Tickets.module.css';
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
  PencilSquareIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  MegaphoneIcon,
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
  BellAlertIcon,
  BuildingOfficeIcon,
  ChevronDoubleUpIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  BoltIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { formatFileSize, buildAttachmentUrl } from '../../utils/attachmentUtils';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const basePaths: Record<string, string> = {
  admin: '/admin/tickets',
  manager: '/manager/tickets',
  staff: '/staff/tickets',
  tenant: '/tenant/tickets',
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

export default function TicketDetail() {
  const { id } = useParams();
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
  const [accessDenied, setAccessDenied] = useState(false);

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

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as any).createdSuccess) {
      const ref = (location.state as any).referenceNumber ? ` (${(location.state as any).referenceNumber})` : '';
      setMessage(`Ticket${ref} was submitted successfully! You can track progress or add comments below.`);
    }
  }, [location.state]);

  // modal state
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>('assigned');
  const [notes, setNotes] = useState('');
  const [deptModal, setDeptModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [remindModal, setRemindModal] = useState(false);
  const [remindNotes, setRemindNotes] = useState('');
  const [remindingStaff, setRemindingStaff] = useState(false);
  const [attributionModal, setAttributionModal] = useState(false);
  const [attributionUsers, setAttributionUsers] = useState<User[]>([]);
  const [overrideAssignTo, setOverrideAssignTo] = useState('');
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [contactSubject, setContactSubject] = useState('');
  const [overrideAssignedBy, setOverrideAssignedBy] = useState('');
  const [priorityModal, setPriorityModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [mergeModal, setMergeModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [attachModal, setAttachModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null);
  const [editAttachment, setEditAttachment] = useState<TicketAttachment | null>(null);
  const [editAttachmentComment, setEditAttachmentComment] = useState('');
  const [editAttachmentSaving, setEditAttachmentSaving] = useState(false);
  const [deleteAttachmentTarget, setDeleteAttachmentTarget] = useState<TicketAttachment | null>(null);
  const [deleteAttachmentDeleting, setDeleteAttachmentDeleting] = useState(false);
  const [announceModal, setAnnounceModal] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceSubmitting, setAnnounceSubmitting] = useState(false);
  const [reopenModal, setReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [assignPrefill, setAssignPrefill] = useState<{ text: string } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptManagers, setDeptManagers] = useState<DepartmentManager[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [loadingManagers, setLoadingManagers] = useState(false);
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
  const [mergeIds, setMergeIds] = useState('');
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
  const [tenantRating, setTenantRating] = useState<number>(5);
  const [tenantFeedback, setTenantFeedback] = useState<string>('');
  const [hoverRating, setHoverRating] = useState<number>(0);
  const { socket } = useSocket();

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchTicket(id);
      const ticketData = res.data.data;
      setTicket(ticketData);
      const targetRef = ticketData?.referenceNumber || (ticketData as any)?.reference_number;
      if (targetRef && id !== targetRef) {
        navigate(`${base}/${targetRef}`, { replace: true });
      }
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setAccessDenied(true);
        flash('You do not have permission to view this ticket.', true);
        setTimeout(() => navigate(base), 2000);
      } else {
        flash(e?.response?.data?.message || 'Failed to load ticket', true);
      }
    } finally {
      setLoading(false);
    }
  };
  const loadReplies = async () => {
    if (!id) return;
    try {
      const res = await fetchTicketReplies(id);
      setReplies(res.data.data);
    } catch {
      setReplies([]);
    }
  };
  const loadTimeline = async () => {
    if (!id) return;
    try {
      const res = await fetchTicketTimeline(id);
      setTimeline(res.data.data);
    } catch {
      setTimeline([]);
    }
  };

  useEffect(() => {
    setNotes('');
    setSelectedStaff('');
    setRemindNotes('');
    setStaffModal(false);
    setRemindModal(false);
    loadTicket();
    loadReplies();
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!ticket || !id) return;
    const query = `${ticket.title} ${ticket.description || ''}`.trim();
    if (query.length < 4) return;
    setLoadingRelated(true);
    searchArticles(query, 5, id)
      .then((res) => setRelatedArticles(res.data.data || []))
      .catch(() => setRelatedArticles([]))
      .finally(() => setLoadingRelated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.title, ticket?.description, id]);

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
    if (staffModal || mergeModal || attributionModal) {
      const targetDeptId = toShortId(ticket?.departmentId) || undefined;
      fetchUsers({ role: 'staff', limit: 200, departmentId: targetDeptId }).then((r) => {
        const tid = ticket?.departmentId;
        const tidShort = toShortId(tid);
        const list = (r.data.data || []).filter((u) => {
          if (!tid) return true;
          return u.departments?.some((d) => d.id === tid || d.code === tid || toShortId(d.id) === tidShort);
        });
        setStaffUsers(list.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
      });
    }
    if (attributionModal) {
      fetchUsers({ status: 'active', limit: 1000, sortBy: 'first_name', sortOrder: 'ASC' }).then((r) => setAttributionUsers(r.data.data || []));
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

  useEffect(() => {
    if (!selectedDept) {
      setDeptManagers([]);
      setSelectedManager('');
      return;
    }
    setLoadingManagers(true);
    fetchDepartmentManagers(selectedDept)
      .then((res) => {
        const mgrs = res.data.data || [];
        setDeptManagers(mgrs);
        const headMgr = mgrs.find((m) => m.isHead) || mgrs[0];
        setSelectedManager(headMgr ? headMgr.id : '');
      })
      .catch(() => {
        setDeptManagers([]);
        setSelectedManager('');
      })
      .finally(() => setLoadingManagers(false));
  }, [selectedDept]);

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

  const openStaffModal = () => {
    if (ticket?.status === 'waiting_tenant' || (ticket as any)?.status === 'escalated.waiting_tenant') {
      flash('Cannot assign staff: Ticket is waiting for tenant response/confirmation.', true);
      return;
    }
    setSelectedStaff('');
    setNotes('');
    setStaffModal(true);
  };

  const closeStaffModal = () => {
    setStaffModal(false);
    setSelectedStaff('');
    setNotes('');
  };

  const closeDeptModal = () => {
    setDeptModal(false);
    setSelectedManager('');
    setNotes('');
  };

  const handleAssignDepartmentSubmit = async () => {
    if (!selectedDept || !ticket) return;
    if (ticket.status === 'waiting_tenant' || (ticket as any).status === 'escalated.waiting_tenant') {
      flash('Cannot assign department: Ticket is waiting for tenant response/confirmation.', true);
      return;
    }

    const targetDeptObj = departments.find((d) => d.id === selectedDept);
    const targetDeptName = targetDeptObj?.name || 'Department';

    const targetManagerObj = deptManagers.find((m) => m.id === selectedManager);
    const targetManagerName = targetManagerObj
      ? `${targetManagerObj.firstName} ${targetManagerObj.lastName}`
      : null;

    try {
      setAssigningDept(true);
      await assignDepartment(ticket.id, {
        departmentId: selectedDept,
        managerId: selectedManager || undefined,
        notes,
      });

      closeDeptModal();

      const successMessage = targetManagerName
        ? `Ticket ${ticket.referenceNumber || ticket.id} was successfully assigned to the ${targetDeptName} department and routed to Manager ${targetManagerName}. In-app alert notification and registered email have been dispatched.`
        : `Ticket ${ticket.referenceNumber || ticket.id} was successfully assigned to the ${targetDeptName} department unassigned queue. In-app alert notification and registered email have been dispatched.`;

      setAssignmentAlert({
        type: 'department',
        title: 'Department & Manager Assignment Confirmed',
        message: successMessage,
        departmentName: targetDeptName,
        managerName: targetManagerName || undefined,
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

  const handleAssignStaffSubmit = async () => {
    if (!selectedStaff || !ticket) return;
    if (ticket.status === 'waiting_tenant' || (ticket as any).status === 'escalated.waiting_tenant') {
      flash('Cannot assign staff: Ticket is waiting for tenant response/confirmation.', true);
      return;
    }
    if (selectedStaff === ticket.assignedTo) {
      flash('This staff member is already assigned to this ticket. Duplicate assignment is restricted. Use the reminder feature instead.', true);
      return;
    }
    const targetStaffObj = staffUsers.find((s) => s.id === selectedStaff);
    const targetStaffName = targetStaffObj ? `${targetStaffObj.firstName} ${targetStaffObj.lastName}` : 'Staff';
    try {
      setAssigningStaff(true);
      await assignStaff(ticket.id, { staffId: selectedStaff, notes });
      closeStaffModal();

      setAssignmentAlert({
        type: 'staff',
        title: 'Staff Member Assignment Confirmed',
        message: `Ticket ${ticket.referenceNumber || (ticket as any).reference_number || ''} was successfully assigned to ${targetStaffName}. High-priority in-app alert and registered email notification have been dispatched.`,
        departmentName: ticket.departmentName || undefined,
        managerName: targetStaffName,
        timestamp: new Date(),
      });

      flash(`✓ Ticket ${ticket.referenceNumber || (ticket as any).reference_number || ''} was successfully assigned to ${targetStaffName}. In-app alert and registered email notification have been dispatched.`);
      loadTicket();
      loadReplies();
      loadTimeline();
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Failed to assign staff', true);
    } finally {
      setAssigningStaff(false);
    }
  };

  const handleSendReminderSubmit = async (customNote?: string) => {
    if (!ticket) return;
    try {
      setRemindingStaff(true);
      const noteToSend = customNote !== undefined ? customNote : (remindNotes || notes);
      await remindStaff(ticket.id, { notes: noteToSend });
      setRemindModal(false);
      setRemindNotes('');
      if (staffModal) closeStaffModal();
      flash(`✓ Reminder successfully dispatched to ${ticket.assignedToName || 'assigned staff'} via in-app alert and registered email.`);
      loadTimeline();
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Failed to send reminder', true);
    } finally {
      setRemindingStaff(false);
    }
  };

  const getTransitions = (): TicketStatus[] => {
    if (!ticket || !user) return [];
    const baseStatus = ((ticket.status || '') as string).replace(/^escalated\./, '') as TicketStatus;
    return TRANSITIONS[user.role]?.[baseStatus] || [];
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

  const handleDeleteAttachmentPrompt = async (fileToDelete: TicketAttachment) => {
    const fName = fileToDelete.fileName || (fileToDelete as any).file_name || 'this file';
    const confirmed = window.confirm(`Permanently delete "${fName}" from the database?\n\nThis will remove the attachment record from the database and delete the file from storage.`);
    if (!confirmed) return;
    const targetId = fileToDelete.id || (fileToDelete as any).id;
    const currentTicketId = ticket?.id || id || '';
    try {
      await deleteTicketAttachment(currentTicketId, targetId);
      flash(`Attachment "${fName}" permanently deleted from database`);
      loadTicket(); loadReplies(); loadTimeline();
    } catch (e: any) {
      if (e?.response?.status === 404) {
        flash(`Attachment "${fName}" removed from database`);
        loadTicket(); loadReplies(); loadTimeline();
      } else {
        flash(e?.response?.data?.message || 'Failed to delete attachment', true);
      }
    }
  };

  if (accessDenied) {
    return (
      <div className={styles.page}>
        <div className={`${styles.toast} ${styles.error}`}>You do not have permission to view this ticket. Redirecting...</div>
      </div>
    );
  }
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
              <h3>Details</h3>
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
            {role === 'admin' && (() => {
              const staffAssignments = (ticket.assignments || []).filter((a) => a.role === 'staff') || [];
              const latestStaff = staffAssignments.length ? staffAssignments[staffAssignments.length - 1] : null;
              const latestHistory = (ticket.statusHistory || []).slice().reverse()[0];
              const isAssignedByMe = isMe(latestStaff?.assignedBy, null, latestStaff?.assignedByName);
              const isChangedByMe = isMe(latestHistory?.changedBy, null, latestHistory?.changedByName);
              return (
                <>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>
                      <UserPlusIcon className={styles.detailLabelIcon} />
                      {isAssignedByMe ? 'Assigned By You' : 'Assigned By'}
                    </span>
                    <span className={styles.detailValue}>
                      {latestStaff?.assignedByName ? (
                        <span className={styles.userChip}>
                          <UserPlusIcon />
                          {latestStaff.assignedByName}
                          {isAssignedByMe && <span className={styles.youBadge}>You</span>}
                        </span>
                      ) : (
                        <span className={styles.unassignedChip}>—</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>
                      <ArrowPathIcon className={styles.detailLabelIcon} />
                      {isChangedByMe ? 'Changed By You' : 'Changed By'}
                    </span>
                    <span className={styles.detailValue}>
                      {latestHistory?.changedByName ? (
                        <span className={styles.userChip}>
                          <UserCircleIcon />
                          {latestHistory.changedByName}
                          {isChangedByMe && <span className={styles.youBadge}>You</span>}
                        </span>
                      ) : (
                        <span className={styles.unassignedChip}>—</span>
                      )}
                    </span>
                  </div>
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
                      canNotifyTenant(user, ticket) ? (
                        <button
                          type="button"
                          className={styles.tenantEmailLink}
                          title={`Send official notification to ${emailVal}`}
                          onClick={() => {
                            setContactSubject(`Regarding Ticket #${ticket.referenceNumber}: ${ticket.title}`);
                            setContactTarget({
                              email: emailVal,
                              name: ticket.tenantName || ticket.createdByName || ticket.tenantContactPerson || 'Ticket Submitter',
                              roleOrType: 'Ticket Submitter',
                              ticketId: ticket.id,
                            });
                          }}
                        >
                          <EnvelopeIcon className={styles.contactIconSmall} />
                          <span className={styles.emailText}>{emailVal}</span>
                          {isEmailMine && <span className={styles.youBadge}>You</span>}
                        </button>
                      ) : (
                        <span
                          className={styles.tenantEmailReadOnly}
                          title="Official email notifications to tenants are restricted to Administrators and the assigned Department Manager"
                        >
                          <EnvelopeIcon className={styles.contactIconSmall} />
                          <span className={styles.emailText}>{emailVal}</span>
                          {isEmailMine && <span className={styles.youBadge}>You</span>}
                        </span>
                      )
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
                      canNotifyTenant(user, ticket) ? (
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
                        <span
                          className={styles.tenantPhoneReadOnly}
                          title="Direct calls to tenants are restricted to Administrators and the assigned Department Manager"
                        >
                          <PhoneIcon className={styles.contactIconSmall} />
                          <span>{phoneVal}</span>
                          {isPhoneMine && <span className={styles.youBadge}>You</span>}
                        </span>
                      )
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
            {ticket.responseDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <BoltIcon className={styles.detailLabelIcon} />
                  First Response SLA
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date(ticket.responseDueDate).toLocaleString()}
                    </span>
                    <span className={ticket.responseSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {ticket.responseSlaBreached ? (
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
            {ticket.escalationDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <ArrowTrendingUpIcon className={styles.detailLabelIcon} />
                  Escalation SLA Due
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date(ticket.escalationDueDate).toLocaleString()}
                    </span>
                    <span className={ticket.escalationSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {ticket.escalationSlaBreached ? (
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

        {(() => {
          const isAdminRole = role === 'admin' || role === 'ceo';
          if (!isAdminRole && role !== 'manager' && role !== 'staff') return null;

          const normalizedStatus = ((ticket.status || '') as string).replace(/^escalated\./, '') as TicketStatus;
          const isClosed = normalizedStatus === 'closed';
          if (isClosed) {
            return (
              <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span>🔒</span> Ticket Actions Locked
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0' }}>
                  This ticket is <strong>Closed (Inactive)</strong>. Normal processing, assignments, reassignments, and status modifications are disabled.
                  {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') ? ' A tenant reopening request is currently pending review below.' : ''}
                </p>
              </div>
            );
          }

          const isWaitingTenant = normalizedStatus === 'waiting_tenant';
          const canReopen =
            (isAdminRole || role === 'manager') &&
            !isWaitingTenant &&
            ['resolved', 'closed', 'completed'].includes(normalizedStatus);

          const hasWorkflowActions =
            transitions.length > 0 ||
            (isAdminRole && (ticket.routingType ?? 'general') !== 'direct') ||
            (role === 'manager' && !!ticket.departmentId) ||
            ((role === 'manager' || role === 'staff') && (normalizedStatus === 'assigned' || normalizedStatus === 'open')) ||
            (role === 'staff' && normalizedStatus === 'in_progress') ||
            (role === 'manager' && (normalizedStatus === 'under_review' || normalizedStatus === 'in_progress')) ||
            (isAdminRole && (normalizedStatus === 'pending_approval' || normalizedStatus === 'in_progress' || normalizedStatus === 'under_review')) ||
            transitions.includes('closed') ||
            (transitions.includes('reopened') && canReopen);

          const hasManagementActions = isAdminRole || role === 'manager';

          return (
            <div className={styles.card}>
              <h3>
                <span>⚡</span> Ticket Actions
              </h3>
              <div className={styles.actionsSection}>
                {isAdminRole && (
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
                        {isAdminRole && (ticket.routingType ?? 'general') !== 'direct' && (
                          <button
                            className={styles.btnInfo}
                            onClick={() => {
                              if (isWaitingTenant) {
                                flash('Cannot assign department: Ticket is waiting for tenant response/confirmation.', true);
                                return;
                              }
                              setDeptModal(true);
                            }}
                            disabled={isWaitingTenant}
                            title={isWaitingTenant ? 'Cannot assign department: Ticket is waiting for tenant response/confirmation' : 'Assign Department'}
                          >
                            <BuildingOffice2Icon className={styles.btnIcon} />
                            Assign Dept
                          </button>
                        )}
                        {role === 'manager' && ticket.departmentId && (
                          <>
                            <button
                              className={styles.btnInfo}
                              onClick={openStaffModal}
                              disabled={isWaitingTenant}
                              title={isWaitingTenant ? 'Cannot assign staff: Ticket is waiting for tenant response/confirmation' : (ticket.assignedTo ? 'Reassign Staff to Another Department Member' : 'Assign Staff to Department Member')}
                            >
                              <UserPlusIcon className={styles.btnIcon} />
                              {ticket.assignedTo ? 'Reassign Staff' : 'Assign Staff'}
                            </button>
                            {ticket.assignedTo && ['open', 'assigned', 'in_progress', 'reopened'].includes(ticket.status) && (
                              <button
                                className={styles.btnAmber}
                                onClick={() => { setRemindNotes(''); setRemindModal(true); }}
                                title="Send an assignment reminder to the currently assigned staff member"
                              >
                                <BellAlertIcon className={styles.btnIcon} />
                                Remind Staff
                              </button>
                            )}
                          </>
                        )}
                        {(role === 'manager' || role === 'staff') && (normalizedStatus === 'assigned' || normalizedStatus === 'open') && (
                          <button
                            className={styles.btnSuccess}
                            onClick={() => call(() => acceptAssignment(ticket.id), 'Assignment accepted')}
                            title="Accept ticket assignment"
                          >
                            <CheckCircleIcon className={styles.btnIcon} />
                            Accept
                          </button>
                        )}
                        {(role === 'manager' || role === 'staff') && (normalizedStatus === 'assigned' || normalizedStatus === 'open') && (
                          <button
                            className={styles.btnReject}
                            onClick={() => call(() => rejectAssignment(ticket.id), 'Assignment rejected')}
                            title="Reject ticket assignment"
                          >
                            <XCircleIcon className={styles.btnIcon} />
                            Reject
                          </button>
                        )}

                        {/* Staff: on in_progress, clicking Resolve submits to Department Manager approval */}
                        {role === 'staff' && normalizedStatus === 'in_progress' && (
                          <button
                            className={styles.btnEmerald}
                            onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution submitted for Department Manager approval!')}
                            title="Submit work for Department Manager approval"
                          >
                            <CheckCircleIcon className={styles.btnIcon} />
                            Resolve
                          </button>
                        )}

                        {/* Manager: on under_review -> Approve Resolution & Request Rework; on in_progress -> Resolve */}
                        {role === 'manager' && normalizedStatus === 'under_review' && (
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
                              onClick={() => call(() => rejectResolution(ticket.id, notes || 'Department Manager requested rework'), 'Rework requested. Ticket returned to In Progress.')}
                              title="Request staff rework"
                            >
                              <ArrowUturnLeftIcon className={styles.btnIcon} />
                              Request Rework
                            </button>
                          </>
                        )}
                        {role === 'manager' && normalizedStatus === 'in_progress' && (
                          <button
                            className={styles.btnEmerald}
                            onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution submitted for Admin verification.')}
                            title="Resolve and forward to Admin"
                          >
                            <CheckCircleIcon className={styles.btnIcon} />
                            Resolve
                          </button>
                        )}

                        {/* Admin: on pending_approval -> Verify & Resolve or Return for Revision; on under_review/in_progress -> Resolve */}
                        {isAdminRole && normalizedStatus === 'pending_approval' && (
                          <>
                            <button
                              className={styles.btnEmerald}
                              onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution verified! Ticket marked Resolved and routed to tenant for confirmation.')}
                              title="Verify resolution and route to tenant for final confirmation"
                            >
                              <CheckBadgeIcon className={styles.btnIcon} />
                              Verify & Resolve
                            </button>
                            <button
                              className={styles.btnReject}
                              onClick={() => call(() => rejectResolution(ticket.id, notes || 'Admin returned for revision'), 'Returned for revision. Ticket sent back to In Progress.')}
                              title="Return for revision"
                            >
                              <ArrowUturnLeftIcon className={styles.btnIcon} />
                              Return for Revision
                            </button>
                          </>
                        )}
                        {isAdminRole && (normalizedStatus === 'in_progress' || normalizedStatus === 'under_review') && (
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
                        {(isAdminRole || role === 'manager') && (
                          <button
                            className={styles.btnAmber}
                            onClick={() => setPriorityModal(true)}
                            title="Change Ticket Priority"
                          >
                            <FlagIcon className={styles.btnIcon} />
                            Change Priority
                          </button>
                        )}
                        {isAdminRole && (
                          <button
                            className={styles.btnRose}
                            onClick={() => setCategoryModal(true)}
                            title="Change Ticket Category"
                          >
                            <TagIcon className={styles.btnIcon} />
                            Change Category
                          </button>
                        )}
                        {(isAdminRole || role === 'manager') && (
                          <button
                            className={styles.btnOrange}
                            onClick={() => call(() => escalateTicket(ticket.id, notes || undefined), 'Escalated')}
                            title="Escalate ticket to higher authority"
                          >
                            <ArrowTrendingUpIcon className={styles.btnIcon} />
                            Escalate
                          </button>
                        )}
                        {isAdminRole && (
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
                      {((ticket.routingType || 'general') === 'direct' ? role === 'manager' : role === 'admin') && (
                        <button
                          className={styles.btnAnnounce}
                          onClick={() => setAnnounceModal(true)}
                          title="Broadcast a visible update to the tenant"
                        >
                          <MegaphoneIcon className={styles.btnIcon} />
                          Announce
                        </button>
                      )}
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

        {/* Escalation Banner */}
        {ticket.isEscalated && ticket.status === 'escalated' && (
          <div className={`${styles.card} ${styles.slaDangerCard}`}>
            <h3>
              <span>🚨</span> Ticket Escalated
            </h3>
            <p>
              This ticket has been <strong>automatically escalated</strong> due to an SLA breach.
              {ticket.escalatedAt && <> Escalated at: <strong>{new Date(ticket.escalatedAt).toLocaleString()}</strong>.</>}
              {' '}Urgent attention required.
            </p>
          </div>
        )}

        {/* SLA Warning / Breach Banners */}
        {(() => {
          const banners = [];
          if (ticket.responseSlaBreached) {
            banners.push(
              <div key="resp" className={`${styles.card} ${styles.slaDangerCard}`}>
                <h3>
                  <span>⚠️</span> Response SLA Breached
                </h3>
                <p>
                  The response SLA for this ticket has been breached. Immediate attention is required.
                </p>
              </div>
            );
          }
          if (ticket.escalationSlaBreached) {
            banners.push(
              <div key="esc" className={`${styles.card} ${styles.slaDangerCard}`}>
                <h3>
                  <span>🚨</span> Escalation SLA Breached
                </h3>
                <p>
                  The escalation SLA deadline has passed. This ticket should have been escalated automatically.
                </p>
              </div>
            );
          }
          if (ticket.remainingMs != null && ticket.remainingMs < 0 && !ticket.escalationSlaBreached && ticket.status !== 'escalated') {
            banners.push(
              <div key="overdue" className={`${styles.card} ${styles.slaDangerCard}`}>
                <h3>
                  <span>⏰</span> Resolution SLA Overdue
                </h3>
                <p>
                  The resolution deadline has passed. This ticket is now overdue by <strong>{formatRemaining(ticket.remainingMs)}</strong>.
                </p>
              </div>
            );
          }
          if (ticket.remainingMs != null && ticket.remainingMs >= 0 && ticket.remainingMs < 3.6e6 && ticket.status !== 'escalated') {
            banners.push(
              <div key="imminent" className={`${styles.card} ${styles.slaWarningCard}`}>
                <h3>
                  <span>⏳</span> SLA Approaching
                </h3>
                <p>
                  The resolution SLA will breach in approximately <strong>{formatRemaining(ticket.remainingMs)}</strong>. Please expedite resolution.
                </p>
              </div>
            );
          }
          return banners;
        })()}

        {/* Under Review Banner (Staff submitted -> Pending Dept Manager Approval) */}
        {((ticket.status || '').replace(/^escalated\./, '') === 'under_review') && (
          <div className={`${styles.card} ${styles.slaWarningCard}`} style={{ borderLeft: '4px solid #a855f7' }}>
            <h3>
              <span>📋</span> {role === 'manager' ? 'Staff Resolution Awaiting Your Approval' : 'Resolution Under Department Review'}
            </h3>
            <p>
              {role === 'manager'
                ? `Staff member ${ticket.assignedToName || 'assigned staff'} has resolved the issue and submitted it for your department approval. Please review the work and either approve it to forward to Admin verification, or request rework.`
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

        {/* Pending Approval Banner (Dept Manager approved -> Pending Admin Verification) */}
        {((ticket.status || '').replace(/^escalated\./, '') === 'pending_approval') && (
          <div className={`${styles.card} ${styles.slaWarningCard}`} style={{ borderLeft: '4px solid #3b82f6' }}>
            <h3>
              <span>🛡️</span> {(role === 'admin' || role === 'ceo') ? 'Resolution Awaiting Admin Verification' : 'Pending Administrative Verification'}
            </h3>
            <p>
              {role === 'admin'
                ? 'Department Manager has approved the resolution for this ticket. Verify the solution and click "Verify & Resolve" to mark it Resolved for the department and notify the tenant for confirmation.'
                : role === 'manager'
                  ? 'You approved this resolution. It is now awaiting final verification by an Administrator before the tenant is notified.'
                  : 'Department Manager approved the resolution. Awaiting Administrator verification.'}
            </p>
            {role === 'admin' && (
              <div className={styles.btnRow} style={{ marginTop: '12px' }}>
                <button
                  className={styles.btnEmerald}
                  onClick={() => call(() => markResolved(ticket.id, notes || 'Admin verified resolution'), 'Resolution verified! Marked Resolved and routed to tenant for confirmation.')}
                >
                  ✅ Verify & Resolve (Notify Tenant)
                </button>
                <button
                  className={styles.btnReject}
                  onClick={() => call(() => rejectResolution(ticket.id, notes || 'Admin returned for revision'), 'Returned for revision. Ticket sent back to In Progress.')}
                >
                  🔄 Return for Revision
                </button>
              </div>
            )}
          </div>
        )}

        {/* Waiting for Tenant Banner (Admin approved & verified -> Waiting for Tenant) */}
        {(role === 'admin' || role === 'manager' || role === 'staff') && (ticket.status === 'waiting_tenant' || (ticket as any).status === 'escalated.waiting_tenant') && (
          <div className={`${styles.card} ${styles.slaWarningCard}`}>
            <h3>
              <span>⏳</span> Waiting for Tenant Confirmation
            </h3>
            <p>
              The ticket has been resolved by our team and verified by Admin. Waiting for the tenant to inspect the resolution, rate satisfaction, and confirm if the issue is solved.
            </p>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#b45309', fontWeight: 600 }}>
              🔒 Department assignment and status modifications are locked until the tenant responds or confirms the resolution.
            </div>
          </div>
        )}

        {/* Tenant Confirmation & Interactive Feedback Card */}
        {role === 'tenant' && (ticket.status === 'waiting_tenant' || ticket.status === 'resolved' || (ticket.tenantConfirmationStatus === 'pending' && ticket.status !== 'closed' && ticket.status !== 'completed')) && (
          <div className={`${styles.card} ${styles.slaInfoCard}`}>
            <h3>
              <span>⭐</span> Confirm Issue Resolution & Rate Service
            </h3>
            <p>
              Our support team and administration have resolved your ticket. Please inspect whether the issue is completely solved and rate your satisfaction below.
            </p>

            <div className={styles.feedbackContainer}>
              <div className={styles.ratingRow}>
                <span className={styles.ratingLabel}>Satisfaction Rating:</span>
                <div className={styles.starsList}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`${styles.starBtn} ${star <= (hoverRating || tenantRating) ? styles.starActive : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setTenantRating(star)}
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                  {tenantRating === 5 ? '5/5 - Excellent' : tenantRating === 4 ? '4/5 - Good' : tenantRating === 3 ? '3/5 - Fair' : tenantRating === 2 ? '2/5 - Poor' : '1/5 - Very Poor'}
                </span>
              </div>

              <textarea
                className={styles.feedbackTextarea}
                placeholder="Optional feedback: Describe your experience or if not solved, explain what remains to be fixed..."
                value={tenantFeedback}
                onChange={(e) => setTenantFeedback(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.btnRow} style={{ marginTop: '14px' }}>
              <button
                className={styles.btnApprove}
                onClick={() => call(
                  () => approveResolution(
                    ticket.id,
                    notes || tenantFeedback || 'Tenant confirmed issue resolved',
                    tenantRating,
                    tenantFeedback || notes
                  ),
                  'Resolution confirmed! Ticket marked as Completed with your feedback.'
                )}
              >
                ✅ Yes, Issue Solved (Mark Completed)
              </button>
              <button
                className={styles.btnReject}
                onClick={() => call(
                  () => rejectResolution(
                    ticket.id,
                    tenantFeedback || notes || 'Issue not resolved - Tenant requested rework'
                  ),
                  'Ticket returned to In Progress for rework.'
                )}
              >
                ❌ No, Issue Not Fixed (Request Rework)
              </button>
            </div>
          </div>
        )}

        {/* Closed & Inactive Status Card with Reopening Workflow */}
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
              All work has been completed and the issue was confirmed resolved by the tenant. This ticket is officially closed and inactive. Normal processing, assignments, and status modifications are disabled.
            </p>

            {/* Pending Reopening Request Box */}
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

                {/* Manager / Admin Review Actions */}
                {(role === 'admin' || role === 'ceo' || role === 'manager') && (() => {
                  const isAuthorizedManager = role === 'admin' || role === 'ceo' || (
                    role === 'manager' && (
                      !ticket.departmentId ||
                      ticket.departmentId === (user as any)?.department_id ||
                      (user as any)?.departments?.some((d: any) => d.id === ticket.departmentId || d === ticket.departmentId)
                    )
                  );

                  if (!isAuthorizedManager) {
                    return (
                      <div style={{ fontSize: '13px', color: '#b45309', fontStyle: 'italic', background: '#fef3c7', padding: '8px 12px', borderRadius: '6px' }}>
                        ℹ️ Reopening approval for this ticket is restricted to the assigned Department Manager or System Administrator.
                      </div>
                    );
                  }

                  return (
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
                  );
                })()}

                {/* Tenant pending notice */}
                {role === 'tenant' && (
                  <div style={{ fontSize: '13px', color: '#92400e', fontStyle: 'italic' }}>
                    Your reopening request has been delivered to management and is awaiting review. You will receive a notification once a decision is made.
                  </div>
                )}
              </div>
            )}

            {/* Declined notice if previously rejected */}
            {(ticket.reopenStatus === 'rejected' || ticket.reopen_status === 'rejected') && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginTop: '10px', fontSize: '13px', color: '#991b1b' }}>
                ℹ️ Previous reopening request was reviewed and declined. The ticket remains closed.
              </div>
            )}

            {/* Tenant Request Reopen Button (if not already requested) */}
            {role === 'tenant' && ticket.reopenStatus !== 'requested' && ticket.reopen_status !== 'requested' && (
              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  className={styles.btnAmber}
                  onClick={() => { setReopenReason(''); setReopenModal(true); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                >
                  <ArrowPathIcon style={{ width: 16, height: 16 }} />
                  Request Ticket Reopening
                </button>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  If the issue remains unfinished, unresolved, or requires further attention, you can request reopening for review by management.
                </div>
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
            {ticket.reopenReason && (
              <div className={styles.reopenedReasonBox}>
                <span className={styles.reopenedReasonLabel}>Reason for Reopening:</span>
                <p className={styles.reopenedReasonText}>{ticket.reopenReason}</p>
              </div>
            )}
            <div className={styles.reopenedMetaGrid}>
              {(ticket.reopenedAt || ticket.reopened_at) && (
                <div className={styles.reopenedMetaItem}>
                  <span className={styles.reopenedMetaLabel}>Reopened:</span>
                  <span className={styles.reopenedMetaValue}>{new Date(ticket.reopenedAt || ticket.reopened_at || '').toLocaleString()}</span>
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

        {(role === 'admin' || role === 'manager' || role === 'staff') && relatedArticles.length > 0 && (
          <div className={styles.card}>
            <h3>📚 Related Knowledge Base</h3>
            {loadingRelated && <p style={{ color: '#64748b' }}>Loading related articles...</p>}
            <ul className={styles.relatedArticles}>
              {relatedArticles.map((a) => (
                <li key={a.id}>
                  <Link to={`/admin/knowledge/${a.articleReference || a.id.slice(0, 4)}`} className={styles.kbLink}>
                    <strong>{a.title}</strong>
                    <span>{a.articleReference} · {a.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
                    canNotifyTenant(user, ticket) ? (
                      <button
                        type="button"
                        className={styles.tenantEmailLink}
                        title={`Send official notification to ${ticket.tenantEmail || ticket.createdByEmail}`}
                        onClick={() => {
                          setContactSubject(`Regarding Ticket #${ticket.referenceNumber}: ${ticket.title}`);
                          setContactTarget({
                            email: (ticket.tenantEmail || ticket.createdByEmail)!,
                            name: ticket.tenantName || ticket.createdByName || ticket.tenantContactPerson || 'Ticket Submitter',
                            roleOrType: 'Ticket Submitter',
                            ticketId: ticket.id,
                          });
                        }}
                      >
                        <EnvelopeIcon className={styles.contactIconSmall} />
                        <span className={styles.emailTextStrong}>{ticket.tenantEmail || ticket.createdByEmail}</span>
                      </button>
                    ) : (
                      <span
                        className={styles.tenantEmailReadOnly}
                        title="Official email notifications to tenants are restricted to Administrators and the assigned Department Manager"
                      >
                        <EnvelopeIcon className={styles.contactIconSmall} />
                        <span className={styles.emailTextStrong}>{ticket.tenantEmail || ticket.createdByEmail}</span>
                      </span>
                    )
                  ) : (
                    <span className={styles.textMuted}>No email on record</span>
                  )}
                </td>
                <td>
                  {(ticket.tenantEmail || ticket.createdByEmail) && (
                    canNotifyTenant(user, ticket) ? (
                      <span className={styles.autoFetchedPill}>✓ Direct Email Link</span>
                    ) : (
                      <span className={styles.restrictedContactPill}>🔒 Admin/Manager Only</span>
                    )
                  )}
                </td>
              </tr>
              <tr>
                <td><strong>Tenant / Creator Phone</strong></td>
                <td>
                  {(ticket.tenantPhone || ticket.createdByPhone) ? (
                    canNotifyTenant(user, ticket) ? (
                      <a
                        href={`tel:${ticket.tenantPhone || ticket.createdByPhone}`}
                        className={styles.tenantPhoneLink}
                        title={`Call ${ticket.tenantPhone || ticket.createdByPhone}`}
                      >
                        <PhoneIcon className={styles.contactIconSmall} />
                        <span className={styles.phoneTextStrong}>{ticket.tenantPhone || ticket.createdByPhone}</span>
                      </a>
                    ) : (
                      <span
                        className={styles.tenantPhoneReadOnly}
                        title="Direct calls to tenants are restricted to Administrators and the assigned Department Manager"
                      >
                        <PhoneIcon className={styles.contactIconSmall} />
                        <span className={styles.phoneTextStrong}>{ticket.tenantPhone || ticket.createdByPhone}</span>
                      </span>
                    )
                  ) : (
                    <span className={styles.textMuted}>No phone number on record</span>
                  )}
                </td>
                <td>
                  {(ticket.tenantPhone || ticket.createdByPhone) && (
                    canNotifyTenant(user, ticket) ? (
                      <span className={styles.autoFetchedPill}>✓ Direct Telephone Link</span>
                    ) : (
                      <span className={styles.restrictedContactPill}>🔒 Admin/Manager Only</span>
                    )
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
              const uploaderId = file.uploadedBy || (file as any).uploaded_by;
              const isCreator = Boolean(ticket.createdBy && String(ticket.createdBy) === String(user?.id));
              const isUploader = Boolean(uploaderId && String(uploaderId) === String(user?.id));
              const isAdmin = Boolean(user && (user.role === 'admin' || user.role === 'ceo'));
              const canManage = Boolean(user && (isUploader || isCreator || isAdmin));

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
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(file)}
                        className={styles.attachmentFileName}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                        title={`Click to preview: ${fileName}`}
                      >
                        {fileName}
                      </button>
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
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(file)}
                        className={styles.attachmentActionBtn}
                        title="View file preview"
                      >
                        <EyeIcon className={styles.attachmentActionIcon} />
                      </button>
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
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditAttachment(file);
                              setEditAttachmentComment(comment || '');
                            }}
                            className={styles.attachmentActionBtnEdit}
                            title="Edit attachment description / comment"
                          >
                            <PencilSquareIcon className={styles.attachmentActionIcon} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachmentPrompt(file)}
                            className={styles.attachmentActionBtnDelete}
                            title="Delete attachment permanently from database"
                          >
                            <TrashIcon className={styles.attachmentActionIcon} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Optional Image Thumbnail Preview */}
                  {isImage && (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(file)}
                      className={styles.attachmentThumbContainer}
                      title="Click to preview image"
                      style={{ cursor: 'pointer', background: 'transparent', padding: 0, textAlign: 'left', width: '100%', border: 'none' }}
                    >
                      <img src={fileUrl} alt={fileName} className={styles.attachmentThumb} loading="lazy" />
                    </button>
                  )}

                  {/* Middle: Uploader Badge */}
                  <div className={styles.attachmentUploaderRow}>
                    <div className={styles.attachmentUploaderUser}>
                      <UserCircleIcon className={styles.uploaderAvatarIcon} />
                      <span className={styles.uploaderName}>
                        {uploaderName}
                        {(isUploader || isMe(uploaderId, (file as any).uploaderEmail, uploaderName)) && <span className={styles.youBadge}>You</span>}
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
            const isAdmin = v === 'admin';
            const isPrivate = v === 'internal' || v === 'department' || !!reply.isInternal || !!reply.targetUserId;
            const isTenantReply = reply.userRole === 'tenant';
            const isDirect = ticket?.routingType === 'direct';

            let label = '📢 Public';
            let badgeClass = styles.badgePublic;

            if (reply.targetUserId) {
              label = `🎯 To Staff: ${reply.targetUserName || 'Staff'}`;
              badgeClass = styles.badgeTargetStaff;
            } else if (isAdmin) {
              label = '🛡️ Admin Only';
              badgeClass = styles.badgeAdmin;
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

            const canManagerAssign = (role === 'manager' || role === 'admin') && isTenantReply;

            return (
              <li key={reply.id} className={isAdmin || isPrivate ? styles.internal : styles.replyItem}>
                <div className={styles.replyHeader}>
                  <strong className={styles.replyAuthor}>{reply.userName || 'System'}</strong>
                  <span className={badgeClass}>{label}</span>
                  <span className={styles.time}>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                  {canManagerAssign && (
                    <button
                      type="button"
                      className={styles.assignCommentBtn}
                      onClick={() => {
                        setAssignPrefill({
                          text: `[Re: Tenant comment from ${reply.userName || 'Tenant'}]: "${reply.message}"\n\nStaff Instructions: `,
                        });
                        const el = document.getElementById('ticket-reply-form');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title="Assign this tenant comment to a staff member in your department"
                    >
                      ↪ Assign to Staff
                    </button>
                  )}
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
                            {ev.fromStatus ? STATUS_LABELS[ev.fromStatus as TicketStatus] || ev.fromStatus : 'Created'} →{' '}
                            <span style={{ color: ev.toStatus === 'reopened' ? '#d97706' : 'inherit', fontWeight: ev.toStatus === 'reopened' ? 700 : 'inherit' }}>
                              {STATUS_LABELS[ev.toStatus as TicketStatus] || ev.toStatus}
                            </span>
                            {ev.toStatus === 'reopened' && (
                              <span style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #fde68a' }}>
                                REOPENED
                              </span>
                            )}
                          </div>
                        )}
                        {ev.kind === 'comment' && (
                          <div className={styles.timelineMessage}>
                            {(ev.visibility === 'tenant' ? '[Tenant] ' : '') + (ev.visibility === 'department' ? '[Department] ' : '') + (ev.visibility === 'both' ? '[Tenant+Dept] ' : '') + (ev.visibility === 'internal' ? '[Internal] ' : '') + (ev.message || '')}
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

      {/* Modals */}
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

      <Modal open={deptModal} title="Assign Department & Manager" onClose={closeDeptModal}>
        <div className={styles.modalForm}>
          <label>Department</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">Select Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {selectedDept && (
            <>
              <label>Department Manager (Validated Role & Department)</label>
              {loadingManagers ? (
                <div style={{ fontSize: '0.85rem', color: '#6b7280', padding: '4px 0' }}>Checking active managers for department...</div>
              ) : deptManagers.length > 0 ? (
                <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
                  {deptManagers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.email}) {m.isHead ? '★ Head Manager' : '• Manager'}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '4px' }}>
                  ⚠️ No active manager currently assigned to this department. Ticket will enter department unassigned queue.
                </div>
              )}
            </>
          )}

          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional directives, instructions, or notes for the assigned department..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={closeDeptModal}
              style={{
                background: 'var(--tk-bg-surface, #ffffff)',
                color: 'var(--tk-text-secondary, #475569)',
                border: '1px solid var(--tk-border-subtle, #cbd5e1)',
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
        onClose={closeStaffModal}
        maxWidth="540px"
      >
        <div className={styles.modalForm}>
          {ticket?.assignedTo && (
            <div className={styles.assignmentCurrentBox}>
              <UserIcon className={styles.assignmentCurrentIcon} />
              <span className={styles.assignmentCurrentLabel}>Currently Assigned:</span>
              <strong className={styles.assignmentCurrentValue}>{ticket.assignedToName || 'Assigned Staff'}</strong>
            </div>
          )}

          <label>Staff Member <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className={styles.modalSelect}
          >
            <option value="">Select Staff</option>
            {staffUsers.map((s) => {
              const isCurrent = s.id === ticket?.assignedTo;
              return (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} {isCurrent ? '— (Currently Assigned)' : ''}
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
              <p style={{ margin: '6px 0 10px 0', fontSize: '0.82rem', color: '#6b7280' }}>
                If the staff member has not seen or fixed this task, click below to send them a direct reminder alert and email.
              </p>
              <button
                type="button"
                className={styles.btnReminderInline}
                disabled={remindingStaff}
                onClick={() => handleSendReminderSubmit(notes)}
              >
                <BellAlertIcon style={{ width: 15, height: 15 }} />
                {remindingStaff ? 'Sending Reminder...' : `Send Reminder to ${ticket.assignedToName || 'Staff'}`}
              </button>
            </div>
          )}

          <label>Assignment Notes / Handover Instructions</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add optional assignment notes or handover instructions..."
            className={styles.modalTextarea}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={closeStaffModal}
              disabled={assigningStaff}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedStaff || selectedStaff === ticket?.assignedTo || assigningStaff}
              onClick={handleAssignStaffSubmit}
              className={styles.modalSubmitBtn}
            >
              <UserPlusIcon style={{ width: 16, height: 16, marginRight: 6, display: 'inline-block', verticalAlign: 'text-bottom' }} />
              {assigningStaff ? 'Assigning...' : (ticket?.assignedTo ? 'Reassign Staff' : 'Assign Staff')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={remindModal}
        title="Send Assignment Reminder"
        onClose={() => { setRemindModal(false); setRemindNotes(''); }}
        maxWidth="540px"
      >
        <div className={styles.modalForm}>
          <div className={styles.remindInfoBox}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              Send a task reminder to {ticket?.assignedToName || 'the assigned staff member'}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
              A high-priority in-app notification alert and an email reminder will be sent to their registered profile account.
            </p>
          </div>

          <label>Reminder Message / Notes (Optional)</label>
          <textarea
            rows={3}
            value={remindNotes}
            onChange={(e) => setRemindNotes(e.target.value)}
            placeholder="e.g. Please check and provide an update on this assigned task as soon as possible..."
            className={styles.modalTextarea}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={() => { setRemindModal(false); setRemindNotes(''); }}
              disabled={remindingStaff}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnAmber}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 6, fontWeight: 600, fontSize: '0.88rem', border: 'none', cursor: 'pointer' }}
              onClick={() => handleSendReminderSubmit()}
              disabled={remindingStaff}
            >
              <BellAlertIcon style={{ width: 16, height: 16 }} />
              {remindingStaff ? 'Sending...' : 'Send Reminder'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={attributionModal} title="Control Assignment Attribution" onClose={() => setAttributionModal(false)}>
        <div className={styles.modalForm}>
          {(() => {
            const staffAssignments = (ticket.assignments || []).filter((a) => a.role === 'staff') || [];
            const latestStaff = staffAssignments.length ? staffAssignments[staffAssignments.length - 1] : null;
            return (
              <>
                <p><strong>Current Assignee:</strong> {ticket.assignedToName || '—'}</p>
                <p><strong>Current Attribution (Assigned By):</strong> {latestStaff?.assignedByName || '—'}</p>
              </>
            );
          })()}
          <label>Reassign To (leave empty to clear current assignee)</label>
          <select value={overrideAssignTo} onChange={(e) => setOverrideAssignTo(e.target.value)}>
            <option value="">Clear assignee</option>
            {staffUsers.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
          </select>
          <label>Assigned By (override attribution)</label>
          <select value={overrideAssignedBy} onChange={(e) => setOverrideAssignedBy(e.target.value)}>
            <option value={user?.id || ''}>{user?.firstName} {user?.lastName} (me)</option>
            {attributionUsers
              .filter((u) => u.id !== (user?.id || ''))
              .map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>)}
          </select>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            onClick={async () => {
              await call(
                () => overrideAssignment(ticket.id, {
                  assignedTo: overrideAssignTo || null,
                  assignedBy: overrideAssignedBy || null,
                  notes,
                }),
                'Assignment attribution overridden'
              );
              setAttributionModal(false);
            }}
          >
            Save
          </button>
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
                      onChange={() => { }}
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
          {role === 'admin' && (
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
          )}
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
            <label className={styles.modalLabel}>Select File(s) (Max 10, 25MB each — Screenshots, Images, PDF, Docs, Excel, ZIP)</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.tar,.gz,.7z,.png,.jpg,.jpeg,.webp,.gif,.bmp,image/*"
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

      {/* Attachment In-App Preview Modal */}
      <Modal
        open={Boolean(previewAttachment)}
        title={previewAttachment ? `Attachment: ${previewAttachment.fileName || (previewAttachment as any).file_name || 'Preview'}` : 'Attachment Preview'}
        onClose={() => setPreviewAttachment(null)}
        maxWidth="850px"
      >
        {previewAttachment && (() => {
          const pName = previewAttachment.fileName || (previewAttachment as any).file_name || 'Attachment';
          const pRaw = previewAttachment.filePath || (previewAttachment as any).file_path || '';
          const pUrl = buildAttachmentUrl(pRaw) || (pRaw.startsWith('http') ? pRaw : `${API_BASE}${pRaw}`);
          const pIsImg = (previewAttachment.mimeType || (previewAttachment as any).mime_type || '').startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(pName);
          const pIsPdf = (previewAttachment.mimeType || (previewAttachment as any).mime_type || '').includes('pdf') ||
            /\.pdf$/i.test(pName);
          const pSize = formatFileSize(previewAttachment.fileSize || (previewAttachment as any).file_size);
          const pUploader = previewAttachment.uploadedByName || (previewAttachment as any).uploaded_by_name || 'User';
          const pComment = previewAttachment.comment || (previewAttachment as any).comment;

          return (
            <div className={styles.attachmentPreviewModalBody}>
              {pIsImg ? (
                <img src={pUrl} alt={pName} className={styles.attachmentPreviewImage} />
              ) : pIsPdf ? (
                <iframe src={pUrl} title={pName} className={styles.attachmentPreviewDoc} />
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', width: '100%' }}>
                  <DocumentIcon style={{ width: 64, height: 64, margin: '0 auto 12px', color: '#64748b' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#1e293b' }}>{pName}</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Direct in-browser viewer not supported for this document format ({pSize || 'File'}). You can download it or open original.
                  </p>
                  <a
                    href={pUrl}
                    download={pName}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnPrimary}
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowDownTrayIcon style={{ width: 18, height: 18 }} />
                    Download {pName}
                  </a>
                </div>
              )}

              {pComment && (
                <div className={styles.attachmentCommentBox} style={{ width: '100%' }} role="alert">
                  <div className={styles.commentBoxHeader}>
                    <div className={styles.commentBoxLabel}>
                      <ExclamationTriangleIcon className={styles.commentBoxIcon} />
                      <span>Why Uploaded / Comment:</span>
                    </div>
                    <span className={styles.commentBoxNoticeBadge}>Uploader Note</span>
                  </div>
                  <p className={styles.commentBoxText}>{pComment}</p>
                </div>
              )}

              <div className={styles.attachmentPreviewFooter}>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Uploaded by <strong>{pUploader}</strong> {pSize ? `• ${pSize}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={pUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnSlate}
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <EyeIcon style={{ width: 16, height: 16 }} />
                    Open Original
                  </a>
                  <a
                    href={pUrl}
                    download={pName}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnPrimary}
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowDownTrayIcon style={{ width: 16, height: 16 }} />
                    Download
                  </a>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Edit Attachment Comment Modal */}
      <Modal
        open={Boolean(editAttachment)}
        title="Edit Attachment Comment / Reason"
        onClose={() => {
          if (!editAttachmentSaving) {
            setEditAttachment(null);
            setEditAttachmentComment('');
          }
        }}
        maxWidth="540px"
      >
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>File</label>
            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
              {editAttachment?.fileName || (editAttachment as any)?.file_name}
            </div>
          </div>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Why was this file uploaded? (Comment / Reason)</label>
            <textarea
              className={styles.modalTextarea}
              rows={4}
              placeholder="Update purpose or notes for this attachment..."
              value={editAttachmentComment}
              onChange={(e) => setEditAttachmentComment(e.target.value)}
            />
            <span className={styles.modalHint}>
              Only the uploader or an Administrator can edit this comment.
            </span>
          </div>
          <div className={styles.modalFooterActions}>
            <button
              type="button"
              className={styles.btnSlate}
              disabled={editAttachmentSaving}
              onClick={() => {
                setEditAttachment(null);
                setEditAttachmentComment('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={editAttachmentSaving}
              onClick={async () => {
                if (!editAttachment) return;
                setEditAttachmentSaving(true);
                await call(
                  () => updateTicketAttachment(ticket.id, editAttachment.id, editAttachmentComment),
                  'Attachment updated successfully'
                );
                setEditAttachmentSaving(false);
                setEditAttachment(null);
                setEditAttachmentComment('');
              }}
            >
              {editAttachmentSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Attachment Confirmation Modal */}
      <Modal
        open={Boolean(deleteAttachmentTarget)}
        title="Delete Attachment"
        onClose={() => {
          if (!deleteAttachmentDeleting) {
            setDeleteAttachmentTarget(null);
          }
        }}
        maxWidth="460px"
      >
        <div className={styles.modalForm}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              flexShrink: 0
            }}>
              <TrashIcon style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
                Are you sure you want to delete this file?
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {deleteAttachmentTarget?.fileName || (deleteAttachmentTarget as any)?.file_name}
              </p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', padding: '10px 12px', borderRadius: 8 }}>
            Warning: This file will be permanently removed from the database and storage, and cannot be recovered.
          </p>
          <div className={styles.modalFooterActions}>
            <button
              type="button"
              className={styles.btnSlate}
              disabled={deleteAttachmentDeleting}
              onClick={() => setDeleteAttachmentTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnReject}
              disabled={deleteAttachmentDeleting}
              onClick={async () => {
                if (!deleteAttachmentTarget) return;
                const targetId = deleteAttachmentTarget.id || (deleteAttachmentTarget as any).id;
                const currentTicketId = ticket?.id || id || '';
                setDeleteAttachmentDeleting(true);
                try {
                  await deleteTicketAttachment(currentTicketId, targetId);
                  flash('Attachment permanently deleted from database');
                  loadTicket(); loadReplies(); loadTimeline();
                } catch (e: any) {
                  if (e?.response?.status === 404) {
                    flash('Attachment removed from database');
                    loadTicket(); loadReplies(); loadTimeline();
                  } else {
                    flash(e?.response?.data?.message || 'Failed to delete attachment', true);
                  }
                }
                setDeleteAttachmentDeleting(false);
                setDeleteAttachmentTarget(null);
              }}
            >
              {deleteAttachmentDeleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Announce Update to Tenant Modal */}
      <Modal
        open={announceModal}
        title="📢 Announce Update to Tenant"
        onClose={() => {
          if (!announceSubmitting) {
            setAnnounceModal(false);
            setAnnounceMessage('');
          }
        }}
        maxWidth="580px"
      >
        <div className={styles.announceModalForm}>
          {/* Recipient Context Bar */}
          <div className={styles.announceContextCard}>
            <div className={styles.announceContextItem}>
              <span>👤 Recipient:</span>
              <span className={styles.announceContextBadge}>
                {ticket.tenantName || 'Assigned Tenant'}
              </span>
              {ticket.tenantEmail && (
                <span style={{ fontSize: '0.74rem', opacity: 0.85 }}>({ticket.tenantEmail})</span>
              )}
            </div>
            <div className={styles.announceTargetPill}>
              <span>🔔 Direct Notification</span>
            </div>
          </div>

          {/* Accessible Notice Banner with explicit contrast for both themes */}
          <div className={styles.announceNoticeBox}>
            <InformationCircleIcon className={styles.announceNoticeIcon} />
            <div className={styles.announceNoticeContent}>
              <div>
                This message will be <strong>visible to the tenant</strong> and will trigger an immediate push notification and timeline update.
              </div>
              <span className={styles.announceNoticeSub}>
                Use announcements for status reports, scheduling visits, or requesting tenant verification.
              </span>
            </div>
          </div>

          {/* Fast Announcement Presets */}
          <div className={styles.announceTemplateBar}>
            <div className={styles.announceTemplateHeader}>
              <span className={styles.announceTemplateTitle}>Quick Presets</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--tk-text-muted)' }}>Click to prefill message</span>
            </div>
            <div className={styles.announceTemplatePills}>
              {[
                { label: '🚀 Under Review', text: 'We have received your request and our team is actively investigating the issue. Expected update shortly.' },
                { label: '⏳ In Progress', text: 'Technicians are currently working on your ticket. We will keep you updated as progress is made.' },
                { label: '🛠️ Scheduled Visit', text: 'A specialized technician has been scheduled to inspect and resolve this matter on-site.' },
                { label: '✅ Resolution Ready', text: 'The requested fix has been implemented. Please test and confirm if everything is working normally.' },
              ].map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className={styles.announceTemplatePill}
                  onClick={() => setAnnounceMessage(tpl.text)}
                  title={`Insert: "${tpl.text}"`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input Area */}
          <div className={styles.announceField}>
            <div className={styles.announceLabelRow}>
              <label className={styles.announceLabel} htmlFor="announce-message-textarea">
                Announcement Message
              </label>
              <span className={styles.announceCharCount}>
                {announceMessage.length} characters
              </span>
            </div>
            <textarea
              id="announce-message-textarea"
              className={styles.announceTextarea}
              rows={4}
              value={announceMessage}
              onChange={(e) => setAnnounceMessage(e.target.value)}
              placeholder="e.g. We have received your request and it is currently being reviewed by our team. Expected resolution by tomorrow."
            />
          </div>

          {/* Actions Footer */}
          <div className={styles.announceFooterActions}>
            <button
              type="button"
              className={styles.announceCancelBtn}
              onClick={() => {
                setAnnounceModal(false);
                setAnnounceMessage('');
              }}
              disabled={announceSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.announceSubmitBtn}
              disabled={!announceMessage.trim() || announceSubmitting}
              onClick={async () => {
                if (!announceMessage.trim() || announceSubmitting) return;
                setAnnounceSubmitting(true);
                try {
                  await call(
                    () => addTicketReply(ticket.id, { message: announceMessage.trim(), visibility: 'all' }),
                    '✅ Announcement sent to tenant'
                  );
                  setAnnounceMessage('');
                  setAnnounceModal(false);
                } finally {
                  setAnnounceSubmitting(false);
                }
              }}
            >
              <PaperAirplaneIcon style={{ width: 16, height: 16 }} />
              <span>{announceSubmitting ? 'Sending...' : 'Send Announcement'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Reopen Ticket Modal */}
      <Modal open={reopenModal} title={role === 'tenant' ? "Request Ticket Reopening" : "Reopen Ticket"} onClose={() => setReopenModal(false)}>
        <form
          className={styles.modalForm}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reopenReason.trim()) return;
            setReopenSubmitting(true);
            try {
              if (role === 'tenant') {
                await call(() => requestReopenTicket(ticket.id, reopenReason.trim()), 'Reopening request submitted for review');
              } else {
                await call(() => approveReopenTicket(ticket.id, reopenReason.trim()), 'Ticket Reopened! Active processing resumed.');
              }
              setReopenModal(false);
              setReopenReason('');
            } finally {
              setReopenSubmitting(false);
            }
          }}
        >
          <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12, fontSize: '0.875rem', color: '#92400e' }}>
            {role === 'tenant' ? (
              <>📝 <strong>Reopening Request:</strong> Please explain why the issue is unfinished, unresolved, or requires further attention. Your request will be reviewed by the Administrator or responsible Department Manager.</>
            ) : (
              <>🔄 <strong>Reopening Ticket:</strong> The ticket will return to active workflow. Its SLA resolution timer will resume with remaining time, and assigned staff and managers will be alerted.</>
            )}
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
              placeholder={role === 'tenant' ? "Explain why the issue is unfinished, unresolved, or needs further work..." : "Explain reason for reopening..."}
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
              {reopenSubmitting ? 'Submitting…' : (role === 'tenant' ? 'Submit Reopening Request' : 'Confirm & Reopen Ticket')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Decline Reopening Request Modal */}
      <Modal open={declineModal} title="Decline Reopening Request" onClose={() => setDeclineModal(false)}>
        <form
          className={styles.modalForm}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!declineReason.trim()) return;
            setDeclineSubmitting(true);
            try {
              await call(() => rejectReopenTicket(ticket.id, declineReason.trim()), 'Reopening request declined');
              setDeclineModal(false);
              setDeclineReason('');
            } finally {
              setDeclineSubmitting(false);
            }
          }}
        >
          <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fecaca', marginBottom: 12, fontSize: '0.875rem', color: '#991b1b' }}>
            ⚠️ <strong>Declining Reopening Request:</strong> The ticket will remain Closed and Inactive. A notification will be sent to the tenant.
          </div>
          <div className={styles.modalField} style={{ marginBottom: '14px' }}>
            <label className={styles.modalLabel} style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Reason for Declining <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className={styles.modalTextarea}
              rows={4}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Provide a reason for declining the reopening request..."
              required
              style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.btnSlate}
              onClick={() => setDeclineModal(false)}
              disabled={declineSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnReject}
              disabled={declineSubmitting || !declineReason.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
              {declineSubmitting ? 'Declining…' : 'Confirm Decline'}
            </button>
          </div>
        </form>
      </Modal>

      <ContactModal
        open={!!contactTarget}
        target={contactTarget}
        defaultSubject={contactSubject}
        onClose={() => setContactTarget(null)}
      />
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
  const isStaff = user?.role === 'staff';
  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';
  const isTenant = user?.role === 'tenant';
  const canTarget = user?.role !== 'tenant';

  const isDirect = ticket?.routingType === 'direct';
  const canRespondToTenant = isDirect ? isManager : isAdmin;
  const deptName = ticket?.departmentName || 'department';

  // Staff: always department-only. Tenants: both for direct, admin for general.
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'tenant' | 'department' | 'both' | 'admin' | 'staff'>(
    isStaff ? 'department' : isTenant ? (isDirect ? 'both' : 'admin') : canRespondToTenant ? 'both' : 'department'
  );
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

  // Load department staff for managers and admins to assign comments to staff
  useEffect(() => {
    if ((isManager || isAdmin) && ticket?.departmentId) {
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
  }, [isManager, isAdmin, ticket?.departmentId]);

  useEffect(() => {
    if (canTarget && !isStaff) {
      fetchActiveDepartments()
        .then((res) => setDepartments(res.data.data || []))
        .catch(() => setDepartments([]));
    }
  }, [canTarget, isStaff]);

  // Always pre-select the ticket's department
  useEffect(() => {
    if (ticket?.departmentId) setDepartmentId(ticket.departmentId);
  }, [ticket?.departmentId]);

  // Staff: reset visibility to department if it ever changes
  useEffect(() => {
    if (isStaff) setVisibility('department');
  }, [isStaff]);

  const needsDept = visibility === 'department' || visibility === 'both';
  const isAdminOnly = visibility === 'admin';
  const isTargetStaff = visibility === 'staff';

  const submit = async () => {
    if (!text.trim()) return;

    if (isTenant) {
      try {
        await addTicketReply(ticketId, {
          message: text,
          visibility: isDirect ? 'both' : 'admin',
          departmentIds: isDirect ? (ticket?.departmentId || null) : null,
        });
        setText('');
        setMsg('Reply sent');
        onReplyAdded?.();
      } catch (e: any) {
        setMsg(e?.response?.data?.message || 'Failed');
      }
      return;
    }

    if (isTargetStaff && !targetStaffId) {
      setMsg('Please select a staff member to assign the comment to');
      return;
    }

    // For staff, departmentId is the ticket department — always required
    const effectiveDeptId = isStaff ? (ticket?.departmentId || '') : (needsDept ? departmentId : null);
    if (isStaff && !effectiveDeptId) {
      setMsg('No department assigned to this ticket yet.');
      return;
    }
    const resolvedDeptId = departmentId || ticket?.departmentId || null;
    if (!isStaff && !isAdmin && needsDept && !resolvedDeptId) {
      setMsg('Please select a department');
      return;
    }
    try {
      await addTicketReply(ticketId, {
        message: text,
        visibility: isStaff ? 'department' : (isTargetStaff ? 'department' : visibility),
        departmentIds: isStaff ? effectiveDeptId : (needsDept ? departmentId : (ticket?.departmentId || null)),
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
    if (isStaff) return 'Write a message to your Department Manager…';
    if (isAdminOnly) return 'Write a private note to Admin — only admins can see this…';
    if (isTargetStaff) return 'Write an instruction or assign task to the selected staff member…';
    if (isTenant) {
      if (isDirect) {
        return `Write a reply to the ${deptName} Department Manager…`;
      }
      return 'Write a reply to Admin…';
    }
    if (needsDept && !departmentId) return 'Select a department to continue…';
    if (visibility === 'department') return 'Reply visible only to the selected department…';
    if (visibility === 'both') return 'Reply visible to tenant and the selected department…';
    return 'Reply visible to tenant and assigned team…';
  };

  return (
    <div className={styles.replyForm} id="ticket-reply-form">
      {/* Tenant: Clear category routing notice */}
      {isTenant && (
        <div
          className={`${styles.replyTenantRoutingNotice} ${isDirect ? styles.replyTenantRoutingNoticeDirect : styles.replyTenantRoutingNoticeGeneral
            }`}
        >
          <span className={styles.replyVisibilityIcon}>{isDirect ? '🏢' : '🛡️'}</span>
          <span>
            {isDirect ? (
              <>
                <strong>Direct Category Routing:</strong> Your reply will be routed directly to the{' '}
                <strong>{deptName} Department Manager</strong>.
              </>
            ) : (
              <>
                <strong>General Category Routing:</strong> Your reply will be routed to the{' '}
                <strong>Admin</strong>.
              </>
            )}
          </span>
        </div>
      )}

      {/* Staff: locked to Department — show info notice instead of selector */}
      {isStaff ? (
        <div className={styles.replyVisibilityNotice}>
          <span className={styles.replyVisibilityIcon}>🏢</span>
          <span>
            Your reply will be visible <strong>only to your Department Manager</strong>
            {ticket?.departmentName ? <> (<em>{ticket.departmentName}</em>)</> : ''}.
            Staff replies are never shown to tenants.
          </span>
        </div>
      ) : canTarget && (
        <div className={styles.replyFormControls}>
          <label className={styles.replyFormLabel}>
            Visibility:
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'tenant' | 'department' | 'both' | 'admin' | 'staff')}
              className={styles.replyFormSelect}
            >
              {canRespondToTenant && (
                <>
                  <option value="both">👤🏢 Tenant & Department — both can see</option>
                  <option value="tenant">👤 Tenant Only — visible to the tenant</option>
                </>
              )}
              <option value="department">🏢 Department Only — internal note to all dept staff</option>
              {(isManager || isAdmin) && (
                <option value="staff">🎯 Assign to Staff User — direct comment/task to staff</option>
              )}
              {isManager && (
                <option value="admin">🛡️ Admin Only — private escalation note to Admin</option>
              )}
            </select>
          </label>

          {/* Manager / Admin assigning to a specific staff user */}
          {isTargetStaff && (
            <label className={styles.replyFormLabel}>
              Assign to Staff:
              <select
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(e.target.value)}
                className={styles.replyFormSelect}
              >
                <option value="">Select staff user…</option>
                {deptStaffUsers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Admin-only private notice shown to manager */}
          {isAdminOnly && isManager && (
            <div className={styles.replyAdminNotice}>
              <span className={styles.replyVisibilityIcon}>🛡️</span>
              <span>
                This message will be <strong>visible only to Admins</strong>.
                It is hidden from tenants, staff, and other managers.
                Use this to privately escalate or inform the Admin.
              </span>
            </div>
          )}
          {needsDept && (
            <label className={styles.replyFormLabel}>
              Department:
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={styles.replyFormSelect}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
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
          (!isStaff && !isAdmin && !isTenant && needsDept && !departmentId && !ticket?.departmentId) ||
          (isTargetStaff && !targetStaffId)
        }
      >
        {isTargetStaff ? 'Assign Comment to Staff' : 'Submit Reply'}
      </button>
      {msg && <span className={styles.replySuccessMsg}>{msg}</span>}
    </div>
  );
}

