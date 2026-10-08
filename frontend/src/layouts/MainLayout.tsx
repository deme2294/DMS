import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARD } from '../config/routes';
import NotificationCenter from '../components/NotificationCenter';
import UserDropdown from './UserDropdown';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const ticketPath = user ? ROLE_DASHBOARD[user.role] : '/login';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>HD</span>
          <div>
            <strong>Government Help Desk</strong>
            <span>Ticket Management</span>
          </div>
        </div>
        <nav className={styles.nav}>
          {user && (
            <>
              <Link to={ticketPath}>Tickets</Link>
              {user.role === 'tenant' && <Link to="/tenant/tickets/create">New Ticket</Link>}
              <Link to="/track">Track Ticket</Link>
            </>
          )}
        </nav>
        <div className={styles.user}>
          <ThemeToggle />
          {user ? (
            <>
              <NotificationCenter />
              <UserDropdown />
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
