import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from '../components/Sidebar/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import UserDropdown from './UserDropdown';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dms_sidebar_collapsed') === 'true';
  });

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

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
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className={`${styles.main} ${isCollapsed ? styles.mainCollapsed : ''}`}>
        <header className={styles.topBar}>
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
              aria-label="Toggle navigation drawer"
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
          </div>
          <div className={styles.topBarCenter}>
            <div className={styles.systemHeaderBrand}>
              <h1 className={styles.systemHeaderTitle}>
                <span className={styles.systemHeaderAccent}>ITPC</span> HELP DESK
              </h1>
              <span className={styles.systemHeaderDivider}>•</span>
              <span className={styles.systemHeaderSub}>Management System</span>
            </div>
          </div>
          <div className={styles.topBarRight}>
            <ThemeToggle />
            <NotificationCenter />
            <UserDropdown />
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
