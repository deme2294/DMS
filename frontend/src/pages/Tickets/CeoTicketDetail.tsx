import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import {
  changeTicketStatus, fetchTicket, fetchTicketReplies, addTicketReply, fetchTicketTimeline,
  assignDepartment, assignStaff, reassignStaff, acceptAssignment, rejectAssignment,
  escalateTicket, mergeTickets, closeTicket, reopenTicket, approveResolution, rejectResolution,
  markResolved, changePriority, changeCategory, addInternalNote, uploadTicketAttachments,
} from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import type { Ticket, TicketStatus, TicketReply, TimelineEvent } from '../../types/ticket';
import { STATUS_LABELS, TICKET_STATUSES, TICKET_PRIORITIES } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import styles from './CeoTickets.module.css';
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
  ceo: {
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

export default function CeoTicketDetail() {
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
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
    const socket = io(API_BASE, { withCredentials: true, auth: { token } });
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
          <h3>Details</h3>
          <p><strong>Status:</strong> <span className={`${styles.badge} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span></p>
          <p><strong>Priority:</strong> {ticket.priority}</p>
          <p><strong>Category:</strong> {ticket.category}</p>
          <p><strong>Department:</strong> {ticket.departmentName || '—'}</p>
          <p><strong>Assigned To:</strong> {ticket.assignedToName || '—'}</p>
          <p><strong>Tenant:</strong> {ticket.tenantName || '—'}</p>
          <p><strong>Created:</strong> {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</p>
          <p><strong>Updated:</strong> {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}</p>
          {ticket.dueDate && (
            <p className={styles.slaInfo + ' ' + (ticket.isOverdue ? styles.slaOverdue : ticket.remainingMs != null && ticket.remainingMs < 3.6e6 ? styles.slaImminent : styles.slaOk)}>
              <strong>SLA Due:</strong> {new Date(ticket.dueDate).toLocaleString()} ({formatRemaining(ticket.remainingMs)})
              {!ticket.isOverdue && ticket.remainingMs != null && ticket.remainingMs > 0 && ticket.remainingMs < 3.6e6 && (
                <span className={styles.slaImminent}> ⚠ Resolution deadline is approaching</span>
              )}
            </p>
          )}
          {(ticket as any).responseDueDate && (
            <p className={styles.slaInfo}>
              <strong>Response Due:</strong> {new Date((ticket as any).responseDueDate).toLocaleString()}
              {!(ticket as any).responseSlaBreached && (() => {
                const respRemaining = new Date((ticket as any).responseDueDate).getTime() - Date.now();
                return respRemaining > 0 && respRemaining < 3.6e6 ? <span className={styles.slaImminent}> ⚠ Response deadline approaching</span> : null;
              })()}
            </p>
          )}
          {(ticket as any).escalationDueDate && (
            <p className={styles.slaInfo}>
              <strong>Escalation Due:</strong> {new Date((ticket as any).escalationDueDate).toLocaleString()}
              {!(ticket as any).escalationSlaBreached && (() => {
                const escRemaining = new Date((ticket as any).escalationDueDate).getTime() - Date.now();
                return escRemaining > 0 && escRemaining < 3.6e6 ? <span className={styles.slaImminent}> ⚠ Escalation deadline approaching</span> : null;
              })()}
            </p>
          )}
          {(ticket as any).responseSlaBreached && (
            <p className={styles.slaOverdue}><strong>Response SLA Breached</strong></p>
          )}
          {(ticket as any).escalationSlaBreached && (
            <p className={styles.slaOverdue}><strong>Escalation SLA Breached</strong></p>
          )}
        </div>

      {(role === 'admin' || role === 'manager' || role === 'staff') && (
        <div className={styles.card}>
          <h3>Actions</h3>
          <div className={styles.btnRow}>
            {transitions.length > 0 && (
              <button onClick={() => { setNewStatus(transitions[0]); setStatusModal(true); }}>Update Status</button>
            )}
            {role === 'admin' && (
              <button
                className={styles.btnSecondary}
                onClick={() => setDeptModal(true)}
                disabled={ticket.isOverdue}
                title={ticket.isOverdue ? 'Cannot assign department: SLA overdue' : 'Assign Department'}
              >
                Assign Dept
              </button>
            )}
            {(role === 'admin' || role === 'manager') && ticket.departmentId && (
              <button
                className={styles.btnSecondary}
                onClick={() => setStaffModal(true)}
                disabled={ticket.isOverdue}
                title={ticket.isOverdue ? 'Cannot assign staff: SLA overdue' : 'Assign Staff'}
              >
                Assign Staff
              </button>
            )}
            {(role === 'manager' || role === 'staff') && (
              <button className={styles.btnSecondary} onClick={() => call(() => acceptAssignment(ticket.id), 'Assignment accepted')}>Accept</button>
            )}
            {(role === 'manager' || role === 'staff') && (
              <button className={styles.btnSecondary} onClick={() => call(() => rejectAssignment(ticket.id), 'Assignment rejected')}>Reject</button>
            )}
            {role === 'admin' && (
              <button className={styles.btnSecondary} onClick={() => setPriorityModal(true)}>Change Priority</button>
            )}
            {role === 'admin' && (
              <button className={styles.btnSecondary} onClick={() => setCategoryModal(true)}>Change Category</button>
            )}
            {(role === 'admin' || role === 'manager' || role === 'staff') && (transitions.includes('resolved') || transitions.includes('waiting_tenant')) && (
              <button className={styles.btnSecondary} onClick={() => call(() => markResolved(ticket.id, notes || undefined), 'Ticket resolved and routed to tenant for confirmation')}>Resolve</button>
            )}
            {role === 'admin' && (
              <button className={styles.btnSecondary} onClick={() => call(() => escalateTicket(ticket.id, notes || undefined), 'Escalated')}>Escalate</button>
            )}
            {role === 'admin' && (
              <button className={styles.btnSecondary} onClick={() => setMergeModal(true)}>Merge</button>
            )}
            {transitions.includes('closed') && (
              <button className={styles.btnSecondary} onClick={() => call(() => closeTicket(ticket.id, notes || undefined), 'Closed')}>Close</button>
            )}
            {transitions.includes('reopened') && (
              <button className={styles.btnSecondary} onClick={() => call(() => reopenTicket(ticket.id, notes || undefined), 'Reopened')}>Reopen</button>
            )}
            <button className={styles.btnSecondary} onClick={() => setNoteModal(true)}>Internal Note</button>
            <button className={styles.btnSecondary} onClick={() => setAttachModal(true)}>Upload File</button>
          </div>
          {ticket.isOverdue && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.9rem' }}>
              ⚠️ <strong>SLA Overdue:</strong> This ticket has passed its resolution deadline. Assignments and routing actions are restricted until the SLA is resolved or the ticket is escalated.
            </div>
          )}
        </div>
      )}
      </div>

      <div className={styles.card}>
        <h3>Description</h3>
        <p className={styles.description}>{ticket.description}</p>
      </div>

      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className={styles.card}>
          <h3>Attachments</h3>
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
        <h3>Comments & Replies {role !== 'tenant' ? '(Internal notes visible to staff only)' : ''}</h3>
        {replies.length === 0 && <p>No replies yet.</p>}
        <ul className={styles.replies}>
          {replies.map((reply) => (
            <li key={reply.id} className={reply.visibility === 'internal' || reply.isInternal ? styles.internal : ''}>
              <strong>{reply.userName || 'System'}</strong>
              <span className={styles.visibility}>{(reply.visibility === 'internal' || reply.isInternal) ? ' (Internal)' : ''}</span>
              <span className={styles.time}>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
              <p className={styles.replyMessage}>{reply.message}</p>
            </li>
          ))}
        </ul>
        {role !== 'ceo' && <ReplyForm ticketId={ticket.id} canInternal={role !== 'tenant'} />}
      </div>

      <div className={styles.card}>
        <div className={styles.timelineHeaderRow}>
          <h3>
            Timeline
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
            <ul className={styles.timeline}>
              {paginatedTimeline.map((ev) => (
                <li key={ev.id}>
                  <strong>{ev.actorName || 'System'}</strong>
                  {' · '}
                  <span style={{ textTransform: 'capitalize' }}>{ev.kind}</span>
                  {ev.kind === 'status' && (
                    <>: {ev.fromStatus ? STATUS_LABELS[ev.fromStatus as TicketStatus] || ev.fromStatus : 'Created'} → {STATUS_LABELS[ev.toStatus as TicketStatus] || ev.toStatus}</>
                  )}
                  {ev.kind === 'comment' && <>: {(ev.visibility === 'internal' ? '[Internal] ' : '') + (ev.message || '')}</>}
                  {ev.kind === 'attachment' && <>: uploaded {ev.message}</>}
                  {ev.kind === 'assignment' && <>: {ev.role} assignment {ev.status}</>}
                  <span> — {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                  {ev.notes && <p>{ev.notes}</p>}
                </li>
              ))}
            </ul>

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
        <div className={styles.modalForm}>
          <label>Source Ticket IDs (comma separated)</label>
          <textarea rows={3} value={mergeIds} onChange={(e) => setMergeIds(e.target.value)} placeholder="id1, id2" />
          <button disabled={!mergeIds.trim()} onClick={() => call(() => mergeTickets(ticket.id, mergeIds.split(',').map((s) => s.trim()).filter(Boolean), notes), 'Tickets merged')}>Merge</button>
        </div>
      </Modal>

      <Modal open={noteModal} title="Add Internal Note" onClose={() => setNoteModal(false)}>
        <div className={styles.modalForm}>
          <label>Note (internal only)</label>
          <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Visible to Departments (optional)</label>
            <select
              multiple
              value={selectedNoteDepts}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setSelectedNoteDepts(values);
              }}
              style={{ width: '100%', minHeight: 80, fontSize: '0.85rem', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Hold Ctrl/Cmd to select multiple. Leave empty to make visible to all internal staff.</span>
          </div>
          <button disabled={!noteText.trim()} onClick={() => call(() => addInternalNote(ticket.id, noteText, undefined, selectedNoteDepts.join(',')), 'Internal note added')}>Save</button>
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
      <textarea rows={3} placeholder="Add a reply..." value={text} onChange={(e) => setText(e.target.value)} />
      {canInternal && (
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'all' | 'internal')}>
          <option value="all">Visible to All</option>
          <option value="internal">Internal Only</option>
        </select>
      )}
      <button onClick={submit} disabled={!text.trim()}>Submit Reply</button>
      {msg && <span style={{ color: '#6ee7b7' }}>{msg}</span>}
    </div>
  );
}
