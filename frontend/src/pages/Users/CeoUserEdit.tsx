import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { fetchUser, updateUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type { User, RoleOption, UserFormValues } from '../../types/user';
import styles from './CeoUsers.module.css';

export default function CeoUserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      const userData = userRes.data.data;
      setUser(userData);
      if (userData?.userNum && id !== String(userData.userNum) && id.length > 20) {
        navigate(`/ceo/users/${userData.userNum}/edit`, { replace: true });
      }
      const allRoles = rolesRes.data.data;
      if (userData.role === 'tenant') {
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
      navigate('/ceo/users');
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
        backTo="/ceo/users"
      />
      <UserForm
        initialData={user}
        roles={roles}
        departments={departments}
        onSubmit={onSubmit}
        loading={loading}
      />
    </div>
  );
}
