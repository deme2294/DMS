import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bars3Icon, ShieldCheckIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import Sidebar from '../components/Sidebar/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ConnectionStatus from '../components/ConnectionStatus/ConnectionStatus';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import UserDropdown from './UserDropdown';
import styles from './CeoLayout.module.css';

const ROUTE_TITLES: Record<string, string> = {
  '/ceo/dashboard': 'Command Center',
  '/ceo/analytics': 'Executive Analytics',
  '/ceo/approvals': 'Executive Approvals',
  '/ceo/tickets': 'Incident Oversight',
  '/ceo/tickets/duplicates': 'Duplicate & Merged Hub',
  '/ceo/departments': 'Department Operations',
  '/ceo/tenants': 'Tenants & Accounts',
  '/ceo/users': 'Executive Directory',
  '/ceo/reports': 'Reports & Analytics',
  '/ceo/knowledge': 'Knowledge Base',
  '/ceo/notices': 'Executive Notices',
  '/ceo/audit': 'Audit & Compliance',
  '/ceo/chat': 'Executive Chat',
  '/ceo/notifications': 'Notifications',
  '/ceo/profile': 'Executive Profile',
};

export default function CeoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dms_sidebar_collapsed') === 'true';
  });

  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const currentSectionTitle = useMemo(() => {
    if (ROUTE_TITLES[location.pathname]) {
      return ROUTE_TITLES[location.pathname];
    }
    const matchedPrefix = Object.keys(ROUTE_TITLES)
      .filter((k) => location.pathname.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0];
    return matchedPrefix ? ROUTE_TITLES[matchedPrefix] : 'Executive Suite';
  }, [location.pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  const isChatPage = location.pathname.endsWith('/chat');

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('dms_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        roleOverride="ceo"
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className={`${styles.main} ${isCollapsed ? styles.mainCollapsed : ''}`}>
        <header className={styles.topBar}>
          <div className={styles.topBarMainRow}>
            <div className={styles.topBarLeft}>
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setMobileSidebarOpen((prev) => !prev);
                  } else {
                    toggleCollapse();
                  }
                }}
                className={styles.hamburgerBtn}
                aria-label={mobileSidebarOpen ? "Close navigation drawer" : "Toggle navigation drawer"}
                aria-expanded={mobileSidebarOpen}
                title={isCollapsed ? 'Expand navigation' : 'Toggle navigation'}
              >
                <Bars3Icon className={styles.hamburgerIcon} />
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className={styles.backBtn}
                aria-label="Go back"
                title="Go back"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className={styles.mobileBrandTitle} title={`ITPC • ${currentSectionTitle}`}>
                <span className={styles.mobileBrandAccent}>ITPC</span> {currentSectionTitle}
              </div>
            </div>

            <div className={styles.topBarCenter}>
              <div className={styles.systemHeaderBrand}>
                <div className={styles.executivePillBadge}>
                  <ShieldCheckIcon className={styles.executivePillIcon} />
                  <span className={styles.executivePillText}>EXECUTIVE COMMAND</span>
                </div>
                <h1 className={styles.systemHeaderTitle}>
                  <span className={styles.systemHeaderAccent}>ITPC</span>
                  <span className={styles.systemHeaderHelpDesk}> HELP DESK</span>
                </h1>
                <span className={styles.systemHeaderDivider}>•</span>
                <span className={styles.systemHeaderSub}>{currentSectionTitle}</span>
              </div>
            </div>

            <div className={styles.topBarActionsRight}>
              <ConnectionStatus />
              <NotificationCenter />
              <UserDropdown />
            </div>
          </div>

          <div className={styles.topBarSubRow}>
            <div className={styles.executiveDateBadge}>
              <CalendarDaysIcon className={styles.dateIcon} />
              <span>{todayDateString}</span>
            </div>
            <div className={styles.themeToggleWrapper}>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className={`${styles.content} ${isChatPage ? styles.contentChat : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
