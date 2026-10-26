import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import { sendDirectEmail } from '../../api/userApi';
import styles from './ContactModal.module.css';
import {
  EnvelopeIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export interface ContactTarget {
  email: string;
  name?: string;
  roleOrType?: string;
}

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  target: ContactTarget | null;
  defaultSubject?: string;
}

const TEMPLATES = [
  { label: 'Account Update', subject: 'Important Notice regarding your DMS Account', body: 'Hello,\n\nWe are contacting you regarding your Help Desk Management System account status and recent updates.\n\nPlease log in to review your notifications.' },
  { label: 'Service Notice', subject: 'DMS Service Update & System Maintenance', body: 'Hello,\n\nPlease be informed of our scheduled service maintenance and platform operations.\n\nThank you for your cooperation.' },
  { label: 'Follow-up', subject: 'Follow-up regarding your Support Inquiries', body: 'Hello,\n\nOur administration team is following up on your pending support items.\n\nPlease let us know if you require any further assistance.' },
];

export default function ContactModal({ open, onClose, target, defaultSubject = '' }: ContactModalProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject || (target?.name ? `Notice for ${target.name} — DMS Help Desk` : 'Notice from DMS Help Desk'));
      setMessage('');
      setStatusFeedback(null);
      setCopied(false);
    }
  }, [open, target, defaultSubject]);

  if (!open || !target) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(target.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setSubject(t.subject);
    setMessage(t.body);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setStatusFeedback({
        type: 'error',
        text: 'Please provide both a subject and message body before sending.',
      });
      return;
    }

    setSending(true);
    setStatusFeedback(null);

    try {
      const res = await sendDirectEmail({
        to: target.email,
        toName: target.name,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (res.data?.data?.simulated) {
        setStatusFeedback({
          type: 'warning',
          text: res.data?.message || 'Email registered in development environment. (For live delivery to inboxes, Google requires a 16-character App Password).',
        });
      } else {
        setStatusFeedback({
          type: 'success',
          text: `Email successfully dispatched to ${target.email}!`,
        });
        setTimeout(() => {
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to dispatch email';
      setStatusFeedback({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setSending(false);
    }
  };

  const mailtoUrl = `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Email Message"
      maxWidth="620px"
    >
      <form onSubmit={handleSend} className={styles.modalContainer}>
        {/* Recipient & Sender Card */}
        <div className={styles.metaCard}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>
              <UserIcon className={styles.metaLabelIcon} />
              To:
            </span>
            <div className={styles.metaValue}>
              <span className={styles.recipientPill}>
                <EnvelopeIcon style={{ width: 14, height: 14 }} />
                <span>{target.email}</span>
              </span>
              {target.name && (
                <span style={{ color: '#475569', fontSize: '0.85rem' }}>
                  ({target.name})
                </span>
              )}
              <button
                type="button"
                className={styles.copyBtn}
                onClick={handleCopyEmail}
                title="Copy recipient email"
              >
                {copied ? (
                  <ClipboardDocumentCheckIcon style={{ width: 16, height: 16, color: '#10b981' }} />
                ) : (
                  <ClipboardDocumentIcon style={{ width: 16, height: 16 }} />
                )}
              </button>
            </div>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>
              <EnvelopeIcon className={styles.metaLabelIcon} />
              From:
            </span>
            <div className={styles.metaValue}>
              <span className={styles.senderPill}>
                <span>demshuterefe94@gmail.com</span>
                <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(DMS Mailer)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Templates */}
        <div className={styles.templatesRow}>
          <span className={styles.templatesLabel}>Quick Templates:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              className={styles.templateChip}
              onClick={() => applyTemplate(t)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Subject field */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="email-subject">
            Subject *
          </label>
          <input
            id="email-subject"
            type="text"
            className={styles.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Account Notification or Support Update"
            required
          />
        </div>

        {/* Message body field */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="email-message">
            Message *
          </label>
          <textarea
            id="email-message"
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            required
          />
        </div>

        {/* Feedback alerts */}
        {statusFeedback && (
          <div>
            {statusFeedback.type === 'success' && (
              <div className={styles.successAlert}>
                <CheckCircleIcon className={styles.alertIcon} />
                <span>{statusFeedback.text}</span>
              </div>
            )}
            {statusFeedback.type === 'warning' && (
              <div className={styles.warningAlert}>
                <ExclamationTriangleIcon className={styles.alertIcon} />
                <span>{statusFeedback.text}</span>
              </div>
            )}
            {statusFeedback.type === 'error' && (
              <div className={styles.errorAlert}>
                <ExclamationTriangleIcon className={styles.alertIcon} />
                <span>{statusFeedback.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className={styles.footerActions}>
          <div className={styles.secondaryOptions}>
            <a
              href={mailtoUrl}
              className={styles.externalLinkBtn}
              title="Open message draft in your system desktop mail client (e.g. Outlook)"
            >
              <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
              <span>Open in Desktop Mail</span>
            </a>
          </div>

          <div className={styles.primaryButtons}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={sending || !subject.trim() || !message.trim()}
            >
              {sending ? (
                <>
                  <span className={styles.spinner} />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <PaperAirplaneIcon style={{ width: 16, height: 16 }} />
                  <span>Send Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
