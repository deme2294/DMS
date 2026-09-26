/**
 * Role-based contact (direct messaging) hierarchy.
 *
 * The contact matrix defines which roles a given role may directly start a
 * 1:1 ("Direct") conversation with. Existing conversations a user already
 * belongs to remain readable — the restriction only governs *initiating* a new
 * direct chat and the user picker shown in the "New Conversation" flow.
 *
 * Business rules encoded here:
 *  - The CEO only contacts department managers (and admins) directly. The CEO
 *    never contacts staff or tenants 1:1; staff are reached through managers.
 *  - Staff are contactable only by their department manager. The only exception
 *    is Admin, who may contact staff directly (assign / direct message).
 *  - Staff, Admin and Tenant reach the CEO through their department manager
 *    (i.e. only managers may directly contact the CEO).
 *  - Managers act as the bridge between the executive office and the teams.
 */
export const CONTACTABLE_ROLES = {
  ceo: ['manager', 'admin'],
  manager: ['manager', 'staff', 'admin', 'ceo', 'tenant'],
  staff: ['manager', 'admin', 'tenant', 'staff'],
  tenant: ['manager', 'admin'],
  admin: ['admin', 'staff', 'manager', 'tenant', 'ceo'],
};

export const canContact = (initiatorRole, targetRole) => {
  if (!initiatorRole || !targetRole) return false;
  const allowed = CONTACTABLE_ROLES[initiatorRole];
  if (!allowed) return false;
  return allowed.includes(targetRole);
};
