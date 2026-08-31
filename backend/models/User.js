/**
 * User domain shape (documentation + shared constants).
 * Persistence is handled in userRepository.js.
 */
export const USER_STATUS = ['active', 'inactive', 'locked'];

export const sanitizeUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roleId: row.role_id,
    role: row.role,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    profileImage: row.profile_image,
    status: row.status,
    themePreference: row.theme_preference || 'system',
    userCode: row.user_code,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    departments: row.departments || [],
  };
};