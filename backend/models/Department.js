export const DEPARTMENT_STATUS = ['active', 'inactive'];

export const sanitizeDepartment = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    headUserId: row.head_user_id,
    headName: row.head_name || null,
    headEmail: row.head_email || null,
    status: row.status,
    userCount: row.user_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};