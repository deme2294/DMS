-- ============================================
-- Corporate Office Locations Migration
-- Add attachment fields for corporate office location documentation
-- ============================================

USE helpdesk_db;

SET @col_attachment := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'attachment'
);
SET @sql_attachment := IF(@col_attachment = 0,
  'ALTER TABLE office_locations ADD COLUMN attachment VARCHAR(500) NULL AFTER map_coordinates, ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment',
  'SELECT 1'
);
PREPARE stmt_att FROM @sql_attachment;
EXECUTE stmt_att;
DEALLOCATE PREPARE stmt_att;

SELECT 'Corporate office locations migration applied successfully' AS result;
