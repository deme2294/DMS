import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from '../components/Sidebar/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import UserDropdown from './UserDropdown';
import styles from './CeoLayout.module.css';

export default function CeoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={styles.layout}>
      <Sidebar
        roleOverride="ceo"
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              className={styles.hamburgerBtn}
              aria-label="Toggle navigation drawer"
              title="Toggle navigation"
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
