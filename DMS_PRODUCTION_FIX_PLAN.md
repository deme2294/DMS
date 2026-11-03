# DMS Production Fix Plan & Remediation Strategy

**Document Reference:** `DMS_PRODUCTION_FIX_PLAN.md`  
**Application:** Government Help Desk Management System (ITPC Help Desk)  
**Target Environment:** Production Linux VPS (`https://helpdesk.ethiopianitpark.com`)  
**Date:** November 2026  
**Status:** Proposal / Plan — Strictly No Production or Source Modifications Until Approved

---

## 1. Safety & Production Integrity Mandate

In compliance with Phase 5 production safety requirements:
- **NO DESTRUCTIVE ACTIONS:** Production database records will NOT be deleted.
- **VOLUME PRESERVATION:** Production database volumes (`dms_db_data`) and upload volumes (`dms_uploads_data`) will NEVER be pruned, deleted, or recreated.
- **NO LOCAL OVERWRITE:** The production database will NOT be replaced with a local database export.
- **CREDENTIAL INTEGRITY:** Production user passwords will NOT be modified or reset.
- **ISOLATION PRESERVATION:** Database ports (3306/3307) will remain strictly internal to Docker and will NEVER be exposed publicly to the Internet.
- **BACKUP FIRST:** A full database dump and image backup will be taken prior to applying any update.

---

## 2. Issue Classification Matrix

Every identified problem is classified into its exact architectural category:

| Issue ID | Classification | Affected Component | Summary of Root Cause |
| :--- | :--- | :--- | :--- |
| **FIX-01** | **Application Code Issue (Frontend)** | `frontend/src/pages/Tickets/TicketCreate.tsx` | Missing `catch (err)` error handling and missing user-facing success alert/toast on ticket creation. |
| **FIX-02** | **Application Code Issue (Backend)** | `backend/services/ticketService.js` | Submitting tenant is excluded from in-app notification creation; direct-routed tickets bypass notification creation. |
| **FIX-03** | **Application Code Issue (Backend)** | `backend/services/notificationService.js` | Property name bug (`ticket.reference_number` without fallback `|| ticket.referenceNumber`) producing "Ticket undefined". |
| **FIX-04** | **Database Data & Schema Issue** | `backend/services/migrationService.js` & `sla_policies` | Seed SLA policies have `escalation_hours = 0`; existing active tickets have `escalation_due_date = NULL`. |
| **FIX-05** | **Application Code Issue (Backend)** | `backend/services/slaService.js` & `slaMonitorService.js` | Lack of escalation hours fallback; 1-hour warning window is too rigid; timezone mismatch between Docker UTC and EAT. |
| **FIX-06** | **Backend Environment Configuration Issue** | Production `.env` & `docker-compose.deploy.yml` | Invalid personal Google password (`Dem22&terefa`) causing Gmail SMTP auth failures; missing `EMAIL_FROM`, `SMTP_USER`, `SMTP_PASS`. |
| **FIX-07** | **Reverse Proxy & Networking Issue** | VPS Host Nginx configuration | Missing WebSocket upgrade headers for `/socket.io/` causing dropped real-time notifications; default 1MB upload limit. |
| **FIX-08** | **Docker Image Version Issue** | Docker Hub Images (`demex/dms-*`) | VPS runs stale `:latest` images lacking the CORS regex and migration updates. |

---

## 3. Detailed File-by-File Remediation Plan

---

### FIX-01: Frontend Ticket Creation Feedback & Error Handling

- **File to Modify:** `frontend/src/pages/Tickets/TicketCreate.tsx`
- **Category:** Application Code (Frontend)
- **Problem:** When submitting a ticket, errors cause silent failures. Successful submissions redirect immediately without a confirmation toast.
- **Recommended Solution:**
  1. Add error state `const [error, setError] = useState<string | null>(null);` and success state `const [successMsg, setSuccessMsg] = useState<string | null>(null);`.
  2. Implement comprehensive `try ... catch (err: any) ... finally` in `onSubmit`.
  3. Extract server error messages (e.g., `err.response?.data?.message || 'Failed to submit ticket'`) and display a styled error alert.
  4. On success, show a confirmation banner with the reference number, and briefly delay navigation or pass success state to the ticket details route.

```tsx
// Proposed snippet for TicketCreate.tsx
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);

const onSubmit = async (values: TicketFormValues) => {
    setError(null);
    setLoading(true);
    try {
        const formData = new FormData();
        formData.append('title', values.title);
        formData.append('description', values.description);
        formData.append('category', values.category);
        formData.append('priority', values.priority);
        if (values.departmentId) formData.append('departmentId', values.departmentId);

        if (values.attachments) {
            Array.from(values.attachments).forEach((file) => {
                formData.append('attachments', file);
            });
        }

        const res = await createTicket(formData);
        const ticketData = res.data.data;
        const shortId = ticketData.ticketNum ? String(ticketData.ticketNum) : (ticketData.referenceNumber || ticketData.id);
        
        setSuccess(`Ticket ${ticketData.referenceNumber || shortId} submitted successfully! Redirecting...`);
        setTimeout(() => {
            navigate(`/tenant/tickets/${shortId}`, { state: { createdSuccess: true, referenceNumber: ticketData.referenceNumber } });
        }, 1200);
    } catch (err: any) {
        console.error('Ticket creation error:', err);
        const msg = err.response?.data?.message || err.message || 'Failed to submit help request. Please verify all fields.';
        setError(msg);
    } finally {
        setLoading(false);
    }
};
```

---

### FIX-02: Submitter In-App Notification on Ticket Creation

- **File to Modify:** `backend/services/ticketService.js` and `backend/services/notificationService.js`
- **Category:** Application Code (Backend)
- **Problem:** Currently, `notifyTicketCreated` only notifies administrators (`r.name = 'admin'`). The submitting tenant gets no in-app notification. Furthermore, direct-routed categories bypass `notifyTicketCreated` entirely.
- **Recommended Solution:**
  1. In `ticketService.js` (`createTicket`), trigger a tenant-specific notification for the creator (`user.id`):
     ```javascript
     // Notify the submitting tenant in their notification bell
     await notificationService.notifyTenantTicketCreated(created, user.id);
     ```
  2. Implement `notifyTenantTicketCreated` in `notificationService.js`:
     ```javascript
     export const notifyTenantTicketCreated = async (ticket, tenantUserId) => {
       const ref = ticket.referenceNumber || ticket.reference_number || 'New Ticket';
       const title = 'Ticket Submitted Successfully';
       const message = `Your ticket ${ref} "${truncate(ticket.title, 50)}" has been received and is being processed.`;
       await notificationRepo.createNotification(tenantUserId, title, message, 'ticket', ticket.id);
       emitToUser(tenantUserId, 'notification', { title, message, type: 'ticket', ticketId: ticket.id });
     };
     ```
  3. Ensure this runs for BOTH `general` and `direct` category routing types.

---

### FIX-03: Notification Reference Number Bug ("Ticket undefined")

- **File to Modify:** `backend/services/notificationService.js`
- **Category:** Application Code (Backend)
- **Problem:** Lines 91 and 97 reference `ticket.reference_number`. When passed a sanitized ticket, the key is `ticket.referenceNumber`, causing messages to read `"Ticket undefined"`.
- **Recommended Solution:**
  Update lines 91 and 97 to use safe fallback accessor:
  ```javascript
  const ref = ticket.reference_number || ticket.referenceNumber || 'Assigned Ticket';
  ```
  Apply this consistently across `notifyTicketAssigned`, `notifyTicketAssignedToDepartment`, `notifySLABreached`, and `notifySLANearDeadline`.

---

### FIX-04: Database Migration for SLA Escalation Hours & Active Tickets Backfill

- **File to Modify:** `backend/services/migrationService.js`
- **Category:** Database Schema & Data Migration (Safe & Idempotent)
- **Problem:** Default seed SLA policies in `sla_policies` have `escalation_hours = 0`. Existing active tickets have `escalation_due_date = NULL`.
- **Recommended Solution:**
  Add a dedicated idempotent migration step (e.g., Step 18) in `migrationService.js`:
  1. Update existing `sla_policies` where `escalation_hours IS NULL OR escalation_hours = 0`:
     - `priority = 'urgent'`: set `escalation_hours = 2` (50% of 4h resolution)
     - `priority = 'high'`: set `escalation_hours = 4` (50% of 8h resolution)
     - `priority = 'medium'`: set `escalation_hours = 12` (50% of 24h resolution)
     - `priority = 'low'`: set `escalation_hours = 36` (50% of 72h resolution)
  2. For open/active tickets (`status NOT IN ('resolved','closed','completed','rejected','cancelled')`) where `escalation_due_date IS NULL`:
     - Safely backfill `escalation_due_date` using `DATE_ADD(created_at, INTERVAL X HOUR)` based on policy or priority.

---

### FIX-05: SLA Calculation Fallback & Approaching Deadline Monitoring

- **Files to Modify:** `backend/services/slaService.js` and `backend/services/slaMonitorService.js`
- **Category:** Application Code (Backend)
- **Problem:**
  - If `policy.escalation_hours` is 0 or missing, `computeAllDueDates` returns `escalationDueDate = null`.
  - In `slaMonitorService.js`, the 1-hour window misses deadlines, timezone offsets cause mismatches, and unassigned tickets send no warning emails.
- **Recommended Solution:**
  1. In `slaService.js` (`computeAllDueDates`):
     ```javascript
     let escalationHours = Number(policy.escalation_hours ?? 0);
     if (escalationHours <= 0) {
       // Fallback to 50% of resolution hours as default escalation trigger
       escalationHours = Math.max(1, Math.round(resolutionHours * 0.5));
     }
     const escalationDueDate = addBusinessHours(base, escalationHours, workingHours);
     ```
  2. In `slaMonitorService.js` (`processNearDeadlineWarnings`):
     - Expand warning query window from 1 hour to 2 hours (`INTERVAL 2 HOUR`).
     - If `ticket.assigned_to` is NULL, notify the department manager or system admins via email so approaching deadlines are never dropped.
     - Normalize timestamps using standard UTC comparisons.

---

### FIX-06: Production Email SMTP Configuration (Google App Password)

- **Files to Modify:** Production `.env` on VPS, `docker-compose.deploy.yml`
- **Category:** Backend Environment Configuration
- **Problem:** Production `.env` uses `EMAIL_PASS=Dem22&terefa`, which Gmail blocks with `535-5.7.8` authentication error. `docker-compose.deploy.yml` omits `EMAIL_FROM`, `SMTP_USER`, and `SMTP_PASS`.
- **Recommended Solution:**
  1. Update production `.env`:
     ```env
     # Configure valid 16-character Google App Password (2-Step Verification)
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=demshuterefe94@gmail.com
     EMAIL_PASS=qfbf wbwa ftas qltg
     EMAIL_FROM="ITPC Help Desk <demshuterefe94@gmail.com>"
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_SECURE=false
     SMTP_USER=demshuterefe94@gmail.com
     SMTP_PASS=qfbf wbwa ftas qltg
     ```
  2. Update `docker-compose.deploy.yml` backend service environment block:
     ```yaml
     EMAIL_HOST: ${EMAIL_HOST:-smtp.gmail.com}
     EMAIL_PORT: ${EMAIL_PORT:-587}
     EMAIL_USER: ${EMAIL_USER:-}
     EMAIL_PASS: ${EMAIL_PASS:-}
     EMAIL_FROM: ${EMAIL_FROM:-"ITPC Help Desk <demshuterefe94@gmail.com>"}
     SMTP_HOST: ${SMTP_HOST:-smtp.gmail.com}
     SMTP_PORT: ${SMTP_PORT:-587}
     SMTP_SECURE: ${SMTP_SECURE:-false}
     SMTP_USER: ${SMTP_USER:-}
     SMTP_PASS: ${SMTP_PASS:-}
     ```

---

### FIX-07: VPS Host Nginx Configuration (WebSocket & Upload Size)

- **File to Modify:** VPS Host `/etc/nginx/sites-available/helpdesk.ethiopianitpark.com` (or `/etc/nginx/conf.d/helpdesk.conf`)
- **Category:** Reverse Proxy & Networking
- **Problem:** Host Nginx lacks WebSocket upgrade directives and uses default 1MB max body size.
- **Recommended Solution:**
  Configure the host Nginx server block:
  ```nginx
  server {
      server_name helpdesk.ethiopianitpark.com;
      client_max_body_size 25M;

      # Frontend SPA
      location / {
          proxy_pass http://127.0.0.1:8082;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # Backend API
      location /api {
          proxy_pass http://127.0.0.1:5001;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # Static Uploads
      location /uploads {
          proxy_pass http://127.0.0.1:5001;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # Socket.IO Realtime WebSocket
      location /socket.io/ {
          proxy_pass http://127.0.0.1:5001;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_read_timeout 86400s;
          proxy_send_timeout 86400s;
      }
  }
  ```

---

### FIX-08: Docker Image Build & Tagging Pipeline

- **Category:** Docker Image Version Management
- **Problem:** The VPS pulls `demex/dms-backend:latest` and `demex/dms-frontend:latest`. Using untagged or stale `:latest` causes ambiguity.
- **Recommended Solution:**
  1. Build with immutable timestamp/commit tags alongside `:latest`:
     ```bash
     docker build -t demex/dms-backend:latest -t demex/dms-backend:20261103-v1 backend/
     docker build -t demex/dms-frontend:latest -t demex/dms-frontend:20261103-v1 frontend/
     docker push demex/dms-backend:latest
     docker push demex/dms-backend:20261103-v1
     docker push demex/dms-frontend:latest
     docker push demex/dms-frontend:20261103-v1
     ```
  2. On VPS, pull and recreate containers without touching database volume.

---

## 4. Production Deployment Safety, Backup & Rollback Protocol

### Step 1: Pre-Deployment Full Database Backup (Zero-Risk)
Execute on VPS prior to pulling new images:
```bash
# Navigate to deployment directory
cd /root/DMS # (or deploy folder on VPS)

# Create timestamped backup directory
mkdir -p /root/backups

# Dump MariaDB database without stopping the container
docker compose -f docker-compose.deploy.yml exec -T db mysqldump \
  -u root -p'DmsSecureDbRootPass2026!' \
  --single-transaction \
  --routines \
  --triggers \
  dms_db > /root/backups/dms_db_pre_fix_$(date +%Y%m%d_%H%M%S).sql

# Verify backup size and validity
ls -lh /root/backups/
tail -n 10 /root/backups/dms_db_pre_fix_*.sql
```

### Step 2: Tag Existing Running Images as Local Fallback
```bash
docker tag demex/dms-backend:latest demex/dms-backend:backup-stable
docker tag demex/dms-frontend:latest demex/dms-frontend:backup-stable
```

### Step 3: Pull Updated Images & Safe Restart
```bash
# Pull new images
docker compose -f docker-compose.deploy.yml pull backend frontend

# Restart application containers ONLY (never touch 'db')
docker compose -f docker-compose.deploy.yml up -d --no-deps backend frontend

# Monitor startup logs and migration execution
docker compose -f docker-compose.deploy.yml logs -f --tail=100 backend
```

### Step 4: Emergency Rollback Procedure (If Any Anomaly Occurs)
If any workflow encounters an unexpected error:
```bash
# 1. Roll back containers immediately to backup images
docker tag demex/dms-backend:backup-stable demex/dms-backend:latest
docker tag demex/dms-frontend:backup-stable demex/dms-frontend:latest
docker compose -f docker-compose.deploy.yml up -d --no-deps backend frontend

# 2. If database records need restoring (only if corrupted):
docker compose -f docker-compose.deploy.yml exec -T db mysql \
  -u root -p'DmsSecureDbRootPass2026!' \
  dms_db < /root/backups/dms_db_pre_fix_*.sql
```

