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
    in_progress: ['under_review', 'pending_approval', 'waiting_tenant', 'resolved', 'completed', 'pending', 'waiting_vendor', 'escalated', 'rejected', 'cancelled'],
    pending: ['in_progress', 'escalated', 'rejected'],
    under_review: ['pending_approval', 'waiting_tenant', 'resolved', 'in_progress', 'rejected', 'assigned'],
    pending_approval: ['waiting_tenant', 'resolved', 'in_progress', 'rejected'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'closed', 'escalated'],
    waiting_vendor: ['in_progress', 'escalated'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress', 'rejected', 'escalated', 'cancelled'],
    completed: ['reopened', 'closed', 'resolved'],
    reopened: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    closed: ['reopened'],
    accepted: ['in_progress', 'escalated', 'rejected', 'cancelled'],
    approved: ['closed', 'completed', 'reopened'],
    rejected: ['reopened', 'open'],
    cancelled: ['open', 'reopened'],
    escalated: ['in_progress', 'assigned', 'waiting_tenant', 'resolved', 'completed', 'open'],
    submitted: ['under_review', 'assigned', 'rejected'],
    assigned_department: ['assigned_staff', 'rejected'],
    assigned_staff: ['in_progress', 'rejected'],
  },
  manager: {
    assigned: ['in_progress', 'rejected'],
    in_progress: ['under_review', 'pending_approval', 'pending', 'waiting_vendor', 'escalated'],
    pending: ['in_progress', 'escalated'],
    under_review: ['pending_approval', 'in_progress', 'rejected'],
    pending_approval: ['in_progress'],
    waiting_tenant: ['in_progress', 'resolved', 'completed', 'escalated'],
    waiting_vendor: ['in_progress'],
    resolved: ['waiting_tenant', 'completed', 'closed', 'in_progress'],
    completed: ['reopened', 'closed'],
    reopened: ['in_progress', 'escalated'],
    accepted: ['in_progress', 'escalated'],
    escalated: ['in_progress', 'resolved', 'waiting_tenant', 'completed'],
    assigned_department: ['assigned_staff'],
    assigned_staff: ['in_progress'],
  },
  staff: {
    assigned: ['in_progress'],
    in_progress: ['under_review', 'pending', 'waiting_vendor'],
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
    waiting_tenant: ['completed', 'in_progress', 'closed', 'reopened'],
    resolved: ['completed', 'in_progress', 'closed', 'reopened'],
    completed: ['reopened'],
    reopened: [],
    escalated: ['completed', 'in_progress', 'reopened'],
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
  const [tenantRating, setTenantRating] = useState<number>(5);
  const [tenantFeedback, setTenantFeedback] = useState<string>('');
  const [hoverRating, setHoverRating] = useState<number>(0);
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
              {role === 'admin' && (
                <div className={ticket.departmentId ? styles.deptInfoBanner : styles.deptWarnBanner}>
                  {ticket.departmentId ? (
                    <>
                      <span>🏢</span>
                      <span>
                        Assigned to <strong>{ticket.departmentName}</strong>. Department manager is responsible for delegating staff.
                      </span>
                    </>
                  ) : (
                    <>
                      <span>📌</span>
                      <span>
                        Assign this ticket to a department. The department manager will assign and oversee staff.
                      </span>
                    </>
                  )}
                </div>
              )}
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
                {role === 'manager' && ticket.departmentId && (
                  <button
                    className={styles.btnInfo}
                    onClick={() => setStaffModal(true)}
                    title="Assign Staff to Department Member"
                  >
                    Assign Staff
                  </button>
                )}
                {(role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open') && (
                  <button className={styles.btnSuccess} onClick={() => call(() => acceptAssignment(ticket.id), 'Assignment accepted')}>Accept</button>
                )}
                {(role === 'manager' || role === 'staff') && (ticket.status === 'assigned' || ticket.status === 'open') && (
                  <button className={styles.btnReject} onClick={() => call(() => rejectAssignment(ticket.id), 'Assignment rejected')}>Reject</button>
                )}
                {(role === 'admin' || role === 'manager') && (
                  <button className={styles.btnAmber} onClick={() => setPriorityModal(true)}>Change Priority</button>
                )}
                {role === 'admin' && (
                  <button className={styles.btnRose} onClick={() => setCategoryModal(true)}>Change Category</button>
                )}

                {/* Staff: on in_progress, clicking Resolve submits to Department Manager approval */}
                {role === 'staff' && ticket.status === 'in_progress' && (
                  <button
                    className={styles.btnEmerald}
                    onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution submitted for Department Manager approval!')}
                    title="Submit work for Department Manager approval"
                  >
                    Resolve
                  </button>
                )}

                {/* Manager: on under_review -> Approve Resolution & Request Rework; on in_progress -> Resolve */}
                {role === 'manager' && ticket.status === 'under_review' && (
                  <>
                    <button
                      className={styles.btnEmerald}
                      onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution approved! Forwarded to Admin for verification.')}
                      title="Approve staff resolution and forward to Admin"
                    >
                      Approve Resolution
                    </button>
                    <button
                      className={styles.btnReject}
                      onClick={() => call(() => rejectResolution(ticket.id, notes || 'Department Manager requested rework'), 'Rework requested. Ticket returned to In Progress.')}
                      title="Request staff rework"
                    >
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
                    Resolve
                  </button>
                )}

                {/* Admin: on pending_approval -> Verify & Resolve or Return for Revision; on under_review/in_progress -> Resolve */}
                {role === 'admin' && ticket.status === 'pending_approval' && (
                  <>
                    <button
                      className={styles.btnEmerald}
                      onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Resolution verified! Ticket marked Resolved and routed to tenant for confirmation.')}
                      title="Verify resolution and route to tenant for final confirmation"
                    >
                      Verify & Resolve
                    </button>
                    <button
                      className={styles.btnReject}
                      onClick={() => call(() => rejectResolution(ticket.id, notes || 'Admin returned for revision'), 'Returned for revision. Ticket sent back to In Progress.')}
                      title="Return for revision"
                    >
                      Return for Revision
                    </button>
                  </>
                )}
                {role === 'admin' && (ticket.status === 'in_progress' || ticket.status === 'under_review') && (
                  <button
                    className={styles.btnEmerald}
                    onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Ticket resolved and routed to tenant for confirmation')}
                    title="Resolve ticket and route to tenant for confirmation"
                  >
                    Resolve
                  </button>
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

        {/* Under Review Banner (Staff submitted -> Pending Dept Manager Approval) */}
        {ticket.status === 'under_review' && (
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
        {ticket.status === 'pending_approval' && (
          <div className={`${styles.card} ${styles.slaWarningCard}`} style={{ borderLeft: '4px solid #3b82f6' }}>
            <h3>
              <span>🛡️</span> {role === 'admin' ? 'Resolution Awaiting Admin Verification' : 'Pending Administrative Verification'}
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
        {(role === 'admin' || role === 'manager' || role === 'staff') && ticket.status === 'waiting_tenant' && (
          <div className={`${styles.card} ${styles.slaWarningCard}`}>
            <h3>
              <span>⏳</span> Waiting for Tenant Confirmation
            </h3>
            <p>
              The ticket has been resolved by our team and verified by Admin. Waiting for the tenant to inspect the resolution, rate satisfaction, and confirm if the issue is solved.
            </p>
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

        {/* Completed Status Card */}
        {ticket.status === 'completed' && (
          <div className={`${styles.card} ${styles.completedCard}`}>
            <h3><span>🎉</span> Ticket Completed</h3>
            <p>
              The tenant has verified and confirmed this ticket is solved. The request is officially completed.
            </p>
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
            const isAdmin = v === 'admin';
            const isPrivate = v === 'internal' || v === 'department' || !!reply.isInternal;
            const label =
              v === 'admin' ? '🛡️ Admin Only'
                : v === 'tenant' ? '👤 Tenant Only'
                  : v === 'department' ? '🏢 Department'
                    : v === 'both' ? '👤🏢 Tenant & Dept'
                      : v === 'internal' ? '🔒 Internal'
                        : '📢 Public';
            const badgeClass = isAdmin
              ? styles.badgeAdmin
              : isPrivate ? styles.badgeInternal : styles.badgePublic;
            return (
              <li key={reply.id} className={isAdmin || isPrivate ? styles.internal : styles.replyItem}>
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
  const isStaff = user?.role === 'staff';
  const isManager = user?.role === 'manager';
  const canTarget = user?.role !== 'tenant';

  // Staff: always department-only. Others: default to tenant.
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'tenant' | 'department' | 'both' | 'admin'>(
    isStaff ? 'department' : 'tenant'
  );
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [msg, setMsg] = useState('');

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

  const submit = async () => {
    if (!text.trim()) return;
    // For staff, departmentId is the ticket department — always required
    const effectiveDeptId = isStaff ? (ticket?.departmentId || '') : (needsDept ? departmentId : null);
    if (isStaff && !effectiveDeptId) {
      setMsg('No department assigned to this ticket yet.');
      return;
    }
    if (!isStaff && needsDept && !departmentId) {
      setMsg('Please select a department');
      return;
    }
    try {
      await addTicketReply(ticketId, {
        message: text,
        visibility: isStaff ? 'department' : visibility,
        departmentIds: isStaff ? effectiveDeptId : (needsDept ? departmentId : null),
      });
      setText(''); setMsg('Reply sent');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className={styles.replyForm}>
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
              onChange={(e) => setVisibility(e.target.value as 'tenant' | 'department' | 'both' | 'admin')}
              className={styles.replyFormSelect}
            >
              <option value="tenant">👤 Tenant Only — visible to the tenant</option>
              <option value="department">🏢 Department Only — hidden from tenant</option>
              <option value="both">👤🏢 Tenant & Department — both can see</option>
              {isManager && (
                <option value="admin">🛡️ Admin Only — private escalation note to Admin</option>
              )}
            </select>
          </label>

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
        placeholder={
          isStaff
            ? 'Write a message to your Department Manager…'
            : isAdminOnly
              ? 'Write a private note to Admin — only admins can see this…'
              : needsDept && !departmentId
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
      <button
        onClick={submit}
        disabled={!text.trim() || (!isStaff && needsDept && !departmentId)}
      >
        Submit Reply
      </button>
      {msg && <span className={styles.replySuccessMsg}>{msg}</span>}
    </div>
  );
}

