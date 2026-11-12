import PageHeader from '../../components/PageHeader/PageHeader';
import { toShortId } from '../../utils/idUtils';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { fetchUser, updateUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import type { User, RoleOption, UserFormValues } from '../../types/user';
import styles from './Users.module.css';

export default function UserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        navigate(`/admin/users/${shortId}/edit`, { replace: true });
      }
      const allRoles = rolesRes.data.data;
      if (userData.role === 'tenant') {
        setRoles(allRoles);
      } else {
        setRoles(allRoles.filter((role) => ['admin', 'manager', 'staff'].includes(role.name)));
      }
      setDepartments(deptsRes.data.data);
    }).catch((err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to load user details');
    });
  }, [id]);

  const onSubmit = async (values: UserFormValues) => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
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
      setSuccessMsg(successText);
      showSuccess(successText, 'User Updated');
      setTimeout(() => {
        navigate('/admin/users', {
          state: {
            message: successText,
            alert: { type: 'success', message: successText, title: 'User Updated' },
          },
        });
      }, 350);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to update user';
      setErrorMsg(msg);
      showError(msg, 'Update Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user && !errorMsg) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Edit User"
        description="Update user account details and permissions"
        backTo="/admin/users"
      />
      {successMsg && (
        <div className={styles.toast} style={{ marginBottom: '1rem' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className={`${styles.toast} ${styles.error}`} style={{ marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}
      {user && (
        <UserForm
          initialData={user}
          roles={roles}
          departments={departments}
          onSubmit={onSubmit}
          loading={loading}
          isSelf={currentUser?.id === user.id}
        />
      )}
    </div>
  );
}
