-- ============================================
-- Help Desk Management System - Missing Tables Migration
-- Safe for XAMPP / phpMyAdmin
-- Run this AFTER database.sql if importing incrementally
-- ============================================

-- Notices
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

-- Feedback
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

-- Feedback Replies
CREATE TABLE IF NOT EXISTS feedback_replies (
  id CHAR(36) PRIMARY KEY,
  feedback_id CHAR(36) NOT NULL,
  replied_by CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base
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

-- Office Locations
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
  map_coordinates VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Additional Permissions
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

-- Grant full notice management to admins
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'notices.manage';

-- Department & Matrix management for admins and managers
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code IN ('departments.read', 'departments.manage', 'matrix.manage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code IN ('departments.read', 'departments.manage', 'matrix.manage');

-- Update role permissions
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

-- Add foreign keys for migration tables if they do not exist
SET @fk_notice := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notices'
    AND CONSTRAINT_NAME = 'fk_notice_user'
);
SET @sql_notice := IF(@fk_notice = 0,
  'ALTER TABLE notices ADD CONSTRAINT fk_notice_user FOREIGN KEY (created_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE stmt_notice FROM @sql_notice;
EXECUTE stmt_notice;
DEALLOCATE PREPARE stmt_notice;

SET @fk_feedback := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'feedback'
    AND CONSTRAINT_NAME = 'fk_feedback_tenant'
);
SET @sql_feedback := IF(@fk_feedback = 0,
  'ALTER TABLE feedback ADD CONSTRAINT fk_feedback_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_feedback FROM @sql_feedback;
EXECUTE stmt_feedback;
DEALLOCATE PREPARE stmt_feedback;

-- ============================================
-- Notice recipient tracking + expiry automation
-- ============================================

-- Flag published notices that have already triggered their expiry warning
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

-- Link notifications to a notice (in addition to tickets)
SET @col_notice_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'notice_id'
);
SET @sql_notice_id := IF(@col_notice_id = 0,
  'ALTER TABLE notifications ADD COLUMN notice_id CHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt_notice_id FROM @sql_notice_id;
EXECUTE stmt_notice_id;
DEALLOCATE PREPARE stmt_notice_id;

-- Extend the notification type enum with 'notice'
SET @type_has_notice := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
    AND COLUMN_TYPE LIKE '%''notice''%'
);
SET @sql_notice_type := IF(@type_has_notice = 0,
  "ALTER TABLE notifications MODIFY COLUMN type ENUM('ticket','reply','status','assignment','notice') DEFAULT 'ticket'",
  'SELECT 1'
);
PREPARE stmt_notice_type FROM @sql_notice_type;
EXECUTE stmt_notice_type;
DEALLOCATE PREPARE stmt_notice_type;

-- Recipient acknowledgement tracking for role-targeted notices
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

-- Foreign keys for notice_recipients (guarded)
SET @fk_nr_notice := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients'
    AND CONSTRAINT_NAME = 'fk_nr_notice'
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients'
    AND CONSTRAINT_NAME = 'fk_nr_user'
);
SET @sql_nr_user := IF(@fk_nr_user = 0,
  'ALTER TABLE notice_recipients ADD CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_nr_user FROM @sql_nr_user;
EXECUTE stmt_nr_user;
DEALLOCATE PREPARE stmt_nr_user;

-- Add user_code column to users table for auto-generated user IDs
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

