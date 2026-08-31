import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DepartmentForm from '../../components/Forms/DepartmentForm';
import { createDepartment, fetchEligibleHeads } from '../../api/departmentApi';
import { fetchUsers as fetchAllUsers } from '../../api/userApi';
import type {
  DepartmentFormValues,
  DepartmentHeadOption,
  DepartmentMember,
} from '../../types/department';
import styles from './Departments.module.css';

export default function ManagerDepartmentCreate() {
  const navigate = useNavigate();
  const [heads, setHeads] = useState<DepartmentHeadOption[]>([]);
  const [users, setUsers] = useState<DepartmentMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEligibleHeads().then((res) => setHeads(res.data.data));
    fetchAllUsers({ status: 'active', limit: 300, page: 1 }).then((res) => {
      setUsers(
        res.data.data.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          status: u.status,
          role: u.role,
        }))
      );
    });
  }, []);

  const onSubmit = async (values: DepartmentFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createDepartment({
        name: values.name,
        code: values.code,
        description: values.description,
        headUserId: values.headUserId || null,
        status: values.status,
        memberIds: values.memberIds || [],
      });
      navigate('/manager/departments');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create department';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Create Department"
        description="Add a new department and assign its head and members"
        backTo="/manager/departments"
      />
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}
      <DepartmentForm
        heads={heads}
        users={users}
        onSubmit={onSubmit}
        onCancel={() => navigate('/manager/departments')}
        loading={loading}
      />
    </div>
  );
}
