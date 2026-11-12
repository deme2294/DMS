

/**
 * If an ID is a UUID or long string, reduces it to a clean 4-character/digit identifier.
 */
export const toShortId = (id?: string | number | null): string => {
  if (id == null) return '';
  const str = String(id).trim();
  if (!str) return '';
  // Do NOT truncate reference numbers (e.g. HD-2026-00008, TK-2026-00001, KB-2026-0001, NOT-2026-001)
  if (/^[A-Za-z]{2,8}-\d+/i.test(str)) {
    return str;
  }
  // If it's already a clean 4-digit number (e.g. 1001, 2001, 3001)
  if (/^\d{1,4}$/.test(str)) {
    return str;
  }
  // Known seed UUID mappings to 4-digit numeric User IDs
  if (/^aaaaaaaa-aaaa/i.test(str)) return '1001';
  if (/^bbbbbbbb-bbbb/i.test(str)) return '1002';
  if (/^cccccccc-cccc/i.test(str)) return '1003';
  if (/^cccccccc-cecc/i.test(str)) return '1004';
  if (/^ffffffff-ffff/i.test(str)) return '1005';
  if (/^11111111-1111/i.test(str)) return '3001';

  // Standard 36-character UUID with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx -> 4 characters
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.slice(0, 4);
  }
  // Repetitive mock UUID blocks (e.g. dddddddd-dddd-dddd-dddd-dddddddddddd, 11111111-1111-...)
  if (/^[0-9a-zA-Z]{8}(-[0-9a-zA-Z]{4}){3}-[0-9a-zA-Z]{12}$/i.test(str)) {
    return str.slice(0, 4);
  }
  // Hexadecimal or long alphanumeric strings longer than 4 chars without hyphens
  if (str.length > 4 && /^[0-9a-zA-Z]+$/.test(str)) {
    return str.slice(0, 4);
  }
  return str;
};

/**
 * Reduces a department identifier: prefers 4-digit ID or code (e.g. '2001', 'IT') over full UUID.
 */
export const toShortDepartmentId = (dept?: { id?: string | null; code?: string | null } | string | null): string => {
  if (!dept) return '';
  if (typeof dept === 'string') {
    return toShortId(dept);
  }
  if (dept.id && /^\d{1,4}$/.test(String(dept.id))) return String(dept.id);
  return dept.code || toShortId(dept.id);
};

/**
 * Reduces a user identifier: prefers 4-digit userCode or 4-digit ID over full 36-char UUID.
 */
export const toShortUserId = (user?: { id?: string | null; userNum?: number | string | null; userCode?: string | null } | string | null): string => {
  if (!user) return '';
  if (typeof user === 'string' || typeof user === 'number') {
    return toShortId(user);
  }
  if (user.userCode && /^\d{1,4}$/.test(String(user.userCode))) return String(user.userCode);
  if (user.id && /^\d{1,4}$/.test(String(user.id))) return String(user.id);
  if (user.userCode) return String(user.userCode);
  if (user.userNum != null) return String(user.userNum);
  return toShortId(user.id);
};

/**
 * Reduces a ticket identifier: prefers referenceNumber or ticketNum or 4-char short ID over full 36-char UUID.
 */
export const toShortTicketId = (ticket?: { id?: string | null; referenceNumber?: string | null; ticketNum?: number | string | null } | string | null): string => {
  if (!ticket) return '';
  if (typeof ticket === 'string' || typeof ticket === 'number') {
    return toShortId(ticket);
  }
  if (ticket.referenceNumber) return String(ticket.referenceNumber);
  if (ticket.ticketNum != null) return String(ticket.ticketNum);
  return toShortId(ticket.id);
};

/**
 * Reduces a tenant identifier: prefers 4-digit tenantId or registrationNumber or 4-char short ID over full 36-char UUID.
 */
export const toShortTenantId = (tenant?: { id?: string | null; tenantId?: number | string | null; registrationNumber?: string | null } | string | null): string => {
  if (!tenant) return '';
  if (typeof tenant === 'string' || typeof tenant === 'number') {
    return toShortId(tenant);
  }
  if (tenant.id && /^\d{1,4}$/.test(String(tenant.id))) return String(tenant.id);
  if (tenant.tenantId != null) return String(tenant.tenantId);
  if (tenant.registrationNumber) return String(tenant.registrationNumber);
  return toShortId(tenant.id);
};

/**
 * Reduces a feedback identifier: prefers 4-digit feedbackNum, or 4-digit ID, or 4-char short ID over full UUID.
 */
export const toShortFeedbackId = (feedback?: { id?: string | null; feedbackNum?: number | string | null } | string | null): string => {
  if (!feedback) return '';
  if (typeof feedback === 'string' || typeof feedback === 'number') {
    return toShortId(feedback);
  }
  if (feedback.feedbackNum != null) return String(feedback.feedbackNum);
  if (feedback.id && /^\d{1,4}$/.test(String(feedback.id))) return String(feedback.id);
  return toShortId(feedback.id);
};

/**
 * Reduces a knowledge article identifier: prefers articleReference (e.g. KB-2026-0001) or 4-char short ID over full UUID.
 */
export const toShortKnowledgeId = (art?: { id?: string | null; articleReference?: string | null; article_reference?: string | null } | string | null): string => {
  if (!art) return '';
  if (typeof art === 'string') return toShortId(art);
  const ref = art.articleReference || art.article_reference;
  if (ref) return String(ref);
  return toShortId(art.id);
};

/**
 * Reduces a notice identifier: prefers 4-digit ID or 4-char short ID over full UUID.
 */
export const toShortNoticeId = (notice?: { id?: string | null } | string | null): string => {
  if (!notice) return '';
  if (typeof notice === 'string') return toShortId(notice);
  return toShortId(notice.id);
};
