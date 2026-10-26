const ACTIVE = ['open', 'assigned', 'in_progress', 'pending', 'waiting_tenant', 'escalated', 'reopened'];

export const sanitizeTicket = (row) => {
  if (!row) return null;
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const now = new Date();
  let isOverdue = false;
  let remainingMs = null;
  if (dueDate && ACTIVE.includes(row.status)) {
    remainingMs = dueDate.getTime() - now.getTime();
    isOverdue = remainingMs < 0;
  }
  return {
    id: row.id,
    ticketNum: row.ticket_num != null ? row.ticket_num : null,
    referenceNumber: row.reference_number,
    trackNumber: row.track_number,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || null,
    tenantEmail: row.tenant_email || row.created_by_email || null,
    tenantPhone: row.tenant_phone || row.created_by_phone || null,
    tenantContactPerson: row.tenant_contact_person || null,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    createdByEmail: row.created_by_email || row.tenant_email || null,
    createdByPhone: row.created_by_phone || row.tenant_phone || null,
    departmentId: row.department_id,
    departmentName: row.department_name || null,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name || null,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    status: row.status,
    tenantConfirmationStatus: row.tenant_confirmation_status || 'not_required',
    isEscalated: row.is_escalated ? true : false,
    slaPolicyId: row.sla_policy_id || null,
    dueDate: row.due_date || null,
    responseDueDate: row.response_due_date || null,
    escalationDueDate: row.escalation_due_date || null,
    isOverdue: isOverdue,
    remainingMs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    completedAt: row.completed_at || null,
    approvedAt: row.approved_at || null,
    escalatedAt: row.escalated_at || null,
    reopenedAt: row.reopened_at || null,
    reopenedBy: row.reopened_by || null,
    reopenedByName: row.reopened_by_name || null,
    reopenReason: row.reopen_reason || null,
    firstResponseAt: row.first_response_at || null,
    cancelledAt: row.cancelled_at || null,
    mergedInto: row.merged_into || null,
    attachments: (row.attachments || []).map(sanitizeAttachment),
    slaAchieved: row.sla_achieved ? true : false,
    routingType: row.routing_type || 'general',
    responseSlaBreached: row.response_sla_breached ? true : false,
    escalationSlaBreached: row.escalation_sla_breached ? true : false,
    lastSlaWarningAt: row.last_sla_warning_at || null,
    slaAgreementAccepted: row.sla_agreement_accepted ? true : false,
    slaAgreementAcceptedAt: row.sla_agreement_accepted_at || null,
  };
};

export const sanitizeAttachment = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticket_id || row.ticketId,
    fileName: row.file_name || row.fileName,
    originalName: row.original_name || row.originalName || row.file_name || row.fileName,
    filePath: row.file_path || row.filePath,
    fileSize: row.file_size != null ? Number(row.file_size) : (row.fileSize != null ? Number(row.fileSize) : 0),
    mimeType: row.mime_type || row.mimeType,
    uploadedBy: row.uploaded_by || row.uploadedBy,
    uploadedByName: row.uploaded_by_name || row.uploadedByName || 'User',
    uploadedByRole: row.uploaded_by_role || row.uploadedByRole || null,
    comment: row.comment || null,
    createdAt: row.created_at || row.createdAt,
  };
};
