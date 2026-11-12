import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from '../components/Alert/AlertContainer.module.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  type: AlertType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ShowAlertOptions {
  message: string;
  type?: AlertType;
  title?: string;
  duration?: number;
}

export interface AlertContextType {
  alerts: AlertItem[];
  showAlert: (options: ShowAlertOptions) => string;
  showSuccess: (message: string, title?: string, duration?: number) => string;
  showError: (message: string, title?: string, duration?: number) => string;
  showWarning: (message: string, title?: string, duration?: number) => string;
  showInfo: (message: string, title?: string, duration?: number) => string;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const location = useLocation();

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const showAlert = useCallback(
    ({ message, type = 'success', title, duration = 4500 }: ShowAlertOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newAlert: AlertItem = {
        id,
        type,
        message,
        title,
        duration,
      };

      setAlerts((prev) => [...prev, newAlert]);

      if (duration > 0) {
        setTimeout(() => {
          dismissAlert(id);
        }, duration);
      }

      return id;
    },
    [dismissAlert]
  );

  const showSuccess = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showAlert({ message, type: 'success', title, duration });
    },
    [showAlert]
  );

  const showError = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showAlert({ message, type: 'error', title, duration });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showAlert({ message, type: 'warning', title, duration });
    },
    [showAlert]
  );

  const showInfo = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showAlert({ message, type: 'info', title, duration });
    },
    [showAlert]
  );

  // Catch location.state.alert or location.state.message on page navigation
  useEffect(() => {
    if (!location.state) return;
    const stateObj = location.state as any;
    const alertPayload = stateObj.alert || stateObj.message;
    if (alertPayload) {
      const message =
        typeof alertPayload === 'string'
          ? alertPayload
          : alertPayload.message || alertPayload.text;
      const type = alertPayload.type || (alertPayload.isError ? 'error' : 'success');
      const title = alertPayload.title;

      if (message) {
        showAlert({ message, type, title });
      }

      // Clear the alert from history state so refreshing doesn't re-trigger it
      try {
        const stateCopy = { ...stateObj };
        delete stateCopy.alert;
        delete stateCopy.message;
        window.history.replaceState(stateCopy, document.title);
      } catch {
        // Ignored
      }
    }
  }, [location.pathname, location.search, location.state, showAlert]);

  const renderIcon = (type: AlertType) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon />;
      case 'error':
        return <XCircleIcon />;
      case 'warning':
        return <ExclamationTriangleIcon />;
      case 'info':
      default:
        return <InformationCircleIcon />;
    }
  };

  return (
    <AlertContext.Provider
      value={{
        alerts,
        showAlert,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissAlert,
        clearAlerts,
      }}
    >
      {children}
      <div className={styles.container} role="region" aria-label="Notifications">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`${styles.alertCard} ${styles[alert.type]}`}
            role={alert.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className={styles.iconWrapper}>{renderIcon(alert.type)}</div>
            <div className={styles.contentWrapper}>
              {alert.title && <h4 className={styles.title}>{alert.title}</h4>}
              <p className={styles.message}>{alert.message}</p>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => dismissAlert(alert.id)}
              aria-label="Dismiss notification"
            >
              <XMarkIcon />
            </button>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

