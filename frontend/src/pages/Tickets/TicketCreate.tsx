import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketForm from '../../components/Forms/TicketForm';
import { createTicket } from '../../api/ticketApi';
import { fetchCategories } from '../../api/categoryApi';
import { searchArticles } from '../../api/knowledgeApi';
import { useAlert } from '../../context/AlertContext';
import type { TicketFormValues } from '../../types/ticket';
import type { Article } from '../../types/article';
import {
    CheckCircleIcon,
    ClipboardDocumentIcon,
    ClipboardDocumentCheckIcon,
    ArrowTopRightOnSquareIcon,
    PlusIcon,
    ListBulletIcon,
    TagIcon,
    ClockIcon,
    BuildingOffice2Icon,
    FlagIcon,
} from '@heroicons/react/24/outline';
import styles from './Tickets.module.css';

interface CategoryOption {
    id: string;
    name: string;
}

interface CreatedTicketInfo {
    id: string;
    referenceNumber: string;
    trackNumber?: string;
    title: string;
    category: string;
    priority: string;
    departmentName?: string;
    status: string;
    createdAt?: string;
}

export default function TicketCreate() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useAlert();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [createdTicket, setCreatedTicket] = useState<CreatedTicketInfo | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [suggested, setSuggested] = useState<Article[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        fetchCategories()
            .then((res) => {
                const items = res.data.data.map((c: any) => ({ id: c.id, name: c.name }));
                if (items.length) setCategories(items);
            })
            .catch(() => { });
    }, []);

    const handleSearchKnowledge = async (query: string) => {
        if (query.length < 4) {
            setSuggested([]);
            setShowSuggestions(false);
            return;
        }
        try {
            const res = await searchArticles(query, 5);
            const articles = (res.data.data || []).filter((a) => a.status === 'published' && ['tenant', 'public'].includes(a.visibility));
            setSuggested(articles);
            setShowSuggestions(articles.length > 0);
        } catch {
            setSuggested([]);
            setShowSuggestions(false);
        }
    };

    const handleUseArticle = (articleId: string) => {
        setShowSuggestions(false);
        setSuggested([]);
        navigate(`/tenant/knowledge/${articleId}`);
    };

    const handleCopyRef = () => {
        if (!createdTicket?.referenceNumber) return;
        navigator.clipboard.writeText(createdTicket.referenceNumber);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2500);
    };

    const onSubmit = async (values: TicketFormValues) => {
        setError(null);
        setSuccess(null);
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', values.title);
            formData.append('description', values.description);
            formData.append('category', values.category);
            formData.append('priority', values.priority);
            if (values.departmentId) formData.append('departmentId', values.departmentId);

            if (values.attachments) {
                Array.from(values.attachments).forEach((file) => {
                    formData.append('attachments', file);
                });
            }

            const res = await createTicket(formData);
            const ticketData = res.data?.data || {};
            const refNumber = ticketData.referenceNumber || ticketData.reference_number || 'New Ticket';
            const targetRef = ticketData.referenceNumber || ticketData.reference_number || (ticketData.ticketNum ? String(ticketData.ticketNum) : ticketData.id);

            setCreatedTicket({
                id: ticketData.id || targetRef,
                referenceNumber: refNumber,
                trackNumber: ticketData.trackNumber || ticketData.track_number || '',
                title: ticketData.title || values.title,
                category: ticketData.category || values.category,
                priority: ticketData.priority || values.priority,
                departmentName: ticketData.departmentName || ticketData.department_name || '',
                status: ticketData.status || 'open',
                createdAt: ticketData.createdAt || ticketData.created_at || new Date().toISOString(),
            });

            const successMsg = `Ticket ${refNumber} has been created successfully!`;
            setSuccess(successMsg);
            showSuccess(successMsg, 'Ticket Created');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            console.error('[TicketCreate] Submission failed:', err);
            const serverMsg = err.response?.data?.message || err.response?.data?.error || err.message;
            let errMsg = 'Failed to submit help request. Please check your network connection and try again.';
            if (err.response?.status === 413) {
                errMsg = 'Attached files are too large. Maximum allowed upload size is 10MB.';
            } else if (serverMsg) {
                errMsg = `Failed to submit help request: ${serverMsg}`;
            }
            setError(errMsg);
            showError(errMsg, 'Submission Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <PageHeader
                title="Submit Help Request"
                description="Describe your issue and attach supporting files if needed."
                backTo="/tenant/tickets"
            />

            {/* Error Alert */}
            {error && (
                <div className={`${styles.toast} ${styles.error}`} role="alert">
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span style={{ flex: 1 }}>{error}</span>
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Structured Created Ticket Alert Form */}
            {createdTicket && (
                <div className={styles.createdAlertCard} role="alert" aria-live="polite">
                    <div className={styles.createdAlertHeader}>
                        <div className={styles.createdAlertHeaderLeft}>
                            <div className={styles.createdAlertIconBox}>
                                <CheckCircleIcon className={styles.createdAlertIcon} />
                            </div>
                            <div>
                                <h3 className={styles.createdAlertTitle}>
                                    Ticket Created Successfully!
                                </h3>
                                <p className={styles.createdAlertSubtitle}>
                                    Your help request has been created and registered with reference code <strong>{createdTicket.referenceNumber}</strong>.
                                </p>
                            </div>
                        </div>
                        <div>
                            <span className={styles.createdStatusBadge}>
                                <CheckCircleIcon style={{ width: 16, height: 16 }} />
                                Created
                            </span>
                        </div>
                    </div>

                    {/* Alert Form Details Grid */}
                    <div className={styles.createdAlertGrid}>
                        <div className={styles.createdAlertItem}>
                            <span className={styles.createdAlertLabel}>
                                <TagIcon style={{ width: 14, height: 14 }} />
                                Ticket Reference ID
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className={styles.createdAlertRefCode}>
                                    {createdTicket.referenceNumber}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopyRef}
                                    className={styles.createdAlertCopyBtn}
                                    title="Copy Reference ID"
                                >
                                    {copiedRef ? (
                                        <ClipboardDocumentCheckIcon style={{ width: 18, height: 18, color: '#10b981' }} />
                                    ) : (
                                        <ClipboardDocumentIcon style={{ width: 18, height: 18 }} />
                                    )}
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, marginLeft: 4 }}>
                                        {copiedRef ? 'Copied!' : 'Copy'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {createdTicket.trackNumber && (
                            <div className={styles.createdAlertItem}>
                                <span className={styles.createdAlertLabel}>
                                    <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
                                    Tracking Code
                                </span>
                                <span className={styles.createdAlertValue} style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                                    {createdTicket.trackNumber}
                                </span>
                            </div>
                        )}

                        <div className={styles.createdAlertItem}>
                            <span className={styles.createdAlertLabel}>
                                <TagIcon style={{ width: 14, height: 14 }} />
                                Subject / Title
                            </span>
                            <span className={styles.createdAlertValue}>
                                {createdTicket.title}
                            </span>
                        </div>

                        <div className={styles.createdAlertItem}>
                            <span className={styles.createdAlertLabel}>
                                <TagIcon style={{ width: 14, height: 14 }} />
                                Category
                            </span>
                            <span className={styles.createdAlertValue}>
                                {createdTicket.category || 'General'}
                            </span>
                        </div>

                        <div className={styles.createdAlertItem}>
                            <span className={styles.createdAlertLabel}>
                                <FlagIcon style={{ width: 14, height: 14 }} />
                                Priority
                            </span>
                            <span className={styles.createdAlertValue} style={{ textTransform: 'capitalize' }}>
                                {createdTicket.priority}
                            </span>
                        </div>

                        {createdTicket.departmentName && (
                            <div className={styles.createdAlertItem}>
                                <span className={styles.createdAlertLabel}>
                                    <BuildingOffice2Icon style={{ width: 14, height: 14 }} />
                                    Assigned Department
                                </span>
                                <span className={styles.createdAlertValue}>
                                    {createdTicket.departmentName}
                                </span>
                            </div>
                        )}

                        <div className={styles.createdAlertItem}>
                            <span className={styles.createdAlertLabel}>
                                <ClockIcon style={{ width: 14, height: 14 }} />
                                Created At
                            </span>
                            <span className={styles.createdAlertValue}>
                                {new Date(createdTicket.createdAt || Date.now()).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Alert Form Action Buttons */}
                    <div className={styles.createdAlertActions}>
                        <button
                            type="button"
                            className={styles.btnAlertPrimary}
                            onClick={() => navigate(`/tenant/tickets/${createdTicket.referenceNumber || createdTicket.id}`)}
                        >
                            <ArrowTopRightOnSquareIcon style={{ width: 18, height: 18 }} />
                            View Created Ticket
                        </button>
                        <button
                            type="button"
                            className={styles.btnAlertSecondary}
                            onClick={() => {
                                setCreatedTicket(null);
                                setSuccess(null);
                                setFormKey((k) => k + 1);
                            }}
                        >
                            <PlusIcon style={{ width: 18, height: 18 }} />
                            + Create Another Ticket
                        </button>
                        <button
                            type="button"
                            className={styles.btnAlertOutline}
                            onClick={() => navigate('/tenant/tickets')}
                        >
                            <ListBulletIcon style={{ width: 18, height: 18 }} />
                            Go to My Tickets
                        </button>
                    </div>
                </div>
            )}

            {showSuggestions && suggested.length > 0 && !createdTicket && (
                <div className={styles.kbSuggestions}>
                    <h4>Suggested Knowledge Base Articles</h4>
                    <p className={styles.kbNote}>Before creating a ticket, check if these articles help:</p>
                    <ul>
                        {suggested.map((article) => (
                            <li key={article.id}>
                                <button type="button" className={styles.kbLink} onClick={() => handleUseArticle(article.id)}>
                                    <strong>{article.title}</strong>
                                    <span>{article.articleReference}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className={styles.kbDismiss} onClick={() => setShowSuggestions(false)}>
                        Continue creating ticket
                    </button>
                </div>
            )}

            <TicketForm
                key={formKey}
                categories={categories}
                onSubmit={onSubmit}
                onCancel={() => navigate('/tenant/tickets')}
                loading={loading}
                onSearchKnowledge={handleSearchKnowledge}
                suggestedArticles={suggested}
                onUseArticle={handleUseArticle}
            />
        </div>
    );
}
