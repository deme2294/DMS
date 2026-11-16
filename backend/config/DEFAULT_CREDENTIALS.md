# DMS — Internal System Seed Credentials (Confidential)

> [!WARNING]
> **CONFIDENTIAL / RESTRICTED ACCESS**
> The public login page no longer exposes demo credentials. Share this document only with authorized personnel, administrators, and designated testers.

---

## 1. Pre-Configured System Accounts (Seed Data)

The following default accounts are created by the database seed script ([database.sql](file:///c:/Users/hp/Desktop/DMS/backend/sql/database.sql)) for initial system administration and role testing:

| Role Name | Username | Associated Email | Default Password | Access Level & Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin@demo.gov` | `password` | Full system administration, user management, category routing, SLA policies, and configuration. |
| **Department Manager** | `manager` | `manager@demo.gov` | `password` | Department ticket triage, staff assignment, approval workflow, SLA tracking, and team reports. |
| **Technical Staff** | `staff` | `staff@demo.gov` | `password` | Incident ticket resolution, internal notes, video conferences, and status updates. |
| **Tenant Client** | `tenant` | `tenant@demo.gov` | `password` | Ticket submission, SLA viewing, satisfaction feedback, and direct communications. |
| **CEO Executive** | `ceo` | `ceo@demo.gov` | `password` | High-level analytics, department KPI performance, notice publication, and executive oversight. |

---

## 2. Changing Default Passwords in Production

For production security, change the default passwords immediately after initial deployment:

### Method A: Through the Web Application
1. Log in with the respective account.
2. Click on the user avatar in the top right corner and select **My Profile** (`/profile`).
3. Enter your current password and set a new strong password.

### Method B: Via Direct Database Query (bcrypt hash)
To generate a new bcrypt hash and update a user directly:
```sql
-- Example: updating password for user 'admin'
UPDATE users 
SET password_hash = '$2b$10$YourGeneratedBcryptHashHere' 
WHERE username = 'admin';
```

---

## 3. Disabling Default Accounts
To disable any default account without deleting audit trails:
```sql
UPDATE users SET status = 'inactive' WHERE username = 'admin';
```
