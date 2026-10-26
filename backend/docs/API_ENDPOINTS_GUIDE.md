# DMS Help Desk Management System — Backend API Endpoints Reference Guide

> **Official Developer Reference Handbook & Integration Guide**  
> **Backend Architecture:** Node.js / Express / MySQL / Socket.IO  
> **Interactive Swagger UI:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs) *(or port 5005)*  
> **OpenAPI Specification File:** [`backend/docs/openapi.yaml`](./openapi.yaml)  

---

## 📌 Table of Contents

1. [How to Share This API with Other Developers](#-how-to-share-this-api-with-other-developers)
2. [Base URLs & Environment Setup](#-base-urls--environment-setup)
3. [Authentication & Token Workflow](#-authentication--token-workflow)
4. [Master Endpoints Inventory by Domain](#-master-endpoints-inventory-by-domain)
   - [01. System & Health Probes](#01-system--health-probes)
   - [02. Authentication & Identity](#02-authentication--identity)
   - [03. User Management](#03-user-management)
   - [04. Department Management](#04-department-management)
   - [05. Staff Assignment Matrix](#05-staff-assignment-matrix)
   - [06. Ticket Core Lifecycle (Create & Query)](#06-ticket-core-lifecycle-create--query)
   - [07. Ticket Workflow & Status Transitions](#07-ticket-workflow--status-transitions)
   - [08. Ticket Routing, Assignment & Merge](#08-ticket-routing-assignment--merge)
   - [09. Ticket Discussions & Private Notes](#09-ticket-discussions--private-notes)
   - [10. Ticket Attachments](#10-ticket-attachments)
   - [11. Ticket Notifications](#11-ticket-notifications)
   - [12. Ticket Categories & Routing Rules](#12-ticket-categories--routing-rules)
   - [13. Service Level Agreements (SLA)](#13-service-level-agreements-sla)
   - [14. Tenant Management & Registration](#14-tenant-management--registration)
   - [15. Internal Notices & Announcements](#15-internal-notices--announcements)
   - [16. Knowledge Base Articles](#16-knowledge-base-articles)
   - [17. Real-Time Chat & Video Meetings](#17-real-time-chat--video-meetings)
   - [18. Dashboards & Role Analytics](#18-dashboards--role-analytics)
   - [19. Reports & Excel Exports](#19-reports--excel-exports)
   - [20. Customer Feedback & Surveys](#20-customer-feedback--surveys)
   - [21. Audit Trail & Compliance](#21-audit-trail--compliance)
   - [22. Direct Email Communications](#22-direct-email-communications)
   - [23. Static Uploads & Files](#23-static-uploads--files)
5. [Real-Time Socket.IO Reference](#-real-time-socketio-reference)

---

## 🤝 How to Share This API with Other Developers

You have **4 professional ways** to hand off the backend endpoints to frontend developers, mobile engineers, or third-party teams:

### Option 1: Give Them the `openapi.yaml` File (Best for Postman & Swagger)
- **File location on your disk:**
  ```text
  c:\Users\hp\Desktop\DMS\backend\docs\openapi.yaml
  ```
- **How they use it in Postman:**
  1. Open Postman $\rightarrow$ Click **Import** (top left).
  2. Select or drag-and-drop `openapi.yaml`.
  3. Postman automatically builds a complete **DMS Help Desk Collection** with 23 folders, pre-filled parameters, JSON request payloads, and Bearer Token authentication.

### Option 2: Give Them the Interactive Swagger UI Browser URL (Zero Installation)
When the backend server is running (`npm start` or `node server.js`):
- **Local URL:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs) *(or port 5005)*
- **Raw Spec URL:** [http://localhost:5000/api/docs/openapi.yaml](http://localhost:5000/api/docs/openapi.yaml)
- **Features:** Other developers can open this in Chrome, Edge, or Firefox, view all request/response schemas, test endpoints live with the **"Try it out"** button, and copy ready-to-use `curl` commands.

### Option 3: Send This Document (`API_ENDPOINTS_GUIDE.md`)
- A single, self-contained Markdown file formatted with tables, exact parameters, payload examples, and role permissions.
- Can be viewed in GitHub, GitLab, VS Code, Notion, or converted to a PDF.

### Option 4: Re-generating the Spec Anytime
If you add or modify routes in the future, run:
```bash
npm run docs:generate
```
This regenerates `openapi.yaml` in 2 seconds.

---

## 🌐 Base URLs & Environment Setup

| Environment | Base URL | Notes |
| :--- | :--- | :--- |
| **Local Development** | `http://localhost:5000` *(or `5005`)* | Active Express server port |
| **Interactive Docs** | `http://localhost:5000/api/docs` | Swagger UI visual browser interface |
| **Staging / Production**| `https://dms-api.example.com` | Production TLS/HTTPS endpoint |
| **Socket.IO Real-time**| `ws://localhost:5000` | Path: `/socket.io` |
| **Static Attachments** | `http://localhost:5000/uploads/{subfolder}/{file}` | CORS-enabled static file storage |

---

## 🔐 Authentication & Token Workflow

1. **Login Request:** Send `POST /api/auth/login` with your credentials:
   ```json
   {
     "identifier": "admin",
     "password": "password"
   }
   ```
   *(Accepts `"identifier"`, `"username"`, or `"email"`. Passwords for all seed accounts default to `"password"`).*
2. **Access Token Header:** The response returns `token`. Add it to all subsequent requests:
   ```http
   Authorization: Bearer <jwt_token>
   ```
3. **Automate in Postman:**
   In the **Tests** tab of the `POST /api/auth/login` request in Postman, add:
   ```javascript
   const res = pm.response.json();
   if (res.token) {
       pm.collectionVariables.set("bearerToken", res.token);
   }
   ```
   Set collection **Authorization** to **Bearer Token** with value `{{bearerToken}}`.

---

## 📋 Master Endpoints Inventory by Domain

---

### 01. System & Health Probes

| Method | Endpoint Path | Title / Summary | Auth Required | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api` | **Get Service Status** | Public (None) | Returns service name, uptime, DB pool status, and active websocket clients count. |
| `GET` | `/api/health` | **Liveness & Readiness Probe** | Public (None) | Heartbeat probe used by load balancers and Docker health checks. |

#### Sample Response (`GET /api`):
```json
{
  "success": true,
  "service": "DMS Helpdesk API Service",
  "version": "1.0.0",
  "status": "operational",
  "uptime": "320s",
  "connections": {
    "database": "healthy",
    "activeSockets": 3
  }
}
```

---

### 02. Authentication & Identity

| Method | Endpoint Path | Title / Summary | Auth Required | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | **Authenticate User Credentials** | Public (Rate-limited) | Validates username/email and password. Returns signed JWT access token. |
| `POST` | `/api/auth/refresh` | **Refresh Access Token** | Cookie | Renews expired access token using the HTTP-only `refreshToken` cookie. |
| `GET` | `/api/auth/me` | **Get Current Caller Profile** | Bearer Token | Returns authenticated user details, roles, and allowed permission list. |
| `PATCH`| `/api/auth/me/profile` | **Update My Profile & Password** | Bearer Token | Multipart upload for avatar image + user profile fields and password change. |
| `PATCH`| `/api/auth/me/theme` | **Update Theme Preference** | Bearer Token | Body: `{ "themePreference": "system" \| "light" \| "dark" }` |
| `POST` | `/api/auth/logout` | **Invalidate Session / Logout** | Bearer Token | Clears session cookie and invalidates user login. |

#### Sample Request (`POST /api/auth/login`):
```json
{
  "identifier": "admin",
  "password": "password"
}
```

#### Sample Response (`POST /api/auth/login`):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "username": "admin",
    "email": "admin@demo.gov",
    "role": "admin",
    "tenantId": null,
    "status": "active"
  }
}
```

---

### 03. User Management

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users/roles` | **List System Roles** | Bearer (`users.read`) | Returns all system roles (`admin`, `manager`, `staff`, `tenant`, `ceo`). |
| `GET` | `/api/users` | **List & Filter Users** | Bearer (`users.read`) | Query params: `page`, `limit`, `role`, `status`, `departmentId`. |
| `POST` | `/api/users` | **Provision New User** | Bearer (`users.create`) | Multipart form-data with user fields, role ID, and avatar image. |
| `GET` | `/api/users/{id}` | **Get User by ID** | Bearer (`users.read`) | Path param: `{id}` (UUID). Full user profile. |
| `PUT` | `/api/users/{id}` | **Update User** | Bearer (`users.update`) | Path param: `{id}`. Partial updates to name, email, status, or role. |
| `DELETE`| `/api/users/{id}` | **Delete User** | Bearer (`users.delete`) | Path param: `{id}`. Removes user account. |
| `PATCH`| `/api/users/{id}/activate` | **Activate User** | Bearer (`users.update`) | Unlocks and enables account access. |
| `PATCH`| `/api/users/{id}/deactivate`| **Deactivate User** | Bearer (`users.update`) | Suspends account and blocks login. |
| `PATCH`| `/api/users/{id}/reset-password`| **Admin Password Reset**| Bearer (`users.update`) | Body: `{ "newPassword": "SecretPassword123" }` |
| `POST` | `/api/users/send-email` | **Direct Email Dispatch** | Bearer | Body: `{ "to", "toName", "subject", "message" }`. |

#### Sample Request (`POST /api/users`):
```json
{
  "username": "sarah_connor",
  "email": "sarah@example.com",
  "password": "Password@123",
  "firstName": "Sarah",
  "lastName": "Connor",
  "roleId": 3,
  "status": "active"
}
```

---

### 04. Department Management

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/departments/active` | **Get Active Departments** | Public / Any | Reference dropdown list for ticket routing. |
| `GET` | `/api/departments/heads` | **List Eligible Dept Heads**| Bearer (`departments.manage`)| Returns managers eligible to head a department. |
| `GET` | `/api/departments` | **List All Departments** | Bearer (`departments.manage`)| Paginated listing of departments with member counts. |
| `POST` | `/api/departments` | **Create Department** | Bearer (`departments.manage`)| Body: `{ "name", "code", "description", "headUserId", "status", "memberIds" }`. |
| `GET` | `/api/departments/{id}` | **Get Department Details** | Bearer (`departments.manage`)| Path param: `{id}` (e.g. `dept-infra-01`). |
| `PUT` | `/api/departments/{id}` | **Update Department** | Bearer (`departments.manage`)| Path param: `{id}`. Updates code, name, head, or members. |
| `DELETE`| `/api/departments/{id}`| **Delete Department** | Bearer (`departments.manage`)| Path param: `{id}`. Deletes department. |
| `GET` | `/api/departments/{id}/members` | **List Department Members** | Bearer (`departments.manage`)| Returns technicians assigned to the department. |
| `POST` | `/api/departments/{id}/members` | **Assign Members Batch** | Bearer (`departments.manage`)| Body: `{ "userIds": ["uuid-1", "uuid-2"] }`. |
| `PATCH`| `/api/departments/{id}/activate` | **Activate Department** | Bearer (`departments.manage`)| Enables routing to department. |
| `PATCH`| `/api/departments/{id}/deactivate` | **Deactivate Department** | Bearer (`departments.manage`)| Suspends routing to department. |

---

### 05. Staff Assignment Matrix

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/matrix/grid` | **Get 2D Routing Grid** | Bearer (`matrix.manage`)| Returns 2D grid of users $\times$ departments and active assignments. |
| `GET` | `/api/matrix` | **List Matrix Assignments** | Bearer (`matrix.manage`)| Query params: `page`, `limit`, `userId`, `departmentId`. |
| `POST` | `/api/matrix` | **Assign Staff to Dept** | Bearer (`admin` role) | Body: `{ "userId": "uuid", "departmentId": "dept-id" }`. |
| `PATCH`| `/api/matrix/toggle` | **Toggle Matrix Assignment**| Bearer (`admin` role) | Body: `{ "userId": "uuid", "departmentId": "dept-id", "assigned": true }`. |
| `DELETE`| `/api/matrix/pair/{userId}/{departmentId}` | **Unassign by Pair** | Bearer (`admin` role) | Path params: `{userId}` and `{departmentId}`. |
| `GET` | `/api/matrix/{id}` | **Get Assignment by ID** | Bearer (`matrix.manage`)| Path param: `{id}` (integer). |
| `DELETE`| `/api/matrix/{id}` | **Delete Assignment by ID** | Bearer (`admin` role) | Path param: `{id}`. |

---

### 06. Ticket Core Lifecycle (Create & Query)

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets/track/{trackNumber}` | **Track Ticket (Anonymous)** | Public (None) | Look up public ticket status by `trackNumber` (e.g. `TICK-20261022-4821`). |
| `GET` | `/api/tickets/categories` | **Get Ticket Categories** | Bearer (`tickets.read`) | Returns category choices for new ticket creation. |
| `GET` | `/api/tickets` | **List & Filter Tickets** | Bearer (`tickets.read`) | Query params: `page`, `limit`, `status`, `priority`, `sortBy`, `sortOrder`. Scoped to tenant. |
| `POST` | `/api/tickets` | **Submit New Ticket** | Bearer (`tickets.create`) | **Multipart form-data**: `title`, `description`, `category`, `priority`, `departmentId`, `attachments` (up to 5 files). |
| `GET` | `/api/tickets/{id}` | **Get Ticket Details** | Bearer (`tickets.read`) | Full ticket object, SLA deadlines, assigned technician, and attachments. |
| `PUT` | `/api/tickets/{id}` | **Update Ticket Details** | Bearer (`tickets.assign`)| Body: `{ "title", "description", "category", "priority", "departmentId", "assignedTo" }`. |
| `DELETE`| `/api/tickets/{id}` | **Delete Ticket Record** | Bearer (`admin` role) | Permanently deletes ticket and audit records. |
| `GET` | `/api/tickets/{id}/timeline` | **Get Audit Timeline** | Bearer (`tickets.read`) | Chronological event logs (status changes, reassignments, internal notes). |

#### Sample Request (`POST /api/tickets` — Multipart form-data):
```http
POST /api/tickets HTTP/1.1
Host: localhost:5000
Authorization: Bearer <jwt_access_token>
Content-Type: multipart/form-data; boundary=---WebKitFormBoundary

---WebKitFormBoundary
Content-Disposition: form-data; name="title"

API Gateway 502 Bad Gateway Outage
---WebKitFormBoundary
Content-Disposition: form-data; name="description"

European edge gateway returning 502 Bad Gateway during morning traffic spikes.
---WebKitFormBoundary
Content-Disposition: form-data; name="category"

Infrastructure
---WebKitFormBoundary
Content-Disposition: form-data; name="priority"

high
---WebKitFormBoundary
Content-Disposition: form-data; name="departmentId"

dept-infra-01
---WebKitFormBoundary
Content-Disposition: form-data; name="attachments"; filename="gateway_logs.log"
Content-Type: text/plain

[error] 1402#0: *882 recv() failed (104: Connection reset by peer)
---WebKitFormBoundary--
```

---

### 07. Ticket Workflow & Status Transitions

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `PATCH`| `/api/tickets/{id}/status` | **Transition Status** | Bearer (Role Checked) | Moves ticket across state machine (`open` $\rightarrow$ `assigned` $\rightarrow$ `in_progress` $\rightarrow$ `resolved`). |
| `POST` | `/api/tickets/{id}/complete` | **Mark Work Complete** | Bearer (`tickets.complete`)| Technician/Manager marks technical work complete. Moves to pending approval. |
| `POST` | `/api/tickets/{id}/approve` | **Approve / Confirm Resolution**| Bearer (`tickets.approve`)| Tenant or Manager confirms problem solved; submits rating (1-5) and feedback. |
| `POST` | `/api/tickets/{id}/reject-completion`| **Reject Resolution** | Bearer (`tickets.approve`)| Reverts ticket back to `in_progress` with mandatory rejection `reason`. |
| `POST` | `/api/tickets/{id}/close` | **Formally Close Ticket** | Bearer (`tickets.close`) | Closes ticket permanently. |
| `POST` | `/api/tickets/{id}/reopen` | **Reopen Ticket** | Bearer (`tickets.reopen`) | Reopens resolved ticket within allowable reopening window. |

#### Sample Request (`POST /api/tickets/{id}/approve`):
```json
{
  "notes": "Verified that API gateway latency is back to normal.",
  "rating": 5,
  "feedback": "Outstanding turnaround time and clear explanations."
}
```

---

### 08. Ticket Routing, Assignment & Merge

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets/departments/{departmentId}/managers` | **Get Dept Managers** | Bearer (`tickets.assign`)| Lists managers eligible for assignment. |
| `POST` | `/api/tickets/{id}/assign-department` | **Assign to Department** | Bearer (`admin` role) | Body: `{ "departmentId", "managerId", "assignedTo", "notes" }`. |
| `POST` | `/api/tickets/{id}/assign-staff` | **Assign to Technician** | Bearer (`tickets.assign`)| Manager dispatches ticket to staff: `{ "staffId", "notes" }`. |
| `POST` | `/api/tickets/{id}/reassign` | **Reassign Technician** | Bearer (`tickets.reassign`)| Replaces current assignee: `{ "staffId", "notes" }`. |
| `PATCH`| `/api/tickets/{id}/assignment` | **Override Assignment** | Bearer (`admin` role) | Manual administrative fix for attribution: `{ "assignedTo", "assignedBy" }`. |
| `POST` | `/api/tickets/{id}/accept` | **Accept Assignment** | Bearer (Assigned Staff) | Technician acknowledges ticket and accepts responsibility. |
| `POST` | `/api/tickets/{id}/reject` | **Reject Assignment** | Bearer (Assigned Staff) | Technician declines ticket back to manager queue: `{ "reason" }`. |
| `POST` | `/api/tickets/{id}/escalate` | **Escalate Ticket** | Bearer (`tickets.escalate`)| Manually triggers high-priority SLA escalation: `{ "notes" }`. |
| `GET` | `/api/tickets/{id}/merge-candidates` | **Find Merge Candidates** | Bearer (`admin`, `ceo`)| Finds similar open tickets that may be duplicate reports. |
| `POST` | `/api/tickets/{id}/merge` | **Merge Duplicate Tickets** | Bearer (`admin`, `ceo`)| Merges tickets: `{ "sourceIds": ["uuid-1"], "notes" }`. Closes source tickets. |
| `PATCH`| `/api/tickets/{id}/priority` | **Change Priority** | Bearer (`tickets.change_priority`)| Body: `{ "priority": "urgent" }`. Recalculates SLA targets. |
| `PATCH`| `/api/tickets/{id}/category` | **Change Category** | Bearer (`tickets.change_category`)| Body: `{ "category": "Infrastructure" }`. |

---

### 09. Ticket Discussions & Private Notes

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets/{id}/internal-note` | **Post Internal Staff Note** | Bearer (`tickets.internal_note`)| Private note visible only to staff/manager/admin (hidden from tenant). |
| `GET` | `/api/tickets/{id}/replies` | **Get Discussion Replies** | Bearer (`tickets.read`)| Retrieves discussion thread messages according to caller role. |
| `POST` | `/api/tickets/{id}/replies` | **Post Discussion Reply** | Bearer (`tickets.read`)| Body: `{ "message", "visibility": "all" \| "internal", "attachmentId" }`. |

---

### 10. Ticket Attachments

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets/{id}/attachments` | **Upload File Attachments** | Bearer (`tickets.read`)| Multipart upload: `attachments` (up to 5 files, max 10MB each). |

---

### 11. Ticket Notifications

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets/notifications` | **Get In-App Notifications** | Bearer (Any authenticated) | Chronological list of user notifications. |
| `GET` | `/api/tickets/notifications/unread-count`| **Get Unread Count** | Bearer (Any authenticated) | Lightweight polling endpoint for unread badge count. |
| `PATCH`| `/api/tickets/notifications/{id}/read` | **Mark Notification Read** | Bearer (Any authenticated) | Marks single notification as read. |
| `PATCH`| `/api/tickets/notifications/read-all` | **Mark All Read** | Bearer (Any authenticated) | Clears all unread notifications. |
| `DELETE`| `/api/tickets/notifications/{id}` | **Delete Notification** | Bearer (Any authenticated) | Removes notification item. |

---

### 12. Ticket Categories & Routing Rules

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/ticket-categories` | **List Active Categories** | Public / Any | Public catalog of ticket categories. |
| `GET` | `/api/ticket-categories/requests` | **Manager Category Proposals** | Bearer (`admin`, `ceo`)| Approval queue where admins review proposals by managers. |
| `GET` | `/api/ticket-categories/{id}` | **Get Category Details** | Public / Any | Path param: `{id}`. |
| `POST` | `/api/ticket-categories` | **Create Category** | Bearer (`admin`, `manager`)| Body: `{ "name", "description", "departmentId", "slaPolicyId", "routingType" }`. |
| `PUT` | `/api/ticket-categories/{id}` | **Update Category** | Bearer (`admin`, `manager`)| Path param: `{id}`. Updates category fields or isActive flag. |
| `DELETE`| `/api/ticket-categories/{id}` | **Delete Category** | Bearer (`admin`, `ceo`)| Path param: `{id}`. |
| `POST` | `/api/ticket-categories/{id}/approve` | **Approve Category** | Bearer (`admin`, `ceo`)| Activates proposed manager category: `{ "reviewNotes" }`. |
| `POST` | `/api/ticket-categories/{id}/reject` | **Reject Category** | Bearer (`admin`, `ceo`)| Rejects proposed category: `{ "reviewNotes" }`. |

---

### 13. Service Level Agreements (SLA)

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/sla/preview` | **Preview SLA Deadlines** | Public / Any | Query params: `priority`, `categoryId`, `createdAt`. Calculates target dates. |
| `GET` | `/api/sla` | **List SLA Policies** | Public / Any | Returns configured SLA policies. |
| `POST` | `/api/sla` | **Create SLA Policy** | Bearer (`admin`, `ceo`)| Body: `{ "name", "priority", "categoryId", "responseHours", "resolutionHours", "escalationHours", "workingHours" }`. |
| `GET` | `/api/sla/{id}` | **Get Policy by ID** | Bearer (Any authenticated) | Path param: `{id}`. |
| `PUT` | `/api/sla/{id}` | **Update SLA Policy** | Bearer (`admin`, `ceo`)| Path param: `{id}`. |
| `DELETE`| `/api/sla/{id}` | **Delete SLA Policy** | Bearer (`admin`, `ceo`)| Path param: `{id}`. |
| `POST` | `/api/sla/{id}/test-compute` | **Test SLA Target Compute** | Bearer (Any authenticated) | Body: `{ "createdAt": "2026-10-23T08:00:00Z" }`. Verifies math. |

---

### 14. Tenant Management & Registration

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/tenants/register` | **Public Tenant Registration** | Public (None) | Self-registration: `{ "organizationName", "contactPerson", "email", "username", "password", "confirmPassword" }`. |
| `GET` | `/api/tenants/profile/me` | **Get My Tenant Profile** | Bearer (`tenant` role)| Organization profile of the logged-in tenant. |
| `PUT` | `/api/tenants/profile/me` | **Update My Tenant Profile** | Bearer (`tenant` role)| Body: `{ "contactPerson", "phone", "address", "notes" }`. |
| `GET` | `/api/tenants` | **List All Tenants** | Bearer (`tenants.manage`)| Query params: `page`, `limit`, `status` (`active`, `inactive`, `pending`). |
| `POST` | `/api/tenants` | **Admin Create Tenant** | Bearer (`tenants.manage`)| Admin registers organization and primary admin user directly. |
| `GET` | `/api/tenants/{id}` | **Get Tenant by ID** | Bearer (`tenants.manage`)| Path param: `{id}` (UUID). |
| `PUT` | `/api/tenants/{id}` | **Update Tenant Details** | Bearer (`tenants.manage`)| Path param: `{id}`. |
| `DELETE`| `/api/tenants/{id}` | **Delete Tenant** | Bearer (`tenants.manage`)| Path param: `{id}`. |
| `PATCH`| `/api/tenants/{id}/activate` | **Activate Tenant** | Bearer (`tenants.manage`)| Unlocks tenant accounts. |
| `PATCH`| `/api/tenants/{id}/deactivate` | **Deactivate Tenant** | Bearer (`tenants.manage`)| Suspends tenant organization. |
| `PATCH`| `/api/tenants/{id}/approve` | **Approve Tenant Registration** | Bearer (`tenants.manage`)| Approves pending self-registered tenant. |
| `POST` | `/api/tenants/send-email` | **Send Direct Email to Tenant** | Bearer | Body: `{ "to", "toName", "subject", "message" }`. |

---

### 15. Internal Notices & Announcements

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/notices/public` | **Get Public Bulletins** | Public (None) | Returns public announcements for visitors and portals. |
| `GET` | `/api/notices/categories` | **Get Notice Categories** | Public (None) | Returns notice categories. |
| `GET` | `/api/notices/my/inbox` | **My Notices Inbox** | Bearer (`notices.read`)| Notices filtered by caller role and department. |
| `GET` | `/api/notices/my/created` | **My Created Notices** | Bearer (`notices.create`)| Notices drafted or posted by caller. |
| `POST` | `/api/notices/targeted` | **Create Targeted Notice** | Bearer (`notices.create`)| Body: `{ "title", "description", "priority", "targetAudience", "departmentId", "assignedTo" }`. |
| `GET` | `/api/notices/{id}` | **Get Notice by ID** | Bearer (`notices.read`)| Path param: `{id}`. |
| `PUT` | `/api/notices/{id}` | **Update Notice** | Bearer (`notices.update`)| Path param: `{id}`. |
| `DELETE`| `/api/notices/{id}` | **Delete Notice** | Bearer (`notices.delete`)| Path param: `{id}`. |
| `POST` | `/api/notices/{id}/acknowledge` | **Acknowledge Receipt** | Bearer (`notices.read`)| Records that the caller acknowledged reading the notice. |
| `GET` | `/api/notices/{id}/replies` | **Get Notice Discussion** | Bearer (`notices.read`)| Discussion comments on the notice. |
| `POST` | `/api/notices/{id}/replies` | **Post Notice Reply** | Bearer (`notices.read`)| Body: `{ "message", "visibility" }`. |

---

### 16. Knowledge Base Articles

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/knowledge/public` | **List Public Articles** | Public (None) | Self-help articles for public portal. |
| `GET` | `/api/knowledge` | **List & Search Articles** | Bearer (`knowledge.read`)| Query params: `page`, `limit`, `search`, `category`, `status`. |
| `POST` | `/api/knowledge` | **Create Article Draft** | Bearer (`knowledge.create`)| Body: `{ "title", "content", "category" }`. |
| `GET` | `/api/knowledge/{id}` | **Get Article by ID** | Bearer (`knowledge.read`)| Full markdown article content and views stats. |
| `PUT` | `/api/knowledge/{id}` | **Update Article** | Bearer (`knowledge.update`)| Body: `{ "title", "content", "category" }`. |
| `DELETE`| `/api/knowledge/{id}` | **Delete Article** | Bearer (`knowledge.delete`)| Admin only. |
| `POST` | `/api/knowledge/{id}/submit` | **Submit Draft for Review** | Bearer (`knowledge.submit`)| Moves draft to pending review queue. |
| `POST` | `/api/knowledge/{id}/approve` | **Approve Article** | Bearer (`knowledge.approve`)| Manager approves article. |
| `POST` | `/api/knowledge/{id}/publish` | **Publish Article** | Bearer (`knowledge.publish`)| Admin makes article live for tenants. |
| `POST` | `/api/knowledge/{id}/feedback`| **Rate Article** | Bearer (`knowledge.rate`) | Tenant votes: `{ "helpful": true, "reason": "..." }`. |
| `GET` | `/api/knowledge/{id}/versions`| **List Version History** | Bearer (`knowledge.read`)| History of revisions. |

---

### 17. Real-Time Chat & Video Meetings

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/chat/rooms` | **List User Chat Rooms** | Bearer (Any authenticated) | Returns ticket rooms, department rooms, and DM rooms. |
| `GET` | `/api/chat/rooms/{roomId}` | **Get Room Details** | Bearer (Room participant) | Path param: `{roomId}` (UUID). |
| `POST` | `/api/chat/rooms/ticket` | **Create Ticket Chat Room** | Bearer | Body: `{ "ticketId": "uuid", "name": "..." }`. Auto-adds staff & tenant. |
| `POST` | `/api/chat/rooms/department`| **Create Dept Chat Room** | Bearer | Body: `{ "departmentId": "dept-id", "name": "..." }`. |
| `POST` | `/api/chat/rooms/direct` | **Create Direct DM Room** | Bearer | Body: `{ "userId": "target-uuid" }`. 1-on-1 private room. |
| `GET` | `/api/chat/rooms/{roomId}/messages`| **Get Message History**| Bearer | Query params: `limit`, `offset`. Paged conversation history. |
| `POST` | `/api/chat/messages` | **Send Chat Message (REST)** | Bearer | Body: `{ "roomId", "message", "messageType" }`. Broadcasts via Socket.IO. |
| `POST` | `/api/chat/upload` | **Upload Chat Attachment** | Bearer | Multipart upload: `file` (max 10MB). Returns static `fileUrl`. |
| `GET` | `/api/chat/online-users` | **List Online Users** | Bearer | Returns array of user UUIDs currently connected to Socket.IO. |
| `POST` | `/api/chat/meeting-invite` | **Send Video Call Invite** | Bearer | Body: `{ "meetingUrl", "recipientEmail", "title", "notes", "scheduledTime" }`. |

---

### 18. Dashboards & Role Analytics

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/admin` | **Admin Dashboard Metrics** | Bearer (`dashboard.read`)| High-level metrics: tickets count, SLA compliance %, active staff. |
| `GET` | `/api/dashboard/ceo` | **CEO Executive Overview** | Bearer (`ceo` role) | Cross-department performance and tenant metrics. |
| `GET` | `/api/dashboard/manager` | **Manager Department View** | Bearer (`manager` role) | Department queue, staff performance, unassigned tickets. |
| `GET` | `/api/dashboard/staff` | **Staff Personal Dashboard** | Bearer (`staff` role) | My active tickets, upcoming SLA deadlines, daily resolved count. |
| `GET` | `/api/dashboard/tenant` | **Tenant Portal Dashboard** | Bearer (`tenant` role) | My open requests, resolution sign-offs waiting, public announcements. |
| `GET` | `/api/dashboard/tickets/stats`| **Ticket Stats by Priority**| Bearer (`tickets.read`)| Breakdown by status and urgency levels. |

---

### 19. Reports & Excel Exports

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/tickets` | **Ticket Operational Reports** | Bearer (`reports.read`)| Aggregated metrics on resolution times and bottlenecks. |
| `GET` | `/api/reports/{type}/export` | **Export Report to Excel** | Bearer (`reports.read`)| Path param: `{type}` (`tickets`, `departments`, `staff`, `tenants`, `all`). Downloads `.xlsx` file. |

---

### 20. Customer Feedback & Surveys

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/feedback` | **List Customer Feedback** | Bearer | Tenants see their own; staff/admin see all. |
| `POST` | `/api/feedback` | **Submit Feedback & Rating** | Bearer | Body: `{ "subject", "message", "rating": 1-5 }`. |
| `GET` | `/api/feedback/{id}` | **Get Feedback Details** | Bearer | Path param: `{id}`. |
| `POST` | `/api/feedback/{id}/replies` | **Reply to Feedback** | Bearer (`feedback.update`)| Management response to customer review. |

---

### 21. Audit Trail & Compliance

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | **Query Audit Trail** | Bearer (`audit.read`)| Chronological security logs: logins, role edits, deletions, overrides. |
| `GET` | `/api/audit/actions` | **List Audit Actions** | Bearer (`audit.read`)| Returns distinct action enum types for filtering dropdowns. |
| `GET` | `/api/audit/export` | **Export Audit Trail (CSV)** | Bearer (`audit.read`)| Downloads compliance audit CSV. |

---

### 22. Direct Email Communications

| Method | Endpoint Path | Title / Summary | Auth / Role | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/send-email` | **Direct SMTP Email Dispatch**| Bearer | Body: `{ "to": "user@example.com", "toName": "...", "subject": "...", "message": "..." }`. |

---

### 23. Static Uploads & Files

| Method | Endpoint Path | Title / Summary | Auth Required | Description & Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/uploads/{subfolder}/{filename}` | **Retrieve Uploaded Asset** | Public (None) | Subfolders: `tickets`, `users`, `chat`, `knowledge`. Direct static file access. |

---

## ⚡ Real-Time Socket.IO Reference

- **Connection URL:** `ws://localhost:5000` *(or `5005`)*
- **Handshake Authentication:**
  ```javascript
  import { io } from 'socket.io-client';

  const socket = io('http://localhost:5000', {
    auth: {
      token: '<jwt_access_token>'
    }
  });
  ```
- **Events to Emit (Client $\rightarrow$ Server):**
  - `join-room`: `{ roomId: "uuid" }`
  - `leave-room`: `{ roomId: "uuid" }`
  - `send-message`: `{ roomId: "uuid", message: "Hello", messageType: "text" }`
  - `typing`: `{ roomId: "uuid", isTyping: true }`
  - `mark-read`: `{ roomId: "uuid", messageIds: ["uuid-1"] }`
- **Events to Listen (Server $\rightarrow$ Client):**
  - `new-message`: Triggered when any message is posted in an active room.
  - `user-typing`: `{ userId, username, isTyping, roomId }`
  - `message-read`: `{ roomId, userId, messageIds }`
  - `user-status-changed`: `{ userId, status: "online" | "offline" }`
  - `ticket-updated`: Broadcasts real-time status transitions and assignments.
  - `new-notice`: Broadcasts immediate notification when an announcement is published.
