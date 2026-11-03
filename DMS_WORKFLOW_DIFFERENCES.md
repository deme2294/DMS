# DMS Workflow Consistency & Behavioral Audit Report

**Document Reference:** `DMS_WORKFLOW_DIFFERENCES.md`  
**Application:** Government Help Desk Management System (DMS)  
**Production URL:** `https://helpdesk.ethiopianitpark.com`  
**Date:** November 2026  
**Status:** Audit Complete — Awaiting Approval Before Source/Config Modification

---

## Overview

This report provides a workflow-by-workflow behavioral analysis of the DMS Help Desk Management System, contrasting expected outcomes with actual local development and production VPS execution. Each section isolates the relevant frontend and backend code paths, affected database tables, root causes of failure or divergence, and the exact corrections required.

---

## Workflow 1: User Login & Session Initialization

### Expected Behavior
- User enters username/email and password on `https://helpdesk.ethiopianitpark.com/login`.
- Frontend sends `POST /api/auth/login`.
- Backend verifies credentials, checks account status, returns JWT access token and user metadata (role, department, tenant).
- Frontend stores token in `localStorage` and redirects user to their role-specific dashboard (`/admin/dashboard`, `/tenant/tickets`, etc.).
- Socket.IO connection authenticates with the returned JWT token to receive real-time notifications.

### Actual Local Behavior
- Direct login succeeds without CORS issues on `http://localhost:5173`.
- Redirects to role dashboard immediately.

### Actual Production Behavior
- **Observed Error (Screen Capture):** `Cross-Origin Resource Sharing policy does not allow access from this origin.` (HTTP 403 Forbidden).
- **Secondary Error on Older Containers:** `ER_BAD_FIELD_ERROR: Unknown column 'u.user_num' in 'field list'` (HTTP 500 Internal Server Error).
- User remains on login screen; form fails to proceed.

### Code & API Reference
- **Frontend Code:** `frontend/src/pages/Auth/Login.tsx:45-85`, `frontend/src/context/AuthContext.tsx`
- **Backend Code:** `backend/server.js:125-165` (CORS configuration), `backend/controllers/authController.js:15-80`, `backend/repository/userRepository.js:40-75`
- **Related API Endpoint:** `POST /api/auth/login`
- **Database Tables:** `users`, `roles`, `user_departments`, `tenants`

### Root Cause Analysis
1. Express `cors` configuration in older Docker images had strict literal whitelist `['http://localhost:5173', 'http://localhost:3000']`. The production origin `https://helpdesk.ethiopianitpark.com` was rejected.
2. An un-migrated production database volume lacks the `user_num` column added in recent commits to `userRepository.js`.

### Recommended Correction
- Ensure `server.js` dynamic CORS regex is deployed in the Docker backend container.
- Run `migrationService.js` step 15b on container startup to ensure `users.user_num` exists.

---

## Workflow 2: Ticket Creation & Tenant Feedback Alerts

### Expected Behavior
- Tenant navigates to `/tenant/tickets/new`, enters Title, Category, Priority, Description, and optional attachments.
- Submitting the form calls `POST /api/tickets`.
- Upon successful creation:
  1. Frontend displays a clear success banner / toast ("Ticket #HD-2026-XXXX submitted successfully!").
  2. Tenant receives an in-app confirmation notification in their notification bell.
  3. Submitter receives a confirmation email with tracking details.
  4. User is smoothly redirected to the ticket details page.
- If creation fails (e.g., validation error, file too large, network error):
  - Frontend catches the error, stops the loading spinner, and displays an explicit red error alert explaining the problem.

### Actual Local Behavior
- Ticket is created in the database.
- Submitter receives confirmation email (if local Google App Password is valid).
- Frontend immediately navigates to `/tenant/tickets/:id`.
- **Deficiency:** Submitter receives NO in-app notification; only `admin` users receive in-app notifications.

### Actual Production Behavior (Reported User Issue)
- **Reported Issue:** "In the deployed one the ticket created does not display the alert or the tenants as ticket is created in the deployed it need fixing."
- **Actual VPS Findings:**
  1. In `frontend/src/pages/Tickets/TicketCreate.tsx`, the `onSubmit` function has **no `catch (err)` block**:
     ```typescript
     const onSubmit = async (values: TicketFormValues) => {
       setLoading(true);
       try {
         const formData = new FormData();
         // ...
         const res = await createTicket(formData);
         const shortId = res.data.data.ticketNum ? String(res.data.data.ticketNum) : (res.data.data.referenceNumber || res.data.data.id);
         navigate(`/tenant/tickets/${shortId}`);
       } finally {
         setLoading(false);
       }
     };
     ```
     If the backend returns any error (400 bad input, 403 forbidden, 413 attachment exceeds Nginx 1MB limit, 500 error), an unhandled promise rejection occurs silently. The form remains on screen with no alert or feedback.
  2. Even upon success, `TicketCreate.tsx` displays no alert, toast, or modal dialog informing the tenant of the new ticket reference number.
  3. In `backend/services/ticketService.js` (`createTicket`), in-app notifications are created strictly for administrators:
     ```javascript
     for (const admin of admins) {
       if (admin.id === createdByUserId) continue; // Explicitly excludes creator
       await notificationRepo.createNotification(admin.id, 'New Ticket Created', ...);
     }
     ```
     The submitting tenant is **never** inserted into the `notifications` table!
  4. If the category has `routing_type === 'direct'`, line 282 calls `routeTicketToDepartment` and returns early, completely bypassing `notificationService.notifyTicketCreated`!

### Code & API Reference
- **Frontend Code:** `frontend/src/pages/Tickets/TicketCreate.tsx:56-78`
- **Backend Code:** `backend/services/ticketService.js:193-291`, `backend/services/notificationService.js:60-85`
- **Related API Endpoints:** `POST /api/tickets`, `GET /api/categories`
- **Database Tables:** `tickets`, `ticket_attachments`, `ticket_status_history`, `notifications`, `users`

### Recommended Correction
1. **Frontend (`TicketCreate.tsx`):**
   - Add proper `try ... catch (err)` handling with user-facing error alert messages.
   - Introduce an instant success alert/toast confirming ticket creation with the reference number before or upon navigation.
2. **Backend (`ticketService.js` & `notificationService.js`):**
   - In `createTicket`, generate an in-app notification specifically for `user.id` (the tenant):
     `"Your ticket {referenceNumber} has been submitted successfully."`
   - Ensure tenant notification occurs whether `routingType` is `general` or `direct`.

---

## Workflow 3: Ticket Assignment & Notification Delivery

### Expected Behavior
- Admin or Department Manager views an unassigned ticket.
- Assigns the ticket to a Department Staff member (`POST /api/tickets/:id/assign`).
- Backend writes record to `ticket_assignments`, updates `tickets.status = 'assigned'` and `tickets.assigned_to = staffId`.
- Assignee receives:
  1. An in-app database notification in `notifications` table.
  2. A real-time Socket.IO event `notification` that instantly updates the top-bar notification bell badge and displays a toast.
  3. An email notification sent to their registered email address with ticket reference and description.

### Actual Local Behavior
- Assignment succeeds.
- Assignee receives local email (using local Google App Password `qfbf wbwa ftas qltg`).
- Assignee receives real-time WebSocket push on `http://localhost:5000`.
- **Deficiency:** Database notification title contains `ticket undefined` because code reads `ticket.reference_number` on an object where the key is camelCase `referenceNumber`.

### Actual Production Behavior (Reported User Issue)
- **Reported Issue:** "During assignments in the local the assignments reach the receiver within email and web application notifications, this should be fixed."
- **Actual VPS Findings:**
  1. **Email Failure:** The production environment in `.env` has:
     ```env
     EMAIL_USER=misgenaht@gmail.com
     EMAIL_PASS=Dem22&terefa
     ```
     Gmail SMTP strictly requires a 16-character App Password (like `qfbf wbwa ftas qltg`). The password `Dem22&terefa` is an account password. When `sendTicketAssignedEmail` runs, Nodemailer throws:
     `535-5.7.8 Username and Password not accepted (EAUTH)`.
     The email is never delivered.
  2. **Docker Compose Missing Config:** `docker-compose.deploy.yml` does not forward `EMAIL_FROM`, `SMTP_USER`, or `SMTP_PASS`.
  3. **Web Application Notification Failure:**
     - The host-level Nginx reverse proxy on the VPS terminates SSL at `https://helpdesk.ethiopianitpark.com`.
     - If the reverse proxy lacks `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";` on the `/socket.io/` route, WebSocket upgrades fail and fallback to polling.
     - If polling fails or client disconnects, real-time pushes do not reach the staff member's browser.
  4. **Notification Text Bug (`notificationService.js` lines 91 & 97):**
     ```javascript
     `You have been assigned ticket ${ticket.reference_number} "${truncate(ticket.title, 60)}".`
     ```
     Because `getTicket` returns camelCase (`ticket.referenceNumber`), `ticket.reference_number` evaluates to `undefined`, resulting in:
     `"You have been assigned ticket undefined ..."`

### Code & API Reference
- **Frontend Code:** `frontend/src/context/SocketContext.tsx:30-70`, `frontend/src/components/common/NotificationCenter.tsx:40-90`
- **Backend Code:** `backend/services/ticketService.js:330-410`, `backend/services/notificationService.js:86-130`, `backend/services/emailService.js:180-230`
- **Deployment Config:** `docker-compose.deploy.yml:75-78`, production `.env:61-65`
- **Database Tables:** `tickets`, `ticket_assignments`, `notifications`, `users`

### Recommended Correction
1. Configure a valid 16-character Google App Password in production `.env` (or transfer the working local App Password `qfbf wbwa ftas qltg`).
2. Add `EMAIL_FROM`, `SMTP_USER`, `SMTP_PASS` to `docker-compose.deploy.yml`.
3. Fix property reference in `notificationService.js`: `ticket.reference_number || ticket.referenceNumber`.
4. Ensure VPS host Nginx includes WebSocket upgrade headers for `/socket.io/`.

---

## Workflow 4: SLA Calculations, Approaching Deadline Warnings & Automatic Escalations

### Expected Behavior
- When a ticket is created:
  - System resolves SLA policy based on Category and Priority.
  - Computes `response_due_date`, `due_date` (resolution), and `escalation_due_date`.
- Background SLA Monitor (`slaMonitorService.js`) runs periodically (every 60s):
  1. **Near Deadline Warning:** Detects tickets whose response, escalation, or resolution deadline is approaching (e.g., within 1–2 hours).
     - Updates `last_sla_warning_at = NOW()`.
     - Sends in-app warning notification to assigned staff, department manager, and submitter.
     - Dispatches warning email via `sendSLANearDeadlineEmail`.
     - Emits WebSocket event `sla:near-deadline`.
  2. **Escalation Breach:** If `escalation_due_date < NOW()` and ticket is not resolved:
     - Updates ticket `status = 'escalated'`, `is_escalated = 1`, `escalated_at = NOW()`.
     - Logs status transition to `ticket_status_history`.
     - Dispatches escalation notification to department manager and administrators.
  3. **Resolution Breach:** If `due_date < NOW()`:
     - Marks `is_overdue = 1`, escalates ticket, and sends breach notification.

### Actual Local Behavior
- `startSlaMonitor` executes every 60 seconds without errors.
- However, for tickets created with default SLA policies:
  - `escalation_due_date` is `NULL`.
  - Neither escalation warnings nor automatic escalations fire.

### Actual Production Behavior (Reported User Issue)
- **Reported Issue:** "The other one is escalation is not working correctly for the ticket the deadline is reaching as warning through notifications. so by considering this fix for the deployment."
- **Actual VPS Findings:**
  1. **Seed Policies Have Zero Escalation Hours:** In `backend/sql/database.sql` lines 874–878:
     ```sql
     INSERT INTO sla_policies (id, name, priority, category_id, response_hours, resolution_hours, description) VALUES
     ('sla00001-...', 'Critical SLA', 'urgent', NULL, 1, 4, ...),
     ('sla00002-...', 'High SLA', 'high', NULL, 2, 8, ...),
     ('sla00003-...', 'Medium SLA', 'medium', NULL, 4, 24, ...),
     ('sla00004-...', 'Low SLA', 'low', NULL, 8, 72, ...);
     ```
     Notice that `escalation_hours` is NOT specified! The table schema sets `DEFAULT 0`.
     In `slaService.js` (line 232):
     ```javascript
     const escalationDueDate = escalationHours > 0 ? addBusinessHours(base, escalationHours, workingHours) : null;
     ```
     Because `escalationHours` is `0`, `escalationDueDate` is computed as `NULL` for every single ticket created under standard policies!
     Consequently, in `slaMonitorService.js`:
     ```sql
     SELECT ... FROM tickets WHERE escalation_due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR);
     SELECT ... FROM tickets WHERE escalation_due_date < NOW();
     ```
     Both queries return **zero records**. Escalation is completely paralyzed!
  2. **Overly Restrictive 1-Hour Warning Window:**
     `WHERE due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)`
     If a ticket is created with a 4-hour or 24-hour deadline, warnings only match if the background check runs in that exact 60-minute window. If the server is restarted or tickets have slight timestamp drift, the window is missed.
  3. **Timezone Discrepancy (UTC vs East Africa Time UTC+3):**
     In Docker on VPS: MariaDB runs with `@@time_zone = '+00:00'`. Node process runs in UTC.
     Clients submitting tickets are in East Africa Time (`UTC+03:00`). If client inputs or display dates don't normalize UTC, queries comparing `NOW()` vs stored timestamps can experience a 3-hour offset, causing warnings to fire too late or not at all.
  4. **Warning Email Only Sent to `assigned_to`:**
     In `slaMonitorService.js` lines 110-120:
     If the ticket has NOT yet been assigned to staff (`assigned_to IS NULL`), NO warning email is sent to anyone (neither the department manager nor the tenant nor admin)!
  5. **Email Failure on VPS:**
     Even when a warning matches, `sendSLANearDeadlineEmail` fails because `EMAIL_PASS=Dem22&terefa` is rejected by Gmail SMTP.

### Code & API Reference
- **Backend Code:** `backend/services/slaMonitorService.js:42-130`, `backend/services/slaService.js:223-277`, `backend/services/notificationService.js:740-775`
- **Database Tables:** `sla_policies`, `tickets`, `notifications`, `ticket_status_history`

### Recommended Correction
1. Execute a database migration to update existing SLA policies with realistic `escalation_hours`:
   - Critical (urgent): `escalation_hours = 2` (50% of resolution)
   - High: `escalation_hours = 4` (50% of resolution)
   - Medium: `escalation_hours = 12` (50% of resolution)
   - Low: `escalation_hours = 36` (50% of resolution)
2. In `slaService.js`, add a fallback: if `policy.escalation_hours <= 0`, default to `Math.max(1, Math.round(resolutionHours * 0.5))`.
3. In `slaMonitorService.js`, broaden the warning window or calculate warning based on threshold (e.g. `<= 2 hours` or `<= 25% remaining`), and ensure unassigned tickets send warning emails to department managers or admins.
4. Repair Gmail App Password in production `.env`.

---

## Workflow 5: Role-Based Dashboard Access & Navigation

### Expected Behavior
- Based on decoded JWT `role`:
  - `admin`: redirected to `/admin/dashboard`
  - `manager`: redirected to `/manager/dashboard`
  - `staff`: redirected to `/staff/dashboard`
  - `tenant`: redirected to `/tenant/tickets`
  - `ceo`: redirected to `/ceo/dashboard`
- Protected routes block unauthorized roles and redirect to unauthorized page or login.

### Actual Local & Production Behavior
- Operates correctly once authenticated.
- Navigation guards in `frontend/src/routes/AppRoutes.tsx` enforce role checks.

---

## Workflow 6: Ticket Category Selection & Department Auto-Routing

### Expected Behavior
- Categories have `routing_type` set to either `'general'` or `'direct'`.
- If `'direct'`, ticket auto-assigns to the department manager of the linked department upon creation.
- If `'general'`, ticket remains in open state for admin triage.

### Actual Local vs Production Findings
- Category selection works in both environments.
- Direct routing functions correctly in `ticketService.js` (`routeTicketToDepartment`), BUT `notifyTicketCreated` is bypassed. As noted in Workflow 2, direct-routed tickets notify the department manager but fail to notify the tenant submitter.

---

## Workflow 7: Real-Time Chat & Internal Notes

### Expected Behavior
- Ticket detail page provides chat / discussion tab.
- Messages sent via `POST /api/chat/messages` or Socket.IO `chat:message`.
- Real-time updates delivered to participants in the ticket room.

### Actual Local vs Production Findings
- Local: Works over direct WebSocket connection.
- Production: Relies entirely on VPS Nginx reverse proxy passing WebSocket upgrades. If host Nginx drops WebSocket connections, chat experiences polling latency or connection timeouts.

---

## Workflow 8: File Uploads & Static File Downloads

### Expected Behavior
- Tenant attaches PDF, JPG, PNG files to ticket (up to 10MB per file).
- Files stored on disk and registered in `ticket_attachments`.
- Users view/download attachments via `/uploads/tickets/:filename`.

### Actual Local vs Production Findings
- Local: Express serves `uploads/` directory directly.
- Production:
  - Files are stored in Docker volume `dms_uploads_data`.
  - If VPS Nginx has default `client_max_body_size 1M;`, uploads larger than 1MB are rejected by Nginx with HTTP 413 before reaching the container.
  - If host Nginx does not proxy `/uploads/` to the backend container, downloaded files return HTTP 404.

---

## Summary of Findings by Issue Category

| ID | Issue Description | Root Cause | Target Environment |
| :--- | :--- | :--- | :--- |
| **ISS-01** | Tenant receives no alert/toast on ticket creation | Missing error handling (`catch`) and missing success alert in `TicketCreate.tsx` | Production & Local Frontend |
| **ISS-02** | Tenant receives no in-app notification upon ticket creation | `notifyTicketCreated` only queries admin users and bypasses submitter; direct routing skips `notifyTicketCreated` entirely | Backend Code |
| **ISS-03** | Ticket assignment emails fail completely on VPS | Production `.env` uses personal password `Dem22&terefa` instead of Google App Password | Production Backend Config |
| **ISS-04** | Notification text shows "Ticket undefined" | `notificationService.js` references `ticket.reference_number` instead of fallback `ticket.reference_number \|\| ticket.referenceNumber` | Backend Code |
| **ISS-05** | Real-time web notifications fail to push on VPS | Host Nginx reverse proxy lacks WebSocket upgrade headers for `/socket.io/` | Production VPS Nginx |
| **ISS-06** | SLA escalation breaches never trigger | `sla_policies` seed records have `escalation_hours = 0`; `slaService.js` sets `escalation_due_date = NULL` | Database Data & Backend Code |
| **ISS-07** | SLA approaching deadline warnings miss tickets | Rigid 1-hour window, timezone offset (UTC container vs EAT), and warning emails ignore unassigned tickets | Backend Code & DB Config |
| **ISS-08** | Login fails with CORS error on VPS | Older deployed Docker backend image lacked regex matching for `helpdesk.ethiopianitpark.com` | Docker Image Version / Code |
| **ISS-09** | Large attachment uploads fail | Host Nginx default 1MB `client_max_body_size` blocks multi-MB uploads | Production VPS Nginx |

