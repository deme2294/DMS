const ACTIVE = ['open', 'assigned', 'in_progress', 'pending', 'waiting_tenant', 'waiting_vendor', 'escalated', 'reopened'];

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
    referenceNumber: row.reference_number,
    trackNumber: row.track_number,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || null,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
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
    cancelledAt: row.cancelled_at || null,
    mergedInto: row.merged_into || null,
    attachments: row.attachments || [],
    slaAchieved: row.sla_achieved ? true : false,
    routingType: row.routing_type || 'general',
    responseSlaBreached: row.response_sla_breached ? true : false,
    escalationSlaBreached: row.escalation_sla_breached ? true : false,
    lastSlaWarningAt: row.last_sla_warning_at || null,
    slaAgreementAccepted: row.sla_agreement_accepted ? true : false,
    slaAgreementAcceptedAt: row.sla_agreement_accepted_at || null,
  };
};

export const sanitizeAttachment = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  fileName: row.file_name,
  filePath: row.file_path,
  mimeType: row.mime_type,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
});
