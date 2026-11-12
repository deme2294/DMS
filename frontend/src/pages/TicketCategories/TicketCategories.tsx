import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import Modal from '../../components/Modal/Modal';
import IconButton from '../../components/IconButton/IconButton';
import {
    PencilSquareIcon,
    PlusIcon,
    XMarkIcon,
    BuildingOffice2Icon,
    ArrowsRightLeftIcon,
    ClockIcon,
    ShieldCheckIcon,
    ShieldExclamationIcon,
    CalendarIcon,
    UserIcon,
    BoltIcon,
    DocumentTextIcon,
    FolderIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowTrendingUpIcon,
    TagIcon,
    InformationCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
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
import { createSLAPolicy, updateSLAPolicy, deleteSLAPolicy, fetchSLAPolicies, type SLAPolicy } from '../../api/slaApi';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
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
    escalationHours: 12,
    description: '',
    isActive: true,
    setAsDefault: false,
    useWorkingHours: false,
    workDays: [1, 2, 3, 4, 5] as number[],
    workStart: '09:00',
    workEnd: '17:00',
};

export default function TicketCategories() {
    const { user } = useAuth();
    const { showSuccess, showError } = useAlert();
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
    const [editingSla, setEditingSla] = useState<SLAPolicy | null>(null);
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
        const resolvedRouting = (cat as any).routing_type || cat.routingType || (cat.departmentId ? 'direct' : 'general');
        setForm({
            name: cat.name,
            description: cat.description || '',
            departmentId: cat.departmentId || '',
            slaPolicyId: cat.slaPolicyId || '',
            routingType: resolvedRouting as 'general' | 'direct',
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
                const msg = `Category "${payload.name}" updated successfully`;
                setMessage(msg);
                showSuccess(msg, 'Category Updated');
            } else {
                await createCategory(payload);
                const msg = `Category "${payload.name}" created successfully`;
                setMessage(msg);
                showSuccess(msg, 'Category Created');
            }
            setModalOpen(false);
            load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to save category';
            setError(errMsg);
            showError(errMsg, 'Save Error');
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
            const msg = `Category "${cat.name}" ${next ? 'activated' : 'deactivated'}`;
            setMessage(msg);
            showSuccess(msg, 'Status Updated');
            load();
        } catch {
            // Rollback on failure
            setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, isActive: cat.isActive } : c)));
            const errMsg = 'Failed to update category status';
            setMessage(errMsg);
            showError(errMsg, 'Status Error');
        }
    };

    const handleDelete = async (cat: TicketCategory) => {
        if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
        try {
            await deleteCategory(cat.id);
            const msg = `Category "${cat.name}" deleted successfully`;
            setMessage(msg);
            showSuccess(msg, 'Category Deleted');
            load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to delete category';
            setMessage(errMsg);
            showError(errMsg, 'Delete Error');
        }
    };

    const handleApprove = async (cat: TicketCategory) => {
        try {
            await approveCategory(cat.id, reviewNotes || undefined);
            const msg = `Category "${cat.name}" approved`;
            setMessage(msg);
            showSuccess(msg, 'Category Approved');
            setReviewNotes('');
            load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to approve category';
            setMessage(errMsg);
            showError(errMsg, 'Approval Error');
        }
    };

    const handleReject = async (cat: TicketCategory) => {
        try {
            await rejectCategory(cat.id, reviewNotes || undefined);
            const msg = `Category "${cat.name}" rejected`;
            setMessage(msg);
            showSuccess(msg, 'Category Rejected');
            setReviewNotes('');
            load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to reject category';
            setMessage(errMsg);
            showError(errMsg, 'Reject Error');
        }
    };

    const openSlaModal = (cat: TicketCategory) => {
        setEditingSla(null);
        setSlaForCategory(cat);
        const existingPriorities = new Set(
            slaPolicies
                .filter(p => p.categoryId === cat.id)
                .map(p => p.priority.toLowerCase())
        );
        const priorityOrder: ('low' | 'medium' | 'high' | 'urgent')[] = ['medium', 'high', 'urgent', 'low'];
        const availablePriority = priorityOrder.find(p => !existingPriorities.has(p)) || 'medium';
        const defaultHours: Record<'low' | 'medium' | 'high' | 'urgent', { response: number; resolution: number; escalation: number }> = {
            low: { response: 8, resolution: 48, escalation: 24 },
            medium: { response: 4, resolution: 24, escalation: 12 },
            high: { response: 2, resolution: 8, escalation: 4 },
            urgent: { response: 1, resolution: 4, escalation: 2 },
        };
        const cfg = defaultHours[availablePriority];
        setSlaForm({
            ...emptySlaForm,
            name: `${cat.name} ${availablePriority.charAt(0).toUpperCase() + availablePriority.slice(1)} SLA`,
            priority: availablePriority,
            responseHours: cfg.response,
            resolutionHours: cfg.resolution,
            escalationHours: cfg.escalation,
            setAsDefault: !cat.slaPolicyId,
        });
        if (existingPriorities.has(availablePriority)) {
            setSlaError(`All priority levels already have an SLA policy configured for "${cat.name}".`);
        } else {
            setSlaError('');
        }
        setSlaModalOpen(true);
    };

    const openEditSlaModal = (cat: TicketCategory, policy: SLAPolicy) => {
        setEditingSla(policy);
        setSlaForCategory(cat);
        const wh = policy.workingHours && typeof policy.workingHours === 'object' ? policy.workingHours : null;
        setSlaForm({
            name: policy.name,
            priority: policy.priority,
            responseHours: Number(policy.responseHours ?? 4),
            resolutionHours: Number(policy.resolutionHours ?? 24),
            escalationHours: policy.escalationHours !== null && policy.escalationHours !== undefined ? Number(policy.escalationHours) : 0,
            description: policy.description || '',
            isActive: policy.isActive !== false,
            setAsDefault: cat.slaPolicyId === policy.id,
            useWorkingHours: Boolean(wh && Array.isArray(wh.workDays) && wh.workDays.length > 0),
            workDays: Array.isArray(wh?.workDays) && wh.workDays.length > 0 ? wh.workDays : [1, 2, 3, 4, 5],
            workStart: wh?.start || '09:00',
            workEnd: wh?.end || '17:00',
        });
        setSlaError('');
        setSlaModalOpen(true);
    };

    const handleSaveSla = async () => {
        if (!slaForm.name.trim()) { setSlaError('Policy name is required'); return; }
        if (isNaN(Number(slaForm.responseHours)) || Number(slaForm.responseHours) < 0) {
            setSlaError('First Response Time must be a valid number (>= 0)');
            return;
        }
        if (isNaN(Number(slaForm.resolutionHours)) || Number(slaForm.resolutionHours) < 1) {
            setSlaError('Resolution Time must be a valid number (>= 1)');
            return;
        }

        const resp = Number(slaForm.responseHours);
        const res = Number(slaForm.resolutionHours);
        const esc = slaForm.escalationHours !== undefined && slaForm.escalationHours !== null && !isNaN(Number(slaForm.escalationHours)) ? Number(slaForm.escalationHours) : 0;

        if (res <= resp) {
            setSlaError(`Resolution Time (${res}h) must be strictly greater than First Response Time (${resp}h).`);
            return;
        }

        if (esc > 0) {
            if (esc <= resp) {
                setSlaError(`Escalation Time (${esc}h) must be greater than First Response Time (${resp}h).`);
                return;
            }
            if (esc > res) {
                setSlaError(`Escalation Time (${esc}h) must be less than or equal to Resolution Time (${res}h).`);
                return;
            }
        }

        const workingHoursPayload = slaForm.useWorkingHours
            ? {
                workDays: slaForm.workDays.length > 0 ? slaForm.workDays : [1, 2, 3, 4, 5],
                start: slaForm.workStart || '09:00',
                end: slaForm.workEnd || '17:00',
            }
            : null;

        setSlaSaving(true);
        setSlaError('');
        try {
            const categoryId = slaForCategory?.id;
            const duplicatePriority = slaPolicies.find(
                p => p.id !== editingSla?.id && p.categoryId === categoryId && p.priority.toLowerCase() === slaForm.priority.toLowerCase()
            );
            if (duplicatePriority) {
                setSlaError(`An SLA policy with "${slaForm.priority.toUpperCase()}" priority already exists for this category ("${duplicatePriority.name}"). An SLA policy cannot be created twice for the same category and priority.`);
                return;
            }
            const duplicateName = slaPolicies.find(
                p => p.id !== editingSla?.id && p.categoryId === categoryId && p.name.toLowerCase() === slaForm.name.trim().toLowerCase()
            );
            if (duplicateName) {
                setSlaError(`An SLA policy named "${slaForm.name.trim()}" already exists for this category.`);
                return;
            }

            if (editingSla) {
                const resData = await updateSLAPolicy(editingSla.id, {
                    name: slaForm.name.trim(),
                    priority: slaForm.priority,
                    categoryId: categoryId || null,
                    responseHours: resp,
                    resolutionHours: res,
                    escalationHours: esc,
                    workingHours: workingHoursPayload,
                    description: slaForm.description.trim() || null,
                    isActive: slaForm.isActive,
                });
                const updatedPolicyId = resData?.data?.data?.id || editingSla.id;
                if (slaForCategory) {
                    if (slaForm.setAsDefault && slaForCategory.slaPolicyId !== updatedPolicyId) {
                        await updateCategory(slaForCategory.id, { slaPolicyId: updatedPolicyId }).catch(() => { });
                    } else if (!slaForm.setAsDefault && slaForCategory.slaPolicyId === updatedPolicyId) {
                        await updateCategory(slaForCategory.id, { slaPolicyId: null }).catch(() => { });
                    }
                }
                const msg = `SLA policy "${slaForm.name.trim()}" updated successfully`;
                setMessage(msg);
                showSuccess(msg, 'SLA Updated');
            } else {
                const resData = await createSLAPolicy({
                    name: slaForm.name.trim(),
                    priority: slaForm.priority,
                    categoryId: categoryId || undefined,
                    responseHours: resp,
                    resolutionHours: res,
                    escalationHours: esc,
                    workingHours: workingHoursPayload,
                    description: slaForm.description.trim() || undefined,
                });
                const createdId = resData?.data?.data?.id;
                if (slaForCategory && createdId && (slaForm.setAsDefault || !slaForCategory.slaPolicyId)) {
                    await updateCategory(slaForCategory.id, { slaPolicyId: createdId }).catch(() => { });
                }
                const msg = `SLA policy "${slaForm.name.trim()}" created and linked to category`;
                setMessage(msg);
                showSuccess(msg, 'SLA Created');
            }

            setSlaModalOpen(false);
            setEditingSla(null);
            await load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || `Failed to ${editingSla ? 'update' : 'create'} SLA policy`;
            setSlaError(errMsg);
            showError(errMsg, 'SLA Error');
        } finally {
            setSlaSaving(false);
        }
    };

    const handleDeleteSla = async (cat: TicketCategory, policy: SLAPolicy) => {
        if (!window.confirm(`Delete SLA policy "${policy.name}" (${policy.priority.toUpperCase()}) from "${cat.name}"?`)) return;
        try {
            await deleteSLAPolicy(policy.id);
            const msg = `SLA policy "${policy.name}" deleted`;
            setMessage(msg);
            showSuccess(msg, 'SLA Deleted');
            await load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to delete SLA policy';
            setMessage(errMsg);
            showError(errMsg, 'SLA Delete Error');
        }
    };

    const handleSetDefaultSla = async (cat: TicketCategory, policy: SLAPolicy) => {
        try {
            await updateCategory(cat.id, { slaPolicyId: policy.id });
            const msg = `"${policy.name}" set as default SLA for "${cat.name}"`;
            setMessage(msg);
            showSuccess(msg, 'Default SLA Updated');
            await load();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || 'Failed to set default SLA';
            showError(errMsg, 'SLA Error');
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
                                {cat.slaPolicyName && (() => {
                                    const defaultSlaObj = slaPolicies.find((p) => p.id === cat.slaPolicyId);
                                    return (
                                        <div className={styles.defaultSlaBox} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                            <span>⚡ <strong>Default SLA:</strong> {cat.slaPolicyName} ({cat.slaPriority || 'General'}{cat.slaResolutionHours ? ` • ${cat.slaResolutionHours}h resolve` : ''})</span>
                                            {defaultSlaObj && (
                                                <button
                                                    type="button"
                                                    className={styles.slaMiniBtn}
                                                    onClick={() => openEditSlaModal(cat, defaultSlaObj)}
                                                    title={`Edit Default SLA "${defaultSlaObj.name}"`}
                                                >
                                                    <PencilSquareIcon style={{ width: 13, height: 13 }} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                                <div className={styles.cardMeta}>
                                    <span>Created by {cat.createdByName || '—'}</span>
                                </div>
                                {catSl.length > 0 && (
                                    <div className={styles.slaList}>
                                        <strong>Category SLA Policies:</strong>
                                        <ul>
                                            {catSl.map((p) => (
                                                <li key={p.id} className={styles.slaItemRow}>
                                                    <span className={styles.slaItemText}>
                                                        {p.name} ({p.priority.toUpperCase()} - {p.resolutionHours}h resolve)
                                                        {cat.slaPolicyId === p.id && <span className={styles.slaDefaultTag}>Default</span>}
                                                        {!p.isActive && <span className={styles.slaInactiveTag}>Inactive</span>}
                                                    </span>
                                                    <span className={styles.slaItemActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.slaMiniBtn}
                                                            onClick={() => openEditSlaModal(cat, p)}
                                                            title={`Edit SLA "${p.name}"`}
                                                        >
                                                            <PencilSquareIcon style={{ width: 13, height: 13 }} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.slaMiniBtnDanger}
                                                            onClick={() => handleDeleteSla(cat, p)}
                                                            title={`Delete SLA "${p.name}"`}
                                                        >
                                                            <TrashIcon style={{ width: 13, height: 13 }} />
                                                        </button>
                                                    </span>
                                                </li>
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
                        onChange={(e) => {
                            const deptId = e.target.value;
                            setForm((f) => ({
                                ...f,
                                departmentId: deptId,
                                routingType: deptId ? 'direct' : 'general',
                            }));
                        }}
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                        <label style={{ margin: 0 }}>Ticket Routing *</label>
                        {form.departmentId && form.routingType === 'direct' && (
                            <span style={{ fontSize: '0.74rem', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                ✓ Auto-set to Direct
                            </span>
                        )}
                    </div>
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
                    {form.departmentId && form.routingType === 'direct' && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#15803d' }}>
                            ⚡ Tickets created under this category will route directly to <strong>{departments.find(d => d.id === form.departmentId)?.name || 'this department'}</strong> manager.
                        </p>
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
                title={`${editingSla ? 'Edit' : 'Create'} SLA Policy${slaForCategory ? ` — ${slaForCategory.name}` : ''}`}
                onClose={() => { setSlaModalOpen(false); setEditingSla(null); }}
            >
                <div className={styles.modalForm}>
                    {slaError && <div className={styles.formError}>{slaError}</div>}

                    <label>Policy Name *</label>
                    <input
                        value={slaForm.name}
                        onChange={(e) => setSlaForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. High Priority SLA"
                    />

                    <label>Priority *</label>
                    <select
                        value={slaForm.priority}
                        onChange={(e) => {
                            const newPri = e.target.value as 'low' | 'medium' | 'high' | 'urgent';
                            const exists = slaPolicies.find(
                                p => p.id !== editingSla?.id && p.categoryId === slaForCategory?.id && p.priority.toLowerCase() === newPri.toLowerCase()
                            );
                            const defaultHours: Record<'low' | 'medium' | 'high' | 'urgent', { response: number; resolution: number; escalation: number }> = {
                                low: { response: 8, resolution: 48, escalation: 24 },
                                medium: { response: 4, resolution: 24, escalation: 12 },
                                high: { response: 2, resolution: 8, escalation: 4 },
                                urgent: { response: 1, resolution: 4, escalation: 2 },
                            };
                            const cfg = defaultHours[newPri] || { response: 4, resolution: 24, escalation: 12 };
                            setSlaForm((f) => ({
                                ...f,
                                priority: newPri,
                                ...(editingSla ? {} : {
                                    responseHours: cfg.response,
                                    resolutionHours: cfg.resolution,
                                    escalationHours: cfg.escalation,
                                }),
                            }));
                            if (exists) {
                                setSlaError(`An SLA policy with "${newPri.toUpperCase()}" priority already exists for this category ("${exists.name}").`);
                            } else {
                                setSlaError('');
                            }
                        }}
                    >
                        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                            const alreadyConfigured = slaPolicies.some(
                                sp => sp.id !== editingSla?.id && sp.categoryId === slaForCategory?.id && sp.priority.toLowerCase() === p
                            );
                            return (
                                <option key={p} value={p} disabled={alreadyConfigured}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)} {alreadyConfigured ? '— Already configured for this category (Cannot duplicate)' : ''}
                                </option>
                            );
                        })}
                    </select>
                    {slaPolicies.some(sp => sp.id !== editingSla?.id && sp.categoryId === slaForCategory?.id && sp.priority.toLowerCase() === slaForm.priority.toLowerCase()) && (
                        <div className={styles.formError} style={{ marginTop: '0.4rem', marginBottom: '0.6rem', padding: '0.6rem 0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c' }}>
                            ⚠️ <strong>Duplicate Priority Notice:</strong> An SLA policy with <strong>{slaForm.priority.toUpperCase()}</strong> priority already exists for <strong>{slaForCategory?.name}</strong>. Please select another priority.
                        </div>
                    )}

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
                        placeholder="e.g. 12 (must be > Response & <= Resolution)"
                        value={slaForm.escalationHours}
                        onChange={(e) => setSlaForm((f) => ({ ...f, escalationHours: Number(e.target.value) }))}
                    />

                    <div className={styles.slaRuleBanner}>
                        <InformationCircleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                        <span>
                            <strong>SLA Constraint Rule:</strong> First Response Time &lt; Escalation Time ≤ Resolution Time
                        </span>
                    </div>

                    {/* Working Hours Schedule */}
                    <div className={styles.workHoursBox}>
                        <label className={styles.workHoursToggle}>
                            <input
                                type="checkbox"
                                checked={slaForm.useWorkingHours}
                                onChange={(e) => setSlaForm((f) => ({ ...f, useWorkingHours: e.target.checked }))}
                            />
                            <span>Use Custom Working Hours Schedule (instead of 24/7 calendar)</span>
                        </label>
                        {slaForm.useWorkingHours && (
                            <div className={styles.workHoursBody}>
                                <div className={styles.workHoursTimeRow}>
                                    <div>
                                        <label>Start Time</label>
                                        <input
                                            type="time"
                                            value={slaForm.workStart}
                                            onChange={(e) => setSlaForm((f) => ({ ...f, workStart: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label>End Time</label>
                                        <input
                                            type="time"
                                            value={slaForm.workEnd}
                                            onChange={(e) => setSlaForm((f) => ({ ...f, workEnd: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className={styles.workDaysRow}>
                                    <span className={styles.workDaysLabel}>Working Days:</span>
                                    <div className={styles.workDaysGrid}>
                                        {[
                                            { d: 0, label: 'Sun' },
                                            { d: 1, label: 'Mon' },
                                            { d: 2, label: 'Tue' },
                                            { d: 3, label: 'Wed' },
                                            { d: 4, label: 'Thu' },
                                            { d: 5, label: 'Fri' },
                                            { d: 6, label: 'Sat' },
                                        ].map(({ d, label }) => {
                                            const checked = slaForm.workDays.includes(d);
                                            return (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    className={`${styles.workDayChip} ${checked ? styles.workDayChipActive : ''}`}
                                                    onClick={() => setSlaForm((f) => ({
                                                        ...f,
                                                        workDays: checked
                                                            ? f.workDays.filter((x) => x !== d)
                                                            : [...f.workDays, d].sort((a, b) => a - b),
                                                    }))}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <label>Description (optional)</label>
                    <textarea
                        rows={2}
                        value={slaForm.description}
                        onChange={(e) => setSlaForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description of this SLA policy"
                    />

                    <div className={styles.slaCheckOptions}>
                        <label className={styles.slaCheckLabel}>
                            <input
                                type="checkbox"
                                checked={slaForm.setAsDefault}
                                onChange={(e) => setSlaForm((f) => ({ ...f, setAsDefault: e.target.checked }))}
                            />
                            <span>Set as Default SLA Policy for {slaForCategory?.name || 'this category'}</span>
                        </label>
                        {editingSla && (
                            <label className={styles.slaCheckLabel}>
                                <input
                                    type="checkbox"
                                    checked={slaForm.isActive}
                                    onChange={(e) => setSlaForm((f) => ({ ...f, isActive: e.target.checked }))}
                                />
                                <span>Policy is Active</span>
                            </label>
                        )}
                    </div>

                    <div className={styles.modalActions}>
                        <button onClick={() => { setSlaModalOpen(false); setEditingSla(null); }} className={styles.cancelBtn}>Cancel</button>
                        <button
                            onClick={handleSaveSla}
                            disabled={slaSaving || slaPolicies.some(sp => sp.id !== editingSla?.id && sp.categoryId === slaForCategory?.id && sp.priority.toLowerCase() === slaForm.priority.toLowerCase())}
                            className={styles.saveBtn}
                        >
                            {slaSaving ? 'Saving…' : editingSla ? 'Save SLA Changes' : 'Create SLA Policy'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={viewModalOpen}
                title={`Category Details: ${viewingCategory?.name || ''}`}
                onClose={() => setViewModalOpen(false)}
                maxWidth="660px"
            >
                {viewingCategory && (
                    <div className={styles.viewModalContent}>
                        {/* ── Category Hero Header ── */}
                        <div className={styles.categoryHero}>
                            <div className={styles.categoryHeroIconWrapper}>
                                <FolderIcon className={styles.categoryHeroIcon} />
                            </div>
                            <div className={styles.categoryHeroBody}>
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
                                        <ArrowsRightLeftIcon className={styles.inlineBadgeIcon} />
                                        {((viewingCategory as any).routing_type || viewingCategory.routingType) === 'direct'
                                            ? 'Direct Routing'
                                            : 'General Routing'}
                                    </span>
                                    {viewingCategory.departmentName && (
                                        <span className={styles.deptBadge}>
                                            <BuildingOffice2Icon className={styles.inlineBadgeIcon} />
                                            {viewingCategory.departmentName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Description ── */}
                        <div className={styles.viewSection}>
                            <div className={styles.viewSectionHeader}>
                                <DocumentTextIcon className={styles.viewSectionIcon} />
                                <h4 className={styles.viewSectionTitle}>Description</h4>
                            </div>
                            <div className={styles.viewDesc}>
                                {viewingCategory.description || (
                                    <span className={styles.viewDescPlaceholder}>No description provided for this category.</span>
                                )}
                            </div>
                        </div>

                        {/* ── Department & Routing Grid ── */}
                        <div className={styles.viewGrid}>
                            <div className={styles.viewCard}>
                                <div className={styles.viewCardHeader}>
                                    <BuildingOffice2Icon className={styles.viewCardIcon} />
                                    <span className={styles.viewLabel}>Assigned Department</span>
                                </div>
                                <span className={styles.viewValue}>
                                    {viewingCategory.departmentName || 'All Departments (General / Unassigned)'}
                                </span>
                                <span className={styles.viewSubtext}>
                                    {viewingCategory.departmentName
                                        ? 'Assigned to a specific department queue'
                                        : 'Handled via general department dispatch'}
                                </span>
                            </div>
                            <div className={styles.viewCard}>
                                <div className={styles.viewCardHeader}>
                                    <ArrowsRightLeftIcon className={styles.viewCardIcon} />
                                    <span className={styles.viewLabel}>Routing Flow</span>
                                </div>
                                <span className={styles.viewValue}>
                                    {((viewingCategory as any).routing_type || viewingCategory.routingType) === 'direct'
                                        ? 'Direct to Department Manager'
                                        : 'General Admin Dispatch'}
                                </span>
                                <span className={styles.viewSubtext}>
                                    {((viewingCategory as any).routing_type || viewingCategory.routingType) === 'direct'
                                        ? 'Tickets auto-routed to department manager queue'
                                        : 'Admin reviews and dispatches to appropriate team'}
                                </span>
                            </div>
                        </div>

                        {/* ── Default SLA Policy ── */}
                        <div className={styles.viewSection}>
                            <div className={styles.viewSectionHeader} style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheckIcon className={styles.viewSectionIcon} />
                                    <h4 className={styles.viewSectionTitle}>Default SLA Policy</h4>
                                </div>
                                {viewingCategory.slaPolicyId && (() => {
                                    const defPol = slaPolicies.find((p) => p.id === viewingCategory.slaPolicyId);
                                    return defPol ? (
                                        <button
                                            type="button"
                                            className={styles.viewAssignSlaBtn}
                                            onClick={() => {
                                                setViewModalOpen(false);
                                                openEditSlaModal(viewingCategory, defPol);
                                            }}
                                        >
                                            <PencilSquareIcon className={styles.inlineActionIcon} />
                                            <span>Edit Default SLA</span>
                                        </button>
                                    ) : null;
                                })()}
                            </div>
                            {viewingCategory.slaPolicyName ? (
                                <div className={styles.viewSlaHighlight}>
                                    <div className={styles.viewSlaHeader}>
                                        <div className={styles.viewSlaTitleBox}>
                                            <BoltIcon className={styles.viewSlaTitleIcon} />
                                            <strong>{viewingCategory.slaPolicyName}</strong>
                                        </div>
                                        <span className={`${styles.viewPriorityBadge} ${styles[viewingCategory.slaPriority?.toLowerCase() || 'high'] || ''}`}>
                                            {(viewingCategory.slaPriority || 'General').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className={styles.viewSlaStats}>
                                        {viewingCategory.slaResponseHours ? (
                                            <div className={styles.viewSlaStatItem}>
                                                <span className={styles.viewSlaStatLabel}>
                                                    <BoltIcon className={styles.statIcon} /> First Response
                                                </span>
                                                <strong>{viewingCategory.slaResponseHours}h target</strong>
                                            </div>
                                        ) : null}
                                        {viewingCategory.slaResolutionHours ? (
                                            <div className={styles.viewSlaStatItem}>
                                                <span className={styles.viewSlaStatLabel}>
                                                    <ClockIcon className={styles.statIcon} /> Resolution Time
                                                </span>
                                                <strong>{viewingCategory.slaResolutionHours}h target</strong>
                                            </div>
                                        ) : null}
                                        {viewingCategory.slaEscalationHours ? (
                                            <div className={styles.viewSlaStatItem}>
                                                <span className={styles.viewSlaStatLabel}>
                                                    <ArrowTrendingUpIcon className={styles.statIcon} /> Escalation
                                                </span>
                                                <strong>{viewingCategory.slaEscalationHours}h threshold</strong>
                                            </div>
                                        ) : (
                                            <div className={styles.viewSlaStatItem}>
                                                <span className={styles.viewSlaStatLabel}>
                                                    <ArrowTrendingUpIcon className={styles.statIcon} /> Escalation
                                                </span>
                                                <strong className={styles.viewMutedText}>Disabled</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.viewEmptyWithAction}>
                                    <div className={styles.viewEmptyInfo}>
                                        <ShieldExclamationIcon className={styles.viewEmptyIcon} />
                                        <div>
                                            <strong>No default SLA policy assigned</strong>
                                            <p>Standard system priority defaults apply to tickets created in this category.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cat = viewingCategory;
                                            setViewModalOpen(false);
                                            openSlaModal(cat);
                                        }}
                                        className={styles.viewAssignSlaBtn}
                                    >
                                        <PlusIcon className={styles.inlineActionIcon} />
                                        <span>Assign Policy</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Category SLA Policies ── */}
                        <div className={styles.viewSection}>
                            <div className={styles.viewSectionHeader} style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ClockIcon className={styles.viewSectionIcon} />
                                    <h4 className={styles.viewSectionTitle}>
                                        Category SLA Policies
                                        <span className={styles.viewCountPill}>
                                            {getCategorySlaPolicies(viewingCategory.id).length}
                                        </span>
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const cat = viewingCategory;
                                        setViewModalOpen(false);
                                        openSlaModal(cat);
                                    }}
                                    className={styles.viewAssignSlaBtn}
                                >
                                    <PlusIcon className={styles.inlineActionIcon} />
                                    <span>Add SLA Policy</span>
                                </button>
                            </div>
                            {getCategorySlaPolicies(viewingCategory.id).length > 0 ? (
                                <div className={styles.viewSlaList}>
                                    {getCategorySlaPolicies(viewingCategory.id).map((p) => (
                                        <div key={p.id} className={styles.viewSlaCard}>
                                            <div className={styles.viewSlaCardHeader}>
                                                <div className={styles.viewSlaNameBox}>
                                                    <TagIcon className={styles.slaCardTagIcon} />
                                                    <strong>{p.name}</strong>
                                                    {viewingCategory.slaPolicyId === p.id && <span className={styles.slaDefaultTag}>Default</span>}
                                                    {!p.isActive && <span className={styles.slaInactiveTag}>Inactive</span>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className={`${styles.priorityPill} ${styles[p.priority?.toLowerCase() || 'medium'] || ''}`}>
                                                        {p.priority.toUpperCase()}
                                                    </span>
                                                    {viewingCategory.slaPolicyId !== p.id && (
                                                        <button
                                                            type="button"
                                                            className={styles.slaMiniBtn}
                                                            onClick={() => handleSetDefaultSla(viewingCategory, p)}
                                                            title="Set as Default SLA"
                                                        >
                                                            Default
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className={styles.slaMiniBtn}
                                                        onClick={() => {
                                                            setViewModalOpen(false);
                                                            openEditSlaModal(viewingCategory, p);
                                                        }}
                                                        title={`Edit "${p.name}"`}
                                                    >
                                                        <PencilSquareIcon style={{ width: 14, height: 14 }} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.slaMiniBtnDanger}
                                                        onClick={() => handleDeleteSla(viewingCategory, p)}
                                                        title={`Delete "${p.name}"`}
                                                    >
                                                        <TrashIcon style={{ width: 14, height: 14 }} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className={styles.viewSlaCardMeta}>
                                                <span className={styles.metaStat}>
                                                    <BoltIcon className={styles.metaStatIcon} /> Response: <strong>{p.responseHours}h</strong>
                                                </span>
                                                <span className={styles.metaStat}>
                                                    <ClockIcon className={styles.metaStatIcon} /> Resolution: <strong>{p.resolutionHours}h</strong>
                                                </span>
                                                {p.escalationHours ? (
                                                    <span className={styles.metaStat}>
                                                        <ArrowTrendingUpIcon className={styles.metaStatIcon} /> Escalation: <strong>{p.escalationHours}h</strong>
                                                    </span>
                                                ) : null}
                                                {p.workingHours && typeof p.workingHours === 'object' && p.workingHours.start ? (
                                                    <span className={styles.metaStat}>
                                                        <CalendarIcon className={styles.metaStatIcon} /> Hours: <strong>{p.workingHours.start}–{p.workingHours.end}</strong>
                                                    </span>
                                                ) : null}
                                            </div>
                                            {p.description && <p className={styles.viewSlaCardDesc}>{p.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.viewEmptyWithAction}>
                                    <div className={styles.viewEmptyInfo}>
                                        <ClockIcon className={styles.viewEmptyIcon} />
                                        <div>
                                            <strong>No additional category policies</strong>
                                            <p>No priority-specific SLA overrides configured for this category.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cat = viewingCategory;
                                            setViewModalOpen(false);
                                            openSlaModal(cat);
                                        }}
                                        className={styles.viewAssignSlaBtn}
                                    >
                                        <PlusIcon className={styles.inlineActionIcon} />
                                        <span>Add SLA Policy</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Metadata & Audit Strip ── */}
                        <div className={styles.viewMetaGrid}>
                            <div className={styles.viewMetaItem}>
                                <div className={styles.viewMetaLabel}>
                                    <UserIcon className={styles.metaIcon} /> Created By
                                </div>
                                <div className={styles.viewMetaValue}>{viewingCategory.createdByName || 'System Admin'}</div>
                            </div>
                            {viewingCategory.createdAt && (
                                <div className={styles.viewMetaItem}>
                                    <div className={styles.viewMetaLabel}>
                                        <CalendarIcon className={styles.metaIcon} /> Created Date
                                    </div>
                                    <div className={styles.viewMetaValue}>{new Date(viewingCategory.createdAt).toLocaleString()}</div>
                                </div>
                            )}
                            {viewingCategory.updatedAt && (
                                <div className={styles.viewMetaItem}>
                                    <div className={styles.viewMetaLabel}>
                                        <ClockIcon className={styles.metaIcon} /> Last Updated
                                    </div>
                                    <div className={styles.viewMetaValue}>{new Date(viewingCategory.updatedAt).toLocaleString()}</div>
                                </div>
                            )}
                            {viewingCategory.reviewNotes && (
                                <div className={styles.viewMetaItemFull}>
                                    <div className={styles.viewMetaLabel}>
                                        <ChatBubbleLeftEllipsisIcon className={styles.metaIcon} /> Review Notes
                                    </div>
                                    <div className={styles.viewMetaValueNotes}>{viewingCategory.reviewNotes}</div>
                                </div>
                            )}
                        </div>

                        {/* ── Modal Actions Footer ── */}
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                onClick={() => {
                                    const cat = viewingCategory;
                                    setViewModalOpen(false);
                                    openEdit(cat);
                                }}
                                className={styles.actionBtnEdit}
                            >
                                <PencilSquareIcon className={styles.btnActionIcon} />
                                <span>Edit Category</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const cat = viewingCategory;
                                    setViewModalOpen(false);
                                    openSlaModal(cat);
                                }}
                                className={styles.actionBtnAddSla}
                            >
                                <PlusIcon className={styles.btnActionIcon} />
                                <span>Add SLA Policy</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewModalOpen(false)}
                                className={styles.actionBtnClose}
                            >
                                <XMarkIcon className={styles.btnActionIcon} />
                                <span>Close</span>
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
