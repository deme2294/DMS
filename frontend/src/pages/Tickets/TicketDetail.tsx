import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import {
   changeTicketStatus, fetchTicket, fetchTicketReplies, addTicketReply, fetchTicketTimeline,
   assignDepartment, assignStaff, reassignStaff, acceptAssignment, rejectAssignment,
   escalateTicket, mergeTickets, closeTicket, reopenTicket, approveResolution, rejectResolution,
   markResolved, changePriority, changeCategory, addInternalNote, uploadTicketAttachments,
   overrideAssignment, fetchDepartmentManagers, type DepartmentManager,
 } from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import { searchArticles } from '../../api/knowledgeApi';
import type { Ticket, TicketStatus, TicketReply, TimelineEvent } from '../../types/ticket';
import type { User } from '../../types/user';
import type { Article } from '../../types/article';
import { STATUS_LABELS, TICKET_STATUSES, TICKET_PRIORITIES } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import styles from './Tickets.module.css';
import { io, Socket } from 'socket.io-client';

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
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'closed', 'escalated'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    // legacy
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'completed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'completed', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    under_review: ['assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
    pending_approval: ['resolved', 'in_progress'],
  },
  manager: {
    assigned: ['in_progress', 'rejected'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed', 'escalated'],
    pending: ['in_progress', 'escalated'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'escalated'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress'],
    completed: ['reopened', 'closed'],
    reopened: ['in_progress', 'escalated'],
    // legacy
    accepted: ['in_progress', 'escalated'],
    escalated: ['in_progress', 'resolved', 'waiting_tenant', 'completed'],
    assigned_department: ['assigned_staff'],
    assigned_staff: ['in_progress'],
    pending_approval: ['resolved', 'in_progress'],
  },
  staff: {
    assigned: ['in_progress'],
    in_progress: ['pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'completed'],
    pending: ['in_progress'],
    waiting_tenant: ['in_progress', 'resolved', 'completed'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'completed', 'in_progress'],
    completed: ['reopened'],
    reopened: ['in_progress'],
    escalated: ['in_progress', 'waiting_tenant', 'resolved'],
    // legacy
    assigned_staff: ['in_progress'],
  },
  tenant: {
    open: ['cancelled'],
    waiting_tenant: ['completed', 'closed', 'in_progress', 'reopened'],
    resolved: ['completed', 'closed', 'in_progress', 'reopened'],
    completed: ['reopened'],
    reopened: [],
    escalated: ['completed', 'in_progress', 'reopened'],
    // legacy
    approved: ['closed', 'completed'],
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

  const navigate = useNavigate();

  // modal state
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>('assigned');
  const [notes, setNotes] = useState('');
  const [deptModal, setDeptModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [attributionModal, setAttributionModal] = useState(false);
  const [attributionUsers, setAttributionUsers] = useState<User[]>([]);
  const [overrideAssignTo, setOverrideAssignTo] = useState('');
  const [overrideAssignedBy, setOverrideAssignedBy] = useState('');
  const [priorityModal, setPriorityModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [mergeModal, setMergeModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [attachModal, setAttachModal] = useState(false);
  const [announceModal, setAnnounceModal] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptManagers, setDeptManagers] = useState<DepartmentManager[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [mergeIds, setMergeIds] = useState('');
  const [noteText, setNoteText] = useState('');
  const [selectedNoteDepts, setSelectedNoteDepts] = useState<string[]>([]);
  const [attachFiles, setAttachFiles] = useState<FileList | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchTicket(id);
      setTicket(res.data.data);
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
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    const socket = io(API_BASE, { withCredentials: true, auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => { if (id) socket.emit('join-ticket', id); });
    socket.on('ticket:updated', () => { loadTicket(); loadReplies(); loadTimeline(); });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (deptModal || noteModal) fetchActiveDepartments().then((r) => setDepartments(r.data.data));
    if (staffModal || mergeModal || attributionModal) {
      fetchUsers({ role: 'staff', limit: 200, departmentId: ticket?.departmentId || undefined }).then((r) => {
        const list = (r.data.data || []).filter((u) => !ticket?.departmentId || u.departments?.some((d) => d.id === ticket?.departmentId));
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

  if (accessDenied) {
    return (
      <div className={styles.page}>
        <div className={`${styles.toast} ${styles.error}`}>You do not have permission to view this ticket. Redirecting...</div>
      </div>
    );
  }
  if (loading || !ticket) return <div className={styles.page}>Loading...</div>;

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
          <h3>📋 Details</h3>
          <div className={styles.detailsSection}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Status</span>
              <span className={styles.detailValue}>
                <span className={`${styles.badge} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Priority</span>
              <span className={styles.detailValue}>{ticket.priority}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Category</span>
              <span className={styles.detailValue}>{ticket.category}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Department</span>
              <span className={styles.detailValue}>{ticket.departmentName || '—'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Assigned To</span>
              <span className={styles.detailValue}>{ticket.assignedToName || '—'}</span>
            </div>
            {role === 'admin' && (() => {
              const staffAssignments = (ticket.assignments || []).filter((a) => a.role === 'staff') || [];
              const latestStaff = staffAssignments.length ? staffAssignments[staffAssignments.length - 1] : null;
              const latestHistory = (ticket.statusHistory || []).slice().reverse()[0];
              return (
                <>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Assigned By</span>
                    <span className={styles.detailValue}>{latestStaff?.assignedByName || '—'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Changed By</span>
                    <span className={styles.detailValue}>{latestHistory?.changedByName || '—'}</span>
                  </div>
                </>
              );
            })()}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Tenant</span>
              <span className={styles.detailValue}>{ticket.tenantName || '—'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Created</span>
              <span className={styles.detailValue}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Updated</span>
              <span className={styles.detailValue}>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}</span>
            </div>
            {ticket.responseDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>First Response SLA</span>
                <span className={`${styles.detailValue} ${ticket.responseSlaBreached ? styles.slaOverdue : styles.slaOk}`}>
                  {new Date(ticket.responseDueDate).toLocaleString()} {ticket.responseSlaBreached ? '⚠️ (Breached)' : '✓ (Target)'}
                </span>
              </div>
            )}
            {ticket.dueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Resolution SLA Due</span>
                <span className={`${styles.detailValue} ${ticket.isOverdue ? styles.slaOverdue : ticket.remainingMs != null && ticket.remainingMs < 3.6e6 ? styles.slaImminent : styles.slaOk}`}>
                  {new Date(ticket.dueDate).toLocaleString()} ({formatRemaining(ticket.remainingMs)})
                </span>
              </div>
            )}
            {ticket.escalationDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Escalation SLA Due</span>
                <span className={`${styles.detailValue} ${ticket.escalationSlaBreached ? styles.slaOverdue : styles.slaOk}`}>
                  {new Date(ticket.escalationDueDate).toLocaleString()} {ticket.escalationSlaBreached ? '⚠️ (Breached)' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {(role === 'admin' || role === 'manager' || role === 'staff') && (
          <div className={styles.card}>
            <h3>⚡ Actions</h3>
            <div className={styles.actionsSection}>
              <div className={styles.btnRow}>
                {transitions.length > 0 && (
                  <button className={styles.btnPrimary} onClick={() => { setNewStatus(transitions[0]); setStatusModal(true); }}>Update Status</button>
                )}
                {role === 'admin' && (ticket.routingType ?? 'general') !== 'direct' && (
                  <button
                    className={styles.btnInfo}
                    onClick={() => setDeptModal(true)}
                    title="Assign Department"
                  >
                    Assign Dept
                  </button>
                )}
                {(role === 'admin' || role === 'manager') && ticket.departmentId && (
                  <button
                    className={styles.btnInfo}
                    onClick={() => setStaffModal(true)}
                    title="Assign Staff"
                  >
                    Assign Staff
                  </button>
                )}
                {role === 'admin' && (
                  <button
                    className={styles.btnPurple}
                    onClick={() => {
                      setOverrideAssignTo(ticket.assignedTo || '');
                      setOverrideAssignedBy(user?.id || '');
                      setAttributionModal(true);
                    }}
                    title="Control Assignment"
                  >
                    Control Assignment
                  </button>
                )}
                {(role === 'manager' || role === 'staff') && (
                  <button className={styles.btnSuccess} onClick={() => call(() => acceptAssignment(ticket.id), 'Assignment accepted')}>Accept</button>
                )}
                {(role === 'manager' || role === 'staff') && (
                  <button className={styles.btnReject} onClick={() => call(() => rejectAssignment(ticket.id), 'Assignment rejected')}>Reject</button>
                )}
                {(role === 'admin' || role === 'manager') && (
                  <button className={styles.btnAmber} onClick={() => setPriorityModal(true)}>Change Priority</button>
                )}
                {role === 'admin' && (
                  <button className={styles.btnRose} onClick={() => setCategoryModal(true)}>Change Category</button>
                )}
                {(role === 'admin' || role === 'manager' || role === 'staff') && (transitions.includes('resolved') || transitions.includes('waiting_tenant')) && (
                  <button className={styles.btnEmerald} onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Ticket resolved and routed to tenant for confirmation')}>Resolve</button>
                )}
                {(role === 'admin' || role === 'manager') && (
                  <button className={styles.btnOrange} onClick={() => call(() => escalateTicket(ticket.id, notes || undefined), 'Escalated')}>Escalate</button>
                )}
                {role === 'admin' && (
                  <button className={styles.btnIndigo} onClick={() => setMergeModal(true)}>Merge</button>
                )}
                {transitions.includes('closed') && (
                  <button className={styles.btnDark} onClick={() => call(() => closeTicket(ticket.id, notes || undefined), 'Closed')}>Close</button>
                )}
                {transitions.includes('reopened') && (
                  <button className={styles.btnAmber} onClick={() => call(() => reopenTicket(ticket.id, notes || undefined), 'Reopened')}>Reopen</button>
                )}
                <button className={styles.btnSlate} onClick={() => setNoteModal(true)}>Internal Note</button>
                <button className={styles.btnInfo} onClick={() => setAttachModal(true)}>Upload File</button>
                {(role === 'admin' || role === 'manager') && (
                  <button
                    className={styles.btnAnnounce}
                    onClick={() => setAnnounceModal(true)}
                    title="Send a visible update to the tenant"
                  >
                    📢 Announce
                  </button>
                )}
              </div>
              {ticket.isOverdue && (
                <div className={styles.slaInlineWarning}>
                  ⚠️ <strong>SLA Overdue:</strong> This ticket has passed its resolution deadline. Assignments and routing actions are restricted until the SLA is resolved or the ticket is escalated.
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Waiting for Tenant Banner (for staff/admin/manager) */}
        {(role === 'admin' || role === 'manager' || role === 'staff') && ticket.status === 'waiting_tenant' && (
          <div className={`${styles.card} ${styles.slaWarningCard}`}>
            <h3>
              <span>⏳</span> Waiting for Tenant Confirmation
            </h3>
            <p>
              The ticket has been resolved and is now <strong>awaiting confirmation from the tenant</strong>.
              Once the tenant confirms the issue is fixed, the ticket will be automatically marked as <strong>Completed</strong>.
            </p>
          </div>
        )}

        {role === 'tenant' && (ticket.status === 'waiting_tenant' || ticket.status === 'resolved' || (ticket.tenantConfirmationStatus === 'pending' && ticket.status !== 'closed' && ticket.status !== 'completed')) && (
          <div className={`${styles.card} ${styles.slaInfoCard}`}>
            <h3>
              <span>✅</span> Resolution Confirmation
            </h3>
            <p>
              Our support team has resolved this ticket. Please confirm whether the solution resolved your issue so we can mark it completed.
            </p>
            <div className={styles.btnRow}>
              <button
                className={styles.btnApprove}
                onClick={() => call(() => approveResolution(ticket.id, notes || 'Tenant confirmed issue resolved'), 'Resolution approved! Ticket marked as completed.')}
              >
                ✅ Yes, Issue Fixed (Mark Completed)
              </button>
              <button
                className={styles.btnReject}
                onClick={() => call(() => rejectResolution(ticket.id, notes || 'Issue not resolved - Tenant requested rework'), 'Ticket reopened and returned to In Progress')}
              >
                ❌ No, Issue Not Fixed (Reopen)
              </button>
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
                  <Link to={`/admin/knowledge/${a.id}`} className={styles.kbLink}>
                    <strong>{a.title}</strong>
                    <span>{a.articleReference} · {a.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h3>📝 Description</h3>
        <p className={styles.description}>{ticket.description}</p>
      </div>

      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className={styles.card}>
          <h3>📎 Attachments ({ticket.attachments.length})</h3>
          <ul className={styles.attachments}>
            {ticket.attachments.map((file) => (
              <li key={file.id}>
                <a href={`${API_BASE}${file.filePath}`} target="_blank" rel="noreferrer">{file.fileName}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.card}>
        <h3>💬 Comments & Replies {role !== 'tenant' ? <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>(🔒 Internal notes are hidden from tenants)</span> : ''}</h3>
        {replies.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No replies yet.</p>}
        <ul className={styles.replies}>
          {replies.map((reply) => {
            const v = reply.visibility;
            const isPrivate = v === 'internal' || v === 'department' || !!reply.isInternal;
            const label =
              v === 'tenant' ? '👤 Tenant Only'
                : v === 'department' ? '🏢 Department'
                  : v === 'both' ? '👤🏢 Tenant & Dept'
                    : v === 'internal' ? '🔒 Internal'
                      : '📢 Public';
            return (
              <li key={reply.id} className={isPrivate ? styles.internal : styles.replyItem}>
                <div className={styles.replyHeader}>
                  <strong className={styles.replyAuthor}>{reply.userName || 'System'}</strong>
                  <span className={isPrivate ? styles.badgeInternal : styles.badgePublic}>{label}</span>
                  <span className={styles.time}>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                </div>
                <p className={styles.replyMessage}>{reply.message}</p>
              </li>
            );
          })}
        </ul>
        <ReplyForm ticketId={ticket.id} ticket={ticket} />
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
                {paginatedTimeline.map((ev) => (
                  <li key={ev.id}>
                    <div className={styles.timelineEvent}>
                      <strong>{ev.actorName || 'System'}</strong>
                      <span className={`${styles.timelineKind} ${styles[`kind-${ev.kind}` as keyof typeof styles]}`}>
                        {ev.kind}
                      </span>
                      {ev.kind === 'status' && (
                        <div className={styles.timelineMessage}>
                          {ev.fromStatus ? STATUS_LABELS[ev.fromStatus as TicketStatus] || ev.fromStatus : 'Created'} → {STATUS_LABELS[ev.toStatus as TicketStatus] || ev.toStatus}
                        </div>
                      )}
                      {ev.kind === 'comment' && (
                        <div className={styles.timelineMessage}>
                          {(ev.visibility === 'tenant' ? '[Tenant] ' : '') + (ev.visibility === 'department' ? '[Department] ' : '') + (ev.visibility === 'both' ? '[Tenant+Dept] ' : '') + (ev.visibility === 'internal' ? '[Internal] ' : '') + (ev.message || '')}
                        </div>
                      )}
                      {ev.kind === 'attachment' && (
                        <div className={styles.timelineMessage}>uploaded {ev.message}</div>
                      )}
                      {ev.kind === 'assignment' && (
                        <div className={styles.timelineMessage}>{ev.role} assignment {ev.status}</div>
                      )}
                      <span className={styles.timelineTime}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                      {ev.notes && <div className={styles.timelineNotes}>📌 {ev.notes}</div>}
                    </div>
                  </li>
                ))}
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

      <Modal open={deptModal} title="Assign Department & Manager" onClose={() => { setDeptModal(false); setSelectedManager(''); }}>
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
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            disabled={!selectedDept}
            onClick={() =>
              call(
                () =>
                  assignDepartment(ticket.id, {
                    departmentId: selectedDept,
                    managerId: selectedManager || undefined,
                    notes,
                  }),
                'Department assigned'
              )
            }
          >
            Assign
          </button>
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
        <div className={styles.modalForm}>
          <label>Source Ticket IDs (comma separated)</label>
          <textarea rows={3} value={mergeIds} onChange={(e) => setMergeIds(e.target.value)} placeholder="id1, id2" />
          <button disabled={!mergeIds.trim()} onClick={() => call(() => mergeTickets(ticket.id, mergeIds.split(',').map((s) => s.trim()).filter(Boolean), notes), 'Tickets merged')}>Merge</button>
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

      <Modal open={attachModal} title="Upload Attachment" onClose={() => setAttachModal(false)}>
        <div className={styles.modalForm}>
          <label>File (max 5, 10MB each)</label>
          <input type="file" multiple onChange={(e) => setAttachFiles(e.target.files)} />
          <button disabled={!attachFiles || attachFiles.length === 0} onClick={async () => {
            if (!attachFiles) return;
            const fd = new FormData();
            Array.from(attachFiles).forEach((f) => fd.append('attachments', f));
            await call(() => uploadTicketAttachments(ticket.id, fd), 'Uploaded');
            setAttachFiles(null);
          }}>Upload</button>
        </div>
      </Modal>

      <Modal open={announceModal} title="📢 Announce Update to Tenant" onClose={() => setAnnounceModal(false)}>
        <div className={styles.modalForm}>
          <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 12, fontSize: '0.85rem', color: '#1e40af' }}>
            ℹ️ This message will be <strong>visible to the tenant</strong> and will trigger a notification to them.
          </div>
          <label>Announcement Message</label>
          <textarea
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. We have received your request and it is currently being reviewed by our team. Expected resolution by tomorrow."
          />
          <button
            disabled={!noteText.trim()}
            onClick={() => call(
              () => addTicketReply(ticket.id, { message: noteText, visibility: 'all' }),
              '✅ Announcement sent to tenant'
            ).then(() => { setNoteText(''); setAnnounceModal(false); })}
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            📢 Send Announcement
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ReplyForm({ ticketId, ticket }: { ticketId: string; ticket?: Ticket }) {
  const { user } = useAuth();
  const canTarget = user?.role !== 'tenant';
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'tenant' | 'department' | 'both'>('tenant');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (canTarget) {
      fetchActiveDepartments()
        .then((res) => setDepartments(res.data.data || []))
        .catch(() => setDepartments([]));
    }
  }, [canTarget]);

  useEffect(() => {
    if (ticket?.departmentId) setDepartmentId(ticket.departmentId);
  }, [ticket?.departmentId]);

  const needsDept = visibility === 'department' || visibility === 'both';

  const submit = async () => {
    if (!text.trim()) return;
    if (needsDept && !departmentId) {
      setMsg('Please select a department');
      return;
    }
    try {
      await addTicketReply(ticketId, {
        message: text,
        visibility,
        departmentIds: needsDept ? departmentId : null,
      });
      setText(''); setMsg('Reply added');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className={styles.replyForm}>
      {canTarget && (
        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            Visibility:
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'tenant' | 'department' | 'both')}
              style={{ marginLeft: 8, fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              <option value="tenant">👤 Tenant Only — visible to the tenant</option>
              <option value="department">🏢 Department Only — select a department (hidden from tenant)</option>
              <option value="both">👤🏢 Tenant &amp; Department — both can see</option>
            </select>
          </label>
          {needsDept && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
              Department:
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ marginLeft: 8, fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
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
        placeholder={
          needsDept && !departmentId
            ? 'Select a department to continue…'
            : visibility === 'department'
              ? 'Reply visible only to the selected department…'
              : visibility === 'both'
                ? 'Reply visible to tenant and the selected department…'
                : 'Reply visible only to the tenant…'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={submit} disabled={!text.trim() || (needsDept && !departmentId)}>Submit Reply</button>
      {msg && <span style={{ color: '#166534' }}>{msg}</span>}
    </div>
  );
}
