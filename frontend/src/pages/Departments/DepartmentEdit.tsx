import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortDepartmentId } from '../../utils/idUtils';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlert } from '../../context/AlertContext';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import DepartmentForm from '../../components/Forms/DepartmentForm';
import {
  fetchDepartment,
  updateDepartment,
  fetchEligibleHeads,
  fetchDepartmentMembers,
} from '../../api/departmentApi';
import { fetchUsers as fetchAllUsers } from '../../api/userApi';
import type {
  Department,
  DepartmentFormValues,
  DepartmentHeadOption,
  DepartmentMember,
} from '../../types/department';
import styles from './Departments.module.css';

export default function DepartmentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showError } = useAlert();
  const [department, setDepartment] = useState<Department | null>(null);
  const [heads, setHeads] = useState<DepartmentHeadOption[]>([]);
  const [users, setUsers] = useState<DepartmentMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchDepartment(id),
      fetchEligibleHeads(),
      fetchAllUsers({ status: 'active', limit: 300, page: 1 }),
      fetchDepartmentMembers(id),
    ])
      .then(([deptRes, headsRes, usersRes, membersRes]) => {
        const memberIds = (membersRes.data.data || []).map((m) => m.id);
        const deptData = deptRes.data.data;
        const shortId = toShortDepartmentId(deptData);
        if (shortId && id !== shortId && id.length > 8) {
          navigate(`/admin/departments/${shortId}/edit`, { replace: true });
        }
        setDepartment({ ...deptData, memberIds });
        setHeads(headsRes.data.data);
        setUsers(
          usersRes.data.data.map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            status: u.status,
            role: u.role,
          }))
        );
      })
      .catch((err) => {
        setLoadError(err?.response?.data?.message || 'Failed to load department');
      });
  }, [id]);

  const onSubmit = async (values: DepartmentFormValues) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await updateDepartment(id, {
        name: values.name,
        code: values.code,
        description: values.description,
        headUserId: values.headUserId || null,
        status: values.status,
        memberIds: values.memberIds || [],
      });

      const oldMemberIds = department?.memberIds || [];
      const newMemberIds = values.memberIds || [];
      const removedIds = oldMemberIds.filter((mid) => !newMemberIds.includes(mid));
      const addedIds = newMemberIds.filter((mid) => !oldMemberIds.includes(mid));

      let alertMessage = `Department "${values.name}" updated successfully.`;
      if (removedIds.length > 0 && addedIds.length === 0) {
        const removedNames = users
          .filter((u) => removedIds.includes(u.id))
          .map((u) => `${u.firstName} ${u.lastName}`)
          .join(', ');
        alertMessage = `User ${removedNames || 'member'} removed from this department`;
      } else if (addedIds.length > 0 && removedIds.length === 0) {
        const addedNames = users
          .filter((u) => addedIds.includes(u.id))
          .map((u) => `${u.firstName} ${u.lastName}`)
          .join(', ');
        alertMessage = `User ${addedNames || 'member'} added to ${values.name}`;
      } else if (addedIds.length > 0 || removedIds.length > 0) {
        alertMessage = `Department "${values.name}" roster and settings updated`;
      }

      navigate('/admin/departments', {
        state: { alert: { type: 'success', message: alertMessage, title: 'Department Updated' } },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update department';
      setError(msg);
      showError(msg, 'Department Assignment Notice');
    } finally {
      setLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader
          title="Edit Department"
          description="Update department details, head and member assignments"
          backTo="/admin/departments"
        />
        <div className={styles.professionalAlertBanner}>
          <div className={`${styles.alertCardInner} ${styles.alertCardError}`} role="alert">
            <div className={styles.alertIconCol}>
              <ExclamationTriangleIcon className={styles.alertActionIcon} />
            </div>
            <div className={styles.alertBodyCol}>
              <div className={styles.alertHeaderRow}>
                <span className={styles.alertCategoryBadge}>Load Error</span>
              </div>
              <h5 className={styles.alertHeadline}>Department Loading Notice</h5>
              <p className={styles.alertDescription}>{loadError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!department) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit Department"
        description="Update department details, head and member assignments"
        backTo="/admin/departments"
      />

      {/* ── Professional Action Alert Banner ── */}
      {error && (
        <div className={styles.professionalAlertBanner}>
          <div className={`${styles.alertCardInner} ${styles.alertCardError}`} role="alert">
            <div className={styles.alertIconCol}>
              <ExclamationTriangleIcon className={styles.alertActionIcon} />
            </div>
            <div className={styles.alertBodyCol}>
              <div className={styles.alertHeaderRow}>
                <span className={styles.alertCategoryBadge}>Assignment Conflict</span>
                <span className={styles.alertTimestamp}>Action Required</span>
              </div>
              <h5 className={styles.alertHeadline}>Department Assignment Notice</h5>
              <p className={styles.alertDescription}>{error}</p>
            </div>
            <button
              type="button"
              className={styles.alertCloseBtn}
              onClick={() => setError('')}
              title="Dismiss alert"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      )}

      <DepartmentForm
        initialData={department}
        heads={heads}
        users={users}
        onSubmit={onSubmit}
        onCancel={() => navigate('/admin/departments')}
        loading={loading}
      />
    </div>
  );
}
