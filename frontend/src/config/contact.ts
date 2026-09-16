/**
 * Role-based contact (direct messaging) hierarchy — frontend mirror of the
 * backend `contactMatrix.js`. Controls which users appear in the "New
 * Conversation" direct-chat picker and which direct rooms may be created.
 *
 * Rules:
 *  - CEO only contacts managers (and admins) directly; never staff/tenants.
 *  - Staff are contactable only by their department manager. Admin is the only
 *    exception allowed to contact staff directly.
 *  - Staff, Admin and Tenant reach the CEO through their department manager
 *    (only managers may directly contact the CEO).
 */
export const CONTACTABLE_ROLES: Record<string, string[]> = {
  ceo: ['manager', 'admin'],
  manager: ['manager', 'staff', 'admin', 'ceo', 'tenant'],
  staff: ['manager', 'admin', 'tenant'],
  tenant: ['manager', 'admin'],
  admin: ['staff', 'manager', 'tenant'],
};

export const canContact = (initiatorRole: string, targetRole: string): boolean => {
  if (!initiatorRole || !targetRole) return false;
  const allowed = CONTACTABLE_ROLES[initiatorRole];
  if (!allowed) return false;
  return allowed.includes(targetRole);
};

export const getContactableRoles = (initiatorRole: string): string[] => {
  return CONTACTABLE_ROLES[initiatorRole] || [];
};
