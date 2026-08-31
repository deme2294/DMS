CREATE DATABASE IF NOT EXISTS helpdesk_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE helpdesk_db;

-- =====================================================================
-- Safe schema build for XAMPP / phpMyAdmin
-- Step 1: Drop tables in reverse dependency order
-- Step 2: Create all tables WITHOUT foreign keys
-- Step 3: Insert seed data
-- Step 4: Add foreign keys at the end
-- =====================================================================

-- ------------------------------------------------------------------
-- Step 1: Drop tables (safe order)
-- ------------------------------------------------------------------
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS ticket_replies;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS ticket_status_history;
DROP TABLE IF EXISTS ticket_attachments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS office_locations;
DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS feedback_replies;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS notices;
DROP TABLE IF EXISTS user_departments;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

-- ------------------------------------------------------------------
-- Step 2: Create tables WITHOUT foreign keys first
-- ------------------------------------------------------------------
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('admin','manager','staff','tenant','ceo') NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE tenants (
  id CHAR(36) PRIMARY KEY,
  tenant_id INT AUTO_INCREMENT UNIQUE,
  organization_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100) UNIQUE NOT NULL,
  contact_person VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30),
  address TEXT,
  notes TEXT,
  status ENUM('active','inactive','pending') DEFAULT 'pending',
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE departments (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  head_user_id CHAR(36) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
   id CHAR(36) PRIMARY KEY,
   tenant_id CHAR(36) NULL,
   role_id INT NOT NULL,
   username VARCHAR(80) NOT NULL UNIQUE,
   email VARCHAR(150) NOT NULL UNIQUE,
   password_hash VARCHAR(255) NOT NULL,
   first_name VARCHAR(100) NOT NULL,
   last_name VARCHAR(100) NOT NULL,
   phone VARCHAR(30),
   profile_image VARCHAR(255),
   status ENUM('active','inactive','locked') DEFAULT 'active',
   theme_preference ENUM('system','light','dark') DEFAULT 'system',
   user_code VARCHAR(20) NULL,
   failed_login_attempts INT DEFAULT 0,
   locked_until DATETIME NULL,
   last_login_at DATETIME NULL,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_departments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  department_id CHAR(36) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_department (user_id, department_id)
);

CREATE TABLE refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_history (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  username VARCHAR(80),
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  success TINYINT(1) NOT NULL,
  message VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id CHAR(36),
  ip_address VARCHAR(45),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id CHAR(36) PRIMARY KEY,
  reference_number VARCHAR(30) NOT NULL UNIQUE,
  track_number VARCHAR(30) NOT NULL UNIQUE,
  tenant_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  department_id CHAR(36) NULL,
  current_department_id CHAR(36) NULL,
  assigned_to CHAR(36) NULL,
  current_assigned_user_id CHAR(36) NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  category VARCHAR(100) NOT NULL,
  status ENUM(
    'open','assigned','in_progress','pending','waiting_tenant',
    'waiting_vendor','resolved','reopened','closed',
    'submitted','under_review','assigned_department','assigned_staff','pending_approval',
    'accepted','completed','approved','rejected','cancelled','escalated'
  ) DEFAULT 'open',
  tenant_confirmation_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  is_escalated TINYINT(1) NOT NULL DEFAULT 0,
  attachment_count INT NOT NULL DEFAULT 0,
  sla_policy_id CHAR(36) NULL,
  auto_department_id CHAR(36) NULL,
  due_date DATETIME NULL,
  response_due_date DATETIME NULL,
  escalation_due_date DATETIME NULL,
  response_sla_breached TINYINT(1) DEFAULT 0,
  escalation_sla_breached TINYINT(1) DEFAULT 0,
  sla_achieved TINYINT(1) DEFAULT 0,
  is_overdue TINYINT(1) DEFAULT 0,
  last_sla_warning_at DATETIME NULL,
  resolved_at DATETIME NULL,
  completed_at DATETIME NULL,
  approved_at DATETIME NULL,
  escalated_at DATETIME NULL,
  reopened_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  closed_at DATETIME NULL,
  approved_by CHAR(36) NULL,
  reopened_by CHAR(36) NULL,
  reopen_reason TEXT NULL,
  merged_into CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE ticket_attachments (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100),
  uploaded_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_status_history (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by CHAR(36) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_replies (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  visibility ENUM('all','internal') DEFAULT 'all',
  attachment_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('ticket','reply','status','assignment','notice','category','sla','escalation','completion','approval','rejection','reopen','merge','note','internal') DEFAULT 'ticket',
  ticket_id CHAR(36) NULL,
  notice_id CHAR(36) NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignments (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  assigned_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NOT NULL,
  notes TEXT,
  status ENUM('pending','accepted','completed','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE notices (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image VARCHAR(255),
  attachment VARCHAR(500),
  attachment_name VARCHAR(255),
  priority ENUM('low','medium','high') DEFAULT 'medium',
  status ENUM('draft','published','archived') DEFAULT 'draft',
  target_audience ENUM('all','admin','manager','staff','tenant','department') DEFAULT 'all',
  expires_at DATETIME NULL,
  expiry_warned TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE feedback (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  rating INT,
  status ENUM('pending','read','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE feedback_replies (
  id CHAR(36) PRIMARY KEY,
  feedback_id CHAR(36) NOT NULL,
  replied_by CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_base (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags VARCHAR(500),
  attachment VARCHAR(500),
  attachment_name VARCHAR(255),
  status ENUM('draft','in_review','approved','published','archived') DEFAULT 'draft',
  author_id CHAR(36) NOT NULL,
  department_id CHAR(36) NULL,
  approved_by CHAR(36) NULL,
  published_by CHAR(36) NULL,
  archived_by CHAR(36) NULL,
  rejection_reason TEXT NULL,
  helpful_yes INT DEFAULT 0,
  helpful_no INT DEFAULT 0,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE office_locations (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  employee_name VARCHAR(150) NOT NULL,
  employee_number VARCHAR(50),
  email VARCHAR(150),
  phone_extension VARCHAR(20),
  office_number VARCHAR(50),
  floor VARCHAR(20),
  building VARCHAR(100),
  building_id CHAR(36) NULL,
  description TEXT,
  attachment VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_status ON tickets(status);
CREATE INDEX idx_ticket_priority ON tickets(priority);
CREATE INDEX idx_ticket_department ON tickets(department_id);
CREATE INDEX idx_ticket_tenant ON tickets(tenant_id);
CREATE INDEX idx_ticket_track ON tickets(track_number);
CREATE INDEX idx_ticket_reference ON tickets(reference_number);
CREATE INDEX idx_reply_ticket ON ticket_replies(ticket_id);
CREATE INDEX idx_notification_user ON notifications(user_id, read_at, created_at);
CREATE INDEX idx_ticket_history_ticket ON ticket_status_history(ticket_id);

-- ------------------------------------------------------------------
-- Step 3: Insert seed data (parents before children)
-- ------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
('admin', 'System administrator'),
('manager', 'Department manager'),
('staff', 'Help desk staff'),
('tenant', 'External tenant user'),
('ceo', 'Chief Executive Officer (organization-wide oversight)');

INSERT INTO permissions (code, description) VALUES
('users.read', 'View users'),
('users.create', 'Create users'),
('users.update', 'Update users'),
('users.delete', 'Delete users'),
('tenants.manage', 'Manage tenants'),
('departments.manage', 'Manage departments'),
('matrix.manage', 'Manage user-department matrix'),
('tickets.create', 'Create tickets'),
('tickets.read', 'View tickets'),
('tickets.assign', 'Assign tickets'),
('tickets.approve', 'Approve tickets'),
('tickets.close', 'Close tickets'),
('dashboard.read', 'View dashboard'),
('notices.read', 'View notices'),
('notices.create', 'Create notices'),
('notices.update', 'Update notices'),
('notices.delete', 'Delete notices'),
('feedback.read', 'View feedback'),
('feedback.update', 'Update feedback'),
('feedback.delete', 'Delete feedback'),
('knowledge.read', 'View knowledge base'),
('knowledge.create', 'Create knowledge base articles'),
('knowledge.update', 'Edit knowledge base articles'),
('knowledge.approve', 'Approve knowledge base articles'),
('knowledge.publish', 'Publish knowledge base articles'),
('knowledge.delete', 'Delete knowledge base articles'),
('knowledge.rate', 'Rate knowledge base articles'),
('knowledge.categories', 'Manage knowledge categories and tags'),
('knowledge.stats', 'View knowledge article statistics'),
('knowledge.manage', 'Manage knowledge base (full)'),
('reports.read', 'View reports'),
('audit.read', 'View audit logs'),
('office.read', 'View office locations'),
('ceo.dashboard', 'View CEO executive dashboard'),
('executive.analytics', 'View executive analytics'),
('executive.reports', 'Generate and export executive reports'),
('executive.approvals', 'Approve/reject escalated tickets (executive oversight)'),
('executive.remarks', 'Add executive remarks to tickets');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'tickets.read','tickets.assign','tickets.approve','tickets.close',
  'dashboard.read','departments.manage','matrix.manage','reports.read','audit.read',
  'notices.read',
  'knowledge.read','knowledge.create','knowledge.update','knowledge.approve','knowledge.categories'
)
WHERE r.name = 'manager';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('tickets.read','tickets.assign','dashboard.read','notices.read',
  'knowledge.read','knowledge.create','knowledge.update')
WHERE r.name = 'staff';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('tickets.create','tickets.read','dashboard.read','notices.read',
  'knowledge.read','knowledge.rate')
WHERE r.name = 'tenant';

-- CEO: highest privilege. Inherits all Admin + Manager modules plus CEO-specific modules.
-- Excludes destructive technical privileges (users.delete / knowledge.delete) which remain
-- admin-only unless explicitly granted by RBAC policy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'users.read','users.create','users.update',
  'tenants.manage',
  'departments.manage','matrix.manage',
  'tickets.create','tickets.read','tickets.assign','tickets.approve','tickets.close',
  'dashboard.read','notices.read','notices.create','notices.update','notices.delete',
  'feedback.read','feedback.update','feedback.delete',
  'knowledge.read','knowledge.create','knowledge.update','knowledge.approve',
  'knowledge.publish','knowledge.categories','knowledge.stats','knowledge.manage',
  'reports.read','audit.read','office.read',
  'ceo.dashboard','executive.analytics','executive.reports','executive.approvals','executive.remarks'
)
WHERE r.name = 'ceo';

INSERT INTO tenants (id, tenant_id, organization_name, registration_number, contact_person, email, phone, address, notes, status, username, password, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 1, 'City Housing Office', 'REG-2024-001', 'John Tenant', 'tenant@demo.gov', '555-0100', 'Main Street 1', 'Demo tenant organization', 'active', 'tenant', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NULL);

INSERT INTO departments (id, name, code, description, status) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'IT Support', 'IT', 'Information Technology Support', 'active'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Human Resources', 'HR', 'Human Resources Department', 'active');

-- Password for all demo users is: password
INSERT INTO users (id, tenant_id, role_id, username, email, password_hash, first_name, last_name, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 1, 'admin', 'admin@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Admin', 'active'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 2, 'manager', 'manager@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dept', 'Manager', 'active'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 3, 'staff', 'staff@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Help', 'Staff', 'active'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 4, 'tenant', 'tenant@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Tenant', 'active'),
('cccccccc-cecc-cecc-cecc-cccccccccecc', NULL, 5, 'ceo', 'ceo@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Executive', 'Officer', 'active');

INSERT INTO user_departments (id, user_id, department_id) VALUES
('uddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
('ueeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- ------------------------------------------------------------------
-- Step 4: Add foreign keys AFTER all data is inserted
-- ------------------------------------------------------------------
ALTER TABLE departments
  ADD CONSTRAINT fk_department_head
  FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_user_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_user_role
  FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE user_departments
  ADD CONSTRAINT fk_ud_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ud_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT fk_rt_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE login_history
  ADD CONSTRAINT fk_lh_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tickets
  ADD CONSTRAINT fk_ticket_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ticket_created_by
  FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_ticket_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ticket_assigned_to
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT fk_ta_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ta_user
  FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE ticket_status_history
  ADD CONSTRAINT fk_tsh_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tsh_user
  FOREIGN KEY (changed_by) REFERENCES users(id);

ALTER TABLE ticket_replies
  ADD CONSTRAINT fk_tr_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tr_user
  FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CONSTRAINT fk_tr_attachment
  FOREIGN KEY (attachment_id) REFERENCES ticket_attachments(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD CONSTRAINT fk_n_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_n_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;

ALTER TABLE assignments
  ADD CONSTRAINT fk_a_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_a_assigned_by
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  ADD CONSTRAINT fk_a_assigned_to
  FOREIGN KEY (assigned_to) REFERENCES users(id);

ALTER TABLE notices
  ADD CONSTRAINT fk_notice_user
  FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE feedback
  ADD CONSTRAINT fk_feedback_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE feedback_replies
  ADD CONSTRAINT fk_fr_feedback
  FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_fr_user
  FOREIGN KEY (replied_by) REFERENCES users(id);

ALTER TABLE knowledge_base
  ADD CONSTRAINT fk_kb_user
  FOREIGN KEY (author_id) REFERENCES users(id),
  ADD CONSTRAINT fk_kb_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_approved_by
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_published_by
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_archived_by
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE office_locations
  ADD CONSTRAINT fk_ol_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Spec-aligned derived columns: attachment_count, current_department_id,
-- current_assigned_user_id are maintained via triggers so they always mirror
-- the live ticket state written by the application.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ticket_attachments_ai;
DELIMITER $$
CREATE TRIGGER trg_ticket_attachments_ai
  AFTER INSERT ON ticket_attachments
  FOR EACH ROW
BEGIN
  UPDATE tickets
     SET attachment_count = (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = NEW.ticket_id)
   WHERE id = NEW.ticket_id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_ticket_attachments_ad;
DELIMITER $$
CREATE TRIGGER trg_ticket_attachments_ad
  AFTER DELETE ON ticket_attachments
  FOR EACH ROW
BEGIN
  UPDATE tickets
     SET attachment_count = (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = OLD.ticket_id)
   WHERE id = OLD.ticket_id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_tickets_au;
DELIMITER $$
CREATE TRIGGER trg_tickets_au
  BEFORE UPDATE ON tickets
  FOR EACH ROW
BEGIN
  IF NEW.department_id IS NULL OR NEW.department_id <> OLD.department_id THEN
    SET NEW.current_department_id = NEW.department_id;
  END IF;
  IF NEW.assigned_to IS NULL OR NEW.assigned_to <> OLD.assigned_to THEN
    SET NEW.current_assigned_user_id = NEW.assigned_to;
  END IF;
END$$
DELIMITER ;
