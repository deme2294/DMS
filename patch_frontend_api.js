import fs from 'fs';

// 1. Update frontend/src/types/ticket.ts
let ticketTypes = fs.readFileSync('frontend/src/types/ticket.ts', 'utf8');
if (!ticketTypes.includes('reopenRequestedAt')) {
  ticketTypes = ticketTypes.replace(
    'reopenReason?: string | null;',
    `reopenReason?: string | null;\r\n  reopenRequestedAt?: string | null;\r\n  reopenRequestedBy?: string | null;\r\n  reopenRequestedByName?: string | null;\r\n  reopenRequestReason?: string | null;\r\n  reopenStatus?: 'none' | 'requested' | 'approved' | 'rejected';`
  );
  fs.writeFileSync('frontend/src/types/ticket.ts', ticketTypes, 'utf8');
  console.log('Updated frontend/src/types/ticket.ts');
}

// 2. Update frontend/src/api/ticketApi.ts
let ticketApi = fs.readFileSync('frontend/src/api/ticketApi.ts', 'utf8');
if (!ticketApi.includes('requestReopenTicket')) {
  const reopenEndpoints = `export const requestReopenTicket = (id: string, reason: string) =>\r\n  api.post<{ success: boolean; message: string; data: Ticket }>(\`/tickets/\${id}/request-reopen\`, { reason });\r\n\r\nexport const approveReopenTicket = (id: string, notes?: string) =>\r\n  api.post<{ success: boolean; message: string; data: Ticket }>(\`/tickets/\${id}/approve-reopen\`, { notes });\r\n\r\nexport const rejectReopenTicket = (id: string, notes: string) =>\r\n  api.post<{ success: boolean; message: string; data: Ticket }>(\`/tickets/\${id}/reject-reopen\`, { notes });\r\n\r\n`;

  ticketApi = ticketApi.replace(
    'export const reopenTicket = (id: string, notes?: string, reason?: string) =>',
    reopenEndpoints + 'export const reopenTicket = (id: string, notes?: string, reason?: string) =>'
  );
  fs.writeFileSync('frontend/src/api/ticketApi.ts', ticketApi, 'utf8');
  console.log('Updated frontend/src/api/ticketApi.ts');
}

