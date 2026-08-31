-- ============================================
-- Combined Migration: Run ALL missing schema changes
-- Safe for existing data - only ADD columns/tables
-- Run this ONCE against helpdesk_db
-- ============================================

USE helpdesk_db;

-- ============================================
-- 1. Missing Tables (migration_add_missing_tables.sql)
-- ============================================

CREATE TABLE IF NOT EXISTS notices (
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
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  rating INT,
  status ENUM('pending','read','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_replies (
  id CHAR(36) PRIMARY KEY,
  feedback_id CHAR(36) NOT NULL,
  replied_by CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags VARCHAR(500),
  attachment VARCHAR(500),
  attachment_name VARCHAR(255),
  status ENUM('draft','published') DEFAULT 'draft',
  author_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS office_locations (
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

INSERT IGNORE INTO permissions (code, description) VALUES
  ('notices.read', 'View notices'),
  ('notices.create', 'Create notices'),
  ('notices.update', 'Update notices'),
  ('notices.delete', 'Delete notices'),
  ('notices.manage', 'Manage notices'),
  ('feedback.read', 'View feedback'),
  ('feedback.update', 'Update feedback'),
  ('feedback.delete', 'Delete feedback'),
  ('knowledge.read', 'View knowledge base'),
  ('knowledge.manage', 'Manage knowledge base'),
  ('reports.read', 'View reports'),
  ('audit.read', 'View audit logs'),
  ('office.read', 'View office locations'),
  ('departments.read', 'View departments'),
  ('departments.manage', 'Manage departments'),
  ('matrix.manage', 'Manage user-department matrix');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'notices.manage';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code IN ('departments.read', 'departments.manage', 'matrix.manage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code IN ('departments.read', 'departments.manage', 'matrix.manage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'tickets.read','tickets.assign','tickets.approve','tickets.close',
  'dashboard.read','departments.manage','matrix.manage','reports.read','audit.read',
  'notices.read','knowledge.read'
)
WHERE r.name = 'manager';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('tickets.read','tickets.assign','dashboard.read','knowledge.read','notices.read')
WHERE r.name = 'staff';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('tickets.create','tickets.read','dashboard.read','knowledge.read','notices.read')
WHERE r.name = 'tenant';

-- Foreign keys for notices
SET @fk_notice := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND CONSTRAINT_NAME = 'fk_notice_user'
);
SET @sql_notice := IF(@fk_notice = 0,
  'ALTER TABLE notices ADD CONSTRAINT fk_notice_user FOREIGN KEY (created_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE stmt_notice FROM @sql_notice;
EXECUTE stmt_notice;
DEALLOCATE PREPARE stmt_notice;

-- Foreign keys for feedback
SET @fk_feedback := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feedback' AND CONSTRAINT_NAME = 'fk_feedback_tenant'
);
SET @sql_feedback := IF(@fk_feedback = 0,
  'ALTER TABLE feedback ADD CONSTRAINT fk_feedback_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_feedback FROM @sql_feedback;
EXECUTE stmt_feedback;
DEALLOCATE PREPARE stmt_feedback;

-- Notice expiry warning flag
SET @col_expiry_warned := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND COLUMN_NAME = 'expiry_warned'
);
SET @sql_expiry_warned := IF(@col_expiry_warned = 0,
  'ALTER TABLE notices ADD COLUMN expiry_warned TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt_expiry_warned FROM @sql_expiry_warned;
EXECUTE stmt_expiry_warned;
DEALLOCATE PREPARE stmt_expiry_warned;

-- Notice recipients table
CREATE TABLE IF NOT EXISTS notice_recipients (
  id CHAR(36) PRIMARY KEY,
  notice_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  acknowledged_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notice_user (notice_id, user_id),
  KEY idx_notice_recipients_notice (notice_id),
  KEY idx_notice_recipients_user (user_id)
);

SET @fk_nr_notice := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients' AND CONSTRAINT_NAME = 'fk_nr_notice'
);
SET @sql_nr_notice := IF(@fk_nr_notice = 0,
  'ALTER TABLE notice_recipients ADD CONSTRAINT fk_nr_notice FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_nr_notice FROM @sql_nr_notice;
EXECUTE stmt_nr_notice;
DEALLOCATE PREPARE stmt_nr_notice;

SET @fk_nr_user := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients' AND CONSTRAINT_NAME = 'fk_nr_user'
);
SET @sql_nr_user := IF(@fk_nr_user = 0,
  'ALTER TABLE notice_recipients ADD CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_nr_user FROM @sql_nr_user;
EXECUTE stmt_nr_user;
DEALLOCATE PREPARE stmt_nr_user;

-- ============================================
-- 2. Ticket Categories Table (migration_ticket_categories.sql)
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  department_id CHAR(36) NULL COMMENT 'Optional: category scoped to a department',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  routing_type ENUM('general','direct') NOT NULL DEFAULT 'general' COMMENT 'general = admin routes; direct = auto-route to department',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_name (name)
);

SET @fk_tc_created := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_created_by'
);
SET @sql_tc_created := IF(@fk_tc_created = 0,
  'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_created_by FOREIGN KEY (created_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tc_created;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_tc_dept := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_department'
);
SET @sql_tc_dept := IF(@fk_tc_dept = 0,
  'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tc_dept;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO permissions (code, description) VALUES
  ('ticket_categories.manage', 'Manage ticket categories');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'ticket_categories.manage';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code = 'ticket_categories.manage';

INSERT IGNORE INTO ticket_categories (id, name, description, department_id, is_active, created_by)
SELECT UUID(), c.name, c.description, NULL, 1,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (
  SELECT 'Hardware' AS name, 'Hardware related issues' AS description
  UNION ALL SELECT 'Software', 'Software and application issues'
  UNION ALL SELECT 'Network', 'Network and connectivity issues'
  UNION ALL SELECT 'Account Access', 'Login and account access problems'
  UNION ALL SELECT 'Email', 'Email related issues'
  UNION ALL SELECT 'General Inquiry', 'General inquiries and questions'
  UNION ALL SELECT 'Other', 'Other issues not listed above'
) c;

-- ============================================
-- 3. Ticket Workflow Extension (migration_ticket_workflow.sql)
-- ============================================

-- Extend tickets.status ENUM
SET @tickets_has_new_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
    AND COLUMN_TYPE LIKE '%''escalated''%'
);
SET @sql_tickets_status := IF(@tickets_has_new_status = 0,
  "ALTER TABLE tickets MODIFY COLUMN status ENUM(
     'submitted','under_review','assigned_department','assigned_staff',
     'in_progress','pending_approval','resolved','closed','rejected',
     'open','assigned','accepted','pending',
     'waiting_tenant','waiting_vendor','completed','approved',
     'cancelled','escalated','reopened'
   ) NOT NULL DEFAULT 'open'",
  'SELECT 1'
);
PREPARE stmt FROM @sql_tickets_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ticket_categories approval workflow columns
ALTER TABLE ticket_categories
  ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  ADD COLUMN routing_type ENUM('general','direct') NOT NULL DEFAULT 'general',
  ADD COLUMN sla_policy_id CHAR(36) NULL,
  ADD COLUMN requested_by CHAR(36) NULL,
  ADD COLUMN reviewed_by CHAR(36) NULL,
  ADD COLUMN reviewed_at DATETIME NULL,
  ADD COLUMN review_notes VARCHAR(255) NULL;

SET @fk_tc_sla := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_sla_policy'
);
SET @sql_tc_sla := IF(@fk_tc_sla = 0,
  'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_sla_policy FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tc_sla;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sla_policies table
CREATE TABLE IF NOT EXISTS sla_policies (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  priority ENUM('low','medium','high','urgent') NOT NULL,
  response_hours INT NOT NULL DEFAULT 4,
  resolution_hours INT NOT NULL DEFAULT 24,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sla_priority (priority)
);

-- ticket_category_requests
CREATE TABLE IF NOT EXISTS ticket_category_requests (
  id CHAR(36) PRIMARY KEY,
  category_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NULL,
  department_id CHAR(36) NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  review_notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tcr_category (category_id),
  KEY idx_tcr_status (status)
);

SET @fk_tcr_cat := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_category_requests' AND CONSTRAINT_NAME = 'fk_tcr_category'
);
SET @sql_tcr_cat := IF(@fk_tcr_cat = 0,
  'ALTER TABLE ticket_category_requests ADD CONSTRAINT fk_tcr_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tcr_cat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- assignments extend lifecycle
SET @assign_has_role := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'role'
);
SET @sql_assign_role := IF(@assign_has_role = 0,
  "ALTER TABLE assignments
     ADD COLUMN role ENUM('department_manager','staff') NOT NULL DEFAULT 'staff',
     ADD COLUMN from_assignment_id CHAR(36) NULL,
     ADD COLUMN accepted_at DATETIME NULL,
     ADD COLUMN rejected_at DATETIME NULL,
     ADD COLUMN reassigned_at DATETIME NULL,
     ADD COLUMN priority VARCHAR(20) NULL,
     ADD COLUMN category VARCHAR(100) NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql_assign_role;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_assign_from := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND CONSTRAINT_NAME = 'fk_assign_from'
);
SET @sql_assign_from := IF(@fk_assign_from = 0,
  'ALTER TABLE assignments ADD CONSTRAINT fk_assign_from FOREIGN KEY (from_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_assign_from;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- audit_logs enrich
SET @audit_role := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'role'
);
SET @sql_audit := IF(@audit_role = 0,
  "ALTER TABLE audit_logs
     ADD COLUMN role VARCHAR(50) NULL,
     ADD COLUMN old_value JSON NULL,
     ADD COLUMN new_value JSON NULL,
     ADD COLUMN browser VARCHAR(255) NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql_audit;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ticket_status_history enrich
SET @tsh_role := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_status_history' AND COLUMN_NAME = 'role'
);
SET @sql_tsh := IF(@tsh_role = 0,
  "ALTER TABLE ticket_status_history
     ADD COLUMN role VARCHAR(50) NULL,
     ADD COLUMN browser VARCHAR(255) NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql_tsh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ticket_replies add type + internal note flag
SET @reply_type := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_replies' AND COLUMN_NAME = 'type'
);
SET @sql_reply_type := IF(@reply_type = 0,
  "ALTER TABLE ticket_replies
     ADD COLUMN type ENUM('comment','note','reply') NOT NULL DEFAULT 'reply',
     ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0",
  'SELECT 1'
);
PREPARE stmt FROM @sql_reply_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- notifications extend type enum
SET @notif_type_ok := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
    AND COLUMN_TYPE LIKE '%''escalation''%'
);
SET @sql_notif_type := IF(@notif_type_ok = 0,
  "ALTER TABLE notifications MODIFY COLUMN type ENUM(
     'ticket','reply','status','assignment','notice',
     'category','sla','escalation','completion','approval',
     'rejection','reopen','merge','note','internal'
   ) DEFAULT 'ticket'",
  'SELECT 1'
);
PREPARE stmt FROM @sql_notif_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- tickets add workflow timestamps + SLA
SET @tickets_extra := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_policy_id'
);
SET @sql_tickets_extra := IF(@tickets_extra = 0,
  "ALTER TABLE tickets
     ADD COLUMN sla_policy_id CHAR(36) NULL,
     ADD COLUMN completed_at DATETIME NULL,
     ADD COLUMN approved_at DATETIME NULL,
     ADD COLUMN escalated_at DATETIME NULL,
     ADD COLUMN reopened_at DATETIME NULL,
     ADD COLUMN cancelled_at DATETIME NULL,
     ADD COLUMN auto_department_id CHAR(36) NULL,
     ADD COLUMN merged_into CHAR(36) NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql_tickets_extra;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_ticket_sla := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND CONSTRAINT_NAME = 'fk_ticket_sla'
);
SET @sql_ticket_sla := IF(@fk_ticket_sla = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_ticket_sla FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_ticket_sla;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed SLA policies
INSERT IGNORE INTO sla_policies (id, name, priority, response_hours, resolution_hours, description)
VALUES
  (UUID(), 'Critical SLA', 'urgent', 1,  4,  'Critical tickets resolved within 4 hours'),
  (UUID(), 'High SLA',     'high',     2,  8,  'High priority tickets resolved within 8 hours'),
  (UUID(), 'Medium SLA',   'medium',   4,  24, 'Medium priority tickets resolved within 24 hours'),
  (UUID(), 'Low SLA',      'low',      8,  72, 'Low priority tickets resolved within 72 hours');

-- Permissions for new actions
INSERT IGNORE INTO permissions (code, description) VALUES
  ('tickets.escalate', 'Escalate tickets'),
  ('tickets.merge', 'Merge duplicate tickets'),
  ('tickets.reopen', 'Reopen tickets'),
  ('tickets.approve', 'Approve completion'),
  ('tickets.complete', 'Mark tickets completed'),
  ('tickets.reassign', 'Reassign tickets'),
  ('tickets.change_priority', 'Change ticket priority'),
  ('tickets.change_category', 'Change ticket category'),
  ('tickets.internal_note', 'Add internal notes'),
  ('ticket_categories.approve', 'Approve category requests'),
  ('ticket_categories.reject', 'Reject category requests'),
  ('sla.manage', 'Manage SLA policies');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code IN (
  'tickets.escalate','tickets.merge','tickets.reopen','tickets.approve',
  'tickets.complete','tickets.reassign','tickets.change_priority','tickets.change_category',
  'tickets.internal_note','ticket_categories.approve','ticket_categories.reject','sla.manage'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code IN (
  'tickets.complete','tickets.reassign','tickets.change_priority','tickets.escalate','tickets.internal_note'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'staff' AND p.code IN ('tickets.complete','tickets.internal_note');

-- ============================================
-- 4. SLA Per-Category Migration (migration_sla_per_category.sql)
-- ============================================

-- sla_policies: category_id, escalation_hours, working_hours
SET @sla_has_category := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'category_id'
);
SET @sql_sla_category := IF(@sla_has_category = 0,
  'ALTER TABLE sla_policies ADD COLUMN category_id CHAR(36) NULL AFTER priority',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_category;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sla_has_esc := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'escalation_hours'
);
SET @sql_sla_esc := IF(@sla_has_esc = 0,
  'ALTER TABLE sla_policies ADD COLUMN escalation_hours INT DEFAULT 0 AFTER resolution_hours',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sla_has_wh := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'working_hours'
);
SET @sql_sla_wh := IF(@sla_has_wh = 0,
  'ALTER TABLE sla_policies ADD COLUMN working_hours JSON NULL AFTER escalation_hours',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_wh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old single-priority uniqueness
DROP INDEX IF EXISTS uq_sla_priority ON sla_policies;

-- Add per-category + priority uniqueness
SET @sla_has_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND INDEX_NAME = 'uq_sla_category_priority'
);
SET @sql_sla_uq := IF(@sla_has_uq = 0,
  'ALTER TABLE sla_policies ADD UNIQUE KEY uq_sla_category_priority (category_id, priority)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_sla_category := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND CONSTRAINT_NAME = 'fk_sla_category'
);
SET @sql_sla_fk := IF(@fk_sla_category = 0,
  'ALTER TABLE sla_policies ADD CONSTRAINT fk_sla_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- tickets: response_due_date, escalation_due_date, breach flags, sla_achieved, is_overdue
SET @tkt_has_resp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_due_date'
);
SET @sql_tkt_resp := IF(@tkt_has_resp = 0,
  'ALTER TABLE tickets ADD COLUMN response_due_date DATETIME NULL AFTER due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_resp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tkt_has_esc := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_due_date'
);
SET @sql_tkt_esc := IF(@tkt_has_esc = 0,
  'ALTER TABLE tickets ADD COLUMN escalation_due_date DATETIME NULL AFTER response_due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_resp := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_response_due'
);
SET @sql_idx_resp := IF(@idx_resp = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_response_due (response_due_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_resp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_esc := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_escalation_due'
);
SET @sql_idx_esc := IF(@idx_esc = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_escalation_due (escalation_due_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tkt_has_resp_breach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_sla_breached'
);
SET @sql_tkt_resp_breach := IF(@tkt_has_resp_breach = 0,
  'ALTER TABLE tickets ADD COLUMN response_sla_breached TINYINT(1) DEFAULT 0 AFTER escalation_due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_resp_breach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tkt_has_esc_breach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_sla_breached'
);
SET @sql_tkt_esc_breach := IF(@tkt_has_esc_breach = 0,
  'ALTER TABLE tickets ADD COLUMN escalation_sla_breached TINYINT(1) DEFAULT 0 AFTER response_sla_breached',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_esc_breach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tkt_has_sla_ach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_achieved'
);
SET @sql_tkt_sla_ach := IF(@tkt_has_sla_ach = 0,
  'ALTER TABLE tickets ADD COLUMN sla_achieved TINYINT(1) DEFAULT 0 AFTER escalation_sla_breached',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_sla_ach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_sla_ach := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_sla_achieved'
);
SET @sql_idx_sla_ach := IF(@idx_sla_ach = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_sla_achieved (sla_achieved)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_sla_ach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tkt_has_overdue := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'is_overdue'
);
SET @sql_tkt_overdue := IF(@tkt_has_overdue = 0,
  'ALTER TABLE tickets ADD COLUMN is_overdue TINYINT(1) DEFAULT 0 AFTER sla_achieved',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_overdue;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_overdue := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_is_overdue'
);
SET @sql_idx_overdue := IF(@idx_overdue = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_is_overdue (is_overdue)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_overdue;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add user_code column to users table for auto-generated user IDs
SET @col_user_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_code'
);
SET @sql_user_code := IF(@col_user_code = 0,
  'ALTER TABLE users ADD COLUMN user_code VARCHAR(20) NULL',
  'SELECT 1'
);
PREPARE stmt_user_code FROM @sql_user_code;
EXECUTE stmt_user_code;
DEALLOCATE PREPARE stmt_user_code;

SELECT 'All migrations applied successfully' AS result;
