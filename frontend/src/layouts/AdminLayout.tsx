import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { SIDEBAR_ITEMS } from '../config/sidebar';
import type { SidebarSection } from '../config/sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import UserDropdown from './UserDropdown';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'admin';
  const { can } = usePermission();
  const config = SIDEBAR_ITEMS[role];
  const sections: SidebarSection[] = config?.sections || [];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.logo}>HD</span>
          <div>
            <strong className={styles.brandTitle}>Help Desk</strong>
            <span className={styles.brandSub}>Admin Panel</span>
          </div>
        </div>

        <nav className={styles.nav}>
          {sections.map((section, sIdx) => {
            const visibleItems = section.items.filter((item) => !item.permission || can(item.permission));
            if (!visibleItems.length) return null;
            return (
              <div key={sIdx} className={styles.section}>
                {section.title && <div className={styles.sectionLabel}>{section.title}</div>}
                <div className={styles.sectionItems}>
                  {visibleItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                      >
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
                {sIdx < sections.length - 1 && <div className={styles.divider} />}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={styles.backBtn}
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <ThemeToggle />
          <NotificationCenter />
          <UserDropdown />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
