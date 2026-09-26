import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../api/ticketApi';
import type { NotificationItem } from '../../types/ticket';
import { useAuth } from '../../context/AuthContext';
import styles from './NotificationsPage.module.css';

const chatPaths: Record<string, string> = {
  admin: '/admin/chat',
  manager: '/manager/chat',
  staff: '/staff/chat',
  tenant: '/tenant/chat',
  ceo: '/ceo/chat',
};

const noticePaths: Record<string, string> = {
  admin: '/admin/notices',
  manager: '/manager/notices',
  staff: '/staff/notices',
  tenant: '/tenant/notices',
  ceo: '/ceo/notices',
};

const basePaths: Record<string, string> = {
  admin: '/admin/tickets',
  manager: '/manager/tickets',
  staff: '/staff/tickets',
  tenant: '/tenant/tickets',
  ceo: '/ceo/tickets',
};

type FilterType = 'all' | 'unread' | 'chat' | 'ticket' | 'notice';

interface NotifConfig {
  icon: string;
  label: string;
  colorClass: string;
}

const notifConfig: Record<string, NotifConfig> = {
  chat:       { icon: '💬', label: 'Chat',         colorClass: 'colorChat' },
  message:    { icon: '💬', label: 'Message',      colorClass: 'colorChat' },
  ticket:     { icon: '🎫', label: 'Ticket',       colorClass: 'colorTicket' },
  reply:      { icon: '↩️', label: 'Reply',        colorClass: 'colorTicket' },
  status:     { icon: '🔄', label: 'Status',       colorClass: 'colorStatus' },
  assignment: { icon: '👤', label: 'Assignment',   colorClass: 'colorAssignment' },
  notice:     { icon: '📢', label: 'Notice',       colorClass: 'colorNotice' },
  sla:        { icon: '⏱️', label: 'SLA Alert',    colorClass: 'colorSla' },
  escalation: { icon: '🚨', label: 'Escalation',   colorClass: 'colorEscalation' },
  completion: { icon: '✅', label: 'Completed',    colorClass: 'colorCompletion' },
  approval:   { icon: '👍', label: 'Approval',     colorClass: 'colorApproval' },
  rejection:  { icon: '👎', label: 'Rejection',    colorClass: 'colorRejection' },
  reopen:     { icon: '🔓', label: 'Reopened',     colorClass: 'colorReopen' },
  merge:      { icon: '🔀', label: 'Merged',       colorClass: 'colorStatus' },
  knowledge:  { icon: '📚', label: 'Knowledge',    colorClass: 'colorNotice' },
};

const defaultConfig: NotifConfig = { icon: '🔔', label: 'Notification', colorClass: 'colorDefault' };

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SkeletonItem() {
  return (
    <div className={styles.skeletonItem}>
      <div className={styles.skeletonIcon} />
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonLine} style={{ width: '30%', height: 12 }} />
        <div className={styles.skeletonLine} style={{ width: '75%', height: 16, marginTop: 6 }} />
        <div className={styles.skeletonLine} style={{ width: '55%', height: 12, marginTop: 6 }} />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [notifPageSize, setNotifPageSize] = useState(20);
  const NOTIF_PAGE_OPTIONS = [10, 20, 50];

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotifications({ limit: 50 });
      setNotifications(res.data.data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError('Failed to load notifications.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetchUnreadCount();
      setUnreadCount(res.data.data.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  useEffect(() => {
    const handler = () => {
      loadNotifications();
      loadUnreadCount();
    };
    window.addEventListener('notifications-updated', handler);
    return () => window.removeEventListener('notifications-updated', handler);
  }, [loadNotifications, loadUnreadCount]);

  const isChatNotification = useCallback((n: NotificationItem) => {
    return (
      n.type === 'chat' ||
      n.type === 'message' ||
      Boolean(n.roomId) ||
      Boolean(n.title && /chat|message|video|conference|meeting|screen share/i.test(n.title)) ||
      Boolean(n.message && /chat|message|video|conference|meeting|screen share/i.test(n.message))
    );
  }, []);

  const handleNotificationClick = (n: NotificationItem) => {
    // Non-blocking mark read so navigation is triggered immediately
    markNotificationRead(n.id).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    const role = user?.role || 'admin';

    if (isChatNotification(n)) {
      navigate(chatPaths[role] || '/admin/chat', {
        state: { selectedRoomId: n.roomId || undefined },
      });
    } else if (n.type === 'notice' || Boolean(n.noticeId)) {
      navigate(noticePaths[role] || '/admin/notices');
    } else if (n.ticketId) {
      navigate(`${basePaths[role] || '/admin/tickets'}/${n.ticketId}`);
    } else {
      navigate(basePaths[role] || '/admin/tickets');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this notification?')) return;
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => {
      const target = notifications.find((n) => n.id === id);
      if (target && !target.readAt) return Math.max(0, c - 1);
      return c;
    });
  };

  const filterCounts = {
    all: notifications.length,
    unread: notifications.filter((n) => !n.readAt).length,
    chat: notifications.filter((n) => isChatNotification(n)).length,
    ticket: notifications.filter((n) => !isChatNotification(n) && (n.type === 'ticket' || n.type === 'reply' || n.type === 'status' || n.type === 'assignment' || n.type === 'escalation')).length,
    notice: notifications.filter((n) => n.type === 'notice' || Boolean(n.noticeId)).length,
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.readAt;
    if (filter === 'chat') return isChatNotification(n);
    if (filter === 'ticket') return !isChatNotification(n) && ['ticket', 'reply', 'status', 'assignment', 'escalation', 'completion', 'approval', 'rejection', 'reopen', 'merge', 'sla'].includes(n.type);
    if (filter === 'notice') return n.type === 'notice' || Boolean(n.noticeId);
    return true;
  });

  const totalNotifPages = useMemo(() => Math.max(1, Math.ceil(filteredNotifications.length / notifPageSize)), [filteredNotifications.length, notifPageSize]);
  const pagedNotifications = useMemo(() => filteredNotifications.slice((notifPage - 1) * notifPageSize, notifPage * notifPageSize), [filteredNotifications, notifPage, notifPageSize]);

  const hasUnread = notifications.some((n) => !n.readAt);

  const filterPills: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'chat', label: 'Chat' },
    { key: 'ticket', label: 'Tickets' },
    { key: 'notice', label: 'Notices' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.headerArea}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>🔔</div>
          <div>
            <h1 className={styles.headerTitle}>Notifications</h1>
            <p className={styles.headerSub}>
              {unreadCount > 0
                ? <><span className={styles.unreadBadgeInline}>{unreadCount}</span> unread notification{unreadCount !== 1 ? 's' : ''}</>
                : 'All caught up — no unread notifications'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className={styles.openChatNavBtn}
            onClick={() => navigate(chatPaths[user?.role || 'admin'] || '/admin/chat')}
            title="Navigate directly to Chat"
          >
            💬 Go to Chat
          </button>
          {hasUnread && (
            <button
              className={styles.markAllBtn}
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <span className={styles.spinner} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div className={styles.filterRow}>
        {filterPills.map(({ key, label }) => (
          <button
            key={key}
            className={`${styles.filterPill} ${filter === key ? styles.filterPillActive : ''}`}
            onClick={() => { setFilter(key); setNotifPage(1); }}
          >
            {label}
            {filterCounts[key] > 0 && (
              <span className={`${styles.pillCount} ${filter === key ? styles.pillCountActive : ''}`}>
                {filterCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {error && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3 className={styles.emptyTitle}>Unable to load notifications</h3>
          <p className={styles.emptyText}>{error}</p>
        </div>
      )}
      {!error && loading ? (
        <div className={styles.list}>
          {[...Array(5)].map((_, i) => <SkeletonItem key={i} />)}
        </div>
      ) : !error && filteredNotifications.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            {filter === 'unread' ? '✅' : filter === 'chat' ? '💬' : filter === 'notice' ? '📢' : filter === 'ticket' ? '🎫' : '🔔'}
          </div>
          <h3 className={styles.emptyTitle}>
            {filter === 'unread' ? "You're all caught up!" : `No ${filter === 'all' ? '' : filter + ' '}notifications`}
          </h3>
          <p className={styles.emptyText}>
            {filter === 'unread'
              ? 'No unread notifications right now. Check back later.'
              : `When you receive ${filter === 'all' ? 'a' : `a ${filter}`} notification, it will appear here.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
              {filteredNotifications.length === 0 ? '' : `Showing ${Math.min((notifPage - 1) * notifPageSize + 1, filteredNotifications.length)}–${Math.min(notifPage * notifPageSize, filteredNotifications.length)} of ${filteredNotifications.length}`}
            </span>
            <select
              value={notifPageSize}
              onChange={(e) => { setNotifPageSize(Number(e.target.value)); setNotifPage(1); }}
              style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color, #252e3e)', background: 'var(--bg-card, #151b28)', color: 'var(--text-main, #f8fafc)' }}
            >
              {NOTIF_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
            </select>
          </div>
          <div className={styles.list}>
            {pagedNotifications.map((n) => {
            const isChat = isChatNotification(n);
            const cfg = isChat ? notifConfig.chat : (notifConfig[n.type] || defaultConfig);
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={`${styles.item} ${isUnread ? styles.unread : styles.read}`}
                onClick={() => handleNotificationClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
              >
                {/* Unread accent bar */}
                {isUnread && <div className={styles.accentBar} />}

                {/* Icon container */}
                <div className={`${styles.iconWrap} ${styles[cfg.colorClass]}`}>
                  <span className={styles.iconEmoji}>{isChat ? '💬' : cfg.icon}</span>
                </div>

                {/* Content */}
                <div className={styles.content}>
                  <div className={styles.metaRow}>
                    <span className={`${styles.typeBadge} ${styles[cfg.colorClass + 'Badge']}`}>
                      {isChat ? 'Chat' : cfg.label}
                    </span>
                    <time className={styles.time}>
                      {n.createdAt ? getRelativeTime(n.createdAt) : ''}
                    </time>
                  </div>
                  <strong className={styles.title}>{n.title}</strong>
                  <p className={styles.message}>{n.message}</p>
                  {isChat && (
                    <div style={{ marginTop: 6 }}>
                      <span className={styles.chatActionPrompt}>
                        💬 Open Chat Conversation →
                      </span>
                    </div>
                  )}
                </div>

                {/* Unread dot */}
                {isUnread && <div className={styles.unreadDot} />}

                {/* Delete */}
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                  title="Delete notification"
                >
                  🗑️
                </button>

                {/* Chevron */}
                <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            );
          })}
          </div>

          {totalNotifPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
              <button
                onClick={() => setNotifPage(p => Math.max(1, p - 1))}
                disabled={notifPage <= 1}
                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid var(--border-color, #252e3e)', background: 'var(--bg-card, #151b28)', color: 'var(--text-main, #f8fafc)', cursor: notifPage <= 1 ? 'not-allowed' : 'pointer', opacity: notifPage <= 1 ? 0.4 : 1, fontWeight: 600 }}
              >← Prev</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)' }}>Page {notifPage} of {totalNotifPages}</span>
              <button
                onClick={() => setNotifPage(p => Math.min(totalNotifPages, p + 1))}
                disabled={notifPage >= totalNotifPages}
                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid var(--border-color, #252e3e)', background: 'var(--bg-card, #151b28)', color: 'var(--text-main, #f8fafc)', cursor: notifPage >= totalNotifPages ? 'not-allowed' : 'pointer', opacity: notifPage >= totalNotifPages ? 0.4 : 1, fontWeight: 600 }}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
