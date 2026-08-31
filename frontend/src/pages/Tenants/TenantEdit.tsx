import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TenantForm from '../../components/Forms/TenantForm';
import { fetchTenant, updateTenant } from '../../api/tenantApi';
import type { Tenant, TenantFormValues } from '../../types/tenant';
import styles from './Tenants.module.css';

export default function TenantEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTenant(id).then((res) => setTenant(res.data.data));
  }, [id]);

  const onSubmit = async (values: TenantFormValues) => {
    if (!id) return;
    setLoading(true);
    try {
      await updateTenant(id, values as unknown as Record<string, unknown>);
      navigate('/admin/tenants');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit Tenant"
        backTo="/admin/tenants"
      />
      <TenantForm initialData={tenant} onSubmit={onSubmit} loading={loading} />
    </div>
  );
}