# DMS Deployment & Workflow Verification Checklist

**Document Reference:** `DMS_DEPLOYMENT_VERIFICATION_CHECKLIST.md`  
**Application:** Government Help Desk Management System (DMS)  
**Target Environment:** Production Linux VPS (`https://helpdesk.ethiopianitpark.com`)  
**Date:** November 2026  
**Status:** Verification Protocol — Awaiting Plan Approval

---

## 1. Pre-Deployment Integrity Checks

Execute these checks on the VPS before applying updates to confirm system health:

- [ ] **1.1. Container Status Check**
  ```bash
  docker compose -f docker-compose.deploy.yml ps
  ```
  *Expected Result:* All containers (`dms_db`, `dms_backend`, `dms_frontend`) report `Up` status.

- [ ] **1.2. Database Persistence Verification**
  ```bash
  docker volume ls | grep dms
  ```
  *Expected Result:* `dms_db_data` and `dms_uploads_data` exist and are active.

- [ ] **1.3. Database Pre-Deployment Snapshot**
  ```bash
  mkdir -p /root/backups
  docker compose -f docker-compose.deploy.yml exec -T db mysqldump \
    -u root -p'DmsSecureDbRootPass2026!' \
    --single-transaction dms_db > /root/backups/dms_db_pre_deploy_$(date +%Y%m%d_%H%M%S).sql
  ls -lh /root/backups/
  ```
  *Expected Result:* Backup file created with non-zero size (e.g. > 100KB).

- [ ] **1.4. Image Tagging for Rollback Safety**
  ```bash
  docker tag demex/dms-backend:latest demex/dms-backend:rollback-point
  docker tag demex/dms-frontend:latest demex/dms-frontend:rollback-point
  ```

---

## 2. Environment & Network Configuration Verification

- [ ] **2.1. Verify SMTP / Gmail App Password in VPS `.env`**
  ```bash
  grep -E "EMAIL_|SMTP_" /root/DMS/.env
  ```
  *Checklist:*
  - `EMAIL_HOST` = `smtp.gmail.com`
  - `EMAIL_PORT` = `587`
  - `EMAIL_USER` matches the sending Gmail account.
  - `EMAIL_PASS` is a valid 16-character Google App Password (NO personal account password).
  - `EMAIL_FROM` is defined (e.g., `"ITPC Help Desk <demshuterefe94@gmail.com>"`).

- [ ] **2.2. Verify Host Nginx Reverse Proxy Configuration**
  ```bash
  nginx -t
  ```
  *Verify that `/etc/nginx/sites-available/...` contains:*
  - `client_max_body_size 25M;`
  - `location /api` proxies to `http://127.0.0.1:5001;`
  - `location /socket.io/` includes `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection "upgrade";`

- [ ] **2.3. Test CORS Headers via Curl**
  ```bash
  curl -I -X OPTIONS https://helpdesk.ethiopianitpark.com/api/auth/login \
    -H "Origin: https://helpdesk.ethiopianitpark.com" \
    -H "Access-Control-Request-Method: POST"
  ```
  *Expected Result:* HTTP 204 or 200 with header `Access-Control-Allow-Origin: https://helpdesk.ethiopianitpark.com` and `Access-Control-Allow-Credentials: true`.

---

## 3. Database Migration & SLA Policy Verification

Run the following SQL queries inside the database container to verify migration execution:

```bash
docker compose -f docker-compose.deploy.yml exec -T db mysql -u root -p'DmsSecureDbRootPass2026!' dms_db -e "
SELECT name, priority, response_hours, resolution_hours, escalation_hours 
FROM sla_policies;
"
```

*Acceptance Criteria:*
- [ ] `Critical SLA` (`urgent`): `escalation_hours` >= 2
- [ ] `High SLA` (`high`): `escalation_hours` >= 4
- [ ] `Medium SLA` (`medium`): `escalation_hours` >= 12
- [ ] `Low SLA` (`low`): `escalation_hours` >= 36
- [ ] No active policies have `escalation_hours = 0` or `NULL`.

Verify `users.user_num` column exists:
```bash
docker compose -f docker-compose.deploy.yml exec -T db mysql -u root -p'DmsSecureDbRootPass2026!' dms_db -e "
SHOW COLUMNS FROM users LIKE 'user_num';
"
```
*Acceptance Criteria:*
- [ ] Field `user_num` exists with type `int(11)`.

---

## 4. End-to-End Workflow Acceptance Testing

### Test Suite 1: Tenant Ticket Creation & Alert Verification

1. **Execution Steps:**
   - Log in as a tenant on `https://helpdesk.ethiopianitpark.com/login`.
   - Navigate to `/tenant/tickets/new`.
   - Fill out Title: `Deployment Test Ticket - Verification`, Category: `Hardware`, Priority: `Medium`, Description: `Testing alerts and notifications.`.
   - Attach a sample file (< 5MB) and click "Submit Ticket".
2. **Verification Criteria:**
   - [ ] **UI Success Alert:** A clear green confirmation alert/toast is displayed informing the tenant of the new ticket reference number (e.g. `Ticket HD-2026-XXXX submitted successfully`).
   - [ ] **Navigation:** The page smoothly routes to `/tenant/tickets/:id`.
   - [ ] **Tenant In-App Notification:** Click the bell icon in the top navigation bar. The notification dropdown lists `"Ticket Submitted Successfully: Your ticket HD-2026-XXXX has been received"`.
   - [ ] **Tenant Confirmation Email:** Check the submitter's email inbox; a confirmation email with tracking number arrives.
   - [ ] **Error Path Test:** Try submitting a ticket with an empty title or invalid payload; verify an explicit red error alert is displayed without silent failure.

---

### Test Suite 2: Ticket Assignment & Notification Delivery

1. **Execution Steps:**
   - In another browser session, log in as Department Manager or Administrator.
   - Open the newly created test ticket.
   - Click "Assign Ticket", select a department staff member (e.g., `staff`), and click Save.
2. **Verification Criteria:**
   - [ ] **Assignee In-App Notification:** Log in as the assigned staff member. The notification bell increments in real-time.
   - [ ] **Accurate Reference Number:** The notification text states `"You have been assigned ticket HD-2026-XXXX"` (verifying NO `"Ticket undefined"` bug).
   - [ ] **Real-Time Push:** The toast appears instantly via WebSocket without requiring a manual page refresh.
   - [ ] **Email Delivery:** The assigned staff member receives an email titled `"Ticket Assigned to You: [HD-2026-XXXX] Deployment Test Ticket - Verification"`.

---

### Test Suite 3: Approaching SLA Deadline Warning

1. **Execution Steps:**
   - Create a test ticket with urgent priority or simulate an approaching deadline by updating the database:
     ```sql
     UPDATE tickets 
     SET due_date = DATE_ADD(NOW(), INTERVAL 45 MINUTE),
         response_due_date = DATE_ADD(NOW(), INTERVAL 30 MINUTE),
         last_sla_warning_at = NULL
     WHERE reference_number = 'HD-2026-XXXX';
     ```
   - Trigger the SLA monitor check or wait 60 seconds.
2. **Verification Criteria:**
   - [ ] `tickets.last_sla_warning_at` is updated to current timestamp.
   - [ ] In-app notification with title `"Response SLA Approaching"` or `"Resolution SLA Approaching"` is delivered to the assigned staff member and department manager.
   - [ ] An email notification is delivered to the assignee notifying them of the approaching deadline.

---

### Test Suite 4: SLA Escalation Breach & Auto-Status Transition

1. **Execution Steps:**
   - In the database, set the ticket's `escalation_due_date` to 5 minutes in the past:
     ```sql
     UPDATE tickets 
     SET escalation_due_date = DATE_SUB(NOW(), INTERVAL 5 MINUTE),
         escalation_sla_breached = 0,
         status = 'assigned'
     WHERE reference_number = 'HD-2026-XXXX';
     ```
   - Wait 60 seconds for `checkSlaDeadlines()` to execute.
2. **Verification Criteria:**
   - [ ] Ticket `status` automatically transitions to `'escalated'`.
   - [ ] `tickets.is_escalated` is set to `1` and `escalated_at` is populated.
   - [ ] A record is created in `ticket_status_history` noting: `"Ticket automatically escalated due to Escalation SLA policy breach"`.
   - [ ] Department Manager and Administrators receive an escalation breach notification in the web app and by email.

---

### Test Suite 5: Attachment Upload & Download Verification

1. **Execution Steps:**
   - On the ticket detail page, upload a 5MB image or document attachment.
   - Refresh the page and click the attachment link to view/download.
2. **Verification Criteria:**
   - [ ] Upload succeeds without HTTP 413 (Payload Too Large).
   - [ ] Attachment is stored inside Docker volume `/app/uploads/tickets/`.
   - [ ] File downloads and renders cleanly in the browser.

---

## 5. Rollback Acceptance Gate

If **any** of the 5 test suites fail during production verification, execute the immediate rollback procedure:

```bash
# 1. Roll back containers to saved rollback point
docker compose -f docker-compose.deploy.yml down backend frontend
docker tag demex/dms-backend:rollback-point demex/dms-backend:latest
docker tag demex/dms-frontend:rollback-point demex/dms-frontend:latest
docker compose -f docker-compose.deploy.yml up -d backend frontend

# 2. Confirm rollback containers are healthy
docker compose -f docker-compose.deploy.yml ps
docker compose -f docker-compose.deploy.yml logs --tail=50 backend
```

