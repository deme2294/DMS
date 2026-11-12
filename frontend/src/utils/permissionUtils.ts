import { Ticket } from '../types/ticket';
import { MeResponse } from '../api/authApi';

/**
 * Checks whether the current user is authorized to send email notifications
 * or direct messages to a tenant regarding a ticket.
 *
 * Authorization Rules:
 * 1. Admin (and CEO) roles can always notify / send email to tenants.
 * 2. Department Manager can notify the tenant ONLY IF:
 *    - The ticket was created from / belongs to a tenant (has tenantId or tenantEmail).
 *    - The ticket is within the manager's assigned department or direct routing category.
 * 3. Tenants, Staff, and other users are strictly restricted and cannot dispatch official notifications.
 */
export const canNotifyTenant = (user: MeResponse | null | undefined, ticket?: Ticket | null): boolean => {
  if (!user) return false;

  const role = user.role;
  if (role === 'admin' || role === 'ceo') {
    return true;
  }

  if (role === 'manager' && ticket) {
    const isTenantTicket = Boolean(ticket.tenantId || ticket.tenantEmail);
    if (!isTenantTicket) return false;

    const managerDeptIds = (user.departments || []).map((d) => d.id);
    const matchesDept = Boolean(ticket.departmentId && managerDeptIds.includes(ticket.departmentId));
    const isDirectCategory = ticket.routingType === 'direct';
    const isAssigned = ticket.assignedTo === user.id;

    return matchesDept || isAssigned || (isDirectCategory && managerDeptIds.length > 0);
  }

  return false;
};

