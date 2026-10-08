import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import { createFeedback } from '../../api/feedbackApi';
import { fetchTickets } from '../../api/ticketApi';
import type { FeedbackFormValues } from '../../types/feedback';
import type { Ticket } from '../../types/ticket';
import styles from './FeedbackCreate.module.css';

type FormValues = {
  ticketId: string;
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
      ticketId: '',
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const ticketId = watch('ticketId');
  const selectedTicket = tickets.find(t => t.id === ticketId);
  const feedbackFocus = watch('feedbackFocus');
  const rating = watch('rating');

  useEffect(() => {
    fetchTickets({ status: '', page: 1, limit: 100 })
      .then(res => setTickets(res.data.data))
      .catch(() => {});
  }, []);

  const onSubmit = async (values: FormValues) => {
    setMessage('');
    setError('');
    try {
      await createFeedback({
        ticketId: values.ticketId || undefined,
        subject: values.subject,
        message: values.message,
        feedbackType: values.feedbackType,
        rating: values.rating || undefined,
        whatShouldChange: values.whatShouldChange || undefined,
        whatIsCorrect: values.feedbackFocus === 'wrong' ? undefined : (values.whatIsCorrect || undefined),
        whatIsWrong: values.feedbackFocus === 'correct' ? undefined : (values.whatIsWrong || undefined),
        howItShouldGo: values.howItShouldGo || undefined,
      });
      navigate('/tenant/feedback');
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
          <h2 className={styles.cardTitle}>Ticket Information</h2>
          <div className={styles.field}>
            <label htmlFor="ticketId">Select Ticket</label>
            <select id="ticketId" {...register('ticketId', { required: true })}>
              <option value="">-- Select a ticket --</option>
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
              </div>
            )}
          </div>

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