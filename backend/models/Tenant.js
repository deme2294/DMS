export const TENANT_STATUS = ['active', 'inactive', 'pending'];

export const sanitizeTenant = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    organizationName: row.organization_name,
    registrationNumber: row.registration_number || null,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes || null,
    status: row.status,
    username: row.username || null,
    createdBy: row.created_by || null,
    userCount: row.user_count ?? 0,
    ticketCount: row.ticket_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
