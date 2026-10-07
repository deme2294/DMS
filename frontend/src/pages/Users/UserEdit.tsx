import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { fetchUser, updateUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAuth } from '../../context/AuthContext';
import type { User, RoleOption, UserFormValues } from '../../types/user';
import styles from './Users.module.css';

export default function UserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchUser(id),
      fetchRoles(),
      fetchActiveDepartments(),
    ]).then(([userRes, rolesRes, deptsRes]) => {
      setUser(userRes.data.data);
      const allRoles = rolesRes.data.data;
      if (userRes.data.data.role === 'tenant') {
        setRoles(allRoles);
      } else {
        setRoles(allRoles.filter((role) => ['admin', 'manager', 'staff'].includes(role.name)));
      }
      setDepartments(deptsRes.data.data);
    }).catch(() => { });
  }, [id]);

  const onSubmit = async (values: UserFormValues) => {
    if (!id) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('email', values.email);
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('phone', values.phone || '');
      formData.append('roleId', String(values.roleId));
      formData.append('status', values.status);
      formData.append('departmentId', values.departmentId || '');
      if (values.profileImage?.[0]) {
        formData.append('profileImage', values.profileImage[0]);
      }
      await updateUser(id, formData);
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit User"
        description="Update user account details and permissions"
        backTo="/admin/users"
      />
      <UserForm
        initialData={user}
        roles={roles}
        departments={departments}
        onSubmit={onSubmit}
        loading={loading}
        isSelf={currentUser?.id === user.id}
      />
    </div>
  );
}
