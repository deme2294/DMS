import { ROLE_DASHBOARD } from '../config/routes';

/**
 * Resolves a deep-link target path into the authenticated user's role-appropriate route.
 * Handles ticket links, chat channels, knowledge base articles, feedback, notices, and notifications.
 */
export function resolveRoleRedirect(rawUrl: string, userRole?: string | null): string {
  const role = (userRole || 'tenant').toLowerCase();
  const rolePrefix = ['admin', 'manager', 'staff', 'ceo', 'tenant'].includes(role) ? `/${role}` : '/tenant';

  if (!rawUrl || !rawUrl.startsWith('/') || rawUrl.startsWith('//')) {
    return ROLE_DASHBOARD[role] ?? `${rolePrefix}/dashboard`;
  }

  // Parse path and query/hash
  const urlObj = new URL(rawUrl, 'http://localhost');
  const pathname = urlObj.pathname;
  const searchAndHash = urlObj.search + urlObj.hash;

  // 1. Ticket detail (/tickets/:id, /tenant/tickets/:id, /admin/tickets/:id, etc.)
  const ticketDetailMatch = pathname.match(/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/tickets\/([^/]+)$/);
  if (ticketDetailMatch) {
    const ticketId = ticketDetailMatch[1];
    if (ticketId !== 'create') {
      return `${rolePrefix}/tickets/${ticketId}${searchAndHash}`;
    }
  }

  // 2. Ticket list
  if (/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/tickets\/?$/.test(pathname)) {
    return `${rolePrefix}/tickets${searchAndHash}`;
  }

  // 3. Ticket create
  if (/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/tickets\/create\/?$/.test(pathname)) {
    return (role === 'tenant' ? '/tenant/tickets/create' : `${rolePrefix}/tickets`) + searchAndHash;
  }

  // 4. Chat (/chat, /chat?room=..., /admin/chat, etc.)
  if (/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/chat(?:\/.*)?$/.test(pathname)) {
    return `${rolePrefix}/chat${searchAndHash}`;
  }

  // 5. Knowledge base (/knowledge, /knowledge/:id, /manager/knowledge/approval, etc.)
  const knowledgeMatch = pathname.match(/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/knowledge(?:\/(.+))?$/);
  if (knowledgeMatch) {
    const subPath = knowledgeMatch[1];
    if (subPath) {
      if (subPath === 'approval' && role !== 'manager') {
        return `${rolePrefix}/knowledge${searchAndHash}`;
      }
      return `${rolePrefix}/knowledge/${subPath}${searchAndHash}`;
    }
    return `${rolePrefix}/knowledge${searchAndHash}`;
  }

  // 6. Feedback detail & list (/feedback, /feedback/:id, /manager/feedback/:id, /tenant/feedback, etc.)
  const feedbackMatch = pathname.match(/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/feedback(?:\/(.+))?$/);
  if (feedbackMatch) {
    const subPath = feedbackMatch[1];
    if (subPath) {
      if (subPath === 'create') {
        return (role === 'tenant' ? '/tenant/feedback/create' : `${rolePrefix}/feedback`) + searchAndHash;
      }
      return `${rolePrefix}/feedback/${subPath}${searchAndHash}`;
    }
    return `${rolePrefix}/feedback${searchAndHash}`;
  }

  // 7. Notices (/notices, /notices/:id)
  const noticeMatch = pathname.match(/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/notices(?:\/(.+))?$/);
  if (noticeMatch) {
    const subPath = noticeMatch[1];
    if (subPath) {
      return `${rolePrefix}/notices/${subPath}${searchAndHash}`;
    }
    return `${rolePrefix}/notices${searchAndHash}`;
  }

  // 8. Notifications
  if (/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/notifications(?:\/.*)?$/.test(pathname)) {
    return `${rolePrefix}/notifications${searchAndHash}`;
  }

  // 9. Profile
  if (/^(?:\/(?:tenant|admin|manager|staff|ceo))?\/profile(?:\/.*)?$/.test(pathname)) {
    return `${rolePrefix}/profile${searchAndHash}`;
  }

  // Fallback: prepend role prefix if path doesn't have it
  if (!pathname.startsWith(`/${role}/`)) {
    const stripped = pathname.replace(/^\/(?:admin|manager|staff|ceo|tenant)/, '');
    return `${rolePrefix}${stripped.startsWith('/') ? stripped : '/' + stripped}${searchAndHash}`;
  }

  return rawUrl;
}
