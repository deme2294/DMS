import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/ticketApi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import type { NotificationItem } from '../types/ticket';
import styles from './NotificationCenter.module.css';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const basePaths: Record<string, string> = {
  admin: '/admin/tickets',
  manager: '/manager/tickets',
  staff: '/staff/tickets',
  tenant: '/tenant/tickets',
  ceo: '/ceo/tickets',
};

const noticePaths: Record<string, string> = {
  admin: '/admin/notices',
  manager: '/manager/notices',
  staff: '/staff/notices',
  tenant: '/tenant/notices',
  ceo: '/ceo/notices',
};

const chatPaths: Record<string, string> = {
  admin: '/admin/chat',
  manager: '/manager/chat',
  staff: '/staff/chat',
  tenant: '/tenant/chat',
  ceo: '/ceo/chat',
};

const knowledgePaths: Record<string, string> = {
  admin: '/admin/knowledge',
  manager: '/manager/knowledge',
  staff: '/staff/knowledge',
  tenant: '/tenant/knowledge',
  ceo: '/admin/knowledge',
};

const feedbackPaths: Record<string, string> = {
  admin: '/admin/feedback',
  manager: '/admin/feedback',
  staff: '/admin/feedback',
  tenant: '/tenant/feedback',
  ceo: '/admin/feedback',
};

const notificationsPaths: Record<string, string> = {
  admin: '/admin/notifications',
  manager: '/manager/notifications',
  staff: '/staff/notifications',
  tenant: '/tenant/notifications',
  ceo: '/ceo/notifications',
};

const getModuleBadge = (n: NotificationItem) => {
  const isKnowledge =
    n.type === 'knowledge' ||
    Boolean(n.articleId) ||
    Boolean(n.title && /article|knowledge|kb-|revision/i.test(n.title)) ||
    Boolean(n.message && /article|knowledge|kb-/i.test(n.message));
  if (isKnowledge) {
    return <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>📚 Knowledge</span>;
  }
  const isChat =
    n.type === 'chat' ||
    n.type === 'message' ||
    Boolean(n.roomId) ||
    Boolean(n.title && /\b(chat|video conference|video call|meeting invitation|screen share)\b/i.test(n.title));
  if (isChat) {
    return <span style={{ background: '#f3e8ff', color: '#6b21a8', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>💬 Chat</span>;
  }
  const isNotice = n.type === 'notice' || Boolean(n.noticeId) || Boolean(n.title && /notice|announcement/i.test(n.title));
  if (isNotice) {
    return <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>📢 Notice</span>;
  }
  const isFeedback = n.type === 'feedback' || Boolean(n.title && /feedback/i.test(n.title));
  if (isFeedback) {
    return <span style={{ background: '#fce7f3', color: '#9d174d', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>⭐ Feedback</span>;
  }
  return <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>🎫 Ticket</span>;
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const basePath = basePaths[user?.role || 'admin'];
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications({ limit: 30, unreadOnly: true });
      const raw = Array.isArray(res.data?.data) ? res.data.data : [];
      const unreadList = raw.filter((item: NotificationItem) => !item.readAt);
      setNotifications(unreadList.length > 0 ? unreadList : raw.slice(0, 15));
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await fetchUnreadCount();
      setUnreadCount(res.data.data.unreadCount);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user) return;
    loadUnreadCount();
    const handler = () => loadUnreadCount();
    window.addEventListener('notifications-updated', handler);
    return () => window.removeEventListener('notifications-updated', handler);
  }, [user]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Realtime: keep the unread badge and open alerts in sync when any notification arrives.
  useEffect(() => {
    if (!socket || !user) return;

    const handleNotification = (payload: any) => {
      loadUnreadCount();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      if (payload && payload.title) {
        setNotifications((prev) => [
          {
            id: payload.id || ('notif_' + Date.now()),
            title: payload.title,
            message: payload.message || '',
            type: payload.type || 'ticket',
            ticketId: payload.ticketId,
            noticeId: payload.noticeId,
            roomId: payload.roomId,
            articleId: payload.articleId,
            createdAt: payload.createdAt || new Date().toISOString(),
            readAt: null,
          },
          ...prev.filter((item) => !payload.id || item.id !== payload.id),
        ]);
      } else {
        loadNotifications();
      }
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, user]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications([]);
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch {
      // ignore
    }
  };

  const extractTicketTarget = (n: NotificationItem): string | null => {
    if (n.ticketId) {
      return (n as any).ticketReferenceNumber || (n as any).referenceNumber || n.ticketId;
    }
    if ((n as any).ticketReferenceNumber) return (n as any).ticketReferenceNumber;
    if ((n as any).referenceNumber) return (n as any).referenceNumber;

    // Check message or title for ticket reference, e.g. "ticket HD-TEST-53899" or "test-esc-18haurj" or "#HD-2026-00014"
    const text = `${n.title || ''} ${n.message || ''}`;
    const stdMatch = text.match(/\b(HD-[A-Za-z0-9]+-\d+)\b/i);
    if (stdMatch && stdMatch[1]) return stdMatch[1];

    const ticketWordMatch = text.match(/ticket\s+#?([A-Za-z0-9_-]{3,36})/i);
    if (ticketWordMatch && ticketWordMatch[1]) return ticketWordMatch[1];

    const uuidMatch = text.match(/\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i);
    if (uuidMatch && uuidMatch[1]) return uuidMatch[1];

    return null;
  };

  const handleNavigateNotification = (n: NotificationItem) => {
    setOpen(false);
    handleMarkRead(n.id);
    const role = user?.role || 'admin';
    const ticketBase = basePaths[role] || '/admin/tickets';

    // 1. Chat & Video Conference (Highest priority when associated with a chat room or of chat type)
    const isChat =
      n.type === 'chat' ||
      n.type === 'message' ||
      Boolean(n.roomId) ||
      Boolean(n.title && /chat|message|video|conference|meeting|screen share/i.test(n.title)) ||
      Boolean(n.message && /chat|message|video|conference|meeting|screen share/i.test(n.message));

    if (isChat && (n.roomId || n.type === 'chat')) {
      const chatBase = chatPaths[role] || '/admin/chat';
      const isVideoInvite = Boolean(
        (n.title && /video|conference|meeting|call|screen share/i.test(n.title)) ||
        (n.message && /video|conference|meeting|call|screen share/i.test(n.message))
      );
      if (n.roomId) {
        const query = `?room=${encodeURIComponent(n.roomId)}${isVideoInvite ? '&video=true' : ''}`;
        navigate(`${chatBase}${query}`, { state: { selectedRoomId: n.roomId, autoJoinVideo: isVideoInvite } });
      } else {
        navigate(chatBase);
      }
      return;
    }

    // 2. Ticket: Check if this notification is associated with a specific ticket
    const ticketTarget = extractTicketTarget(n);
    if (ticketTarget) {
      navigate(`${ticketBase}/${ticketTarget}`);
      return;
    }

    // 3. Knowledge Base
    const isKnowledge =
      n.type === 'knowledge' ||
      Boolean(n.articleId) ||
      Boolean(n.title && /article|knowledge|kb-|revision/i.test(n.title)) ||
      Boolean(n.message && /article|knowledge|kb-/i.test(n.message));

    if (isKnowledge) {
      const kbBase = knowledgePaths[role] || '/admin/knowledge';
      if (n.articleId) {
        navigate(`${kbBase}/${n.articleId}`);
      } else {
        navigate(kbBase);
      }
      return;
    }

    // Fallback Chat check without direct roomId
    if (isChat) {
      const chatBase = chatPaths[role] || '/admin/chat';
      navigate(chatBase);
      return;
    }

    // 4. Notice
    const isNotice =
      n.type === 'notice' ||
      Boolean(n.noticeId) ||
      Boolean(n.title && /notice|announcement/i.test(n.title));

    if (isNotice) {
      navigate(noticePaths[role] || '/admin/notices');
      return;
    }

    // 5. Feedback
    const isFeedback =
      n.type === 'feedback' ||
      Boolean(n.title && /feedback/i.test(n.title));

    if (isFeedback) {
      navigate(feedbackPaths[role] || '/admin/feedback');
      return;
    }

    // 6. Generic SLA Report (only if no specific ticket was associated)
    const isSla = n.type === 'sla' || Boolean(n.title && /\bsla\b/i.test(n.title));
    if (isSla && (role === 'admin' || role === 'ceo')) {
      navigate('/admin/sla');
      return;
    }

    // 7. General Tickets Fallback
    navigate(ticketBase);
  };

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22Z" fill="currentColor" />
          <path d="M18 16V11C18 7.9 16.36 5.36 13.5 4.69V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.69C7.64 5.36 6 7.9 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge} title={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <strong>Notifications</strong>
            {notifications.length > 0 && (
              <button className={styles.markAll} onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>

          {loading ? (
            <div className={styles.empty}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>No notifications</div>
          ) : (
            <ul className={styles.list}>
              {notifications.map((n) => (
                <li key={n.id} className={`${styles.item} ${!n.readAt ? styles.itemUnread : styles.itemRead}`}>
                  <div
                    className={styles.link}
                    onClick={() => handleNavigateNotification(n)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ margin: 0 }}>{n.title}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {getModuleBadge(n)}
                        <button
                          type="button"
                          className={styles.dismissBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          title="Mark as read and remove from alerts"
                          aria-label="Dismiss notification"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p>{n.message}</p>
                    <time>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.footer}>
            <Link to={notificationsPaths[user?.role || 'admin'] || '/admin/notifications'} className={styles.viewAll}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}


