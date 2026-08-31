-- ============================================
-- Office Feedback + Tenant Office Read Permission
-- ============================================

USE helpdesk_db;

-- Office-specific feedback from tenants
CREATE TABLE IF NOT EXISTS office_feedback (
  id CHAR(36) PRIMARY KEY,
  office_location_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  rating INT,
  status ENUM('pending','read','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_of_office (office_location_id),
  KEY idx_of_tenant (tenant_id)
);

-- Grant office.read to tenant role if not already present
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code = 'office.read'
WHERE r.name = 'tenant';

-- Foreign key for office_feedback
SET @fk_of_office := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_feedback' AND CONSTRAINT_NAME = 'fk_of_office'
);
SET @sql_of_office := IF(@fk_of_office = 0,
  'ALTER TABLE office_feedback ADD CONSTRAINT fk_of_office FOREIGN KEY (office_location_id) REFERENCES office_locations(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_of_office;
EXECUTE stmt;
DEALLOCATE stmt;

SET @fk_of_tenant := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_feedback' AND CONSTRAINT_NAME = 'fk_of_tenant'
);
SET @sql_of_tenant := IF(@fk_of_tenant = 0,
  'ALTER TABLE office_feedback ADD CONSTRAINT fk_of_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_of_tenant;
EXECUTE stmt;
DEALLOCATE stmt;

SET @fk_of_user := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_feedback' AND CONSTRAINT_NAME = 'fk_of_user'
);
SET @sql_of_user := IF(@fk_of_user = 0,
  'ALTER TABLE office_feedback ADD CONSTRAINT fk_of_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_of_user;
EXECUTE stmt;
DEALLOCATE stmt;

SELECT 'Office feedback migration applied' AS result;
