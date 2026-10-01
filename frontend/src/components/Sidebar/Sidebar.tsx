import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { SIDEBAR_ITEMS } from '../../config/sidebar';
import type { SidebarSection } from '../../config/sidebar';
import { SidebarIcon } from './SidebarIcon';
import styles from './Sidebar.module.css';

// Sleek vector crown icon for CEO
const CrownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18h18M4 18l2-9.5 4.5 4.5 3.5-6 3.5 6 4.5-4.5 2 9.5H4z" />
    <circle cx="6" cy="8.5" r="0.75" fill="currentColor" />
    <circle cx="12" cy="7" r="0.75" fill="currentColor" />
    <circle cx="18" cy="8.5" r="0.75" fill="currentColor" />
  </svg>
);

// Sleek headset icon for Staff
const HeadsetIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

interface SidebarProps {
  roleOverride?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const ROLE_INFO: Record<string, { portalTitle: string; roleLabel: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ceo: {
    portalTitle: 'Executive Suite',
    roleLabel: 'Chief Executive',
    Icon: CrownIcon,
  },
  admin: {
    portalTitle: 'Admin Portal',
    roleLabel: 'Administrator',
    Icon: Cog6ToothIcon,
  },
  manager: {
    portalTitle: 'Manager Portal',
    roleLabel: 'Department Manager',
    Icon: ClipboardDocumentCheckIcon,
  },
  staff: {
    portalTitle: 'Staff Workspace',
    roleLabel: 'Support Agent',
    Icon: HeadsetIcon,
  },
  tenant: {
    portalTitle: 'Tenant Portal',
    roleLabel: 'Client Organization',
    Icon: BuildingOffice2Icon,
  },
};

export const Sidebar: React.FC<SidebarProps> = ({ roleOverride, isOpenMobile, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermission();

  const role = (roleOverride || user?.role || 'admin').toLowerCase();
  const roleConfig = ROLE_INFO[role] || ROLE_INFO.admin;
  const config = SIDEBAR_ITEMS[role] || SIDEBAR_ITEMS.admin;
  const sections: SidebarSection[] = config?.sections || [];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const getInitials = () => {
    if (!user) return 'IT';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || user.username?.[0]?.toUpperCase() || 'IT';
  };

  const userDisplayName = user
    ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username)
    : 'System User';

  return (
    <>
      {isOpenMobile && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
        />
      )}
      <aside className={`${styles.sidebar} ${isOpenMobile ? styles.sidebarOpen : ''}`}>
      {/* ── Brand Header with Ethiopian IT Park Logo ── */}
      <div className={styles.brandContainer}>
        <div className={styles.logoLink} title="Ethiopian IT Park — Help Desk Management System">
          <div className={styles.logoCardWrapper}>
            <div className={styles.logoCardGlow} />
            <div className={styles.logoCard}>
              <img
                src="/logo.png"
                alt="Ethiopian IT Park Logo"
                className={styles.brandLogoImg}
              />
            </div>
          </div>
        </div>

        <div className={styles.portalMeta}>
          <div className={styles.systemHeading}>
            <span className={styles.systemName}>ITPC HELP DESK</span>
            <span className={styles.systemSub}>Management System</span>
          </div>

          <div className={`${styles.roleBadge} ${styles[`roleBadge_${role}`] || styles.roleBadge_admin}`}>
            <span className={styles.roleIconWrap}>
              <roleConfig.Icon />
            </span>
            <span className={styles.roleText}>{roleConfig.portalTitle}</span>
            <span className={styles.pulseDot} />
          </div>
        </div>

        {/* ── Department / Organization Information Badge ── */}
        {user?.departments && user.departments.length > 0 ? (
          <div
            className={styles.deptSidebarPill}
            title={`Assigned Department: ${user.departments.map((d) => d.name).join(', ')}`}
          >
            <BuildingOffice2Icon className={styles.deptSidebarIcon} />
            <span className={styles.deptSidebarText}>{user.departments[0].name}</span>
            {user.departments.length > 1 && (
              <span className={styles.deptCountTag}>+{user.departments.length - 1}</span>
            )}
          </div>
        ) : role === 'admin' ? (
          <div className={styles.deptSidebarPill} title="Central Administration — Full System Scope">
            <BuildingOffice2Icon className={styles.deptSidebarIcon} />
            <span className={styles.deptSidebarText}>Central Administration</span>
          </div>
        ) : role === 'ceo' ? (
          <div className={styles.deptSidebarPill} title="Executive Directorate — Enterprise Scope">
            <BuildingOffice2Icon className={styles.deptSidebarIcon} />
            <span className={styles.deptSidebarText}>Executive Directorate</span>
          </div>
        ) : user?.tenantName ? (
          <div className={styles.deptSidebarPill} title={`Organization: ${user.tenantName}`}>
            <BuildingOffice2Icon className={styles.deptSidebarIcon} />
            <span className={styles.deptSidebarText}>{user.tenantName}</span>
          </div>
        ) : null}
      </div>

      {/* ── Navigation Items ── */}
      <nav className={styles.nav}>
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.permission || can(item.permission));
          if (!visibleItems.length) return null;
          return (
            <div key={sIdx} className={styles.section}>
              {section.title && <div className={styles.sectionLabel}>{section.title}</div>}
              <div className={styles.sectionItems}>
                {visibleItems.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onCloseMobile}
                      className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                      <span className={styles.navIconBox}>
                        <SidebarIcon label={item.label} path={item.path} className={styles.navIconSvg} />
                      </span>
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

      {/* ── Bottom User Card ── */}
      <div className={styles.bottomCard}>
        <div className={styles.userInfoGroup}>
          <div className={styles.userAvatar}>
            {getInitials()}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userNameText} title={userDisplayName}>
              {userDisplayName}
            </span>
            <div className={styles.userStatusRow}>
              <span className={styles.userStatusDot} />
              <span>{roleConfig.roleLabel}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.quickLogoutBtn}
          onClick={handleLogout}
          title="Sign out of dashboard"
          aria-label="Sign out"
        >
          <ArrowRightStartOnRectangleIcon />
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
