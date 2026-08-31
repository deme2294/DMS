import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { createUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type { RoleOption, UserFormValues } from '../../types/user';
import styles from './Users.module.css';

export default function UserCreate() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchRoles().then((res) => {
        const internalRoles = res.data.data.filter((role) =>
          ['admin', 'manager', 'staff'].includes(role.name)
        );
        setRoles(internalRoles);
      }),
      fetchActiveDepartments().then((res) => setDepartments(res.data.data)).catch(() => { }),
    ]).catch(() => { });
  }, []);

  const onSubmit = async (values: UserFormValues) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('email', values.email);
      formData.append('password', values.password || '');
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('phone', values.phone || '');
      formData.append('roleId', String(values.roleId));
      formData.append('status', values.status);
      formData.append('departmentId', values.departmentId || '');
      if (values.profileImage?.[0]) {
        formData.append('profileImage', values.profileImage[0]);
      }
      await createUser(formData);
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Create User"
        description="Add a new user account to the system"
        backTo="/admin/users"
      />
      <UserForm roles={roles} departments={departments} onSubmit={onSubmit} loading={loading} />
    </div>
  );
}
