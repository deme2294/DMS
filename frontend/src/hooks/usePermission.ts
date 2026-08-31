import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../config/permissions';

export const usePermission = () => {
  const { user } = useAuth();

  const can = (permission: string) => {
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.includes('*') || perms.includes(permission);
  };

  return { can, role: user?.role };
};