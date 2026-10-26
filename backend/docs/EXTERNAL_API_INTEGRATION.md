# DMS Backend API: External System Integration Specification

> **Target Audience:** Integration Engineers, Backend Developers, and External System Architects.  
> **Backend Version:** 1.0.0 (Express / Node.js / MySQL / Socket.IO)  
> **Document Status:** Complete & Verified against Source Code  
> **OpenAPI Specification:** [`./openapi.yaml`](./openapi.yaml)

---

## 1. System Overview & Architecture

The Help Desk Management System (DMS) provides an enterprise multi-tenant ticketing, service-level agreement (SLA) tracking, and real-time communication platform. External systems integrating with DMS can create tickets, track resolution progress, participate in ticket discussions, upload diagnostic files, and synchronize real-time updates.

### 1.1 Base URL & Environment Configuration

| Environment | Base URL | Notes |
| :--- | :--- | :--- |
| **Local Development** | `http://localhost:5005` | Auto-ports upward (`5006+`) if port 5005 is busy. |
| **Production** | `https://dms-api.yourdomain.com` | Terminated with TLS/HTTPS. All endpoints are under `/api`. |
| **Static Attachments** | `{BASE_URL}/uploads/{subfolder}/{filename}` | Cross-Origin Resource Policy: `cross-origin`. |

---

## 2. Authentication & Authorization Model

### 2.1 Identity Verification Flow
DMS uses **JSON Web Tokens (JWT)** for API authentication:
1. **Login:** Send `POST /api/auth/login` with registered credentials (`identifier` and `password`).
2. **Access Token:** The response returns `token` (JWT signed with `JWT_SECRET`).
3. **Subsequent Requests:** Supply the token in the standard HTTP header:
   ```http
   Authorization: Bearer <jwt_access_token>
   ```
4. **Token Refresh:** For browser-based callers, a refresh cookie is issued. For M2M / external server callers, re-authenticate via `/api/auth/login` when the access token expires (configured via `JWT_EXPIRES_IN`, default 24h).

### 2.2 Roles and Permission Hierarchy
The backend enforces Role-Based Access Control (`roleMiddleware.js`):
- `tenant`: Submits tickets, views own tickets, uploads attachments, chats on own tickets, approves/confirms resolution.
- `staff`: Assigned to tickets, executes technical work, transitions status, posts internal notes and replies.
- `manager`: Oversees departmental queue, assigns staff, approves completed work, manages categories.
- `admin`: Global administrator; manages departments, SLA policies, user roles, system settings.
- `ceo`: Executive read-only oversight across departments and tickets, plus merge capabilities.

### 2.3 Strict Tenant Isolation
- When a ticket is submitted via `POST /api/tickets`, the backend retrieves `req.user.tenant_id` directly from the authenticated JWT.
- External callers **cannot** supply an arbitrary `tenantId` in the request body to spoof another organization.
- Queries (`GET /api/tickets`) automatically append `WHERE t.tenant_id = :tenantId` when the authenticated user role is `tenant`.

---

## 3. Complete API Endpoint Inventory

| Module | Method | Exact Path | Purpose | Auth | Role / Permission | Params / Query | Request Body | Success Code & Response | Error Codes | Status | Notes for External Integration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api` | Root service info & subsystem health | None | Public | None | None | `200` JSON info object | `500` | VERIFIED | Reports DB connectivity and active sockets. |
| **System** | `GET` | `/api/health` | Service liveness probe | None | Public | None | None | `200` `{ success: true, status: "operational" }` | `500` | VERIFIED | Use for external heartbeat monitoring. |
| **Auth** | `POST` | `/api/auth/login` | Authenticate user & get JWT | None | Public (Rate-limited) | None | `{ identifier, password }` | `200` `{ success: true, token, user }` | `400, 401, 429` | VERIFIED | Rate-limited to prevent brute force. |
| **Auth** | `POST` | `/api/auth/refresh` | Refresh access token | Cookie | Refresh Cookie | None | None | `200` `{ success: true, token }` | `401` | VERIFIED | Requires valid `refreshToken` cookie. |
| **Auth** | `GET` | `/api/auth/me` | Current caller identity | Bearer | Any authenticated | None | None | `200` `{ success: true, user, permissions }` | `401` | VERIFIED | Validates token validity. |
| **Auth** | `POST` | `/api/auth/logout` | Invalidate session | Bearer | Any authenticated | None | None | `200` `{ success: true }` | `401` | VERIFIED | Clears cookies. |
| **Tickets** | `GET` | `/api/tickets/track/:trackNumber` | Public ticket tracking | None | Public | `trackNumber` (path) | None | `200` `{ success: true, ticket }` | `404` | VERIFIED | Safe for anonymous status lookups. |
| **Tickets** | `GET` | `/api/tickets` | List and filter tickets | Bearer | `tickets.read` / `tickets.create` | `page, limit, status, priority, sortBy, sortOrder` | None | `200` `{ success: true, data: [...], pagination }` | `400, 401, 403` | VERIFIED | Tenant role scoped automatically to own tenant. |
| **Tickets** | `POST` | `/api/tickets` | Submit new ticket | Bearer | `tickets.create` (`tenant` role) | None | `multipart/form-data`: `title, description, category, priority, departmentId, attachments` | `201` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Up to 5 files (max 10MB each). Category can be name or ID. |
| **Tickets** | `GET` | `/api/tickets/:id` | Get full ticket details | Bearer | `tickets.read` / `tickets.create` | `id` (UUID path) | None | `200` `{ success: true, ticket }` | `401, 403, 404` | VERIFIED | Returns computed SLA deadlines and attachments. |
| **Tickets** | `PUT` | `/api/tickets/:id` | Update ticket metadata | Bearer | `tickets.assign` / `tickets.create` | `id` (UUID path) | `{ title, description, category, priority, departmentId, assignedTo }` | `200` `{ success: true, ticket }` | `400, 401, 403, 404` | VERIFIED | Partial field updates supported. |
| **Tickets** | `DELETE` | `/api/tickets/:id` | Delete ticket | Bearer | `admin` role | `id` (UUID path) | None | `200` `{ success: true }` | `401, 403, 404` | VERIFIED | Restrict to system admin cleanups. |
| **Tickets** | `GET` | `/api/tickets/:id/timeline` | Audit history of ticket events | Bearer | `tickets.read` / `tickets.create` | `id` (UUID path) | None | `200` `{ success: true, timeline: [...] }` | `401, 403, 404` | VERIFIED | Complete status changes and reassignment records. |
| **Workflow** | `PATCH` | `/api/tickets/:id/status` | Transition ticket status | Bearer | Role-checked transition | `id` (UUID path) | `{ status, notes, departmentId, assignedTo }` | `200` `{ success: true, ticket }` | `400, 401, 403, 404` | VERIFIED | Validates allowed transitions per user role. |
| **Workflow** | `POST` | `/api/tickets/:id/complete` | Mark completed by staff/manager | Bearer | `tickets.complete` | `id` (UUID path) | `{ notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Moves ticket to `pending_approval` / completed state. |
| **Workflow** | `POST` | `/api/tickets/:id/approve` | Confirm/Approve resolution | Bearer | `tickets.approve` / `tickets.create` | `id` (UUID path) | `{ notes, rating, feedback }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Used by tenant to confirm resolution and rate service. |
| **Workflow** | `POST` | `/api/tickets/:id/reject-completion` | Reject proposed resolution | Bearer | `tickets.approve` / `tickets.create` | `id` (UUID path) | `{ notes, reason }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Reverts ticket back to `in_progress`. |
| **Workflow** | `POST` | `/api/tickets/:id/close` | Formally close ticket | Bearer | `tickets.close` / `tickets.assign` | `id` (UUID path) | `{ notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Sets status to `closed`. |
| **Workflow** | `POST` | `/api/tickets/:id/reopen` | Reopen resolved ticket | Bearer | `tickets.reopen` / `tickets.create` | `id` (UUID path) | `{ reason, notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Reopens closed/resolved tickets within allowed window. |
| **Assignment** | `POST` | `/api/tickets/:id/assign-department` | Assign ticket to department | Bearer | `admin` role | `id` (UUID path) | `{ departmentId, managerId, assignedTo, notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Assigns department and optionally manager. |
| **Assignment** | `POST` | `/api/tickets/:id/assign-staff` | Assign ticket to technician | Bearer | `tickets.assign` | `id` (UUID path) | `{ staffId, notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Assigns active department technician. |
| **Assignment** | `POST` | `/api/tickets/:id/reassign` | Reassign technician | Bearer | `tickets.reassign` | `id` (UUID path) | `{ staffId, notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Changes assignee and notifies technician. |
| **Assignment** | `PATCH` | `/api/tickets/:id/assignment` | Override assignment attribution | Bearer | `admin` role | `id` (UUID path) | `{ assignedTo, assignedBy, notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Admin administrative override. |
| **Assignment** | `POST` | `/api/tickets/:id/accept` | Accept assignment | Bearer | Assigned staff/manager | `id` (UUID path) | None | `200` `{ success: true }` | `401, 403, 404` | VERIFIED | Technician acknowledges ticket. |
| **Assignment** | `POST` | `/api/tickets/:id/reject` | Reject assignment | Bearer | Assigned staff/manager | `id` (UUID path) | `{ reason }` | `200` `{ success: true }` | `401, 403, 404` | VERIFIED | Rejection notifies manager. |
| **Assignment** | `GET` | `/api/tickets/departments/:departmentId/managers` | Get department managers | Bearer | `tickets.read`, `tickets.assign` | `departmentId` (path) | None | `200` `{ success: true, data: [...] }` | `401, 403` | VERIFIED | Lists eligible managers for routing. |
| **Escalation** | `POST` | `/api/tickets/:id/escalate` | Manually escalate ticket | Bearer | `tickets.escalate`, `tickets.assign` | `id` (UUID path) | `{ notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Flags ticket as escalated and records audit reason. |
| **Merge** | `GET` | `/api/tickets/:id/merge-candidates` | Find duplicate ticket candidates | Bearer | `admin`, `ceo` roles | `id` (UUID path) | None | `200` `{ success: true, candidates: [...] }` | `401, 403` | VERIFIED | Finds similar open tickets. |
| **Merge** | `POST` | `/api/tickets/:id/merge` | Merge duplicate tickets | Bearer | `admin`, `ceo` roles | `id` (UUID path) | `{ sourceIds: [...], notes }` | `200` `{ success: true, ticket }` | `400, 401, 403` | VERIFIED | Closes source tickets with merge reference. |
| **Notes & Discussion** | `POST` | `/api/tickets/:id/internal-note` | Add private staff note | Bearer | `tickets.internal_note` | `id` (UUID path) | `{ message, departmentId }` | `201` `{ success: true }` | `400, 401, 403` | VERIFIED | Hidden from tenant callers. |
| **Notes & Discussion** | `POST` | `/api/tickets/:id/replies` | Add discussion reply | Bearer | `tickets.read` / `tickets.create` | `id` (UUID path) | `{ message, visibility, attachmentId }` | `201` `{ success: true, reply }` | `400, 401, 403` | VERIFIED | Public or scoped discussion. |
| **Notes & Discussion** | `GET` | `/api/tickets/:id/replies` | Get discussion replies | Bearer | `tickets.read` / `tickets.create` | `id` (UUID path) | None | `200` `{ success: true, replies: [...] }` | `401, 403` | VERIFIED | Scoped according to user permissions. |
| **Attachments** | `POST` | `/api/tickets/:id/attachments` | Upload additional attachments | Bearer | `tickets.read` / `tickets.create` | `id` (UUID path) | `multipart/form-data`: `attachments` (max 5) | `201` `{ success: true, attachments: [...] }` | `400, 401, 413` | VERIFIED | Max 10MB per file. |
| **Notifications** | `GET` | `/api/tickets/notifications` | Get user notifications | Bearer | Any authenticated | None | None | `200` `{ success: true, notifications: [...] }` | `401` | VERIFIED | Chronological notifications list. |
| **Notifications** | `GET` | `/api/tickets/notifications/unread-count` | Get unread notification count | Bearer | Any authenticated | None | None | `200` `{ success: true, unreadCount }` | `401` | VERIFIED | Badge count polling. |
| **Notifications** | `PATCH` | `/api/tickets/notifications/:id/read` | Mark notification read | Bearer | Any authenticated | `id` (path) | None | `200` `{ success: true }` | `401` | VERIFIED | Mark individual notification. |
| **Notifications** | `PATCH` | `/api/tickets/notifications/read-all` | Mark all notifications read | Bearer | Any authenticated | None | None | `200` `{ success: true }` | `401` | VERIFIED | Mark all read in bulk. |
| **Notifications** | `DELETE` | `/api/tickets/notifications/:id` | Delete notification | Bearer | Any authenticated | `id` (path) | None | `200` `{ success: true }` | `401` | VERIFIED | Cleans up notification item. |
| **Categories** | `GET` | `/api/ticket-categories` | List active categories | Optional | Public / Any | `departmentId` (query) | None | `200` `{ success: true, data: [...] }` | `500` | VERIFIED | Essential reference for ticket submission. |
| **Categories** | `GET` | `/api/ticket-categories/:id` | Get category details | Optional | Public / Any | `id` (path) | None | `200` `{ success: true, data }` | `404` | VERIFIED | Category and routing metadata. |
| **Categories** | `POST` | `/api/ticket-categories` | Create category | Bearer | `admin`, `manager`, `ceo` | None | `{ name, description, departmentId, slaPolicyId, routingType }` | `201` `{ success: true, data }` | `400, 401, 403` | VERIFIED | `direct` routing requires `departmentId`. |
| **Categories** | `PUT` | `/api/ticket-categories/:id` | Update category | Bearer | `admin`, `manager`, `ceo` | `id` (path) | `{ name, description, departmentId, slaPolicyId, routingType, isActive }` | `200` `{ success: true, data }` | `400, 401, 403` | VERIFIED | Updates active status & routing. |
| **Categories** | `DELETE` | `/api/ticket-categories/:id` | Delete category | Bearer | `admin`, `ceo` | `id` (path) | None | `200` `{ success: true }` | `401, 403` | VERIFIED | Deletes category. |
| **Categories** | `GET` | `/api/ticket-categories/requests` | List manager category proposals | Bearer | `admin`, `ceo` | `status` (query) | None | `200` `{ success: true, data: [...] }` | `401, 403` | VERIFIED | Approval queue for proposed categories. |
| **Categories** | `POST` | `/api/ticket-categories/:id/approve` | Approve proposed category | Bearer | `admin`, `ceo` | `id` (path) | `{ reviewNotes }` | `200` `{ success: true }` | `401, 403` | VERIFIED | Activates proposed category. |
| **Categories** | `POST` | `/api/ticket-categories/:id/reject` | Reject proposed category | Bearer | `admin`, `ceo` | `id` (path) | `{ reviewNotes }` | `200` `{ success: true }` | `401, 403` | VERIFIED | Rejects proposed category. |
| **SLA** | `GET` | `/api/sla/preview` | Preview SLA deadlines | Optional | Public / Any | `categoryId, priority, createdAt` | None | `200` `{ success: true, preview: {...} }` | `400` | VERIFIED | Predicts first-response & resolution targets. |
| **SLA** | `GET` | `/api/sla` | List SLA policies | Optional | Public / Any | `categoryId` (query) | None | `200` `{ success: true, data: [...] }` | `500` | VERIFIED | Lists SLA policies. |
| **SLA** | `GET` | `/api/sla/:id` | Get SLA policy details | Bearer | Any authenticated | `id` (path) | None | `200` `{ success: true, policy }` | `401, 404` | VERIFIED | Configured hours & priority rules. |
| **SLA** | `POST` | `/api/sla` | Create SLA policy | Bearer | `admin`, `ceo` | None | `{ name, priority, categoryId, responseHours, resolutionHours, escalationHours, workingHours }` | `201` `{ success: true, policy }` | `400, 401, 403` | VERIFIED | Enforces: `resolutionHours > responseHours`. |
| **SLA** | `PUT` | `/api/sla/:id` | Update SLA policy | Bearer | `admin`, `ceo` | `id` (path) | Policy fields, `isActive` | `200` `{ success: true, policy }` | `400, 401, 403` | VERIFIED | Modifies SLA parameters. |
| **SLA** | `DELETE` | `/api/sla/:id` | Delete SLA policy | Bearer | `admin`, `ceo` | `id` (path) | None | `200` `{ success: true }` | `401, 403` | VERIFIED | Removes policy. |
| **SLA** | `POST` | `/api/sla/:id/test-compute` | Test SLA computation | Bearer | Any authenticated | `id` (path) | `{ createdAt }` | `200` `{ success: true, targets }` | `401, 404` | VERIFIED | Simulates target calculation for verification. |
| **Chat** | `GET` | `/api/chat/rooms` | List caller chat rooms | Bearer | Any authenticated | None | None | `200` `{ success: true, rooms: [...] }` | `401` | VERIFIED | Returns ticket, direct, and departmental rooms. |
| **Chat** | `GET` | `/api/chat/rooms/:roomId` | Get chat room details | Bearer | Room participant | `roomId` (UUID path) | None | `200` `{ success: true, room }` | `401, 403, 404` | VERIFIED | Returns metadata and participant status. |
| **Chat** | `POST` | `/api/chat/rooms/ticket` | Find/Create ticket chat room | Bearer | Ticket participant | None | `{ ticketId, name }` | `200/201` `{ success: true, room }` | `400, 401, 403` | VERIFIED | Auto-adds ticket tenant & assigned staff. |
| **Chat** | `POST` | `/api/chat/rooms/department` | Create department room | Bearer | Department member/admin | None | `{ departmentId, name }` | `200/201` `{ success: true, room }` | `400, 401, 403` | VERIFIED | For internal departmental chat. |
| **Chat** | `POST` | `/api/chat/rooms/direct` | Find/Create DM room | Bearer | Any authenticated | None | `{ userId, name }` | `200/201` `{ success: true, room }` | `400, 401` | VERIFIED | 1-on-1 private messaging. |
| **Chat** | `GET` | `/api/chat/rooms/:roomId/participants` | List room participants | Bearer | Room participant | `roomId` (UUID path) | None | `200` `{ success: true, participants: [...] }` | `401, 403` | VERIFIED | Returns user IDs, roles, and online states. |
| **Chat** | `POST` | `/api/chat/rooms/:roomId/participants` | Add participant to room | Bearer | Room member / admin | `roomId` (UUID path) | `{ userId }` | `200` `{ success: true }` | `400, 401, 403` | VERIFIED | Adds user to conversation room. |
| **Chat** | `GET` | `/api/chat/rooms/:roomId/messages` | Get message history | Bearer | Room participant | `roomId` (path), `limit, offset` | None | `200` `{ success: true, messages: [...] }` | `401, 403` | VERIFIED | Paged message history with attachments. |
| **Chat** | `POST` | `/api/chat/messages` | Send message (REST fallback) | Bearer | Room participant | None | `{ roomId, message, messageType }` | `201` `{ success: true, message }` | `400, 401, 403` | VERIFIED | Emits `new-message` to Socket.IO clients. |
| **Chat** | `PUT` | `/api/chat/messages/:messageId` | Edit message | Bearer | Message author | `messageId` (UUID path) | `{ message }` | `200` `{ success: true, message }` | `400, 401, 403` | VERIFIED | Updates text and broadcasts edit event. |
| **Chat** | `DELETE` | `/api/chat/messages/:messageId` | Delete message | Bearer | Message author / admin | `messageId` (UUID path) | None | `200` `{ success: true }` | `401, 403` | VERIFIED | Soft-deletes message. |
| **Chat** | `POST` | `/api/chat/rooms/:roomId/read` | Mark messages as read | Bearer | Room participant | `roomId` (path) | `{ messageIds: [...] }` | `200` `{ success: true }` | `401, 403` | VERIFIED | Resets unread counters and broadcasts event. |
| **Chat** | `GET` | `/api/chat/unread` | Get unread message count | Bearer | Any authenticated | None | None | `200` `{ success: true, unreadCount }` | `401` | VERIFIED | Total unread chat count across all rooms. |
| **Chat** | `GET` | `/api/chat/search` | Search chat messages | Bearer | Any authenticated | `q` (query string) | None | `200` `{ success: true, messages: [...] }` | `400, 401` | VERIFIED | Full-text query on authorized rooms. |
| **Chat** | `POST` | `/api/chat/upload` | Upload chat attachment | Bearer | Any authenticated | None | `multipart/form-data`: `file` | `200` `{ success: true, fileUrl, originalName, mimeType, size }` | `400, 401, 413` | VERIFIED | Max 10MB file stored in `/uploads/chat`. |
| **Chat** | `GET` | `/api/chat/online-users` | List active online users | Bearer | Any authenticated | None | None | `200` `{ success: true, users: [...] }` | `401` | VERIFIED | Real-time presence tracked by Socket.IO. |
| **Departments** | `GET` | `/api/departments/active` | Active departments reference | Optional | Public / Any | None | None | `200` `{ success: true, data: [...] }` | `500` | VERIFIED | Use to populate ticket submission forms. |
| **Departments** | `GET` | `/api/departments` | List all departments | Bearer | `departments.manage` | `page, limit, status` | None | `200` `{ success: true, data: [...], pagination }` | `401, 403` | VERIFIED | Admin department listing. |
| **Departments** | `GET` | `/api/departments/:id/members` | List department staff | Bearer | `departments.manage` | `id` (path) | None | `200` `{ success: true, data: [...] }` | `401, 403` | VERIFIED | Technicians and managers in department. |
| **Tenants** | `POST` | `/api/tenants/register` | Self-register organization | None | Public | None | `{ organizationName, contactPerson, email, username, password, confirmPassword, phone, address, registrationNumber }` | `201` `{ success: true, tenant, user }` | `400, 409` | VERIFIED | Creates tenant organization and primary user. |
| **Tenants** | `GET` | `/api/tenants/profile/me` | Current tenant profile | Bearer | `tenant` role | None | None | `200` `{ success: true, tenant }` | `401, 403` | VERIFIED | Organization details of the authenticated caller. |

---

## 4. Realistic Request & Response Examples

### 4.1 Authentication: Login (`POST /api/auth/login`)
#### Request:
```http
POST /api/auth/login HTTP/1.1
Host: localhost:5005
Content-Type: application/json

{
  "identifier": "tenant_acme@example.com",
  "password": "Password123!"
}
```
#### Success Response (`200 OK`):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFkMmUzZjRhLTViNmMtN2Q4ZS05ZjBhLTFiMmMzZDRlNWY2YSIsInRlbmFudF9pZCI6IjVhYjFjM2Q0LWU1ZjYtN2E4Yi05YzBkLTFlMmYzYTRiNWM2ZCIsInJvbGUiOiJ0ZW5hbnQiLCJpYXQiOjE3Mjk2MDAwMDAsImV4cCI6MTcyOTY4NjQwMH0.signature",
  "user": {
    "id": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
    "username": "acme_admin",
    "email": "tenant_acme@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "tenant",
    "tenantId": "5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "active",
    "departments": []
  }
}
```
#### Error Response (`401 Unauthorized`):
```json
{
  "success": false,
  "message": "Invalid email/username or password"
}
```

---

### 4.2 Submit Ticket (`POST /api/tickets`)
#### Request:
```http
POST /api/tickets HTTP/1.1
Host: localhost:5005
Authorization: Bearer <jwt_access_token>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="title"

API Gateway returns 502 Bad Gateway intermittently
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="description"

Every morning at 08:30 UTC, requests to /v1/payments fail with 502 Bad Gateway for 3-5 minutes.
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="category"

Infrastructure
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="priority"

high
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="departmentId"

dept-infra-01
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="attachments"; filename="gateway_logs.log"
Content-Type: text/plain

2026-10-22 08:31:02 [error] 1402#0: *882 recv() failed (104: Connection reset by peer)
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```
#### Success Response (`201 Created`):
```json
{
  "success": true,
  "ticket": {
    "id": "c1f7a840-a108-4e89-9a67-27b233a7e0f2",
    "trackNumber": "TICK-20261022-4821",
    "title": "API Gateway returns 502 Bad Gateway intermittently",
    "description": "Every morning at 08:30 UTC, requests to /v1/payments fail with 502 Bad Gateway for 3-5 minutes.",
    "status": "open",
    "priority": "high",
    "tenantId": "5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "departmentId": "dept-infra-01",
    "assignedTo": null,
    "categoryId": "c9284fae-1283-4a8e-9082-938210394812",
    "categoryName": "Infrastructure",
    "slaStatus": "normal",
    "isEscalated": false,
    "firstResponseDeadline": "2026-10-22T14:00:00.000Z",
    "resolutionDeadline": "2026-10-23T10:00:00.000Z",
    "createdAt": "2026-10-22T12:00:00.000Z",
    "updatedAt": "2026-10-22T12:00:00.000Z",
    "attachments": [
      {
        "id": "e8174920-bc29-4d29-a031-104928174092",
        "ticketId": "c1f7a840-a108-4e89-9a67-27b233a7e0f2",
        "fileName": "gateway_logs.log",
        "fileUrl": "/uploads/tickets/gateway_logs-1729600000000.log",
        "fileType": "text/plain",
        "fileSize": 1042,
        "uploadedAt": "2026-10-22T12:00:00.000Z"
      }
    ]
  }
}
```
#### Validation Error (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be between 3 and 200 characters"
    }
  ]
}
```

---

### 4.3 Get Ticket Details (`GET /api/tickets/:id`)
#### Request:
```http
GET /api/tickets/c1f7a840-a108-4e89-9a67-27b233a7e0f2 HTTP/1.1
Host: localhost:5005
Authorization: Bearer <jwt_access_token>
```
#### Success Response (`200 OK`):
```json
{
  "success": true,
  "ticket": {
    "id": "c1f7a840-a108-4e89-9a67-27b233a7e0f2",
    "trackNumber": "TICK-20261022-4821",
    "title": "API Gateway returns 502 Bad Gateway intermittently",
    "description": "Every morning at 08:30 UTC, requests to /v1/payments fail with 502 Bad Gateway for 3-5 minutes.",
    "status": "assigned",
    "priority": "high",
    "tenantId": "5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "departmentId": "dept-infra-01",
    "assignedTo": "4b3e2a10-9c8d-4e7f-8a1b-2c3d4e5f6a7b",
    "assignedStaffName": "Alex Rivera",
    "categoryId": "c9284fae-1283-4a8e-9082-938210394812",
    "categoryName": "Infrastructure",
    "slaStatus": "normal",
    "isEscalated": false,
    "firstResponseDeadline": "2026-10-22T14:00:00.000Z",
    "resolutionDeadline": "2026-10-23T10:00:00.000Z",
    "firstResponseAt": "2026-10-22T12:45:10.000Z",
    "resolvedAt": null,
    "closedAt": null,
    "createdAt": "2026-10-22T12:00:00.000Z",
    "updatedAt": "2026-10-22T12:45:10.000Z",
    "attachments": []
  }
}
```

---

### 4.4 Transition Ticket Status (`PATCH /api/tickets/:id/status`)
#### Request:
```http
PATCH /api/tickets/c1f7a840-a108-4e89-9a67-27b233a7e0f2/status HTTP/1.1
Host: localhost:5005
Authorization: Bearer <jwt_access_token>
Content-Type: application/json

{
  "status": "in_progress",
  "notes": "Analyzing upstream container health metrics and TCP keepalive timings."
}
```
#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Status updated successfully",
  "ticket": {
    "id": "c1f7a840-a108-4e89-9a67-27b233a7e0f2",
    "status": "in_progress",
    "updatedAt": "2026-10-22T13:00:00.000Z"
  }
}
```
#### State Machine Rejection (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Cannot transition status from 'closed' to 'in_progress'. Use the reopen endpoint instead."
}
```

---

### 4.5 SLA Target Preview (`GET /api/sla/preview`)
#### Request:
```http
GET /api/sla/preview?categoryId=c9284fae-1283-4a8e-9082-938210394812&priority=urgent HTTP/1.1
Host: localhost:5005
```
#### Success Response (`200 OK`):
```json
{
  "success": true,
  "preview": {
    "priority": "urgent",
    "responseHours": 1,
    "resolutionHours": 4,
    "escalationHours": 2,
    "targetResponseDate": "2026-10-22T13:00:00.000Z",
    "targetResolutionDate": "2026-10-22T16:00:00.000Z",
    "targetEscalationDate": "2026-10-22T14:00:00.000Z"
  }
}
```

---

## 5. Real-Time Chat & Socket.IO Specification

DMS integrates an embedded Socket.IO real-time server operating on the same HTTP port as the REST API (`5005`).

### 5.1 Socket.IO Connection & Handshake Authentication
To establish a real-time connection from an external client:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5005', {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN' // Can also be passed as 'Authorization: Bearer <token>' in extraHeaders
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to DMS Socket.IO server, socket id:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Socket authentication failed:', err.message);
});
```

### 5.2 Room Subscriptions
Clients must join the specific ticket room or chat room to receive live messages and typing events.

| Client Outgoing Event | Payload | Purpose |
| :--- | :--- | :--- |
| `join-ticket` | `{ ticketId: "uuid" }` | Joins room `ticket:<ticketId>` for status & discussion alerts. |
| `leave-ticket` | `{ ticketId: "uuid" }` | Leaves ticket room. |
| `join-room` | `{ roomId: "uuid" }` | Joins chat conversation room `room:<roomId>`. |
| `leave-room` | `{ roomId: "uuid" }` | Leaves chat conversation room. |
| `send-message` | `{ roomId: "uuid", message: "text", messageType: "text" }` | Emits a new chat message into the room. |
| `edit-message` | `{ messageId: "uuid", message: "updated text" }` | Updates an existing message. |
| `delete-message`| `{ messageId: "uuid" }` | Deletes a message. |
| `typing-start` | `{ roomId: "uuid" }` | Informs room participants that the user is typing. |
| `typing-stop` | `{ roomId: "uuid" }` | Informs room participants that typing has stopped. |
| `mark-read` | `{ roomId: "uuid", messageIds: ["uuid"] }` | Acknowledges message receipt. |

### 5.3 Server Incoming Broadcast Events
Listeners registered on the external client receive:

| Server Event Name | Broadcast Payload Structure | Trigger Condition |
| :--- | :--- | :--- |
| `new-message` | `{ id, roomId, senderId, senderName, message, messageType, createdAt }` | Sent when any participant sends a message in the room. |
| `message-edited` | `{ messageId, roomId, message, updatedAt }` | Sent when an author modifies a message. |
| `message-deleted` | `{ messageId, roomId }` | Sent when a message is removed. |
| `user-typing` | `{ roomId, userId, username }` | Broadcast when a user begins typing. |
| `user-stopped-typing` | `{ roomId, userId }` | Broadcast when user stops typing or disconnects. |
| `messages-read` | `{ roomId, userId, messageIds }` | Broadcast when messages are marked as read. |
| `user-online` | `{ userId }` | Emitted globally when a user connects. |
| `user-offline` | `{ userId, lastSeen }` | Emitted globally when a user disconnects. |
| `ticket:created` | `{ ticketId, trackNumber, title, priority, tenantId }` | Emitted when a new ticket is submitted. |
| `ticket:status_changed` | `{ ticketId, status, updatedBy, updatedAt }` | Emitted when a ticket status changes. |
| `ticket:assigned` | `{ ticketId, assignedTo, departmentId }` | Emitted when a technician is assigned. |

---

## 6. SLA Background Worker & Automation

### 6.1 Internal Worker Mechanics
- **Frequency:** Executes every **60 seconds** in the background (`services/slaMonitorService.js`).
- **Functionality:**
  - Evaluates all `open`, `assigned`, and `in_progress` tickets against their `firstResponseDeadline` and `resolutionDeadline`.
  - Automatically flips `sla_status` from `normal` to `warning` when approaching 80% of SLA target time.
  - Automatically flips `sla_status` to `breached` when the current timestamp exceeds the deadline.
  - Automatically flags `is_escalated = 1` and creates an escalation audit entry if `escalationHours` threshold is exceeded without resolution.
  - Dispatches automated email notifications to department managers and administrators.
- **External Integration Guidance:**  
  *External systems do NOT need to poll or trigger SLA escalation calculations manually.* The backend continuously enforces deadlines. You can read current compliance status directly from `ticket.slaStatus` and `ticket.isEscalated`.

---

## 7. External Integration Best Practices

### 7.1 Duplicate Ticket Prevention & Idempotency
- When an external system submits tickets over an unstable network, retries can cause duplicate ticket creation.
- **Recommended Practice:** Prior to re-submitting a failed HTTP call, query `GET /api/tickets?status=open&sortBy=created_at&sortOrder=DESC` or track whether an initial request generated a tracking number.
- *(See Section 8 below for the proposed `Idempotency-Key` header API improvement).*

### 7.2 Handling Pagination
All list endpoints (`/api/tickets`, `/api/departments`, etc.) accept standard pagination parameters:
- `page`: 1-based integer index (default `1`).
- `limit`: items per page (default `10`, maximum `100`).
The response payload contains pagination metadata:
```json
"pagination": {
  "page": 1,
  "limit": 10,
  "total": 42,
  "pages": 5
}
```

### 7.3 Rate Limiting & Error Handling
- The login endpoint `/api/auth/login` enforces a rate limit (configured via `express-rate-limit`). External systems must cache JWT tokens until expiration rather than re-authenticating on every API call.
- Always check the `success` boolean in JSON responses. If `success === false`, inspect `message` and `errors` for field-specific validation failures.

---

## 8. Missing APIs for External Integration (Gap Analysis & Proposals)

While the existing API is rich and covers the full human-operator lifecycle, external system-to-system integrations would benefit from several missing enterprise capabilities. The following endpoints are **PROPOSED** for future implementation:

### 8.1 Machine-to-Machine (M2M) API Key Authentication
* **Gap:** External automated services currently must simulate a human tenant by logging in with a username/password via `/api/auth/login`.
* **Proposed Endpoint:** `POST /api/v1/auth/token`
* **Mechanism:** Support OAuth2 Client Credentials (`client_id` + `client_secret`) or permanent API Keys (`X-API-Key: dms_live_...`).

### 8.2 External Webhook Subscriptions
* **Gap:** External systems currently must poll `GET /api/tickets` to discover ticket status changes, assignment modifications, or SLA breaches.
* **Proposed Endpoints:**
  - `POST /api/webhooks/subscriptions` (Register callback URL, secret, and event filters).
  - `GET /api/webhooks/subscriptions` (List active webhooks).
  - `DELETE /api/webhooks/subscriptions/:id` (Deregister webhook).
* **Supported Events:** `ticket.created`, `ticket.status_changed`, `ticket.assigned`, `ticket.resolved`, `sla.warning`, `sla.breached`.

### 8.3 Idempotent Ticket Submission Header
* **Gap:** `POST /api/tickets` lacks native `Idempotency-Key` header caching. A network timeout during ticket creation can lead to duplicate tickets if retried.
* **Proposed Enhancement:** Accept `Idempotency-Key: <unique_uuid_from_client>` on `POST /api/tickets`. Cache the response in Redis/database for 24 hours.

### 8.4 Server-to-Server Tenant Delegation Header
* **Gap:** If a single external corporate orchestrator manages multiple tenants, it currently must maintain separate login tokens for every tenant account.
* **Proposed Enhancement:** Allow an authorized Integration Partner credential to submit tickets on behalf of a tenant using an explicit header: `X-Tenant-ID: <tenant_uuid>`.

---

## 9. Security & Integration Recommendations

1. **Token Storage:** Never log JWT tokens or embed credentials in client-side code. Use secure environment variables for M2M credentials.
2. **TLS Only:** Ensure all production traffic terminates over TLS 1.3 (`https://` and `wss://`).
3. **Cross-Tenant Access Verification:** Test all integration routines with two different tenant accounts to verify that Tenant A cannot access, query, or append replies to Tenant B's tickets.
4. **Attachment Safety:** External uploads are scanned and restricted by MIME types in `multer.js` (`image/*`, `application/pdf`, `application/msword`, `text/plain`). Executable binaries (`.exe`, `.sh`, `.bat`) are rejected.
