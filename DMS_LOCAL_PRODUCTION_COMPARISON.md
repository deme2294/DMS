# DMS Local vs Production Configuration & Architecture Comparison

**Document Reference:** `DMS_LOCAL_PRODUCTION_COMPARISON.md`  
**Application:** Government Help Desk Management System (ITPC Help Desk)  
**Production Domain:** `https://helpdesk.ethiopianitpark.com`  
**Date:** November 2026  
**Status:** Audit & Investigation Complete (Awaiting User Review Before Code/Env Modifications)

---

## Executive Summary

An exhaustive technical audit of the IT Park Corporation Help Desk Management System (DMS) was conducted across the source code, environment variables, Docker specifications, and deployment topology. The system consists of:
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS / CSS Modules, Socket.IO client.
- **Backend:** Node.js (v18/v20), Express, Socket.IO, Nodemailer, MySQL2 (`mysql2/promise`).
- **Database:** MariaDB 10.11 / MySQL 8.0 with InnoDB engine and dynamic schema migration service.
- **Container Infrastructure:** Multi-stage Dockerfiles, Docker Compose, Docker Hub (`demex/dms-frontend`, `demex/dms-backend`).
- **Gateway / Proxy:** VPS Host Nginx Reverse Proxy terminating SSL via Let's Encrypt, routing to Docker internal ports.

This comparison isolates all key differences between the local development environment and the production VPS environment across ten core architectural dimensions, diagnosing why certain production workflows diverge from local behavior.

---

## 1. Local vs Production Frontend Configuration

| Feature / Setting | Local Development (`localhost`) | Production Deployed (`helpdesk.ethiopianitpark.com`) | Behavioral Impact & Risk |
| :--- | :--- | :--- | :--- |
| **Vite Dev Server vs Nginx** | Vite HMR server on port `5173` | Production build hosted inside Alpine Nginx container on container port `80`, exposed as `8082` | In local dev, Vite proxies API requests and handles HMR. In production, Nginx serves static compiled `.js`/`.css` bundles and must handle client-side SPA routing fallbacks via `try_files $uri $uri/ /index.html;`. |
| **`VITE_API_URL` Environment** | Typically unset or `http://localhost:5000/api` | Baked into bundle at `npm run build` time via Docker ARG/ENV (`ARG VITE_API_URL`, `ENV VITE_API_URL`) | If `VITE_API_URL` is omitted during Docker image build, it defaults to `/api`. This requires the production host reverse proxy to forward `/api` to the backend container. If built with `http://localhost:5000/api`, all production browser calls fail immediately. |
| **Asset Caching & Bundle Hashes** | Uncached Vite ES modules | Hashed assets (`index-*.js`, `vendor-*.js`) cached by Nginx | Outdated browser cache can execute old JavaScript frontend bundles that send legacy payload formats or expect deprecated endpoints. |
| **Error Handling in Forms** | Browser console open; unhandled promise rejections visible in DevTools | User sees silent failure when API calls fail (e.g. `TicketCreate.tsx` lacks catch block) | In production, tenants cannot see error stack traces; missing UI error alerts leave users thinking the button or page is frozen. |

---

## 2. Local vs Production Backend Configuration

| Parameter | Local Environment (`backend/.env`) | Production Environment (`.env` / `docker-compose.deploy.yml`) | Behavioral Impact |
| :--- | :--- | :--- | :--- |
| **Node Environment (`NODE_ENV`)** | `development` | `production` | Stack traces hidden in production HTTP 500 responses; cookies enforce secure attributes when configured. |
| **Listening Port (`PORT`)** | `5000` (Direct Node process) | `5000` (Inside container, mapped to host `5001`) | Production host reverse proxy must proxy `https://helpdesk.ethiopianitpark.com/api` to `http://127.0.0.1:5001`. |
| **Database Connection Target (`DB_TARGET`)** | Dynamically toggles between `docker` (3307) and `xampp` (3306) via `db.js` | Fixed to `docker` (host `db`, port `3306`) | In production container networking, backend resolves database via container name `db:3306`, not `127.0.0.1`. |
| **CORS Origins (`ALLOWED_ORIGINS` / `FRONTEND_URL`)** | `http://localhost:5173`, `http://localhost:3000` | Must explicitly include `https://helpdesk.ethiopianitpark.com` | **CRITICAL PRODUCTION ISSUE:** If `FRONTEND_URL` does not include `https://helpdesk.ethiopianitpark.com`, Express CORS rejects all requests with HTTP 403 / "Cross-Origin Resource Sharing policy does not allow access from this origin." |
| **Rate Limiting** | Disabled or high threshold | Enforced (e.g., 100 req/15min) | Background polls or rapid tenant clicks on production can trigger HTTP 429 Too Many Requests. |

---

## 3. Docker Image Versions & Contents

| Aspect | Local Development | Production VPS Deployment | Analysis |
| :--- | :--- | :--- | :--- |
| **Backend Image** | Direct source run via `node server.js` or local Dockerfile build | `demex/dms-backend:latest` pulled from Docker Hub | When local code is edited in `backend/`, changes take effect immediately. On VPS, changes **do not exist** until a new image is built, pushed to Docker Hub, pulled on the VPS, and containers recreated. |
| **Frontend Image** | Vite dev server | `demex/dms-frontend:latest` pulled from Docker Hub | Multi-stage build (`node:18-alpine` builder -> `nginx:alpine` runtime). Changes to `.tsx` files must be rebuilt into the image. |
| **Database Image** | Local XAMPP MySQL or `mariadb:10.11` | `mariadb:10.11` via `docker-compose.deploy.yml` | Production runs MariaDB 10.11 in an isolated container with persistent Docker volume `dms_db_data`. |
| **Image Divergence Risk** | Low (instant local refresh) | **HIGH**: Running `:latest` without version pinning risks pulling stale or mismatched layers. | Code fixes deployed locally are not present on production until rebuilt and redeployed. |

---

## 4. API Base URLs & Reverse-Proxy Routing

| Routing Component | Local Machine | Production VPS (`helpdesk.ethiopianitpark.com`) |
| :--- | :--- | :--- |
| **Client Entrypoint** | `http://localhost:5173` | `https://helpdesk.ethiopianitpark.com` (Port 443 via Let's Encrypt SSL) |
| **Frontend Container** | None (Node process) | Docker container on port 80 -> host port `8082` |
| **Host Nginx Proxy (`/`)** | N/A | `proxy_pass http://127.0.0.1:8082;` |
| **Host Nginx Proxy (`/api`)** | Vite proxy or direct `http://localhost:5000/api` | `proxy_pass http://127.0.0.1:5001/api;` (or stripped `/api/`) |
| **Host Nginx Proxy (`/socket.io/`)** | Direct `ws://localhost:5000/socket.io/` | `proxy_pass http://127.0.0.1:5001/socket.io/;` with WebSocket upgrade headers |
| **Host Nginx Proxy (`/uploads/`)** | Served by Express `express.static('uploads')` | Proxied to backend port `5001/uploads` or served directly via Nginx |

> [!WARNING]
> **WebSocket Upgrade Header Gap:** If the VPS host-level Nginx reverse proxy configuration does not specify:
> ```nginx
> proxy_http_version 1.1;
> proxy_set_header Upgrade $http_upgrade;
> proxy_set_header Connection "upgrade";
> ```
> WebSocket connections drop back to HTTP long-polling or fail entirely. In local dev, WebSocket connects directly to port 5000 without proxy interference.

---

## 5. CORS & Authentication Configuration

| Parameter | Local Configuration | Production Configuration | Divergence Risk |
| :--- | :--- | :--- | :--- |
| **CORS Middleware** | `cors({ origin: allowedOrigins, credentials: true })` | Same middleware, but relies on `FRONTEND_URL` in `.env` | If production `.env` contains `http://localhost:5173` or misses the domain, CORS rejects preflight `OPTIONS` and requests fail with status 403. |
| **Dynamic Regex Origin** | Added to `server.js` (`/https?:\/\/([a-z0-9-]+\.)?ethiopianitpark\.(com\|et)(:\d+)?$/i`) | Not present in older deployed Docker Hub images until rebuilt | The live production container may still be executing an older image without regex domain matching. |
| **JWT Secrets & Tokens** | Default development secret in `.env` | Production JWT secret in `.env` | Must remain distinct. Changing JWT secret invalidates all active sessions. |
| **JWT Storage** | Client `localStorage.getItem('token')` sent via `Authorization: Bearer <token>` | Same mechanism | Validated. Both environments use Bearer header authentication. |

---

## 6. Database Schema & Migration Versions

| Database Aspect | Local Environment | Production VPS Environment | Discrepancy & Finding |
| :--- | :--- | :--- | :--- |
| **RDBMS Engine** | MySQL 8.0.31 (XAMPP) | MariaDB 10.11.x (Docker) | MariaDB 10.11 and MySQL 8.0 differ in default SQL modes and index creation handling for auto-increment columns. |
| **Timezone Setting** | System timezone `UTC+03:00` (EAT) | Container timezone default `UTC` (`+00:00`) | **CRITICAL:** In Docker MariaDB, `NOW()` returns UTC time. In local Windows, `NOW()` returns East Africa Time. A 3-hour difference alters SLA calculations (`BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)`). |
| **`users.user_num` Column** | Added via `migrationService.js` step 15b | May be missing if production container hasn't executed migration | If `users.user_num` is missing on production, queries in `userRepository.js` fail with `ER_BAD_FIELD_ERROR`. |
| **`sla_policies.escalation_hours`** | `0` (default in seed data) | `0` (default in seed data) | Default seed records have `escalation_hours = 0`. Due to `slaService.js` requiring `escalationHours > 0`, `escalation_due_date` is `NULL` in both environments. |

---

## 7. Roles & Permissions Topology

Both environments share identical database role structures:
1. `admin` (Role ID `admin001-0000-0000-0000-000000000001`): Full system oversight, user management, category and SLA policy administration.
2. `manager` (Role ID `manag001-0000-0000-0000-000000000002`): Department-level oversight, assigns tickets to department staff, monitors departmental SLAs.
3. `staff` (Role ID `staff001-0000-0000-0000-000000000003`): Resolves assigned tickets, adds work notes and internal comments, submits resolution for verification.
4. `tenant` (Role ID `tenan001-0000-0000-0000-000000000004`): Creates help requests, attaches files, tracks ticket status, reopens resolved tickets if needed.
5. `ceo` (Role ID `ceo00001-0000-0000-0000-000000000005`): Executive dashboard access, high-level SLA metrics and reporting.

**Local vs Production Difference:** In local development, demo accounts (`admin`, `manager`, `staff`, `tenant`, `ceo`) have password `password`. In production, accounts have real credentials; password resets or automated seed script execution must never overwrite production credentials.

---

## 8. Ticket Categories, Routing & SLA Configuration

| Setting / Record | Local Development | Production Deployed | Impact on Workflow |
| :--- | :--- | :--- | :--- |
| **Routing Types** | Supported: `general` (admin queue) and `direct` (department queue) | Same schema | If category routing type is `direct`, ticket bypasses admin queue and routes immediately to department manager. |
| **Tenant Notification on Creation** | Tenant is not sent in-app notification in either environment (`notifyTicketCreated` only selects `admin` users). Direct-routed categories bypass `notifyTicketCreated` altogether. | Same code, but local developer notices via logs while production tenant notices missing UI feedback. | **CRITICAL USER PAIN POINT:** Tenant creates ticket, sees no notification or feedback alert. |
| **SLA Seed Policies** | Critical (4h), High (8h), Medium (24h), Low (72h) | Same seed data | Seed policies define `response_hours` and `resolution_hours`, but leave `escalation_hours = 0`. As a result, no tickets receive an `escalation_due_date`. |
| **Working Hours Calculation** | Enabled with fallback 24/7 | Same code | Uses `slaService.js` business hours engine. |

---

## 9. Uploaded Files & Storage Paths

| Storage Dimension | Local Development | Production VPS | Risk / Finding |
| :--- | :--- | :--- | :--- |
| **Storage Directory** | `C:\Users\hp\Desktop\DMS\backend\uploads\` | `/app/uploads` mapped to named Docker volume `dms_uploads_data` | Storage persistence works via Docker volume. |
| **File URL Generation** | `/uploads/tickets/<filename>` | `/uploads/tickets/<filename>` | URLs are relative. When served, browser requests `https://helpdesk.ethiopianitpark.com/uploads/tickets/<filename>`. |
| **Proxy File Serving** | Express static middleware `app.use('/uploads', express.static(...))` | Express static middleware inside container | If host Nginx doesn't route `/uploads` to port 5001, attachment downloads return 404. |
| **Upload Size Limits** | Express Multer limit: 10MB | Nginx reverse proxy default: 1MB (`client_max_body_size`) | **CRITICAL:** If host Nginx lacks `client_max_body_size 25M;`, uploads larger than 1MB fail with `413 Request Entity Too Large` before reaching Express. |

---

## 10. Background Processes, Sockets & Email (SMTP)

| System Component | Local Development (`backend/.env`) | Production Deployed (`.env` / `docker-compose.deploy.yml`) | Critical Finding |
| :--- | :--- | :--- | :--- |
| **`EMAIL_USER`** | `demshuterefe94@gmail.com` | `misgenaht@gmail.com` | Different sender accounts. |
| **`EMAIL_PASS`** | `qfbf wbwa ftas qltg` (16-char Google App Password) | `Dem22&terefa` (Personal Google account password) | **FATAL EMAIL FAILURE ON VPS:** Google rejects plain passwords with `535-5.7.8 Username and Password not accepted` (`EAUTH`). Gmail requires an App Password. All ticket assignment, SLA warning, and status update emails fail silently on the VPS. |
| **Environment Variable Passthrough** | Loaded directly by `dotenv` in Node | Forwarded through `docker-compose.deploy.yml` | `docker-compose.deploy.yml` forwards `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, but omits `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. |
| **SLA Background Monitor** | `startSlaMonitor(60000)` running every 60 seconds | `startSlaMonitor(60000)` running inside container | Runs in both environments. However, due to `escalation_hours = 0` and UTC vs EAT timezone offset, SQL queries match zero records. |
| **Socket.IO Real-time Events** | Connected directly to `http://localhost:5000` | Connected to `https://helpdesk.ethiopianitpark.com` | Host Nginx reverse proxy must pass WebSocket upgrade headers; otherwise, client drops to polling or disconnects, causing missed real-time notifications. |

---

## Conclusion & Root Cause Matrix

The investigation reveals four primary reasons for the behavioral divergence between local development and the deployed VPS:
1. **Email Authentication Breakdown:** Production `.env` uses an invalid personal password (`Dem22&terefa`) instead of a Google App Password, killing all notification emails upon ticket creation, assignment, and escalation.
2. **Missing Escalation Hours & Timezone Discrepancy:** Seed SLA policies have `escalation_hours = 0`, causing `escalation_due_date` to be `NULL`, while Docker UTC time vs Ethiopian EAT (UTC+3) causes deadline queries to miss approaching deadlines.
3. **Frontend Silent Failures & Missing Tenant Notifications:** `TicketCreate.tsx` has no error handling in `onSubmit` (silent failures on error) and does not display a confirmation toast upon success. Furthermore, backend `notifyTicketCreated` only notifies admins, omitting the submitting tenant completely.
4. **WebSocket Upgrade & CORS Host Proxy Gaps:** Missing WebSocket upgrade directives in the host Nginx reverse proxy prevent real-time in-app bell notification delivery, and previous Docker images lacked regex origin matching for `helpdesk.ethiopianitpark.com`.

