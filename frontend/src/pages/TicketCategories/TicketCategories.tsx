import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import Modal from '../../components/Modal/Modal';
import IconButton from '../../components/IconButton/IconButton';
import {
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchCategoryRequests,
    approveCategory,
    rejectCategory,
    type TicketCategory,
    type CategoryRequest,
} from '../../api/categoryApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { createSLAPolicy, fetchSLAPolicies, type SLAPolicy } from '../../api/slaApi';
import { useAuth } from '../../context/AuthContext';
import styles from './TicketCategories.module.css';

type Department = { id: string; name: string };

const emptyForm = {
    name: '',
    description: '',
    departmentId: '',
    slaPolicyId: '',
    routingType: 'general' as 'general' | 'direct',
};

const emptySlaForm = {
    name: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    responseHours: 4,
    resolutionHours: 24,
    escalationHours: 0,
    description: '',
};

export default function TicketCategories() {
    const { user } = useAuth();
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [requests, setRequests] = useState<CategoryRequest[]>([]);
    const [slaPolicies, setSlaPolicies] = useState<SLAPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TicketCategory | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const [viewingCategory, setViewingCategory] = useState<TicketCategory | null>(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);

    const [slaModalOpen, setSlaModalOpen] = useState(false);
    const [slaForm, setSlaForm] = useState(emptySlaForm);
    const [slaSaving, setSlaSaving] = useState(false);
    const [slaError, setSlaError] = useState('');
    const [slaForCategory, setSlaForCategory] = useState<TicketCategory | null>(null);
    const [catPage, setCatPage] = useState(1);
    const [catPageSize, setCatPageSize] = useState(12);
    const CAT_PAGE_OPTIONS = [12, 24, 48];

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchCategories({ status: statusFilter });
            setCategories(res.data.data);
            const slaRes = await fetchSLAPolicies({ includeInactive: true });
            setSlaPolicies(slaRes.data.data);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    const filteredCategories = useMemo(() => {
        return categories.filter((cat) => {
            if (statusFilter === 'active' && !cat.isActive) return false;
            if (statusFilter === 'inactive' && cat.isActive) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = cat.name.toLowerCase().includes(q);
                const matchDesc = (cat.description || '').toLowerCase().includes(q);
                const matchDept = (cat.departmentName || '').toLowerCase().includes(q);
                if (!matchName && !matchDesc && !matchDept) return false;
            }
            return true;
        });
    }, [categories, statusFilter, searchQuery]);

    const totalCatPages = useMemo(() => Math.max(1, Math.ceil(filteredCategories.length / catPageSize)), [filteredCategories.length, catPageSize]);
    const pagedCategories = useMemo(() => filteredCategories.slice((catPage - 1) * catPageSize, catPage * catPageSize), [filteredCategories, catPage, catPageSize]);

    useEffect(() => {
        fetchActiveDepartments()
            .then((res) => setDepartments(res.data.data))
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchCategoryRequests('pending').then((r) => setRequests(r.data.data)).catch(() => { });
        }
    }, [user, message]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (cat: TicketCategory) => {
        setEditing(cat);
        setForm({
            name: cat.name,
            description: cat.description || '',
            departmentId: cat.departmentId || '',
            slaPolicyId: cat.slaPolicyId || '',
            routingType: (cat as any).routing_type || cat.routingType || 'general',
        });
        setError('');
        setModalOpen(true);
    };

    const openView = (cat: TicketCategory) => {
        setViewingCategory(cat);
        setViewModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Name is required'); return; }
        if (form.routingType === 'direct' && !form.departmentId) {
            setError('A department is required for direct-routing categories'); return;
        }
        setSaving(true);
        setError('');
        try {
            const payload: { name: string; description?: string; departmentId?: string; slaPolicyId?: string; routingType: 'general' | 'direct' } = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                departmentId: form.departmentId || undefined,
                slaPolicyId: form.slaPolicyId || undefined,
                routingType: form.routingType,
            };
            if (editing) {
                await updateCategory(editing.id, payload);
                setMessage('Category updated successfully');
            } else {
                await createCategory(payload);
                setMessage('Category created successfully');
            }
            setModalOpen(false);
            load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to save category');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (cat: TicketCategory) => {
        const next = !cat.isActive;
        // Optimistic update for instant feedback
        setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, isActive: next } : c)));
        try {
            await updateCategory(cat.id, { isActive: next });
            setMessage(`Category ${next ? 'activated' : 'deactivated'}`);
            load();
        } catch {
            // Rollback on failure
            setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, isActive: cat.isActive } : c)));
            setMessage('Failed to update category status');
        }
    };

    const handleDelete = async (cat: TicketCategory) => {
        if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
        try {
            await deleteCategory(cat.id);
            setMessage('Category deleted');
            load();
        } catch (err: any) {
            setMessage(err?.response?.data?.message || 'Failed to delete');
        }
    };

    const handleApprove = async (cat: TicketCategory) => {
        try {
            await approveCategory(cat.id, reviewNotes || undefined);
            setMessage('Category approved');
            setReviewNotes('');
            load();
        } catch (err: any) {
            setMessage(err?.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (cat: TicketCategory) => {
        try {
            await rejectCategory(cat.id, reviewNotes || undefined);
            setMessage('Category rejected');
            setReviewNotes('');
            load();
        } catch (err: any) {
            setMessage(err?.response?.data?.message || 'Failed to reject');
        }
    };

    const openSlaModal = (cat: TicketCategory) => {
        setSlaForCategory(cat);
        setSlaForm(emptySlaForm);
        setSlaError('');
        setSlaModalOpen(true);
    };

    const handleCreateSla = async () => {
        if (!slaForm.name.trim()) { setSlaError('Policy name is required'); return; }
        setSlaSaving(true);
        setSlaError('');
        try {
            const categoryId = slaForCategory?.id;
            const duplicateName = slaPolicies.find(p => p.categoryId === categoryId && p.name.toLowerCase() === slaForm.name.trim().toLowerCase());
            if (duplicateName) {
                setSlaError(`An SLA policy named "${slaForm.name.trim()}" already exists for this category.`);
                return;
            }
            const res = await createSLAPolicy({
                name: slaForm.name.trim(),
                priority: slaForm.priority,
                categoryId: categoryId || undefined,
                responseHours: slaForm.responseHours,
                resolutionHours: slaForm.resolutionHours,
                escalationHours: slaForm.escalationHours,
                description: slaForm.description.trim() || undefined,
            });
            if (slaForCategory && !slaForCategory.slaPolicyId && res?.data?.data?.id) {
                await updateCategory(slaForCategory.id, { slaPolicyId: res.data.data.id }).catch(() => {});
            }
            setMessage('SLA policy created and linked to category');
            setSlaModalOpen(false);
            load();
        } catch (err: any) {
            setSlaError(err?.response?.data?.message || 'Failed to create SLA policy');
        } finally {
            setSlaSaving(false);
        }
    };

    const getCategorySlaPolicies = (catId: string) => slaPolicies.filter(p => p.categoryId === catId);

    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => setMessage(''), 3500);
        return () => clearTimeout(t);
    }, [message]);

    return (
        <div className={styles.page}>
            <PageHeader
                title="Ticket Categories"
                description="Manage categories that tenants can select when submitting tickets."
                backTo="/admin/dashboard"
                actionLabel="+ New Category"
                onAction={openCreate}
            />

            {message && <div className={styles.toast}>{message}</div>}

            {user?.role === 'admin' && requests.length > 0 && (
                <div className={styles.requestsPanel}>
                    <h3>Pending Category Requests ({requests.length})</h3>
                    <ul className={styles.requests}>
                        {requests.map((r) => (
                            <li key={r.id}>
                                <div>
                                    <strong>{r.name}</strong>
                                    {r.departmentName && <span className={styles.deptBadge}>{r.departmentName}</span>}
                                    <div className={styles.reqMeta}>Requested by {r.requestedByName || '—'}</div>
                                </div>
                                <div className={styles.btnRow}>
                                    <IconButton variant="approve" onClick={() => handleApprove({ id: r.categoryId } as TicketCategory)} title="Approve" />
                                    <IconButton variant="reject" onClick={() => handleReject({ id: r.categoryId } as TicketCategory)} title="Reject" />
                                </div>
                            </li>
                        ))}
                    </ul>
                    <input
                        placeholder="Review notes (optional)"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className={styles.reviewNotesInput}
                    />
                </div>
            )}

            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <div className={styles.statusTabs}>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${statusFilter === 'active' ? styles.tabActive : ''}`}
                            onClick={() => { setStatusFilter('active'); setCatPage(1); }}
                        >
                            Active
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${statusFilter === 'inactive' ? styles.tabActive : ''}`}
                            onClick={() => { setStatusFilter('inactive'); setCatPage(1); }}
                        >
                            Inactive
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${statusFilter === 'all' ? styles.tabActive : ''}`}
                            onClick={() => { setStatusFilter('all'); setCatPage(1); }}
                        >
                            All
                        </button>
                    </div>

                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            placeholder="Search categories…"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCatPage(1); }}
                            className={styles.searchInput}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className={styles.clearSearchBtn}
                                onClick={() => { setSearchQuery(''); setCatPage(1); }}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.toolbarRight}>
                    <span className={styles.count}>
                        {filteredCategories.length} {statusFilter === 'inactive' ? 'inactive ' : statusFilter === 'active' ? 'active ' : ''}
                        {filteredCategories.length === 1 ? 'category' : 'categories'}
                    </span>
                    <select
                        value={catPageSize}
                        onChange={(e) => { setCatPageSize(Number(e.target.value)); setCatPage(1); }}
                        className={styles.pageSizeSelect}
                    >
                        {CAT_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className={styles.loading}>Loading categories…</div>
            ) : filteredCategories.length === 0 ? (
                <div className={styles.empty}>
                    {searchQuery
                        ? `No categories matching "${searchQuery}".`
                        : statusFilter === 'inactive'
                        ? 'No inactive categories found. All categories are currently active.'
                        : statusFilter === 'active'
                        ? 'No active categories found.'
                        : 'No categories found. Create one to get started.'}
                </div>
            ) : (
                <div className={styles.grid}>
                    {pagedCategories.map((cat) => {
                        const catSl = getCategorySlaPolicies(cat.id);
                        const routingType = ((cat as any).routing_type || cat.routingType || 'general') as 'general' | 'direct';
                        return (
                            <div key={cat.id} className={`${styles.card} ${!cat.isActive ? styles.inactive : ''}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.catName} onClick={() => openView(cat)} style={{ cursor: 'pointer' }} title="Click to view details">{cat.name}</span>
                                    {cat.status === 'pending' && <span className={styles.statusPending}>Pending</span>}
                                    {cat.status === 'rejected' && <span className={styles.statusRejected}>Rejected</span>}
                                    {cat.status === 'approved' && !cat.isActive && <span className={styles.badge}>Inactive</span>}
                                    {routingType === 'direct' && <span className={styles.routingBadge}>Direct Routing</span>}
                                    {cat.departmentName && (
                                        <span className={styles.deptBadge}>{cat.departmentName}</span>
                                    )}
                                </div>
                                {cat.description && (
                                    <p className={styles.catDesc}>{cat.description}</p>
                                )}
                                {cat.slaPolicyName && (
                                    <div className={styles.defaultSlaBox}>
                                        <span>⚡ <strong>Default SLA:</strong> {cat.slaPolicyName} ({cat.slaPriority || 'General'}{cat.slaResolutionHours ? ` • ${cat.slaResolutionHours}h resolve` : ''})</span>
                                    </div>
                                )}
                                <div className={styles.cardMeta}>
                                    <span>Created by {cat.createdByName || '—'}</span>
                                </div>
                                {catSl.length > 0 && (
                                    <div className={styles.slaList}>
                                        <strong>Category SLA Policies:</strong>
                                        <ul>
                                            {catSl.map((p) => (
                                                <li key={p.id}>{p.name} ({p.priority.toUpperCase()} - {p.resolutionHours}h resolve)</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className={styles.cardActions}>
                                    <IconButton variant="view" onClick={() => openView(cat)} title="View Category Details" />
                                    <IconButton variant="edit" onClick={() => openEdit(cat)} title="Edit Category" />
                                    <IconButton variant="add" onClick={() => openSlaModal(cat)} title="Add SLA Policy" />
                                    {cat.isActive ? (
                                        <IconButton variant="deactivate" onClick={() => handleToggleActive(cat)} title="Deactivate" />
                                    ) : (
                                        <IconButton variant="activate" onClick={() => handleToggleActive(cat)} title="Activate" />
                                    )}
                                    {user?.role === 'admin' && (
                                        <IconButton variant="delete" onClick={() => handleDelete(cat)} title="Delete Category" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && totalCatPages > 1 && (
                <div className={styles.pagination}>
                    <button onClick={() => setCatPage(p => Math.max(1, p - 1))} disabled={catPage <= 1} className={styles.paginationBtn}>← Previous</button>
                    <span className={styles.paginationInfo}>Page {catPage} of {totalCatPages} &bull; {filteredCategories.length} total</span>
                    <button onClick={() => setCatPage(p => Math.min(totalCatPages, p + 1))} disabled={catPage >= totalCatPages} className={styles.paginationBtn}>Next →</button>
                </div>
            )}

            <Modal
                open={modalOpen}
                title={editing ? 'Edit Category' : 'Create Category'}
                onClose={() => setModalOpen(false)}
            >
                <div className={styles.modalForm}>
                    {error && <div className={styles.formError}>{error}</div>}

                    <label>Category Name *</label>
                    <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Hardware, Software, Network…"
                    />

                    <label>Description (optional)</label>
                    <textarea
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description of this category"
                    />

                     <label>Department (optional)</label>
                     <select
                         value={form.departmentId}
                         onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                     >
                         <option value="">All Departments</option>
                         {departments.map((d) => (
                             <option key={d.id} value={d.id}>{d.name}</option>
                         ))}
                     </select>

                     <label>Default SLA Policy (optional)</label>
                     <select
                         value={form.slaPolicyId}
                         onChange={(e) => setForm((f) => ({ ...f, slaPolicyId: e.target.value }))}
                     >
                         <option value="">No Default SLA Policy (System Priority Defaults)</option>
                         {slaPolicies.map((p) => (
                             <option key={p.id} value={p.id}>
                                 {p.name} ({p.priority.toUpperCase()} - {p.resolutionHours}h resolve{p.categoryName ? ` [${p.categoryName}]` : ''})
                             </option>
                         ))}
                     </select>

                     <label>Ticket Routing *</label>
                     <div className={styles.routingOptions}>
                         <label className={styles.routingOption}>
                             <input
                                 type="radio"
                                 name="routingType"
                                 value="general"
                                 checked={form.routingType === 'general'}
                                 onChange={() => setForm((f) => ({ ...f, routingType: 'general' }))}
                             />
                             <span>General &mdash; tickets go to Admin, who assigns the department manager.</span>
                         </label>
                         <label className={styles.routingOption}>
                             <input
                                 type="radio"
                                 name="routingType"
                                 value="direct"
                                 checked={form.routingType === 'direct'}
                                 onChange={() => setForm((f) => ({ ...f, routingType: 'direct' }))}
                             />
                             <span>Direct &mdash; tickets route straight to this category&rsquo;s department manager.</span>
                         </label>
                     </div>
                     {form.routingType === 'direct' && !form.departmentId && (
                         <p className={styles.routingHint}>Select a department above for direct routing.</p>
                     )}

                    <div className={styles.modalActions}>
                        <button onClick={() => setModalOpen(false)} className={styles.cancelBtn}>Cancel</button>
                        <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
                            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={slaModalOpen}
                title={`Create SLA Policy${slaForCategory ? ` for ${slaForCategory.name}` : ''}`}
                onClose={() => setSlaModalOpen(false)}
            >
                <div className={styles.modalForm}>
                    {slaError && <div className={styles.formError}>{slaError}</div>}

                    <label>Policy Name *</label>
                    <input
                        value={slaForm.name}
                        onChange={(e) => setSlaForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. High Priority SLA"
                    />

                    <label>Priority</label>
                    <select
                        value={slaForm.priority}
                        onChange={(e) => setSlaForm((f) => ({ ...f, priority: e.target.value as any }))}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>

                    <label>First Response Time (hours)</label>
                    <input
                        type="number"
                        min="0"
                        value={slaForm.responseHours}
                        onChange={(e) => setSlaForm((f) => ({ ...f, responseHours: Number(e.target.value) }))}
                    />

                    <label>Resolution Time (hours)</label>
                    <input
                        type="number"
                        min="1"
                        value={slaForm.resolutionHours}
                        onChange={(e) => setSlaForm((f) => ({ ...f, resolutionHours: Number(e.target.value) }))}
                    />

                    <label>Escalation Time (hours, 0 to disable)</label>
                    <input
                        type="number"
                        min="0"
                        value={slaForm.escalationHours}
                        onChange={(e) => setSlaForm((f) => ({ ...f, escalationHours: Number(e.target.value) }))}
                    />

                    <label>Description (optional)</label>
                    <textarea
                        rows={2}
                        value={slaForm.description}
                        onChange={(e) => setSlaForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description of this SLA policy"
                    />

                    <div className={styles.modalActions}>
                        <button onClick={() => setSlaModalOpen(false)} className={styles.cancelBtn}>Cancel</button>
                        <button onClick={handleCreateSla} disabled={slaSaving} className={styles.saveBtn}>
                            {slaSaving ? 'Saving…' : 'Create SLA Policy'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={viewModalOpen}
                title={`Category Details: ${viewingCategory?.name || ''}`}
                onClose={() => setViewModalOpen(false)}
            >
                {viewingCategory && (
                    <div className={styles.viewModalContent}>
                        <div className={styles.viewHeader}>
                            <div>
                                <h2 className={styles.viewTitle}>{viewingCategory.name}</h2>
                                <div className={styles.viewBadges}>
                                    <span className={viewingCategory.isActive ? styles.badgeActive : styles.badgeInactive}>
                                        {viewingCategory.isActive ? '● Active' : '○ Inactive'}
                                    </span>
                                    {viewingCategory.status && (
                                        <span className={
                                            viewingCategory.status === 'approved' ? styles.statusApproved :
                                            viewingCategory.status === 'pending' ? styles.statusPending :
                                            styles.statusRejected
                                        }>
                                            {viewingCategory.status.toUpperCase()}
                                        </span>
                                    )}
                                    <span className={styles.routingBadge}>
                                        {((viewingCategory as any).routing_type || viewingCategory.routingType) === 'direct'
                                            ? 'Direct Routing'
                                            : 'General Routing'}
                                    </span>
                                    {viewingCategory.departmentName && (
                                        <span className={styles.deptBadge}>{viewingCategory.departmentName}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.viewSection}>
                            <h4 className={styles.viewSectionTitle}>Description</h4>
                            <p className={styles.viewDesc}>
                                {viewingCategory.description || 'No description provided for this category.'}
                            </p>
                        </div>

                        <div className={styles.viewGrid}>
                            <div className={styles.viewCard}>
                                <span className={styles.viewLabel}>Assigned Department</span>
                                <span className={styles.viewValue}>
                                    {viewingCategory.departmentName || 'All Departments (General / Unassigned)'}
                                </span>
                            </div>
                            <div className={styles.viewCard}>
                                <span className={styles.viewLabel}>Routing Flow</span>
                                <span className={styles.viewValue}>
                                    {((viewingCategory as any).routing_type || viewingCategory.routingType) === 'direct'
                                        ? 'Direct to Department Manager'
                                        : 'General Admin Dispatch'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.viewSection}>
                            <h4 className={styles.viewSectionTitle}>Default SLA Policy</h4>
                            {viewingCategory.slaPolicyName ? (
                                <div className={styles.viewSlaHighlight}>
                                    <div className={styles.viewSlaHeader}>
                                        <strong>⚡ {viewingCategory.slaPolicyName}</strong>
                                        <span className={`${styles.viewPriorityBadge} ${styles[viewingCategory.slaPriority?.toLowerCase() || 'high'] || ''}`}>
                                            {(viewingCategory.slaPriority || 'General').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className={styles.viewSlaStats}>
                                        {viewingCategory.slaResolutionHours && (
                                            <div className={styles.viewSlaStatItem}>
                                                <span>Resolution Time</span>
                                                <strong>{viewingCategory.slaResolutionHours} hours</strong>
                                            </div>
                                        )}
                                        {viewingCategory.slaResponseHours && (
                                            <div className={styles.viewSlaStatItem}>
                                                <span>First Response</span>
                                                <strong>{viewingCategory.slaResponseHours} hours</strong>
                                            </div>
                                        )}
                                        {viewingCategory.slaEscalationHours ? (
                                            <div className={styles.viewSlaStatItem}>
                                                <span>Escalation</span>
                                                <strong>{viewingCategory.slaEscalationHours} hours</strong>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.viewEmpty}>No default SLA policy assigned. (System priority defaults apply)</div>
                            )}
                        </div>

                        <div className={styles.viewSection}>
                            <h4 className={styles.viewSectionTitle}>
                                Category SLA Policies ({getCategorySlaPolicies(viewingCategory.id).length})
                            </h4>
                            {getCategorySlaPolicies(viewingCategory.id).length > 0 ? (
                                <div className={styles.viewSlaList}>
                                    {getCategorySlaPolicies(viewingCategory.id).map((p) => (
                                        <div key={p.id} className={styles.viewSlaCard}>
                                            <div className={styles.viewSlaCardHeader}>
                                                <strong>{p.name}</strong>
                                                <span className={`${styles.priorityPill} ${styles[p.priority?.toLowerCase() || 'medium'] || ''}`}>
                                                    {p.priority.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className={styles.viewSlaCardMeta}>
                                                <span>⏱️ Resolution: <strong>{p.resolutionHours}h</strong></span>
                                                <span>💬 Response: <strong>{p.responseHours}h</strong></span>
                                                {p.escalationHours ? (
                                                    <span>🚨 Escalation: <strong>{p.escalationHours}h</strong></span>
                                                ) : null}
                                            </div>
                                            {p.description && <p className={styles.viewSlaCardDesc}>{p.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.viewEmpty}>No additional SLA policies configured for this category.</div>
                            )}
                        </div>

                        <div className={styles.viewMetaSection}>
                            <div className={styles.viewMetaRow}>
                                <span>Created By:</span>
                                <strong>{viewingCategory.createdByName || 'System Admin'}</strong>
                            </div>
                            {viewingCategory.createdAt && (
                                <div className={styles.viewMetaRow}>
                                <span>Created Date:</span>
                                <strong>{new Date(viewingCategory.createdAt).toLocaleString()}</strong>
                            </div>
                            )}
                            {viewingCategory.updatedAt && (
                                <div className={styles.viewMetaRow}>
                                <span>Last Updated:</span>
                                <strong>{new Date(viewingCategory.updatedAt).toLocaleString()}</strong>
                            </div>
                            )}
                            {viewingCategory.reviewNotes && (
                                <div className={styles.viewMetaRow}>
                                <span>Review Notes:</span>
                                <strong>{viewingCategory.reviewNotes}</strong>
                            </div>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                onClick={() => {
                                    const cat = viewingCategory;
                                    setViewModalOpen(false);
                                    openEdit(cat);
                                }}
                                className={styles.editBtn}
                            >
                                ✏️ Edit Category
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const cat = viewingCategory;
                                    setViewModalOpen(false);
                                    openSlaModal(cat);
                                }}
                                className={styles.saveBtn}
                                style={{ background: '#0284c7' }}
                            >
                                ➕ Add SLA Policy
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewModalOpen(false)}
                                className={styles.cancelBtn}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
