import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import Modal from '../../components/Modal/Modal';
import { fetchSLAPolicies, createSLAPolicy, updateSLAPolicy, deleteSLAPolicy, type SLAPolicy } from '../../api/slaApi';
import { fetchCategories, type TicketCategory } from '../../api/categoryApi';
import { useAuth } from '../../context/AuthContext';
import styles from './SLAPolicies.module.css';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

const empty = { name: '', priority: 'medium', categoryId: '', responseHours: 1, resolutionHours: 24, escalationHours: 0, description: '' };

export default function SLAPolicies() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<SLAPolicy | null>(null);
  const [editing, setEditing] = useState<SLAPolicy | null>(null);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { includeInactive: user?.role === 'admin' };
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

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = (p: SLAPolicy) => {
    setEditing(p);
    setForm({
      name: p.name, priority: p.priority, categoryId: p.categoryId || '',
      responseHours: p.responseHours, resolutionHours: p.resolutionHours,
      escalationHours: p.escalationHours || 0, description: p.description || '',
    });
    setError(''); setModalOpen(true);
  };
  const openView = (p: SLAPolicy) => setViewing(p);

  const handleSave = async () => {
    setError('');
    try {
      if (editing) await updateSLAPolicy(editing.id, form);
      else await createSLAPolicy(form);
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
          <span className={styles.statLabel}>Total Policies</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active</span>
          <span className={styles.statValue} style={{ color: '#16a34a' }}>{stats.active}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Inactive</span>
          <span className={styles.statValue} style={{ color: '#dc2626' }}>{stats.inactive}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Global</span>
          <span className={styles.statValue}>{stats.global}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Category-Specific</span>
          <span className={styles.statValue}>{stats.categorySpecific}</span>
        </div>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
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
                {filteredPolicies.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
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
                    <td>{p.responseHours}h</td>
                    <td>{p.resolutionHours}h</td>
                    <td>{p.escalationHours || 0}h</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${p.isActive ? styles.toggleOn : styles.toggleOff}`}
                        onClick={() => handleToggleStatus(p)}
                        title={p.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={styles.toggleDot} />
                        <span className={styles.toggleLabel}>{p.isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description || ''}>
                      {p.description || '—'}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.viewBtn} onClick={() => openView(p)}>View</button>
                        <button className={styles.editBtn} onClick={() => openEdit(p)}>Edit</button>
                        {user?.role === 'admin' && (
                          <button className={styles.deleteBtn} onClick={() => handleDelete(p)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPolicies.length === 0 && (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📋</div>
                      <div>No SLA policies found</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>Create a new policy to get started</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit SLA Policy' : 'Create New SLA Policy'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button className={styles.submitBtn} onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? 'Update Policy' : 'Create Policy'}
            </button>
          </>
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
              <label className={styles.formLabel}>Priority</label>
              <select
                className={styles.formSelect}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>First Response Time (hours)</label>
              <input
                type="number"
                className={styles.formInput}
                min="0"
                value={form.responseHours}
                onChange={(e) => setForm({ ...form, responseHours: Number(e.target.value) })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Resolution Time (hours)</label>
              <input
                type="number"
                className={styles.formInput}
                min="1"
                value={form.resolutionHours}
                onChange={(e) => setForm({ ...form, resolutionHours: Number(e.target.value) })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Escalation Time (hours)</label>
              <input
                type="number"
                className={styles.formInput}
                min="0"
                value={form.escalationHours}
                onChange={(e) => setForm({ ...form, escalationHours: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={styles.formTextarea}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this SLA policy"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!viewing}
        title="SLA Policy Details"
        onClose={() => setViewing(null)}
        footer={
          <button className={styles.cancelBtn} onClick={() => setViewing(null)}>Close</button>
        }
      >
        {viewing && (
          <div className={styles.viewGrid}>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Policy Name</span>
              <span className={styles.viewValue}>{viewing.name}</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Category</span>
              <span className={styles.viewValue}>{getCategoryName(viewing.categoryId)}</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Priority</span>
              <span className={styles.viewValue}>
                <span className={`${styles.badge} ${styles[`priority${viewing.priority.charAt(0).toUpperCase() + viewing.priority.slice(1)}`]}`}>
                  {viewing.priority}
                </span>
              </span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>First Response Time</span>
              <span className={styles.viewValue}>{viewing.responseHours}h</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Resolution Time</span>
              <span className={styles.viewValue}>{viewing.resolutionHours}h</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Escalation Time</span>
              <span className={styles.viewValue}>{viewing.escalationHours || 0}h</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Status</span>
              <span className={styles.viewValue}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewing.isActive ? styles.toggleOn : styles.toggleOff}`}
                  title={viewing.isActive ? 'Active' : 'Inactive'}
                >
                  <span className={styles.toggleDot} />
                  <span className={styles.toggleLabel}>{viewing.isActive ? 'Active' : 'Inactive'}</span>
                </button>
              </span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Description</span>
              <span className={styles.viewValue}>{viewing.description || '—'}</span>
            </div>
            {viewing.createdAt && (
              <div className={styles.viewRow}>
                <span className={styles.viewLabel}>Created</span>
                <span className={styles.viewValue}>{new Date(viewing.createdAt).toLocaleString()}</span>
              </div>
            )}
            {viewing.updatedAt && (
              <div className={styles.viewRow}>
                <span className={styles.viewLabel}>Updated</span>
                <span className={styles.viewValue}>{new Date(viewing.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
