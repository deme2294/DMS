# DMS Help Desk Management System — Docker Infrastructure Guide

This repository is configured with a streamlined, production-ready Docker architecture. All services—**Frontend**, **Backend**, **Database**, and **phpMyAdmin**—are containerized with persistent storage, isolated networking, automated database schema initialization, and custom image builds.

---

## 1. System Architecture & Container Stack

```
                              ┌────────────────────────┐
                              │     Browser Client     │
                              └───────────┬────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ :5173                 │ :8081                 │ :5000
                  ▼                       ▼                       ▼
          ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
          │   dms-frontend   │   │  dms-phpmyadmin  │   │   dms-backend    │
          │  (React + Nginx) │   │ (phpMyAdmin Web) │   │  (Node.js + WS)  │
          └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
                   │ /api, /uploads, /socket.io                  │
                   └─────────────────────────────────────────────┘
                                          │ :3306 (internal)
                                          ▼
                                 ┌──────────────────┐
                                 │      dms-db      │
                                 │ (MariaDB 10.4)   │
                                 └────────┬─────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
          ┌──────────────────────┐                     ┌──────────────────────┐
          │ Volume: dms_db_data  │                     │ Volume: dms_uploads  │
          │ (Persistent Tables)  │                     │ (Uploaded Documents) │
          └──────────────────────┘                     └──────────────────────┘
```

### Container Images Summary

| Service | Container Name | Built Image Tag | Dockerfile Location | Port | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `dms-frontend` | `dms-frontend:latest` | `frontend/Dockerfile` | `5173` | React 19 SPA served via Nginx reverse proxy |
| **Backend** | `dms-backend` | `dms-backend:latest` | `backend/Dockerfile` | `5000` | Node.js Express REST API & Socket.IO WebSockets |
| **Database** | `dms-db` | `dms-database:latest` | `docker/database/Dockerfile` | `3307` | Autonomous MariaDB 10.4 with pre-seeded SQL schema & custom `my.cnf` |
| **phpMyAdmin**| `dms-phpmyadmin`| `phpmyadmin/phpmyadmin:latest`| Standard Docker Hub Image | `8081` | Web database management GUI |

---

## 2. Directory Structure (Cleaned & Streamlined)

The redundant Docker files and folders have been consolidated into a professional, standardized structure:

```
DMS/
├── docker-compose.yml            # Single All-In-One Docker Compose file for the entire full-stack
├── .dockerignore                 # Root build exclusion rules (prevents bloated image contexts)
├── .env                          # Environment variables & port overrides
├── docker/
│   └── database/
│       ├── Dockerfile            # Autonomous MariaDB image with auto-initialization
│       └── my.cnf                # Optimized MariaDB server settings (utf8mb4, buffers)
├── backend/
│   ├── Dockerfile                # Multi-stage production build (Node 20 Alpine + bcrypt compile)
│   ├── .dockerignore             # Backend context exclusions
│   └── sql/
│       └── database.sql          # Seed schema loaded automatically on initial DB startup
└── frontend/
    ├── Dockerfile                # Multi-stage build (Vite build -> Nginx Alpine runtime)
    ├── .dockerignore             # Frontend context exclusions
    └── nginx.conf                # Nginx reverse proxy configuration (/api, /uploads, /socket.io)
```

### Cleanup Summary
- **Unified into single `docker-compose.yml`**: Removed `docker-compose.dev.yml` and `compose.yaml`; all services (full-stack or database-only) are managed from one general file.
- **Removed `bridge/`**: Cleaned up leftover Kubernetes transformation artifacts.
- **Consolidated `docker/mysql/` into `docker/database/`**: Unified `my.cnf` and `Dockerfile` in one place.
- **Removed junk files**: Removed temporary `dy` error log and duplicate `DATABASE_TABLE_FIX copy.txt`.
- **Added root `.dockerignore`**: Optimizes build performance and security.

---

## 3. Coexistence with XAMPP (Simultaneous Operation)

Both **XAMPP** and **Docker** can run at the same time with **zero port conflicts**:

| Service Stack | Component | Host Port | Database Password |
| :--- | :--- | :--- | :--- |
| **XAMPP** | MySQL | `3306` | *(empty by default)* |
| **XAMPP** | Apache / phpMyAdmin | `80` | [http://localhost/phpmyadmin](http://localhost/phpmyadmin) |
| **Docker** | MariaDB Database (`dms-db`) | `3307` | `root` |
| **Docker** | phpMyAdmin (`dms-phpmyadmin`) | `8081` | [http://localhost:8081](http://localhost:8081) |
| **Docker** | Backend API (`dms-backend`) | `5000` | [http://localhost:5000](http://localhost:5000) |
| **Docker** | Frontend UI (`dms-frontend`) | `5173` | [http://localhost:5173](http://localhost:5173) |

- **Local Backend DB Switching**: When running `node server.js` locally on your host machine, you can toggle between databases anytime in [backend/.env](file:///c:/Users/hp/Desktop/DMS/backend/.env):
  - `DB_TARGET=docker` → connects to Docker MariaDB (`127.0.0.1:3307`, password: `root`)
  - `DB_TARGET=xampp` → connects to XAMPP MySQL (`127.0.0.1:3306`, password: `""`)

---

## 4. Steps to Run the Application on Docker Desktop

### Step 1: Open PowerShell or Terminal
Open PowerShell or your terminal in the root project folder:
```powershell
cd c:\Users\hp\Desktop\DMS
```

### Step 2: Build and Start All Containers
Run the following single command:
```powershell
docker compose up -d --build
```
> **What this does:**
> 1. Builds the **`dms-database:latest`** image (including custom `my.cnf` and initial `database.sql` schema).
> 2. Builds the **`dms-backend:latest`** image (compiles native dependencies, sets up healthchecks).
> 3. Builds the **`dms-frontend:latest`** image (compiles Vite React assets, configures Nginx).
> 4. Pulls **`phpmyadmin:latest`**.
> 5. Starts all 4 containers in the background (`-d`) on the `dms-network`.

### Step 3: Verify the Running Containers
Check the status of your services:
```powershell
docker compose ps
```
All containers will display status `Up` or `Up (healthy)`:
- `dms-db` (healthy)
- `dms-backend` (healthy)
- `dms-frontend` (healthy)
- `dms-phpmyadmin` (Up)

### Step 4: Check Docker Desktop GUI
Open the **Docker Desktop** application window:
- **Containers Tab**: You will see a group named **`dms`** containing all 4 running containers (`dms-db`, `dms-backend`, `dms-frontend`, `dms-phpmyadmin`) with green indicator dots.
- **Images Tab**: You will see the custom built images:
  - `dms-frontend:latest`
  - `dms-backend:latest`
  - `dms-database:latest`
  - `phpmyadmin/phpmyadmin:latest`
- **Volumes Tab**: You will see persistent storage volumes:
  - `dms_db_data` (preserves your MariaDB database even when containers are restarted)
  - `dms_uploads` (preserves ticket attachments and document uploads)

---

## 5. Application Access & URLs

Once started, access each service in your web browser:

| Application / Service | URL | Login / Details |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) | Main application interface (Login, Dashboard, Tickets) |
| **Backend Health Check** | [http://localhost:5000/api/health](http://localhost:5000/api/health) | Returns JSON status: `{"success": true, "status": "operational", ...}` |
| **phpMyAdmin Database GUI** | [http://localhost:8081](http://localhost:8081) | **Server:** `db`<br>**Username:** `root`<br>**Password:** `root` |

---

## 6. Daily Management Commands

### Viewing Real-Time Logs
```powershell
# View logs for all services combined
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Stopping and Restarting
```powershell
# Stop all services without deleting data
docker compose stop

# Start stopped services
docker compose start

# Restart all services
docker compose restart
```

### Rebuilding After Making Code Changes
```powershell
# Rebuild frontend after editing React components
docker compose up -d --build frontend

# Rebuild backend after modifying server code or packages
docker compose up -d --build backend
```

### Complete Teardown & Reset
```powershell
# Stop and remove containers and networks (data volumes are PRESERVED)
docker compose down

# FULL RESET: Stop and remove containers, networks, AND database/upload volumes
# (WARNING: Only use this if you want a completely fresh database initialization)
docker compose down -v
```

---

## 7. Troubleshooting

- **Error: `failed to connect to the docker API`**:
  Docker Desktop is not currently running. Open Docker Desktop from the Windows Start menu and wait for it to start.
- **Port 3306 Conflict**:
  If Docker fails to start `dms-db` because port `3306` is already allocated, stop the local MySQL service in the XAMPP Control Panel or run `Stop-Service MySQL` in PowerShell.
- **Port 5173 or 5000 Conflict**:
  If another process is using port `5173` or `5000`, either terminate the running process or change the port mapping in `.env` (e.g., `FRONTEND_PORT=5174`).
