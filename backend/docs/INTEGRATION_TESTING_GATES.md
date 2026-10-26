# DMS External Integration: Professional Testing Gates & Developer Manual

> **Purpose:** Sequential quality gate verification and integration reference for external development teams integrating third-party systems, tenant portals, and automated microservices with the DMS Backend.  
> **API Version:** `1.0.0` | **OpenAPI Spec:** [`./openapi.yaml`](./openapi.yaml)  
> **Base URL:** `http://localhost:5005` (Development) / `https://dms-api.example.com` (Production)

---

## 📑 Table of Contents
1. [Standardized Endpoint Catalog (Titles & Operation IDs)](#1-standardized-endpoint-catalog)
2. [The 7 Professional Testing Gates](#2-the-7-professional-testing-gates)
   - [Gate 1: Infrastructure & Health Connectivity](#gate-1-infrastructure--health-connectivity)
   - [Gate 2: Authentication & Token Issuance](#gate-2-authentication--token-issuance)
   - [Gate 3: Reference Data & Category Routing](#gate-3-reference-data--category-routing)
   - [Gate 4: Ticket Submission & Attachment Multipart](#gate-4-ticket-submission--attachment-multipart)
   - [Gate 5: State Machine & Workflow Transitions](#gate-5-state-machine--workflow-transitions)
   - [Gate 6: SLA Verification & Deadline Monitoring](#gate-6-sla-verification--deadline-monitoring)
   - [Gate 7: Real-Time Chat & Socket.IO Handshake](#gate-7-real-time-chat--socketio-handshake)
3. [Developer Integration Code Samples (Node.js / Axios / Python)](#3-developer-integration-code-samples)
4. [Tenant Isolation & Boundary Rules](#4-tenant-isolation--boundary-rules)

---

## 1. Standardized Endpoint Catalog

Every endpoint is assigned a professional title, standardized `operationId` (matching OpenAPI), and permission tier:

### 🏥 System & Authentication
| Title | Operation ID | Method | Path | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **Get Service Info** | `getServiceInfo` | `GET` | `/api` | None (Public) |
| **Service Liveness Probe** | `getHealthCheck` | `GET` | `/api/health` | None (Public) |
| **Authenticate User** | `loginUser` | `POST` | `/api/auth/login` | None (Rate Limited) |
| **Refresh Access Token** | `refreshToken` | `POST` | `/api/auth/refresh` | Cookie (`refreshToken`) |
| **Get Current User Profile** | `getCurrentUser` | `GET` | `/api/auth/me` | Bearer JWT |
| **Invalidate Session** | `logoutUser` | `POST` | `/api/auth/logout` | Bearer JWT |

### 🎫 Ticket Operations & Workflow
| Title | Operation ID | Method | Path | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **Public Ticket Tracking** | `trackTicketPublic` | `GET` | `/api/tickets/track/:trackNumber` | None (Public) |
| **List & Filter Tickets** | `listTickets` | `GET` | `/api/tickets` | Bearer JWT (`tickets.read`) |
| **Submit New Ticket** | `createTicket` | `POST` | `/api/tickets` | Bearer JWT (`tenant` role) |
| **Get Ticket Details** | `getTicketById` | `GET` | `/api/tickets/:id` | Bearer JWT (`tickets.read`) |
| **Update Ticket Info** | `updateTicketDetails` | `PUT` | `/api/tickets/:id` | Bearer JWT (`tickets.read`) |
| **Delete Ticket** | `deleteTicket` | `DELETE` | `/api/tickets/:id` | Bearer JWT (`admin` role) |
| **Get Ticket Timeline** | `getTicketTimeline` | `GET` | `/api/tickets/:id/timeline` | Bearer JWT (`tickets.read`) |
| **Transition Ticket Status** | `updateTicketStatus` | `PATCH` | `/api/tickets/:id/status` | Bearer JWT (Role-checked) |
| **Mark Ticket Completed** | `markTicketCompleted` | `POST` | `/api/tickets/:id/complete` | Bearer JWT (`manager` role) |
| **Confirm / Approve Resolution** | `approveTicketResolution` | `POST` | `/api/tickets/:id/approve` | Bearer JWT (`tenant`/`manager`) |
| **Reject Proposed Resolution** | `rejectTicketResolution` | `POST` | `/api/tickets/:id/reject-completion` | Bearer JWT (`tenant`/`manager`) |
| **Formally Close Ticket** | `closeTicket` | `POST` | `/api/tickets/:id/close` | Bearer JWT (`tickets.close`) |
| **Reopen Closed Ticket** | `reopenTicket` | `POST` | `/api/tickets/:id/reopen` | Bearer JWT (`tickets.reopen`) |
| **Upload Ticket Attachment** | `uploadTicketAttachments` | `POST` | `/api/tickets/:id/attachments` | Bearer JWT (`tickets.create`) |
| **Add Discussion Reply** | `addTicketReply` | `POST` | `/api/tickets/:id/replies` | Bearer JWT (`tickets.create`) |
| **Get Discussion Replies** | `getTicketReplies` | `GET` | `/api/tickets/:id/replies` | Bearer JWT (`tickets.read`) |

### 📂 Routing, Categories & SLA
| Title | Operation ID | Method | Path | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **List Active Categories** | `listCategories` | `GET` | `/api/ticket-categories` | Optional (Public) |
| **Get Category Details** | `getCategoryById` | `GET` | `/api/ticket-categories/:id` | Optional (Public) |
| **Preview SLA Targets** | `previewSLADeadlines` | `GET` | `/api/sla/preview` | Optional (Public) |
| **List SLA Policies** | `listSLAPolicies` | `GET` | `/api/sla` | Optional (Public) |
| **List Active Departments** | `listActiveDepartments` | `GET` | `/api/departments/active` | Optional (Public) |

### 💬 Chat & Real-Time Messaging
| Title | Operation ID | Method | Path | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **List User Chat Rooms** | `listUserChatRooms` | `GET` | `/api/chat/rooms` | Bearer JWT |
| **Get Chat Room Details** | `getChatRoomById` | `GET` | `/api/chat/rooms/:roomId` | Bearer JWT |
| **Get / Create Ticket Room** | `getOrCreateTicketChatRoom`| `POST`| `/api/chat/rooms/ticket` | Bearer JWT |
| **Get Room Message History** | `getRoomMessages` | `GET` | `/api/chat/rooms/:roomId/messages` | Bearer JWT |
| **Send Chat Message** | `sendChatMessage` | `POST` | `/api/chat/messages` | Bearer JWT |
| **Upload Chat Attachment** | `uploadChatAttachment` | `POST` | `/api/chat/upload` | Bearer JWT |
| **Mark Messages Read** | `markChatMessagesRead` | `POST` | `/api/chat/rooms/:roomId/read` | Bearer JWT |

---

## 2. The 7 Professional Testing Gates

Integrators must pass each gate sequentially before promoting their integration to staging or production.

### Gate 1: Infrastructure & Health Connectivity
* **Objective:** Ensure the external server can reach the DMS host and verify database pool health.
* **Command:**
  ```bash
  curl -s -X GET "http://localhost:5005/api/health"
  ```
* **Success Criteria (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "operational",
    "connections": {
      "database": "healthy"
    }
  }
  ```

---

### Gate 2: Authentication & Token Issuance
* **Objective:** Obtain a valid JWT access token using registered credentials.
* **Command:**
  ```bash
  curl -s -X POST "http://localhost:5005/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "identifier": "tenant_acme@example.com",
      "password": "Password123!"
    }'
  ```
* **Success Criteria (`200 OK`):**
  Capture the `token` string and confirm `user.role === "tenant"`. Store in environment variable `AUTH_TOKEN`.

---

### Gate 3: Reference Data & Category Routing
* **Objective:** Fetch active categories and department IDs needed to construct ticket submission payloads.
* **Command:**
  ```bash
  curl -s -X GET "http://localhost:5005/api/ticket-categories"
  ```
* **Success Criteria (`200 OK`):**
  Receive an array of active category objects containing `id`, `name`, and `routingType`. Select a valid category name or ID (e.g. `"Infrastructure"`).

---

### Gate 4: Ticket Submission & Attachment Multipart
* **Objective:** Successfully submit a ticket using `multipart/form-data` with an attached diagnostic log.
* **Command:**
  ```bash
  curl -s -X POST "http://localhost:5005/api/tickets" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -F "title=Gateway Latency Spike on /v1/checkout" \
    -F "description=Requests exceeding 1500ms between 10:00 and 10:30 UTC" \
    -F "category=Infrastructure" \
    -F "priority=high" \
    -F "attachments=@./debug.log;type=text/plain"
  ```
* **Success Criteria (`201 Created`):**
  Returns `ticket.id` (UUID), `ticket.trackNumber` (e.g. `TICK-20261022-7712`), and verified attachment array. Store `TICKET_ID`.

---

### Gate 5: State Machine & Workflow Transitions
* **Objective:** Verify status changes follow allowable role transitions.
* **Command:**
  ```bash
  curl -s -X PATCH "http://localhost:5005/api/tickets/$TICKET_ID/status" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "in_progress",
      "notes": "External integration initiated automated log collection."
    }'
  ```
* **Success Criteria (`200 OK`):**
  Response confirms `ticket.status === "in_progress"`.
* **Failure Gate Test:** Attempting an invalid transition (e.g. from `closed` directly to `in_progress`) must return `400 Bad Request` with state machine error message.

---

### Gate 6: SLA Verification & Deadline Monitoring
* **Objective:** Verify first-response and resolution deadlines are populated automatically.
* **Command:**
  ```bash
  curl -s -X GET "http://localhost:5005/api/tickets/$TICKET_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN"
  ```
* **Success Criteria (`200 OK`):**
  Verify that `firstResponseDeadline` and `resolutionDeadline` are non-null ISO8601 timestamps and `slaStatus === "normal"`.

---

### Gate 7: Real-Time Chat & Socket.IO Handshake
* **Objective:** Join the conversation room for the newly created ticket and exchange messages.
* **Step A: Provision Room via REST:**
  ```bash
  curl -s -X POST "http://localhost:5005/api/chat/rooms/ticket" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "ticketId": "'$TICKET_ID'" }'
  ```
* **Step B: Connect Socket.IO Client:**
  ```javascript
  import { io } from 'socket.io-client';

  const socket = io('http://localhost:5005', {
    auth: { token: process.env.AUTH_TOKEN }
  });

  socket.on('connect', () => {
    // Join ticket alert channel
    socket.emit('join-ticket', { ticketId: process.env.TICKET_ID });
  });

  socket.on('ticket:status_changed', (event) => {
    console.log('Real-time Status Alert Received:', event);
  });
  ```

---

## 3. Developer Integration Code Samples

### Complete Node.js / TypeScript Integration Client
```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

interface DMSTicketResponse {
  success: boolean;
  ticket: {
    id: string;
    trackNumber: string;
    status: string;
    slaStatus: string;
    firstResponseDeadline: string;
  };
}

export class DMSClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = 'http://localhost:5005') {
    this.baseUrl = baseUrl;
  }

  // 1. Authenticate
  async authenticate(identifier: string, password: string): Promise<string> {
    const res = await axios.post(`${this.baseUrl}/api/auth/login`, { identifier, password });
    if (!res.data.success) throw new Error('DMS Authentication failed');
    this.token = res.data.token;
    return this.token;
  }

  // 2. Submit Ticket with Attachment
  async submitTicket(params: {
    title: string;
    description: string;
    category: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    attachmentPath?: string;
  }): Promise<DMSTicketResponse> {
    if (!this.token) throw new Error('Client is not authenticated. Call authenticate() first.');

    const form = new FormData();
    form.append('title', params.title);
    form.append('description', params.description);
    form.append('category', params.category);
    if (params.priority) form.append('priority', params.priority);

    if (params.attachmentPath && fs.existsSync(params.attachmentPath)) {
      form.append('attachments', fs.createReadStream(params.attachmentPath));
    }

    const response = await axios.post<DMSTicketResponse>(`${this.baseUrl}/api/tickets`, form, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...form.getHeaders()
      }
    });

    return response.data;
  }

  // 3. Track Status
  async getTicket(ticketId: string) {
    const response = await axios.get(`${this.baseUrl}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data.ticket;
  }
}
```

---

## 4. Tenant Isolation & Boundary Rules

1. **No Client-Supplied Tenant IDs:** The server extracts `tenant_id` exclusively from the signed JWT payload. Passing `tenantId` in POST/PUT bodies will be ignored or rejected to guarantee zero cross-tenant spoofing.
2. **Automatic Query Sandboxing:** All list endpoints automatically inject `WHERE tenant_id = :authenticatedTenantId` when invoked by accounts with the `tenant` role.
3. **Attachment Storage Isolation:** Files uploaded to `/uploads/tickets` are referenced by UUID and protected from path traversal. Executable binaries are blocked by server-side MIME filtering.
