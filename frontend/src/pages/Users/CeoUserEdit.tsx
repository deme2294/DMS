import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortId } from '../../utils/idUtils';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { fetchUser, updateUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAlert } from '../../context/AlertContext';
import type { User, RoleOption, UserFormValues } from '../../types/user';
import styles from './CeoUsers.module.css';

export default function CeoUserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchUser(id),
      fetchRoles(),
      fetchActiveDepartments(),
    ]).then(([userRes, rolesRes, deptsRes]) => {
      const userData = userRes.data.data;
      setUser(userData);
      const shortId = userData?.userNum ? String(userData.userNum) : toShortId(userData?.id);
      if (shortId && id !== shortId && id.length > 8) {
        navigate(`/ceo/users/${shortId}/edit`, { replace: true });
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
    setErrorMessage(null);
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
      const targetId = user?.id || id;
      const res = await updateUser(targetId, formData);
      const fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
      const userDisplay = fullName ? `${fullName} (@${values.username})` : `@${values.username}`;
      const successText = res?.data?.message || `User ${userDisplay} was updated successfully!`;
      setMessage(successText);
      showSuccess(successText, 'User Updated');
      setTimeout(() => {
        navigate('/ceo/users', {
          state: {
            message: successText,
            alert: { type: 'success', message: successText, title: 'User Updated' },
          },
        });
      }, 350);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to update user details';
      setErrorMessage(msg);
      showError(msg, 'Update Failed');
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
      {message && (
        <div className={styles.toast} style={{ marginBottom: '1rem' }}>
          {message}
        </div>
      )}
      {errorMessage && (
        <div className={`${styles.toast} ${styles.error}`} style={{ marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}
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
