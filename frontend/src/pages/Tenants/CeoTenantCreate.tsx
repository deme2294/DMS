import PageHeader from '../../components/PageHeader/PageHeader';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TenantForm from '../../components/Forms/TenantForm';
import { createTenant } from '../../api/tenantApi';
import type { TenantFormValues } from '../../types/tenant';
import styles from './CeoTenants.module.css';

type Toast = { type: 'success' | 'error'; message: string } | null;

export default function CeoTenantCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const onSubmit = async (values: TenantFormValues) => {
    setLoading(true);
    setToast(null);
    try {
      const response = await createTenant(values as unknown as Record<string, unknown>);
      if (response.data?.success) {
        setToast({ type: 'success', message: response.data.message || 'Tenant created successfully' });
        setTimeout(() => navigate('/ceo/tenants'), 800);
      } else {
        setToast({ type: 'error', message: response.data?.message || 'Failed to create tenant' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      setToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Create Tenant"
        description="Register a new tenant organization"
        backTo="/ceo/tenants"
      />

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.header}>
        <div>
          <h1>Create Tenant</h1>
          <p>Register a new tenant organization in the system</p>
        </div>
      </div>

      <div className={styles.card}>
        <TenantForm showLoginFields onSubmit={onSubmit} loading={loading} />
      </div>
    </div>
  );
}
