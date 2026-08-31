export const sanitizeRoom = (row) => {
  if (!row) return null;
  return {
    roomId: row.room_id,
    roomType: row.room_type,
    ticketId: row.ticket_id || null,
    departmentId: row.department_id || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
