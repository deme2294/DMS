-- ============================================
-- Migration: Knowledge Base Role-Based Workflow
-- Help Desk Management System
-- Adds department scoping, approval/publish/archive
-- workflow, helpful ratings, and granular permissions.
-- Safe for XAMPP / phpMyAdmin — run AFTER database.sql
-- and the other migration_*.sql files.
-- ============================================

USE helpdesk_db;

-- ─────────────────────────────────────────────
-- 1. Extend knowledge_base.status ENUM (keep old values)
-- ─────────────────────────────────────────────
SET @kb_status_ok := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND COLUMN_TYPE LIKE '%''in_review''%'
);
SET @sql_kb_status := IF(@kb_status_ok = 0,
  "ALTER TABLE knowledge_base MODIFY COLUMN status ENUM(
     'draft','in_review','approved','published','archived'
   ) DEFAULT 'draft'",
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 2. Add workflow + rating columns
-- ─────────────────────────────────────────────
SET @kb_cols_ok := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND COLUMN_NAME = 'department_id'
);
SET @sql_kb_cols := IF(@kb_cols_ok = 0,
  "ALTER TABLE knowledge_base
     ADD COLUMN department_id CHAR(36) NULL,
     ADD COLUMN approved_by CHAR(36) NULL,
     ADD COLUMN published_by CHAR(36) NULL,
     ADD COLUMN archived_by CHAR(36) NULL,
     ADD COLUMN rejection_reason TEXT NULL,
     ADD COLUMN helpful_yes INT DEFAULT 0,
     ADD COLUMN helpful_no INT DEFAULT 0,
     ADD COLUMN published_at DATETIME NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_cols;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 3. Foreign keys (idempotent)
-- ─────────────────────────────────────────────
SET @fk_kb_dept := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND CONSTRAINT_NAME = 'fk_kb_department'
);
SET @sql_kb_dept := IF(@fk_kb_dept = 0,
  'ALTER TABLE knowledge_base ADD CONSTRAINT fk_kb_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_dept;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_kb_appr := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND CONSTRAINT_NAME = 'fk_kb_approved_by'
);
SET @sql_kb_appr := IF(@fk_kb_appr = 0,
  'ALTER TABLE knowledge_base ADD CONSTRAINT fk_kb_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_appr;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_kb_pub := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND CONSTRAINT_NAME = 'fk_kb_published_by'
);
SET @sql_kb_pub := IF(@fk_kb_pub = 0,
  'ALTER TABLE knowledge_base ADD CONSTRAINT fk_kb_published_by FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_pub;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_kb_arch := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base'
    AND CONSTRAINT_NAME = 'fk_kb_archived_by'
);
SET @sql_kb_arch := IF(@fk_kb_arch = 0,
  'ALTER TABLE knowledge_base ADD CONSTRAINT fk_kb_archived_by FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_kb_arch;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 4. Permissions for knowledge base workflow
-- ─────────────────────────────────────────────
INSERT IGNORE INTO permissions (code, description) VALUES
  ('knowledge.read', 'View knowledge base'),
  ('knowledge.create', 'Create knowledge base articles'),
  ('knowledge.update', 'Edit knowledge base articles'),
  ('knowledge.approve', 'Approve knowledge base articles'),
  ('knowledge.publish', 'Publish knowledge base articles'),
  ('knowledge.delete', 'Delete knowledge base articles'),
  ('knowledge.rate', 'Rate knowledge base articles'),
  ('knowledge.categories', 'Manage knowledge categories and tags'),
  ('knowledge.stats', 'View knowledge article statistics'),
  ('knowledge.manage', 'Manage knowledge base (full)');

-- Admin already has * (CROSS JOIN all) — ensure new codes are present
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code IN (
  'knowledge.read','knowledge.create','knowledge.update','knowledge.approve',
  'knowledge.publish','knowledge.delete','knowledge.rate','knowledge.categories',
  'knowledge.stats','knowledge.manage'
);

-- Manager: review, edit department articles, approve, submit, manage categories
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code IN (
  'knowledge.read','knowledge.create','knowledge.update',
  'knowledge.approve','knowledge.categories'
);

-- Staff: create drafts, edit own drafts
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'staff' AND p.code IN (
  'knowledge.read','knowledge.create','knowledge.update'
);

-- Tenant: read published only + rate
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'tenant' AND p.code IN (
  'knowledge.read','knowledge.rate'
);

SELECT 'Knowledge base workflow migration applied successfully' AS result;
