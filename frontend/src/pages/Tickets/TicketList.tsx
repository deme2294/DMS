import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
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
import {
  EyeIcon,
  BuildingOffice2Icon,
  UserPlusIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { exportTableToExcel } from '../../utils/excelExportUtils';
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
  { key: 'total', label: 'Total', cls: 'statTotal' },
  { key: 'open', label: 'Open', cls: 'statOpen' },
  { key: 'assigned', label: 'Assigned', cls: 'statAssigned' },
  { key: 'pending', label: 'Pending', cls: 'statPending' },
  { key: 'inProgress', label: 'In Progress', cls: 'statInProgress' },
  { key: 'resolved', label: 'Resolved', cls: 'statResolved' },
  { key: 'closed', label: 'Closed', cls: 'statClosed' },
  { key: 'reopened', label: 'Reopened', cls: 'statReopened' },
  { key: 'escalated', label: 'Escalated', cls: 'statEscalated' },
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
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [contactSubject, setContactSubject] = useState('');
  const [stats, setStats] = useState<TicketStatistics | null>(null);
  const [activeFilter, setActiveFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const handleExportTickets = async () => {
    if (!tickets.length) return;
    setExporting(true);
    try {
      await exportTableToExcel<Ticket>({
        title: 'HELP DESK MANAGEMENT SYSTEM — TICKETS LEDGER',
        subtitle: `Generated on: ${new Date().toLocaleString()} | Total Tickets in View: ${tickets.length}`,
        filename: `HDMS_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Tickets',
        columns: [
          { header: 'Reference #', key: 'referenceNumber', formatter: (val) => val ? `#${val}` : '—' },
          { header: 'Track #', key: 'trackNumber', formatter: (val) => val || '—' },
          { header: 'Title', key: 'title' },
          { header: 'Tenant', key: 'tenantName', formatter: (val, row) => val || (row as Ticket)?.createdByName || '—' },
          {
            header: 'Tenant Contact',
            key: 'tenantContact',
            formatter: (_val, row) => {
              const r = row as Ticket;
              const email = r?.tenantEmail || r?.createdByEmail;
              const phone = r?.tenantPhone || r?.createdByPhone;
              const parts = [email, phone].filter(Boolean);
              return parts.length > 0 ? parts.join(' | ') : '—';
            },
          },
          { header: 'Status', key: 'status', formatter: (val) => STATUS_LABELS[val as TicketStatus] || val },
          { header: 'Priority', key: 'priority', formatter: (val) => val ? String(val).toUpperCase() : 'NORMAL' },
          { header: 'Category', key: 'category', formatter: (val) => val || '—' },
          { header: 'Department', key: 'departmentName', formatter: (val) => val || 'Unassigned' },
          { header: 'Assigned Staff', key: 'assignedToName', formatter: (val) => val || 'Unassigned' },
          { header: 'Created Date', key: 'createdAt', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        ],
        data: tickets,
      });
    } catch (err) {
      console.error('[TicketList] Export tickets error:', err);
    } finally {
      setExporting(false);
    }
  };

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
    // Connect through Vite proxy instead of directly to localhost:5000
    const socket = io(window.location.origin, { path: '/socket.io', withCredentials: true, auth: { token } });
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
    if (!user) return;
    fetchActiveDepartments().then((res) => setDepartments(res.data.data)).catch(() => {});
    fetchCategories().then((res) => setCategories(res.data.data.map((c: any) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [user]);

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
      resolved: 'resolved', closed: 'closed', reopened: 'reopened',
      escalated: 'escalated', overdue: '', total: '',
    };
    const target = map[key as string] ?? '';
    const next = status === target ? '' : target;
    setStatus(next);
    setActiveFilter(activeFilter === (key as string) ? '' : (key as string));
    resetPage();
  };

  const hasActiveFilters = Boolean(search || status || priority || category || departmentId || activeFilter);
  const resetAllFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategory('');
    setDepartmentId('');
    setActiveFilter('');
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
        <div className={styles.filterBannerToast} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              type="button"
              className={`${styles.statCard} ${c.cls ? styles[c.cls] : ''} ${activeFilter === c.key ? styles.active : ''}`}
              onClick={() => setStatFilter(c.key)}
              title={`Filter by ${c.label}`}
            >
              <div className={styles.statValue}>{stats[c.key] ?? 0}</div>
              <div className={styles.statLabel}>{c.label}</div>
            </button>
          ))}
        </div>
      )}

      <div className={styles.filtersCard}>
        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon} aria-hidden="true">🔍</span>
            <input
              className={styles.searchInput}
              placeholder="Search reference, track #, title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
            {search && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => { setSearch(''); resetPage(); }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setActiveFilter(''); resetPage(); }}>
            <option value="">All Statuses</option>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          <select value={priority} onChange={(e) => { setPriority(e.target.value); resetPage(); }}>
            <option value="">All Priorities</option>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>

          {user?.role !== 'tenant' && (
            <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); resetPage(); }}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          <button
            type="button"
            className={styles.resetFiltersBtn}
            onClick={handleExportTickets}
            disabled={exporting || !tickets.length}
            title="Export tickets table to professional Excel spreadsheet (.xlsx)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📊 {exporting ? 'Exporting...' : 'Export (Excel)'}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={resetAllFilters}
              title="Reset all search and filters"
            >
              ↺ Reset Filters
            </button>
          )}
        </div>
      </div>

      <DataTable<Ticket>
        loading={loading}
        data={tickets}
        columns={[
          {
            key: 'reference',
            label: 'Reference',
            render: (row) => {
              const shortId = row.ticketNum ? String(row.ticketNum) : (row.referenceNumber || row.id);
              return (
                <Link to={`${base}/${shortId}`} className={styles.ticketRefLink} title={`View ticket #${row.ticketNum || row.referenceNumber}`}>
                  #{row.ticketNum ?? row.referenceNumber}
                </Link>
              );
            },
          },
          {
            key: 'title',
            label: 'Title',
            render: (row) => (
              <div className={styles.ticketTitleCell}>
                <span className={styles.ticketTitleText}>{row.title}</span>
                {row.trackNumber && <span className={styles.ticketTrackNo}>TRK: {row.trackNumber}</span>}
              </div>
            ),
          },
          {
            key: 'tenantName',
            label: 'Tenant Name',
            render: (row: Ticket) => (
              <div className={styles.tenantCell}>
                <span className={styles.tenantOrg}>{row.tenantName || row.createdByName || '—'}</span>
                {row.tenantContactPerson && (
                  <span className={styles.tenantSubContact} title="Primary Contact">
                    <UserIcon className={styles.contactIconSmall} />
                    <span>{row.tenantContactPerson}</span>
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'tenantContact',
            label: 'Tenant Contact',
            render: (row: Ticket) => {
              const email = row.tenantEmail || row.createdByEmail;
              const phone = row.tenantPhone || row.createdByPhone;
              if (!email && !phone) return <span className={styles.textMuted}>—</span>;
              return (
                <div className={styles.tenantContactCell}>
                  {email && (
                    <button
                      type="button"
                      className={styles.tenantEmailLink}
                      title={`Send direct email to ${email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setContactSubject(`Regarding Ticket #${row.referenceNumber}: ${row.title}`);
                        setContactTarget({
                          email,
                          name: row.tenantName || row.createdByName || row.tenantContactPerson || 'Ticket Submitter',
                          roleOrType: 'Ticket Submitter',
                        });
                      }}
                    >
                      <EnvelopeIcon className={styles.contactIconSmall} />
                      <span className={styles.emailText}>{email}</span>
                    </button>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className={styles.tenantPhoneLink}
                      title={`Call ${phone}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PhoneIcon className={styles.contactIconSmall} />
                      <span>{phone}</span>
                    </a>
                  )}
                </div>
              );
            },
          },
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
            label: 'SLA Status',
            render: (row) => {
              const remainingHours = row.remainingMs != null ? Math.round(row.remainingMs / 3600000) : null;
              return (
                <div className={styles.slaCell}>
                  {row.isOverdue && <span className={`${styles.slaPill} ${styles.slaPillOverdue}`}>🔴 Overdue</span>}
                  {row.responseSlaBreached && <span className={`${styles.slaPill} ${styles.slaPillBreached}`}>⚠️ Resp. Breached</span>}
                  {row.escalationSlaBreached && <span className={`${styles.slaPill} ${styles.slaPillBreached}`}>⚠️ Esc. Breached</span>}
                  {!row.isOverdue && !row.responseSlaBreached && !row.escalationSlaBreached && row.dueDate && (
                    <span className={`${styles.slaPill} ${styles.slaPillOnTrack}`}>
                      🟢 Due: {new Date(row.dueDate).toLocaleDateString()} {remainingHours !== null ? `(${remainingHours}h)` : ''}
                    </span>
                  )}
                  {!row.dueDate && <span className={styles.slaNone}>No SLA</span>}
                </div>
              );
            },
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
                <Link to={`${base}/${row.ticketNum ? String(row.ticketNum) : (row.referenceNumber || row.id)}`} className={styles.actionBtnView} title="View Details">
                  <EyeIcon className={styles.actionIcon} />
                  <span>View</span>
                </Link>
                {user?.role === 'admin' && (row.routingType ?? 'general') !== 'direct' && (
                  <button
                    type="button"
                    className={styles.actionBtnDept}
                    onClick={() => { setAssignTicket(row); setDeptModal(true); }}
                    title="Assign to Department"
                  >
                    <BuildingOffice2Icon className={styles.actionIcon} />
                    <span>Dept</span>
                  </button>
                )}
                {user?.role === 'manager' && row.departmentId && (
                  <button
                    type="button"
                    className={styles.actionBtnStaff}
                    onClick={() => { setAssignTicket(row); setStaffModal(true); }}
                    title="Assign to Staff Member"
                  >
                    <UserPlusIcon className={styles.actionIcon} />
                    <span>Staff</span>
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    className={styles.actionBtnDelete}
                    onClick={() => handleDelete(row)}
                    title="Delete Ticket"
                  >
                    <TrashIcon className={styles.actionIcon} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <div className={styles.pagination}>
        <span className={styles.pageNumberIndicator}>
          Showing Page {page} of {totalPages || 1}
        </span>
        <div className={styles.paginationButtons}>
          <button
            type="button"
            className={styles.paginationBtn}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Previous
          </button>
          <button
            type="button"
            className={styles.paginationBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      <Modal
        open={deptModal}
        title="Assign Department"
        onClose={() => setDeptModal(false)}
        maxWidth="500px"
        footer={
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={() => setDeptModal(false)}
            >
              <XMarkIcon className={styles.inlineIcon} />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className={styles.modalSubmitBtn}
              onClick={handleAssignDepartment}
              disabled={!selectedDept}
            >
              <BuildingOffice2Icon className={styles.inlineIcon} />
              <span>Assign Department</span>
            </button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              <BuildingOffice2Icon className={styles.inlineIcon} />
              <span>Department <span style={{ color: '#ef4444' }}>*</span></span>
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={styles.modalSelect}
            >
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              <DocumentTextIcon className={styles.inlineIcon} />
              <span>Notes (optional)</span>
            </label>
            <textarea
              rows={3}
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Add optional assignment notes or handover instructions..."
              className={styles.modalTextarea}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={staffModal}
        title="Assign Staff"
        onClose={() => setStaffModal(false)}
        maxWidth="500px"
        footer={
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={() => setStaffModal(false)}
            >
              <XMarkIcon className={styles.inlineIcon} />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className={styles.modalSubmitBtn}
              onClick={handleAssignStaff}
              disabled={!selectedStaff}
            >
              <UserPlusIcon className={styles.inlineIcon} />
              <span>Assign Staff</span>
            </button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              <UserPlusIcon className={styles.inlineIcon} />
              <span>Staff Member <span style={{ color: '#ef4444' }}>*</span></span>
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className={styles.modalSelect}
            >
              <option value="">Select Staff</option>
              {staffUsers.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              <DocumentTextIcon className={styles.inlineIcon} />
              <span>Notes (optional)</span>
            </label>
            <textarea
              rows={3}
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Add optional assignment notes or handover instructions..."
              className={styles.modalTextarea}
            />
          </div>
        </div>
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


