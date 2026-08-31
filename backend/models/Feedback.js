export const sanitizeFeedback = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ticketId: row.ticket_id,
    subject: row.subject,
    message: row.message,
    rating: row.rating,
    status: row.status,
    feedbackType: row.feedback_type,
    whatShouldChange: row.what_should_change,
    whatIsCorrect: row.what_is_correct,
    whatIsWrong: row.what_is_wrong,
    howItShouldGo: row.how_it_should_go,
    adminResponse: row.admin_response,
    responseAt: row.response_at,
    responseBy: row.response_by,
    tenantName: row.tenant_name,
    contactPerson: row.contact_person,
    ticketReference: row.ticket_reference,
    ticketTitle: row.ticket_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};