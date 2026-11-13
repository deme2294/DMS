export const sanitizeFeedback = (row) => {
  if (!row) return null;
  let assignedUserIds = [];
  if (Array.isArray(row.assigned_user_ids)) {
    assignedUserIds = row.assigned_user_ids;
  } else if (typeof row.assigned_user_ids === 'string' && row.assigned_user_ids.trim()) {
    try {
      const parsed = JSON.parse(row.assigned_user_ids);
      if (Array.isArray(parsed)) assignedUserIds = parsed;
    } catch {
      assignedUserIds = [];
    }
  }
  return {
    id: row.id,
    feedbackNum: row.feedback_num != null ? row.feedback_num : null,
    legacyId: row.legacy_id || null,
    tenantId: row.tenant_id,
    ticketId: row.ticket_id,
    categoryId: row.category_id || null,
    categoryName: row.category_name || null,
    serviceName: row.service_name || null,
    departmentId: row.department_id,
    resolvedDepartmentId: row.resolved_department_id || row.department_id || null,
    routingType: row.routing_type || 'general',
    departmentName: row.department_name,
    departmentHeadId: row.department_head_id || null,
    departmentHeadName: row.dept_head_name || (row.dept_head_first_name ? `${row.dept_head_first_name} ${row.dept_head_last_name || ''}`.trim() : null),
    departmentHeadEmail: row.dept_head_email || null,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: row.assigned_to_name || (row.assigned_first_name ? `${row.assigned_first_name} ${row.assigned_last_name || ''}`.trim() : null),
    assignedToEmail: row.assigned_to_email || row.assigned_user_email,
    assignmentScope: row.assignment_scope || null,
    assignedUserIds,
    adminDirective: row.admin_directive,
    departmentNotes: row.department_notes,
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
    articleId: row.article_id || null,
    articleTitle: row.article_title || null,
    articleReference: row.article_reference || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
