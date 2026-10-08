import { JSX } from 'react/jsx-runtime';
import { useTheme, ThemePreference } from '../../context/ThemeContext';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  showLabels?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabels = true, className }: ThemeToggleProps) {
  const { themePreference, setThemePreference } = useTheme();

  const options: { id: ThemePreference; label: string; icon: JSX.Element }[] = [
    {
      id: 'system',
      label: 'System',
      icon: (
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: 'light',
      label: 'White',
      icon: (
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: 'dark',
      label: 'Night',
      icon: (
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`${styles.container} ${className || ''}`} role="radiogroup" aria-label="Theme mode options">
      {options.map((opt) => {
        const isActive = themePreference === opt.id;
        const activeClass = isActive
          ? opt.id === 'dark'
            ? styles.activeDark
            : opt.id === 'light'
            ? styles.activeLight
            : styles.activeSystem
          : '';

        return (
          <button
            key={opt.id}
            type="button"
            className={`${styles.optionBtn} ${activeClass}`}
            onClick={() => setThemePreference(opt.id)}
            role="radio"
            aria-checked={isActive}
            title={`${opt.label} Mode`}
          >
            {opt.icon}
            {showLabels && <span className={styles.label}>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
