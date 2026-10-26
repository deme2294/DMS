import { useCallback, useEffect, useState } from 'react';
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ClockIcon,
  GlobeAltIcon,
  FolderIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../../components/PageHeader/PageHeader';
import Modal from '../../components/Modal/Modal';
import { fetchSLAPolicies, createSLAPolicy, updateSLAPolicy, deleteSLAPolicy, type SLAPolicy } from '../../api/slaApi';
import { fetchCategories, type TicketCategory } from '../../api/categoryApi';
import { useAuth } from '../../context/AuthContext';
import styles from './SLAPolicies.module.css';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

interface SLAFormState {
  name: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | '';
  categoryId: string;
  responseHours: number | string;
  resolutionHours: number | string;
  escalationHours: number | string;
  description: string;
}

const empty: SLAFormState = {
  name: '',
  priority: '',
  categoryId: '',
  responseHours: '',
  resolutionHours: '',
  escalationHours: '',
  description: '',
};

export default function SLAPolicies() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<SLAPolicy | null>(null);
  const [editing, setEditing] = useState<SLAPolicy | null>(null);
  const [form, setForm] = useState<SLAFormState>(empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { includeInactive: ['admin', 'ceo'].includes(user?.role || '') };
      if (categoryFilter) params.categoryId = categoryFilter;
      const pRes = await fetchSLAPolicies(params);
      setPolicies(pRes.data.data);
    } catch {
      // keep previous policies on error
    } finally {
      setLoading(false);
    }
    try {
      const cRes = await fetchCategories({ includeInactive: true });
      setCategories(cRes.data.data);
    } catch {
      // categories are optional for the SLA table
    }
  }, [user, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: SLAPolicy) => {
    setEditing(p);
    setForm({
      name: p.name,
      priority: p.priority,
      categoryId: p.categoryId || '',
      responseHours: p.responseHours !== undefined && p.responseHours !== null ? p.responseHours : '',
      resolutionHours: p.resolutionHours !== undefined && p.resolutionHours !== null ? p.resolutionHours : '',
      escalationHours: p.escalationHours !== undefined && p.escalationHours !== null ? p.escalationHours : '',
      description: p.description || '',
    });
    setError('');
    setModalOpen(true);
  };

  const openView = (p: SLAPolicy) => setViewing(p);

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Policy Name is required');
      return;
    }
    if (!form.priority) {
      setError('Please select a priority');
      return;
    }
    if (form.responseHours === '' || isNaN(Number(form.responseHours)) || Number(form.responseHours) < 0) {
      setError('First Response Time must be a valid number (>= 0)');
      return;
    }
    if (form.resolutionHours === '' || isNaN(Number(form.resolutionHours)) || Number(form.resolutionHours) < 1) {
      setError('Resolution Time must be a valid number (>= 1)');
      return;
    }
    if (form.escalationHours !== '' && (isNaN(Number(form.escalationHours)) || Number(form.escalationHours) < 0)) {
      setError('Escalation Time must be a valid number (>= 0)');
      return;
    }

    const resp = Number(form.responseHours);
    const res = Number(form.resolutionHours);
    const esc = form.escalationHours !== '' && form.escalationHours !== null ? Number(form.escalationHours) : null;

    if (res <= resp) {
      setError(`Resolution Time (${res}h) must be strictly greater than First Response Time (${resp}h).`);
      return;
    }

    if (esc !== null && esc > 0) {
      if (esc <= resp) {
        setError(`Escalation Time (${esc}h) must be greater than First Response Time (${resp}h).`);
        return;
      }
      if (esc > res) {
        setError(`Escalation Time (${esc}h) must be less than or equal to Resolution Time (${res}h).`);
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      priority: form.priority,
      categoryId: form.categoryId ? form.categoryId : null,
      responseHours: Number(form.responseHours),
      resolutionHours: Number(form.resolutionHours),
      escalationHours: form.escalationHours !== '' && form.escalationHours !== null ? Number(form.escalationHours) : null,
      description: form.description.trim() || null,
    };

    try {
      if (editing) await updateSLAPolicy(editing.id, payload);
      else await createSLAPolicy(payload);
      setMessage(editing ? 'SLA policy updated successfully' : 'SLA policy created successfully');
      setModalOpen(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (p: SLAPolicy) => {
    if (!window.confirm(`Delete SLA policy "${p.name}"? This action cannot be undone.`)) return;
    await deleteSLAPolicy(p.id);
    setMessage('SLA policy deleted');
    load();
  };

  const handleToggleStatus = async (p: SLAPolicy) => {
    const next = !p.isActive;
    // Optimistic update for instant feedback
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: next } : x)));
    try {
      await updateSLAPolicy(p.id, { isActive: next });
      setMessage(`SLA policy ${next ? 'activated' : 'deactivated'} successfully`);
      load();
    } catch (e: any) {
      // Rollback on failure
      setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x)));
      setMessage(e?.response?.data?.message || 'Failed to update status');
    }
  };

  const getCategoryName = (catId: string | null | undefined) => {
    if (!catId) return 'Global (All Categories)';
    const cat = categories.find((c) => c.id === catId);
    return cat?.name || 'Unknown';
  };

  const filteredPolicies = policies.filter((p) => {
    if (priorityFilter && p.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        getCategoryName(p.categoryId).toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, priorityFilter, pageSize]);

  const totalItems = filteredPolicies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPolicies = filteredPolicies.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  const stats = {
    total: policies.length,
    active: policies.filter((p) => p.isActive).length,
    inactive: policies.filter((p) => !p.isActive).length,
    global: policies.filter((p) => !p.categoryId).length,
    categorySpecific: policies.filter((p) => !!p.categoryId).length,
  };

  return (
    <div className={styles.section}>
      <PageHeader
        title="SLA Policies"
        description="Define SLA targets per category and priority. Tickets auto-compute their due dates based on these policies."
        backTo="/admin/dashboard"
        actionLabel="+ New Policy"
        onAction={openCreate}
      />

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Total Policies</span>
            <ShieldCheckIcon className={styles.statIcon} style={{ color: '#6366f1' }} />
          </div>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Active</span>
            <CheckCircleIcon className={styles.statIcon} style={{ color: '#16a34a' }} />
          </div>
          <span className={styles.statValue} style={{ color: '#16a34a' }}>{stats.active}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Inactive</span>
            <XCircleIcon className={styles.statIcon} style={{ color: '#dc2626' }} />
          </div>
          <span className={styles.statValue} style={{ color: '#dc2626' }}>{stats.inactive}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Global</span>
            <GlobeAltIcon className={styles.statIcon} style={{ color: '#0ea5e9' }} />
          </div>
          <span className={styles.statValue}>{stats.global}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Category-Specific</span>
            <FolderIcon className={styles.statIcon} style={{ color: '#f59e0b' }} />
          </div>
          <span className={styles.statValue}>{stats.categorySpecific}</span>
        </div>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <MagnifyingGlassIcon className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Response</th>
                  <th>Resolution</th>
                  <th>Escalation</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPolicies.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className={styles.policyName}>{p.name}</div>
                    </td>
                    <td>
                      <span className={`${styles.categoryBadge} ${!p.categoryId ? styles.globalBadge : ''}`}>
                        {getCategoryName(p.categoryId)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`priority${p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}`]}`}>
                        {p.priority}
                      </span>
                    </td>
                    <td>
                      <span className={styles.timeCell}>
                        <ClockIcon className={styles.inlineIcon} />
                        {p.responseHours !== undefined && p.responseHours !== null ? `${p.responseHours}h` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.timeCell}>
                        <ClockIcon className={styles.inlineIcon} />
                        {p.resolutionHours !== undefined && p.resolutionHours !== null ? `${p.resolutionHours}h` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.timeCell}>
                        {p.escalationHours !== undefined && p.escalationHours !== null && p.escalationHours > 0 ? (
                          <>
                            <ClockIcon className={styles.inlineIcon} />
                            {`${p.escalationHours}h`}
                          </>
                        ) : '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${p.isActive ? styles.toggleOn : styles.toggleOff}`}
                        onClick={() => handleToggleStatus(p)}
                        title={p.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {p.isActive ? (
                          <CheckCircleIcon className={styles.toggleIcon} />
                        ) : (
                          <XCircleIcon className={styles.toggleIcon} />
                        )}
                        <span className={styles.toggleLabel}>{p.isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description || ''}>
                      {p.description || '—'}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => openView(p)}
                          title="View SLA Policy details"
                        >
                          <EyeIcon className={styles.btnIcon} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className={styles.editBtn}
                          onClick={() => openEdit(p)}
                          title="Edit SLA Policy"
                        >
                          <PencilSquareIcon className={styles.btnIcon} />
                          <span>Edit</span>
                        </button>
                        {['admin', 'ceo'].includes(user?.role || '') && (
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(p)}
                            title="Delete SLA Policy"
                          >
                            <TrashIcon className={styles.btnIcon} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPolicies.length === 0 && (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📋</div>
                      <div className={styles.emptyTitle}>No SLA policies found</div>
                      <div className={styles.emptySub}>Create a new policy using the button above to get started with automated SLA tracking</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredPolicies.length > 0 && (
            <div className={styles.paginationBar}>
              <div className={styles.paginationLeft}>
                <span className={styles.paginationInfo}>
                  Showing <span className={styles.paginationHighlight}>{totalItems === 0 ? 0 : startIndex + 1}</span> to{' '}
                  <span className={styles.paginationHighlight}>{endIndex}</span> of{' '}
                  <span className={styles.paginationHighlight}>{totalItems}</span> policies
                </span>

                <div className={styles.pageSizeWrapper}>
                  <label htmlFor="pageSizeSelect" className={styles.pageSizeLabel}>Rows per page:</label>
                  <select
                    id="pageSizeSelect"
                    className={styles.pageSizeSelect}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.pageNavBtn}
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Previous page"
                >
                  <ChevronLeftIcon className={styles.pageNavIcon} />
                  <span>Previous</span>
                </button>

                <div className={styles.pageNumbers}>
                  {getPageNumbers().map((num, idx) => (
                    typeof num === 'number' ? (
                      <button
                        key={idx}
                        type="button"
                        className={`${styles.pageNumberBtn} ${num === safePage ? styles.pageNumberActive : ''}`}
                        onClick={() => setPage(num)}
                        title={`Page ${num}`}
                      >
                        {num}
                      </button>
                    ) : (
                      <span key={idx} className={styles.pageEllipsis}>…</span>
                    )
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.pageNavBtn}
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Next page"
                >
                  <span>Next</span>
                  <ChevronRightIcon className={styles.pageNavIcon} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit SLA Policy' : 'Create New SLA Policy'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
              <XMarkIcon className={styles.btnIcon} />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSave}
              disabled={!form.name.trim() || !form.priority || form.responseHours === '' || form.resolutionHours === ''}
            >
              {editing ? (
                <>
                  <CheckIcon className={styles.btnIcon} />
                  <span>Update Policy</span>
                </>
              ) : (
                <>
                  <PlusIcon className={styles.btnIcon} />
                  <span>Create Policy</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className={styles.formGrid}>
          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Policy Name <span className={styles.required}>*</span></label>
            <input
              className={styles.formInput}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., High Priority SLA"
              autoFocus
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category</label>
              <select
                className={styles.formSelect}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Global (All Categories)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Priority <span className={styles.required}>*</span></label>
              <select
                className={styles.formSelect}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              >
                <option value="">-- Select Priority --</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>First Response Time (hours) <span className={styles.required}>*</span></label>
              <input
                type="number"
                className={styles.formInput}
                min="0"
                placeholder="e.g. 4"
                value={form.responseHours}
                onChange={(e) => setForm({ ...form, responseHours: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Resolution Time (hours) <span className={styles.required}>*</span></label>
              <input
                type="number"
                className={styles.formInput}
                min="1"
                placeholder="e.g. 24"
                value={form.resolutionHours}
                onChange={(e) => setForm({ ...form, resolutionHours: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Escalation Time (hours)</label>
              <input
                type="number"
                className={styles.formInput}
                min="0"
                placeholder="Optional (e.g. 12)"
                value={form.escalationHours}
                onChange={(e) => setForm({ ...form, escalationHours: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className={styles.slaRuleBanner}>
            <InformationCircleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>
              <strong>SLA Constraint Rule:</strong> First Response Time &lt; Escalation Time ≤ Resolution Time
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={styles.formTextarea}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this SLA policy (optional)"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!viewing}
        title="SLA Policy Details"
        onClose={() => setViewing(null)}
        maxWidth="620px"
        footer={
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={() => setViewing(null)}>
              <XMarkIcon className={styles.btnIcon} />
              <span>Close</span>
            </button>
            {['admin', 'ceo'].includes(user?.role || '') && (
              <button
                type="button"
                className={styles.modalEditBtn}
                onClick={() => {
                  const toEdit = viewing;
                  setViewing(null);
                  if (toEdit) openEdit(toEdit);
                }}
              >
                <PencilSquareIcon className={styles.btnIcon} />
                <span>Edit Policy</span>
              </button>
            )}
          </div>
        }
      >
        {viewing && (
          <div className={styles.detailContainer}>
            {/* Header Hero Card */}
            <div className={styles.detailHero}>
              <div className={styles.detailHeroIcon}>
                <ShieldCheckIcon className={styles.detailHeroIconSvg} />
              </div>
              <div className={styles.detailHeroContent}>
                <div className={styles.detailHeroTop}>
                  <h3 className={styles.detailPolicyName}>{viewing.name}</h3>
                  <div className={styles.detailStatusWrapper}>
                    <span className={`${styles.toggleBtn} ${viewing.isActive ? styles.toggleOn : styles.toggleOff}`}>
                      {viewing.isActive ? (
                        <CheckCircleIcon className={styles.toggleIcon} />
                      ) : (
                        <XCircleIcon className={styles.toggleIcon} />
                      )}
                      <span className={styles.toggleLabel}>{viewing.isActive ? 'Active' : 'Inactive'}</span>
                    </span>
                  </div>
                </div>
                <div className={styles.detailHeroMeta}>
                  <span className={styles.detailMetaPill}>
                    {viewing.categoryId ? (
                      <>
                        <FolderIcon className={styles.metaIcon} />
                        <span>{getCategoryName(viewing.categoryId)}</span>
                      </>
                    ) : (
                      <>
                        <GlobeAltIcon className={styles.metaIcon} />
                        <span>Global (All Categories)</span>
                      </>
                    )}
                  </span>
                  <span className={`${styles.badge} ${styles[`priority${viewing.priority.charAt(0).toUpperCase() + viewing.priority.slice(1)}`]}`}>
                    {viewing.priority} priority
                  </span>
                </div>
              </div>
            </div>

            {/* Target SLA Metrics Grid */}
            <div className={styles.detailMetricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={`${styles.metricIconWrap} ${styles.metricBlue}`}>
                    <ClockIcon className={styles.metricIcon} />
                  </div>
                  <span className={styles.metricLabel}>First Response</span>
                </div>
                <div className={styles.metricValue}>
                  {viewing.responseHours !== undefined && viewing.responseHours !== null ? (
                    <>
                      <span className={styles.metricNumber}>{viewing.responseHours}</span>
                      <span className={styles.metricUnit}>hrs</span>
                    </>
                  ) : (
                    <span className={styles.metricEmpty}>—</span>
                  )}
                </div>
                <span className={styles.metricHint}>Target reply time</span>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={`${styles.metricIconWrap} ${styles.metricEmerald}`}>
                    <CheckCircleIcon className={styles.metricIcon} />
                  </div>
                  <span className={styles.metricLabel}>Resolution</span>
                </div>
                <div className={styles.metricValue}>
                  {viewing.resolutionHours !== undefined && viewing.resolutionHours !== null ? (
                    <>
                      <span className={styles.metricNumber}>{viewing.resolutionHours}</span>
                      <span className={styles.metricUnit}>hrs</span>
                    </>
                  ) : (
                    <span className={styles.metricEmpty}>—</span>
                  )}
                </div>
                <span className={styles.metricHint}>Target resolution time</span>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={`${styles.metricIconWrap} ${styles.metricAmber}`}>
                    <ArrowTrendingUpIcon className={styles.metricIcon} />
                  </div>
                  <span className={styles.metricLabel}>Escalation</span>
                </div>
                <div className={styles.metricValue}>
                  {viewing.escalationHours !== undefined && viewing.escalationHours !== null && viewing.escalationHours > 0 ? (
                    <>
                      <span className={styles.metricNumber}>{viewing.escalationHours}</span>
                      <span className={styles.metricUnit}>hrs</span>
                    </>
                  ) : (
                    <span className={styles.metricEmpty}>None</span>
                  )}
                </div>
                <span className={styles.metricHint}>Auto-escalation point</span>
              </div>
            </div>

            {/* Description Section */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>
                <InformationCircleIcon className={styles.sectionIcon} />
                <span>Description</span>
              </div>
              <div className={styles.detailDescBox}>
                {viewing.description ? (
                  <p className={styles.detailDescText}>{viewing.description}</p>
                ) : (
                  <p className={styles.detailDescEmpty}>No description provided for this policy.</p>
                )}
              </div>
            </div>

            {/* Audit / Timeline metadata */}
            {(viewing.createdAt || viewing.updatedAt) && (
              <div className={styles.detailAuditBar}>
                {viewing.createdAt && (
                  <div className={styles.auditItem}>
                    <CalendarIcon className={styles.auditIcon} />
                    <span>Created: <strong>{new Date(viewing.createdAt).toLocaleString()}</strong></span>
                  </div>
                )}
                {viewing.updatedAt && (
                  <div className={styles.auditItem}>
                    <ClockIcon className={styles.auditIcon} />
                    <span>Last Updated: <strong>{new Date(viewing.updatedAt).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
