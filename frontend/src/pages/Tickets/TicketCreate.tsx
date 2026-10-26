import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketForm from '../../components/Forms/TicketForm';
import { createTicket } from '../../api/ticketApi';
import { fetchCategories } from '../../api/categoryApi';
import { searchArticles } from '../../api/knowledgeApi';
import type { TicketFormValues } from '../../types/ticket';
import type { Article } from '../../types/article';
import styles from './Tickets.module.css';

interface CategoryOption {
    id: string;
    name: string;
}

export default function TicketCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
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

    const onSubmit = async (values: TicketFormValues) => {
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
            const shortId = res.data.data.ticketNum ? String(res.data.data.ticketNum) : (res.data.data.referenceNumber || res.data.data.id);
            navigate(`/tenant/tickets/${shortId}`);
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
            {showSuggestions && suggested.length > 0 && (
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
