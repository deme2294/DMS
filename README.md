# Help Desk Management System

Government enterprise Help Desk with **Ticket Management** module.

## Tech Stack

- **Backend:** Node.js, Express, MySQL (XAMPP), JWT
- **Frontend:** React 19, TypeScript, Vite, React Router, Axios

## Prerequisites

- Node.js 18+
- XAMPP with MySQL running

## Setup

### 1. Database

1. Start Apache/MySQL in XAMPP
2. Open phpMyAdmin → Import `backend/sql/database.sql`

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API runs at `http://localhost:5000`

Update `backend/.env` if your MySQL password is not empty.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

## Demo Accounts

| Role    | Username | Password |
|---------|----------|----------|
| Admin   | admin    | password |
| Manager | manager  | password |
| Staff   | staff    | password |
| Tenant  | tenant   | password |

## Ticket Module Features

- Tenant submits tickets with attachments
- Reference number (`HD-YYYY-#####`) and track number (`TRK-...`)
- Role-based ticket visibility (admin, manager, staff, tenant)
- Status workflow with full audit trail (status history, replies, attachments, assignments)
- Ticket priorities: Low, Medium, High, Urgent
- Public/full ticket tracking (no login required for track page)
- Search, filter, pagination, sorting
- Real-time dashboard updates + notifications via Socket.IO
- Email notifications via Nodemailer

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/tickets` | List tickets (auth) |
| POST | `/api/tickets` | Create ticket (tenant) |
| GET | `/api/tickets/:id` | Ticket detail |
| PATCH | `/api/tickets/:id/status` | Change status |
| POST | `/api/tickets/:id/assign-department` | Admin assigns department |
| POST | `/api/tickets/:id/assign-staff` | Manager/Admin assigns staff |
| POST | `/api/tickets/:id/replies` | Add reply |
| GET | `/api/tickets/track/:trackNumber` | Public track |
| DELETE | `/api/tickets/:id` | Delete (admin) |

## Project Structure

```
DMS/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── repository/
│   ├── routes/
│   ├── services/
│   ├── sql/
│   └── uploads/tickets/
└── frontend/
    ├── api/
    └── src/
        ├── components/
        ├── context/
        ├── layouts/
        └── pages/Tickets/
```

## Next Modules

- Users, Tenants, Departments, Matrix (discussed in prior sessions)
- Assignments workflow, Knowledge Base, Notices, Feedback, Chat, Dashboard, Reports
