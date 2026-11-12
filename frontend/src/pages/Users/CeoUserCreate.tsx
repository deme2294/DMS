import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserForm from '../../components/Forms/UserForm';
import { createUser, fetchRoles } from '../../api/userApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import { useAlert } from '../../context/AlertContext';
import type { RoleOption, UserFormValues } from '../../types/user';
import styles from './CeoUsers.module.css';

export default function CeoUserCreate() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useAlert();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setErrorMessage(null);
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
      const res = await createUser(formData);
      const fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
      const userDisplay = fullName ? `${fullName} (@${values.username})` : `@${values.username}`;
      const successText = res?.data?.message
        ? `${res.data.message}. Login credentials and portal access link sent to ${values.email}.`
        : `User ${userDisplay} was created successfully! Login credentials and access link dispatched to ${values.email}.`;
      setMessage(successText);
      showSuccess(successText, 'User Created');
      setTimeout(() => {
        navigate('/ceo/users', {
          state: {
            message: successText,
            alert: { type: 'success', message: successText, title: 'User Created' },
          },
        });
      }, 350);
    } catch (err: any) {
      console.error('Failed to create user:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to create user account';
      setErrorMessage(msg);
      showError(msg, 'Create Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Create User"
        description="Add a new user account to the system"
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
      <UserForm roles={roles} departments={departments} onSubmit={onSubmit} loading={loading} />
    </div>
  );
}
