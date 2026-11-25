import PageHeader from '../../components/PageHeader/PageHeader';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import ContactModal, { ContactTarget } from '../../components/ContactModal/ContactModal';
import DuplicateDetectionModal from '../../components/DuplicateTickets/DuplicateDetectionModal';
import { canNotifyTenant } from '../../utils/permissionUtils';
import {
  fetchTickets, deleteTicket, assignDepartment, assignStaff,
} from '../../api/ticketApi';
import { fetchTicketStats, type TicketStatistics } from '../../api/dashboardApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { fetchUsers } from '../../api/userApi';
import { fetchCategories } from '../../api/categoryApi';
import { toShortTicketId } from '../../utils/idUtils';
import type { Ticket, TicketStatus } from '../../types/ticket';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES, getStatusLabel, getStatusClassName } from '../../types/ticket';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAlert } from '../../context/AlertContext';
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
  ExclamationTriangleIcon,
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
  const { showSuccess, showError } = useAlert();
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
  const [error, setError] = useState('');
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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const { socket } = useSocket();

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
          { header: 'Status', key: 'status', formatter: (val) => getStatusLabel(val) },
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
    if (!socket || !user) return;
    const handleTicketUpdated = () => {
      loadTickets();
    };
    socket.on('ticket:updated', handleTicketUpdated);
    return () => {
      socket.off('ticket:updated', handleTicketUpdated);
    };
  }, [socket, user, loadTickets]);

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
    try {
      await deleteTicket(ticket.id);
      const msg = `Ticket ${ticket.referenceNumber} deleted successfully`;
      setMessage(msg);
      showSuccess(msg, 'Ticket Deleted');
      loadTickets();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to delete ticket';
      setError(errMsg);
      showError(errMsg, 'Delete Failed');
    }
  };

  const handleAssignDepartment = async () => {
    if (!assignTicket || !selectedDept) return;
    try {
      await assignDepartment(assignTicket.id, { departmentId: selectedDept, notes: assignNotes });
      const deptObj = departments.find((d) => d.id === selectedDept);
      const deptName = deptObj?.name || 'Department';
      setDeptModal(false); setAssignTicket(null); setSelectedDept(''); setAssignNotes('');
      const msg = `Ticket ${assignTicket.referenceNumber || ''} assigned to ${deptName}`;
      setMessage(msg);
      showSuccess(msg, 'Department Assigned');
      loadTickets();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to assign department';
      setError(errMsg);
      showError(errMsg, 'Assignment Failed');
    }
  };

  const handleAssignStaff = async () => {
    if (!assignTicket || !selectedStaff) return;
    if (selectedStaff === assignTicket.assignedTo) {
      const warnMsg = 'This staff member is already assigned to this ticket. Duplicate assignment is restricted.';
      setError(warnMsg);
      showError(warnMsg, 'Assignment Notice');
      return;
    }
    const staffObj = staffUsers.find((s) => s.id === selectedStaff);
    const staffName = staffObj ? `${staffObj.firstName} ${staffObj.lastName}` : 'Staff';
    try {
      await assignStaff(assignTicket.id, { staffId: selectedStaff, notes: assignNotes });
      setStaffModal(false);
      setAssignTicket(null);
      setSelectedStaff('');
      setAssignNotes('');
      const msg = `Ticket ${assignTicket.referenceNumber || (assignTicket as any).reference_number || ''} was successfully assigned to ${staffName}.`;
      setMessage(msg);
      showSuccess(msg, 'Staff Assigned');
      loadTickets();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to assign staff';
      setError(errMsg);
      showError(errMsg, 'Assignment Failed');
    }
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
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

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

          <div className={styles.filterActionsGroup}>
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

            {(user?.role === 'admin' || user?.role === 'ceo' || user?.role === 'manager') && (
              <button
                type="button"
                className={styles.resetFiltersBtn}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: '1px solid #b45309',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => setShowDuplicateModal(true)}
                title="Detect and review duplicate tickets across the system"
              >
                <span>⚡ Duplicate Detection</span>
              </button>
            )}

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
      </div>

      <DataTable<Ticket>
        loading={loading}
        data={tickets}
        columns={[
          {
            key: 'reference',
            label: 'Reference',
            render: (row) => {
              const targetRef = toShortTicketId(row);
              return (
                <Link to={`${base}/${targetRef}`} className={styles.ticketRefLink} title={`View ticket ${row.referenceNumber || targetRef}`}>
                  {row.referenceNumber || (row.ticketNum ? `#${row.ticketNum}` : `#${targetRef}`)}
                </Link>
              );
            },
          },
          {
            key: 'title',
            label: 'Title',
            minWidth: '200px',
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
              const isAllowed = canNotifyTenant(user, row);
              return (
                <div className={styles.tenantContactCell}>
                  {email && (
                    isAllowed ? (
                      <button
                        type="button"
                        className={styles.tenantEmailLink}
                        title={`Send official notification to ${email}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setContactSubject(`Regarding Ticket #${row.referenceNumber}: ${row.title}`);
                          setContactTarget({
                            email,
                            name: row.tenantName || row.createdByName || row.tenantContactPerson || 'Ticket Submitter',
                            roleOrType: 'Ticket Submitter',
                            ticketId: row.id,
                          });
                        }}
                      >
                        <EnvelopeIcon className={styles.contactIconSmall} />
                        <span className={styles.emailText}>{email}</span>
                      </button>
                    ) : (
                      <span
                        className={styles.tenantEmailReadOnly}
                        title="Official email notifications to tenants are restricted to Administrators and the assigned Department Manager"
                      >
                        <EnvelopeIcon className={styles.contactIconSmall} />
                        <span className={styles.emailText}>{email}</span>
                      </span>
                    )
                  )}
                  {phone && (
                    isAllowed ? (
                      <a
                        href={`tel:${phone}`}
                        className={styles.tenantPhoneLink}
                        title={`Call ${phone}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PhoneIcon className={styles.contactIconSmall} />
                        <span>{phone}</span>
                      </a>
                    ) : (
                      <span
                        className={styles.tenantPhoneReadOnly}
                        title="Direct calls to tenants are restricted to Administrators and the assigned Department Manager"
                      >
                        <PhoneIcon className={styles.contactIconSmall} />
                        <span>{phone}</span>
                      </span>
                    )
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
            render: (row) => <span className={`${styles.badge} ${styles[getStatusClassName(row.status)] || styles[row.status]}`}>{getStatusLabel(row.status)}</span>,
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
                <Link to={`${base}/${toShortTicketId(row)}`} className={styles.actionBtnView} title="View Details">
                  <EyeIcon className={styles.actionIcon} />
                  <span>View</span>
                </Link>
                {user?.role === 'admin' && (row.routingType ?? 'general') !== 'direct' && (
                  <button
                    type="button"
                    className={styles.actionBtnDept}
                    onClick={() => {
                      if (row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant') {
                        setError('Cannot assign department: Ticket is waiting for tenant response/confirmation.');
                        return;
                      }
                      const prevDept = (row.previousDepartments && row.previousDepartments.length > 0 && row.previousDepartments[0].departmentId) || row.departmentId || '';
                      setSelectedDept(prevDept);
                      setAssignTicket(row);
                      setDeptModal(true);
                    }}
                    disabled={row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant'}
                    title={row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant' ? 'Cannot assign department: Ticket is waiting for tenant response/confirmation' : 'Assign to Department'}
                  >
                    <BuildingOffice2Icon className={styles.actionIcon} />
                    <span>Dept</span>
                  </button>
                )}
                {user?.role === 'manager' && row.departmentId && (
                  <button
                    type="button"
                    className={styles.actionBtnStaff}
                    onClick={() => {
                      if (row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant') {
                        setError('Cannot assign staff: Ticket is waiting for tenant response/confirmation.');
                        return;
                      }
                      const prevStaff = (row.previousStaff && row.previousStaff.length > 0 && (row.previousStaff[0].staffId || row.previousStaff[0].userId)) || row.assignedTo || '';
                      setSelectedStaff(prevStaff);
                      setAssignTicket(row);
                      setStaffModal(true);
                    }}
                    disabled={row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant'}
                    title={row.status === 'waiting_tenant' || (row as any).status === 'escalated.waiting_tenant' ? 'Cannot assign staff: Ticket is waiting for tenant response/confirmation' : 'Assign to Staff Member'}
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
              required
            >
              {!selectedDept && <option value="">Select Department</option>}
              {departments.map((d) => {
                const isCurrent = assignTicket?.departmentId === d.id;
                const isPrev = assignTicket?.previousDepartments?.some((pd) => pd.departmentId === d.id);
                let label = d.name;
                if (isCurrent) label += ' (Currently Assigned)';
                else if (isPrev) label += ' (Assigned Before)';
                return <option key={d.id} value={d.id}>{label}</option>;
              })}
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
        title={assignTicket?.assignedTo ? "Reassign Staff" : "Assign Staff"}
        onClose={() => { setStaffModal(false); setAssignTicket(null); setSelectedStaff(''); setAssignNotes(''); }}
        maxWidth="500px"
        footer={
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={() => { setStaffModal(false); setAssignTicket(null); setSelectedStaff(''); setAssignNotes(''); }}
            >
              <XMarkIcon className={styles.inlineIcon} />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className={styles.modalSubmitBtn}
              onClick={handleAssignStaff}
              disabled={!selectedStaff || selectedStaff === assignTicket?.assignedTo}
            >
              <UserPlusIcon className={styles.inlineIcon} />
              <span>{assignTicket?.assignedTo ? 'Reassign Staff' : 'Assign Staff'}</span>
            </button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          {assignTicket?.assignedTo && (
            <div className={styles.assignmentCurrentBox}>
              <UserIcon className={styles.assignmentCurrentIcon} />
              <span className={styles.assignmentCurrentLabel}>Currently Assigned:</span>
              <strong className={styles.assignmentCurrentValue}>{assignTicket.assignedToName || 'Assigned Staff'}</strong>
            </div>
          )}
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
              {staffUsers.map((s) => {
                const isCur = s.id === assignTicket?.assignedTo;
                return (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} {isCur ? '— (Currently Assigned)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedStaff && selectedStaff === assignTicket?.assignedTo && (
            <div className={styles.duplicateAssignWarning}>
              <div className={styles.duplicateAssignHeader}>
                <ExclamationTriangleIcon className={styles.duplicateAssignIcon} />
                <span>Duplicate Assignment Restricted</span>
              </div>
              <p style={{ margin: '4px 0' }}>
                <strong>{assignTicket.assignedToName || 'This staff member'}</strong> is already assigned to this ticket. Duplicate continuous assignment is restricted.
              </p>
            </div>
          )}
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

      <DuplicateDetectionModal
        open={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        departmentId={user?.role === 'manager' ? (user.departments?.[0]?.id || undefined) : undefined}
        onMergedSuccess={() => {
          loadTickets();
        }}
      />
    </div>
  );
}


