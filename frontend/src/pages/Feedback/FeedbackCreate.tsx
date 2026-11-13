import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { createFeedback } from '../../api/feedbackApi';
import { fetchTickets } from '../../api/ticketApi';
import { fetchCategories, type TicketCategory } from '../../api/categoryApi';
import { fetchArticles } from '../../api/knowledgeApi';
import type { Article } from '../../types/article';
import type { FeedbackFormValues } from '../../types/feedback';
import type { Ticket } from '../../types/ticket';
import styles from './FeedbackCreate.module.css';

type FormValues = {
  targetType: 'ticket' | 'knowledge';
  ticketId: string;
  articleId: string;
  categoryId: string;
  serviceName: string;
  subject: string;
  message: string;
  feedbackType: 'suggestion' | 'complaint' | 'improvement' | 'bug' | 'other';
  feedbackFocus: 'correct' | 'wrong' | 'both';
  rating: number;
  whatShouldChange?: string;
  whatIsCorrect?: string;
  whatIsWrong?: string;
  howItShouldGo?: string;
};

const FEEDBACK_TYPES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'other', label: 'Other' },
] as const;

const FOCUS_OPTIONS = [
  { value: 'correct', label: 'What is Correct' },
  { value: 'wrong', label: 'What is Wrong' },
  { value: 'both', label: 'Both' },
] as const;

export default function FeedbackCreate() {
  const navigate = useNavigate();
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting, errors } } = useForm<FormValues>({
    defaultValues: {
      targetType: 'ticket',
      ticketId: '',
      articleId: '',
      categoryId: '',
      serviceName: '',
      subject: '',
      message: '',
      feedbackType: 'suggestion',
      feedbackFocus: 'both',
      rating: 0,
      whatShouldChange: '',
      whatIsCorrect: '',
      whatIsWrong: '',
      howItShouldGo: '',
    },
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const targetType = watch('targetType');
  const ticketId = watch('ticketId');
  const articleId = watch('articleId');
  const categoryId = watch('categoryId');
  const selectedTicket = tickets.find(t => t.id === ticketId);
  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedArticle = articles.find(a => a.id === articleId);
  const feedbackFocus = watch('feedbackFocus');
  const rating = watch('rating');

  useEffect(() => {
    fetchTickets({ status: '', page: 1, limit: 100 })
      .then(res => setTickets(res.data.data))
      .catch(() => {});
    fetchCategories({ includeInactive: false })
      .then(res => setCategories(res.data.data || []))
      .catch(() => {});
    fetchArticles({ status: 'published', limit: 100 })
      .then(res => setArticles(res.data.data || []))
      .catch(() => {});
  }, []);

  // Sync category & service when a ticket is selected
  useEffect(() => {
    if (selectedTicket) {
      if (selectedTicket.category) {
        const matched = categories.find(c => c.name.toLowerCase() === selectedTicket.category?.toLowerCase());
        if (matched) {
          setValue('categoryId', matched.id);
          setValue('serviceName', matched.name);
        } else {
          setValue('serviceName', selectedTicket.category);
        }
      }
    }
  }, [selectedTicket, categories, setValue]);

  const onSubmit = async (values: FormValues) => {
    setMessage('');
    setError('');
    try {
      await createFeedback({
        ticketId: values.targetType === 'ticket' ? (values.ticketId || undefined) : undefined,
        articleId: values.targetType === 'knowledge' ? (values.articleId || undefined) : undefined,
        categoryId: values.targetType === 'ticket' ? (values.categoryId || undefined) : undefined,
        serviceName: values.targetType === 'knowledge' ? (values.serviceName || 'Knowledge Base') : (values.serviceName || undefined),
        subject: values.subject,
        message: values.message,
        feedbackType: values.feedbackType,
        rating: values.rating || undefined,
        whatShouldChange: values.whatShouldChange || undefined,
        whatIsCorrect: values.feedbackFocus === 'wrong' ? undefined : (values.whatIsCorrect || undefined),
        whatIsWrong: values.feedbackFocus === 'correct' ? undefined : (values.whatIsWrong || undefined),
        howItShouldGo: values.howItShouldGo || undefined,
      });
      navigate('/tenant/feedback', {
        state: {
          alert: {
            type: 'success',
            message: 'Feedback submitted successfully',
            title: 'Feedback Submitted',
          },
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit feedback');
    }
  };

  const showCorrect = feedbackFocus === 'correct' || feedbackFocus === 'both';
  const showWrong = feedbackFocus === 'wrong' || feedbackFocus === 'both';

  return (
    <div className={styles.page}>
      <PageHeader
        title="New Feedback"
        description="Submit feedback about a ticket. Be specific about what needs to change."
        backTo="/tenant/feedback"
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={styles.errorToast}>{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Feedback Subject & Target Context</h2>

          {/* Feedback Target Switcher */}
          <div className={styles.field}>
            <label style={{ fontWeight: 600 }}>What are you submitting feedback on?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: targetType === 'ticket' ? 700 : 500 }}>
                <input
                  type="radio"
                  name="targetTypeSelection"
                  checked={targetType === 'ticket'}
                  onChange={() => {
                    setValue('targetType', 'ticket');
                    setValue('articleId', '');
                  }}
                />
                🎫 Service Ticket or Category
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: targetType === 'knowledge' ? 700 : 500 }}>
                <input
                  type="radio"
                  name="targetTypeSelection"
                  checked={targetType === 'knowledge'}
                  onChange={() => {
                    setValue('targetType', 'knowledge');
                    setValue('ticketId', '');
                    setValue('serviceName', 'Knowledge Base');
                    setValue('subject', 'Feedback on Knowledge Base');
                  }}
                />
                📚 Knowledge Base & Articles
              </label>
            </div>
          </div>

          {targetType === 'knowledge' ? (
            <>
              <div className={styles.field}>
                <label htmlFor="articleId">Knowledge Base Article (optional)</label>
                <select
                  id="articleId"
                  {...register('articleId')}
                  onChange={(e) => {
                    setValue('articleId', e.target.value);
                    const art = articles.find(a => a.id === e.target.value);
                    if (art) {
                      setValue('subject', `Feedback on Article: ${art.title}`);
                      setValue('serviceName', `Knowledge Base - ${art.category || 'Documentation'}`);
                    }
                  }}
                >
                  <option value="">-- General Knowledge Base Feedback (or choose specific article) --</option>
                  {articles.map((art) => (
                    <option key={art.id} value={art.id}>
                      [{art.articleReference || 'KB-ARTICLE'}] {art.title} {art.category ? `(${art.category})` : ''}
                    </option>
                  ))}
                </select>
                {selectedArticle && (
                  <div className={styles.ticketInfo}>
                    <span><strong>Article Ref:</strong> {selectedArticle.articleReference || 'KB'}</span>
                    <span><strong>Category:</strong> {selectedArticle.category || 'General'}</span>
                    {selectedArticle.departmentName && <span><strong>Department:</strong> {selectedArticle.departmentName}</span>}
                  </div>
                )}
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#0284c7' }}>
                  💡 Submit your evaluation for authors to know what is helpful and what should be changed.
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="serviceName">Documentation Section or Topic</label>
                <input
                  id="serviceName"
                  {...register('serviceName')}
                  placeholder="e.g. Knowledge Base, Tenant Portal Guide, Troubleshooting FAQs..."
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor="categoryId">Ticket Category / Service Department</label>
                <select
                  id="categoryId"
                  {...register('categoryId')}
                  onChange={(e) => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setValue('categoryId', e.target.value);
                    if (cat) {
                      setValue('serviceName', cat.name);
                    }
                  }}
                >
                  <option value="">-- Choose Ticket Category / Service --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.departmentName ? `(${c.departmentName})` : ''}
                    </option>
                  ))}
                </select>
                {selectedCategory && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                    ⚡ Linked Department: {selectedCategory.departmentName || 'Responsible Department'}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="serviceName">Specific Service Detail (optional)</label>
                <input
                  id="serviceName"
                  {...register('serviceName')}
                  placeholder="e.g. Inverter Backup, Water Supply, Network Connectivity..."
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="ticketId">Associated Ticket (optional)</label>
                <select id="ticketId" {...register('ticketId')}>
                  <option value="">-- Select an associated ticket (optional) --</option>
                  {tickets.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.referenceNumber}] {t.title} - {t.status}
                    </option>
                  ))}
                </select>
                {selectedTicket && (
                  <div className={styles.ticketInfo}>
                    <span><strong>Reference:</strong> {selectedTicket.referenceNumber}</span>
                    <span><strong>Status:</strong> {selectedTicket.status}</span>
                    <span><strong>Priority:</strong> {selectedTicket.priority}</span>
                    {selectedTicket.category && <span><strong>Category:</strong> {selectedTicket.category}</span>}
                  </div>
                )}
              </div>
            </>
          )}

          <div className={styles.field}>
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              {...register('subject', { required: true, minLength: 3, maxLength: 200 })}
              placeholder="Brief summary of your feedback"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="message">Overall Feedback</label>
            <textarea
              id="message"
              rows={4}
              {...register('message', { required: 'Feedback message is required', minLength: { value: 50, message: 'Message must be at least 50 characters' } })}
              placeholder="Describe your overall feedback about this ticket..."
            />
            {errors.message && <span className={styles.fieldError}>{errors.message.message}</span>}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Rating & Assessment</h2>

          <div className={styles.field}>
            <label>Service Rating</label>
            <div className={styles.starRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`${styles.star} ${star <= (hoverRating || rating) ? styles.starFilled : ''}`}
                  onClick={() => setValue('rating', star, { shouldValidate: true })}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
              <span className={styles.ratingText}>
                {rating ? `${rating} / 5` : 'Select a rating'}
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="feedbackType">Feedback Type</label>
            <select id="feedbackType" {...register('feedbackType')}>
              {FEEDBACK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Feedback Focus</label>
            <div className={styles.focusSelector}>
              {FOCUS_OPTIONS.map((option) => (
                <label key={option.value} className={styles.focusOption}>
                  <input
                    type="radio"
                    value={option.value}
                    {...register('feedbackFocus')}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {showCorrect && (
            <div className={styles.field}>
              <label htmlFor="whatIsCorrect">What is Correct / Working Well</label>
              <textarea
                id="whatIsCorrect"
                rows={3}
                {...register('whatIsCorrect')}
                placeholder="Describe what aspects are working correctly..."
              />
            </div>
          )}

          {showWrong && (
            <div className={styles.field}>
              <label htmlFor="whatIsWrong">What is Wrong / Needs Improvement</label>
              <textarea
                id="whatIsWrong"
                rows={3}
                {...register('whatIsWrong')}
                placeholder="Describe what is wrong or needs improvement..."
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="whatShouldChange">What Should Be Changed</label>
            <textarea
              id="whatShouldChange"
              rows={3}
              {...register('whatShouldChange')}
              placeholder="Describe the specific changes needed..."
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="howItShouldGo">How It Should Work</label>
            <textarea
              id="howItShouldGo"
              rows={3}
              {...register('howItShouldGo')}
              placeholder="Describe how the process or system should work..."
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => navigate('/tenant/feedback')} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  );
}