export const sanitizeAssignment = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    userRole: row.user_role,
    departmentId: row.department_id,
    departmentName: row.department_name,
    departmentCode: row.department_code,
    assignedAt: row.assigned_at,
  };

};