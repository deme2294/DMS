import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const [department, setDepartment] = useState<Department | null>(null);
  const [heads, setHeads] = useState<DepartmentHeadOption[]>([]);
  const [users, setUsers] = useState<DepartmentMember[]>([]);
  const [loading, setLoading] = useState(false);
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
        setDepartment({ ...deptRes.data.data, memberIds });
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
        setError(err?.response?.data?.message || 'Failed to load department');
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
      navigate('/admin/departments');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update department';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div className={styles.page}>Error: {error}</div>;
  if (!department) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit Department"
        description="Update department details, head and member assignments"
        backTo="/admin/departments"
      />
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
