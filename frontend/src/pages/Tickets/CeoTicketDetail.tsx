import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import {
  changeTicketStatus, fetchTicket, fetchTicketReplies, addTicketReply, fetchTicketTimeline,
  assignDepartment, assignStaff, reassignStaff, acceptAssignment, rejectAssignment,
  escalateTicket, mergeTickets, fetchMergeCandidates, closeTicket, reopenTicket, approveResolution, rejectResolution,
  markResolved, changePriority, changeCategory, addInternalNote, uploadTicketAttachments,
} from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import type { Ticket, TicketStatus, TicketReply, TimelineEvent } from '../../types/ticket';
import { STATUS_LABELS, TICKET_STATUSES, TICKET_PRIORITIES } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
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
import { io, Socket } from 'socket.io-client';

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
    waiting_tenant: ['in_progress', 'resolved', 'closed', 'escalated'],
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
    waiting_tenant: ['in_progress', 'resolved', 'closed', 'escalated'],
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
    waiting_tenant: ['in_progress', 'resolved', 'escalated'],
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
  const base = user ? basePaths[user.role] : '/tenant/tickets';
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineLimit, setTimelineLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
  const socketRef = useRef<Socket | null>(null);

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
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    // Connect through Vite proxy instead of directly to localhost:5000
    const socket = io(window.location.origin, { path: '/socket.io', withCredentials: true, auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => { if (id) socket.emit('join-ticket', id); });
    socket.on('ticket:updated', () => { loadTicket(); loadReplies(); loadTimeline(); });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (deptModal || noteModal) fetchActiveDepartments().then((r) => setDepartments(r.data.data));
    if (staffModal || mergeModal) {
      fetchUsers({ role: 'staff', limit: 200 }).then((r) => {
        const list = r.data.data.filter((u) => !ticket?.departmentId || u.departments?.some((d) => d.id === ticket?.departmentId));
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
    if (isErr) setError(msg); else setMessage(msg);
    setTimeout(() => { setMessage(''); setError(''); }, 3500);
  };

  const getTransitions = (): TicketStatus[] => {
    if (!ticket || !user) return [];
    return TRANSITIONS[user.role]?.[ticket.status] || [];
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
                <span className={`${styles.badge} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
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
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <UserCircleIcon className={styles.detailLabelIcon} />
                Assigned To
              </span>
              <span className={styles.detailValue}>
                {ticket.assignedToName ? (
                  <span className={styles.userChip}>
                    <UserCircleIcon />
                    {ticket.assignedToName}
                  </span>
                ) : (
                  <span className={styles.unassignedChip}>Unassigned</span>
                )}
              </span>
            </div>
            {(() => {
              const staffAssignments = (ticket.assignments || []).filter((a) => a.role === 'staff') || [];
              const latestStaff = staffAssignments.length ? staffAssignments[staffAssignments.length - 1] : null;
              const latestHistory = (ticket.statusHistory || []).slice().reverse()[0];
              return (
                <>
                  {latestStaff?.assignedByName && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>
                        <UserPlusIcon className={styles.detailLabelIcon} />
                        Assigned By
                      </span>
                      <span className={styles.detailValue}>
                        <span className={styles.userChip}>
                          <UserPlusIcon />
                          {latestStaff.assignedByName}
                        </span>
                      </span>
                    </div>
                  )}
                  {latestHistory?.changedByName && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>
                        <ArrowPathIcon className={styles.detailLabelIcon} />
                        Changed By
                      </span>
                      <span className={styles.detailValue}>
                        <span className={styles.userChip}>
                          <UserCircleIcon />
                          {latestHistory.changedByName}
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
                Tenant
              </span>
              <span className={styles.detailValue}>
                {ticket.tenantName ? (
                  <span className={styles.tenantChip}>
                    <BuildingOfficeIcon />
                    {ticket.tenantName}
                  </span>
                ) : (
                  <span className={styles.unassignedChip}>—</span>
                )}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <UserCircleIcon className={styles.detailLabelIcon} />
                Created By
              </span>
              <span className={styles.detailValue}>
                {ticket.createdByName ? (
                  <span className={styles.userChip}>
                    <UserCircleIcon />
                    {ticket.createdByName}
                  </span>
                ) : (
                  <span className={styles.unassignedChip}>—</span>
                )}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <EnvelopeIcon className={styles.detailLabelIcon} />
                Tenant Email
              </span>
              <span className={styles.detailValue}>
                {ticket.tenantEmail || ticket.createdByEmail ? (
                  <a
                    href={`mailto:${ticket.tenantEmail || ticket.createdByEmail}`}
                    className={styles.tenantEmailLink}
                    title={`Send email to ${ticket.tenantEmail || ticket.createdByEmail}`}
                  >
                    <EnvelopeIcon className={styles.contactIconSmall} />
                    <span className={styles.emailText}>{ticket.tenantEmail || ticket.createdByEmail}</span>
                  </a>
                ) : (
                  <span className={styles.unassignedChip}>—</span>
                )}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <PhoneIcon className={styles.detailLabelIcon} />
                Tenant Contact
              </span>
              <span className={styles.detailValue}>
                {ticket.tenantPhone || ticket.createdByPhone ? (
                  <a
                    href={`tel:${ticket.tenantPhone || ticket.createdByPhone}`}
                    className={styles.tenantPhoneLink}
                    title={`Call ${ticket.tenantPhone || ticket.createdByPhone}`}
                  >
                    <PhoneIcon className={styles.contactIconSmall} />
                    <span>{ticket.tenantPhone || ticket.createdByPhone}</span>
                  </a>
                ) : (
                  <span className={styles.unassignedChip}>—</span>
                )}
              </span>
            </div>
            {ticket.tenantContactPerson && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <UserIcon className={styles.detailLabelIcon} />
                  Primary Contact
                </span>
                <span className={styles.detailValue}>
                  <span className={styles.userChip}>
                    <UserIcon />
                    {ticket.tenantContactPerson}
                  </span>
                </span>
              </div>
            )}
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
        const hasWorkflowActions =
          transitions.length > 0 ||
          (role === 'admin' && (ticket.routingType ?? 'general') !== 'direct') ||
          (role === 'manager' && !!ticket.departmentId) ||
          ((role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open')) ||
          (role === 'staff' && ticket.status === 'in_progress') ||
          (role === 'manager' && (ticket.status === 'under_review' || ticket.status === 'in_progress')) ||
          ((role === 'admin' || role === 'ceo') && (ticket.status === 'pending_approval' || ticket.status === 'in_progress' || ticket.status === 'under_review')) ||
          transitions.includes('closed') ||
          transitions.includes('reopened');

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
                          onClick={() => setDeptModal(true)}
                          disabled={ticket.isOverdue}
                          title={ticket.isOverdue ? 'Cannot assign department: SLA overdue' : 'Assign Department'}
                        >
                          <BuildingOffice2Icon className={styles.btnIcon} />
                          Assign Dept
                        </button>
                      )}
                      {role === 'manager' && ticket.departmentId && (
                        <button
                          className={styles.btnInfo}
                          onClick={() => setStaffModal(true)}
                          disabled={ticket.isOverdue}
                          title={ticket.isOverdue ? 'Cannot assign staff: SLA overdue' : 'Assign Staff'}
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
                      {transitions.includes('reopened') && (
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
      {(role === 'admin' || role === 'ceo' || role === 'manager' || role === 'staff') && ticket.status === 'waiting_tenant' && (
        <div className={`${styles.card} ${styles.slaWarningCard}`}>
          <h3><span>⏳</span> Waiting for Tenant Confirmation</h3>
          <p>
            The ticket has been resolved by our team and verified by Admin. Waiting for the tenant to inspect the resolution, rate satisfaction, and confirm if the issue is solved.
          </p>
        </div>
      )}

      {/* Completed Banner */}
      {ticket.status === 'completed' && (
        <div className={`${styles.card} ${styles.completedCard}`}>
          <h3><span>🎉</span> Ticket Completed</h3>
          <p>The tenant has verified and confirmed this ticket is solved. The request is officially completed.</p>
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
            {ticket.reopenedAt && (
              <div className={styles.reopenedMetaItem}>
                <span className={styles.reopenedMetaLabel}>Reopened:</span>
                <span className={styles.reopenedMetaValue}>{new Date(ticket.reopenedAt).toLocaleString()}</span>
              </div>
            )}
            {ticket.reopenedByName && (
              <div className={styles.reopenedMetaItem}>
                <span className={styles.reopenedMetaLabel}>Reopened By:</span>
                <span className={styles.reopenedMetaValue}>{ticket.reopenedByName}</span>
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
                      <span className={styles.uploaderName}>{uploaderName}</span>
                      {uploaderRole && (
                        <span className={`${styles.uploaderRoleBadge} ${styles['role_' + uploaderRole.toLowerCase()] || styles.role_default}`}>
                          {uploaderRole.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Why the file was uploaded (Comment / Reason) */}
                  <div className={styles.attachmentCommentBox}>
                    <div className={styles.commentBoxLabel}>
                      <ChatBubbleBottomCenterTextIcon className={styles.commentBoxIcon} />
                      <span>Why uploaded / Comment:</span>
                    </div>
                    <p className={styles.commentBoxText}>
                      {comment || <span className={styles.commentBoxMuted}>No comment provided</span>}
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
        {role !== 'ceo' && <ReplyForm ticketId={ticket.id} canInternal={role !== 'tenant'} />}
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
                            {ev.fromStatus ? STATUS_LABELS[ev.fromStatus as TicketStatus] || ev.fromStatus : 'Created'} → {STATUS_LABELS[ev.toStatus as TicketStatus] || ev.toStatus}
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

      <Modal open={deptModal} title="Assign Department" onClose={() => setDeptModal(false)}>
        <div className={styles.modalForm}>
          <label>Department</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">Select Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button disabled={!selectedDept} onClick={() => call(() => assignDepartment(ticket.id, { departmentId: selectedDept, notes }), 'Department assigned')}>Assign</button>
        </div>
      </Modal>

      <Modal open={staffModal} title="Assign Staff" onClose={() => setStaffModal(false)}>
        <div className={styles.modalForm}>
          <label>Staff</label>
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
            <option value="">Select Staff</option>
            {staffUsers.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
          </select>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button disabled={!selectedStaff} onClick={() => call(() => assignStaff(ticket.id, { staffId: selectedStaff, notes }), 'Staff assigned')}>Assign</button>
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
                        <span>Status: {STATUS_LABELS[cand.status] || cand.status}</span>
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

function ReplyForm({ ticketId, canInternal }: { ticketId: string; canInternal: boolean }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'internal'>('all');
  const [msg, setMsg] = useState('');
  const submit = async () => {
    if (!text.trim()) return;
    try {
      await addTicketReply(ticketId, { message: text, visibility: canInternal ? visibility : 'all' });
      setText(''); setMsg('Reply added');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed');
    }
  };
  return (
    <div className={styles.replyForm}>
      {canInternal && (
        <div>
          <label>Visibility:
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'all' | 'internal')}
            >
              <option value="all">📢 Visible to All</option>
              <option value="internal">🔒 Internal Only (Staff & Managers)</option>
            </select>
          </label>
        </div>
      )}
      <textarea rows={3} placeholder="Add a reply..." value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={submit} disabled={!text.trim()}>Submit Reply</button>
      {msg && <span style={{ color: '#166534', fontWeight: 600 }}>{msg}</span>}
    </div>
  );
}
