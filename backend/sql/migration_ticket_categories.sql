-- ============================================
-- Migration: Ticket Categories Table
-- Run this against helpdesk_db
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

-- Foreign keys (guarded)
SET @fk_tc_created := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories'
    AND CONSTRAINT_NAME = 'fk_tc_created_by'
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
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories'
    AND CONSTRAINT_NAME = 'fk_tc_department'
);
SET @sql_tc_dept := IF(@fk_tc_dept = 0,
  'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tc_dept;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add permission
INSERT IGNORE INTO permissions (code, description) VALUES
  ('ticket_categories.manage', 'Manage ticket categories');

-- Grant to admin
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'ticket_categories.manage';

-- Grant to manager
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code = 'ticket_categories.manage';

-- Seed default categories
INSERT IGNORE INTO ticket_categories (id, name, description, department_id, is_active, created_by)
SELECT
  UUID(), c.name, c.description, NULL, 1,
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
