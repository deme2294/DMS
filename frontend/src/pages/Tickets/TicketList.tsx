import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchTickets, deleteTicket, assignDepartment, assignStaff,
} from '../../api/ticketApi';
import { fetchTicketStats, type TicketStatistics } from '../../api/dashboardApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import { fetchCategories } from '../../api/categoryApi';
import type { Ticket, TicketStatus } from '../../types/ticket';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES } from '../../types/ticket';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import styles from './Tickets.module.css';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

type Department = { id: string; name: string };
type StaffUser = { id: string; firstName: string; lastName: string };
type Category = { id: string; name: string };

const basePaths: Record<string, string> = {
  admin: '/admin/tickets',
  manager: '/manager/tickets',
  staff: '/staff/tickets',
  tenant: '/tenant/tickets',
};

const dashboardPaths: Record<string, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  staff: '/staff/dashboard',
  tenant: '/tenant/dashboard',
};

const STAT_CARDS: { key: keyof TicketStatistics; label: string; cls?: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pending', label: 'Pending' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
  { key: 'completed', label: 'Completed' },
  { key: 'reopened', label: 'Reopened' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'overdue', label: 'Overdue', cls: 'statOverdue' },
];

export default function TicketList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantIdFilter = searchParams.get('tenantId') || '';
  const base = user ? basePaths[user.role] : '/tenant/tickets';
  const { page, limit, setPage, resetPage } = usePagination();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [message, setMessage] = useState('');
  const [deptModal, setDeptModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignTicket, setAssignTicket] = useState<Ticket | null>(null);
  const [stats, setStats] = useState<TicketStatistics | null>(null);
  const [activeFilter, setActiveFilter] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTickets({ search, status, priority, category, departmentId, assignedTo, tenantId: tenantIdFilter || undefined, page, limit });
      setTickets(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, category, departmentId, assignedTo, tenantIdFilter, page, limit]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (user?.role === 'admin') fetchTicketStats().then((r) => setStats(r.data.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    const socket = io(API_BASE, { withCredentials: true, auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { userId: user.id }));
    socket.on('ticket:updated', () => loadTickets());
    return () => { socket.disconnect(); };
  }, [user, loadTickets]);

  useEffect(() => {
    if (deptModal) fetchActiveDepartments().then((res) => setDepartments(res.data.data));
    if (staffModal || deptModal) fetchCategories().then((res) => setCategories(res.data.data.map((c: any) => ({ id: c.id, name: c.name }))));
  }, [deptModal, staffModal]);

  useEffect(() => {
    fetchCategories().then((res) => setCategories(res.data.data.map((c: any) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!staffModal || !assignTicket?.departmentId) return;
    fetchUsers({ role: 'staff', limit: 100, departmentId: assignTicket.departmentId }).then((res) => {
      const list = (res.data.data || []).filter((u: any) => u.departments?.some((d: any) => d.id === assignTicket.departmentId));
      setStaffUsers(list.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
    });
  }, [staffModal, assignTicket?.departmentId]);

  const handleDelete = async (ticket: Ticket) => {
    if (!window.confirm(`Delete ticket ${ticket.referenceNumber}?`)) return;
    await deleteTicket(ticket.id);
    setMessage('Ticket deleted');
    loadTickets();
  };

  const handleAssignDepartment = async () => {
    if (!assignTicket || !selectedDept) return;
    await assignDepartment(assignTicket.id, { departmentId: selectedDept, notes: assignNotes });
    setDeptModal(false); setAssignTicket(null); setSelectedDept(''); setAssignNotes('');
    setMessage('Department assigned successfully');
    loadTickets();
  };

  const handleAssignStaff = async () => {
    if (!assignTicket || !selectedStaff) return;
    await assignStaff(assignTicket.id, { staffId: selectedStaff, notes: assignNotes });
    setStaffModal(false); setAssignTicket(null); setSelectedStaff(''); setAssignNotes('');
    setMessage('Staff assigned successfully');
    loadTickets();
  };

  const setStatFilter = (key: keyof TicketStatistics) => {
    const map: Record<string, string> = {
      open: 'open', assigned: 'assigned', pending: 'pending', inProgress: 'in_progress',
      resolved: 'resolved', closed: 'closed', completed: 'completed', reopened: 'reopened',
      escalated: 'escalated', overdue: '',
    };
    const next = status === map[key as string] ? '' : (map[key as string] || '');
    setStatus(next);
    setActiveFilter(status === map[key as string] ? '' : (key as string));
    resetPage();
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={tenantIdFilter ? `Tickets for Tenant: ${tenantIdFilter}` : 'Help Desk Tickets'}
        description={tenantIdFilter ? 'Showing all tickets created by this tenant. Use filters to narrow results.' : 'View, track, and manage support requests.'}
        backTo={tenantIdFilter ? '/admin/tenants' : (user ? dashboardPaths[user.role] : '/tenant/dashboard')}
        actionLabel={user?.role === 'tenant' ? '+ New Ticket' : undefined}
        onAction={user?.role === 'tenant' ? () => navigate(`${base}/create`) : undefined}
      />

      {tenantIdFilter && (
        <div className={styles.toast} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Showing tickets filtered by tenant ID: <strong>{tenantIdFilter}</strong></span>
          <button
            onClick={() => { setSearchParams((prev) => { prev.delete('tenantId'); return prev; }); }}
            style={{ border: 'none', background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
          >
            Clear Filter
          </button>
        </div>
      )}

      {message && <div className={styles.toast}>{message}</div>}

      {user?.role === 'admin' && stats && (
        <div className={styles.statGrid}>
          {STAT_CARDS.map((c) => (
              <button
                key={String(c.key)}
                className={`${styles.statCard} ${c.cls || ''} ${activeFilter === c.key ? styles.active : ''}`}
                onClick={() => setStatFilter(c.key)}
              >
              <div className={styles.statValue}>{stats[c.key]}</div>
              <div className={styles.statLabel}>{c.label}</div>
            </button>
          ))}
        </div>
      )}

      <div className={styles.filters}>
        <input placeholder="Search reference, track number, title..." value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); resetPage(); }}>
          <option value="">All Priority</option>
          {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All Category</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {user?.role !== 'tenant' && (
        <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); resetPage(); }}>
          <option value="">All Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        )}
      </div>

      <DataTable<Ticket>
        loading={loading}
        data={tickets}
        columns={[
          {
            key: 'reference',
            label: 'Reference',
            render: (row) => (
              <Link to={`${base}/${row.id}`} className={styles.link}>{row.referenceNumber}</Link>
            ),
          },
          { key: 'title', label: 'Title' },
          { key: 'category', label: 'Category' },
          {
            key: 'priority',
            label: 'Priority',
            render: (row) => <span className={`${styles.badge} ${styles[row.priority]}`}>{row.priority}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <span className={`${styles.badge} ${styles[row.status]}`}>{STATUS_LABELS[row.status]}</span>,
          },
          { key: 'departmentName', label: 'Department', render: (row) => row.departmentName || '—' },
          {
            key: 'dueDate',
            label: 'SLA',
            render: (row) => (
              <div>
                {row.responseSlaBreached && <div className={styles.slaOverdue}>Response Breached</div>}
                {row.escalationSlaBreached && <div className={styles.slaOverdue}>Escalation Breached</div>}
                {!row.responseSlaBreached && !row.escalationSlaBreached && row.isOverdue && <div className={styles.slaOverdue}>Overdue</div>}
                {!row.responseSlaBreached && !row.escalationSlaBreached && !row.isOverdue && row.dueDate && (
                  <span className={styles.slaOnTrack}>Due: {new Date(row.dueDate).toLocaleDateString()}</span>
                )}
              </div>
            ),
          },
          {
            key: 'createdAt',
            label: 'Created',
            render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—',
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.actions}>
                <Link to={`${base}/${row.id}`}>View</Link>
                {user?.role === 'admin' && (row.routingType ?? 'general') !== 'direct' && <button onClick={() => { setAssignTicket(row); setDeptModal(true); }}>Assign Dept</button>}
                {user?.role === 'manager' && row.departmentId && <button onClick={() => { setAssignTicket(row); setStaffModal(true); }}>Assign Staff</button>}
                {user?.role === 'admin' && <button className={styles.danger} onClick={() => handleDelete(row)}>Delete</button>}
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      <Modal open={deptModal} title="Assign Department" onClose={() => setDeptModal(false)}>
        <div className={styles.modalForm}>
          <label>Department</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">Select Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Notes (optional)</label>
          <textarea rows={3} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} />
          <button onClick={handleAssignDepartment} disabled={!selectedDept}>Assign</button>
        </div>
      </Modal>

      <Modal open={staffModal} title="Assign Staff" onClose={() => setStaffModal(false)}>
        <div className={styles.modalForm}>
          <label>Staff</label>
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
            <option value="">Select Staff</option>
            {staffUsers.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
          </select>
          <label>Notes (optional)</label>
          <textarea rows={3} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} />
          <button onClick={handleAssignStaff} disabled={!selectedStaff}>Assign</button>
        </div>
      </Modal>
    </div>
  );
}
