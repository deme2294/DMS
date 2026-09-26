import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/ticketApi';
import { useAuth } from '../context/AuthContext';
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

const notificationsPaths: Record<string, string> = {
  admin: '/admin/notifications',
  manager: '/manager/notifications',
  staff: '/staff/notifications',
  tenant: '/tenant/notifications',
  ceo: '/ceo/notifications',
};

export default function NotificationCenter() {
  const { user } = useAuth();
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
      const res = await fetchNotifications({ limit: 10 });
      setNotifications(res.data.data);
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
    loadUnreadCount();
    const handler = () => loadUnreadCount();
    window.addEventListener('notifications-updated', handler);
    return () => window.removeEventListener('notifications-updated', handler);
  }, []);

  
  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Realtime: keep the unread badge in sync when any notification (incl. notices) arrives.
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    const socket = io(API_BASE, { withCredentials: true, auth: { token } });
    socket.on('notification', () => {
      loadUnreadCount();
    });
    return () => {
      socket.disconnect();
    };
  }, [user]);

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
      setNotifications(notifications.filter((n) => n.id !== id));
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
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button className={styles.bell} onClick={() => setOpen(!open)} aria-label="Notifications">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22Z" fill="currentColor"/>
          <path d="M18 16V11C18 7.9 16.36 5.36 13.5 4.69V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.69C7.64 5.36 6 7.9 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor"/>
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
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
                <li key={n.id} className={styles.item}>
                  <div
                    className={styles.link}
                    onClick={() => {
                      setOpen(false);
                      handleMarkRead(n.id);
                      const role = user?.role || 'admin';
                      const isChat =
                        n.type === 'chat' ||
                        n.type === 'message' ||
                        Boolean(n.roomId) ||
                        Boolean(n.title && /chat|message|video|conference|meeting|screen share/i.test(n.title)) ||
                        Boolean(n.message && /chat|message|video|conference|meeting|screen share/i.test(n.message));
                      if (isChat) {
                        if (n.roomId) {
                          navigate(chatPaths[role] || '/admin/chat', { state: { selectedRoomId: n.roomId } });
                        } else {
                          navigate(chatPaths[role] || '/admin/chat');
                        }
                      } else if (n.type === 'notice' || Boolean(n.noticeId)) {
                        navigate(noticePaths[role] || '/admin/notices');
                      } else if (n.ticketId) {
                        navigate(`${basePaths[role] || '/admin/tickets'}/${n.ticketId}`);
                      } else {
                        navigate(basePaths[role] || '/admin/tickets');
                      }
                    }}
                  >
                    <strong>{n.title}</strong>
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