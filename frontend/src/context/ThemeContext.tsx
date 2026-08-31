import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { updateMyTheme } from '../api/authApi';

export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  themePreference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'themePreference';

const getSystemTheme = (): EffectiveTheme => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user, updateUser } = useAuth();
  
  // Initial state logic: preference from user DB > localStorage > system
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as ThemePreference | null;
    if (saved && ['system', 'light', 'dark'].includes(saved)) {
      return saved;
    }
    return 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() => {
    if (themePreference === 'system') return getSystemTheme();
    return themePreference;
  });

  // Sync user preference from AuthContext when user logs in or loads
  useEffect(() => {
    if (user?.themePreference && ['system', 'light', 'dark'].includes(user.themePreference)) {
      setThemePreferenceState(user.themePreference as ThemePreference);
      localStorage.setItem(LOCAL_STORAGE_KEY, user.themePreference);
    }
  }, [user?.themePreference]);

  // Handle system preference changes & recalculate effective theme
  useEffect(() => {
    const calculateEffectiveTheme = (): EffectiveTheme => {
      if (themePreference === 'system') {
        return getSystemTheme();
      }
      return themePreference;
    };

    const newEffective = calculateEffectiveTheme();
    setEffectiveTheme(newEffective);

    // Apply data-theme attribute on root html element
    document.documentElement.setAttribute('data-theme', newEffective);
    document.documentElement.style.colorScheme = newEffective;

    // Media query listener for OS mode changes
    if (themePreference === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const updated = e.matches ? 'dark' : 'light';
        setEffectiveTheme(updated);
        document.documentElement.setAttribute('data-theme', updated);
        document.documentElement.style.colorScheme = updated;
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, [themePreference]);

  const setThemePreference = async (newPref: ThemePreference) => {
    setThemePreferenceState(newPref);
    localStorage.setItem(LOCAL_STORAGE_KEY, newPref);

    const calculated = newPref === 'system' ? getSystemTheme() : newPref;
    setEffectiveTheme(calculated);
    document.documentElement.setAttribute('data-theme', calculated);
    document.documentElement.style.colorScheme = calculated;

    if (user) {
      updateUser({ themePreference: newPref });
      try {
        await updateMyTheme(newPref);
      } catch (err) {
        console.error('Failed to sync theme preference to database:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ themePreference, effectiveTheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
