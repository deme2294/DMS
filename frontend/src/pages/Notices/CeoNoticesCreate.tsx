import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageHeader from '../../components/PageHeader/PageHeader';
import { createNotice } from '../../api/noticeApi';
import { fetchCategories, type TicketCategory } from '../../api/categoryApi';
import { fetchTickets } from '../../api/ticketApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type { Ticket } from '../../types/ticket';
import {
  TagIcon,
  TicketIcon,
  BoltIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from './CeoNotices.module.css';

type NoticeFormValues = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  targetAudience: 'all' | 'admin' | 'manager' | 'staff' | 'tenant' | 'department' | 'ceo';
  departmentId?: string;
  expiresAt?: string;
};

export default function CeoNoticesCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlTicketId = searchParams.get('ticketId');
  const urlCategory = searchParams.get('category');

  const [mode, setMode] = useState<'category' | 'manual'>('category');
  const [allEscalatedTickets, setAllEscalatedTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Tickets associated with the selected category (escalated to higher authority only)
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishIntent, setPublishIntent] = useState<'draft' | 'published'>('published');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NoticeFormValues>({
    defaultValues: {
      priority: 'high',
      targetAudience: 'admin',
      departmentId: '',
    },
  });

  const currentAudience = watch('targetAudience');

  // Load categories & fetch escalated unresolved tickets
  useEffect(() => {
    let isMounted = true;
    setLoadingInitial(true);

    Promise.all([
      fetchCategories({ status: 'active' }),
      fetchActiveDepartments(),
      fetchTickets({ status: 'escalated', limit: 100 }),
    ])
      .then(([catRes, deptRes, ticketRes]) => {
        if (!isMounted) return;

        const allCats: TicketCategory[] = Array.isArray(catRes.data?.data) ? catRes.data.data : [];
        const depts = deptRes.data?.data || [];
        setDepartments(depts);

        // Filter tickets to ONLY unresolved tickets escalated to Higher Authority
        const rawTickets: Ticket[] = ticketRes.data?.data || [];
        const unresolvedEscalated = rawTickets.filter(
          (t) =>
            (t.isEscalated || (t as any).is_escalated || t.status === 'escalated' || t.status?.startsWith('escalated.')) &&
            !['resolved', 'closed', 'completed'].includes(t.status)
        );
        setAllEscalatedTickets(unresolvedEscalated);

        const matchesCat = (t: Ticket, cat: TicketCategory) => {
          const catName = cat.name.toLowerCase();
          const tCat = (t.category || (t as any).categoryName || '').toLowerCase();
          const tCatId = (t as any).categoryId;
          return tCat === catName || tCatId === cat.id;
        };

        // Filter categories: ONLY categories that have tickets escalated to higher authority
        const escalatedCats = allCats.filter((cat) =>
          unresolvedEscalated.some((t) => matchesCat(t, cat))
        );

        setCategories(escalatedCats);

        // Determine initial category to select
        let initialCat: TicketCategory | null = null;
        if (urlCategory) {
          initialCat =
            escalatedCats.find(
              (c) => c.name.toLowerCase() === urlCategory.toLowerCase() || c.id === urlCategory
            ) || null;
        }

        let initialTkt: Ticket | null = null;
        if (urlTicketId) {
          const cleanId = urlTicketId.toLowerCase();
          initialTkt =
            unresolvedEscalated.find(
              (t) =>
                t.id.toLowerCase() === cleanId ||
                (t.referenceNumber && t.referenceNumber.toLowerCase() === cleanId) ||
                (t.ticketNum && String(t.ticketNum).toLowerCase() === cleanId) ||
                (t.trackNumber && t.trackNumber.toLowerCase() === cleanId)
            ) || null;

          if (initialTkt && !initialCat) {
            initialCat = escalatedCats.find((c) => matchesCat(initialTkt!, c)) || null;
          }
        }

        if (!initialCat && escalatedCats.length > 0) {
          initialCat = escalatedCats[0];
        }

        if (initialCat) {
          setSelectedCategory(initialCat);
          const isDirect = initialCat.routingType === 'direct';
          if (isDirect && initialCat.departmentId) {
            setValue('targetAudience', 'manager');
            setValue('departmentId', initialCat.departmentId);
          } else {
            setValue('targetAudience', 'admin');
            setValue('departmentId', '');
          }

          const catTickets = unresolvedEscalated.filter((t) => matchesCat(t, initialCat!));
          setTickets(catTickets);

          if (initialTkt) {
            handleSelectTicket(initialTkt, initialCat);
          }
        }
      })
      .catch((err) => console.error('Failed to load initial data:', err))
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [urlTicketId, urlCategory]);

  // When a category is chosen, calculate routing and load relevant tickets
  const handleCategoryChange = (category: TicketCategory) => {
    setSelectedCategory(category);
    setSelectedTicket(null);

    // Automated Routing Rule based on category routingType:
    // 1. If routingType is 'direct' -> routes to the department's Manager
    // 2. If routingType is 'general' -> routes to Admin
    const isDirect = category.routingType === 'direct';
    if (isDirect && category.departmentId) {
      setValue('targetAudience', 'manager');
      setValue('departmentId', category.departmentId);
    } else {
      setValue('targetAudience', 'admin');
      setValue('departmentId', '');
    }

    // Filter tickets to ONLY escalated tickets in this category
    const catTickets = allEscalatedTickets.filter(
      (t) =>
        (t.category && t.category.toLowerCase() === category.name.toLowerCase()) ||
        ((t as any).categoryId && (t as any).categoryId === category.id) ||
        ((t as any).categoryName && (t as any).categoryName.toLowerCase() === category.name.toLowerCase())
    );
    setTickets(catTickets);
  };

  // Prefill title & description from selected ticket
  const handleSelectTicket = (t: Ticket, cat = selectedCategory) => {
    if (selectedTicket?.id === t.id) {
      setSelectedTicket(null);
      return;
    }
    setSelectedTicket(t);

    const refNum = t.referenceNumber || t.id.slice(0, 8);
    setValue('title', `Executive Directive: Escalated Incident #${refNum} - ${t.title}`);

    const isDirect = cat?.routingType === 'direct';
    const targetDesc = isDirect
      ? `Department Manager of ${cat?.departmentName || t.departmentName || 'Assigned Department'}`
      : 'Central System Administration (Admin)';

    const escalationReason =
      t.operational_escalation_reason ||
      (t as any).escalationReason ||
      'Incident escalated to Higher Authority for executive review & binding directive.';

    const template = [
      `EXECUTIVE ACTION DIRECTIVE — ESCALATED INCIDENT`,
      `===============================================`,
      `Incident Reference: #${refNum}`,
      `Title: ${t.title}`,
      `Category: ${cat?.name || t.category} [${(cat?.routingType || 'GENERAL').toUpperCase()} ROUTING]`,
      `Targeted Authority: ${targetDesc}`,
      `Urgency Level: ${(t.priority || 'high').toUpperCase()} | Lifecycle: ${t.status?.toUpperCase()}`,
      t.tenantName ? `Tenant / Client: ${t.tenantName}` : '',
      t.departmentName ? `Assigned Department: ${t.departmentName}` : '',
      ``,
      `ESCALATION REASON & CONTEXT:`,
      `"${escalationReason}"`,
      ``,
      `EXECUTIVE DIRECTIVE & DECISION:`,
      `The Executive Directorate has reviewed the escalation context for Incident #${refNum}.`,
      `1. Responsible leadership must address this incident immediately and coordinate the required technical solution.`,
      `2. Direct engagement with the tenant/client is mandated with regular status reports logged in the audit trail.`,
      `3. Confirm resolution compliance within SLA escalation windows.`,
    ]
      .filter(Boolean)
      .join('\n');

    setValue('description', template);
  };

  const onSubmit = async (values: NoticeFormValues) => {
    setSaving(true);
    setServerError('');
    try {
      let finalAudience = values.targetAudience;
      let finalDeptId = values.departmentId || null;

      if (mode === 'category' && selectedCategory) {
        if (selectedCategory.routingType === 'direct' && selectedCategory.departmentId) {
          finalAudience = 'manager';
          finalDeptId = selectedCategory.departmentId;
        } else {
          finalAudience = 'admin';
          finalDeptId = null;
        }
      }

      const payload: Record<string, unknown> = {
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        status: publishIntent,
        targetAudience: finalAudience,
        departmentId: finalDeptId,
      };

      if (values.expiresAt) {
        payload.expiresAt = values.expiresAt.replace('T', ' ') + ':00';
      } else {
        payload.expiresAt = null;
      }

      await createNotice(payload);
      navigate('/ceo/notices', {
        state: {
          noticeCreated: true,
          title: values.title.trim(),
          status: publishIntent,
          targetAudience: finalAudience,
        },
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(e?.response?.data?.message || 'Failed to dispatch executive notice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.formPage}>
      <PageHeader
        title="Write Executive Notice & Directive"
        description="Dispatch binding operational notices to Admin or Department Managers based on ticket categories and active incidents."
        backTo="/ceo/notices"
      />

      {/* Mode Tabs */}
      <div className={styles.modeTabs}>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'category' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('category')}
        >
          <TagIcon style={{ width: 18, height: 18 }} />
          <span>Route by Ticket Category & Incidents</span>
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'manual' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('manual')}
        >
          <BuildingOffice2Icon style={{ width: 18, height: 18 }} />
          <span>Manual Audience Directive</span>
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {serverError && <div className={styles.errorBanner}>{serverError}</div>}

        {/* ── Category & Ticket Selection (Mode: Category) ── */}
        {mode === 'category' ? (
          loadingInitial ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading escalated incident categories...
            </div>
          ) : categories.length === 0 ? (
            <div className={styles.emptyCategoriesBanner}>
              <ShieldCheckIcon style={{ width: 32, height: 32, color: '#059669', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 750, color: '#065f46' }}>
                  No Incidents Currently Escalated to Higher Authority
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#047857', lineHeight: 1.5 }}>
                  Only ticket categories with unresolved incidents escalated to Higher Authority are shown here. All departmental tickets are currently being managed within standard operational parameters by Admin and Managers.
                </p>
                <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                  To dispatch an organizational announcement or executive policy notice without an active escalation, switch to the <strong>Manual Audience Directive</strong> tab above.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.formGroup}>
                <label htmlFor="categorySelector">
                  Select Escalated Incident Category for Automatic Role Routing *
                </label>
                <select
                  id="categorySelector"
                  value={selectedCategory?.id || ''}
                  onChange={(e) => {
                    const cat = categories.find((c) => c.id === e.target.value);
                    if (cat) handleCategoryChange(cat);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — [
                      {c.routingType === 'direct'
                        ? `🎯 DIRECT ROUTE ➔ Manager: ${c.departmentName || 'Assigned Dept'}`
                        : '⚡ GENERAL ROUTE ➔ Admin'}
                      ]
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Routing Indicator Banner */}
              {selectedCategory && (
                <div
                  className={`${styles.routingBanner} ${
                    selectedCategory.routingType === 'direct'
                      ? styles.routingBannerDirect
                      : styles.routingBannerGeneral
                  }`}
                >
                  <div className={styles.routingHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedCategory.routingType === 'direct' ? (
                        <span className={`${styles.routingBadge} ${styles.routingBadgeDirect}`}>
                          <CheckCircleIcon style={{ width: 15, height: 15 }} /> Direct Route
                        </span>
                      ) : (
                        <span className={`${styles.routingBadge} ${styles.routingBadgeGeneral}`}>
                          <BoltIcon style={{ width: 15, height: 15 }} /> General Route
                        </span>
                      )}
                      <span className={styles.routingTargetText}>
                        {selectedCategory.routingType === 'direct'
                          ? `Target: Department Manager (${selectedCategory.departmentName || 'Assigned Department'})`
                          : 'Target: Central Administration (Admin)'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.routingSub}>
                    {selectedCategory.routingType === 'direct'
                      ? `Notices under "${selectedCategory.name}" bypass general triage and are dispatched straight to the Department Head of ${selectedCategory.departmentName} for immediate resolution.`
                      : `Notices under "${selectedCategory.name}" are routed directly to System Administrators for organization-wide triage and cross-departmental coordination.`}
                  </div>
                </div>
              )}

              {/* Ticket Browser & Linking */}
              <div className={styles.ticketSection}>
                <div className={styles.ticketSectionTitle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TicketIcon style={{ width: 18, height: 18, color: '#2563eb' }} />
                    <span>Escalated Incidents Awaiting Directive ({selectedCategory?.name})</span>
                  </div>
                  {selectedTicket && (
                    <button
                      type="button"
                      className={styles.prefillBtn}
                      onClick={() => handleSelectTicket(selectedTicket)}
                      title="Clear selected ticket"
                    >
                      Clear Ticket Selection
                    </button>
                  )}
                </div>

                {tickets.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      fontSize: '0.85rem',
                      color: '#64748b',
                      background: 'rgba(0,0,0,0.02)',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    No escalated tickets under {selectedCategory?.name}. You can still dispatch an executive policy directive for this category below.
                  </div>
                ) : (
                  <div className={styles.ticketGrid}>
                    {tickets.map((t) => {
                      const isSelected = selectedTicket?.id === t.id;
                      const ref = t.referenceNumber || t.id.slice(0, 8);
                      const escReason = t.operational_escalation_reason || (t as any).escalationReason;
                      return (
                        <div
                          key={t.id}
                          className={`${styles.ticketCard} ${isSelected ? styles.ticketCardSelected : ''}`}
                          onClick={() => handleSelectTicket(t)}
                          title="Click to base executive directive on this incident"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={styles.ticketRef}>#{ref}</span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: t.priority === 'urgent' || t.priority === 'high' ? '#ef4444' : '#64748b',
                              }}
                            >
                              {t.priority}
                            </span>
                          </div>
                          <div className={styles.ticketSubject}>{t.title}</div>
                          <div className={styles.ticketMetaRow}>
                            <span>Status: {t.status}</span>
                            <span>{t.departmentName || t.tenantName || 'Internal'}</span>
                          </div>
                          {escReason && (
                            <div className={styles.ticketReasonSnippet} title={escReason}>
                              🚨 Reason: {escReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* ── Manual Audience Selection (Mode: Manual) ── */
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="targetAudience">Target Audience *</label>
              <select id="targetAudience" {...register('targetAudience')}>
                <option value="admin">System Administration (Admin)</option>
                <option value="manager">Department Managers (Manager)</option>
                <option value="all">All (Organization-wide Announcement)</option>
                <option value="staff">All Support Staff</option>
                <option value="tenant">All Tenant Organizations</option>
              </select>
            </div>

            {currentAudience === 'manager' && (
              <div className={styles.formGroup}>
                <label htmlFor="departmentId">Filter by Department (Optional / All if empty)</label>
                <select id="departmentId" {...register('departmentId')}>
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Notice Details ── */}
        <div className={styles.formGroup}>
          <label htmlFor="title">Notice Title *</label>
          <input
            id="title"
            {...register('title', {
              required: 'Title is required',
              minLength: { value: 3, message: 'Minimum 3 characters' },
            })}
            placeholder="e.g. Executive Directive: High Severity Inflow Resolution"
          />
          {errors.title && <span className={styles.fieldError}>{errors.title.message}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Directive Content & Operational Requirements *</label>
          <textarea
            id="description"
            rows={8}
            {...register('description', {
              required: 'Description is required',
              minLength: { value: 20, message: 'Description must be at least 20 characters' },
            })}
            placeholder="Specify clear instructions, deadlines, or escalation directives..."
          />
          {errors.description && (
            <span className={styles.fieldError}>{errors.description.message}</span>
          )}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="priority">Executive Priority Level</label>
            <select id="priority" {...register('priority')}>
              <option value="high">High (Executive Escalation)</option>
              <option value="medium">Medium (Standard Directive)</option>
              <option value="low">Low (Informational / Advisory)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expiresAt">Expiration Date (Optional)</label>
            <input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
          </div>
        </div>

        {/* Executive Guarantee Hint */}
        <div className={styles.hint}>
          <span className={styles.hintIcon}>👑</span>
          <span>
            Executive notices carry executive-level oversight. Once published, target role recipients
            (Admin or Department Managers) receive real-time dashboard notifications and email alerts.
            Acknowledgements are recorded in the executive governance ledger.
          </span>
        </div>

        {/* Form Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => navigate('/ceo/notices')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.btnSecondary}
            disabled={saving}
            onClick={() => setPublishIntent('draft')}
          >
            {saving && publishIntent === 'draft' ? 'Saving Draft...' : '📝 Save as Draft'}
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
            onClick={() => setPublishIntent('published')}
          >
            {saving && publishIntent === 'published' ? (
              'Publishing Directive...'
            ) : (
              <>
                <PaperAirplaneIcon style={{ width: 17, height: 17, display: 'inline', marginRight: 6 }} />
                Publish Directive Now
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
