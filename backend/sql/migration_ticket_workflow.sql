-- ============================================
-- Migration: Ticket Workflow Extension
-- Help Desk Management System
-- Adds: category approval workflow, SLA management,
--       assignment lifecycle, enriched audit logs,
--       notification types, timeline support.
-- Safe for XAMPP / phpMyAdmin — run AFTER database.sql
-- and migration_add_missing_tables.sql / migration_ticket_categories.sql
-- ============================================

USE helpdesk_db;

-- ─────────────────────────────────────────────
-- 1. Extend tickets.status ENUM (keep old values for compatibility)
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 2. ticket_categories — approval workflow columns
-- ─────────────────────────────────────────────
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories'
    AND CONSTRAINT_NAME = 'fk_tc_sla_policy'
);
SET @sql_tc_sla := IF(@fk_tc_sla = 0,
  'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_sla_policy FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tc_sla;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 3. sla_policies table
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 4. ticket_category_requests — approval history
-- ─────────────────────────────────────────────
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_category_requests'
    AND CONSTRAINT_NAME = 'fk_tcr_category'
);
SET @sql_tcr_cat := IF(@fk_tcr_cat = 0,
  'ALTER TABLE ticket_category_requests ADD CONSTRAINT fk_tcr_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tcr_cat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 5. assignments — extend lifecycle
-- ─────────────────────────────────────────────
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments'
    AND CONSTRAINT_NAME = 'fk_assign_from'
);
SET @sql_assign_from := IF(@fk_assign_from = 0,
  'ALTER TABLE assignments ADD CONSTRAINT fk_assign_from FOREIGN KEY (from_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_assign_from;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 6. audit_logs — enrich
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 7. ticket_status_history — enrich
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 8. ticket_replies — add type + internal note flag
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 9. notifications — extend type enum
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 10. tickets — add workflow timestamps + SLA
-- ─────────────────────────────────────────────
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
    AND CONSTRAINT_NAME = 'fk_ticket_sla'
);
SET @sql_ticket_sla := IF(@fk_ticket_sla = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_ticket_sla FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_ticket_sla;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 11. Seed SLA policies (Critical/High/Medium/Low)
-- ─────────────────────────────────────────────
INSERT IGNORE INTO sla_policies (id, name, priority, response_hours, resolution_hours, description)
VALUES
  (UUID(), 'Critical SLA', 'urgent', 1,  4,  'Critical tickets resolved within 4 hours'),
  (UUID(), 'High SLA',     'high',     2,  8,  'High priority tickets resolved within 8 hours'),
  (UUID(), 'Medium SLA',   'medium',   4,  24, 'Medium priority tickets resolved within 24 hours'),
  (UUID(), 'Low SLA',      'low',      8,  72, 'Low priority tickets resolved within 72 hours');

-- ─────────────────────────────────────────────
-- 12. Permissions for new actions
-- ─────────────────────────────────────────────
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

-- Grant ticket workflow permissions to admin
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code IN (
  'tickets.escalate','tickets.merge','tickets.reopen','tickets.approve',
  'tickets.complete','tickets.reassign','tickets.change_priority','tickets.change_category',
  'tickets.internal_note','ticket_categories.approve','ticket_categories.reject','sla.manage'
);

-- Manager: approve/complete within department, escalate to admin, reassign staff
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code IN (
  'tickets.complete','tickets.reassign','tickets.change_priority','tickets.escalate','tickets.internal_note'
);

-- Staff: complete assigned tickets, change priority of own, internal notes
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'staff' AND p.code IN ('tickets.complete','tickets.internal_note');

SELECT 'Ticket workflow migration applied successfully' AS result;
