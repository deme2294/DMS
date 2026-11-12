import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TenantForm from '../../components/Forms/TenantForm';
import { fetchTenant, updateTenant } from '../../api/tenantApi';
import type { Tenant, TenantFormValues } from '../../types/tenant';
import { toShortTenantId } from '../../utils/idUtils';
import styles from './CeoTenants.module.css';

export default function CeoTenantEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTenant(id).then((res) => {
      const data = res.data.data;
      setTenant(data);
      const shortId = toShortTenantId(data);
      if (shortId && id !== shortId && id.length > 4) {
        navigate(`/ceo/tenants/${shortId}/edit`, { replace: true });
      }
    });
  }, [id, navigate]);

  const onSubmit = async (values: TenantFormValues) => {
    if (!id) return;
    setLoading(true);
    try {
      await updateTenant(id, values as unknown as Record<string, unknown>);
      navigate('/ceo/tenants');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit Tenant"
        backTo="/ceo/tenants"
      />
      <TenantForm initialData={tenant} onSubmit={onSubmit} loading={loading} />
    </div>
  );
}
