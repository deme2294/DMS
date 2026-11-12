import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
  BriefcaseIcon,
  SparklesIcon,
  InformationCircleIcon,
  FolderIcon,
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

const getSectionIcon = (title: string = '') => {
  const norm = title.toLowerCase();
  if (norm.includes('main')) return Squares2X2Icon;
  if (norm.includes('manage')) return BuildingOfficeIcon;
  if (norm.includes('operat')) return WrenchScrewdriverIcon;
  if (norm.includes('execut')) return CrownIcon;
  if (norm.includes('work')) return BriefcaseIcon;
  if (norm.includes('service')) return SparklesIcon;
  if (norm.includes('info')) return InformationCircleIcon;
  if (norm.includes('system')) return Cog6ToothIcon;
  return FolderIcon;
};

interface SidebarProps {
  roleOverride?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({
  roleOverride,
  isOpenMobile,
  onCloseMobile,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalToggleCollapse,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const { can } = usePermission();

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dms_sidebar_collapsed') === 'true';
  });

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('dms_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  const role = (roleOverride || user?.role || 'admin').toLowerCase();
  const roleConfig = ROLE_INFO[role] || ROLE_INFO.admin;
  const config = SIDEBAR_ITEMS[role] || SIDEBAR_ITEMS.admin;
  const sections: SidebarSection[] = config?.sections || [];

  // Helper to determine which section index contains the currently active route
  const getActiveSectionIndex = useCallback(() => {
    for (let i = 0; i < sections.length; i++) {
      const hasActive = sections[i].items.some((item) => {
        if (!item.permission || can(item.permission)) {
          return (
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
          );
        }
        return false;
      });
      if (hasActive) return i;
    }
    return 0; // default to first section (e.g. 'Main')
  }, [sections, location.pathname, can]);

  // Accordion state: only one navigation group heading is open at a time
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(() => getActiveSectionIndex());

  // Automatically update the opened group when user navigates to a new route in a different section
  const previousPathRef = useRef(location.pathname);
  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      const activeIdx = getActiveSectionIndex();
      setOpenSectionIndex(activeIdx);
    }
  }, [location.pathname, getActiveSectionIndex]);

  // When a navigation group heading is clicked:
  // If another heading was open, it collapses and the clicked one opens.
  // If the same heading is clicked, it toggles open/closed.
  const handleToggleSection = (sIdx: number) => {
    setOpenSectionIndex((prev) => (prev === sIdx ? null : sIdx));
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
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''} ${isOpenMobile ? styles.sidebarOpen : ''}`}>
      {/* ── Brand Header with Ethiopian IT Park Logo ── */}
      <div className={styles.brandContainer}>
        <div className={styles.logoLink} title="Ethiopian IT Park — Help Desk Management System">
          <img
            src="/logo-white.png"
            alt="Ethiopian IT Park Logo"
            className={styles.brandLogoImg}
          />
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

      {/* ── Navigation Items (Accordion Groups) ── */}
      <nav className={styles.nav}>
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.permission || can(item.permission));
          if (!visibleItems.length) return null;

          const hasActiveItem = visibleItems.some(
            (item) =>
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
          );

          // In expanded mode: accordion controls open/close. In collapsed icon mode: all icons remain accessible.
          const isOpen = isCollapsed ? true : openSectionIndex === sIdx;

          return (
            <div key={sIdx} className={styles.section}>
              {section.title && (
                <button
                  type="button"
                  className={`${styles.sectionHeaderBtn} ${isOpen ? styles.sectionHeaderBtnOpen : ''} ${
                    hasActiveItem ? styles.sectionHeaderHasActive : ''
                  }`}
                  onClick={() => handleToggleSection(sIdx)}
                  aria-expanded={isOpen}
                  title={`${isOpen ? 'Collapse' : 'Expand'} ${section.title} section (${visibleItems.length} items)`}
                >
                  <div className={styles.sectionHeaderLeft}>
                    <span className={styles.sectionIconBadge}>
                      {React.createElement(getSectionIcon(section.title), { className: styles.sectionIconSvg })}
                    </span>
                    <span className={styles.sectionLabelText}>{section.title}</span>
                  </div>

                  <div className={styles.sectionHeaderRight}>
                    {hasActiveItem && !isOpen && (
                      <span className={styles.activeGroupDot} title="Current active page is in this section" />
                    )}
                    <span className={styles.sectionItemCountBadge}>
                      {visibleItems.length}
                    </span>
                    <span className={styles.chevronPill}>
                      <ChevronDownIcon
                        className={`${styles.sectionChevron} ${isOpen ? styles.sectionChevronOpen : ''}`}
                      />
                    </span>
                  </div>
                </button>
              )}

              <div
                className={`${styles.sectionItemsWrapper} ${
                  isOpen ? styles.sectionItemsWrapperOpen : ''
                }`}
              >
                <div className={styles.sectionItemsInner}>
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
                        title={item.label}
                      >
                        <span className={styles.navIconBox}>
                          <SidebarIcon label={item.label} path={item.path} className={styles.navIconSvg} />
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {sIdx < sections.length - 1 && <div className={styles.divider} />}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom User Card with Sidebar Collapse Button ── */}
      <div className={styles.bottomCard}>
        <div className={styles.userInfoGroup} title={`${userDisplayName} (${roleConfig.roleLabel})`}>
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
          className={styles.collapseToggleBtn}
          onClick={handleToggleCollapse}
          title={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
          aria-label={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
        >
          {isCollapsed ? (
            <ChevronDoubleRightIcon className={styles.collapseIcon} />
          ) : (
            <ChevronDoubleLeftIcon className={styles.collapseIcon} />
          )}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
