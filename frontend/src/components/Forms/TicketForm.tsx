import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import type { TicketFormValues, TicketPriority } from '../../types/ticket';
import { DEFAULT_CATEGORIES, TICKET_PRIORITIES } from '../../types/ticket';
import { previewSLA, type SLAPreview } from '../../api/slaApi';
import styles from './TicketForm.module.css';

type CategoryOption = { id: string; name: string } | string;

type Props = {
  onSubmit: (values: TicketFormValues) => Promise<void>;
  loading?: boolean;
  onCancel?: () => void;
  categories?: CategoryOption[];
  departments?: { id: string; name: string }[];
  onSearchKnowledge?: (query: string) => void;
  suggestedArticles?: { id: string; title: string; articleReference: string }[];
  onUseArticle?: (articleId: string) => void;
};

function formatSize(bytes: number): string {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function TicketForm({
  onSubmit,
  loading,
  onCancel,
  categories = DEFAULT_CATEGORIES,
  departments = [],
  onSearchKnowledge,
  suggestedArticles = [],
  onUseArticle,
}: Props) {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<TicketFormValues>({
    defaultValues: {
      title: '',
      description: '',
      category: typeof categories[0] === 'string' ? categories[0] || 'General Inquiry' : (categories[0] as any)?.name || 'General Inquiry',
      priority: 'medium',
    },
  });

  const [slaPreview, setSlaPreview] = useState<SLAPreview | null>(null);
  const [loadingSla, setLoadingSla] = useState(false);

  const watchedCategory = watch('category');
  const watchedPriority = watch('priority');
  const watchedAttachments = watch('attachments');
  const watchedTitle = watch('title');
  const watchedDescription = watch('description');

  useEffect(() => {
    if (onSearchKnowledge) {
      const query = [watchedTitle, watchedDescription].filter(Boolean).join(' ').trim();
      if (query.length > 3) {
        onSearchKnowledge(query);
      }
    }
  }, [watchedTitle, watchedDescription, onSearchKnowledge]);

  useEffect(() => {
    const loadSLA = async () => {
      if (!watchedCategory || !watchedPriority) {
        setSlaPreview(null);
        return;
      }
      setLoadingSla(true);
      try {
        const catObj = categories.find((c) => typeof c === 'string' ? c === watchedCategory : (c as any).name === watchedCategory);
        const categoryId = typeof catObj === 'object' && catObj ? catObj.id : undefined;
        const res = await previewSLA({ categoryId, priority: watchedPriority });
        setSlaPreview(res.data.data);
      } catch {
        setSlaPreview(null);
      } finally {
        setLoadingSla(false);
      }
    };
    loadSLA();
  }, [watchedCategory, watchedPriority, categories]);

  const getCategoryValue = (cat: CategoryOption) => typeof cat === 'string' ? cat : cat.name;
  const getCategoryId = (catName: string) => {
    const catObj = categories.find((c) => typeof c === 'string' ? c === catName : (c as any).name === catName);
    return typeof catObj === 'object' && catObj ? catObj.id : undefined;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Ticket details */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Ticket Details</h3>

        <div className={`${styles.field} ${errors.title ? styles.fieldError : ''}`}>
          <label htmlFor="title">
            Title <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="e.g. Unable to access email account"
            {...register('title', { required: true, minLength: 3 })}
          />
          {errors.title && <span className={styles.error}>Title is required (min 3 characters)</span>}
        </div>

        <div className={styles.grid}>
          <div className={`${styles.field} ${errors.category ? styles.fieldError : ''}`}>
            <label htmlFor="category">
              Category <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <select id="category" {...register('category', { required: true })}>
              {categories.map((cat) => (
                <option key={getCategoryValue(cat)} value={getCategoryValue(cat)}>{getCategoryValue(cat)}</option>
              ))}
            </select>
            {errors.category && <span className={styles.error}>Please select a category</span>}
          </div>

          <div className={`${styles.field} ${errors.priority ? styles.fieldError : ''}`}>
            <label htmlFor="priority">
              Priority <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <select id="priority" {...register('priority', { required: true })}>
              {TICKET_PRIORITIES.map((p: TicketPriority) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            {errors.priority && <span className={styles.error}>Please select a priority</span>}
          </div>
        </div>

        {departments.length > 0 && (
          <div className={styles.field}>
            <label htmlFor="departmentId">Department (optional)</label>
            <select id="departmentId" {...register('departmentId')}>
              <option value="">Auto-assign</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Description */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Describe the Issue</h3>
        <div className={`${styles.field} ${errors.description ? styles.fieldError : ''}`}>
          <label htmlFor="description">
            Description <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <textarea
            id="description"
            rows={6}
            placeholder="Provide as much detail as possible — what happened, when, and any error messages."
            {...register('description', { required: true })}
          />
          {errors.description && <span className={styles.error}>Description is required</span>}
        </div>
      </div>

      <hr className={styles.divider} />

      {/* Attachments */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Attachments</h3>
        <label
          className={styles.fileDrop}
          htmlFor="attachments"
          aria-label="Attach supporting files (optional, maximum 5 files)"
        >
          <span className={styles.fileIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </span>
          <p className={styles.fileText}>Click to upload supporting files</p>
          <p className={styles.fileSub}>PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG · Max 5 files · 10 MB each</p>
          <input
            id="attachments"
            className={styles.fileInput}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            {...register('attachments')}
          />
        </label>

        {watchedAttachments && watchedAttachments.length > 0 && (
          <ul className={styles.preview}>
            {Array.from(watchedAttachments).map((file, idx) => (
              <li key={`${file.name}-${idx}`} className={styles.previewItem}>
                <span className={styles.previewIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <span className={styles.previewName} title={file.name}>{file.name}</span>
                <span className={styles.previewSize}>{formatSize(file.size)}</span>
                <button
                  type="button"
                  className={styles.previewRemove}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => {
                    const list = Array.from(watchedAttachments).filter((_, i) => i !== idx);
                    setValue('attachments', list as unknown as FileList, { shouldValidate: true });
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* SLA transparency card */}
      {slaPreview && (
        <div className={styles.slaPreview}>
          <h4>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Service Level Agreement
          </h4>
          <div className={styles.slaGrid}>
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>Category</span>
              <span className={styles.slaValue}>{slaPreview.category}</span>
            </div>
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>Priority</span>
              <span className={styles.slaValue}>{slaPreview.priority}</span>
            </div>
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>First Response</span>
              <span className={styles.slaValue}>{slaPreview.responseHours} Hour(s)</span>
            </div>
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>Resolution Time</span>
              <span className={styles.slaValue}>{slaPreview.resolutionHours} Hour(s)</span>
            </div>
            {Boolean(slaPreview.escalationHours && slaPreview.escalationHours > 0) && (
              <div className={styles.slaItem}>
                <span className={styles.slaLabel}>Escalation After</span>
                <span className={styles.slaValue}>{slaPreview.escalationHours} Hour(s)</span>
              </div>
            )}
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>Response Due</span>
              <span className={styles.slaValue}>{formatDate(slaPreview.responseDueDate)}</span>
            </div>
            <div className={styles.slaItem}>
              <span className={styles.slaLabel}>Resolution Due</span>
              <span className={styles.slaValue}>{formatDate(slaPreview.resolutionDueDate)}</span>
            </div>
            {slaPreview.escalationDueDate && (
              <div className={styles.slaItem}>
                <span className={styles.slaLabel}>Escalation Due</span>
                <span className={styles.slaValue}>{formatDate(slaPreview.escalationDueDate)}</span>
              </div>
            )}
            <div className={`${styles.slaItem} ${styles.slaFullWidth}`}>
              <span className={styles.slaLabel}>Agreement Status</span>
              <span className={`${styles.slaValue} ${styles.slaAccepted}`}>
                ✓ Auto-accepted on submission
              </span>
            </div>
          </div>
          <p className={styles.slaNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            By submitting this ticket, you automatically accept the SLA terms for the selected category and priority. This ensures transparency and sets clear expectations for response and resolution times.
          </p>
        </div>
      )}

      {loadingSla && (
        <div className={styles.slaLoading}>
          <span className={styles.spinner} aria-hidden="true" />
          Loading SLA information…
        </div>
      )}

      {suggestedArticles.length > 0 && (
        <div className={styles.kbSuggestions}>
          <h4>Suggested Knowledge Base Articles</h4>
          <p className={styles.kbNote}>Before creating a ticket, check if these articles help:</p>
          <ul>
            {suggestedArticles.map((article) => (
              <li key={article.id}>
                <button type="button" className={styles.kbLink} onClick={() => onUseArticle?.(article.id)}>
                  <strong>{article.title}</strong>
                  <span>{article.articleReference}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Submitting…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Submit Ticket
            </>
          )}
        </button>
      </div>
    </form>
  );
}
